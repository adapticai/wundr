/**
 * Orchestrator Analytics Validation Schemas
 * @module lib/validations/orchestrator-analytics
 */

import { z } from 'zod';

export const ORCHESTRATOR_ANALYTICS_ERROR_CODES = {
  INVALID_METRIC: 'ANALYTICS_INVALID_METRIC',
  INVALID_TIME_RANGE: 'ANALYTICS_INVALID_TIME_RANGE',
  AGGREGATION_FAILED: 'ANALYTICS_AGGREGATION_FAILED',
  DATA_NOT_FOUND: 'ANALYTICS_DATA_NOT_FOUND',
  UNAUTHORIZED: 'ANALYTICS_UNAUTHORIZED',
  VALIDATION_ERROR: 'ANALYTICS_VALIDATION_ERROR',
  WORKSPACE_NOT_FOUND: 'ANALYTICS_WORKSPACE_NOT_FOUND',
  INTERNAL_ERROR: 'ANALYTICS_INTERNAL_ERROR',
  NOT_FOUND: 'ANALYTICS_NOT_FOUND',
} as const;

export type OrchestratorAnalyticsErrorCode =
  (typeof ORCHESTRATOR_ANALYTICS_ERROR_CODES)[keyof typeof ORCHESTRATOR_ANALYTICS_ERROR_CODES];

/**
 * Create a standardized analytics error response
 */
export function createAnalyticsErrorResponse(
  message: string,
  code: OrchestratorAnalyticsErrorCode,
  extraData?: Record<string, unknown>,
): {
  error: OrchestratorAnalyticsErrorCode;
  message: string;
} & Record<string, unknown> {
  return { error: code, message, ...extraData };
}

export const analyticsMetricSchema = z.enum([
  'task_completion_rate',
  'average_task_duration',
  'agent_utilization',
  'error_rate',
  'token_usage',
  'cost',
  'throughput',
]);

export type AnalyticsMetric = z.infer<typeof analyticsMetricSchema>;

export const analyticsTimeRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
});

export type AnalyticsTimeRange = z.infer<typeof analyticsTimeRangeSchema>;

export const analyticsQuerySchema = z.object({
  metrics: z.array(analyticsMetricSchema),
  timeRange: analyticsTimeRangeSchema,
  filters: z.record(z.unknown()).optional(),
  groupBy: z.array(z.string()).optional(),
});

export const analyticsDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  metric: analyticsMetricSchema,
  value: z.number(),
  dimensions: z.record(z.string()).optional(),
});

export const analyticsReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  query: analyticsQuerySchema,
  data: z.array(analyticsDataPointSchema),
  generatedAt: z.string().datetime(),
  summary: z.record(z.unknown()).optional(),
});

/**
 * Date range schema with preset options
 */
export const analyticsDateRangeSchema = z.union([
  z.object({
    preset: z.enum([
      'today',
      'yesterday',
      'last7days',
      'last30days',
      'lastMonth',
      'custom',
    ]),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }),
  z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
    preset: z.literal('custom').optional(),
  }),
]);

export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRangeSchema>;

/**
 * Anomaly detection query schema
 */
export const anomalyDetectionQuerySchema = z.object({
  metric: analyticsMetricSchema,
  timeRange: analyticsTimeRangeSchema,
  sensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  threshold: z.number().min(0).max(1).optional(),
  timeWindow: z.enum(['24h', '7d', '30d']).optional(), // Time window for anomaly detection
  minSeverity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(), // Minimum severity level to report
});

export type AnomalyDetectionQueryInput = z.infer<
  typeof anomalyDetectionQuerySchema
>;

/**
 * Observability dashboard query schema
 */
export const observabilityDashboardQuerySchema = z.object({
  timeRange: analyticsTimeRangeSchema,
  metrics: z.array(analyticsMetricSchema).optional(),
  includeAlerts: z.boolean().default(true),
  includeAnomalies: z.boolean().default(true),
  includeTaskDetails: z.boolean().default(true),
  statusFilter: z
    .array(z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']))
    .optional(),
  refreshInterval: z.number().min(5000).optional(), // milliseconds
});

export type ObservabilityDashboardQueryInput = z.infer<
  typeof observabilityDashboardQuerySchema
>;

/**
 * Orchestrator analytics query schema
 */
export const orchestratorAnalyticsQuerySchema = z.object({
  orchestratorId: z.string(),
  metrics: z.array(analyticsMetricSchema),
  timeRange: analyticsTimeRangeSchema,
  aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional(),
  groupBy: z.array(z.string()).optional(),
});

export type OrchestratorAnalyticsQueryInput = z.infer<
  typeof orchestratorAnalyticsQuerySchema
>;

/**
 * Orchestrator comparison query schema
 */
export const orchestratorComparisonQuerySchema = z.object({
  orchestratorIds: z.array(z.string()).min(2).max(10),
  metrics: z.array(analyticsMetricSchema),
  timeRange: analyticsTimeRangeSchema,
  normalization: z.enum(['none', 'percentage', 'zscore']).default('none'),
});

export type OrchestratorComparisonQueryInput = z.infer<
  typeof orchestratorComparisonQuerySchema
>;

/**
 * Orchestrator trends query schema
 */
export const orchestratorTrendsQuerySchema = z.object({
  orchestratorId: z.string().optional(),
  metric: analyticsMetricSchema,
  timeRange: analyticsTimeRangeSchema,
  trendType: z
    .enum(['linear', 'exponential', 'moving_average'])
    .default('linear'),
  forecastPeriods: z.number().min(1).max(30).optional(),
});

export type OrchestratorTrendsQueryInput = z.infer<
  typeof orchestratorTrendsQuerySchema
>;

/**
 * Record observability event schema
 */
export const recordObservabilityEventSchema = z.object({
  eventType: z.enum([
    'status_change',
    'task_started',
    'task_completed',
    'task_failed',
    'error',
    'warning',
    'info',
    'debug',
    'alert',
  ]),
  message: z.string(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  severity: z
    .enum(['critical', 'high', 'medium', 'low', 'info'])
    .default('info'),
  orchestratorId: z.string().optional(),
  taskId: z.string().optional(),
  channelId: z.string().optional(),
});

export type RecordObservabilityEventInput = z.infer<
  typeof recordObservabilityEventSchema
>;

/**
 * Record quality feedback schema
 */
export const recordQualityFeedbackSchema = z.object({
  taskId: z.string(),
  orchestratorId: z.string(),
  rating: z.number().min(1).max(5),
  feedbackType: z.enum([
    'accuracy',
    'performance',
    'reliability',
    'usability',
    'general',
  ]),
  comment: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type RecordQualityFeedbackInput = z.infer<
  typeof recordQualityFeedbackSchema
>;

/**
 * Parse date range preset or custom range into actual start and end dates
 */
export function parseDateRange(input: AnalyticsDateRangeInput): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);

  // If custom dates are provided, use them
  if ('start' in input && input.start && 'end' in input && input.end) {
    return {
      start: new Date(input.start),
      end: new Date(input.end),
    };
  }

  // Otherwise use preset
  const preset = 'preset' in input ? input.preset : 'last7days';

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last30days':
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      // Custom requires start/end, handled above
      break;
    default:
      // Default to last 7 days
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}
