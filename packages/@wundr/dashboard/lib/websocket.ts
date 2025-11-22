import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * WebSocket message payload structure
 */
export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
  /** @deprecated Use payload instead - kept for backwards compatibility */
  data?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Callback type for WebSocket message handlers
 */
export type WebSocketCallback = (message: WebSocketMessage) => void;

/**
 * Metrics data structure for real-time updates
 */
export interface RealtimeMetrics {
  cpu?: number;
  memory?: number;
  requests?: number;
  errors?: number;
  latency?: number;
  [key: string]: number | undefined;
}

/**
 * Realtime store state structure
 */
export interface RealtimeState {
  metrics: RealtimeMetrics;
  isConnected: boolean;
}

/**
 * WebSocket hook return type with proper typing
 */
export interface WebSocketHook {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  send: (data: WebSocketMessage) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Configuration options for WebSocket connection
 */
interface WebSocketConfig {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
};

/**
 * React hook for WebSocket connection management
 * Provides automatic reconnection and message handling
 */
export function useWebSocket(
  url?: string,
  config: WebSocketConfig = DEFAULT_CONFIG
): WebSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) {
      console.warn('[WebSocket] No URL provided, skipping connection');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.warn('[WebSocket] Already connected');
      return;
    }

    try {
      socketRef.current = new WebSocket(url);

      socketRef.current.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.info('[WebSocket] Connected to', url);
      };

      socketRef.current.onclose = (event) => {
        setIsConnected(false);
        console.info('[WebSocket] Disconnected:', event.reason || 'Connection closed');

        // Attempt reconnection if not a clean close
        if (
          !event.wasClean &&
          reconnectAttemptsRef.current < (config.maxReconnectAttempts ?? 5)
        ) {
          reconnectAttemptsRef.current += 1;
          console.info(
            `[WebSocket] Reconnecting (attempt ${reconnectAttemptsRef.current}/${config.maxReconnectAttempts})...`
          );
          reconnectTimeoutRef.current = setTimeout(
            connect,
            config.reconnectInterval
          );
        }
      };

      socketRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      socketRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
        } catch (parseError) {
          console.error('[WebSocket] Failed to parse message:', parseError);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [url, config.maxReconnectAttempts, config.reconnectInterval]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttemptsRef.current = config.maxReconnectAttempts ?? 5; // Prevent reconnection

    if (socketRef.current) {
      socketRef.current.close(1000, 'Client disconnected');
      socketRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimeout, config.maxReconnectAttempts]);

  const send = useCallback((data: WebSocketMessage) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message: not connected');
      return;
    }

    try {
      const messageWithTimestamp: WebSocketMessage = {
        ...data,
        timestamp: data.timestamp ?? Date.now(),
      };
      socketRef.current.send(JSON.stringify(messageWithTimestamp));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [clearReconnectTimeout]);

  // Reconnect when URL changes
  useEffect(() => {
    if (url) {
      disconnect();
      reconnectAttemptsRef.current = 0;
      connect();
    }
    return () => {
      disconnect();
    };
  }, [url, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    connect,
    disconnect,
  };
}

/**
 * Subscription tracking for realtime store
 */
type UnsubscribeFn = () => void;

/**
 * Internal state management for realtime store
 */
interface RealtimeStoreInternal {
  state: RealtimeState;
  subscribers: Set<WebSocketCallback>;
  messageSubscribers: Set<WebSocketCallback>;
}

const storeInternal: RealtimeStoreInternal = {
  state: {
    metrics: {},
    isConnected: false,
  },
  subscribers: new Set(),
  messageSubscribers: new Set(),
};

/**
 * Notify all subscribers with the current state as a message
 */
function notifySubscribers(message: WebSocketMessage): void {
  storeInternal.subscribers.forEach((callback) => {
    try {
      callback(message);
    } catch (error) {
      console.error('[RealtimeStore] Subscriber error:', error);
    }
  });
}

/**
 * Notify message subscribers with incoming messages
 */
function notifyMessageSubscribers(message: WebSocketMessage): void {
  storeInternal.messageSubscribers.forEach((callback) => {
    try {
      callback(message);
    } catch (error) {
      console.error('[RealtimeStore] Message subscriber error:', error);
    }
  });
}

/**
 * Realtime store for managing WebSocket state and subscriptions
 * Provides a pub/sub interface for real-time updates
 */
export const realtimeStore = {
  /**
   * Subscribe to all state changes
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribe(callback: WebSocketCallback): UnsubscribeFn {
    storeInternal.subscribers.add(callback);

    // Immediately notify with current state
    callback({
      type: 'state_sync',
      payload: storeInternal.state as unknown as Record<string, unknown>,
      timestamp: Date.now(),
    });

    return () => {
      storeInternal.subscribers.delete(callback);
    };
  },

  /**
   * Subscribe to incoming messages only
   * @param callback - Function to call when a message is received
   * @returns Unsubscribe function
   */
  subscribeToMessages(callback: WebSocketCallback): UnsubscribeFn {
    storeInternal.messageSubscribers.add(callback);

    return () => {
      storeInternal.messageSubscribers.delete(callback);
    };
  },

  /**
   * Get the current state snapshot
   * @returns Current realtime state
   */
  getState(): RealtimeState {
    return { ...storeInternal.state };
  },

  /**
   * Update metrics in the store
   * @param metrics - Partial metrics to merge with current state
   */
  updateMetrics(metrics: Partial<RealtimeMetrics>): void {
    storeInternal.state.metrics = {
      ...storeInternal.state.metrics,
      ...metrics,
    };

    const message: WebSocketMessage = {
      type: 'metrics_update',
      payload: { metrics: storeInternal.state.metrics },
      timestamp: Date.now(),
    };

    notifySubscribers(message);
  },

  /**
   * Update connection status
   * @param isConnected - New connection status
   */
  setConnected(isConnected: boolean): void {
    storeInternal.state.isConnected = isConnected;

    const message: WebSocketMessage = {
      type: 'connection_status',
      payload: { isConnected },
      timestamp: Date.now(),
    };

    notifySubscribers(message);
  },

  /**
   * Dispatch a message to all message subscribers
   * @param message - Message to dispatch
   */
  dispatch(message: WebSocketMessage): void {
    notifyMessageSubscribers(message);
  },

  /**
   * Clear all subscribers (useful for testing)
   */
  clearSubscribers(): void {
    storeInternal.subscribers.clear();
    storeInternal.messageSubscribers.clear();
  },

  /**
   * Reset store to initial state (useful for testing)
   */
  reset(): void {
    storeInternal.state = {
      metrics: {},
      isConnected: false,
    };
    this.clearSubscribers();
  },
};
