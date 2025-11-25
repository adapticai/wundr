'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a single analytics event to be tracked
 */
export interface AnalyticsEvent {
  /** The type of event being tracked (e.g., 'page.view', 'click', 'form.submit') */
  eventType: string;
  /** Additional data associated with the event */
  eventData?: AnalyticsEventData;
  /** Optional session ID override (defaults to auto-generated session ID) */
  sessionId?: string;
}

/**
 * Event data payload for analytics tracking
 */
export interface AnalyticsEventData {
  /** Page path for page view events */
  page?: string;
  /** URL for page view events */
  url?: string;
  /** Element identifier for click events */
  element?: string;
  /** Additional custom properties */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Return type for the useAnalytics hook
 */
export interface UseAnalyticsReturn {
  /** Track a custom analytics event */
  track: (event: AnalyticsEvent) => Promise<void>;
  /** Track a page view event */
  trackPageView: (page: string) => void;
  /** Track a click event with optional metadata */
  trackClick: (element: string, metadata?: AnalyticsEventData) => void;
  /** Current session ID */
  sessionId: string | undefined;
}

// =============================================================================
// useAnalytics Hook
// =============================================================================

/**
 * Hook for tracking analytics events in a workspace
 *
 * Provides methods to track page views, clicks, and custom events.
 * Automatically generates and maintains a session ID.
 *
 * @param workspaceId - The workspace ID to track events for
 * @returns Analytics tracking methods and session information
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { track, trackPageView, trackClick } = useAnalytics('workspace-123');
 *
 *   useEffect(() => {
 *     trackPageView('/dashboard');
 *   }, [trackPageView]);
 *
 *   return (
 *     <button onClick={() => trackClick('submit-button', { form: 'settings' })}>
 *       Submit
 *     </button>
 *   );
 * }
 * ```
 */
export function useAnalytics(workspaceId: string): UseAnalyticsReturn {
  const sessionId = useRef<string>();

  // Generate session ID on mount
  useEffect(() => {
    sessionId.current = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }, []);

  const track = useCallback(
    async (event: AnalyticsEvent): Promise<void> => {
      try {
        await fetch(`/api/workspaces/${workspaceId}/analytics/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            sessionId: event.sessionId || sessionId.current,
          }),
        });
      } catch {
        // Silently fail analytics tracking to avoid disrupting user experience
      }
    },
    [workspaceId],
  );

  const trackPageView = useCallback(
    (page: string): void => {
      track({
        eventType: 'page.view',
        eventData: { page, url: window.location.href },
      });
    },
    [track],
  );

  const trackClick = useCallback(
    (element: string, metadata?: AnalyticsEventData): void => {
      track({
        eventType: 'click',
        eventData: { element, ...metadata },
      });
    },
    [track],
  );

  return { track, trackPageView, trackClick, sessionId: sessionId.current };
}

// =============================================================================
// UsageMetrics Types
// =============================================================================

/**
 * Message usage metrics
 */
export interface MessageMetrics {
  /** Total number of messages */
  total: number;
}

/**
 * User activity metrics
 */
export interface UserMetrics {
  /** Number of currently active users */
  activeUsers: number;
  /** Total number of workspace members */
  totalMembers: number;
}

/**
 * Channel metrics
 */
export interface ChannelMetrics {
  /** Total number of channels */
  total: number;
}

/**
 * File storage metrics
 */
export interface FileMetrics {
  /** Total number of uploaded files */
  totalUploaded: number;
  /** Total size of all files in bytes */
  totalSize: number;
}

/**
 * VP (Virtual Person) metrics
 */
export interface VPMetrics {
  /** Total number of VPs */
  totalVPs: number;
  /** Number of currently active VPs */
  activeVPs: number;
}

/**
 * Aggregated usage metrics for a workspace
 */
export interface UsageMetrics {
  /** Message-related metrics */
  messages: MessageMetrics;
  /** User activity metrics */
  users: UserMetrics;
  /** Channel metrics */
  channels: ChannelMetrics;
  /** File storage metrics */
  files: FileMetrics;
  /** VP metrics */
  vp: VPMetrics;
}

/**
 * Return type for the useMetrics hook
 */
export interface UseMetricsReturn {
  /** The fetched metrics data, or null if not yet loaded */
  metrics: UsageMetrics | null;
  /** Whether the metrics are currently being fetched */
  isLoading: boolean;
  /** Error message if fetch failed, or null */
  error: string | null;
  /** Function to manually refetch metrics */
  refetch: () => Promise<void>;
}

// =============================================================================
// useMetrics Hook
// =============================================================================

/**
 * Hook for fetching workspace analytics metrics
 *
 * Fetches aggregated usage metrics for messages, users, channels, files, and VPs.
 *
 * @param workspaceId - The workspace ID to fetch metrics for
 * @param period - Time period for metrics ('day' | 'week' | 'month' | 'year')
 * @returns Metrics data and loading state
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { metrics, isLoading, error } = useMetrics('workspace-123', 'week');
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <p>Active Users: {metrics?.users.activeUsers}</p>
 *       <p>Total Messages: {metrics?.messages.total}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMetrics(workspaceId: string, period: string = 'month'): UseMetricsReturn {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/metrics?period=${period}`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data: UsageMetrics = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, period]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, isLoading, error, refetch: fetchMetrics };
}

// =============================================================================
// RealTimeStats Types
// =============================================================================

/**
 * Real-time statistics data
 */
export interface RealTimeStatsData {
  /** Currently online users count */
  onlineUsers?: number;
  /** Active channels count */
  activeChannels?: number;
  /** Messages in the last hour */
  messagesLastHour?: number;
  /** Active calls count */
  activeCalls?: number;
  /** Additional custom stats */
  [key: string]: number | undefined;
}

/**
 * Real-time statistics response
 */
export interface RealTimeStats {
  /** Statistics data */
  stats: RealTimeStatsData;
  /** ISO timestamp of when stats were collected */
  timestamp: string;
}

/**
 * Return type for the useRealTimeStats hook
 */
export interface UseRealTimeStatsReturn {
  /** The real-time stats data, or null if not yet loaded */
  stats: RealTimeStats | null;
  /** Whether stats are currently being fetched */
  isLoading: boolean;
}

// =============================================================================
// useRealTimeStats Hook
// =============================================================================

/**
 * Hook for fetching real-time analytics statistics
 *
 * Polls the server at regular intervals for live statistics.
 *
 * @param workspaceId - The workspace ID to fetch stats for
 * @param refreshInterval - Polling interval in milliseconds (default: 10000)
 * @returns Real-time stats data and loading state
 *
 * @example
 * ```tsx
 * function LiveStats() {
 *   const { stats, isLoading } = useRealTimeStats('workspace-123', 5000);
 *
 *   return (
 *     <div>
 *       <p>Online: {stats?.stats.onlineUsers ?? 0}</p>
 *       <p>Last updated: {stats?.timestamp}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealTimeStats(
  workspaceId: string,
  refreshInterval = 10000,
): UseRealTimeStatsReturn {
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async (): Promise<void> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/realtime`,
        );
        if (response.ok) {
          const data: RealTimeStats = await response.json();
          setStats(data);
        }
      } catch {
        // Silently fail to avoid disrupting the UI
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, refreshInterval);

    return () => clearInterval(interval);
  }, [workspaceId, refreshInterval]);

  return { stats, isLoading };
}

export default useAnalytics;
