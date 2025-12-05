/**
 * React Hook for Real-time Analytics via Server-Sent Events (SSE)
 *
 * Provides live workspace analytics updates including:
 * - Active user count tracking
 * - Session metrics
 * - Message activity
 * - Event streams
 * - Connection health monitoring
 *
 * @example
 * ```tsx
 * function AnalyticsDashboard({ workspaceId }: { workspaceId: string }) {
 *   const { stats, isConnected, error } = useRealtimeAnalytics(workspaceId);
 *
 *   if (error) return <div>Error: {error}</div>;
 *   if (!stats) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Live Analytics {isConnected ? '🟢' : '🔴'}</h2>
 *       <p>Active Users: {stats.activeUsers}</p>
 *       <p>Online Users: {stats.onlineUsers}</p>
 *       <p>Messages Today: {stats.messagesToday}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @module hooks/useRealtimeAnalytics
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Real-time analytics statistics
 */
export interface RealtimeStats {
  /** Total active users in the workspace right now */
  activeUsers: number;
  /** Users currently online (active in last 5 minutes) */
  onlineUsers: number;
  /** Active sessions count */
  activeSessions: number;
  /** Messages sent in the last hour */
  messagesLastHour: number;
  /** Messages sent today */
  messagesToday: number;
  /** Active channels (with activity in last hour) */
  activeChannels: number;
  /** Current active orchestrators */
  activeOrchestrators: number;
  /** Tasks in progress */
  tasksInProgress: number;
  /** Event breakdown by type */
  eventCounts: Record<string, number>;
  /** Timestamp of stats generation */
  timestamp: string;
}

/**
 * SSE event types
 */
type SSEEventType = 'connected' | 'stats' | 'event' | 'ping' | 'error';

/**
 * SSE event data structure
 */
interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

/**
 * Hook options
 */
export interface UseRealtimeAnalyticsOptions {
  /** Enable/disable SSE streaming (default: true) */
  enabled?: boolean;
  /** Reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Callback for connection events */
  onConnect?: () => void;
  /** Callback for disconnection events */
  onDisconnect?: () => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback for each stats update */
  onStatsUpdate?: (stats: RealtimeStats) => void;
}

/**
 * Hook return value
 */
export interface UseRealtimeAnalyticsReturn {
  /** Current statistics */
  stats: RealtimeStats | null;
  /** Whether SSE is connected */
  isConnected: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually reconnect */
  reconnect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Track a custom event */
  trackEvent: (
    eventType: string,
    eventData?: Record<string, unknown>
  ) => Promise<void>;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook to subscribe to real-time analytics via SSE
 *
 * @param workspaceId - Workspace ID to monitor
 * @param options - Configuration options
 * @returns Real-time analytics state and controls
 */
export function useRealtimeAnalytics(
  workspaceId: string,
  options: UseRealtimeAnalyticsOptions = {}
): UseRealtimeAnalyticsReturn {
  const {
    enabled = true,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    onConnect,
    onDisconnect,
    onError,
    onStatsUpdate,
  } = options;

  // State
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for SSE connection and reconnection logic
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Create EventSource connection
      const url = `/api/workspaces/${workspaceId}/analytics/realtime`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Handle connection open
      eventSource.addEventListener('open', () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnect?.();
      });

      // Handle 'connected' event
      eventSource.addEventListener('connected', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        console.log('[SSE] Connected:', data);
      });

      // Handle 'stats' event
      eventSource.addEventListener('stats', (event: MessageEvent) => {
        const newStats = JSON.parse(event.data) as RealtimeStats;
        setStats(newStats);
        onStatsUpdate?.(newStats);
      });

      // Handle 'event' event (real-time workspace events)
      eventSource.addEventListener('event', (event: MessageEvent) => {
        const eventData = JSON.parse(event.data);
        console.log('[SSE] Event:', eventData);
        // Trigger stats refresh (handled by server)
      });

      // Handle 'ping' heartbeat
      eventSource.addEventListener('ping', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        console.debug('[SSE] Heartbeat:', data.timestamp);
      });

      // Handle errors
      eventSource.addEventListener('error', (event: Event) => {
        console.error('[SSE] Error:', event);
        setIsConnected(false);

        const errorMessage = 'Connection lost to real-time analytics';
        setError(errorMessage);
        onError?.(new Error(errorMessage));

        // Attempt reconnection
        if (
          autoReconnect &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current += 1;
          const delay =
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

          console.log(
            `[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError(
            'Max reconnection attempts reached. Please refresh the page.'
          );
          eventSource.close();
          onDisconnect?.();
        }
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [
    enabled,
    workspaceId,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    onConnect,
    onDisconnect,
    onError,
    onStatsUpdate,
  ]);

  /**
   * Disconnect from SSE
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    onDisconnect?.();
  }, [onDisconnect]);

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect, disconnect]);

  /**
   * Track a custom event
   */
  const trackEvent = useCallback(
    async (eventType: string, eventData?: Record<string, unknown>) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/realtime`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType,
              eventData: eventData || {},
              sessionId: `session_${Date.now()}`,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to track event: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[Event Tracked]', result);
      } catch (err) {
        console.error('[Track Event Error]', err);
        throw err;
      }
    },
    [workspaceId]
  );

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled && workspaceId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [enabled, workspaceId, connect, disconnect]);

  return {
    stats,
    isConnected,
    error,
    reconnect,
    disconnect,
    trackEvent,
  };
}

// =============================================================================
// POLLING FALLBACK HOOK
// =============================================================================

/**
 * Fallback hook using polling instead of SSE
 * Useful for environments where SSE is not supported
 *
 * @param workspaceId - Workspace ID to monitor
 * @param interval - Polling interval in ms (default: 5000)
 */
export function useRealtimeAnalyticsPolling(
  workspaceId: string,
  interval: number = 5000
): Omit<UseRealtimeAnalyticsReturn, 'disconnect' | 'reconnect'> {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isConnected = true; // Polling is always "connected"

  const trackEvent = useCallback(
    async (eventType: string, eventData?: Record<string, unknown>) => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/realtime`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventType,
              eventData: eventData || {},
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to track event: ${response.statusText}`);
        }
      } catch (err) {
        console.error('[Track Event Error]', err);
        throw err;
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/realtime`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const data = await response.json();
        if (mounted) {
          setStats(data.data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to fetch stats'
          );
        }
      }
    };

    // Initial fetch
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, interval);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [workspaceId, interval]);

  return {
    stats,
    isConnected,
    error,
    trackEvent,
  };
}
