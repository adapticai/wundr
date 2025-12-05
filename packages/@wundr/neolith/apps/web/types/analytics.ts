/**
 * Analytics Types
 *
 * Comprehensive TypeScript type definitions for analytics, reporting,
 * and data visualization throughout the Neolith web application.
 * These types ensure type safety and compatibility with API responses.
 *
 * @module types/analytics
 */

// =============================================================================
// Core Analytics Types
// =============================================================================

/**
 * Time range options for analytics queries
 */
export type AnalyticsTimeRange =
  | '1h'    // Last hour
  | '24h'   // Last 24 hours
  | '7d'    // Last 7 days
  | '30d'   // Last 30 days
  | '90d'   // Last 90 days
  | 'all'   // All time
  | 'custom'; // Custom date range

/**
 * Analytics period granularity
 */
export type AnalyticsPeriod =
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

/**
 * Aggregation function types
 */
export type AggregationType =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'median'
  | 'percentile';

/**
 * Trend direction indicator
 */
export type TrendDirection = 'up' | 'down' | 'stable';

/**
 * Comparison period types
 */
export type ComparisonPeriod =
  | 'previous_period'
  | 'previous_week'
  | 'previous_month'
  | 'previous_quarter'
  | 'previous_year'
  | 'same_day_last_week'
  | 'same_day_last_month';

// =============================================================================
// Chart Data Types
// =============================================================================

/**
 * Chart type discriminator
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'gauge'
  | 'funnel'
  | 'radar'
  | 'treemap'
  | 'waterfall';

/**
 * Generic chart data point structure
 */
export interface ChartDataPoint {
  /** X-axis value (typically time or category) */
  x: string | number | Date;
  /** Y-axis value (metric value) */
  y: number;
  /** Optional label for the data point */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  /** Timestamp (ISO 8601 string or Date) */
  timestamp: string | Date;
  /** Metric value */
  value: number;
  /** Optional metric label */
  label?: string;
  /** Optional additional dimensions */
  dimensions?: Record<string, string | number>;
}

/**
 * Multi-series chart data
 */
export interface MultiSeriesChartData {
  /** Series identifier */
  id: string;
  /** Series display name */
  name: string;
  /** Series data points */
  data: ChartDataPoint[];
  /** Series color (hex or rgba) */
  color?: string;
  /** Series type (for mixed charts) */
  type?: ChartType;
}

/**
 * Categorical data for pie/donut charts
 */
export interface CategoryDataPoint {
  /** Category name */
  category: string;
  /** Category value */
  value: number;
  /** Percentage of total */
  percentage?: number;
  /** Category color */
  color?: string;
  /** Optional subcategories for nested charts */
  children?: CategoryDataPoint[];
}

/**
 * Heatmap data point
 */
export interface HeatmapDataPoint {
  /** X-axis category or timestamp */
  x: string | number;
  /** Y-axis category */
  y: string | number;
  /** Intensity value */
  value: number;
  /** Optional label */
  label?: string;
}

/**
 * Chart configuration options
 */
export interface ChartConfig {
  /** Chart title */
  title?: string;
  /** Chart subtitle */
  subtitle?: string;
  /** Show legend */
  showLegend?: boolean;
  /** Show grid lines */
  showGrid?: boolean;
  /** Enable tooltips */
  showTooltips?: boolean;
  /** Enable zoom/pan */
  interactive?: boolean;
  /** X-axis label */
  xAxisLabel?: string;
  /** Y-axis label */
  yAxisLabel?: string;
  /** Color scheme */
  colorScheme?: string[];
  /** Chart height (pixels or percentage) */
  height?: number | string;
  /** Chart width (pixels or percentage) */
  width?: number | string;
  /** Animation duration (ms) */
  animationDuration?: number;
  /** Custom formatting options */
  formatting?: {
    /** Number format (e.g., '0,0.00') */
    numberFormat?: string;
    /** Date format (e.g., 'MMM DD, YYYY') */
    dateFormat?: string;
    /** Currency symbol */
    currency?: string;
    /** Percentage decimals */
    percentageDecimals?: number;
  };
}

/**
 * Complete chart data structure
 */
export interface ChartData {
  /** Chart type */
  type: ChartType;
  /** Chart configuration */
  config: ChartConfig;
  /** Single series data */
  data?: ChartDataPoint[];
  /** Multi-series data */
  series?: MultiSeriesChartData[];
  /** Category data (for pie/donut) */
  categories?: CategoryDataPoint[];
  /** Heatmap data */
  heatmap?: HeatmapDataPoint[][];
  /** Data timestamp */
  generatedAt?: Date | string;
}

// =============================================================================
// Metric Types
// =============================================================================

/**
 * Metric category
 */
export type MetricCategory =
  | 'engagement'
  | 'performance'
  | 'productivity'
  | 'quality'
  | 'usage'
  | 'growth'
  | 'retention'
  | 'efficiency'
  | 'reliability'
  | 'satisfaction';

/**
 * Metric unit type
 */
export type MetricUnit =
  | 'count'
  | 'percentage'
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'bytes'
  | 'kilobytes'
  | 'megabytes'
  | 'gigabytes'
  | 'currency'
  | 'rate';

/**
 * Metric value with metadata
 */
export interface MetricValue {
  /** Current value */
  value: number;
  /** Display formatted value */
  displayValue?: string;
  /** Metric unit */
  unit: MetricUnit;
  /** Timestamp of measurement */
  timestamp: Date | string;
  /** Confidence score (0-1) */
  confidence?: number;
}

/**
 * Metric with trend data
 */
export interface MetricWithTrend extends MetricValue {
  /** Previous period value */
  previousValue?: number;
  /** Absolute change */
  change?: number;
  /** Percentage change */
  changePercent?: number;
  /** Trend direction */
  trend?: TrendDirection;
  /** Comparison period type */
  comparisonPeriod?: ComparisonPeriod;
}

/**
 * Comprehensive metric definition
 */
export interface Metric {
  /** Unique metric identifier */
  id: string;
  /** Metric name */
  name: string;
  /** Metric description */
  description?: string;
  /** Metric category */
  category: MetricCategory;
  /** Current metric value with trend */
  value: MetricWithTrend;
  /** Historical data */
  history?: TimeSeriesDataPoint[];
  /** Target/goal value */
  target?: number;
  /** Threshold values for alerts */
  thresholds?: {
    critical?: number;
    warning?: number;
    good?: number;
  };
  /** Metric tags for filtering */
  tags?: string[];
}

/**
 * Metric card display configuration
 */
export interface MetricCardConfig {
  /** Metric to display */
  metric: Metric;
  /** Show trend indicator */
  showTrend?: boolean;
  /** Show sparkline chart */
  showSparkline?: boolean;
  /** Show target/goal */
  showTarget?: boolean;
  /** Card size */
  size?: 'small' | 'medium' | 'large';
  /** Highlight color */
  accentColor?: string;
}

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Date range filter
 */
export interface DateRangeFilter {
  /** Start date */
  startDate: Date | string;
  /** End date */
  endDate: Date | string;
  /** Optional timezone */
  timezone?: string;
}

/**
 * Entity filter (users, channels, etc.)
 */
export interface EntityFilter {
  /** Entity IDs to include */
  include?: string[];
  /** Entity IDs to exclude */
  exclude?: string[];
  /** Filter operator */
  operator?: 'AND' | 'OR';
}

/**
 * Numeric range filter
 */
export interface NumericRangeFilter {
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Exact value match */
  equals?: number;
}

/**
 * Comprehensive analytics filters
 */
export interface AnalyticsFilters {
  /** Time range filter */
  timeRange?: AnalyticsTimeRange;
  /** Custom date range */
  dateRange?: DateRangeFilter;
  /** Workspace filter */
  workspaceIds?: EntityFilter;
  /** User filter */
  userIds?: EntityFilter;
  /** Channel filter */
  channelIds?: EntityFilter;
  /** Orchestrator filter */
  orchestratorIds?: EntityFilter;
  /** Agent filter */
  agentIds?: EntityFilter;
  /** Task status filter */
  taskStatuses?: string[];
  /** Event type filter */
  eventTypes?: string[];
  /** Metric categories filter */
  categories?: MetricCategory[];
  /** Custom metadata filters */
  metadata?: Record<string, string | number | boolean>;
  /** Numeric filters */
  numericFilters?: Record<string, NumericRangeFilter>;
  /** Text search query */
  searchQuery?: string;
}

/**
 * Filter preset for quick access
 */
export interface FilterPreset {
  /** Preset identifier */
  id: string;
  /** Preset name */
  name: string;
  /** Preset description */
  description?: string;
  /** Preset filters */
  filters: AnalyticsFilters;
  /** Is system preset (non-deletable) */
  isSystem?: boolean;
  /** Created by user ID */
  createdBy?: string;
}

// =============================================================================
// Report Types
// =============================================================================

/**
 * Report format options
 */
export type ReportFormat =
  | 'pdf'
  | 'excel'
  | 'csv'
  | 'json'
  | 'html'
  | 'markdown';

/**
 * Report section type
 */
export type ReportSectionType =
  | 'summary'
  | 'metrics'
  | 'chart'
  | 'table'
  | 'insights'
  | 'recommendations'
  | 'custom';

/**
 * Report section definition
 */
export interface ReportSection {
  /** Section identifier */
  id: string;
  /** Section type */
  type: ReportSectionType;
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section order */
  order: number;
  /** Section content */
  content: {
    /** Metrics to include */
    metrics?: Metric[];
    /** Charts to include */
    charts?: ChartData[];
    /** Tables to include */
    tables?: TableData[];
    /** Insights to include */
    insights?: InsightHighlight[];
    /** Free-form text content */
    text?: string;
    /** Custom HTML/React content */
    customContent?: string;
  };
  /** Section visibility */
  visible?: boolean;
}

/**
 * Table column definition
 */
export interface TableColumn {
  /** Column key */
  key: string;
  /** Column display name */
  label: string;
  /** Column data type */
  type: 'string' | 'number' | 'date' | 'boolean' | 'custom';
  /** Column width */
  width?: number | string;
  /** Is sortable */
  sortable?: boolean;
  /** Number format (for numeric columns) */
  format?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Table row data
 */
export interface TableRow {
  /** Unique row identifier */
  id: string;
  /** Row data matching column keys */
  data: Record<string, string | number | boolean | Date | null>;
  /** Optional row metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Table data structure
 */
export interface TableData {
  /** Table columns */
  columns: TableColumn[];
  /** Table rows */
  rows: TableRow[];
  /** Total row count (for pagination) */
  totalRows?: number;
  /** Current page (for pagination) */
  page?: number;
  /** Rows per page (for pagination) */
  pageSize?: number;
  /** Is data sortable */
  sortable?: boolean;
  /** Is data filterable */
  filterable?: boolean;
  /** Default sort configuration */
  defaultSort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Report template
 */
export interface ReportTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Report sections */
  sections: ReportSection[];
  /** Default filters */
  defaultFilters?: AnalyticsFilters;
  /** Is system template */
  isSystem?: boolean;
  /** Template category */
  category?: string;
  /** Created by user ID */
  createdBy?: string;
  /** Created timestamp */
  createdAt?: Date | string;
  /** Last updated timestamp */
  updatedAt?: Date | string;
}

/**
 * Scheduled report configuration
 */
export interface ScheduledReport {
  /** Schedule identifier */
  id: string;
  /** Report template to use */
  templateId: string;
  /** Schedule name */
  name: string;
  /** Workspace ID */
  workspaceId: string;
  /** Schedule frequency */
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  /** Day of week (for weekly) */
  dayOfWeek?: number;
  /** Day of month (for monthly) */
  dayOfMonth?: number;
  /** Time of day (24h format) */
  timeOfDay?: string;
  /** Timezone */
  timezone?: string;
  /** Recipients */
  recipients: {
    /** User IDs to send to */
    userIds?: string[];
    /** Email addresses */
    emails?: string[];
  };
  /** Report format */
  format: ReportFormat;
  /** Active/inactive status */
  active: boolean;
  /** Filters to apply */
  filters?: AnalyticsFilters;
  /** Next scheduled run */
  nextRun?: Date | string;
  /** Last run timestamp */
  lastRun?: Date | string;
  /** Created by user ID */
  createdBy: string;
}

/**
 * Report generation result
 */
export interface GeneratedReport {
  /** Report identifier */
  id: string;
  /** Template used */
  templateId?: string;
  /** Report name */
  name: string;
  /** Report sections with populated data */
  sections: ReportSection[];
  /** Filters applied */
  filters: AnalyticsFilters;
  /** Generation timestamp */
  generatedAt: Date | string;
  /** Generated by user ID */
  generatedBy: string;
  /** Report format */
  format: ReportFormat;
  /** Download URL (if applicable) */
  downloadUrl?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Expiration timestamp */
  expiresAt?: Date | string;
}

// =============================================================================
// Export Types
// =============================================================================

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Export format */
  format: ReportFormat;
  /** Include charts as images */
  includeCharts?: boolean;
  /** Include raw data */
  includeRawData?: boolean;
  /** Include filters applied */
  includeFilters?: boolean;
  /** Custom filename */
  filename?: string;
  /** Compression (for supported formats) */
  compress?: boolean;
  /** Sheet names (for Excel) */
  sheetNames?: string[];
  /** CSV delimiter */
  csvDelimiter?: ',' | ';' | '\t';
  /** Include timestamp in filename */
  includeTimestamp?: boolean;
}

/**
 * Export request
 */
export interface ExportRequest {
  /** Data to export */
  data: {
    /** Metrics */
    metrics?: Metric[];
    /** Charts */
    charts?: ChartData[];
    /** Tables */
    tables?: TableData[];
    /** Raw event data */
    events?: unknown[];
  };
  /** Export configuration */
  config: ExportConfig;
  /** Filters applied (for documentation) */
  filters?: AnalyticsFilters;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Export job identifier */
  id: string;
  /** Export status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Format used */
  format: ReportFormat;
  /** Download URL */
  downloadUrl?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Error message (if failed) */
  error?: string;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Completion timestamp */
  completedAt?: Date | string;
  /** Expiration timestamp */
  expiresAt?: Date | string;
}

// =============================================================================
// Insight & Recommendation Types
// =============================================================================

/**
 * Insight type
 */
export type InsightType =
  | 'positive'
  | 'negative'
  | 'neutral'
  | 'warning'
  | 'opportunity';

/**
 * Insight priority
 */
export type InsightPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Analytics insight highlight
 */
export interface InsightHighlight {
  /** Insight identifier */
  id: string;
  /** Insight type */
  type: InsightType;
  /** Insight priority */
  priority: InsightPriority;
  /** Insight title */
  title: string;
  /** Detailed description */
  description: string;
  /** Related metric */
  metric?: string;
  /** Metric value */
  value?: number;
  /** Change data */
  change?: {
    /** Absolute change */
    absolute: number;
    /** Percentage change */
    percentage: number;
    /** Trend direction */
    trend: TrendDirection;
  };
  /** Supporting chart data */
  chartData?: ChartData;
  /** Related entities */
  relatedEntities?: {
    type: string;
    ids: string[];
  };
  /** Timestamp */
  detectedAt: Date | string;
}

/**
 * Actionable recommendation
 */
export interface Recommendation {
  /** Recommendation identifier */
  id: string;
  /** Priority level */
  priority: InsightPriority;
  /** Category */
  category: string;
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected impact */
  expectedImpact?: string;
  /** Effort required */
  effort?: 'low' | 'medium' | 'high';
  /** Action URL */
  actionUrl?: string;
  /** Action button text */
  actionText?: string;
  /** Supporting data */
  supportingData?: {
    metrics?: Metric[];
    charts?: ChartData[];
  };
  /** Timestamp */
  createdAt: Date | string;
}

/**
 * Analytics insights report
 */
export interface InsightsReport {
  /** Report identifier */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** Report period */
  period: AnalyticsPeriod;
  /** Date range */
  dateRange: DateRangeFilter;
  /** Key highlights */
  highlights: InsightHighlight[];
  /** Recommendations */
  recommendations: Recommendation[];
  /** Summary metrics */
  summaryMetrics: Metric[];
  /** Generation timestamp */
  generatedAt: Date | string;
  /** Next report date */
  nextReportDate?: Date | string;
}

// =============================================================================
// Dashboard Types
// =============================================================================

/**
 * Dashboard widget type
 */
export type WidgetType =
  | 'metric_card'
  | 'line_chart'
  | 'bar_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'table'
  | 'leaderboard'
  | 'activity_feed'
  | 'heatmap'
  | 'gauge'
  | 'progress'
  | 'custom';

/**
 * Dashboard widget layout position
 */
export interface WidgetPosition {
  /** X position (grid column) */
  x: number;
  /** Y position (grid row) */
  y: number;
  /** Width (grid columns) */
  w: number;
  /** Height (grid rows) */
  h: number;
  /** Minimum width */
  minW?: number;
  /** Minimum height */
  minH?: number;
  /** Maximum width */
  maxW?: number;
  /** Maximum height */
  maxH?: number;
}

/**
 * Widget configuration
 */
export interface WidgetConfig {
  /** Primary metric ID */
  metricId?: string;
  /** Chart configuration */
  chartConfig?: ChartConfig;
  /** Refresh interval (seconds) */
  refreshInterval?: number;
  /** Show header */
  showHeader?: boolean;
  /** Show footer */
  showFooter?: boolean;
  /** Custom styling */
  customStyle?: Record<string, string>;
  /** Data filters */
  filters?: AnalyticsFilters;
  /** Comparison period */
  comparisonPeriod?: ComparisonPeriod;
  /** Additional widget-specific config */
  [key: string]: unknown;
}

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  /** Widget identifier */
  id: string;
  /** Widget type */
  type: WidgetType;
  /** Widget title */
  title: string;
  /** Widget description */
  description?: string;
  /** Layout position */
  position: WidgetPosition;
  /** Widget configuration */
  config: WidgetConfig;
  /** Data source */
  dataSource?: {
    /** API endpoint */
    endpoint?: string;
    /** Query parameters */
    params?: Record<string, unknown>;
    /** Update strategy */
    updateStrategy?: 'realtime' | 'polling' | 'manual';
  };
  /** Widget visibility */
  visible?: boolean;
}

/**
 * Analytics dashboard
 */
export interface AnalyticsDashboard {
  /** Dashboard identifier */
  id: string;
  /** Workspace ID */
  workspaceId: string;
  /** Dashboard name */
  name: string;
  /** Dashboard description */
  description?: string;
  /** Dashboard widgets */
  widgets: DashboardWidget[];
  /** Is default dashboard */
  isDefault?: boolean;
  /** Dashboard category */
  category?: string;
  /** Grid layout configuration */
  gridConfig?: {
    /** Number of columns */
    columns: number;
    /** Row height in pixels */
    rowHeight: number;
    /** Compact mode */
    compact?: boolean;
  };
  /** Global filters */
  globalFilters?: AnalyticsFilters;
  /** Dashboard tags */
  tags?: string[];
  /** Created by user ID */
  createdBy: string;
  /** Created timestamp */
  createdAt: Date | string;
  /** Last updated timestamp */
  updatedAt: Date | string;
  /** Last viewed timestamp */
  lastViewedAt?: Date | string;
  /** View count */
  viewCount?: number;
}

// =============================================================================
// Query Types
// =============================================================================

/**
 * Analytics query parameters
 */
export interface AnalyticsQuery {
  /** Workspace ID */
  workspaceId: string;
  /** Time range */
  timeRange?: AnalyticsTimeRange;
  /** Custom date range */
  dateRange?: DateRangeFilter;
  /** Period granularity */
  period?: AnalyticsPeriod;
  /** Metrics to retrieve */
  metrics?: string[];
  /** Dimensions to group by */
  groupBy?: string[];
  /** Filters to apply */
  filters?: AnalyticsFilters;
  /** Sort configuration */
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  /** Pagination */
  pagination?: {
    page: number;
    pageSize: number;
  };
  /** Include comparison data */
  includeComparison?: boolean;
  /** Comparison period */
  comparisonPeriod?: ComparisonPeriod;
}

/**
 * Analytics query result
 */
export interface AnalyticsQueryResult {
  /** Query metadata */
  query: AnalyticsQuery;
  /** Result metrics */
  metrics: Metric[];
  /** Chart data */
  charts?: ChartData[];
  /** Table data */
  tables?: TableData[];
  /** Comparison data */
  comparison?: {
    metrics: Metric[];
    period: ComparisonPeriod;
  };
  /** Total result count */
  totalCount?: number;
  /** Execution time (ms) */
  executionTime?: number;
  /** Result timestamp */
  timestamp: Date | string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Analytics API response wrapper
 */
export interface AnalyticsApiResponse<T = unknown> {
  /** Response data */
  data: T;
  /** Response metadata */
  meta?: {
    /** Total count */
    total?: number;
    /** Current page */
    page?: number;
    /** Page size */
    pageSize?: number;
    /** Total pages */
    totalPages?: number;
    /** Filters applied */
    filters?: AnalyticsFilters;
    /** Cache status */
    cached?: boolean;
    /** Cache timestamp */
    cacheTime?: Date | string;
  };
  /** Request timestamp */
  timestamp: Date | string;
}

/**
 * Error response
 */
export interface AnalyticsErrorResponse {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date | string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a valid ChartType
 */
export function isChartType(value: unknown): value is ChartType {
  const validTypes: ChartType[] = [
    'line', 'bar', 'area', 'pie', 'donut', 'scatter',
    'heatmap', 'gauge', 'funnel', 'radar', 'treemap', 'waterfall',
  ];
  return typeof value === 'string' && validTypes.includes(value as ChartType);
}

/**
 * Check if value is a valid TrendDirection
 */
export function isTrendDirection(value: unknown): value is TrendDirection {
  return typeof value === 'string' && ['up', 'down', 'stable'].includes(value);
}

/**
 * Check if value is a valid ReportFormat
 */
export function isReportFormat(value: unknown): value is ReportFormat {
  const validFormats: ReportFormat[] = ['pdf', 'excel', 'csv', 'json', 'html', 'markdown'];
  return typeof value === 'string' && validFormats.includes(value as ReportFormat);
}

/**
 * Check if value is a valid MetricValue
 */
export function isMetricValue(value: unknown): value is MetricValue {
  if (typeof value !== 'object' || value === null) {
return false;
}
  const v = value as MetricValue;
  return (
    typeof v.value === 'number' &&
    typeof v.unit === 'string' &&
    (v.timestamp instanceof Date || typeof v.timestamp === 'string')
  );
}

/**
 * Check if value is a valid AnalyticsQuery
 */
export function isAnalyticsQuery(value: unknown): value is AnalyticsQuery {
  if (typeof value !== 'object' || value === null) {
return false;
}
  const q = value as AnalyticsQuery;
  return typeof q.workspaceId === 'string';
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Partial deep - makes all nested properties optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
