/**
 * Real-time Connection Initialization
 * Handles WebSocket connections, subscriptions, and real-time data sync
 */

export type RealtimeConfig = {
  url: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
};

export type RealtimeEvent =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting'
  | 'message'
  | 'subscribed'
  | 'unsubscribed';

export type RealtimeMessage = {
  event: string;
  channel?: string;
  payload: unknown;
  timestamp: number;
};

export type ChannelSubscription = {
  channel: string;
  callback: (data: unknown) => void;
};

export type RealtimeEventHandler = (data?: unknown) => void;

class RealtimeConnection {
  private ws: WebSocket | null = null;
  private config: Required<RealtimeConfig>;
  private subscriptions: Map<string, Set<(data: unknown) => void>> = new Map();
  private eventListeners: Map<RealtimeEvent, Set<RealtimeEventHandler>> =
    new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isIntentionalDisconnect = false;

  constructor(config: RealtimeConfig) {
    this.config = {
      autoConnect: true,
      reconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };

    console.log('[Realtime] Initialized with config:', this.config);

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[Realtime] Already connected');
      return;
    }

    console.log('[Realtime] Connecting to:', this.config.url);
    this.isIntentionalDisconnect = false;

    try {
      // TODO: Implement WebSocket connection
      // this.ws = new WebSocket(this.config.url);
      // this.ws.onopen = () => this.handleOpen();
      // this.ws.onmessage = (event) => this.handleMessage(event);
      // this.ws.onerror = (error) => this.handleError(error);
      // this.ws.onclose = () => this.handleClose();
    } catch (error) {
      console.error('[Realtime] Connection error:', error);
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[Realtime] Disconnecting');
    this.isIntentionalDisconnect = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string, callback: (data: unknown) => void): () => void {
    console.log('[Realtime] Subscribing to channel:', channel);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.sendSubscribe(channel);
    }

    this.subscriptions.get(channel)?.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(channel, callback);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string, callback?: (data: unknown) => void): void {
    console.log('[Realtime] Unsubscribing from channel:', channel);

    if (callback) {
      this.subscriptions.get(channel)?.delete(callback);

      // If no more callbacks, unsubscribe from server
      if (this.subscriptions.get(channel)?.size === 0) {
        this.subscriptions.delete(channel);
        this.sendUnsubscribe(channel);
      }
    } else {
      // Unsubscribe all callbacks for this channel
      this.subscriptions.delete(channel);
      this.sendUnsubscribe(channel);
    }
  }

  /**
   * Send a message to the server
   */
  send(message: Partial<RealtimeMessage>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[Realtime] Cannot send message, not connected');
      return;
    }

    const fullMessage: RealtimeMessage = {
      event: message.event || 'message',
      channel: message.channel,
      payload: message.payload,
      timestamp: Date.now(),
    };

    console.log('[Realtime] Sending message:', fullMessage);
    // TODO: Send message
    // this.ws.send(JSON.stringify(fullMessage));
  }

  /**
   * Listen to realtime events
   */
  on(event: RealtimeEvent, handler: RealtimeEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(handler);

    // Return remove listener function
    return () => this.off(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: RealtimeEvent, handler: RealtimeEventHandler): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  /**
   * Emit event to listeners
   */
  private emit(event: RealtimeEvent, data?: unknown): void {
    this.eventListeners.get(event)?.forEach(handler => handler(data));
  }

  /**
   * Handle WebSocket open
   */
  private handleOpen(): void {
    console.log('[Realtime] Connected');
    this.reconnectAttempts = 0;
    this.emit('connected');
    this.startHeartbeat();
    this.resubscribeChannels();
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: RealtimeMessage = JSON.parse(event.data);
      console.log('[Realtime] Received message:', message);

      this.emit('message', message);

      // Dispatch to channel subscribers
      if (message.channel) {
        const callbacks = this.subscriptions.get(message.channel);
        callbacks?.forEach(callback => callback(message.payload));
      }
    } catch (error) {
      console.error('[Realtime] Failed to parse message:', error);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(error: Event): void {
    console.error('[Realtime] WebSocket error:', error);
    this.emit('error', error);
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(): void {
    console.log('[Realtime] Disconnected');
    this.clearTimers();
    this.emit('disconnected');

    if (!this.isIntentionalDisconnect && this.config.reconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[Realtime] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ event: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribeChannels(): void {
    console.log('[Realtime] Resubscribing to channels');
    this.subscriptions.forEach((_, channel) => {
      this.sendSubscribe(channel);
    });
  }

  /**
   * Send subscribe message
   */
  private sendSubscribe(channel: string): void {
    this.send({
      event: 'subscribe',
      channel,
    });
    this.emit('subscribed', { channel });
  }

  /**
   * Send unsubscribe message
   */
  private sendUnsubscribe(channel: string): void {
    this.send({
      event: 'unsubscribe',
      channel,
    });
    this.emit('unsubscribed', { channel });
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Singleton instance
let realtimeConnection: RealtimeConnection | null = null;

/**
 * Initialize realtime connection
 */
export function initRealtime(config: RealtimeConfig): RealtimeConnection {
  if (realtimeConnection) {
    console.warn('[Realtime] Connection already initialized');
    return realtimeConnection;
  }

  realtimeConnection = new RealtimeConnection(config);
  return realtimeConnection;
}

/**
 * Get realtime connection instance
 */
export function getRealtime(): RealtimeConnection {
  if (!realtimeConnection) {
    throw new Error(
      'Realtime connection not initialized. Call initRealtime() first.',
    );
  }
  return realtimeConnection;
}

/**
 * Disconnect and cleanup realtime connection
 */
export function disconnectRealtime(): void {
  if (realtimeConnection) {
    realtimeConnection.disconnect();
    realtimeConnection = null;
  }
}

// Re-export the class
export { RealtimeConnection };

/**
 * Get WebSocket server instance (stub for server-side usage)
 * This is a no-op on the client side
 */
export function getWebSocketServer(): null {
  console.warn('[Realtime] getWebSocketServer is a server-only function');
  return null;
}
