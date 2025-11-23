/**
 * @wundr.io/agent-observability - Type Definitions
 *
 * TypeScript interfaces for the observability pipeline.
 * Defines structures for events, log stores, alerts, metrics, and redaction.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for log levels
 */
export const LogLevelSchema = z.enum([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
]);

/**
 * Schema for event categories
 */
export const EventCategorySchema = z.enum([
  'agent',
  'task',
  'memory',
  'llm',
  'tool',
  'system',
  'security',
  'performance',
  'user',
  'custom',
]);

/**
 * Schema for observability event metadata
 */
export const EventMetadataSchema = z.object({
  /** Agent ID associated with the event */
  agentId: z.string().optional(),
  /** Task ID associated with the event */
  taskId: z.string().optional(),
  /** Session ID for cross-event correlation */
  sessionId: z.string().optional(),
  /** Trace ID for distributed tracing */
  traceId: z.string().optional(),
  /** Span ID for nested operations */
  spanId: z.string().optional(),
  /** Parent span ID */
  parentSpanId: z.string().optional(),
  /** Environment identifier */
  environment: z.string().optional(),
  /** Service name */
  service: z.string().optional(),
  /** Host identifier */
  host: z.string().optional(),
  /** Custom labels */
  labels: z.record(z.string()).default({}),
  /** Custom attributes */
  attributes: z.record(z.unknown()).default({}),
});

/**
 * Schema for observability events
 */
export const ObservabilityEventSchema = z.object({
  /** Unique event identifier */
  id: z.string().uuid(),
  /** Event timestamp */
  timestamp: z.date(),
  /** Log level */
  level: LogLevelSchema,
  /** Event category */
  category: EventCategorySchema,
  /** Event message */
  message: z.string(),
  /** Event metadata */
  metadata: EventMetadataSchema,
  /** Event payload data */
  data: z.record(z.unknown()).default({}),
  /** Error information if applicable */
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  /** Duration in milliseconds for timed events */
  durationMs: z.number().nonnegative().optional(),
  /** Whether this event has been redacted */
  redacted: z.boolean().default(false),
  /** Fields that were redacted */
  redactedFields: z.array(z.string()).default([]),
});

/**
 * Schema for log store configuration
 */
export const LogStoreConfigSchema = z.object({
  /** Maximum number of events to store in memory */
  maxEvents: z.number().positive().default(10000),
  /** Time-to-live for events in milliseconds */
  ttlMs: z.number().positive().optional(),
  /** Enable persistence to disk */
  persistenceEnabled: z.boolean().default(false),
  /** Path for persistent storage */
  persistencePath: z.string().optional(),
  /** Flush interval in milliseconds */
  flushIntervalMs: z.number().positive().default(5000),
  /** Compression enabled for storage */
  compressionEnabled: z.boolean().default(false),
  /** Batch size for persistence operations */
  batchSize: z.number().positive().default(100),
});

/**
 * Schema for alert severity levels
 */
export const AlertSeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

/**
 * Schema for alert condition operators
 */
export const AlertOperatorSchema = z.enum([
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq',
  'contains',
  'matches',
]);

/**
 * Schema for alert conditions
 */
export const AlertConditionSchema = z.object({
  /** Metric or field to evaluate */
  field: z.string(),
  /** Comparison operator */
  operator: AlertOperatorSchema,
  /** Threshold value */
  threshold: z.union([z.number(), z.string()]),
  /** Evaluation window in milliseconds */
  windowMs: z.number().positive().default(60000),
  /** Minimum occurrences before triggering */
  minOccurrences: z.number().positive().default(1),
});

/**
 * Schema for alert configuration
 */
export const AlertConfigSchema = z.object({
  /** Unique alert identifier */
  id: z.string(),
  /** Alert name */
  name: z.string(),
  /** Alert description */
  description: z.string().optional(),
  /** Alert severity */
  severity: AlertSeveritySchema,
  /** Whether alert is enabled */
  enabled: z.boolean().default(true),
  /** Event categories to monitor */
  categories: z.array(EventCategorySchema).optional(),
  /** Log levels to monitor */
  levels: z.array(LogLevelSchema).optional(),
  /** Alert conditions (all must be met) */
  conditions: z.array(AlertConditionSchema),
  /** Cooldown period in milliseconds */
  cooldownMs: z.number().positive().default(300000),
  /** Notification channels */
  notificationChannels: z.array(z.string()).default([]),
  /** Custom metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for triggered alerts
 */
export const TriggeredAlertSchema = z.object({
  /** Unique triggered alert ID */
  id: z.string().uuid(),
  /** Reference to alert config */
  alertId: z.string(),
  /** When the alert was triggered */
  triggeredAt: z.date(),
  /** Alert severity */
  severity: AlertSeveritySchema,
  /** Alert message */
  message: z.string(),
  /** Triggering event IDs */
  triggeringEventIds: z.array(z.string()),
  /** Alert state */
  state: z.enum(['active', 'acknowledged', 'resolved']),
  /** When the alert was acknowledged */
  acknowledgedAt: z.date().optional(),
  /** Who acknowledged the alert */
  acknowledgedBy: z.string().optional(),
  /** When the alert was resolved */
  resolvedAt: z.date().optional(),
  /** Resolution notes */
  resolutionNotes: z.string().optional(),
  /** Alert metadata */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Schema for redaction patterns
 */
export const RedactionPatternSchema = z.object({
  /** Pattern name */
  name: z.string(),
  /** Regular expression pattern */
  pattern: z.string(),
  /** Replacement string */
  replacement: z.string().default('[REDACTED]'),
  /** Fields to apply this pattern to (empty = all) */
  fields: z.array(z.string()).default([]),
  /** Whether pattern is enabled */
  enabled: z.boolean().default(true),
});

/**
 * Schema for redaction configuration
 */
export const RedactionConfigSchema = z.object({
  /** Enable redaction */
  enabled: z.boolean().default(true),
  /** Redaction patterns */
  patterns: z.array(RedactionPatternSchema).default([]),
  /** Fields to always redact */
  sensitiveFields: z.array(z.string()).default([]),
  /** Preserve original value hash for verification */
  preserveHash: z.boolean().default(false),
  /** Hash algorithm for preserved hashes */
  hashAlgorithm: z.enum(['sha256', 'sha512', 'md5']).default('sha256'),
});

/**
 * Schema for metric types
 */
export const MetricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary',
]);

/**
 * Schema for metric definitions
 */
export const MetricDefinitionSchema = z.object({
  /** Metric name */
  name: z.string(),
  /** Metric type */
  type: MetricTypeSchema,
  /** Metric description */
  description: z.string().optional(),
  /** Unit of measurement */
  unit: z.string().optional(),
  /** Labels for dimensional data */
  labels: z.array(z.string()).default([]),
  /** Histogram buckets (for histogram type) */
  buckets: z.array(z.number()).optional(),
  /** Summary quantiles (for summary type) */
  quantiles: z.array(z.number()).optional(),
});

/**
 * Schema for metric data points
 */
export const MetricDataPointSchema = z.object({
  /** Metric name */
  name: z.string(),
  /** Metric value */
  value: z.number(),
  /** Timestamp */
  timestamp: z.date(),
  /** Label values */
  labels: z.record(z.string()).default({}),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

/**
 * Log severity level
 */
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Event category for classification
 */
export type EventCategory = z.infer<typeof EventCategorySchema>;

/**
 * Metadata attached to observability events
 */
export type EventMetadata = z.infer<typeof EventMetadataSchema>;

/**
 * An observability event in the pipeline
 */
export type ObservabilityEvent = z.infer<typeof ObservabilityEventSchema>;

/**
 * Configuration for the log store
 */
export type LogStoreConfig = z.infer<typeof LogStoreConfigSchema>;

/**
 * Alert severity level
 */
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

/**
 * Alert condition operator
 */
export type AlertOperator = z.infer<typeof AlertOperatorSchema>;

/**
 * Alert condition definition
 */
export type AlertCondition = z.infer<typeof AlertConditionSchema>;

/**
 * Alert configuration
 */
export type AlertConfig = z.infer<typeof AlertConfigSchema>;

/**
 * A triggered alert instance
 */
export type TriggeredAlert = z.infer<typeof TriggeredAlertSchema>;

/**
 * Redaction pattern definition
 */
export type RedactionPattern = z.infer<typeof RedactionPatternSchema>;

/**
 * Redaction configuration
 */
export type RedactionConfig = z.infer<typeof RedactionConfigSchema>;

/**
 * Metric type
 */
export type MetricType = z.infer<typeof MetricTypeSchema>;

/**
 * Metric definition
 */
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

/**
 * Metric data point
 */
export type MetricDataPoint = z.infer<typeof MetricDataPointSchema>;

// ============================================================================
// Additional Types (Not Schema-Validated)
// ============================================================================

/**
 * Log store interface for different storage backends
 */
export interface LogStore {
  /** Store an event */
  store(event: ObservabilityEvent): Promise<void>;
  /** Retrieve events by query */
  query(options: LogQueryOptions): Promise<LogQueryResult>;
  /** Get event by ID */
  get(id: string): Promise<ObservabilityEvent | null>;
  /** Delete events by criteria */
  delete(criteria: LogDeleteCriteria): Promise<number>;
  /** Clear all events */
  clear(): Promise<void>;
  /** Get store statistics */
  getStatistics(): Promise<LogStoreStatistics>;
  /** Flush pending events */
  flush(): Promise<void>;
  /** Close the store */
  close(): Promise<void>;
}

/**
 * Options for querying logs
 */
export interface LogQueryOptions {
  /** Start time for query range */
  startTime?: Date;
  /** End time for query range */
  endTime?: Date;
  /** Log levels to include */
  levels?: LogLevel[];
  /** Categories to include */
  categories?: EventCategory[];
  /** Search query string */
  query?: string;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Filter by session ID */
  sessionId?: string;
  /** Filter by trace ID */
  traceId?: string;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Sort field */
  sortBy?: 'timestamp' | 'level' | 'category';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Filter by labels */
  labels?: Record<string, string>;
}

/**
 * Result of a log query
 */
export interface LogQueryResult {
  /** Retrieved events */
  events: ObservabilityEvent[];
  /** Total matching events */
  totalCount: number;
  /** Whether results were truncated */
  hasMore: boolean;
  /** Query execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Criteria for deleting logs
 */
export interface LogDeleteCriteria {
  /** Delete events before this time */
  beforeTime?: Date;
  /** Delete events with these IDs */
  ids?: string[];
  /** Delete events from these categories */
  categories?: EventCategory[];
  /** Delete events with these levels */
  levels?: LogLevel[];
}

/**
 * Log store statistics
 */
export interface LogStoreStatistics {
  /** Total events stored */
  totalEvents: number;
  /** Events by level */
  eventsByLevel: Record<LogLevel, number>;
  /** Events by category */
  eventsByCategory: Record<EventCategory, number>;
  /** Oldest event timestamp */
  oldestEvent: Date | null;
  /** Newest event timestamp */
  newestEvent: Date | null;
  /** Storage size in bytes */
  storageSizeBytes: number;
  /** Pending events awaiting flush */
  pendingFlush: number;
}

/**
 * Options for creating an event
 */
export interface CreateEventOptions {
  /** Log level */
  level: LogLevel;
  /** Event category */
  category: EventCategory;
  /** Event message */
  message: string;
  /** Event metadata */
  metadata?: Partial<EventMetadata>;
  /** Event data payload */
  data?: Record<string, unknown>;
  /** Error information */
  error?:
    | Error
    | { name: string; message: string; stack?: string; code?: string };
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Alert notification payload
 */
export interface AlertNotification {
  /** Alert information */
  alert: TriggeredAlert;
  /** Alert configuration */
  config: AlertConfig;
  /** Triggering events */
  events: ObservabilityEvent[];
}

/**
 * Alert handler function type
 */
export type AlertHandler = (
  notification: AlertNotification
) => void | Promise<void>;

/**
 * Event handler for pipeline events
 */
export type PipelineEventHandler = (
  event: ObservabilityEvent
) => void | Promise<void>;

/**
 * Pipeline event types
 */
export type PipelineEventType =
  | 'event:received'
  | 'event:processed'
  | 'event:stored'
  | 'event:redacted'
  | 'alert:triggered'
  | 'alert:acknowledged'
  | 'alert:resolved'
  | 'metric:recorded'
  | 'pipeline:started'
  | 'pipeline:stopped'
  | 'pipeline:error';

/**
 * Aggregation result for metrics
 */
export interface MetricAggregation {
  /** Metric name */
  name: string;
  /** Aggregation type */
  aggregationType:
    | 'sum'
    | 'avg'
    | 'min'
    | 'max'
    | 'count'
    | 'p50'
    | 'p90'
    | 'p95'
    | 'p99';
  /** Aggregated value */
  value: number;
  /** Start of aggregation window */
  windowStart: Date;
  /** End of aggregation window */
  windowEnd: Date;
  /** Label values */
  labels: Record<string, string>;
  /** Number of data points in aggregation */
  dataPointCount: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_LOG_STORE_CONFIG: LogStoreConfig = {
  maxEvents: 10000,
  ttlMs: 86400000, // 24 hours
  persistenceEnabled: false,
  flushIntervalMs: 5000,
  compressionEnabled: false,
  batchSize: 100,
};

export const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  enabled: true,
  patterns: [
    {
      name: 'api_key',
      pattern:
        '(?i)(api[_-]?key|apikey)[\\s]*[:=][\\s]*["\']?([a-zA-Z0-9_-]{20,})["\']?',
      replacement: '$1=[REDACTED]',
      fields: [],
      enabled: true,
    },
    {
      name: 'password',
      pattern:
        '(?i)(password|passwd|pwd)[\\s]*[:=][\\s]*["\']?([^\\s"\']+)["\']?',
      replacement: '$1=[REDACTED]',
      fields: [],
      enabled: true,
    },
    {
      name: 'bearer_token',
      pattern: '(?i)bearer[\\s]+([a-zA-Z0-9_.-]+)',
      replacement: 'Bearer [REDACTED]',
      fields: [],
      enabled: true,
    },
    {
      name: 'credit_card',
      pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b',
      replacement: '[REDACTED_CC]',
      fields: [],
      enabled: true,
    },
    {
      name: 'email',
      pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      replacement: '[REDACTED_EMAIL]',
      fields: [],
      enabled: true,
    },
    {
      name: 'ssn',
      pattern: '\\b\\d{3}[- ]?\\d{2}[- ]?\\d{4}\\b',
      replacement: '[REDACTED_SSN]',
      fields: [],
      enabled: true,
    },
  ],
  sensitiveFields: [
    'password',
    'secret',
    'token',
    'apiKey',
    'api_key',
    'authorization',
  ],
  preserveHash: false,
  hashAlgorithm: 'sha256',
};
