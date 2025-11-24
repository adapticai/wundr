'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AnalyticsEvent {
  eventType: string;
  eventData?: Record<string, unknown>;
  sessionId?: string;
}

/**
 * Hook for tracking analytics events
 */
export function useAnalytics(workspaceId: string) {
  const sessionId = useRef<string>();

  // Generate session ID on mount
  useEffect(() => {
    sessionId.current = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }, []);

  const track = useCallback(
    async (event: AnalyticsEvent) => {
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
        // Silently fail analytics tracking
      }
    },
    [workspaceId]
  );

  const trackPageView = useCallback(
    (page: string) => {
      track({
        eventType: 'page.view',
        eventData: { page, url: window.location.href },
      });
    },
    [track]
  );

  const trackClick = useCallback(
    (element: string, metadata?: Record<string, unknown>) => {
      track({
        eventType: 'click',
        eventData: { element, ...metadata },
      });
    },
    [track]
  );

  return { track, trackPageView, trackClick, sessionId: sessionId.current };
}

interface UsageMetrics {
  messages: { total: number };
  users: { activeUsers: number; totalMembers: number };
  channels: { total: number };
  files: { totalUploaded: number; totalSize: number };
  vp: { totalVPs: number; activeVPs: number };
}

/**
 * Hook for fetching analytics metrics
 */
export function useMetrics(workspaceId: string, period: string = 'month') {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/metrics?period=${period}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
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

interface RealTimeStats {
  stats: Record<string, number>;
  timestamp: string;
}

/**
 * Hook for real-time analytics stats
 */
export function useRealTimeStats(workspaceId: string, refreshInterval = 10000) {
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/analytics/realtime`
        );
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // Silently fail
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
