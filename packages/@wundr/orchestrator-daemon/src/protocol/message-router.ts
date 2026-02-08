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
 *
 * This module is intentionally transport-agnostic: it accepts raw data
 * buffers and a send/close callback pair rather than referencing `ws`
 * directly.  This allows unit testing without a real socket.
 */

import { randomUUID } from 'node:crypto';

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
import {
  type HandlerContext,
  type MethodHandler,
  type MethodHandlerMap,
  RpcHandler,
  createHealthPingHandler,
  createSubscriptionHandlers,
} from './rpc-handler';
import { type EventSink, type Subscription, SubscriptionManager } from './subscription-manager';

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
  private binaryHandler: BinaryFrameHandler | null = null;
  private log: RouterLogger;

  constructor(config: MessageRouterConfig) {
    this.config = {
      ...config,
      serverCapabilities: config.serverCapabilities ?? ['streaming', 'binary', 'tool-approval', 'teams'],
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
      heartbeatTimeoutMs: config.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS,
    };

    this.log = config.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    this.subscriptions = new SubscriptionManager();
    this.rpcHandler = new RpcHandler();

    // Register built-in handlers
    this.rpcHandler.registerHandlers(createSubscriptionHandlers(this.subscriptions));
    this.rpcHandler.registerHandlers(createHealthPingHandler());
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

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.sendError(state, 'invalid', ErrorCodes.INVALID_REQUEST, 'malformed JSON');
      return;
    }

    // Pre-auth: only accept auth.connect
    if (!state.authenticated) {
      await this.handlePreAuth(state, parsed);
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

    // Dispatch to RPC handler
    const respond = RpcHandler.createResponder(request.id, (frame) => {
      this.sendFrame(state, frame);
    });

    const context: HandlerContext = {
      connectionId: state.connectionId,
      scopes: state.scopes,
      client: state.client!,
      subscriptions: this.subscriptions,
      respond,
    };

    await this.rpcHandler.handleRequest(request, context);
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
  } | null {
    const state = this.connections.get(connectionId);
    if (!state) {
      return null;
    }
    return {
      authenticated: state.authenticated,
      scopes: state.scopes,
      client: state.client,
    };
  }

  /**
   * Gracefully shut down: stop all heartbeats, close all connections.
   */
  shutdown(): void {
    for (const [, state] of this.connections) {
      this.stopHeartbeat(state);
      try {
        state.transport.close(1001, 'server shutting down');
      } catch {
        // Ignore
      }
    }
    this.connections.clear();
  }

  // -----------------------------------------------------------------------
  // Private -- authentication handshake
  // -----------------------------------------------------------------------

  private async handlePreAuth(state: ConnectionState, parsed: unknown): Promise<void> {
    // Must be a valid request frame
    const frameResult = RequestFrameSchema.safeParse(parsed);
    if (!frameResult.success) {
      state.transport.close(1008, 'first frame must be auth.connect request');
      return;
    }

    const frame = frameResult.data;

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
        if (state.transport.isOpen()) {
          state.transport.sendText(JSON.stringify(eventFrame));
        }
      },
      isOpen: () => state.transport.isOpen(),
    };
    this.subscriptions.registerConnection(state.connectionId, sink);

    // Build hello payload
    const hello: HelloPayload = {
      type: 'hello',
      protocol: negotiated,
      connectionId: state.connectionId,
      server: {
        version: this.config.serverVersion,
        capabilities: this.config.serverCapabilities ?? [],
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
      `connection authenticated: ${state.connectionId} client=${params.client.id} scopes=[${scopes.join(',')}]`,
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

      try {
        state.transport.sendText(JSON.stringify(frame));
      } catch {
        // Connection likely broken; will be cleaned up
      }
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
  // Private -- frame sending helpers
  // -----------------------------------------------------------------------

  private sendFrame(state: ConnectionState, frame: ResponseFrame | EventFrame): void {
    if (!state.transport.isOpen()) {
      return;
    }
    try {
      state.transport.sendText(JSON.stringify(frame));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log.error(`send error for ${state.connectionId}: ${msg}`);
    }
  }

  private sendResponse(
    state: ConnectionState,
    requestId: string,
    ok: boolean,
    payload?: unknown,
    error?: ErrorShape,
  ): void {
    this.sendFrame(state, {
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
}
