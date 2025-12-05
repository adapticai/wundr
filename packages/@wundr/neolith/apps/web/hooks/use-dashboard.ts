'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

/**
 * Time range filter options for dashboard statistics
 */
export type TimeRange = 'today' | 'week' | 'month' | 'all';

/**
 * Activity type filter options
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
 * Member statistics
 */
export interface MemberStats {
  total: number;
  activeToday: number;
  orchestratorCount: number;
  humanCount: number;
}

/**
 * Channel statistics
 */
export interface ChannelStats {
  total: number;
  publicCount: number;
  privateCount: number;
}

/**
 * Message statistics
 */
export interface MessageStats {
  today: number;
  week: number;
  month: number;
  total: number;
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  total: number;
  active: number;
  draft: number;
  inactive: number;
  archived: number;
}

/**
 * Task statistics
 */
export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  completionRate: number;
}

/**
 * Recent activity entry
 */
export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: Date | string;
  userId?: string;
  userName?: string;
}

/**
 * Top contributor data
 */
export interface TopContributor {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  messageCount: number;
}

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  members: MemberStats;
  channels: ChannelStats;
  messages: MessageStats;
  workflows: WorkflowStats;
  tasks: TaskStats;
  recentActivity: RecentActivity[];
  topContributors: TopContributor[];
}

/**
 * Dashboard stats API response
 */
export interface DashboardStatsResponse {
  data: DashboardStats;
  metadata: {
    timeRange: TimeRange;
    generatedAt: string;
  };
}

/**
 * Actor information (user or Orchestrator)
 */
export interface ActivityActor {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOrchestrator: boolean;
  email?: string | null;
}

/**
 * Activity target/resource information
 */
export interface ActivityTarget {
  type: 'channel' | 'task' | 'workflow' | 'workspace' | 'file' | 'user';
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Unified activity entry with actor and target
 */
export interface ActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  actor: ActivityActor;
  target?: ActivityTarget;
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: Date | string;
}

/**
 * Activity pagination metadata
 */
export interface ActivityPagination {
  limit: number;
  cursor?: string;
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Workspace information
 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  organizationId: string;
}

/**
 * Dashboard activity API response
 */
export interface DashboardActivityResponse {
  data: ActivityEntry[];
  pagination: ActivityPagination;
  workspace: WorkspaceInfo;
}

/**
 * Options for fetching dashboard stats
 */
export interface DashboardStatsOptions {
  timeRange?: TimeRange;
  includeActivity?: boolean;
  activityLimit?: number;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Options for fetching dashboard activity
 */
export interface DashboardActivityOptions {
  limit?: number;
  cursor?: string;
  type?: ActivityType;
  dateFrom?: string;
  dateTo?: string;
  channelId?: string;
  userId?: string;
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Return type for useDashboardStats hook
 */
export interface UseDashboardStatsReturn {
  stats: DashboardStats | null;
  metadata: DashboardStatsResponse['metadata'] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setTimeRange: (range: TimeRange) => void;
  timeRange: TimeRange;
}

/**
 * Return type for useDashboardActivity hook
 */
export interface UseDashboardActivityReturn {
  activities: ActivityEntry[];
  pagination: ActivityPagination | null;
  workspace: WorkspaceInfo | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  setType: (type: ActivityType) => void;
  type: ActivityType;
}

/**
 * Return type for useDashboard hook (combined stats and activity)
 */
export interface UseDashboardReturn {
  stats: UseDashboardStatsReturn;
  activity: UseDashboardActivityReturn;
  refresh: () => Promise<void>;
}

// =============================================================================
// useDashboardStats Hook
// =============================================================================

/**
 * Hook for fetching dashboard statistics
 *
 * Fetches comprehensive dashboard statistics including member counts,
 * channel stats, message counts, workflow stats, and task stats.
 *
 * @param workspaceId - The workspace ID to fetch statistics for
 * @param options - Configuration options for stats fetching
 * @returns Dashboard statistics and loading state
 *
 * @example
 * ```tsx
 * function DashboardStats() {
 *   const { stats, isLoading, error, setTimeRange, timeRange } = useDashboardStats(
 *     'workspace-123',
 *     { timeRange: 'week' }
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
 *         <option value="today">Today</option>
 *         <option value="week">This Week</option>
 *         <option value="month">This Month</option>
 *         <option value="all">All Time</option>
 *       </select>
 *       <p>Total Members: {stats?.members.total}</p>
 *       <p>Active Today: {stats?.members.activeToday}</p>
 *       <p>Messages This Week: {stats?.messages.week}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardStats(
  workspaceId: string,
  options: DashboardStatsOptions = {},
): UseDashboardStatsReturn {
  const {
    timeRange: initialTimeRange = 'all',
    includeActivity = true,
    activityLimit = 10,
    enabled = true,
    refetchInterval,
  } = options;

  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metadata, setMetadata] = useState<
    DashboardStatsResponse['metadata'] | null
  >(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(
    async (isRefetch = false): Promise<void> => {
      if (!workspaceId || !enabled) {
        return;
      }

      if (isRefetch) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const abortController = new AbortController();

      try {
        const params = new URLSearchParams({
          timeRange,
          includeActivity: String(includeActivity),
          activityLimit: String(activityLimit),
        });

        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/stats?${params.toString()}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to fetch dashboard statistics',
          );
        }

        const result: DashboardStatsResponse = await response.json();

        // Transform timestamps from strings to Date objects
        if (result.data.recentActivity) {
          result.data.recentActivity = result.data.recentActivity.map(
            activity => ({
              ...activity,
              timestamp: new Date(activity.timestamp),
            }),
          );
        }

        setStats(result.data);
        setMetadata(result.metadata);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Fetch was aborted, don't update error state
          return;
        }
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setStats(null);
        setMetadata(null);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [workspaceId, timeRange, includeActivity, activityLimit, enabled],
  );

  // Initial fetch and refetch on dependencies change
  useEffect(() => {
    let cancelled = false;

    const runFetch = async () => {
      if (!cancelled) {
        await fetchStats();
      }
    };

    runFetch();

    return () => {
      cancelled = true;
    };
  }, [fetchStats]);

  // Set up auto-refresh interval if provided
  useEffect(() => {
    if (!refetchInterval || !enabled) {
      return;
    }

    const interval = setInterval(() => {
      fetchStats(true);
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchStats]);

  const refetch = useCallback(async (): Promise<void> => {
    await fetchStats(true);
  }, [fetchStats]);

  return {
    stats,
    metadata,
    isLoading,
    isRefreshing,
    error,
    refetch,
    setTimeRange,
    timeRange,
  };
}

// =============================================================================
// useDashboardActivity Hook
// =============================================================================

/**
 * Hook for fetching dashboard activity feed
 *
 * Fetches a unified activity feed with cursor-based pagination.
 * Supports filtering by activity type, date range, channel, and user.
 *
 * @param workspaceId - The workspace ID to fetch activity for
 * @param options - Configuration options for activity fetching
 * @returns Activity feed with pagination and loading state
 *
 * @example
 * ```tsx
 * function ActivityFeed() {
 *   const { activities, isLoading, loadMore, hasMore, setType, type } = useDashboardActivity(
 *     'workspace-123',
 *     { limit: 20, type: 'all' }
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <select value={type} onChange={(e) => setType(e.target.value as ActivityType)}>
 *         <option value="all">All Activity</option>
 *         <option value="message">Messages</option>
 *         <option value="task">Tasks</option>
 *         <option value="workflow">Workflows</option>
 *       </select>
 *
 *       {activities.map(activity => (
 *         <ActivityCard key={activity.id} activity={activity} />
 *       ))}
 *
 *       {hasMore && (
 *         <button onClick={loadMore}>Load More</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardActivity(
  workspaceId: string,
  options: DashboardActivityOptions = {},
): UseDashboardActivityReturn {
  const {
    limit = 20,
    type: initialType = 'all',
    dateFrom,
    dateTo,
    channelId,
    userId,
    enabled = true,
    refetchInterval,
  } = options;

  const [type, setType] = useState<ActivityType>(initialType);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [pagination, setPagination] = useState<ActivityPagination | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivity = useCallback(
    async (cursor?: string, append = false): Promise<void> => {
      if (!workspaceId || !enabled) {
        return;
      }

      if (append) {
        setIsLoadingMore(true);
      } else if (cursor) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const abortController = new AbortController();

      try {
        const params = new URLSearchParams({
          limit: String(limit),
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

        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/activity?${params.toString()}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message || 'Failed to fetch dashboard activity',
          );
        }

        const result: DashboardActivityResponse = await response.json();

        // Transform timestamps from strings to Date objects
        const transformedActivities = result.data.map(activity => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        }));

        if (append) {
          setActivities(prev => [...prev, ...transformedActivities]);
        } else {
          setActivities(transformedActivities);
        }

        setPagination(result.pagination);
        setWorkspace(result.workspace);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Fetch was aborted, don't update error state
          return;
        }
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        if (!append) {
          setActivities([]);
          setPagination(null);
          setWorkspace(null);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [workspaceId, limit, type, dateFrom, dateTo, channelId, userId, enabled],
  );

  // Initial fetch and refetch on dependencies change
  useEffect(() => {
    let cancelled = false;

    const runFetch = async () => {
      if (!cancelled) {
        await fetchActivity();
      }
    };

    runFetch();

    return () => {
      cancelled = true;
    };
  }, [fetchActivity]);

  // Set up auto-refresh interval if provided
  useEffect(() => {
    if (!refetchInterval || !enabled) {
      return;
    }

    const interval = setInterval(() => {
      fetchActivity(undefined, false);
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchActivity]);

  const refetch = useCallback(async (): Promise<void> => {
    await fetchActivity(undefined, false);
  }, [fetchActivity]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (pagination?.nextCursor) {
      await fetchActivity(pagination.nextCursor, true);
    }
  }, [fetchActivity, pagination?.nextCursor]);

  const hasMore = useMemo(() => {
    return pagination?.hasMore ?? false;
  }, [pagination?.hasMore]);

  return {
    activities,
    pagination,
    workspace,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    refetch,
    loadMore,
    hasMore,
    setType,
    type,
  };
}

// =============================================================================
// useDashboard Hook (Combined)
// =============================================================================

/**
 * Combined hook for fetching both dashboard statistics and activity
 *
 * Provides a unified interface for managing both stats and activity feeds.
 * This is the recommended hook for full dashboard implementations.
 *
 * @param workspaceId - The workspace ID to fetch data for
 * @param statsOptions - Options for stats fetching
 * @param activityOptions - Options for activity fetching
 * @returns Combined dashboard stats and activity data
 *
 * @example
 * ```tsx
 * function Dashboard({ workspaceId }: { workspaceId: string }) {
 *   const { stats, activity, refresh } = useDashboard(
 *     workspaceId,
 *     { timeRange: 'week' },
 *     { limit: 20, type: 'all' }
 *   );
 *
 *   if (stats.isLoading || activity.isLoading) {
 *     return <Spinner />;
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={refresh}>Refresh All</button>
 *
 *       <div className="stats-grid">
 *         <StatCard label="Total Members" value={stats.stats?.members.total} />
 *         <StatCard label="Active Today" value={stats.stats?.members.activeToday} />
 *         <StatCard label="Messages Today" value={stats.stats?.messages.today} />
 *       </div>
 *
 *       <div className="activity-feed">
 *         <h2>Recent Activity</h2>
 *         {activity.activities.map(item => (
 *           <ActivityItem key={item.id} activity={item} />
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboard(
  workspaceId: string,
  statsOptions: DashboardStatsOptions = {},
  activityOptions: DashboardActivityOptions = {},
): UseDashboardReturn {
  const stats = useDashboardStats(workspaceId, statsOptions);
  const activity = useDashboardActivity(workspaceId, activityOptions);

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([stats.refetch(), activity.refetch()]);
  }, [stats, activity]);

  return {
    stats,
    activity,
    refresh,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useDashboard;
