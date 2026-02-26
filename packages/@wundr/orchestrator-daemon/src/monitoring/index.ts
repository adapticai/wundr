/**
 * Monitoring Module
 * Exports for Prometheus metrics, structured logging, tracing,
 * health checks, alerting, retention, and monitoring functionality.
 */

// ---------------------------------------------------------------------------
// Core metrics (legacy orchestrator_* + enhanced wundr_*)
// ---------------------------------------------------------------------------

export {
  // Legacy metrics
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
  // Enhanced metric groups
  agentMetrics,
  sessionMetrics,
  memoryMetrics,
  toolMetrics,
  wsMetrics,
  modelMetrics,
  queueMetrics,
  systemMetrics,
  channelMetrics,
  pluginMetrics,
  requestSummaryMetrics,
  // Enhanced helper functions
  recordAgentSpawned,
  recordAgentCompleted,
  recordAgentFailed,
  recordModelRequest,
  recordWsConnection,
  recordWsDisconnection,
  recordWsMessageReceived,
  recordWsMessageSent,
  recordToolExecution,
  recordMemoryOperation,
  recordChannelMessageSent,
  recordChannelMessageReceived,
  recordChannelLatency,
  recordChannelError,
  recordPluginExecution,
  recordPluginError,
  recordRequestDuration,
  recordTokenUsageSummary,
  // System metrics collection
  startSystemMetricsCollection,
  stopSystemMetricsCollection,
} from './metrics';

export type {
  AgentLifecycleMetrics,
  EnhancedSessionMetrics,
  MemorySystemMetrics,
  EnhancedToolMetrics,
  WebSocketMetrics,
  ModelRoutingMetrics,
  QueueMetrics,
  SystemResourceMetrics,
  ChannelMetrics,
  PluginMetrics,
  RequestSummaryMetrics,
} from './metrics';

// ---------------------------------------------------------------------------
// Metrics collector
// ---------------------------------------------------------------------------

export { MetricsCollector, createMetricsCollector } from './collector';

export type {
  CollectorConfig,
  AggregatedStats,
  TimerFunction,
} from './collector';

// ---------------------------------------------------------------------------
// HTTP endpoint
// ---------------------------------------------------------------------------

export { MetricsServer, createMetricsServer } from './endpoint';

export type {
  HealthStatus as EndpointHealthStatus,
  HealthResponse,
  ReadinessResponse,
  HealthCheckFunction,
  HealthChecks,
  MetricsServerConfig,
} from './endpoint';

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

export {
  StructuredLogger,
  InMemoryLogWriter,
  LogLevelRegistry,
  createLogger,
  createChildLogger,
  getLogLevelRegistry,
} from './logger';

export type {
  LogLevel as StructuredLogLevel,
  LogFormat,
  LogEntry,
  LogContext,
  StructuredLoggerConfig,
  LogWriter,
} from './logger';

// ---------------------------------------------------------------------------
// Distributed tracing
// ---------------------------------------------------------------------------

export {
  Tracer,
  getTracer,
  resetTracer,
  createTracer,
  generateTraceId,
  generateSpanId,
  SpanExporter,
  createSpanExporter,
} from './tracing';

export type {
  TraceContext,
  Span,
  SpanStatus,
  SpanEvent,
  SpanOptions,
  TracingConfig,
  OTLPSpan,
  SpanExporterConfig,
} from './tracing';

// ---------------------------------------------------------------------------
// Enhanced health checks
// ---------------------------------------------------------------------------

export {
  HealthChecker,
  createHealthChecker,
  createProbe,
  createSubsystemProbe,
  healthStatusToHttpCode,
} from './health';

export type {
  HealthStatus,
  ComponentHealth,
  EnhancedHealthResponse,
  HealthMetricsSnapshot,
  HealthCheckProbe,
  HealthCheckConfig,
  DaemonStatusProvider,
} from './health';

// ---------------------------------------------------------------------------
// Alert thresholds
// ---------------------------------------------------------------------------

export { AlertManager, createAlertManager } from './alerts';

export type {
  AlertSeverity,
  AlertState,
  ComparisonOp,
  AlertThreshold,
  Alert,
  AlertManagerConfig,
} from './alerts';

// ---------------------------------------------------------------------------
// Metric retention and rollup
// ---------------------------------------------------------------------------

export { MetricRetentionStore, createRetentionStore } from './retention';

export type {
  DataPoint,
  RollupPoint,
  RetentionConfig,
  MetricTimeSeries,
  DashboardExport,
} from './retention';

// ---------------------------------------------------------------------------
// Types (legacy)
// ---------------------------------------------------------------------------

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
