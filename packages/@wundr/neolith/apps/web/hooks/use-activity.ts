/**
 * Activity Feed Hook
 *
 * Custom hook for fetching and managing workspace activity feed data.
 * Supports filtering by type, date range, user, and cursor-based pagination.
 *
 * @module hooks/use-activity
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Activity type enumeration
 */
export type ActivityType =
  | 'message'
  | 'task'
  | 'workflow'
  | 'member'
  | 'file'
  | 'channel'
  | 'all';

/**
 * Actor information (user or Orchestrator)
 */
export interface Actor {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOrchestrator: boolean;
  email?: string | null;
}

/**
 * Target/resource information
 */
export interface ActivityTarget {
  type: 'channel' | 'task' | 'workflow' | 'workspace' | 'file' | 'user';
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Unified activity entry
 */
export interface ActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  actor: Actor;
  target?: ActivityTarget;
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: string; // ISO 8601 string from API
}

/**
 * Activity filters
 */
export interface ActivityFilters {
  type?: ActivityType;
  dateFrom?: string;
  dateTo?: string;
  channelId?: string;
  userId?: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  limit: number;
  cursor?: string | null;
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Raw activity entry from API (timestamp is Date)
 */
interface RawActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  actor: Actor;
  target?: ActivityTarget;
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: Date | string; // API returns Date, but JSON.parse converts to string
}

/**
 * Activity feed response
 */
interface ActivityResponse {
  data: RawActivityEntry[];
  pagination: PaginationInfo;
  workspace: {
    id: string;
    name: string;
    organizationId: string;
  };
}

/**
 * Hook options
 */
interface UseActivityOptions extends ActivityFilters {
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook return type
 */
interface UseActivityReturn {
  activities: ActivityEntry[];
  isLoading: boolean;
  error: Error | null;
  pagination: PaginationInfo | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Custom hook to fetch and manage workspace activity feed
 *
 * @param workspaceId - The workspace ID
 * @param options - Filter and pagination options
 * @returns Activity data, loading state, error, and pagination controls
 *
 * @example
 * ```tsx
 * const { activities, isLoading, loadMore, hasMore } = useActivity('workspace-123', {
 *   type: 'message',
 *   limit: 20,
 * });
 * ```
 */
export function useActivity(
  workspaceId: string,
  options: UseActivityOptions = {}
): UseActivityReturn {
  const {
    type = 'all',
    dateFrom,
    dateTo,
    channelId,
    userId,
    limit = 20,
    enabled = true,
  } = options;

  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Build API URL with query parameters
   */
  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        type,
      });

      if (cursor) {
        params.set('cursor', cursor);
      }
      if (dateFrom) {
        params.set('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.set('dateTo', dateTo);
      }
      if (channelId) {
        params.set('channelId', channelId);
      }
      if (userId) {
        params.set('userId', userId);
      }

      return `/api/workspaces/${workspaceId}/dashboard/activity?${params.toString()}`;
    },
    [workspaceId, limit, type, dateFrom, dateTo, channelId, userId]
  );

  /**
   * Normalize activity timestamp to ISO string
   */
  const normalizeActivity = useCallback(
    (raw: RawActivityEntry): ActivityEntry => {
      return {
        ...raw,
        timestamp:
          typeof raw.timestamp === 'string'
            ? raw.timestamp
            : raw.timestamp.toISOString(),
      };
    },
    []
  );

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!enabled) {
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const response = await fetch(buildUrl(cursor), {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch activities: ${response.status} ${response.statusText}`
          );
        }

        const result: ActivityResponse = await response.json();

        // Validate response structure
        if (!result.data || !Array.isArray(result.data) || !result.pagination) {
          throw new Error('Invalid API response structure');
        }

        // Normalize timestamps to strings
        const normalizedActivities = result.data.map(normalizeActivity);

        if (append) {
          setActivities(prev => [...prev, ...normalizedActivities]);
        } else {
          setActivities(normalizedActivities);
        }

        setPagination(result.pagination);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const error =
          err instanceof Error ? err : new Error('Failed to fetch activities');
        setError(error);
        console.error('[useActivity] Error fetching activities:', error);
      } finally {
        // Only update loading states if this request wasn't aborted
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
          abortControllerRef.current = null;
        }
      }
    },
    [enabled, buildUrl, normalizeActivity]
  );

  /**
   * Load more activities (pagination)
   */
  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoadingMore) {
      return;
    }

    await fetchActivities(pagination.nextCursor, true);
  }, [pagination, isLoadingMore, fetchActivities]);

  /**
   * Refresh activities (reset to first page)
   */
  const refresh = useCallback(async () => {
    await fetchActivities(null, false);
  }, [fetchActivities]);

  /**
   * Initial fetch and refetch on filter changes
   */
  useEffect(() => {
    fetchActivities(null, false);

    // Cleanup: abort any in-flight request when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [fetchActivities]);

  return {
    activities,
    isLoading,
    error,
    pagination,
    loadMore,
    refresh,
    hasMore: pagination?.hasMore ?? false,
  };
}
