/**
 * @wundr.io/agent-observability
 *
 * Observability pipeline for AI agent monitoring providing centralized logging,
 * metrics collection, sensitive data redaction, and alerting capabilities.
 *
 * @packageDocumentation
 */

// Schemas (runtime values)
export {
  LogLevelSchema,
  EventCategorySchema,
  EventMetadataSchema,
  ObservabilityEventSchema,
  LogStoreConfigSchema,
  AlertSeveritySchema,
  AlertOperatorSchema,
  AlertConditionSchema,
  AlertConfigSchema,
  TriggeredAlertSchema,
  RedactionPatternSchema,
  RedactionConfigSchema,
  MetricTypeSchema,
  MetricDefinitionSchema,
  MetricDataPointSchema,
  // Defaults (runtime values)
  DEFAULT_LOG_STORE_CONFIG,
  DEFAULT_REDACTION_CONFIG,
} from './types';

// Types (type-only exports)
export type {
  LogLevel,
  EventCategory,
  EventMetadata,
  ObservabilityEvent,
  LogStoreConfig,
  AlertSeverity,
  AlertOperator,
  AlertCondition,
  AlertConfig,
  TriggeredAlert,
  RedactionPattern,
  RedactionConfig,
  MetricType,
  MetricDefinition,
  MetricDataPoint,
  // Interfaces
  LogStore,
  LogQueryOptions,
  LogQueryResult,
  LogDeleteCriteria,
  LogStoreStatistics,
  CreateEventOptions,
  AlertNotification,
  AlertHandler,
  PipelineEventHandler,
  PipelineEventType,
  MetricAggregation,
} from './types';

// Pipeline
export { ObservabilityPipeline, createObservabilityPipeline } from './pipeline';

export type { ObservabilityPipelineConfig } from './pipeline';

// Redactor
export { SensitiveDataRedactor, createDefaultRedactor } from './redactor';

export type { RedactionResult } from './redactor';

// Metrics Collector
export { MetricsCollector, createMetricsCollector } from './metrics-collector';

export type { MetricsCollectorConfig } from './metrics-collector';

// Alert Manager
export {
  AlertManager,
  createAlertManager,
  CommonAlerts,
} from './alert-manager';

export type { AlertManagerConfig } from './alert-manager';
