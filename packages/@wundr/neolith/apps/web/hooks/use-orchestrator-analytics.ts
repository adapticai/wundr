/**
 * Orchestrator Analytics Hook
 *
 * Provides real-time analytics and metrics for orchestrators
 * @module hooks/use-orchestrator-analytics
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  OrchestratorAnalytics,
  OrchestratorMetrics,
  MetricTimeRange,
} from '@/types/orchestrator-analytics';

/**
 * Return type for useOrchestratorAnalytics hook
 */
export interface UseOrchestratorAnalyticsReturn {
  /** Analytics data including trends */
  analytics: OrchestratorAnalytics | null;
  /** Summary metrics for the specified time range */
  metrics: OrchestratorMetrics | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the data */
  refetch: () => void;
}

/**
 * Hook for fetching orchestrator analytics and metrics
 *
 * @param orchestratorId - The orchestrator ID to fetch analytics for
 * @param timeRange - Time range for metrics (default: '7d')
 * @param options - Additional options for analytics query
 * @returns Analytics data, metrics, and loading state
 *
 * @example
 * ```tsx
 * function OrchestratorDashboard({ orchestratorId }) {
 *   const { analytics, metrics, isLoading } = useOrchestratorAnalytics(
 *     orchestratorId,
 *     '30d'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <p>Success Rate: {metrics?.successRate}%</p>
 *       <p>Avg Duration: {metrics?.avgDurationMinutes}min</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrchestratorAnalytics(
  orchestratorId: string,
  timeRange: MetricTimeRange = '7d',
  options?: {
    includeDaily?: boolean;
    includeWeekly?: boolean;
    includeMonthly?: boolean;
  }
): UseOrchestratorAnalyticsReturn {
  const [analytics, setAnalytics] = useState<OrchestratorAnalytics | null>(
    null
  );
  const [metrics, setMetrics] = useState<OrchestratorMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAnalytics = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!orchestratorId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams({
          timeRange,
        });
        if (options?.includeDaily !== undefined) {
          params.set('includeDaily', String(options.includeDaily));
        }
        if (options?.includeWeekly !== undefined) {
          params.set('includeWeekly', String(options.includeWeekly));
        }
        if (options?.includeMonthly !== undefined) {
          params.set('includeMonthly', String(options.includeMonthly));
        }

        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/analytics?${params.toString()}`,
          { signal }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message ||
              `Failed to fetch analytics: ${response.status}`
          );
        }

        const result = await response.json();
        setAnalytics(result.data || null);
        setMetrics(result.metrics || null);
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err
            : new Error('Unknown error occurred while fetching analytics')
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orchestratorId, timeRange, options]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchAnalytics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchAnalytics]);

  const refetch = useCallback((): void => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    metrics,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Session Manager Metrics Interface
 */
export interface SessionManagerMetrics {
  totalSessionManagers: number;
  activeSessions: number;
  totalSubagents: number;
  totalTokenBudgetPerHour: number;
}

/**
 * Return type for useSessionManagerMetrics hook
 */
export interface UseSessionManagerMetricsReturn {
  /** Session manager metrics */
  metrics: SessionManagerMetrics | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to refetch the data */
  refetch: () => void;
}

/**
 * Hook for fetching session manager metrics for an orchestrator
 *
 * @param orchestratorId - The orchestrator ID
 * @returns Session manager metrics and loading state
 *
 * @example
 * ```tsx
 * function SessionManagerOverview({ orchestratorId }) {
 *   const { metrics, isLoading } = useSessionManagerMetrics(orchestratorId);
 *
 *   return (
 *     <div>
 *       <p>Total Session Managers: {metrics?.totalSessionManagers}</p>
 *       <p>Active Sessions: {metrics?.activeSessions}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionManagerMetrics(
  orchestratorId: string
): UseSessionManagerMetricsReturn {
  const [metrics, setMetrics] = useState<SessionManagerMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!orchestratorId) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/session-managers`,
          { signal }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error?.message ||
              `Failed to fetch session managers: ${response.status}`
          );
        }

        const result = await response.json();
        const sessionManagers = result.data || [];

        // Calculate metrics from session managers
        const totalSessionManagers = sessionManagers.length;
        const activeSessions = sessionManagers.filter(
          (sm: { status: string }) => sm.status === 'ACTIVE'
        ).length;
        const totalSubagents = sessionManagers.reduce(
          (sum: number, sm: { subagents: unknown[] }) =>
            sum + (sm.subagents?.length || 0),
          0
        );
        const totalTokenBudgetPerHour = sessionManagers.reduce(
          (sum: number, sm: { tokenBudgetPerHour: number }) =>
            sum + (sm.tokenBudgetPerHour || 0),
          0
        );

        setMetrics({
          totalSessionManagers,
          activeSessions,
          totalSubagents,
          totalTokenBudgetPerHour,
        });
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(
          err instanceof Error
            ? err
            : new Error('Unknown error occurred while fetching metrics')
        );
      } finally {
        setIsLoading(false);
      }
    },
    [orchestratorId]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchMetrics(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchMetrics]);

  const refetch = useCallback((): void => {
    void fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    refetch,
  };
}
