'use client';

/**
 * useDaemonConnection - Low-level WebSocket connection hook for the orchestrator daemon.
 *
 * Manages a single browser WebSocket connection to the daemon, handling
 * connection lifecycle, exponential-backoff reconnection, message routing,
 * and event subscriptions. This hook is the foundation used by higher-level
 * daemon hooks and should be consumed through DaemonProvider in most cases.
 *
 * @module hooks/use-daemon-connection
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 8;
const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 30_000;
const PING_INTERVAL_MS = 25_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DaemonConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

/**
 * A raw message sent or received over the daemon WebSocket.
 * The wire format is JSON with a `type` discriminator.
 */
export interface DaemonRawMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * A subscriber callback registered for a specific message type.
 */
export type MessageSubscriber = (message: DaemonRawMessage) => void;

/**
 * Options accepted by useDaemonConnection.
 */
export interface UseDaemonConnectionOptions {
  /**
   * WebSocket URL for the daemon.
   * If not provided the hook remains idle (no connection attempt).
   */
  url?: string | null;
  /**
   * Maximum number of reconnection attempts before giving up.
   * Defaults to 8.
   */
  maxReconnectAttempts?: number;
  /**
   * Called when the connection is successfully established.
   */
  onConnect?: () => void;
  /**
   * Called when the connection closes (including after reconnection exhaustion).
   */
  onDisconnect?: () => void;
  /**
   * Called when a WebSocket-level error occurs.
   */
  onError?: (error: Error) => void;
}

/**
 * Return value of useDaemonConnection.
 */
export interface UseDaemonConnectionReturn {
  /** Current connection status. */
  status: DaemonConnectionStatus;
  /** True while the connection is open and ready to send. */
  isConnected: boolean;
  /** The last connection error, if any. */
  error: Error | null;
  /** Number of reconnection attempts since the last successful connection. */
  reconnectAttempts: number;
  /**
   * Send a message to the daemon.
   * Throws if the connection is not open.
   */
  sendMessage: (message: DaemonRawMessage) => void;
  /**
   * Subscribe to messages of a given type.
   * Returns an unsubscribe function.
   */
  subscribe: (type: string, handler: MessageSubscriber) => () => void;
  /**
   * Remove a specific handler for a given message type.
   */
  unsubscribe: (type: string, handler: MessageSubscriber) => void;
  /**
   * Manually trigger a reconnection attempt.
   * Resets the reconnect counter.
   */
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Low-level hook for managing a WebSocket connection to the orchestrator daemon.
 *
 * Features:
 * - Connects automatically when a URL is provided
 * - Reconnects with exponential backoff (capped at 30 s)
 * - Sends periodic pings to keep the connection alive
 * - Provides a pub/sub API for typed message routing
 * - Cleans up timers and the socket on unmount
 *
 * @example
 * ```tsx
 * const { isConnected, sendMessage, subscribe } = useDaemonConnection({
 *   url: 'ws://localhost:8765',
 *   onConnect: () => console.log('daemon connected'),
 * });
 *
 * useEffect(() => {
 *   return subscribe('health_check_response', (msg) => {
 *     console.log('health:', msg);
 *   });
 * }, [subscribe]);
 * ```
 */
export function useDaemonConnection(
  options: UseDaemonConnectionOptions = {}
): UseDaemonConnectionReturn {
  const {
    url,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [status, setStatus] = useState<DaemonConnectionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Stable refs so callbacks never cause effect re-runs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const manualCloseRef = useRef(false);

  // Subscriber registry: messageType -> Set<handler>
  const subscribersRef = useRef<Map<string, Set<MessageSubscriber>>>(new Map());

  // Keep stable refs to callbacks so we can reference them in useEffect
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ---------------------------------------------------------------------------
  // Ping helpers
  // ---------------------------------------------------------------------------

  const stopPing = useCallback(() => {
    if (pingTimerRef.current !== null) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const startPing = useCallback(() => {
    stopPing();
    pingTimerRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Socket may have closed between the check and send — ignore
        }
      }
    }, PING_INTERVAL_MS);
  }, [stopPing]);

  // ---------------------------------------------------------------------------
  // Message dispatch
  // ---------------------------------------------------------------------------

  const dispatch = useCallback((raw: string) => {
    let message: DaemonRawMessage;
    try {
      message = JSON.parse(raw) as DaemonRawMessage;
    } catch {
      console.warn('[useDaemonConnection] Failed to parse message:', raw);
      return;
    }

    const handlers = subscribersRef.current.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (handlerErr) {
          console.error(
            '[useDaemonConnection] Subscriber threw for type',
            message.type,
            handlerErr
          );
        }
      });
    }

    // Also dispatch to wildcard subscribers
    const wildcardHandlers = subscribersRef.current.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (handlerErr) {
          console.error(
            '[useDaemonConnection] Wildcard subscriber threw:',
            handlerErr
          );
        }
      });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const openConnection = useCallback(
    (wsUrl: string) => {
      // Guard against double-open
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setStatus('connecting');
      setError(null);
      manualCloseRef.current = false;

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (constructErr) {
        const err =
          constructErr instanceof Error
            ? constructErr
            : new Error('WebSocket construction failed');
        setStatus('error');
        setError(err);
        onErrorRef.current?.(err);
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setStatus('connected');
        setError(null);
        startPing();
        onConnectRef.current?.();
      };

      ws.onmessage = event => {
        dispatch(event.data as string);
      };

      ws.onerror = () => {
        // The browser WebSocket API provides no useful error details on the
        // event itself; a close event always follows, so we defer error
        // handling to onclose.
        const err = new Error('WebSocket connection error');
        setError(err);
        onErrorRef.current?.(err);
      };

      ws.onclose = event => {
        stopPing();
        wsRef.current = null;

        if (manualCloseRef.current) {
          setStatus('disconnected');
          onDisconnectRef.current?.();
          return;
        }

        setStatus('disconnected');
        onDisconnectRef.current?.();

        // Attempt reconnect if we haven't exhausted attempts
        const attempt = reconnectAttemptsRef.current + 1;
        if (attempt <= maxReconnectAttempts) {
          reconnectAttemptsRef.current = attempt;
          setReconnectAttempts(attempt);

          const delay = Math.min(
            INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1),
            MAX_RECONNECT_DELAY_MS
          );

          console.info(
            `[useDaemonConnection] Reconnecting in ${delay}ms (attempt ${attempt}/${maxReconnectAttempts}). Code: ${event.code}`
          );

          reconnectTimerRef.current = setTimeout(() => {
            openConnection(wsUrl);
          }, delay);
        } else {
          console.warn(
            '[useDaemonConnection] Max reconnect attempts reached. Giving up.'
          );
          setStatus('error');
          const exhaustedErr = new Error(
            'WebSocket connection lost: max reconnect attempts reached'
          );
          setError(exhaustedErr);
          onErrorRef.current?.(exhaustedErr);
        }
      };
    },
    [dispatch, startPing, stopPing, maxReconnectAttempts]
  );

  const closeConnection = useCallback(() => {
    manualCloseRef.current = true;
    clearReconnectTimer();
    stopPing();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }

    setStatus('disconnected');
  }, [clearReconnectTimer, stopPing]);

  // ---------------------------------------------------------------------------
  // Connect / disconnect effect
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!url) {
      // If URL is removed while connected, close
      if (wsRef.current) {
        closeConnection();
      }
      setStatus('idle');
      return;
    }

    openConnection(url);

    return () => {
      manualCloseRef.current = true;
      clearReconnectTimer();
      stopPing();
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
    // We intentionally list only `url` here so the connection is re-established
    // only when the target URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const sendMessage = useCallback((message: DaemonRawMessage): void => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(
        '[useDaemonConnection] Cannot send: WebSocket is not open'
      );
    }
    ws.send(JSON.stringify(message));
  }, []);

  const subscribe = useCallback(
    (type: string, handler: MessageSubscriber): (() => void) => {
      if (!subscribersRef.current.has(type)) {
        subscribersRef.current.set(type, new Set());
      }
      subscribersRef.current.get(type)!.add(handler);

      return () => {
        const set = subscribersRef.current.get(type);
        if (set) {
          set.delete(handler);
          if (set.size === 0) {
            subscribersRef.current.delete(type);
          }
        }
      };
    },
    []
  );

  const unsubscribe = useCallback(
    (type: string, handler: MessageSubscriber): void => {
      const set = subscribersRef.current.get(type);
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          subscribersRef.current.delete(type);
        }
      }
    },
    []
  );

  const reconnect = useCallback(() => {
    if (!url) {
      return;
    }
    clearReconnectTimer();
    closeConnection();
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    // Small delay to allow the previous socket to fully close
    reconnectTimerRef.current = setTimeout(() => {
      openConnection(url);
    }, 100);
  }, [url, clearReconnectTimer, closeConnection, openConnection]);

  return {
    status,
    isConnected: status === 'connected',
    error,
    reconnectAttempts,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect,
  };
}
