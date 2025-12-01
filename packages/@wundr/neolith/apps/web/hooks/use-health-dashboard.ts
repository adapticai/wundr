'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import useSWRMutation from 'swr/mutation';

import { toast } from './use-toast';

// =============================================================================
// Types
// =============================================================================

/**
 * Health status for a service or component
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Alert severity levels for health dashboard
 */
export type HealthAlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Time range options for health metrics
 */
export type HealthTimeRange = '1h' | '24h' | '7d' | '30d';

/**
 * System-wide health overview
 */
export interface SystemHealthOverview {
  /** Overall system status */
  status: HealthStatus;
  /** Total number of orchestrators */
  totalOrchestrators: number;
  /** Number of healthy orchestrators */
  healthyOrchestrators: number;
  /** Number of degraded orchestrators */
  degradedOrchestrators: number;
  /** Number of unhealthy orchestrators */
  unhealthyOrchestrators: number;
  /** Active alerts count */
  activeAlerts: number;
  /** Critical alerts count */
  criticalAlerts: number;
  /** Average response time in ms */
  avgResponseTime: number;
  /** Uptime percentage (0-100) */
  uptime: number;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Orchestrator health status
 */
export interface OrchestratorHealth {
  /** Orchestrator ID */
  id: string;
  /** Orchestrator name/title */
  name: string;
  /** Health status */
  status: HealthStatus;
  /** Response time in ms */
  responseTime: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Active tasks count */
  activeTasks: number;
  /** Success rate percentage (0-100) */
  successRate: number;
  /** Error count in last 24h */
  errorCount: number;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Uptime percentage (0-100) */
  uptime: number;
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Orchestrator health filters
 */
export interface OrchestratorHealthFilters {
  /** Filter by status */
  status?: HealthStatus;
  /** Current page number */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: 'name' | 'status' | 'responseTime' | 'uptime';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Metrics chart data point
 */
export interface MetricDataPoint {
  /** Timestamp */
  timestamp: string;
  /** Response time in ms */
  responseTime: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage percentage */
  memoryUsage: number;
  /** Request count */
  requestCount: number;
  /** Error count */
  errorCount: number;
  /** Success rate percentage */
  successRate: number;
}

/**
 * Chart-compatible data format for recharts
 */
export interface ChartDataPoint {
  /** Formatted timestamp for display */
  time: string;
  /** Response time in ms */
  responseTime: number;
  /** CPU usage percentage */
  cpu: number;
  /** Memory usage percentage */
  memory: number;
  /** Request count */
  requests: number;
  /** Error count */
  errors: number;
  /** Success rate percentage */
  success: number;
}

/**
 * Health alert
 */
export interface HealthAlert {
  /** Alert ID */
  id: string;
  /** Orchestrator ID (if applicable) */
  orchestratorId?: string;
  /** Orchestrator name (if applicable) */
  orchestratorName?: string;
  /** Alert severity */
  severity: HealthAlertSeverity;
  /** Alert title */
  title: string;
  /** Alert message/description */
  message: string;
  /** Alert type/category */
  type: string;
  /** Whether alert is acknowledged */
  acknowledged: boolean;
  /** Alert created timestamp */
  createdAt: Date;
  /** Alert acknowledged timestamp */
  acknowledgedAt?: Date;
  /** Alert acknowledged by user ID */
  acknowledgedBy?: string;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Paginated API response
 */
interface PaginatedApiResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Fetcher Functions
// =============================================================================

/**
 * Generic fetcher for GET requests
 */
async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `Request failed: ${response.status} ${response.statusText}`
    );
  }

  const result: ApiResponse<T> = await response.json();
  return result.data;
}

/**
 * Build query string from filters
 */
function buildFilterQueryString(filters: OrchestratorHealthFilters): string {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.page !== undefined) {
    params.set('page', String(filters.page));
  }
  if (filters.limit !== undefined) {
    params.set('limit', String(filters.limit));
  }
  if (filters.sortBy) {
    params.set('sortBy', filters.sortBy);
  }
  if (filters.sortOrder) {
    params.set('sortOrder', filters.sortOrder);
  }

  return params.toString();
}

// =============================================================================
// SWR Configuration
// =============================================================================

/**
 * Default SWR configuration for health data (auto-refresh every 30s)
 */
const DEFAULT_HEALTH_CONFIG: SWRConfiguration = {
  refreshInterval: 30000, // Poll every 30 seconds
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
};

/**
 * SWR configuration for metrics (less frequent updates)
 */
const METRICS_CONFIG: SWRConfiguration = {
  refreshInterval: 60000, // Poll every minute
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 10000,
};

// =============================================================================
// useHealthDashboard Hook
// =============================================================================

/**
 * Return type for the useHealthDashboard hook
 */
export interface UseHealthDashboardReturn {
  /** System health overview, or null if not loaded */
  overview: SystemHealthOverview | null;
  /** Whether the overview is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Function to manually refetch the overview */
  refetch: () => void;
  /** Whether the data is being revalidated in the background */
  isValidating: boolean;
}

/**
 * Hook for fetching system health overview with real-time updates
 *
 * Automatically polls every 30 seconds to keep health data current.
 * Displays error toast notifications on fetch failures.
 *
 * @returns System health overview and loading state
 *
 * @example
 * ```tsx
 * function HealthDashboard() {
 *   const { overview, isLoading, error, refetch } = useHealthDashboard();
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h2>System Health</h2>
 *       <p>Status: {overview?.status}</p>
 *       <p>Healthy Orchestrators: {overview?.healthyOrchestrators} / {overview?.totalOrchestrators}</p>
 *       <p>Active Alerts: {overview?.activeAlerts}</p>
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useHealthDashboard(): UseHealthDashboardReturn {
  const url = '/api/admin/health';

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<SystemHealthOverview>(url, fetcher, {
      ...DEFAULT_HEALTH_CONFIG,
      onError: err => {
        toast({
          variant: 'destructive',
          title: 'Failed to load health overview',
          description:
            err instanceof Error
              ? err.message
              : 'Unable to fetch system health data',
        });
      },
    });

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    overview: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
    isValidating,
  };
}

// =============================================================================
// useOrchestratorHealth Hook
// =============================================================================

/**
 * Return type for the useOrchestratorHealthList hook
 */
export interface UseOrchestratorHealthListReturn {
  /** List of orchestrator health statuses */
  orchestrators: OrchestratorHealth[];
  /** Total count of orchestrators */
  total: number;
  /** Whether the data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Pagination metadata */
  pagination: PaginationMetadata | null;
  /** Function to manually refetch the data */
  refetch: () => void;
  /** Whether the data is being revalidated in the background */
  isValidating: boolean;
}

/**
 * Hook for fetching orchestrator health statuses with pagination and filtering
 *
 * Automatically polls every 30 seconds for real-time updates.
 * Supports pagination, status filtering, and sorting.
 *
 * @param filters - Optional filters for status, pagination, and sorting
 * @returns Orchestrator health list and loading state
 *
 * @example
 * ```tsx
 * function OrchestratorHealthList() {
 *   const { orchestrators, total, isLoading, pagination } = useOrchestratorHealthList({
 *     status: 'degraded',
 *     page: 1,
 *     limit: 20,
 *     sortBy: 'responseTime',
 *     sortOrder: 'desc'
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h3>Degraded Orchestrators ({total})</h3>
 *       {orchestrators.map(orch => (
 *         <HealthCard key={orch.id} orchestrator={orch} />
 *       ))}
 *       <Pagination {...pagination} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useOrchestratorHealthList(
  filters: OrchestratorHealthFilters = {}
): UseOrchestratorHealthListReturn {
  const queryString = useMemo(() => buildFilterQueryString(filters), [filters]);
  const url = queryString
    ? `/api/admin/health/orchestrators?${queryString}`
    : '/api/admin/health/orchestrators';

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    PaginatedApiResponse<OrchestratorHealth>
  >(
    url,
    async (url: string) => {
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `Request failed: ${response.status} ${response.statusText}`
        );
      }

      return response.json();
    },
    {
      ...DEFAULT_HEALTH_CONFIG,
      onError: err => {
        toast({
          variant: 'destructive',
          title: 'Failed to load orchestrator health',
          description:
            err instanceof Error
              ? err.message
              : 'Unable to fetch orchestrator health data',
        });
      },
    }
  );

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    orchestrators: data?.data ?? [],
    total: data?.pagination?.totalCount ?? 0,
    isLoading,
    error: error ?? null,
    pagination: data?.pagination ?? null,
    refetch,
    isValidating,
  };
}

// =============================================================================
// useMetricsChart Hook
// =============================================================================

/**
 * Return type for the useMetricsChart hook
 */
export interface UseMetricsChartReturn {
  /** Chart-compatible data points */
  chartData: ChartDataPoint[];
  /** Whether the data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Current time range */
  timeRange: HealthTimeRange;
  /** Function to change the time range */
  setTimeRange: (range: HealthTimeRange) => void;
  /** Function to manually refetch the data */
  refetch: () => void;
}

/**
 * Hook for fetching and transforming metrics data for charts
 *
 * Fetches metrics based on selected time range and transforms data
 * for recharts compatibility. Auto-refreshes every minute.
 *
 * @param initialTimeRange - Initial time range (default: '24h')
 * @returns Chart data and time range controls
 *
 * @example
 * ```tsx
 * function MetricsChart() {
 *   const { chartData, isLoading, timeRange, setTimeRange } = useMetricsChart('24h');
 *
 *   return (
 *     <div>
 *       <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as HealthTimeRange)}>
 *         <option value="1h">Last Hour</option>
 *         <option value="24h">Last 24 Hours</option>
 *         <option value="7d">Last 7 Days</option>
 *         <option value="30d">Last 30 Days</option>
 *       </select>
 *       {isLoading ? (
 *         <Spinner />
 *       ) : (
 *         <LineChart data={chartData}>
 *           <Line dataKey="responseTime" stroke="#8884d8" />
 *           <Line dataKey="cpu" stroke="#82ca9d" />
 *           <Line dataKey="memory" stroke="#ffc658" />
 *         </LineChart>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMetricsChart(
  initialTimeRange: HealthTimeRange = '24h'
): UseMetricsChartReturn {
  const [timeRange, setTimeRange] = useState<HealthTimeRange>(initialTimeRange);
  const url = `/api/admin/health/metrics?timeRange=${timeRange}`;

  const { data, error, isLoading, mutate } = useSWR<MetricDataPoint[]>(
    url,
    fetcher,
    {
      ...METRICS_CONFIG,
      onError: err => {
        toast({
          variant: 'destructive',
          title: 'Failed to load metrics',
          description:
            err instanceof Error ? err.message : 'Unable to fetch metrics data',
        });
      },
    }
  );

  // Transform data for recharts compatibility
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data) return [];

    return data.map(point => ({
      time: formatTimestamp(point.timestamp, timeRange),
      responseTime: point.responseTime,
      cpu: point.cpuUsage,
      memory: point.memoryUsage,
      requests: point.requestCount,
      errors: point.errorCount,
      success: point.successRate,
    }));
  }, [data, timeRange]);

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    chartData,
    isLoading,
    error: error ?? null,
    timeRange,
    setTimeRange,
    refetch,
  };
}

/**
 * Format timestamp for chart display based on time range
 */
function formatTimestamp(
  timestamp: string,
  timeRange: HealthTimeRange
): string {
  const date = new Date(timestamp);

  switch (timeRange) {
    case '1h':
      // Show HH:mm for hourly data
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    case '24h':
      // Show HH:mm for daily data
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    case '7d':
      // Show Mon DD for weekly data
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    case '30d':
      // Show Mon DD for monthly data
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    default:
      return date.toLocaleString();
  }
}

// =============================================================================
// useHealthAlerts Hook
// =============================================================================

/**
 * Return type for the useHealthAlerts hook
 */
export interface UseHealthAlertsReturn {
  /** List of health alerts */
  alerts: HealthAlert[];
  /** Function to acknowledge an alert */
  acknowledgeAlert: (alertId: string) => Promise<void>;
  /** Whether the data is currently loading */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Whether a mutation is in progress */
  isMutating: boolean;
  /** Filter alerts by severity */
  filterBySeverity: (severity?: HealthAlertSeverity) => HealthAlert[];
  /** Function to manually refetch the alerts */
  refetch: () => void;
}

/**
 * Hook for fetching and managing health alerts
 *
 * Provides real-time updates of health alerts and functions to acknowledge alerts.
 * Automatically polls every 30 seconds for new alerts.
 *
 * @returns Alerts list and management functions
 *
 * @example
 * ```tsx
 * function AlertsPanel() {
 *   const { alerts, acknowledgeAlert, isLoading, filterBySeverity } = useHealthAlerts();
 *
 *   const criticalAlerts = filterBySeverity('critical');
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h3>Critical Alerts ({criticalAlerts.length})</h3>
 *       {criticalAlerts.map(alert => (
 *         <Alert
 *           key={alert.id}
 *           severity={alert.severity}
 *           title={alert.title}
 *           message={alert.message}
 *           acknowledged={alert.acknowledged}
 *           onAcknowledge={() => acknowledgeAlert(alert.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useHealthAlerts(): UseHealthAlertsReturn {
  const url = '/api/admin/health/alerts';

  const { data, error, isLoading, mutate } = useSWR<HealthAlert[]>(
    url,
    fetcher,
    {
      ...DEFAULT_HEALTH_CONFIG,
      onError: err => {
        toast({
          variant: 'destructive',
          title: 'Failed to load alerts',
          description:
            err instanceof Error
              ? err.message
              : 'Unable to fetch health alerts',
        });
      },
    }
  );

  // Mutation for acknowledging an alert
  const { trigger: triggerAcknowledge, isMutating } = useSWRMutation(
    url,
    async (url: string, { arg }: { arg: { alertId: string } }) => {
      const response = await fetch(
        `/api/admin/health/alerts/${arg.alertId}/acknowledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 'Failed to acknowledge alert'
        );
      }

      return response.json();
    }
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string): Promise<void> => {
      try {
        await triggerAcknowledge({ alertId });

        // Optimistically update the local data
        void mutate(
          currentData =>
            currentData?.map(alert =>
              alert.id === alertId
                ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
                : alert
            ),
          { revalidate: true }
        );

        toast({
          title: 'Alert acknowledged',
          description: 'The alert has been marked as acknowledged',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Failed to acknowledge alert',
          description: err instanceof Error ? err.message : 'An error occurred',
        });
        throw err;
      }
    },
    [triggerAcknowledge, mutate]
  );

  const filterBySeverity = useCallback(
    (severity?: HealthAlertSeverity): HealthAlert[] => {
      if (!data) return [];
      if (!severity) return data;
      return data.filter(alert => alert.severity === severity);
    },
    [data]
  );

  const refetch = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    alerts: data ?? [],
    acknowledgeAlert,
    isLoading,
    error: error ?? null,
    isMutating,
    filterBySeverity,
    refetch,
  };
}
