/**
 * Health Dashboard Types
 *
 * Type definitions for the Neolith observability and monitoring dashboard.
 * Provides comprehensive health metrics, status tracking, and alerting.
 */

/**
 * Token usage overview across different time periods
 */
export interface TokenUsageOverview {
  /** Tokens used in the current hour */
  hourly: number;
  /** Tokens used in the current day */
  daily: number;
  /** Tokens used in the current month */
  monthly: number;
  /** Total token limit/budget */
  limit: number;
  /** Percentage of limit used (0-100) */
  percentUsed: number;
}

/**
 * System-wide overview metrics
 */
export interface SystemOverview {
  /** Number of currently active orchestrators */
  activeOrchestrators: number;
  /** Total number of active sessions across all orchestrators */
  totalSessions: number;
  /** Aggregate token usage across all orchestrators */
  tokenUsage: TokenUsageOverview;
  /** System-wide error rate as a percentage (0-100) */
  errorRate: number;
  /** System uptime in milliseconds */
  uptime: number;
}

/**
 * Health status for a single orchestrator instance
 */
export interface OrchestratorHealthStatus {
  /** Unique orchestrator identifier */
  id: string;
  /** Human-readable orchestrator name */
  name: string;
  /** Current operational status */
  status: 'online' | 'offline' | 'error' | 'degraded';
  /** Number of active sessions managed by this orchestrator */
  sessions: number;
  /** Token budget tracking */
  tokenBudget: {
    /** Tokens consumed */
    used: number;
    /** Total token limit */
    limit: number;
    /** Percentage used (0-100) */
    percent: number;
  };
  /** ISO timestamp of last recorded activity */
  lastActivity: string;
  /** Average response time in milliseconds */
  responseTime: number;
  /** Number of errors in current period */
  errorCount: number;
}

/**
 * Single data point in a time series
 */
export interface TimeSeriesMetric {
  /** ISO timestamp for this metric */
  timestamp: string;
  /** Metric value at this timestamp */
  value: number;
}

/**
 * Latency percentile metrics over time
 */
export interface LatencyMetrics {
  /** 50th percentile (median) latency */
  p50: TimeSeriesMetric[];
  /** 95th percentile latency */
  p95: TimeSeriesMetric[];
  /** 99th percentile latency */
  p99: TimeSeriesMetric[];
}

/**
 * Time series data for dashboard charts
 */
export interface MetricsChartData {
  /** Session count over time */
  sessions: TimeSeriesMetric[];
  /** Token usage over time */
  tokens: TimeSeriesMetric[];
  /** Latency percentiles over time */
  latency: LatencyMetrics;
  /** Error count over time */
  errors: TimeSeriesMetric[];
}

/**
 * Alert types for health monitoring
 */
export type HealthAlertType =
  | 'budget_exhaustion' // Token budget near or at limit
  | 'high_error_rate' // Error rate exceeds threshold
  | 'session_failure' // Session creation or management failure
  | 'latency_spike' // Response time significantly increased
  | 'node_unhealthy'; // Orchestrator node is unhealthy

/**
 * Alert severity levels
 */
export type AlertSeverity =
  | 'info' // Informational, no action required
  | 'warning' // Warning, may require attention
  | 'critical'; // Critical, immediate action required

/**
 * Health alert notification
 */
export interface HealthAlert {
  /** Unique alert identifier */
  id: string;
  /** Type of health issue detected */
  type: HealthAlertType;
  /** Severity level of the alert */
  severity: AlertSeverity;
  /** Human-readable alert message */
  message: string;
  /** Associated orchestrator ID, if applicable */
  orchestratorId?: string;
  /** ISO timestamp when alert was created */
  timestamp: string;
  /** Whether the alert has been acknowledged */
  acknowledged: boolean;
}

/**
 * Dashboard refresh configuration
 */
export interface DashboardConfig {
  /** Auto-refresh interval in milliseconds */
  refreshInterval: number;
  /** Time range for historical metrics (in milliseconds) */
  timeRange: number;
  /** Maximum number of data points per chart */
  maxDataPoints: number;
  /** Alert retention period in milliseconds */
  alertRetention: number;
}

/**
 * Complete health dashboard state
 */
export interface HealthDashboardState {
  /** System-wide overview metrics */
  overview: SystemOverview;
  /** Health status for all orchestrators */
  orchestrators: OrchestratorHealthStatus[];
  /** Time series metrics for charts */
  metrics: MetricsChartData;
  /** Active alerts */
  alerts: HealthAlert[];
  /** Dashboard configuration */
  config: DashboardConfig;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Health check result for an orchestrator
 */
export interface HealthCheckResult {
  /** Orchestrator being checked */
  orchestratorId: string;
  /** Whether the health check passed */
  healthy: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Any error message if unhealthy */
  error?: string;
  /** Timestamp of the check */
  timestamp: string;
}

/**
 * Metrics aggregation period
 */
export type MetricsPeriod = 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Metrics query filter
 */
export interface MetricsQuery {
  /** Start of time range (ISO timestamp) */
  startTime: string;
  /** End of time range (ISO timestamp) */
  endTime: string;
  /** Aggregation period */
  period: MetricsPeriod;
  /** Filter by orchestrator IDs */
  orchestratorIds?: string[];
  /** Metric types to include */
  metricTypes?: Array<'sessions' | 'tokens' | 'latency' | 'errors'>;
}
