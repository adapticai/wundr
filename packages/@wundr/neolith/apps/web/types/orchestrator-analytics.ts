/**
 * OrchestratorAnalytics Types
 *
 * Type definitions for Orchestrator analytics and observability features.
 *
 * @module types/orchestrator-analytics
 */

/**
 * Time range for analytics queries
 */
export type MetricTimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

/**
 * Core Orchestrator performance metrics
 */
export interface OrchestratorMetrics {
  orchestratorId: string;
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
export interface OrchestratorAnalytics {
  orchestratorId: string;
  daily: MetricsPeriod[];
  weekly: MetricsPeriod[];
  monthly: MetricsPeriod[];
  summary: OrchestratorMetricsSummary;
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
 * Summary of Orchestrator performance
 */
export interface OrchestratorMetricsSummary {
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
  orchestratorId: string;
  durationMinutes: number;
  success: boolean;
  completedAt: Date;
  priority: string;
  status: string;
}

/**
 * Analytics API response
 */
export interface OrchestratorAnalyticsResponse {
  data: OrchestratorAnalytics;
  metrics: OrchestratorMetrics;
}

/**
 * Analytics query parameters
 */
export interface OrchestratorAnalyticsQuery {
  timeRange?: MetricTimeRange;
  includeDaily?: boolean;
  includeWeekly?: boolean;
  includeMonthly?: boolean;
}
