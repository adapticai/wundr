/**
 * VP Analytics Validation Schemas
 *
 * Zod validation schemas for VP analytics and observability API operations.
 * These schemas ensure type safety and input validation for all analytics endpoints.
 *
 * @module lib/validations/vp-analytics
 */

import { z } from 'zod';

/**
 * Time period for analytics aggregation
 */
export const analyticsPeriodEnum = z.enum(['daily', 'weekly', 'monthly']);
export type AnalyticsPeriodType = z.infer<typeof analyticsPeriodEnum>;

/**
 * Metric type for VP comparison
 */
export const comparisonMetricEnum = z.enum([
  'taskCompletionRate',
  'avgResponseTime',
  'qualityScore',
  'tasksCompleted',
  'errorRate',
]);
export type ComparisonMetricType = z.infer<typeof comparisonMetricEnum>;

/**
 * Anomaly severity level
 */
export const anomalySeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export type AnomalySeverityType = z.infer<typeof anomalySeverityEnum>;

/**
 * Observability event type
 */
export const observabilityEventTypeEnum = z.enum([
  'status_change',
  'task_started',
  'task_completed',
  'task_failed',
  'error',
  'warning',
  'info',
]);
export type ObservabilityEventType = z.infer<typeof observabilityEventTypeEnum>;

/**
 * Schema for analytics date range query parameters
 */
export const analyticsDateRangeSchema = z.object({
  /** Start date in ISO format */
  startDate: z
    .string()
    .datetime()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid start date format',
    ),

  /** End date in ISO format */
  endDate: z
    .string()
    .datetime()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Invalid end date format',
    ),

  /** Predefined time range */
  timeRange: z
    .enum(['24h', '7d', '30d', '90d', 'all'])
    .optional()
    .default('30d'),
});

export type AnalyticsDateRangeInput = z.infer<typeof analyticsDateRangeSchema>;

/**
 * Schema for VP performance analytics query parameters
 *
 * @example
 * ```typescript
 * const query = vpAnalyticsQuerySchema.parse({
 *   startDate: "2024-01-01T00:00:00Z",
 *   endDate: "2024-01-31T23:59:59Z",
 *   includeTaskBreakdown: true
 * });
 * ```
 */
export const vpAnalyticsQuerySchema = analyticsDateRangeSchema.extend({
  /** Include task breakdown by type */
  includeTaskBreakdown: z.coerce.boolean().optional().default(false),

  /** Include task breakdown by priority */
  includePriorityBreakdown: z.coerce.boolean().optional().default(false),

  /** Include quality metrics */
  includeQualityMetrics: z.coerce.boolean().optional().default(true),
});

export type VPAnalyticsQueryInput = z.infer<typeof vpAnalyticsQuerySchema>;

/**
 * Schema for VP trends query parameters
 */
export const vpTrendsQuerySchema = analyticsDateRangeSchema.extend({
  /** Aggregation period */
  period: analyticsPeriodEnum.default('daily'),

  /** Include comparison to previous period */
  includePreviousPeriod: z.coerce.boolean().optional().default(true),

  /** Metrics to include in trends */
  metrics: z
    .array(
      z.enum([
        'tasksCompleted',
        'avgResponseTime',
        'qualityScore',
        'errorRate',
        'activeTime',
      ]),
    )
    .optional()
    .default(['tasksCompleted', 'avgResponseTime', 'qualityScore']),
});

export type VPTrendsQueryInput = z.infer<typeof vpTrendsQuerySchema>;

/**
 * Schema for quality feedback recording
 */
export const recordQualityFeedbackSchema = z.object({
  /** Task ID that feedback is for */
  taskId: z.string().cuid('Invalid task ID'),

  /** Quality rating (1-5) */
  rating: z.number().int().min(1).max(5),

  /** Optional feedback comments */
  comments: z.string().max(2000).optional(),

  /** Feedback category */
  category: z
    .enum(['accuracy', 'timeliness', 'communication', 'quality', 'overall'])
    .default('overall'),

  /** Optional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type RecordQualityFeedbackInput = z.infer<typeof recordQualityFeedbackSchema>;

/**
 * Schema for VP comparison query parameters
 */
export const vpComparisonQuerySchema = z.object({
  /** Metric to compare by */
  metric: comparisonMetricEnum.default('taskCompletionRate'),

  /** Time range for comparison */
  timeRange: z.enum(['24h', '7d', '30d', '90d']).default('30d'),

  /** Number of top performers to return */
  limit: z.coerce.number().int().positive().max(50).default(10),

  /** Filter by discipline */
  discipline: z.string().optional(),

  /** Include inactive VPs */
  includeInactive: z.coerce.boolean().optional().default(false),

  /** Sort order */
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type VPComparisonQueryInput = z.infer<typeof vpComparisonQuerySchema>;

/**
 * Schema for anomaly detection query parameters
 */
export const anomalyDetectionQuerySchema = z.object({
  /** Threshold for anomaly detection (standard deviations) */
  threshold: z.coerce.number().positive().max(5).default(2),

  /** Time window for analysis */
  timeWindow: z.enum(['24h', '7d', '30d']).default('7d'),

  /** Minimum severity to include */
  minSeverity: anomalySeverityEnum.optional().default('low'),

  /** Include resolved anomalies */
  includeResolved: z.coerce.boolean().optional().default(false),
});

export type AnomalyDetectionQueryInput = z.infer<typeof anomalyDetectionQuerySchema>;

/**
 * Schema for recording observability events
 */
export const recordObservabilityEventSchema = z.object({
  /** VP ID (optional for workspace-level events) */
  vpId: z.string().cuid('Invalid VP ID').optional(),

  /** Event type */
  eventType: observabilityEventTypeEnum,

  /** Event message */
  message: z
    .string()
    .min(1, 'Event message is required')
    .max(1000, 'Message too long'),

  /** Event severity */
  severity: z.enum(['info', 'warning', 'error', 'critical']).default('info'),

  /** Event metadata */
  metadata: z.record(z.unknown()).optional(),

  /** Related task ID (if applicable) */
  taskId: z.string().cuid('Invalid task ID').optional(),

  /** Related channel ID (if applicable) */
  channelId: z.string().cuid('Invalid channel ID').optional(),
});

export type RecordObservabilityEventInput = z.infer<
  typeof recordObservabilityEventSchema
>;

/**
 * Schema for observability dashboard query parameters
 */
export const observabilityDashboardQuerySchema = z.object({
  /** Time range for dashboard data */
  timeRange: z.enum(['5m', '15m', '1h', '6h', '24h']).default('1h'),

  /** Include detailed task information */
  includeTaskDetails: z.coerce.boolean().optional().default(true),

  /** Include health checks */
  includeHealthChecks: z.coerce.boolean().optional().default(true),

  /** Filter by status */
  statusFilter: z
    .array(z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'AWAY']))
    .optional(),
});

export type ObservabilityDashboardQueryInput = z.infer<
  typeof observabilityDashboardQuerySchema
>;

/**
 * Common error codes for VP Analytics API
 */
export const VP_ANALYTICS_ERROR_CODES = {
  NOT_FOUND: 'VP_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
} as const;

export type VPAnalyticsErrorCode =
  (typeof VP_ANALYTICS_ERROR_CODES)[keyof typeof VP_ANALYTICS_ERROR_CODES];

/**
 * Standard error response schema
 */
export const analyticsErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type AnalyticsErrorResponse = z.infer<typeof analyticsErrorResponseSchema>;

/**
 * Helper function to create standardized error response
 */
export function createAnalyticsErrorResponse(
  error: string,
  code: VPAnalyticsErrorCode,
  details?: Record<string, unknown>,
): AnalyticsErrorResponse {
  return {
    error,
    code,
    ...(details && { details }),
  };
}

/**
 * Helper function to validate and parse date range
 * Returns default range if neither dates nor timeRange provided
 */
export function parseDateRange(input: AnalyticsDateRangeInput): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = input.endDate ? new Date(input.endDate) : new Date();

  let startDate: Date;

  if (input.startDate) {
    startDate = new Date(input.startDate);
  } else {
    // Use timeRange to calculate startDate
    startDate = new Date(endDate);
    switch (input.timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'all':
        startDate.setFullYear(2000); // Far past date
        break;
      default:
        startDate.setDate(startDate.getDate() - 30); // Default to 30 days
    }
  }

  // Validate date range
  if (startDate > endDate) {
    throw new Error('Start date must be before end date');
  }

  return { startDate, endDate };
}
