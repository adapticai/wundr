/**
 * useRealtimeActivity Hook
 *
 * Subscribes to real-time activity updates with polling fallback.
 * Updates the activity feed in real-time as changes occur.
 *
 * Features:
 * - Real-time activity updates via polling (30s interval)
 * - Optimistic updates for new activities
 * - Auto-scroll indicator when new activities arrive
 * - Automatic deduplication of activities
 *
 * @module hooks/use-realtime-activity
 */

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

import type { ActivityEntry } from '@/hooks/use-activity';

interface UseRealtimeActivityOptions {
  /** Workspace ID to subscribe to */
  workspaceId: string;
  /** Initial activities from server-side fetch */
  initialActivities?: ActivityEntry[];
  /** Activity type filter */
  typeFilter?: string;
  /** Date filter */
  dateFilter?: string;
  /** Callback when activities are updated */
  onActivitiesUpdate?: (activities: ActivityEntry[]) => void;
  /** Whether to enable realtime updates */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: 30000 = 30s) */
  pollingInterval?: number;
}

interface UseRealtimeActivityReturn {
  /** Current activities with real-time updates */
  activities: ActivityEntry[];
  /** Number of new activities since last view */
  newActivityCount: number;
  /** Whether polling is active */
  isPolling: boolean;
  /** Last error if any */
  error: Error | null;
  /** Clear new activity indicator */
  clearNewActivities: () => void;
  /** Manually trigger a poll */
  pollNow: () => Promise<void>;
}

/**
 * Hook for subscribing to real-time activity updates
 *
 * @param options - Configuration options
 * @returns Real-time activity state and controls
 *
 * @example
 * ```tsx
 * const { activities, newActivityCount, clearNewActivities } = useRealtimeActivity({
 *   workspaceId: 'workspace-123',
 *   initialActivities: serverActivities,
 *   typeFilter: 'all',
 * });
 * ```
 */
export function useRealtimeActivity({
  workspaceId,
  initialActivities = [],
  typeFilter = 'all',
  dateFilter,
  onActivitiesUpdate,
  enabled = true,
  pollingInterval = 30000, // 30 seconds
}: UseRealtimeActivityOptions): UseRealtimeActivityReturn {
  const [activities, setActivities] = useState<ActivityEntry[]>(initialActivities);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeenTimestampRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Store callback in ref to avoid dependency issues
  const onActivitiesUpdateRef = useRef(onActivitiesUpdate);

  useEffect(() => {
    onActivitiesUpdateRef.current = onActivitiesUpdate;
  }, [onActivitiesUpdate]);

  // Update lastSeenTimestamp when initial activities change
  useEffect(() => {
    if (initialActivities.length > 0 && !lastSeenTimestampRef.current) {
      lastSeenTimestampRef.current = initialActivities[0].timestamp;
    }
  }, [initialActivities]);

  // Sync with initial activities
  useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  /**
   * Build API URL with query parameters
   */
  const buildUrl = useCallback(
    (since?: string) => {
      const params = new URLSearchParams({
        limit: '50',
        type: typeFilter,
      });

      if (since) {
        params.set('since', since);
      }
      if (dateFilter) {
        params.set('dateFrom', dateFilter);
      }

      return `/api/workspaces/${workspaceId}/dashboard/activity?${params.toString()}`;
    },
    [workspaceId, typeFilter, dateFilter],
  );

  /**
   * Poll for new activities
   */
  const pollForNewActivities = useCallback(async () => {
    if (!enabled || !workspaceId || !mountedRef.current) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsPolling(true);
    setError(null);

    try {
      // Fetch activities newer than the last seen timestamp
      const url = lastSeenTimestampRef.current
        ? buildUrl(lastSeenTimestampRef.current)
        : buildUrl();

      const response = await fetch(url, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch activities: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid API response structure');
      }

      const newActivities: ActivityEntry[] = result.data;

      // If we have new activities, prepend them
      if (newActivities.length > 0 && mountedRef.current) {
        setActivities(prev => {
          // Deduplicate by ID
          const existingIds = new Set(prev.map(a => a.id));
          const uniqueNewActivities = newActivities.filter(
            a => !existingIds.has(a.id),
          );

          if (uniqueNewActivities.length === 0) {
            return prev;
          }

          // Update last seen timestamp
          lastSeenTimestampRef.current = uniqueNewActivities[0].timestamp;

          // Increment new activity count
          setNewActivityCount(count => count + uniqueNewActivities.length);

          // Prepend new activities
          const updated = [...uniqueNewActivities, ...prev];

          // Notify callback
          onActivitiesUpdateRef.current?.(updated);

          return updated;
        });
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (mountedRef.current) {
        const error =
          err instanceof Error
            ? err
            : new Error('Failed to poll for activities');
        setError(error);
        console.error('[useRealtimeActivity] Error polling:', error);
      }
    } finally {
      if (!abortController.signal.aborted && mountedRef.current) {
        setIsPolling(false);
        abortControllerRef.current = null;
      }
    }
  }, [enabled, workspaceId, buildUrl]);

  /**
   * Clear new activity indicator
   */
  const clearNewActivities = useCallback(() => {
    setNewActivityCount(0);
  }, []);

  /**
   * Manually trigger a poll
   */
  const pollNow = useCallback(async () => {
    await pollForNewActivities();
  }, [pollForNewActivities]);

  /**
   * Setup polling interval
   */
  useEffect(() => {
    if (!enabled || !workspaceId) {
      return;
    }

    // Start polling
    pollingIntervalRef.current = setInterval(() => {
      pollForNewActivities();
    }, pollingInterval);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, workspaceId, pollingInterval, pollForNewActivities]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    activities,
    newActivityCount,
    isPolling,
    error,
    clearNewActivities,
    pollNow,
  };
}
