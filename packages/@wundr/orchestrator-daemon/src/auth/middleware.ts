/**
 * WebSocket authentication middleware.
 *
 * This module integrates the Authenticator and RateLimiter with the
 * existing `OrchestratorWebSocketServer`.  It hooks into the HTTP
 * upgrade path and into per-message processing so that:
 *
 *  1. Unauthenticated upgrade requests are rejected with 401.
 *  2. Clients that exceed the rate limit receive 429 errors.
 *  3. Per-message auth tokens are validated when present.
 *  4. Every accepted WebSocket carries a `ClientIdentity` that
 *     downstream handlers can inspect.
 *
 * The middleware is designed to be non-invasive -- the existing
 * `OrchestratorWebSocketServer` class does not need internal changes.
 * Instead, the middleware wraps the HTTP server's `upgrade` event and
 * decorates WebSocket instances with identity metadata.
 */

import { Authenticator } from './authenticator';
import { RateLimiter } from './rate-limiter';
import { AuthConfigSchema, AuthenticatedMessageSchema } from './types';
import { Logger } from '../utils/logger';

import type { AuthConfig, ClientIdentity } from './types';
import type http from 'node:http';
import type { Server as WebSocketServer, WebSocket } from 'ws';

// ---------------------------------------------------------------------------
// Augmented WebSocket type
// ---------------------------------------------------------------------------

/**
 * We attach identity metadata to each authenticated WebSocket so that
 * message handlers can attribute actions to a specific client.
 */
export interface AuthenticatedWebSocket extends WebSocket {
  __identity?: ClientIdentity;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export class AuthMiddleware {
  private readonly authenticator: Authenticator;
  private readonly rateLimiter: RateLimiter;
  private readonly config: AuthConfig;
  private readonly logger: Logger;

  constructor(config: AuthConfig) {
    // Validate config at construction time.
    this.config = AuthConfigSchema.parse(config);
    this.logger = new Logger('AuthMiddleware');

    this.authenticator = new Authenticator(this.config);
    this.rateLimiter = new RateLimiter({
      maxMessages: this.config.rateLimitMaxMessages,
      windowMs: this.config.rateLimitWindowMs,
      maxConnectionsPerClient: this.config.maxConnectionsPerClient,
    });
  }

  // -------------------------------------------------------------------------
  // HTTP upgrade hook
  // -------------------------------------------------------------------------

  /**
   * Install the auth middleware on an existing HTTP server + WS server.
   *
   * This replaces the default `upgrade` handling so that authentication
   * happens BEFORE the WebSocket handshake completes.
   *
   * @param httpServer - The HTTP server that receives upgrade requests.
   * @param wss        - The `ws` WebSocket server to hand off to.
   * @param onAuthenticated - Callback invoked with the authenticated
   *                          WebSocket after a successful handshake.
   */
  install(
    httpServer: http.Server,
    wss: WebSocketServer,
    onAuthenticated: (
      ws: AuthenticatedWebSocket,
      req: http.IncomingMessage
    ) => void
  ): void {
    // Remove the default upgrade listener that `ws` installs so we can
    // intercept it.
    httpServer.removeAllListeners('upgrade');

    httpServer.on('upgrade', (req: http.IncomingMessage, socket, head) => {
      // --- Authenticate ---
      const authResult = this.authenticator.authenticateConnection(req);

      if (!authResult.ok || !authResult.identity) {
        this.logger.warn(
          `Rejected upgrade: ${authResult.reason} from ${req.socket?.remoteAddress}`
        );
        socket.write(
          'HTTP/1.1 401 Unauthorized\r\n' +
            'Content-Type: application/json\r\n' +
            'Connection: close\r\n' +
            '\r\n' +
            JSON.stringify({ error: authResult.reason ?? 'unauthorized' })
        );
        socket.destroy();
        return;
      }

      const identity = authResult.identity;

      // --- Check connection concurrency ---
      if (!this.rateLimiter.addConnection(identity.clientId)) {
        this.logger.warn(
          `Connection limit reached for client: ${identity.clientId}`
        );
        socket.write(
          'HTTP/1.1 429 Too Many Requests\r\n' +
            'Content-Type: application/json\r\n' +
            'Connection: close\r\n' +
            '\r\n' +
            JSON.stringify({ error: 'connection_limit_exceeded' })
        );
        socket.destroy();
        return;
      }

      // --- Complete the handshake ---
      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const authWs = ws as AuthenticatedWebSocket;
        authWs.__identity = identity;

        // Release the connection slot when the socket closes.
        ws.on('close', () => {
          this.rateLimiter.removeConnection(identity.clientId);
        });

        wss.emit('connection', ws, req);
        onAuthenticated(authWs, req);
      });
    });

    this.logger.info('Auth middleware installed on upgrade path');
  }

  // -------------------------------------------------------------------------
  // Per-message auth gate
  // -------------------------------------------------------------------------

  /**
   * Validate an individual message and enforce rate limits.
   *
   * @param ws      - The WebSocket (must have __identity attached).
   * @param rawData - The raw message buffer.
   * @returns The parsed message payload if allowed, or `null` if the
   *          message was rejected (an error is sent to the client).
   */
  validateMessage(
    ws: AuthenticatedWebSocket,
    rawData: Buffer
  ): { payload: unknown; identity: ClientIdentity } | null {
    const identity = ws.__identity;
    if (!identity) {
      this.sendError(ws, 'not_authenticated');
      return null;
    }

    // --- Rate limit ---
    if (!this.rateLimiter.checkMessageRate(identity.clientId)) {
      this.sendError(ws, 'rate_limit_exceeded');
      return null;
    }

    // --- Parse ---
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData.toString());
    } catch {
      this.sendError(ws, 'invalid_json');
      return null;
    }

    // --- Per-message auth (optional) ---
    const authEnvelope = AuthenticatedMessageSchema.safeParse(parsed);
    if (authEnvelope.success && authEnvelope.data.auth) {
      const msgAuth = authEnvelope.data.auth;
      if (msgAuth.token || msgAuth.apiKey) {
        const result = this.authenticator.authenticateMessage(msgAuth);
        if (!result.ok) {
          this.sendError(ws, result.reason ?? 'message_auth_failed');
          return null;
        }
        // If the per-message identity differs, we could update it.
        // For now, we keep the connection-level identity and just
        // confirm the message token is valid.
      }
    }

    // --- Check JWT expiry for long-lived connections ---
    if (identity.expiresAt && identity.expiresAt.getTime() < Date.now()) {
      this.sendError(ws, 'token_expired');
      (ws as WebSocket).close(4001, 'Token expired');
      return null;
    }

    return { payload: parsed, identity };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Get the identity attached to a WebSocket.
   */
  getIdentity(ws: AuthenticatedWebSocket): ClientIdentity | undefined {
    return ws.__identity;
  }

  /**
   * Get remaining rate-limit allowance for a client.
   */
  getRemainingMessages(clientId: string): number {
    return this.rateLimiter.getRemainingMessages(clientId);
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.rateLimiter.destroy();
  }

  private sendError(ws: WebSocket, reason: string): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', error: reason }));
    }
  }
}
