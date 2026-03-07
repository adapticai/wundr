/**
 * DaemonClient
 *
 * WebSocket client that connects to the orchestrator daemon using protocol v2.
 * Supports JSON-RPC-style request/response, server-push event subscriptions,
 * and exponential-backoff reconnection.
 *
 * Designed to work in both Node.js (via the `ws` package) and browsers
 * (via the native WebSocket API), which makes it compatible with Next.js
 * SSR and client-side rendering.
 */

import type {
  AuthConnectParams,
  ErrorShape,
  EventFrame,
  HelloPayload,
  ProtocolFrame,
  ResponseFrame,
  SubscribeParams,
  SubscribeResult,
  UnsubscribeParams,
} from './protocol.js';
import {
  CLIENT_ID,
  CLIENT_PLATFORM,
  CLIENT_VERSION,
  PROTOCOL_VERSION,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Environment-aware WebSocket
// ---------------------------------------------------------------------------

/**
 * Returns the global WebSocket constructor, supporting both browser and Node.js
 * (when the `ws` package is available).
 */
function resolveWebSocket(): typeof WebSocket {
  if (typeof globalThis.WebSocket !== 'undefined') {
    return globalThis.WebSocket;
  }
  // Dynamic require for Node.js environments (ws package)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebSocket: NodeWebSocket } = require('ws') as {
    WebSocket: typeof WebSocket;
  };
  return NodeWebSocket;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'closing';

export type EventCallback<T = unknown> = (payload: T) => void;
export type MessageCallback = (frame: ProtocolFrame) => void;
export type StateChangeCallback = (state: ConnectionState) => void;

export interface DaemonClientOptions {
  /**
   * Maximum number of reconnection attempts before giving up.
   * Set to 0 to disable automatic reconnection.
   * @default 8
   */
  maxReconnectAttempts?: number;
  /**
   * Base delay (ms) for the first reconnect attempt.
   * Subsequent attempts use exponential backoff up to `maxReconnectDelay`.
   * @default 500
   */
  reconnectBaseDelay?: number;
  /**
   * Maximum delay (ms) between reconnect attempts.
   * @default 30_000
   */
  maxReconnectDelay?: number;
  /**
   * How long (ms) to wait for the initial connection and auth handshake.
   * @default 10_000
   */
  connectTimeout?: number;
  /**
   * How long (ms) to wait for a JSON-RPC response before rejecting.
   * @default 30_000
   */
  requestTimeout?: number;
  /**
   * Client display name sent during the auth.connect handshake.
   */
  clientDisplayName?: string;
  /**
   * Additional capabilities to advertise to the server.
   */
  capabilities?: string[];
  /**
   * Requested permission scopes.
   * @default ['daemon.read', 'daemon.write']
   */
  scopes?: string[];
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: DaemonError) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DaemonError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(error: ErrorShape) {
    super(error.message);
    this.name = 'DaemonError';
    this.code = error.code;
    this.details = error.details;
    this.retryable = error.retryable ?? false;
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class RequestTimeoutError extends Error {
  readonly requestId: string;

  constructor(requestId: string, method: string) {
    super(`Request timed out: ${method} (id=${requestId})`);
    this.name = 'RequestTimeoutError';
    this.requestId = requestId;
  }
}

// ---------------------------------------------------------------------------
// DaemonClient
// ---------------------------------------------------------------------------

export class DaemonClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private url = '';
  private apiKey = '';
  private opts: Required<DaemonClientOptions>;

  /** Maps JSON-RPC request id -> pending promise. */
  private pending = new Map<string, PendingRequest>();

  /** Maps daemon event name -> set of callbacks. */
  private eventListeners = new Map<string, Set<EventCallback>>();

  /** General-purpose raw message listeners. */
  private messageListeners = new Set<MessageCallback>();

  /** State change listeners. */
  private stateListeners = new Set<StateChangeCallback>();

  /** Heartbeat timer returned by the server's hello payload. */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Monotonically increasing request counter for unique IDs. */
  private requestCounter = 0;

  /** Resolved after a successful auth.connect handshake. */
  private helloPayload: HelloPayload | null = null;

  constructor(opts: DaemonClientOptions = {}) {
    this.opts = {
      maxReconnectAttempts: opts.maxReconnectAttempts ?? 8,
      reconnectBaseDelay: opts.reconnectBaseDelay ?? 500,
      maxReconnectDelay: opts.maxReconnectDelay ?? 30_000,
      connectTimeout: opts.connectTimeout ?? 10_000,
      requestTimeout: opts.requestTimeout ?? 30_000,
      clientDisplayName: opts.clientDisplayName ?? 'Neolith Web',
      capabilities: opts.capabilities ?? [],
      scopes: opts.scopes ?? ['daemon.read', 'daemon.write'],
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Establish an authenticated WebSocket connection to the daemon.
   *
   * Resolves once the auth.connect handshake completes successfully.
   * Rejects if the connection cannot be established within `connectTimeout`.
   */
  async connect(url: string, apiKey: string): Promise<HelloPayload> {
    if (this.state !== 'disconnected') {
      throw new ConnectionError(
        `Cannot connect from state "${this.state}". Call disconnect() first.`
      );
    }

    this.url = url;
    this.apiKey = apiKey;
    this.reconnectAttempts = 0;

    return this.openConnection();
  }

  /**
   * Gracefully close the WebSocket connection.
   * Cancels any pending reconnection attempts.
   */
  async disconnect(): Promise<void> {
    this.cancelReconnect();
    this.stopHeartbeat();
    this.setState('closing');

    // Reject all in-flight requests.
    const closing = new ConnectionError('Client disconnecting');
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new DaemonError({ code: 'CLIENT_DISCONNECT', message: closing.message })
      );
      this.pending.delete(id);
    }

    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.close(1000, 'Client disconnect');
    }

    this.ws = null;
    this.setState('disconnected');
  }

  /**
   * Send a JSON-RPC request frame to the daemon and await the response.
   *
   * @param method  Protocol method name (e.g. "session.create")
   * @param params  Method-specific parameters
   * @returns       The `payload` from the server's response frame
   */
  async sendMessage<TResult = unknown>(
    method: string,
    params?: unknown
  ): Promise<TResult> {
    this.assertConnected();

    const id = this.nextId();
    const frame: ProtocolFrame = { type: 'req', id, method, params };

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RequestTimeoutError(id, method));
      }, this.opts.requestTimeout);

      this.pending.set(id, {
        resolve: payload => resolve(payload as TResult),
        reject,
        timer,
      });

      this.sendRaw(frame);
    });
  }

  /**
   * Subscribe to a server-push event by name (supports glob patterns such as
   * "stream.*" or "*").
   *
   * @param event     Exact event name to listen for locally (matched against
   *                  the `event` field in EventFrame messages).
   * @param callback  Called with the event payload each time the event fires.
   * @returns         Unsubscribe function – call it to remove this listener.
   */
  subscribe<T = unknown>(
    event: string,
    callback: EventCallback<T>
  ): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback);

    return () => {
      const set = this.eventListeners.get(event);
      if (set) {
        set.delete(callback as EventCallback);
        if (set.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Register a listener for ALL incoming protocol frames (requests, responses,
   * and events). Useful for debugging or building custom middleware.
   *
   * @returns  Unsubscribe function.
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  /**
   * Register a listener for connection state changes.
   *
   * @returns  Unsubscribe function.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * Convenience wrapper that calls `subscribe` on the daemon server itself
   * (sends a `subscribe` RPC), requesting the server to push matching events.
   *
   * Use `subscribe()` to register local JavaScript handlers; use
   * `serverSubscribe()` to register with the server's subscription system.
   */
  async serverSubscribe(params: SubscribeParams): Promise<SubscribeResult> {
    return this.sendMessage<SubscribeResult>('subscribe', params);
  }

  /**
   * Cancel a server-side subscription by its ID.
   */
  async serverUnsubscribe(params: UnsubscribeParams): Promise<void> {
    await this.sendMessage('unsubscribe', params);
  }

  /** Current connection state. */
  getState(): ConnectionState {
    return this.state;
  }

  /** True when the connection is established and authenticated. */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /** The hello payload received after successful authentication, or null. */
  getHelloPayload(): HelloPayload | null {
    return this.helloPayload;
  }

  // -------------------------------------------------------------------------
  // Internal – connection lifecycle
  // -------------------------------------------------------------------------

  private async openConnection(): Promise<HelloPayload> {
    this.setState('connecting');

    return new Promise<HelloPayload>((resolve, reject) => {
      const WS = resolveWebSocket();
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new ConnectionError('Connection timed out'));
        this.handleClose(1006, 'Connection timed out', false);
      }, this.opts.connectTimeout);

      const ws = new WS(this.url);
      this.ws = ws;

      const cleanup = () => clearTimeout(timeout);

      ws.onopen = () => {
        this.setState('authenticating');
        this.sendRaw(this.buildAuthConnectFrame());
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        const frame = this.parseFrame(event.data);
        if (!frame) return;

        // Notify general listeners even during handshake.
        this.notifyMessageListeners(frame);

        // During authentication, wait for the hello response.
        if (!settled && frame.type === 'res') {
          const res = frame as ResponseFrame;
          if (!res.ok) {
            settled = true;
            cleanup();
            reject(
              new DaemonError(
                res.error ?? {
                  code: 'AUTH_FAILED',
                  message: 'Authentication rejected by daemon',
                }
              )
            );
            this.setState('disconnected');
            return;
          }

          const hello = res.payload as HelloPayload;
          this.helloPayload = hello;
          this.reconnectAttempts = 0;

          // Wire up the ongoing message handler now that we are connected.
          ws.onmessage = (ev: MessageEvent<string>) =>
            this.handleMessage(ev.data);

          this.setState('connected');
          this.startHeartbeat(hello.policy.heartbeatIntervalMs);

          settled = true;
          cleanup();
          resolve(hello);
          return;
        }

        if (!settled && frame.type === 'event') {
          // Events before hello are unusual but handle gracefully.
          this.dispatchEvent(frame as EventFrame);
        }
      };

      ws.onerror = () => {
        // The close event will fire right after; let handleClose manage state.
        if (!settled) {
          settled = true;
          cleanup();
          reject(new ConnectionError('WebSocket error during connection'));
        }
      };

      ws.onclose = (event: CloseEvent) => {
        cleanup();
        if (!settled) {
          settled = true;
          reject(
            new ConnectionError(
              `WebSocket closed before auth: code=${event.code}`
            )
          );
        }
        this.handleClose(event.code, event.reason, true);
      };
    });
  }

  private handleMessage(data: string): void {
    const frame = this.parseFrame(data);
    if (!frame) return;

    this.notifyMessageListeners(frame);

    if (frame.type === 'res') {
      this.handleResponse(frame);
    } else if (frame.type === 'event') {
      this.dispatchEvent(frame);
    }
  }

  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pending.get(frame.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(
        new DaemonError(
          frame.error ?? {
            code: 'UNKNOWN',
            message: 'Unknown error from daemon',
          }
        )
      );
    }
  }

  private dispatchEvent(frame: EventFrame): void {
    // Exact event name listeners.
    const exact = this.eventListeners.get(frame.event);
    if (exact) {
      for (const cb of exact) {
        try {
          cb(frame.payload);
        } catch (err) {
          console.error(
            `[DaemonClient] Error in event listener for "${frame.event}":`,
            err
          );
        }
      }
    }

    // Wildcard catch-all listener.
    const wildcard = this.eventListeners.get('*');
    if (wildcard) {
      for (const cb of wildcard) {
        try {
          cb(frame);
        } catch (err) {
          console.error(
            '[DaemonClient] Error in wildcard event listener:',
            err
          );
        }
      }
    }
  }

  private handleClose(
    code: number,
    reason: string,
    scheduleReconnect: boolean
  ): void {
    this.stopHeartbeat();

    // Reject pending requests.
    const closeErr = new DaemonError({
      code: 'CONNECTION_CLOSED',
      message: `Connection closed (code=${code}, reason=${reason})`,
    });
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(closeErr);
      this.pending.delete(id);
    }

    if (this.state === 'closing' || this.state === 'disconnected') {
      this.setState('disconnected');
      return;
    }

    this.setState('disconnected');

    if (
      scheduleReconnect &&
      this.opts.maxReconnectAttempts > 0 &&
      this.reconnectAttempts < this.opts.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    this.setState('reconnecting');

    const delay = Math.min(
      this.opts.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.opts.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.openConnection();
      } catch {
        // openConnection's close handler will schedule the next attempt.
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internal – heartbeat
  // -------------------------------------------------------------------------

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === this.ws.OPEN) {
        this.sendMessage('health.ping', { clientTimestamp: Date.now() }).catch(
          () => {
            // Ping failure is non-fatal; the server will close the connection
            // if no frames are received within its heartbeat timeout window.
          }
        );
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Internal – helpers
  // -------------------------------------------------------------------------

  private assertConnected(): void {
    if (this.state !== 'connected') {
      throw new ConnectionError(
        `Cannot send message: client is "${this.state}". Call connect() first.`
      );
    }
  }

  private sendRaw(frame: ProtocolFrame): void {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      throw new ConnectionError('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(frame));
  }

  private parseFrame(data: string): ProtocolFrame | null {
    try {
      return JSON.parse(data) as ProtocolFrame;
    } catch {
      console.error('[DaemonClient] Failed to parse frame:', data);
      return null;
    }
  }

  private buildAuthConnectFrame(): ProtocolFrame {
    const params: AuthConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      auth: {
        type: 'api-key',
        token: this.apiKey,
      },
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: CLIENT_PLATFORM,
        displayName: this.opts.clientDisplayName,
      },
      capabilities: this.opts.capabilities,
      scopes: this.opts.scopes,
    };

    return {
      type: 'req',
      id: this.nextId(),
      method: 'auth.connect',
      params,
    };
  }

  private nextId(): string {
    return `sdk-${++this.requestCounter}-${Date.now()}`;
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const cb of this.stateListeners) {
      try {
        cb(next);
      } catch (err) {
        console.error('[DaemonClient] Error in state change listener:', err);
      }
    }
  }

  private notifyMessageListeners(frame: ProtocolFrame): void {
    for (const cb of this.messageListeners) {
      try {
        cb(frame);
      } catch (err) {
        console.error('[DaemonClient] Error in message listener:', err);
      }
    }
  }
}
