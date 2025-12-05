'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';

// =============================================================================
// Types
// =============================================================================

/**
 * Time range filter for analytics data
 */
export type AnalyticsTimeRange =
  | 'today'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

/**
 * Granularity for time series data
 */
export type AnalyticsGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

/**
 * Orchestrator activity metrics
 */
export interface OrchestratorActivityMetrics {
  orchestratorId: string;
  orchestratorName: string;
  messageCount: number;
  taskCount: number;
  completedTasks: number;
  averageResponseTime?: number;
  status: 'active' | 'idle' | 'offline';
  lastActiveAt?: string;
}

/**
 * Channel engagement metrics
 */
export interface ChannelEngagementMetrics {
  channelId: string;
  channelName: string;
  channelType: 'public' | 'private' | 'direct';
  messageCount: number;
  memberCount: number;
  activeMembers: number;
  engagementRate: number;
}

/**
 * Task metrics breakdown
 */
export interface TaskMetricsBreakdown {
  byStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  averageCompletionTime?: number;
  completionRate: number;
}

/**
 * Workflow metrics breakdown
 */
export interface WorkflowMetricsBreakdown {
  byStatus: {
    active: number;
    draft: number;
    inactive: number;
    archived: number;
  };
  successRate: number;
  averageDuration?: number;
  totalExecutions: number;
}

/**
 * Analytics summary data
 */
export interface AnalyticsSummary {
  totalMessages: number;
  totalChannels: number;
  totalMembers: number;
  totalOrchestrators: number;
  totalTasks: number;
  totalWorkflows: number;
  activeOrchestrators: number;
  completedTasks: number;
  successfulWorkflows: number;
  averageResponseTime?: number;
}

/**
 * Complete analytics data structure
 */
export interface AnalyticsData {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
    granularity: AnalyticsGranularity;
  };
  summary: AnalyticsSummary;
  timeSeries: {
    messageVolume: TimeSeriesPoint[];
    taskCompletion: TimeSeriesPoint[];
    workflowExecution: TimeSeriesPoint[];
    orchestratorActivity: TimeSeriesPoint[];
  };
  orchestratorActivity: OrchestratorActivityMetrics[];
  channelEngagement: ChannelEngagementMetrics[];
  taskMetrics: TaskMetricsBreakdown;
  workflowMetrics: WorkflowMetricsBreakdown;
  metadata?: {
    generatedAt: string;
    version: string;
  };
}

/**
 * Query parameters for analytics
 */
export interface AnalyticsQueryParams {
  startDate?: string;
  endDate?: string;
  granularity?: AnalyticsGranularity;
  includeTimeSeries?: boolean;
  includeBreakdown?: boolean;
}

/**
 * Comparison analytics data
 */
export interface AnalyticsComparison {
  current: AnalyticsData;
  previous: AnalyticsData;
  changes: {
    messages: number;
    tasks: number;
    workflows: number;
    orchestrators: number;
  };
  percentChanges: {
    messages: number;
    tasks: number;
    workflows: number;
    orchestrators: number;
  };
}

/**
 * Return type for useAnalyticsData hook
 */
export interface UseAnalyticsDataReturn {
  /** Analytics data */
  data: AnalyticsData | null;
  /** Loading state */
  isLoading: boolean;
  /** Validation/refresh state */
  isValidating: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Update query parameters */
  updateParams: (params: Partial<AnalyticsQueryParams>) => void;
  /** Current query parameters */
  params: AnalyticsQueryParams;
}

/**
 * Return type for useAnalyticsComparison hook
 */
export interface UseAnalyticsComparisonReturn {
  /** Comparison data */
  comparison: AnalyticsComparison | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch comparison data */
  refetch: () => Promise<void>;
}

/**
 * Options for useAnalyticsData hook
 */
export interface UseAnalyticsDataOptions extends SWRConfiguration {
  /** Initial query parameters */
  initialParams?: AnalyticsQueryParams;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Whether to fetch on mount */
  enabled?: boolean;
}

// =============================================================================
// Fetchers
// =============================================================================

/**
 * Fetcher function for analytics data
 */
async function fetchAnalyticsData(url: string): Promise<AnalyticsData> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch analytics: ${response.statusText}`
    );
  }

  return response.json();
}

// =============================================================================
// useAnalyticsData Hook
// =============================================================================

/**
 * Hook for fetching comprehensive workspace analytics data
 *
 * Provides complete analytics including time series data, orchestrator activity,
 * channel engagement, and task/workflow metrics with SWR caching and revalidation.
 *
 * @param workspaceId - The workspace ID to fetch analytics for
 * @param options - Configuration options
 * @returns Analytics data, loading state, and control functions
 *
 * @example
 * ```tsx
 * function AnalyticsDashboard({ workspaceId }: { workspaceId: string }) {
 *   const {
 *     data,
 *     isLoading,
 *     error,
 *     updateParams,
 *     params
 *   } = useAnalyticsData(workspaceId, {
 *     initialParams: {
 *       granularity: 'daily',
 *       includeTimeSeries: true,
 *       includeBreakdown: true
 *     },
 *     refreshInterval: 60000 // Refresh every minute
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!data) return null;
 *
 *   return (
 *     <div>
 *       <h1>{data.workspace.name} Analytics</h1>
 *       <div className="summary">
 *         <StatCard label="Total Messages" value={data.summary.totalMessages} />
 *         <StatCard label="Active Orchestrators" value={data.summary.activeOrchestrators} />
 *         <StatCard label="Task Completion Rate" value={`${data.taskMetrics.completionRate}%`} />
 *       </div>
 *       <TimeSeriesChart data={data.timeSeries.messageVolume} />
 *       <button onClick={() => updateParams({ granularity: 'weekly' })}>
 *         Switch to Weekly
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalyticsData(
  workspaceId: string,
  options: UseAnalyticsDataOptions = {}
): UseAnalyticsDataReturn {
  const {
    initialParams = {},
    refreshInterval,
    enabled = true,
    ...swrOptions
  } = options;

  const [params, setParams] = useState<AnalyticsQueryParams>(initialParams);

  // Build query string
  const queryString = new URLSearchParams();
  if (params.startDate) {
    queryString.set('startDate', params.startDate);
  }
  if (params.endDate) {
    queryString.set('endDate', params.endDate);
  }
  if (params.granularity) {
    queryString.set('granularity', params.granularity);
  }
  if (params.includeTimeSeries !== undefined) {
    queryString.set('includeTimeSeries', String(params.includeTimeSeries));
  }
  if (params.includeBreakdown !== undefined) {
    queryString.set('includeBreakdown', String(params.includeBreakdown));
  }

  const url = enabled
    ? `/api/workspaces/${workspaceId}/analytics?${queryString.toString()}`
    : null;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<AnalyticsData>(url, fetchAnalyticsData, {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      ...swrOptions,
    });

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  const updateParams = useCallback(
    (newParams: Partial<AnalyticsQueryParams>): void => {
      setParams(prev => ({ ...prev, ...newParams }));
    },
    []
  );

  return {
    data: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    refetch,
    updateParams,
    params,
  };
}

// =============================================================================
// useAnalyticsComparison Hook
// =============================================================================

/**
 * Hook for comparing analytics data across time periods
 *
 * Fetches current and previous period analytics for comparison.
 *
 * @param workspaceId - The workspace ID
 * @param currentPeriod - Current period parameters
 * @param options - SWR configuration options
 * @returns Comparison data with changes and percent changes
 *
 * @example
 * ```tsx
 * function AnalyticsComparison({ workspaceId }: { workspaceId: string }) {
 *   const { comparison, isLoading, error } = useAnalyticsComparison(
 *     workspaceId,
 *     {
 *       startDate: '2024-01-01',
 *       endDate: '2024-01-31',
 *       granularity: 'daily'
 *     }
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!comparison) return null;
 *
 *   return (
 *     <div>
 *       <ComparisonCard
 *         label="Messages"
 *         current={comparison.current.summary.totalMessages}
 *         previous={comparison.previous.summary.totalMessages}
 *         change={comparison.percentChanges.messages}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalyticsComparison(
  workspaceId: string,
  currentPeriod: AnalyticsQueryParams,
  options: SWRConfiguration = {}
): UseAnalyticsComparisonReturn {
  const [comparison, setComparison] = useState<AnalyticsComparison | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchComparison = useCallback(async (): Promise<void> => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query for current period
      const currentQuery = new URLSearchParams();
      if (currentPeriod.startDate) {
        currentQuery.set('startDate', currentPeriod.startDate);
      }
      if (currentPeriod.endDate) {
        currentQuery.set('endDate', currentPeriod.endDate);
      }
      if (currentPeriod.granularity) {
        currentQuery.set('granularity', currentPeriod.granularity);
      }

      // Calculate previous period dates
      const start = currentPeriod.startDate
        ? new Date(currentPeriod.startDate)
        : new Date();
      const end = currentPeriod.endDate
        ? new Date(currentPeriod.endDate)
        : new Date();
      const duration = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - duration);
      const prevEnd = new Date(end.getTime() - duration);

      // Build query for previous period
      const previousQuery = new URLSearchParams();
      previousQuery.set('startDate', prevStart.toISOString());
      previousQuery.set('endDate', prevEnd.toISOString());
      if (currentPeriod.granularity) {
        previousQuery.set('granularity', currentPeriod.granularity);
      }

      // Fetch both periods
      const [currentData, previousData] = await Promise.all([
        fetchAnalyticsData(
          `/api/workspaces/${workspaceId}/analytics?${currentQuery.toString()}`
        ),
        fetchAnalyticsData(
          `/api/workspaces/${workspaceId}/analytics?${previousQuery.toString()}`
        ),
      ]);

      // Calculate changes
      const changes = {
        messages:
          currentData.summary.totalMessages -
          previousData.summary.totalMessages,
        tasks: currentData.summary.totalTasks - previousData.summary.totalTasks,
        workflows:
          currentData.summary.totalWorkflows -
          previousData.summary.totalWorkflows,
        orchestrators:
          currentData.summary.activeOrchestrators -
          previousData.summary.activeOrchestrators,
      };

      const percentChanges = {
        messages:
          previousData.summary.totalMessages > 0
            ? (changes.messages / previousData.summary.totalMessages) * 100
            : 0,
        tasks:
          previousData.summary.totalTasks > 0
            ? (changes.tasks / previousData.summary.totalTasks) * 100
            : 0,
        workflows:
          previousData.summary.totalWorkflows > 0
            ? (changes.workflows / previousData.summary.totalWorkflows) * 100
            : 0,
        orchestrators:
          previousData.summary.activeOrchestrators > 0
            ? (changes.orchestrators /
                previousData.summary.activeOrchestrators) *
              100
            : 0,
      };

      setComparison({
        current: currentData,
        previous: previousData,
        changes,
        percentChanges,
      });
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Unknown error');
      setError(errorObj);
      console.error('[useAnalyticsComparison] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, currentPeriod]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  return {
    comparison,
    isLoading,
    error,
    refetch: fetchComparison,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useAnalyticsData;
