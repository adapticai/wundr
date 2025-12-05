'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';

// =============================================================================
// Types
// =============================================================================

/**
 * Real-time metric update
 */
export interface MetricUpdate {
  metric: string;
  value: number;
  timestamp: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

/**
 * Real-time statistics data
 */
export interface RealTimeMetrics {
  onlineUsers: number;
  activeChannels: number;
  activeOrchestrators: number;
  messagesLastHour: number;
  tasksLastHour: number;
  activeCalls: number;
  systemLoad: number;
  responseTime: number;
  errorRate: number;
}

/**
 * Aggregated usage metrics
 */
export interface UsageMetrics {
  messages: {
    total: number;
    today: number;
    averagePerDay: number;
    threadsCreated: number;
    reactionsAdded: number;
    changePercent: number;
  };
  users: {
    activeUsers: number;
    totalMembers: number;
    newUsers: number;
    onlineNow: number;
    engagementRate: number;
  };
  channels: {
    total: number;
    public: number;
    private: number;
    direct: number;
    newChannels: number;
    averageActivity: number;
  };
  files: {
    totalUploaded: number;
    totalSize: number;
    uploadedToday: number;
    averageFileSize: number;
  };
  orchestrators: {
    total: number;
    active: number;
    idle: number;
    messagesSent: number;
    tasksCompleted: number;
    averageResponseTime: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number;
    averageCompletionTime: number;
  };
  workflows: {
    total: number;
    active: number;
    successRate: number;
    executionsToday: number;
    averageDuration: number;
  };
}

/**
 * System health metrics
 */
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  cpu: number;
  memory: number;
  database: {
    status: 'connected' | 'disconnected' | 'slow';
    responseTime: number;
    connections: number;
  };
  redis: {
    status: 'connected' | 'disconnected' | 'slow';
    responseTime: number;
    memoryUsage: number;
  };
  api: {
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Performance metrics over time
 */
export interface PerformanceMetrics {
  timestamp: string;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    messagesPerSecond: number;
    tasksPerSecond: number;
  };
  errors: {
    rate: number;
    count: number;
    types: Record<string, number>;
  };
  resources: {
    cpu: number;
    memory: number;
    connections: number;
  };
}

/**
 * Custom metric configuration
 */
export interface CustomMetric {
  id: string;
  name: string;
  query: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  refreshInterval?: number;
}

/**
 * WebSocket message type
 */
interface MetricsWebSocketMessage {
  type: 'update' | 'batch' | 'snapshot';
  data: MetricUpdate | MetricUpdate[] | RealTimeMetrics;
  timestamp: string;
}

/**
 * Return type for useRealTimeMetrics hook
 */
export interface UseRealTimeMetricsReturn {
  /** Real-time metrics data */
  metrics: RealTimeMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Connection state */
  isConnected: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually refresh metrics */
  refresh: () => Promise<void>;
}

/**
 * Return type for useUsageMetrics hook
 */
export interface UseUsageMetricsReturn {
  /** Usage metrics data */
  metrics: UsageMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Validation state */
  isValidating: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch metrics */
  refetch: () => Promise<void>;
}

/**
 * Return type for useHealthMetrics hook
 */
export interface UseHealthMetricsReturn {
  /** Health metrics data */
  health: HealthMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch health status */
  refetch: () => Promise<void>;
}

/**
 * Return type for usePerformanceMetrics hook
 */
export interface UsePerformanceMetricsReturn {
  /** Performance metrics data */
  metrics: PerformanceMetrics | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch metrics */
  refetch: () => Promise<void>;
}

/**
 * Return type for useCustomMetric hook
 */
export interface UseCustomMetricReturn {
  /** Metric value */
  value: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refetch metric */
  refetch: () => Promise<void>;
}

/**
 * Options for useRealTimeMetrics
 */
export interface UseRealTimeMetricsOptions {
  /** Use WebSocket for real-time updates */
  useWebSocket?: boolean;
  /** Polling interval in milliseconds (if not using WebSocket) */
  pollingInterval?: number;
  /** Auto-connect on mount */
  autoConnect?: boolean;
}

// =============================================================================
// Fetchers
// =============================================================================

/**
 * Fetcher for real-time metrics
 */
async function fetchRealTimeMetrics(url: string): Promise<RealTimeMetrics> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch real-time metrics: ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.stats || data;
}

/**
 * Fetcher for usage metrics
 */
async function fetchUsageMetrics(url: string): Promise<UsageMetrics> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch usage metrics: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Fetcher for health metrics
 */
async function fetchHealthMetrics(url: string): Promise<HealthMetrics> {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Failed to fetch health metrics: ${response.statusText}`,
    );
  }

  return response.json();
}

// =============================================================================
// useRealTimeMetrics Hook
// =============================================================================

/**
 * Hook for fetching real-time workspace metrics
 *
 * Provides live metrics with WebSocket support or polling. Automatically
 * handles reconnection and error recovery.
 *
 * @param workspaceId - The workspace ID
 * @param options - Configuration options
 * @returns Real-time metrics data and connection state
 *
 * @example
 * ```tsx
 * function LiveMetricsDashboard({ workspaceId }: { workspaceId: string }) {
 *   const { metrics, isConnected, error } = useRealTimeMetrics(workspaceId, {
 *     useWebSocket: true,
 *     autoConnect: true
 *   });
 *
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <div>
 *       <ConnectionStatus isConnected={isConnected} />
 *       <MetricCard label="Online Users" value={metrics?.onlineUsers ?? 0} />
 *       <MetricCard label="Active Channels" value={metrics?.activeChannels ?? 0} />
 *       <MetricCard label="Messages/Hour" value={metrics?.messagesLastHour ?? 0} />
 *       <MetricCard label="Response Time" value={`${metrics?.responseTime ?? 0}ms`} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealTimeMetrics(
  workspaceId: string,
  options: UseRealTimeMetricsOptions = {},
): UseRealTimeMetricsReturn {
  const {
    useWebSocket = false,
    pollingInterval = 5000,
    autoConnect = true,
  } = options;

  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const url = `/api/workspaces/${workspaceId}/analytics/realtime`;

  // SWR for polling
  const { data, error: swrError, isLoading, mutate } = useSWR<RealTimeMetrics>(
    !useWebSocket && autoConnect ? url : null,
    fetchRealTimeMetrics,
    {
      refreshInterval: pollingInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  // WebSocket connection
  useEffect(() => {
    if (!useWebSocket || !autoConnect) {
return;
}

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/workspaces/${workspaceId}/analytics/realtime/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          setError(null);
          console.log('[useRealTimeMetrics] WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const message: MetricsWebSocketMessage = JSON.parse(event.data);

            if (message.type === 'snapshot') {
              setMetrics(message.data as RealTimeMetrics);
            } else if (message.type === 'update') {
              const update = message.data as MetricUpdate;
              setMetrics(prev => {
                if (!prev) {
return null;
}
                return {
                  ...prev,
                  [update.metric]: update.value,
                };
              });
            }
          } catch (err) {
            console.error('[useRealTimeMetrics] Message parse error:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('[useRealTimeMetrics] WebSocket error:', event);
          setError(new Error('WebSocket connection error'));
        };

        ws.onclose = () => {
          setIsConnected(false);
          console.log('[useRealTimeMetrics] WebSocket disconnected');

          // Attempt reconnection after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[useRealTimeMetrics] Attempting reconnection...');
            connectWebSocket();
          }, 5000);
        };
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('WebSocket setup failed');
        setError(errorObj);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [workspaceId, useWebSocket, autoConnect]);

  // Update metrics from SWR polling
  useEffect(() => {
    if (!useWebSocket && data) {
      setMetrics(data);
      setIsConnected(true);
    }
  }, [data, useWebSocket]);

  // Update error from SWR
  useEffect(() => {
    if (swrError) {
      setError(swrError);
    }
  }, [swrError]);

  const refresh = useCallback(async (): Promise<void> => {
    if (useWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'refresh' }));
    } else {
      await mutate();
    }
  }, [useWebSocket, mutate]);

  return {
    metrics,
    isLoading: !useWebSocket ? isLoading : false,
    isConnected,
    error,
    refresh,
  };
}

// =============================================================================
// useUsageMetrics Hook
// =============================================================================

/**
 * Hook for fetching comprehensive usage metrics
 *
 * Provides aggregated metrics for messages, users, channels, files,
 * orchestrators, tasks, and workflows.
 *
 * @param workspaceId - The workspace ID
 * @param period - Time period for metrics
 * @param options - SWR configuration options
 * @returns Usage metrics data and loading state
 *
 * @example
 * ```tsx
 * function UsageOverview({ workspaceId }: { workspaceId: string }) {
 *   const { metrics, isLoading, error } = useUsageMetrics(
 *     workspaceId,
 *     'month'
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!metrics) return null;
 *
 *   return (
 *     <div className="grid">
 *       <MetricCard
 *         title="Messages"
 *         value={metrics.messages.total}
 *         change={metrics.messages.changePercent}
 *       />
 *       <MetricCard
 *         title="Active Users"
 *         value={metrics.users.activeUsers}
 *         subtitle={`${metrics.users.onlineNow} online now`}
 *       />
 *       <MetricCard
 *         title="Task Completion"
 *         value={`${metrics.tasks.completionRate}%`}
 *         subtitle={`${metrics.tasks.completed} completed`}
 *       />
 *       <MetricCard
 *         title="Orchestrators"
 *         value={metrics.orchestrators.active}
 *         subtitle={`${metrics.orchestrators.total} total`}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useUsageMetrics(
  workspaceId: string,
  period: string = 'month',
  options: SWRConfiguration = {},
): UseUsageMetricsReturn {
  const url = `/api/workspaces/${workspaceId}/analytics/metrics?period=${period}`;

  const { data, error, isLoading, isValidating, mutate } = useSWR<UsageMetrics>(
    url,
    fetchUsageMetrics,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
      ...options,
    },
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    metrics: data ?? null,
    isLoading,
    isValidating,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// useHealthMetrics Hook
// =============================================================================

/**
 * Hook for monitoring system health metrics
 *
 * Provides real-time system health status including database, Redis,
 * API performance, and resource utilization.
 *
 * @param workspaceId - The workspace ID
 * @param options - SWR configuration options
 * @returns Health metrics data and loading state
 *
 * @example
 * ```tsx
 * function SystemHealth({ workspaceId }: { workspaceId: string }) {
 *   const { health, isLoading, error } = useHealthMetrics(workspaceId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!health) return null;
 *
 *   return (
 *     <div>
 *       <StatusBadge status={health.status} />
 *       <MetricGrid>
 *         <HealthCard
 *           title="Database"
 *           status={health.database.status}
 *           responseTime={health.database.responseTime}
 *         />
 *         <HealthCard
 *           title="Redis"
 *           status={health.redis.status}
 *           responseTime={health.redis.responseTime}
 *         />
 *         <HealthCard
 *           title="API"
 *           rps={health.api.requestsPerSecond}
 *           errorRate={health.api.errorRate}
 *         />
 *       </MetricGrid>
 *       <ResourceUsage cpu={health.cpu} memory={health.memory} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useHealthMetrics(
  workspaceId: string,
  options: SWRConfiguration = {},
): UseHealthMetricsReturn {
  const url = `/api/workspaces/${workspaceId}/admin/health`;

  const { data, error, isLoading, mutate } = useSWR<HealthMetrics>(
    url,
    fetchHealthMetrics,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      ...options,
    },
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    health: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// usePerformanceMetrics Hook
// =============================================================================

/**
 * Hook for fetching performance metrics
 *
 * Provides detailed performance metrics including response times,
 * throughput, error rates, and resource utilization.
 *
 * @param workspaceId - The workspace ID
 * @param options - SWR configuration options
 * @returns Performance metrics data and loading state
 *
 * @example
 * ```tsx
 * function PerformanceDashboard({ workspaceId }: { workspaceId: string }) {
 *   const { metrics, isLoading, error } = usePerformanceMetrics(workspaceId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (!metrics) return null;
 *
 *   return (
 *     <div>
 *       <ResponseTimeChart data={metrics.responseTime} />
 *       <ThroughputChart data={metrics.throughput} />
 *       <ErrorRateChart data={metrics.errors} />
 *       <ResourceUsageChart data={metrics.resources} />
 *     </div>
 *   );
 * }
 * ```
 */
export function usePerformanceMetrics(
  workspaceId: string,
  options: SWRConfiguration = {},
): UsePerformanceMetricsReturn {
  const url = `/api/workspaces/${workspaceId}/analytics/performance`;

  const fetchPerformanceMetrics = async (url: string): Promise<PerformanceMetrics> => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Failed to fetch performance metrics: ${response.statusText}`,
      );
    }

    return response.json();
  };

  const { data, error, isLoading, mutate } = useSWR<PerformanceMetrics>(
    url,
    fetchPerformanceMetrics,
    {
      refreshInterval: 15000, // Refresh every 15 seconds
      revalidateOnFocus: true,
      ...options,
    },
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    metrics: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// useCustomMetric Hook
// =============================================================================

/**
 * Hook for fetching custom metrics
 *
 * Allows tracking of custom-defined metrics with configurable queries
 * and aggregations.
 *
 * @param workspaceId - The workspace ID
 * @param metric - Custom metric configuration
 * @param options - SWR configuration options
 * @returns Custom metric value and loading state
 *
 * @example
 * ```tsx
 * function CustomMetricDisplay({ workspaceId }: { workspaceId: string }) {
 *   const { value, isLoading, error } = useCustomMetric(
 *     workspaceId,
 *     {
 *       id: 'avg-task-completion',
 *       name: 'Average Task Completion Time',
 *       query: 'tasks.completionTime',
 *       aggregation: 'avg',
 *       refreshInterval: 60000
 *     }
 *   );
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return (
 *     <MetricCard
 *       title="Avg Task Completion"
 *       value={`${value ?? 0}ms`}
 *     />
 *   );
 * }
 * ```
 */
export function useCustomMetric(
  workspaceId: string,
  metric: CustomMetric,
  options: SWRConfiguration = {},
): UseCustomMetricReturn {
  const queryParams = new URLSearchParams({
    query: metric.query,
    aggregation: metric.aggregation,
  });

  const url = `/api/workspaces/${workspaceId}/analytics/custom?${queryParams.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<{ value: number }>(
    url,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
throw new Error('Failed to fetch custom metric');
}
      return response.json();
    },
    {
      refreshInterval: metric.refreshInterval ?? 30000,
      ...options,
    },
  );

  const refetch = useCallback(async (): Promise<void> => {
    await mutate();
  }, [mutate]);

  return {
    value: data?.value ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

// =============================================================================
// Exports
// =============================================================================

export default useRealTimeMetrics;
