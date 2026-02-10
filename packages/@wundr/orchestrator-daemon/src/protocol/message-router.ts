/**
 * Message Router
 *
 * The top-level entry point for protocol v2 message handling.  Responsibilities:
 *
 *   1. Parse incoming text frames as JSON, validate against the frame schema.
 *   2. Decode incoming binary frames using the binary header format.
 *   3. Enforce the authentication handshake (first frame must be `auth.connect`).
 *   4. Manage per-connection heartbeat timers.
 *   5. Dispatch validated request frames to the RpcHandler.
 *   6. Provide a clean interface for the WebSocket server to hook into.
 *   7. Support JSON-RPC 2.0 and v1 protocol format auto-detection.
 *   8. Message batching, compression, and size enforcement via MessageCodec.
 *   9. Per-connection rate limiting via RateLimiter.
 *  10. Method discovery via MethodRegistry.
 *
 * This module is intentionally transport-agnostic: it accepts raw data
 * buffers and a send/close callback pair rather than referencing `ws`
 * directly.  This allows unit testing without a real socket.
 */

import { randomUUID } from 'node:crypto';

import {
  isJsonRpcMessage,
  jsonRpcErrorResponse,
  jsonRpcToNative,
  nativeEventToJsonRpc,
  nativeResponseToJsonRpc,
} from './jsonrpc-compat';
import { type CodecConfig, MessageCodec } from './message-codec';
import { MethodRegistry } from './method-registry';
import {
  type DetectedFormat,
  V1Adapter,
  detectFormat,
  isV1Message,
} from './protocol-upgrade';
import {
  type AuthConnectParams,
  type ClientInfo,
  type ErrorShape,
  type EventFrame,
  type HelloPayload,
  type ResponseFrame,
  type Scope,
  AuthConnectParamsSchema,
  BINARY_HEADER_FIXED_SIZE,
  BINARY_HEADER_VERSION,
  BinaryMetadataSchema,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
  ErrorCodes,
  MAX_BUFFERED_BYTES,
  MAX_PAYLOAD_BYTES,
  PROTOCOL_V2_EVENTS,
  PROTOCOL_V2_METHODS,
  PROTOCOL_VERSION,
  RequestFrameSchema,
  Scopes,
  errorShape,
} from './protocol-v2';
import { type RateLimitConfig, RateLimiter } from './rate-limiter';
import {
  type HandlerContext,
  type MethodHandler,
  type MethodHandlerMap,
  type RpcHandlerOptions,
  RpcHandler,
  createDiscoveryHandlers,
  createHealthPingHandler,
  createSubscriptionHandlers,
} from './rpc-handler';
import { type EventSink, SubscriptionManager } from './subscription-manager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Callback to authenticate an auth.connect request. */
export type AuthenticateFunc = (
  params: AuthConnectParams,
) => Promise<AuthResult> | AuthResult;

export interface AuthResult {
  ok: boolean;
  scopes?: Scope[];
  error?: string;
  /** Token expiry in ms since epoch. */
  expiresAtMs?: number;
}

/** Callbacks the MessageRouter uses to talk to the transport layer. */
export interface TransportCallbacks {
  /** Send a string (JSON) frame to the client. */
  sendText: (data: string) => void;
  /** Send a binary buffer to the client. */
  sendBinary: (data: Buffer) => void;
  /** Close the connection with an optional code and reason. */
  close: (code?: number, reason?: string) => void;
  /** Whether the connection is still open. */
  isOpen: () => boolean;
}

/** Configuration for the MessageRouter. */
export interface MessageRouterConfig {
  /** Server version string surfaced in the hello payload. */
  serverVersion: string;
  /** Additional server capabilities to advertise. */
  serverCapabilities?: string[];
  /** Override heartbeat interval (ms). */
  heartbeatIntervalMs?: number;
  /** Override heartbeat timeout (ms). */
  heartbeatTimeoutMs?: number;
  /** The authentication function. */
  authenticate: AuthenticateFunc;
  /** Optional logger. */
  logger?: RouterLogger;
  /** Rate limiting configuration. */
  rateLimitConfig?: Partial<RateLimitConfig>;
  /** Whether to enable rate limiting. Default: true. */
  enableRateLimiting?: boolean;
  /** Codec configuration for compression and batching. */
  codecConfig?: CodecConfig;
  /** Whether to allow v1 protocol fallback. Default: true. */
  allowV1Fallback?: boolean;
  /** Whether to allow JSON-RPC 2.0 format. Default: true. */
  allowJsonRpc?: boolean;
  /** RPC handler options (timeout, metrics callback). */
  rpcOptions?: Omit<RpcHandlerOptions, 'rateLimiter' | 'methodRegistry'>;
}

export interface RouterLogger {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

/** Handler for decoded binary frames. */
export type BinaryFrameHandler = (
  connectionId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  payload: Buffer,
  flags: number,
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

interface ConnectionState {
  connectionId: string;
  authenticated: boolean;
  scopes: Scope[];
  client: ClientInfo | null;
  transport: TransportCallbacks;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null;
  lastFrameAt: number;
  heartbeatSeq: number;
  /** Detected protocol format for this connection (set on first message). */
  detectedFormat: DetectedFormat | null;
  /** V1 adapter if the client is using v1 protocol. */
  v1Adapter: V1Adapter | null;
  /** Whether this client negotiated JSON-RPC 2.0 format. */
  jsonRpcMode: boolean;
  /** Original JSON-RPC ID type tracker (string or number). */
  jsonRpcOriginalIds: Map<string, string | number>;
  /** Compression negotiated for this connection. */
  compressionEnabled: boolean;
}

// ---------------------------------------------------------------------------
// MessageRouter
// ---------------------------------------------------------------------------

export class MessageRouter {
  private config: Required<
    Pick<MessageRouterConfig, 'serverVersion' | 'heartbeatIntervalMs' | 'heartbeatTimeoutMs'>
  > & MessageRouterConfig;

  private connections = new Map<string, ConnectionState>();
  private rpcHandler: RpcHandler;
  private subscriptions: SubscriptionManager;
  private methodRegistry: MethodRegistry;
  private rateLimiter: RateLimiter | null;
  private codec: MessageCodec;
  private binaryHandler: BinaryFrameHandler | null = null;
  private log: RouterLogger;

  constructor(config: MessageRouterConfig) {
    this.config = {
      ...config,
      serverCapabilities: config.serverCapabilities ?? [
        'streaming', 'binary', 'tool-approval', 'teams',
        'compression', 'batching', 'jsonrpc2', 'discovery',
      ],
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: config.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
    };

    this.log = config.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    // Initialize subsystems
    this.subscriptions = new SubscriptionManager();
    this.methodRegistry = new MethodRegistry();
    this.codec = new MessageCodec(config.codecConfig);

    // Rate limiter
    const enableRL = config.enableRateLimiting !== false;
    this.rateLimiter = enableRL ? new RateLimiter(config.rateLimitConfig) : null;

    // RPC handler
    this.rpcHandler = new RpcHandler({
      ...config.rpcOptions,
      rateLimiter: this.rateLimiter ?? undefined,
      methodRegistry: this.methodRegistry,
    });

    // Register built-in handlers
    this.rpcHandler.registerHandlers(createSubscriptionHandlers(this.subscriptions));
    this.rpcHandler.registerHandlers(createHealthPingHandler());
    this.rpcHandler.registerHandlers(createDiscoveryHandlers(this.methodRegistry));
  }

  // -----------------------------------------------------------------------
  // Public API -- called by the WebSocket server layer
  // -----------------------------------------------------------------------

  /**
   * Register domain-specific method handlers.  Call this during server
   * startup to attach session, prompt, tool, agent, team, memory, config,
   * and health handlers.
   */
  registerHandlers(handlers: MethodHandlerMap): void {
    this.rpcHandler.registerHandlers(handlers);
  }

  /** Register a single method handler. */
  registerHandler(method: string, handler: MethodHandler): void {
    this.rpcHandler.registerHandler(method, handler);
  }

  /** Register a handler for decoded binary frames. */
  setBinaryFrameHandler(handler: BinaryFrameHandler): void {
    this.binaryHandler = handler;
  }

  /** Access the method registry (for plugins to register extra methods). */
  getMethodRegistry(): MethodRegistry {
    return this.methodRegistry;
  }

  /** Access the subscription manager. */
  getSubscriptionManager(): SubscriptionManager {
    return this.subscriptions;
  }

  /** Access the rate limiter. */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  /** Access the message codec. */
  getCodec(): MessageCodec {
    return this.codec;
  }

  /**
   * Called when a new WebSocket connection is established.
   *
   * @returns The connection ID assigned to this connection.
   */
  onConnection(transport: TransportCallbacks): string {
    const connectionId = `conn_${randomUUID()}`;

    const state: ConnectionState = {
      connectionId,
      authenticated: false,
      scopes: [],
      client: null,
      transport,
      heartbeatTimer: null,
      heartbeatTimeoutTimer: null,
      lastFrameAt: Date.now(),
      heartbeatSeq: 0,
      detectedFormat: null,
      v1Adapter: null,
      jsonRpcMode: false,
      jsonRpcOriginalIds: new Map(),
      compressionEnabled: false,
    };

    this.connections.set(connectionId, state);
    this.log.debug(`connection opened: ${connectionId}`);

    return connectionId;
  }

  /**
   * Called when a WebSocket connection closes.
   */
  onClose(connectionId: string): void {
    const state = this.connections.get(connectionId);
    if (!state) {
      return;
    }

    this.stopHeartbeat(state);
    this.subscriptions.removeConnection(connectionId);
    this.rateLimiter?.removeConnection(connectionId);
    state.v1Adapter?.clear();
    this.connections.delete(connectionId);

    this.log.debug(`connection closed: ${connectionId}`);
  }

  /**
   * Called when a text (JSON) message is received from a client.
   */
  async onTextMessage(connectionId: string, data: string): Promise<void> {
    const state = this.connections.get(connectionId);
    if (!state) {
      return;
    }

    state.lastFrameAt = Date.now();
    this.resetHeartbeatTimeout(state);

    // Size check
    if (!this.codec.isWithinSizeLimit(Buffer.byteLength(data, 'utf-8'))) {
      this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'message exceeds size limit');
      return;
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      // If in JSON-RPC mode, send a JSON-RPC parse error
      if (state.jsonRpcMode) {
        this.sendJsonRpcError(state, null, -32700, 'parse error');
        return;
      }
      this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'malformed JSON');
      return;
    }

    // Handle batched messages (JSON array)
    if (Array.isArray(parsed)) {
      await this.handleBatch(state, parsed);
      return;
    }

    // Auto-detect format on first message
    if (state.detectedFormat === null) {
      state.detectedFormat = detectFormat(parsed);
      if (state.detectedFormat === 'jsonrpc2' && this.config.allowJsonRpc !== false) {
        state.jsonRpcMode = true;
        this.log.debug(`connection ${connectionId} using JSON-RPC 2.0 format`);
      } else if (state.detectedFormat === 'v1' && this.config.allowV1Fallback !== false) {
        state.v1Adapter = new V1Adapter();
        this.log.debug(`connection ${connectionId} using v1 protocol (upgrade adapter active)`);
      }
    }

    // Route based on detected format
    if (state.jsonRpcMode && isJsonRpcMessage(parsed)) {
      await this.handleJsonRpcMessage(state, parsed);
      return;
    }

    if (state.v1Adapter && isV1Message(parsed)) {
      await this.handleV1Message(state, data);
      return;
    }

    // Native v2 format
    await this.handleNativeMessage(state, parsed);
  }

  /**
   * Called when a binary message is received from a client.
   */
  async onBinaryMessage(connectionId: string, data: Buffer): Promise<void> {
    const state = this.connections.get(connectionId);
    if (!state) {
      return;
    }

    if (!state.authenticated) {
      state.transport.close(1008, 'binary frames require authentication');
      return;
    }

    state.lastFrameAt = Date.now();
    this.resetHeartbeatTimeout(state);

    // Decode binary header
    if (data.length < BINARY_HEADER_FIXED_SIZE) {
      this.log.warn(`binary frame too short from ${connectionId}: ${data.length} bytes`);
      return;
    }

    const version = data.readUInt8(0);
    if (version !== BINARY_HEADER_VERSION) {
      this.log.warn(`unsupported binary version from ${connectionId}: ${version}`);
      return;
    }

    const flags = data.readUInt8(1);
    const correlationId = data.subarray(2, 18).toString('hex');
    // Format as UUID: 8-4-4-4-12
    const correlationUuid = [
      correlationId.slice(0, 8),
      correlationId.slice(8, 12),
      correlationId.slice(12, 16),
      correlationId.slice(16, 20),
      correlationId.slice(20, 32),
    ].join('-');

    const metaLen = data.readUInt32BE(18);
    const metaEnd = BINARY_HEADER_FIXED_SIZE + metaLen;

    if (data.length < metaEnd) {
      this.log.warn(`binary frame metadata truncated from ${connectionId}`);
      return;
    }

    let metadata: Record<string, unknown> = {};
    if (metaLen > 0) {
      try {
        const metaJson = data.subarray(BINARY_HEADER_FIXED_SIZE, metaEnd).toString('utf-8');
        const metaParsed = JSON.parse(metaJson);
        const metaResult = BinaryMetadataSchema.safeParse(metaParsed);
        metadata = metaResult.success ? metaResult.data : metaParsed;
      } catch {
        this.log.warn(`binary frame metadata parse error from ${connectionId}`);
        return;
      }
    }

    const payload = data.subarray(metaEnd);

    if (this.binaryHandler) {
      try {
        await this.binaryHandler(connectionId, correlationUuid, metadata, payload, flags);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.log.error(`binary handler error for ${connectionId}: ${msg}`);
      }
    } else {
      this.log.warn(`no binary handler registered; dropping binary frame from ${connectionId}`);
    }
  }

  // -----------------------------------------------------------------------
  // Event emission (called by domain code)
  // -----------------------------------------------------------------------

  /**
   * Emit an event to all matching subscriptions.
   */
  emitEvent(event: string, payload?: unknown): void {
    this.subscriptions.emit(event, payload);
  }

  /**
   * Emit an event to a specific connection.
   */
  emitEventToConnection(connectionId: string, event: string, payload?: unknown): void {
    this.subscriptions.emitToConnection(connectionId, event, payload);
  }

  /**
   * Broadcast an event to all connections (bypasses subscriptions).
   */
  broadcastEvent(event: string, payload?: unknown): void {
    this.subscriptions.broadcast(event, payload);
  }

  // -----------------------------------------------------------------------
  // Introspection
  // -----------------------------------------------------------------------

  /** Number of active connections. */
  get connectionCount(): number {
    return this.connections.size;
  }

  /** Number of authenticated connections. */
  get authenticatedConnectionCount(): number {
    let count = 0;
    for (const [, state] of this.connections) {
      if (state.authenticated) {
        count++;
      }
    }
    return count;
  }

  /** Get connection state (for testing/monitoring). */
  getConnectionState(connectionId: string): {
    authenticated: boolean;
    scopes: Scope[];
    client: ClientInfo | null;
    detectedFormat: DetectedFormat | null;
    jsonRpcMode: boolean;
    compressionEnabled: boolean;
  } | null {
    const state = this.connections.get(connectionId);
    if (!state) {
      return null;
    }
    return {
      authenticated: state.authenticated,
      scopes: state.scopes,
      client: state.client,
      detectedFormat: state.detectedFormat,
      jsonRpcMode: state.jsonRpcMode,
      compressionEnabled: state.compressionEnabled,
    };
  }

  /**
   * Gracefully shut down: stop all heartbeats, close all connections.
   */
  shutdown(): void {
    this.rpcHandler.cancelAllPending();
    for (const [, state] of this.connections) {
      this.stopHeartbeat(state);
      state.v1Adapter?.clear();
      try {
        state.transport.close(1001, 'server shutting down');
      } catch {
        // Ignore
      }
    }
    this.connections.clear();
    this.rateLimiter?.reset();
  }

  // -----------------------------------------------------------------------
  // Private -- batch handling
  // -----------------------------------------------------------------------

  private async handleBatch(state: ConnectionState, items: unknown[]): Promise<void> {
    if (items.length === 0) {
      if (state.jsonRpcMode) {
        this.sendJsonRpcError(state, null, -32600, 'empty batch');
      } else {
        this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'empty batch');
      }
      return;
    }

    if (items.length > 50) {
      if (state.jsonRpcMode) {
        this.sendJsonRpcError(state, null, -32600, 'batch too large (max 50)');
      } else {
        this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'batch too large (max 50)');
      }
      return;
    }

    // Process each item sequentially to maintain ordering guarantees
    for (const item of items) {
      if (state.jsonRpcMode && isJsonRpcMessage(item)) {
        await this.handleJsonRpcMessage(state, item);
      } else if (state.v1Adapter && isV1Message(item)) {
        await this.handleV1Message(state, JSON.stringify(item));
      } else {
        await this.handleNativeMessage(state, item);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private -- JSON-RPC 2.0 handling
  // -----------------------------------------------------------------------

  private async handleJsonRpcMessage(state: ConnectionState, parsed: unknown): Promise<void> {
    const result = jsonRpcToNative(parsed);

    switch (result.type) {
      case 'request': {
        const frame = result.frame;

        // Track original JSON-RPC ID for response translation
        const obj = parsed as Record<string, unknown>;
        if ('id' in obj) {
          state.jsonRpcOriginalIds.set(frame.id, obj.id as string | number);
        }

        if (!state.authenticated) {
          await this.handlePreAuth(state, frame);
        } else if (frame.method === 'auth.connect') {
          this.sendJsonRpcError(state, obj.id as string | number, -32600, 'already authenticated');
        } else if (frame.method === 'auth.logout') {
          this.sendJsonRpcResponse(state, frame.id, { type: 'res', id: frame.id, ok: true, payload: { ok: true } });
          state.transport.close(1000, 'logout');
        } else {
          await this.dispatchRequest(state, frame);
        }
        break;
      }
      case 'notification':
        // JSON-RPC notifications have no response -- just log
        this.log.debug(`received JSON-RPC notification: ${result.event}`);
        break;
      case 'error':
        this.sendJsonRpcError(state, result.id, result.code, result.message);
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Private -- v1 protocol handling
  // -----------------------------------------------------------------------

  private async handleV1Message(state: ConnectionState, data: string): Promise<void> {
    const adapter = state.v1Adapter!;
    const frame = adapter.inbound(data);

    if (!frame) {
      this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'invalid v1 message format');
      return;
    }

    if (!state.authenticated) {
      await this.handlePreAuth(state, frame);
    } else {
      await this.dispatchRequest(state, frame);
    }
  }

  // -----------------------------------------------------------------------
  // Private -- native v2 handling
  // -----------------------------------------------------------------------

  private async handleNativeMessage(state: ConnectionState, parsed: unknown): Promise<void> {
    // Pre-auth: only accept auth.connect
    if (!state.authenticated) {
      const frameResult = RequestFrameSchema.safeParse(parsed);
      if (!frameResult.success) {
        state.transport.close(1008, 'first frame must be auth.connect request');
        return;
      }
      await this.handlePreAuth(state, frameResult.data);
      return;
    }

    // Post-auth: validate as request frame
    const frameResult = RequestFrameSchema.safeParse(parsed);
    if (!frameResult.success) {
      const id =
        parsed && typeof parsed === 'object' && 'id' in parsed
          ? String((parsed as Record<string, unknown>).id)
          : 'invalid';
      this.sendError(state, id, ErrorCodes.INVALID_REQUEST, 'invalid request frame');
      return;
    }

    const request = frameResult.data;

    // Disallow auth.connect after already authenticated
    if (request.method === 'auth.connect') {
      this.sendError(state, request.id, ErrorCodes.INVALID_REQUEST, 'already authenticated');
      return;
    }

    // Handle auth.logout
    if (request.method === 'auth.logout') {
      this.sendResponse(state, request.id, true, { ok: true });
      state.transport.close(1000, 'logout');
      return;
    }

    await this.dispatchRequest(state, request);
  }

  // -----------------------------------------------------------------------
  // Private -- unified request dispatch
  // -----------------------------------------------------------------------

  private async dispatchRequest(
    state: ConnectionState,
    request: { type: 'req'; id: string; method: string; params?: unknown },
  ): Promise<void> {
    // Build respond function with format-aware serialization
    const respond = RpcHandler.createResponder(request.id, (frame) => {
      this.sendResponseFrame(state, frame);
    });

    // Build event sender for streaming
    const sendEvent = (eventFrame: EventFrame) => {
      this.sendEventFrame(state, eventFrame);
    };

    const sendResponse = (resFrame: ResponseFrame) => {
      this.sendResponseFrame(state, resFrame);
    };

    const context: HandlerContext = {
      connectionId: state.connectionId,
      scopes: state.scopes,
      client: state.client!,
      subscriptions: this.subscriptions,
      respond,
      sendEvent,
      sendResponse,
      isOpen: () => state.transport.isOpen(),
      requestId: request.id,
    };

    await this.rpcHandler.handleRequest(request as any, context);
  }

  // -----------------------------------------------------------------------
  // Private -- authentication handshake
  // -----------------------------------------------------------------------

  private async handlePreAuth(
    state: ConnectionState,
    frame: { type: 'req'; id: string; method: string; params?: unknown },
  ): Promise<void> {
    // Must be auth.connect
    if (frame.method !== 'auth.connect') {
      this.sendError(
        state,
        frame.id,
        ErrorCodes.INVALID_REQUEST,
        'first request must be auth.connect',
      );
      state.transport.close(1008, 'handshake failed');
      return;
    }

    // Validate auth.connect params
    const paramsResult = AuthConnectParamsSchema.safeParse(frame.params);
    if (!paramsResult.success) {
      this.sendError(
        state,
        frame.id,
        ErrorCodes.INVALID_REQUEST,
        `invalid auth.connect params: ${paramsResult.error.issues.map((i) => i.message).join('; ')}`,
      );
      state.transport.close(1008, 'invalid connect params');
      return;
    }

    const params = paramsResult.data;

    // Protocol version negotiation
    const negotiated = Math.min(params.maxProtocol, PROTOCOL_VERSION);
    if (negotiated < params.minProtocol || negotiated < 2) {
      this.sendError(
        state,
        frame.id,
        ErrorCodes.PROTOCOL_MISMATCH,
        `protocol mismatch: server supports v${PROTOCOL_VERSION}, client requires v${params.minProtocol}-${params.maxProtocol}`,
      );
      state.transport.close(1002, 'protocol mismatch');
      return;
    }

    // Check if client supports compression
    if (params.capabilities?.includes('compression')) {
      state.compressionEnabled = true;
    }

    // Authenticate
    let authResult: AuthResult;
    try {
      authResult = await this.config.authenticate(params);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log.error(`auth error for ${state.connectionId}: ${msg}`);
      this.sendError(state, frame.id, ErrorCodes.INTERNAL, 'authentication error');
      state.transport.close(1011, 'auth error');
      return;
    }

    if (!authResult.ok) {
      this.sendError(
        state,
        frame.id,
        ErrorCodes.UNAUTHORIZED,
        authResult.error ?? 'unauthorized',
      );
      state.transport.close(1008, 'unauthorized');
      return;
    }

    // Success -- transition to authenticated state
    const scopes = authResult.scopes ?? [Scopes.ADMIN];
    state.authenticated = true;
    state.scopes = scopes;
    state.client = params.client;

    // Register with subscription manager
    const sink: EventSink = {
      send: (eventFrame: EventFrame) => {
        this.sendEventFrame(state, eventFrame);
      },
      isOpen: () => state.transport.isOpen(),
    };
    this.subscriptions.registerConnection(state.connectionId, sink);

    // Build hello payload with enhanced capabilities
    const capabilities = [...(this.config.serverCapabilities ?? [])];
    if (state.compressionEnabled) {
      capabilities.push('compression.gzip', 'compression.deflate');
    }

    const hello: HelloPayload = {
      type: 'hello',
      protocol: negotiated,
      connectionId: state.connectionId,
      server: {
        version: this.config.serverVersion,
        capabilities,
      },
      methods: [...PROTOCOL_V2_METHODS],
      events: [...PROTOCOL_V2_EVENTS],
      policy: {
        maxPayloadBytes: MAX_PAYLOAD_BYTES,
        heartbeatIntervalMs: this.config.heartbeatIntervalMs,
        heartbeatTimeoutMs: this.config.heartbeatTimeoutMs,
        maxBufferedBytes: MAX_BUFFERED_BYTES,
      },
      auth: {
        scopes,
        expiresAtMs: authResult.expiresAtMs,
      },
    };

    this.sendResponse(state, frame.id, true, hello);

    // Start heartbeat
    this.startHeartbeat(state);

    this.log.info(
      `connection authenticated: ${state.connectionId} client=${params.client.id} scopes=[${scopes.join(',')}]` +
      (state.jsonRpcMode ? ' format=jsonrpc2' : state.v1Adapter ? ' format=v1-compat' : ' format=v2') +
      (state.compressionEnabled ? ' compression=on' : ''),
    );
  }

  // -----------------------------------------------------------------------
  // Private -- heartbeat management
  // -----------------------------------------------------------------------

  private startHeartbeat(state: ConnectionState): void {
    // Periodic heartbeat
    state.heartbeatTimer = setInterval(() => {
      if (!state.transport.isOpen()) {
        this.stopHeartbeat(state);
        return;
      }

      const heartbeatPayload = {
        serverTimestamp: Date.now(),
        seq: state.heartbeatSeq++,
      };

      const frame: EventFrame = {
        type: 'event',
        event: 'health.heartbeat',
        payload: heartbeatPayload,
        seq: heartbeatPayload.seq,
      };

      this.sendEventFrame(state, frame);
    }, this.config.heartbeatIntervalMs);

    // Start initial timeout
    this.resetHeartbeatTimeout(state);
  }

  private resetHeartbeatTimeout(state: ConnectionState): void {
    if (state.heartbeatTimeoutTimer) {
      clearTimeout(state.heartbeatTimeoutTimer);
    }

    state.heartbeatTimeoutTimer = setTimeout(() => {
      this.log.warn(`heartbeat timeout for ${state.connectionId}`);
      try {
        state.transport.close(1001, 'heartbeat timeout');
      } catch {
        // Ignore
      }
    }, this.config.heartbeatTimeoutMs);
  }

  private stopHeartbeat(state: ConnectionState): void {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);
      state.heartbeatTimer = null;
    }
    if (state.heartbeatTimeoutTimer) {
      clearTimeout(state.heartbeatTimeoutTimer);
      state.heartbeatTimeoutTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Private -- format-aware frame sending helpers
  // -----------------------------------------------------------------------

  /**
   * Send a response frame, respecting the client's protocol format.
   */
  private sendResponseFrame(state: ConnectionState, frame: ResponseFrame): void {
    if (!state.transport.isOpen()) {
      return;
    }

    try {
      if (state.jsonRpcMode) {
        const originalId = state.jsonRpcOriginalIds.get(frame.id);
        state.jsonRpcOriginalIds.delete(frame.id);
        const jsonRpc = nativeResponseToJsonRpc(frame, originalId);
        state.transport.sendText(JSON.stringify(jsonRpc));
      } else if (state.v1Adapter) {
        state.transport.sendText(state.v1Adapter.outboundResponse(frame));
      } else {
        state.transport.sendText(JSON.stringify(frame));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log.error(`send error for ${state.connectionId}: ${msg}`);
    }
  }

  /**
   * Send an event frame, respecting the client's protocol format.
   */
  private sendEventFrame(state: ConnectionState, frame: EventFrame): void {
    if (!state.transport.isOpen()) {
      return;
    }

    try {
      if (state.jsonRpcMode) {
        const jsonRpc = nativeEventToJsonRpc(frame);
        state.transport.sendText(JSON.stringify(jsonRpc));
      } else if (state.v1Adapter) {
        state.transport.sendText(state.v1Adapter.outboundEvent(frame));
      } else {
        state.transport.sendText(JSON.stringify(frame));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log.error(`send error for ${state.connectionId}: ${msg}`);
    }
  }

  private sendFrame(state: ConnectionState, frame: ResponseFrame | EventFrame): void {
    if (frame.type === 'res') {
      this.sendResponseFrame(state, frame);
    } else {
      this.sendEventFrame(state, frame as EventFrame);
    }
  }

  private sendResponse(
    state: ConnectionState,
    requestId: string,
    ok: boolean,
    payload?: unknown,
    error?: ErrorShape,
  ): void {
    this.sendResponseFrame(state, {
      type: 'res',
      id: requestId,
      ok,
      payload,
      error,
    });
  }

  private sendError(
    state: ConnectionState,
    requestId: string,
    code: string,
    message: string,
  ): void {
    this.sendResponse(state, requestId, false, undefined, errorShape(code as any, message));
  }

  private sendJsonRpcError(
    state: ConnectionState,
    id: string | number | null,
    code: number,
    message: string,
  ): void {
    if (!state.transport.isOpen()) {
return;
}
    try {
      const errorResp = jsonRpcErrorResponse(id, code, message);
      state.transport.sendText(JSON.stringify(errorResp));
    } catch {
      // Ignore
    }
  }

  private sendJsonRpcResponse(
    state: ConnectionState,
    requestId: string,
    frame: ResponseFrame,
  ): void {
    this.sendResponseFrame(state, frame);
  }
}
