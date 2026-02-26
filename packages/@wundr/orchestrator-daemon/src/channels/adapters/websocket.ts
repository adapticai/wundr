/**
 * WebSocket Channel Adapter
 *
 * Internal channel adapter for daemon-to-client communication over WebSocket.
 * This powers the Neolith web UI, admin panels, and any programmatic client
 * that connects to the Orchestrator daemon directly.
 *
 * Unlike external channel adapters (Slack, Discord, Telegram), this adapter
 * owns the transport layer and defines its own wire protocol.
 *
 * Wire Protocol Messages (JSON):
 *
 * Client -> Server:
 *   { type: "message", id: string, conversationId: string, text: string, ... }
 *   { type: "typing", conversationId: string }
 *   { type: "ping" }
 *   { type: "auth", token: string }
 *
 * Server -> Client:
 *   { type: "message", id: string, conversationId: string, text: string, ... }
 *   { type: "typing", conversationId: string }
 *   { type: "ack", messageId: string }
 *   { type: "error", code: string, message: string }
 *   { type: "pong" }
 *   { type: "auth_result", ok: boolean, userId?: string }
 *
 * @packageDocumentation
 */

import { BaseChannelAdapter } from '../types.js';

import type {
  ChannelCapabilities,
  ChannelConfig,
  ChannelHealthStatus,
  ChannelLogger,
  ChannelMeta,
  ChatType,
  DeliveryResult,
  NormalizedMessage,
  OutboundMessage,
  PairingConfig,
  SenderValidation,
  TypingHandle,
} from '../types.js';

// ---------------------------------------------------------------------------
// WebSocket-Specific Configuration
// ---------------------------------------------------------------------------

export interface WebSocketChannelConfig extends ChannelConfig {
  /** Port to listen on (only used if the adapter creates its own server). */
  readonly port?: number;
  /** Host to bind to. */
  readonly host?: string;
  /**
   * External WebSocket server instance.
   * If provided, the adapter attaches to this server instead of creating its own.
   */
  readonly server?: WebSocketServerLike;
  /** Authentication function. Returns a user ID if the token is valid. */
  readonly authenticate?: (token: string) => Promise<string | null>;
  /** Maximum message size in bytes. */
  readonly maxPayloadBytes?: number;
  /** Heartbeat interval in milliseconds (0 to disable). */
  readonly heartbeatIntervalMs?: number;
}

// ---------------------------------------------------------------------------
// Wire Protocol Types
// ---------------------------------------------------------------------------

/** Messages sent from client to server. */
export type ClientMessage =
  | {
      type: 'message';
      id: string;
      conversationId: string;
      text: string;
      threadId?: string;
      replyTo?: string;
    }
  | { type: 'typing'; conversationId: string }
  | { type: 'ping' }
  | { type: 'auth'; token: string };

/** Messages sent from server to client. */
export type ServerMessage =
  | {
      type: 'message';
      id: string;
      conversationId: string;
      text: string;
      sender: string;
      timestamp: string;
      threadId?: string;
    }
  | { type: 'typing'; conversationId: string; sender: string }
  | { type: 'ack'; messageId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' }
  | { type: 'auth_result'; ok: boolean; userId?: string; error?: string };

// ---------------------------------------------------------------------------
// Connected Client
// ---------------------------------------------------------------------------

interface ConnectedClient {
  readonly ws: WebSocketLike;
  userId: string | null;
  authenticated: boolean;
  lastPingAt: Date;
  conversationIds: Set<string>;
}

// ---------------------------------------------------------------------------
// WebSocketChannelAdapter
// ---------------------------------------------------------------------------

export class WebSocketChannelAdapter extends BaseChannelAdapter {
  readonly id = 'websocket' as const;

  readonly meta: ChannelMeta = {
    id: 'websocket',
    label: 'WebSocket',
    blurb: 'Internal WebSocket channel for daemon-to-client communication.',
    aliases: ['ws', 'internal'],
    order: 100,
  };

  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'channel', 'thread'],
    reactions: false,
    threads: true,
    media: false, // Media is handled via HTTP upload, not WS
    edit: true,
    delete: true,
    typingIndicators: true,
    readReceipts: true,
    maxMessageLength: 0, // Unlimited
    maxMediaBytes: -1, // Not supported over WS; use HTTP
  };

  private server: WebSocketServerLike | null = null;
  private ownsServer = false;
  private clients = new Map<string, ConnectedClient>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private wsConfig: WebSocketChannelConfig | null = null;
  private messageCounter = 0;
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;

  constructor(logger?: ChannelLogger) {
    super(logger);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async connect(config: ChannelConfig): Promise<void> {
    if (this.connected) {
      this.logger.debug('WebSocket adapter already connected, skipping.');
      return;
    }

    const wsConfig = config as WebSocketChannelConfig;
    this.wsConfig = wsConfig;

    try {
      if (wsConfig.server) {
        // Attach to external server.
        this.server = wsConfig.server;
        this.ownsServer = false;
      } else {
        // Create our own server.
        const { WebSocketServer } = await import('ws');
        this.server = new WebSocketServer({
          port: wsConfig.port ?? 8765,
          host: wsConfig.host ?? '0.0.0.0',
          maxPayload: wsConfig.maxPayloadBytes ?? 1_048_576, // 1 MB default
        }) as unknown as WebSocketServerLike;
        this.ownsServer = true;
      }

      this.setupServerHandlers();
      this.startHeartbeat(wsConfig.heartbeatIntervalMs ?? 30_000);

      this.connected = true;
      this.config = config;

      this.logger.info(
        `WebSocket adapter connected${this.ownsServer ? ` on port ${wsConfig.port ?? 8765}` : ' (external server)'}.`
      );

      this.emit('connected', { channelId: this.id });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.logger.error(`WebSocket adapter connect failed: ${this.lastError}`);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.stopHeartbeat();

    // Close all client connections.
    for (const [, client] of this.clients) {
      try {
        this.sendToClient(client, {
          type: 'error',
          code: 'server_shutdown',
          message: 'Server is shutting down.',
        });
        client.ws.close(1001, 'Server shutdown');
      } catch {
        // Ignore close errors.
      }
    }
    this.clients.clear();

    // Close server if we own it.
    if (this.ownsServer && this.server) {
      try {
        this.server.close();
      } catch (err) {
        this.logger.error(
          `Error closing WebSocket server: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    this.server = null;
    this.connected = false;

    this.emit('disconnected', { channelId: this.id });
    this.logger.info('WebSocket adapter disconnected.');
  }

  async healthCheck(): Promise<ChannelHealthStatus> {
    return {
      channelId: this.id,
      healthy: this.connected,
      connected: this.connected,
      lastMessageAt: this.lastMessageAt ?? undefined,
      lastError: this.lastError ?? undefined,
      details: {
        connectedClients: this.clients.size,
        authenticatedClients: [...this.clients.values()].filter(
          c => c.authenticated
        ).length,
        totalMessages: this.messageCounter,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Messaging
  // -----------------------------------------------------------------------

  async sendMessage(message: OutboundMessage): Promise<DeliveryResult> {
    if (!this.connected) {
      return { ok: false, error: 'WebSocket adapter not connected.' };
    }

    this.messageCounter++;
    const messageId = `ws:${Date.now()}:${this.messageCounter}`;

    const serverMsg: ServerMessage = {
      type: 'message',
      id: messageId,
      conversationId: message.to,
      text: message.text,
      sender: 'orchestrator',
      timestamp: new Date().toISOString(),
      threadId: message.threadId,
    };

    let sentCount = 0;

    for (const [, client] of this.clients) {
      if (!client.authenticated) {
        continue;
      }

      // Send to clients subscribed to this conversation, or to all if
      // the client has no explicit subscriptions.
      if (
        client.conversationIds.size === 0 ||
        client.conversationIds.has(message.to)
      ) {
        this.sendToClient(client, serverMsg);
        sentCount++;
      }
    }

    return {
      ok: sentCount > 0,
      messageId,
      conversationId: message.to,
      timestamp: new Date(),
      error:
        sentCount === 0 ? 'No connected clients for conversation.' : undefined,
    };
  }

  async editMessage(
    conversationId: string,
    messageId: string,
    newText: string
  ): Promise<DeliveryResult> {
    // Broadcast an edit event to all relevant clients.
    const serverMsg: ServerMessage = {
      type: 'message',
      id: messageId,
      conversationId,
      text: newText,
      sender: 'orchestrator',
      timestamp: new Date().toISOString(),
    };

    this.broadcastToConversation(conversationId, serverMsg);
    return { ok: true, messageId, conversationId };
  }

  async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<boolean> {
    // Broadcast a delete event to all relevant clients.
    this.broadcastToConversation(conversationId, {
      type: 'error',
      code: 'message_deleted',
      message: `Message ${messageId} deleted.`,
    });
    return true;
  }

  // -----------------------------------------------------------------------
  // Threading
  // -----------------------------------------------------------------------

  async replyToThread(
    conversationId: string,
    threadId: string,
    message: OutboundMessage
  ): Promise<DeliveryResult> {
    return this.sendMessage({
      ...message,
      to: conversationId,
      threadId,
    });
  }

  // -----------------------------------------------------------------------
  // Typing Indicators
  // -----------------------------------------------------------------------

  sendTypingIndicator(conversationId: string): TypingHandle {
    if (!this.connected) {
      return { stop: () => {} };
    }

    let active = true;
    const sendTyping = () => {
      if (!active) {
        return;
      }
      this.broadcastToConversation(conversationId, {
        type: 'typing',
        conversationId,
        sender: 'orchestrator',
      } as ServerMessage);
    };

    sendTyping();
    const interval = setInterval(sendTyping, 3000);

    return {
      stop: () => {
        active = false;
        clearInterval(interval);
      },
    };
  }

  // -----------------------------------------------------------------------
  // Security / Pairing
  // -----------------------------------------------------------------------

  async validateSender(
    senderId: string,
    _chatType: ChatType
  ): Promise<SenderValidation> {
    // For WebSocket, authentication happens at connection time.
    const client = this.findClientByUserId(senderId);
    if (!client || !client.authenticated) {
      return {
        allowed: false,
        reason: 'Client not authenticated.',
      };
    }
    return { allowed: true };
  }

  getPairingConfig(): PairingConfig | null {
    return null; // WebSocket uses token-based auth, not pairing.
  }

  // -----------------------------------------------------------------------
  // Public API: Client Management
  // -----------------------------------------------------------------------

  /**
   * Get the number of currently connected clients.
   */
  getConnectedClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get the number of authenticated clients.
   */
  getAuthenticatedClientCount(): number {
    return [...this.clients.values()].filter(c => c.authenticated).length;
  }

  /**
   * Force-disconnect a client by their user ID.
   */
  disconnectClient(userId: string): boolean {
    const client = this.findClientByUserId(userId);
    if (!client) {
      return false;
    }
    client.ws.close(1000, 'Disconnected by server.');
    return true;
  }

  // -----------------------------------------------------------------------
  // Server Event Handlers
  // -----------------------------------------------------------------------

  private setupServerHandlers(): void {
    if (!this.server) {
      return;
    }

    this.server.on('connection', (ws: WebSocketLike) => {
      const clientId = `ws:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

      const client: ConnectedClient = {
        ws,
        userId: null,
        authenticated: !this.wsConfig?.authenticate, // Auto-auth if no auth fn
        lastPingAt: new Date(),
        conversationIds: new Set(),
      };

      this.clients.set(clientId, client);
      this.logger.debug(`WebSocket client connected: ${clientId}`);

      ws.on('message', (data: string | Buffer) => {
        this.handleClientMessage(clientId, client, data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.debug(`WebSocket client disconnected: ${clientId}`);

        if (client.userId) {
          this.emit('member_left', {
            channelId: this.id,
            conversationId: 'ws:lobby',
            userId: client.userId,
          });
        }
      });

      ws.on('error', (err: Error) => {
        this.lastError = err.message;
        this.logger.error(
          `WebSocket client error (${clientId}): ${err.message}`
        );
      });

      // If no auth is required, emit member_joined immediately.
      if (client.authenticated) {
        this.emit('member_joined', {
          channelId: this.id,
          conversationId: 'ws:lobby',
          userId: clientId,
        });
      }
    });

    this.server.on('error', (err: Error) => {
      this.lastError = err.message;
      this.emit('error', {
        channelId: this.id,
        error: err,
        recoverable: true,
      });
    });
  }

  private handleClientMessage(
    clientId: string,
    client: ConnectedClient,
    data: string | Buffer
  ): void {
    let msg: ClientMessage;
    try {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      this.sendToClient(client, {
        type: 'error',
        code: 'invalid_json',
        message: 'Could not parse message as JSON.',
      });
      return;
    }

    switch (msg.type) {
      case 'auth':
        this.handleAuth(clientId, client, msg.token);
        break;

      case 'ping':
        client.lastPingAt = new Date();
        this.sendToClient(client, { type: 'pong' });
        break;

      case 'typing':
        if (!client.authenticated) {
          return;
        }
        this.emit('typing', {
          channelId: this.id,
          conversationId: msg.conversationId,
          userId: client.userId ?? clientId,
        });
        break;

      case 'message':
        if (!client.authenticated) {
          this.sendToClient(client, {
            type: 'error',
            code: 'not_authenticated',
            message: 'Authenticate before sending messages.',
          });
          return;
        }
        this.handleInboundMessage(clientId, client, msg);
        break;

      default:
        this.sendToClient(client, {
          type: 'error',
          code: 'unknown_type',
          message: `Unknown message type: ${(msg as { type: string }).type}`,
        });
    }
  }

  private async handleAuth(
    clientId: string,
    client: ConnectedClient,
    token: string
  ): Promise<void> {
    const authenticate = this.wsConfig?.authenticate;

    if (!authenticate) {
      // No auth function configured; auto-accept.
      client.authenticated = true;
      client.userId = clientId;
      this.sendToClient(client, {
        type: 'auth_result',
        ok: true,
        userId: clientId,
      });
      return;
    }

    try {
      const userId = await authenticate(token);
      if (userId) {
        client.authenticated = true;
        client.userId = userId;
        this.sendToClient(client, {
          type: 'auth_result',
          ok: true,
          userId,
        });

        this.emit('member_joined', {
          channelId: this.id,
          conversationId: 'ws:lobby',
          userId,
        });
      } else {
        this.sendToClient(client, {
          type: 'auth_result',
          ok: false,
          error: 'Invalid token.',
        });
      }
    } catch {
      this.sendToClient(client, {
        type: 'auth_result',
        ok: false,
        error: 'Authentication error.',
      });
    }
  }

  private handleInboundMessage(
    clientId: string,
    client: ConnectedClient,
    msg: ClientMessage & { type: 'message' }
  ): void {
    this.messageCounter++;
    this.lastMessageAt = new Date();

    // Track conversation subscription.
    client.conversationIds.add(msg.conversationId);

    // Send ack.
    this.sendToClient(client, { type: 'ack', messageId: msg.id });

    // Normalize and emit.
    const normalized: NormalizedMessage = {
      id: `websocket:${msg.id}`,
      channelId: this.id,
      platformMessageId: msg.id,
      conversationId: msg.conversationId,
      threadId: msg.threadId,
      sender: {
        id: client.userId ?? clientId,
        displayName: client.userId ?? 'WebSocket Client',
        isSelf: false,
        isBot: false,
      },
      content: {
        text: msg.text,
        rawText: msg.text,
        attachments: [],
        mentions: [],
        mentionsSelf: false,
      },
      timestamp: new Date(),
      chatType: 'direct',
      replyTo: msg.replyTo,
      raw: msg,
    };

    this.emit('message', normalized);
  }

  // -----------------------------------------------------------------------
  // Internal Helpers
  // -----------------------------------------------------------------------

  private sendToClient(client: ConnectedClient, msg: ServerMessage): void {
    try {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        client.ws.send(JSON.stringify(msg));
      }
    } catch (err) {
      this.logger.error(
        `Failed to send to WebSocket client: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private broadcastToConversation(
    conversationId: string,
    msg: ServerMessage
  ): void {
    for (const [, client] of this.clients) {
      if (!client.authenticated) {
        continue;
      }
      if (
        client.conversationIds.size === 0 ||
        client.conversationIds.has(conversationId)
      ) {
        this.sendToClient(client, msg);
      }
    }
  }

  private findClientByUserId(userId: string): ConnectedClient | undefined {
    for (const [, client] of this.clients) {
      if (client.userId === userId) {
        return client;
      }
    }
    return undefined;
  }

  private startHeartbeat(intervalMs: number): void {
    if (intervalMs <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients) {
        const elapsed = now - client.lastPingAt.getTime();
        if (elapsed > intervalMs * 3) {
          // Client missed 3 heartbeats; disconnect.
          this.logger.warn(
            `WebSocket client ${clientId} timed out (${elapsed}ms since last ping).`
          );
          client.ws.close(1001, 'Heartbeat timeout');
          this.clients.delete(clientId);
        }
      }
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Type Stubs for Loose Coupling
// ---------------------------------------------------------------------------

interface WebSocketServerLike {
  on(event: string, handler: (...args: any[]) => void): void;
  close(): void;
}

interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, handler: (...args: any[]) => void): void;
}
