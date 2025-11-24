/**
 * Genesis Daemon SDK Client
 * Main client for communicating with the Genesis Daemon
 */

import { WebSocket } from 'ws';

import { AuthManager, AuthenticationError } from './auth.js';
import {
  ConnectionState,
  DaemonEventType,
  MessagePriority,
  MessageType,
} from './types.js';

import type {
  DaemonClientEvents,
  DaemonConfig,
  DaemonMessage,
  EventHandler,
  PresenceInfo,
  SendMessageOptions,
  TextMessage,
  CommandMessage,
  EventMessage,
  PresenceStatus,
} from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<DaemonConfig> = {
  timeout: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
};

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Daemon client for real-time communication
 */
export class DaemonClient {
  private config: Required<DaemonConfig>;
  private authManager: AuthManager;
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts: number = 0;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private pendingMessages: Map<
    string,
    {
      resolve: (value: DaemonMessage) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  > = new Map();
  private presence: PresenceInfo | null = null;

  constructor(config: DaemonConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<DaemonConfig>;
    this.authManager = new AuthManager(this.config);

    // Listen for token refresh to update WebSocket auth
    this.authManager.onRefresh(() => {
      this.sendAuthUpdate();
    });
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if connected and authenticated
   */
  isReady(): boolean {
    return this.state === ConnectionState.AUTHENTICATED;
  }

  /**
   * Connect to the daemon
   */
  async connect(): Promise<void> {
    if (this.state !== ConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect: current state is ${this.state}`);
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      // Authenticate first
      this.setState(ConnectionState.AUTHENTICATING);
      const authResponse = await this.authManager.authenticate();
      this.emit(DaemonEventType.AUTHENTICATED, authResponse);

      // Establish WebSocket connection
      await this.establishWebSocket(authResponse.accessToken);

      this.reconnectAttempts = 0;
      this.setState(ConnectionState.AUTHENTICATED);
      this.startHeartbeat();
      this.emit(DaemonEventType.CONNECTED, undefined);
    } catch (error) {
      this.setState(ConnectionState.ERROR);
      if (error instanceof AuthenticationError) {
        this.emit(DaemonEventType.AUTH_FAILED, { error: error.message });
      }
      throw error;
    }
  }

  /**
   * Disconnect from the daemon
   */
  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    this.authManager.clearTokens();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.emit(DaemonEventType.DISCONNECTED, {
      code: 1000,
      reason: 'Client disconnect',
    });
  }

  /**
   * Send a text message
   */
  async sendTextMessage(
    content: string,
    recipientIds: string[],
    options: SendMessageOptions = {}
  ): Promise<TextMessage> {
    const message: TextMessage = {
      id: generateMessageId(),
      type: MessageType.TEXT,
      timestamp: new Date().toISOString(),
      priority: options.priority ?? MessagePriority.NORMAL,
      content,
      senderId: this.config.clientId ?? 'unknown',
      recipientIds,
    };

    await this.sendMessage(message, options);
    return message;
  }

  /**
   * Send a command message
   */
  async sendCommand(
    command: string,
    target: string,
    args: Record<string, unknown> = {},
    options: SendMessageOptions = {}
  ): Promise<CommandMessage> {
    const message: CommandMessage = {
      id: generateMessageId(),
      type: MessageType.COMMAND,
      timestamp: new Date().toISOString(),
      priority: options.priority ?? MessagePriority.NORMAL,
      command,
      target,
      args,
    };

    await this.sendMessage(message, options);
    return message;
  }

  /**
   * Send an event message
   */
  async sendEvent(
    eventName: string,
    payload: Record<string, unknown> = {},
    options: SendMessageOptions = {}
  ): Promise<EventMessage> {
    const message: EventMessage = {
      id: generateMessageId(),
      type: MessageType.EVENT,
      timestamp: new Date().toISOString(),
      priority: options.priority ?? MessagePriority.NORMAL,
      eventName,
      payload,
      source: this.config.clientId ?? 'unknown',
    };

    await this.sendMessage(message, options);
    return message;
  }

  /**
   * Send a raw message
   */
  async sendMessage(
    message: DaemonMessage,
    options: SendMessageOptions = {}
  ): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Client is not connected and authenticated');
    }

    const data = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      if (options.waitForAck) {
        const timeout = setTimeout(() => {
          this.pendingMessages.delete(message.id);
          reject(
            new Error(
              `Message ${message.id} timed out waiting for acknowledgment`
            )
          );
        }, options.timeout ?? this.config.timeout);

        this.pendingMessages.set(message.id, {
          resolve: () => resolve(),
          reject,
          timeout,
        });
      }

      this.ws?.send(data, error => {
        if (error) {
          if (options.waitForAck) {
            const pending = this.pendingMessages.get(message.id);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingMessages.delete(message.id);
            }
          }
          reject(error);
        } else if (!options.waitForAck) {
          resolve();
        }
      });
    });
  }

  /**
   * Update presence status
   */
  async updatePresence(
    status: PresenceStatus,
    statusMessage?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    this.presence = {
      clientId: this.config.clientId ?? 'unknown',
      status,
      lastActivity: new Date().toISOString(),
      statusMessage,
      metadata,
    };

    await this.sendEvent('presence.update', {
      presence: this.presence,
    });
  }

  /**
   * Get current presence
   */
  getPresence(): PresenceInfo | null {
    return this.presence;
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof DaemonClientEvents>(
    event: K,
    handler: EventHandler<DaemonClientEvents[K]>
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off<K extends keyof DaemonClientEvents>(
    event: K,
    handler: EventHandler<DaemonClientEvents[K]>
  ): void {
    this.eventHandlers.get(event)?.delete(handler as EventHandler);
  }

  /**
   * Get the auth manager instance
   */
  getAuthManager(): AuthManager {
    return this.authManager;
  }

  /**
   * Dispose of the client
   */
  async dispose(): Promise<void> {
    await this.disconnect();
    this.eventHandlers.clear();
    this.pendingMessages.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingMessages.clear();
    this.authManager.dispose();
  }

  /**
   * Establish WebSocket connection
   */
  private async establishWebSocket(accessToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = new URL(this.config.wsUrl);
      wsUrl.searchParams.set('token', accessToken);

      this.ws = new WebSocket(wsUrl.toString());

      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, this.config.timeout);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        resolve();
      });

      this.ws.on('message', data => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        this.handleDisconnect(code, reason.toString());
      });

      this.ws.on('error', error => {
        clearTimeout(connectionTimeout);
        this.emit(DaemonEventType.ERROR, error);
        if (this.state === ConnectionState.CONNECTING) {
          reject(error);
        }
      });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: DaemonMessage = JSON.parse(data);

      // Handle acknowledgments
      if (message.type === MessageType.ACK && message.correlationId) {
        const pending = this.pendingMessages.get(message.correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(message);
          this.pendingMessages.delete(message.correlationId);
          return;
        }
      }

      // Handle heartbeat
      if (message.type === MessageType.HEARTBEAT) {
        this.emit(DaemonEventType.HEARTBEAT, { timestamp: message.timestamp });
        return;
      }

      // Emit message event
      this.emit(DaemonEventType.MESSAGE, message);
    } catch (error) {
      this.emit(DaemonEventType.ERROR, error as Error);
    }
  }

  /**
   * Handle WebSocket disconnect
   */
  private handleDisconnect(code: number, reason: string): void {
    this.ws = null;
    this.stopHeartbeat();

    if (this.state === ConnectionState.DISCONNECTED) {
      return; // Intentional disconnect
    }

    this.emit(DaemonEventType.DISCONNECTED, { code, reason });

    if (
      this.config.autoReconnect &&
      this.reconnectAttempts < this.config.maxReconnectAttempts
    ) {
      this.attemptReconnect();
    } else {
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.setState(ConnectionState.RECONNECTING);

    this.emit(DaemonEventType.RECONNECTING, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
    });

    // Exponential backoff
    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const token = this.authManager.getAccessToken();
      if (!token) {
        // Need to re-authenticate
        const authResponse = await this.authManager.authenticate();
        this.emit(DaemonEventType.AUTHENTICATED, authResponse);
        await this.establishWebSocket(authResponse.accessToken);
      } else {
        await this.establishWebSocket(token);
      }

      this.reconnectAttempts = 0;
      this.setState(ConnectionState.AUTHENTICATED);
      this.startHeartbeat();
      this.emit(DaemonEventType.CONNECTED, undefined);
    } catch {
      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.attemptReconnect();
      } else {
        this.setState(ConnectionState.DISCONNECTED);
      }
    }
  }

  /**
   * Send authentication update over WebSocket
   */
  private sendAuthUpdate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const token = this.authManager.getAccessToken();
    if (token) {
      this.ws.send(
        JSON.stringify({
          type: 'auth.update',
          token,
        })
      );
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            id: generateMessageId(),
            type: MessageType.HEARTBEAT,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState): void {
    this.state = state;
  }

  /**
   * Emit an event to listeners
   */
  private emit<K extends keyof DaemonClientEvents>(
    event: K,
    data: DaemonClientEvents[K]
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}
