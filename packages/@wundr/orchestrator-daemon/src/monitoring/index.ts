/**
 * Monitoring Module
 * Exports for Prometheus metrics and monitoring functionality
 */

// Core metrics
export {
  daemonMetrics,
  MetricsRegistry,
  metricsRegistry,
  recordSessionActive,
  recordTokensUsed,
  recordMessageLatency,
  recordToolInvocation,
  recordFederationDelegation,
  recordNodeLoad,
  recordError,
  recordBudgetUtilization,
} from './metrics';

// Metrics collector
export {
  MetricsCollector,
  createMetricsCollector,
} from './collector';

export type {
  CollectorConfig,
  AggregatedStats,
  TimerFunction,
} from './collector';

// HTTP endpoint
export {
  MetricsServer,
  createMetricsServer,
} from './endpoint';

export type {
  HealthStatus,
  HealthResponse,
  ReadinessResponse,
  HealthCheckFunction,
  HealthChecks,
  MetricsServerConfig,
} from './endpoint';

// Types
export type {
  DaemonMetrics,
  IMetricsRegistry,
  SessionLabels,
  TokenLabels,
  LatencyLabels,
  ToolLabels,
  FederationLabels,
  NodeLabels,
  ErrorLabels,
  BudgetLabels,
  MetricConfig,
  CollectedMetrics,
} from './types';
