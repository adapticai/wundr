/**
 * Activity Feed Hook
 *
 * Custom hook for fetching and managing workspace activity feed data.
 * Supports filtering by type, date range, user, and cursor-based pagination.
 *
 * @module hooks/use-activity
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Activity type enumeration
 */
export type ActivityType = 'message' | 'task' | 'workflow' | 'member' | 'file' | 'channel' | 'all';

/**
 * Actor information (user or VP)
 */
export interface Actor {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isVP: boolean;
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
  timestamp: string;
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
 * Activity feed response
 */
interface ActivityResponse {
  data: ActivityEntry[];
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
  options: UseActivityOptions = {},
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
    [workspaceId, limit, type, dateFrom, dateTo, channelId, userId],
  );

  /**
   * Fetch activities from API
   */
  const fetchActivities = useCallback(
    async (cursor?: string | null, append = false) => {
      if (!enabled) {
return;
}

      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const response = await fetch(buildUrl(cursor));

        if (!response.ok) {
          throw new Error(
            `Failed to fetch activities: ${response.status} ${response.statusText}`,
          );
        }

        const result: ActivityResponse = await response.json();

        if (append) {
          setActivities((prev) => [...prev, ...result.data]);
        } else {
          setActivities(result.data);
        }

        setPagination(result.pagination);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch activities');
        setError(error);
        console.error('[useActivity] Error fetching activities:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [enabled, buildUrl],
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
