'use client';

/**
 * Hook for fetching workspace admin dashboard statistics
 * @module hooks/admin/use-admin-stats
 */

import { useCallback } from 'react';
import useSWR from 'swr';

import type { DashboardStats } from '@/types/admin';

// =============================================================================
// Types
// =============================================================================

/**
 * Stats time range options
 */
export type StatsTimeRange = '24h' | '7d' | '30d' | '90d';

/**
 * Options for stats fetching
 */
export interface UseAdminStatsOptions {
  /** Time range for comparison metrics */
  timeRange?: StatsTimeRange;
  /** Whether to auto-refresh */
  refreshInterval?: number;
}

/**
 * Return type for useAdminStats hook
 */
export interface UseAdminStatsReturn {
  /** Dashboard statistics */
  stats: DashboardStats | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Manually refresh stats */
  refresh: () => Promise<void>;
}

// =============================================================================
// Fetcher
// =============================================================================

/**
 * Fetcher function with error handling
 */
const statsFetcher = async (url: string): Promise<DashboardStats> => {
  const res = await fetch(url);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.message || 'Failed to fetch stats'
    );
  }

  const result = await res.json();
  const data = result.data || result;

  // Transform date strings to Date objects
  if (data.activityTrends) {
    data.activityTrends = data.activityTrends.map(
      (trend: { date: string }) => ({
        ...trend,
        date: new Date(trend.date),
      })
    );
  }

  return data as DashboardStats;
};

// =============================================================================
// Hook: useAdminStats
// =============================================================================

/**
 * Hook for fetching workspace admin dashboard statistics
 *
 * Provides comprehensive metrics including user counts, growth trends,
 * storage usage, API usage, and top contributors.
 *
 * @param workspaceId - The workspace ID
 * @param options - Optional configuration for time range and refresh
 * @returns Dashboard statistics and management functions
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   const { stats, isLoading, error, refresh } = useAdminStats('workspace-123', {
 *     timeRange: '30d',
 *     refreshInterval: 60000, // Refresh every minute
 *   });
 *
 *   if (isLoading) return <Skeleton />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <StatCard
 *         title="Active Users"
 *         value={stats.activeUsers.current}
 *         change={stats.activeUsers.percentageChange}
 *       />
 *       <StatCard
 *         title="Total Members"
 *         value={stats.totalMembers.current}
 *         change={stats.totalMembers.percentageChange}
 *       />
 *       <ActivityChart data={stats.activityTrends} />
 *       <TopContributors users={stats.topContributors} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAdminStats(
  workspaceId: string,
  options: UseAdminStatsOptions = {}
): UseAdminStatsReturn {
  const { timeRange = '30d', refreshInterval } = options;

  // Build query params
  const queryParams = new URLSearchParams();
  queryParams.set('timeRange', timeRange);

  const url = `/api/workspaces/${workspaceId}/admin/stats?${queryParams}`;

  // Use SWR with optional refresh interval
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    url,
    statsFetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  // Manual refresh function
  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    stats: data ?? null,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}
