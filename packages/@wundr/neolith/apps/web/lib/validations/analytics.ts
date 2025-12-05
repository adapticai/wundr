/**
 * Analytics Validation Schemas
 *
 * Comprehensive Zod schemas for analytics requests including:
 * - Date range validation with presets and custom ranges
 * - Filter validation for complex queries
 * - Export request validation with format options
 * - Proper error messages and TypeScript types
 *
 * @module lib/validations/analytics
 */

import { z } from 'zod';

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Analytics error codes for standardized error handling
 */
export const ANALYTICS_ERROR_CODES = {
  UNAUTHORIZED: 'ANALYTICS_UNAUTHORIZED',
  VALIDATION_ERROR: 'ANALYTICS_VALIDATION_ERROR',
  WORKSPACE_NOT_FOUND: 'ANALYTICS_WORKSPACE_NOT_FOUND',
  INTERNAL_ERROR: 'ANALYTICS_INTERNAL_ERROR',
  INVALID_DATE_RANGE: 'ANALYTICS_INVALID_DATE_RANGE',
  INVALID_METRIC: 'ANALYTICS_INVALID_METRIC',
  INVALID_FILTER: 'ANALYTICS_INVALID_FILTER',
  INVALID_EXPORT_FORMAT: 'ANALYTICS_INVALID_EXPORT_FORMAT',
  EXPORT_FAILED: 'ANALYTICS_EXPORT_FAILED',
  DATA_NOT_FOUND: 'ANALYTICS_DATA_NOT_FOUND',
  AGGREGATION_FAILED: 'ANALYTICS_AGGREGATION_FAILED',
  QUERY_TOO_COMPLEX: 'ANALYTICS_QUERY_TOO_COMPLEX',
  RATE_LIMITED: 'ANALYTICS_RATE_LIMITED',
  INSUFFICIENT_PERMISSIONS: 'ANALYTICS_INSUFFICIENT_PERMISSIONS',
} as const;

export type AnalyticsErrorCode =
  (typeof ANALYTICS_ERROR_CODES)[keyof typeof ANALYTICS_ERROR_CODES];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a standardized analytics error response
 */
export function createAnalyticsErrorResponse(
  message: string,
  code: AnalyticsErrorCode,
  extraData?: Record<string, unknown>,
): { error: AnalyticsErrorCode; message: string } & Record<string, unknown> {
  return {
    error: code,
    message,
    ...extraData,
  };
}

// =============================================================================
// METRIC DEFINITIONS
// =============================================================================

/**
 * Available analytics metrics
 */
export const ANALYTICS_METRICS = [
  'task_completion_rate',
  'average_task_duration',
  'agent_utilization',
  'error_rate',
  'token_usage',
  'cost',
  'throughput',
  'active_users',
  'message_count',
  'channel_activity',
  'response_time',
  'success_rate',
  'concurrent_sessions',
  'api_calls',
  'storage_usage',
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

/**
 * Metric schema
 */
export const analyticsMetricSchema = z.enum(ANALYTICS_METRICS);

// =============================================================================
// DATE RANGE VALIDATION
// =============================================================================

/**
 * Date range presets for quick filtering
 */
export const DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last14days',
  'last30days',
  'last90days',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
  'thisYear',
  'lastYear',
  'custom',
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

/**
 * Granularity options for time-based aggregation
 */
export const GRANULARITIES = [
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;

export type Granularity = (typeof GRANULARITIES)[number];

/**
 * Time range schema with start and end validation
 */
export const timeRangeSchema = z
  .object({
    start: z.string().datetime({
      message: 'Start date must be a valid ISO 8601 datetime',
    }),
    end: z.string().datetime({
      message: 'End date must be a valid ISO 8601 datetime',
    }),
    granularity: z.enum(GRANULARITIES).optional(),
  })
  .refine(
    data => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      return start < end;
    },
    {
      message: 'Start date must be before end date',
      path: ['start'],
    },
  )
  .refine(
    data => {
      const start = new Date(data.start);
      const end = new Date(data.end);
      const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
      return end.getTime() - start.getTime() <= maxRangeMs;
    },
    {
      message: 'Date range cannot exceed 1 year',
      path: ['end'],
    },
  );

export type TimeRange = z.infer<typeof timeRangeSchema>;

/**
 * Date range schema with preset or custom range
 * Supports both preset shortcuts and fully custom date ranges
 */
export const dateRangeSchema = z.union([
  z.object({
    preset: z.enum(DATE_RANGE_PRESETS),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    granularity: z.enum(GRANULARITIES).optional(),
  }),
  z
    .object({
      preset: z.literal('custom').optional(),
      start: z.string().datetime({
        message: 'Start date is required for custom date range',
      }),
      end: z.string().datetime({
        message: 'End date is required for custom date range',
      }),
      granularity: z.enum(GRANULARITIES).optional(),
    })
    .refine(
      data => {
        const start = new Date(data.start);
        const end = new Date(data.end);
        return start < end;
      },
      {
        message: 'Start date must be before end date',
        path: ['start'],
      },
    )
    .refine(
      data => {
        const start = new Date(data.start);
        const end = new Date(data.end);
        const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
        return end.getTime() - start.getTime() <= maxRangeMs;
      },
      {
        message: 'Date range cannot exceed 1 year',
        path: ['end'],
      },
    ),
]);

export type DateRange = z.infer<typeof dateRangeSchema>;

// =============================================================================
// FILTER VALIDATION
// =============================================================================

/**
 * Comparison operators for filter conditions
 */
export const FILTER_OPERATORS = [
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'nin',
  'contains',
  'startsWith',
  'endsWith',
  'regex',
  'exists',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/**
 * Filter condition schema for complex queries
 */
export const filterConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  operator: z.enum(FILTER_OPERATORS),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
    z.null(),
  ]),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

/**
 * Logical operators for combining filters
 */
export const LOGICAL_OPERATORS = ['and', 'or', 'not'] as const;

export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number];

/**
 * Complex filter schema with nested conditions
 */
const baseFilterGroupSchema = z.object({
  operator: z.enum(LOGICAL_OPERATORS),
  conditions: z.array(z.any()).min(1, 'At least one condition is required'),
});

export type FilterGroup = z.infer<typeof baseFilterGroupSchema> & {
  conditions: (FilterCondition | FilterGroup)[];
};

export const filterGroupSchema: z.ZodType<FilterGroup> = baseFilterGroupSchema.extend({
  conditions: z.lazy(() =>
    z.array(
      z.union([filterConditionSchema, filterGroupSchema]),
    ).min(1, 'At least one condition is required'),
  ),
}) as z.ZodType<FilterGroup>;

/**
 * Main filters schema supporting both simple and complex queries
 */
export const filtersSchema = z.union([
  // Simple filters (key-value pairs)
  z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]),
  ),
  // Complex filters (with operators and logical grouping)
  z.object({
    conditions: z.array(filterConditionSchema).optional(),
    groups: z.array(filterGroupSchema).optional(),
  }),
]);

export type Filters = z.infer<typeof filtersSchema>;

// =============================================================================
// ANALYTICS QUERY SCHEMAS
// =============================================================================

/**
 * Aggregation functions for metric calculation
 */
export const AGGREGATION_FUNCTIONS = [
  'sum',
  'avg',
  'min',
  'max',
  'count',
  'distinct',
  'median',
  'percentile',
  'stddev',
] as const;

export type AggregationFunction = (typeof AGGREGATION_FUNCTIONS)[number];

/**
 * Sort direction
 */
export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Sort order schema
 */
export const sortOrderSchema = z.object({
  field: z.string().min(1, 'Sort field is required'),
  direction: z.enum(SORT_DIRECTIONS).default('desc'),
});

export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Comprehensive analytics query schema
 */
export const analyticsQuerySchema = z.object({
  metrics: z
    .array(analyticsMetricSchema)
    .min(1, 'At least one metric is required')
    .max(10, 'Maximum 10 metrics allowed'),
  dateRange: dateRangeSchema,
  filters: filtersSchema.optional(),
  groupBy: z
    .array(z.string())
    .max(5, 'Maximum 5 group by fields allowed')
    .optional(),
  aggregation: z.enum(AGGREGATION_FUNCTIONS).optional().default('sum'),
  sortBy: z.array(sortOrderSchema).max(3, 'Maximum 3 sort orders allowed').optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(1000, 'Limit cannot exceed 1000')
    .optional()
    .default(100),
  offset: z.coerce
    .number()
    .int()
    .min(0, 'Offset must be non-negative')
    .optional()
    .default(0),
  includeSubMetrics: z.boolean().optional().default(false),
  compareWith: dateRangeSchema.optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/**
 * Analytics data point schema for results
 */
export const analyticsDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  metric: analyticsMetricSchema,
  value: z.number(),
  dimensions: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AnalyticsDataPoint = z.infer<typeof analyticsDataPointSchema>;

/**
 * Analytics report schema
 */
export const analyticsReportSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  query: analyticsQuerySchema,
  data: z.array(analyticsDataPointSchema),
  generatedAt: z.string().datetime(),
  summary: z
    .object({
      totalRecords: z.number().int().min(0),
      dateRange: z.object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      }),
      metrics: z.record(
        z.object({
          total: z.number(),
          average: z.number(),
          min: z.number(),
          max: z.number(),
        }),
      ),
    })
    .optional(),
});

export type AnalyticsReport = z.infer<typeof analyticsReportSchema>;

// =============================================================================
// EXPORT VALIDATION
// =============================================================================

/**
 * Export format options
 */
export const EXPORT_FORMATS = [
  'csv',
  'json',
  'xlsx',
  'pdf',
  'xml',
  'parquet',
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Export compression options
 */
export const COMPRESSION_TYPES = ['none', 'gzip', 'zip', 'bzip2'] as const;

export type CompressionType = (typeof COMPRESSION_TYPES)[number];

/**
 * CSV export options
 */
export const csvExportOptionsSchema = z.object({
  delimiter: z.enum([',', ';', '\t', '|']).default(','),
  includeHeaders: z.boolean().default(true),
  quoteStrings: z.boolean().default(true),
  dateFormat: z.string().optional(),
  encoding: z.enum(['utf-8', 'utf-16', 'latin1']).default('utf-8'),
});

export type CsvExportOptions = z.infer<typeof csvExportOptionsSchema>;

/**
 * JSON export options
 */
export const jsonExportOptionsSchema = z.object({
  pretty: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  arrayFormat: z.boolean().default(true),
});

export type JsonExportOptions = z.infer<typeof jsonExportOptionsSchema>;

/**
 * Excel export options
 */
export const xlsxExportOptionsSchema = z.object({
  sheetName: z.string().max(31, 'Sheet name cannot exceed 31 characters').optional(),
  includeCharts: z.boolean().default(false),
  autoFilter: z.boolean().default(true),
  freezeHeader: z.boolean().default(true),
});

export type XlsxExportOptions = z.infer<typeof xlsxExportOptionsSchema>;

/**
 * PDF export options
 */
export const pdfExportOptionsSchema = z.object({
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  pageSize: z.enum(['A4', 'Letter', 'Legal']).default('A4'),
  includeCharts: z.boolean().default(true),
  includeSummary: z.boolean().default(true),
});

export type PdfExportOptions = z.infer<typeof pdfExportOptionsSchema>;

/**
 * Main export request schema
 */
export const exportRequestSchema = z.object({
  query: analyticsQuerySchema,
  format: z.enum(EXPORT_FORMATS),
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename cannot exceed 255 characters')
    .regex(
      /^[a-zA-Z0-9_\-. ]+$/,
      'Filename can only contain alphanumeric characters, spaces, dots, hyphens, and underscores',
    )
    .optional(),
  compression: z.enum(COMPRESSION_TYPES).optional().default('none'),
  options: z
    .union([
      csvExportOptionsSchema,
      jsonExportOptionsSchema,
      xlsxExportOptionsSchema,
      pdfExportOptionsSchema,
    ])
    .optional(),
  includeRawData: z.boolean().optional().default(false),
  notifyOnComplete: z.boolean().optional().default(false),
  expiresIn: z.coerce
    .number()
    .int()
    .min(3600, 'Export must be available for at least 1 hour')
    .max(604800, 'Export cannot be available for more than 7 days')
    .optional()
    .default(86400), // 24 hours
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * Export status schema
 */
export const exportStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'expired']),
  format: z.enum(EXPORT_FORMATS),
  filename: z.string(),
  fileSize: z.number().int().min(0).optional(),
  downloadUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});

export type ExportStatus = z.infer<typeof exportStatusSchema>;

// =============================================================================
// DASHBOARD AND WIDGET SCHEMAS
// =============================================================================

/**
 * Widget types for dashboard configuration
 */
export const WIDGET_TYPES = [
  'line_chart',
  'bar_chart',
  'pie_chart',
  'area_chart',
  'scatter_chart',
  'table',
  'metric_card',
  'heatmap',
  'gauge',
  'funnel',
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/**
 * Dashboard widget schema
 */
export const dashboardWidgetSchema = z.object({
  id: z.string(),
  type: z.enum(WIDGET_TYPES),
  title: z.string().min(1, 'Widget title is required'),
  query: analyticsQuerySchema,
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1).max(12),
    height: z.number().int().min(1).max(12),
  }),
  refreshInterval: z.coerce
    .number()
    .int()
    .min(30000, 'Refresh interval must be at least 30 seconds')
    .optional(),
  config: z.record(z.unknown()).optional(),
});

export type DashboardWidget = z.infer<typeof dashboardWidgetSchema>;

/**
 * Dashboard schema
 */
export const dashboardSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Dashboard name is required'),
  description: z.string().optional(),
  widgets: z.array(dashboardWidgetSchema),
  layout: z.enum(['grid', 'flow']).default('grid'),
  isPublic: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Parse date range preset or custom range into actual start and end dates
 */
export function parseDateRange(input: DateRange): {
  start: Date;
  end: Date;
  granularity?: Granularity;
} {
  const now = new Date();
  let end = new Date(now);
  let start = new Date(now);

  // If custom dates are provided, use them
  if ('start' in input && input.start && 'end' in input && input.end) {
    return {
      start: new Date(input.start),
      end: new Date(input.end),
      granularity: input.granularity,
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
    case 'last14days':
      start.setDate(start.getDate() - 14);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last30days':
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last90days':
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      break;
    case 'thisWeek':
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastWeek':
      start.setDate(start.getDate() - start.getDay() - 7);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - end.getDay() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisQuarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      break;
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      start = new Date(now.getFullYear(), lastQuarter * 3, 1);
      end = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'lastYear':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
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

  return { start, end, granularity: input.granularity };
}

/**
 * Validate if a date range is within acceptable limits
 */
export function validateDateRangeLimit(
  start: Date,
  end: Date,
  maxDays: number = 365,
): boolean {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= maxDays;
}

/**
 * Get recommended granularity based on date range
 */
export function getRecommendedGranularity(start: Date, end: Date): Granularity {
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) {
return 'hour';
}
  if (diffDays <= 7) {
return 'day';
}
  if (diffDays <= 31) {
return 'day';
}
  if (diffDays <= 90) {
return 'week';
}
  if (diffDays <= 365) {
return 'month';
}
  return 'quarter';
}
