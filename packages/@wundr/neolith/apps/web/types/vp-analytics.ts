/**
 * VP Analytics Types
 *
 * Type definitions for VP analytics and observability features.
 *
 * @module types/vp-analytics
 */

/**
 * Time range for analytics queries
 */
export type MetricTimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

/**
 * Core VP performance metrics
 */
export interface VPMetrics {
  vpId: string;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  tasksCancelled: number;
  avgDurationMinutes: number | null;
  successRate: number;
  totalTasksAssigned: number;
  timeRange: MetricTimeRange;
  calculatedAt: Date;
}

/**
 * Aggregated analytics over time periods
 */
export interface VPAnalytics {
  vpId: string;
  daily: MetricsPeriod[];
  weekly: MetricsPeriod[];
  monthly: MetricsPeriod[];
  summary: VPMetricsSummary;
}

/**
 * Metrics for a specific time period
 */
export interface MetricsPeriod {
  periodStart: Date;
  periodEnd: Date;
  tasksCompleted: number;
  avgDurationMinutes: number | null;
  successRate: number;
  peakHour?: number;
}

/**
 * Summary of VP performance
 */
export interface VPMetricsSummary {
  totalTasksCompleted: number;
  totalTasksFailed: number;
  overallSuccessRate: number;
  avgResponseTimeMinutes: number | null;
  mostProductiveDay?: string;
  leastProductiveDay?: string;
  trendDirection: 'up' | 'down' | 'stable';
}

/**
 * Task completion tracking data
 */
export interface TaskCompletionEvent {
  taskId: string;
  vpId: string;
  durationMinutes: number;
  success: boolean;
  completedAt: Date;
  priority: string;
  status: string;
}

/**
 * Analytics API response
 */
export interface VPAnalyticsResponse {
  data: VPAnalytics;
  metrics: VPMetrics;
}

/**
 * Analytics query parameters
 */
export interface VPAnalyticsQuery {
  timeRange?: MetricTimeRange;
  includeDaily?: boolean;
  includeWeekly?: boolean;
  includeMonthly?: boolean;
}
