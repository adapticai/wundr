/**
 * WebSocket Server for Orchestrator Daemon communication
 */

import * as http from 'http';

import { EventEmitter } from 'eventemitter3';
import { Server as WebSocketServer, WebSocket } from 'ws';

import { AuthMiddleware } from '../auth/middleware';
import { Logger } from '../utils/logger';

import type { AuthenticatedWebSocket } from '../auth/middleware';
import type { AuthConfig, ClientIdentity } from '../auth/types';
import type {
  WSMessage,
  WSResponse,
  StreamChunk,
  ToolCallInfo,
} from '../types';

export class OrchestratorWebSocketServer extends EventEmitter {
  private logger: Logger;
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private clients: Set<WebSocket>;
  private sessionClients: Map<string, Set<WebSocket>>; // Track which clients are subscribed to which sessions
  private port: number;
  private host: string;
  private authMiddleware: AuthMiddleware | null = null;
  private authConfig: AuthConfig | null = null;

  constructor(port: number, host: string, authConfig?: AuthConfig) {
    super();
    this.logger = new Logger('WebSocketServer');
    this.clients = new Set();
    this.sessionClients = new Map();
    this.port = port;
    this.host = host;
    this.authConfig = authConfig ?? null;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
              })
            );
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        });

        // Create WebSocket server.
        // When auth is enabled, we use `noServer: true` so the auth
        // middleware controls the upgrade handshake.  When auth is
        // disabled, we bind directly to the HTTP server for backward
        // compatibility.
        if (this.authConfig) {
          this.wss = new WebSocketServer({ noServer: true });
          this.authMiddleware = new AuthMiddleware(this.authConfig);
          this.authMiddleware.install(
            this.httpServer,
            this.wss,
            (ws: AuthenticatedWebSocket) => {
              this.handleConnection(ws);
              const identity = ws.__identity;
              if (identity) {
                this.logger.info(
                  `Authenticated connection: client=${identity.clientId} method=${identity.method}`
                );
              }
            }
          );
          this.logger.info('WebSocket auth middleware enabled');
        } else {
          this.wss = new WebSocketServer({ server: this.httpServer });
          this.logger.warn('WebSocket server started WITHOUT authentication');
        }

        this.wss.on('connection', (ws: WebSocket) => {
          // When auth middleware is installed, handleConnection is
          // called from the middleware callback above.  The 'connection'
          // event from wss is still emitted by ws internally after
          // handleUpgrade, but we only call handleConnection once --
          // the middleware callback handles it.  Without auth, we
          // handle it here.
          if (!this.authMiddleware) {
            this.handleConnection(ws);
          }
        });

        this.wss.on('error', (error: Error) => {
          this.logger.error('WebSocket server error:', error);
          this.emit('error', error);
        });

        // Start listening
        this.httpServer.listen(this.port, this.host, () => {
          this.logger.info(
            `WebSocket server started on ${this.host}:${this.port}`
          );
          resolve();
        });

        this.httpServer.on('error', error => {
          this.logger.error('HTTP server error:', error);
          reject(error);
        });
      } catch (error) {
        this.logger.error('Failed to start WebSocket server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    return new Promise(resolve => {
      this.logger.info('Stopping WebSocket server...');

      // Tear down auth middleware
      if (this.authMiddleware) {
        this.authMiddleware.destroy();
        this.authMiddleware = null;
      }

      // Close all client connections
      this.clients.forEach(client => {
        client.close(1000, 'Server shutting down');
      });
      this.clients.clear();
      this.sessionClients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          this.logger.debug('WebSocket server closed');
        });
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.logger.info('WebSocket server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    this.logger.debug('New WebSocket connection');
    this.clients.add(ws);

    ws.on('message', (data: Buffer) => {
      try {
        // When auth middleware is active, validate per-message auth
        // and rate limits before dispatching.
        if (this.authMiddleware) {
          const validated = this.authMiddleware.validateMessage(
            ws as AuthenticatedWebSocket,
            data
          );
          if (!validated) {
            // Message was rejected; error already sent to client.
            return;
          }
          const message = validated.payload as WSMessage;
          this.handleMessage(ws, message);
        } else {
          const message = JSON.parse(data.toString()) as WSMessage;
          this.handleMessage(ws, message);
        }
      } catch (error) {
        this.logger.error('Failed to parse message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.logger.debug('WebSocket connection closed');
      this.clients.delete(ws);
      // Remove from all session subscriptions
      this.sessionClients.forEach(clients => {
        clients.delete(ws);
      });
    });

    ws.on('error', (error: Error) => {
      this.logger.error('WebSocket connection error:', error);
      this.clients.delete(ws);
      // Remove from all session subscriptions
      this.sessionClients.forEach(clients => {
        clients.delete(ws);
      });
    });

    // Send initial connection acknowledgment
    this.send(ws, { type: 'health_check_response', healthy: true });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: WebSocket, message: WSMessage): void {
    this.logger.debug('Received message:', message.type);

    switch (message.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      case 'spawn_session':
        this.emit('spawn_session', { ws, payload: message.payload });
        break;

      case 'execute_task':
        // Subscribe client to session updates
        this.subscribeToSession(ws, message.payload.sessionId);
        this.emit('execute_task', { ws, payload: message.payload });
        break;

      case 'session_status':
        this.emit('session_status', {
          ws,
          sessionId: message.payload.sessionId,
        });
        break;

      case 'daemon_status':
        this.emit('daemon_status', { ws });
        break;

      case 'stop_session':
        this.emit('stop_session', { ws, sessionId: message.payload.sessionId });
        this.unsubscribeFromSession(ws, message.payload.sessionId);
        break;

      case 'health_check':
        this.send(ws, { type: 'health_check_response', healthy: true });
        break;

      case 'list_sessions':
        this.emit('list_sessions', { ws });
        break;

      default:
        this.logger.warn('Unknown message type:', (message as WSMessage).type);
        this.sendError(ws, 'Unknown message type');
    }
  }

  /**
   * Send message to client
   */
  send(ws: WebSocket, message: WSResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  sendError(ws: WebSocket, error: string, sessionId?: string): void {
    this.send(ws, { type: 'error', error, sessionId });
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSResponse): void {
    const payload = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Subscribe a client to session updates
   */
  private subscribeToSession(ws: WebSocket, sessionId: string): void {
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(ws);
    this.logger.debug(`Client subscribed to session ${sessionId}`);
  }

  /**
   * Unsubscribe a client from session updates
   */
  private unsubscribeFromSession(ws: WebSocket, sessionId: string): void {
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        this.sessionClients.delete(sessionId);
      }
      this.logger.debug(`Client unsubscribed from session ${sessionId}`);
    }
  }

  /**
   * Send message to all clients subscribed to a session
   */
  private broadcastToSession(sessionId: string, message: WSResponse): void {
    const clients = this.sessionClients.get(sessionId);
    if (!clients || clients.size === 0) {
      this.logger.warn(`No clients subscribed to session ${sessionId}`);
      return;
    }

    const payload = JSON.stringify(message);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Stream a chunk of data to clients subscribed to a session
   */
  streamToClient(
    sessionId: string,
    chunk: string,
    metadata?: StreamChunk['metadata']
  ): void {
    const streamChunk: StreamChunk = {
      sessionId,
      chunk,
      metadata,
    };

    this.broadcastToSession(sessionId, {
      type: 'stream_chunk',
      data: streamChunk,
    });
  }

  /**
   * Notify clients that streaming is starting
   */
  notifyStreamStart(
    sessionId: string,
    metadata?: Record<string, unknown>
  ): void {
    this.broadcastToSession(sessionId, {
      type: 'stream_start',
      sessionId,
      metadata,
    });
  }

  /**
   * Notify clients that streaming has ended
   */
  notifyStreamEnd(sessionId: string, metadata?: Record<string, unknown>): void {
    this.broadcastToSession(sessionId, {
      type: 'stream_end',
      sessionId,
      metadata,
    });
  }

  /**
   * Notify clients about tool execution status
   */
  notifyToolExecution(
    sessionId: string,
    toolName: string,
    status: 'started' | 'completed' | 'failed',
    options?: {
      toolInput?: Record<string, unknown>;
      result?: unknown;
      error?: string;
    }
  ): void {
    const toolCallInfo: ToolCallInfo = {
      sessionId,
      toolName,
      toolInput: options?.toolInput,
      status,
      result: options?.result,
      error: options?.error,
      timestamp: new Date(),
    };

    const messageType =
      status === 'started' ? 'tool_call_start' : 'tool_call_result';
    this.broadcastToSession(sessionId, {
      type: messageType,
      data: toolCallInfo,
    });
  }

  /**
   * Notify clients that a task is executing
   */
  notifyTaskExecuting(sessionId: string, taskId: string): void {
    this.broadcastToSession(sessionId, {
      type: 'task_executing',
      sessionId,
      taskId,
    });
  }

  /**
   * Notify clients that a task has completed
   */
  notifyTaskCompleted(
    sessionId: string,
    taskId: string,
    result?: unknown
  ): void {
    this.broadcastToSession(sessionId, {
      type: 'task_completed',
      sessionId,
      taskId,
      result,
    });
  }

  /**
   * Notify clients that a task has failed
   */
  notifyTaskFailed(sessionId: string, taskId: string, error: string): void {
    this.broadcastToSession(sessionId, {
      type: 'task_failed',
      sessionId,
      taskId,
      error,
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get number of clients subscribed to a session
   */
  getSessionClientCount(sessionId: string): number {
    return this.sessionClients.get(sessionId)?.size ?? 0;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.sessionClients.keys());
  }

  /**
   * Get the authenticated identity for a WebSocket connection.
   * Returns undefined if auth is not enabled or the socket has no identity.
   */
  getClientIdentity(ws: WebSocket): ClientIdentity | undefined {
    if (!this.authMiddleware) {
      return undefined;
    }
    return this.authMiddleware.getIdentity(ws as AuthenticatedWebSocket);
  }

  /**
   * Check whether authentication is enabled on this server.
   */
  isAuthEnabled(): boolean {
    return this.authMiddleware !== null;
  }

  /**
   * Get all WebSocket clients subscribed to a session.
   * Used by the streaming relay for per-socket backpressure checks.
   */
  getSessionClients(sessionId: string): Set<WebSocket> | undefined {
    return this.sessionClients.get(sessionId);
  }

  /**
   * Subscribe a client to a session from external code (e.g. streaming relay).
   * This is the public counterpart of the private subscribeToSession method.
   */
  subscribeClientToSession(ws: WebSocket, sessionId: string): void {
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(ws);
  }
}
