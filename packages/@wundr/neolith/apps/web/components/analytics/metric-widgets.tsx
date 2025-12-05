'use client';

/**
 * Comprehensive dashboard metric widgets
 *
 * This module exports all analytics widgets for dashboard use:
 * - KPICard: Key performance indicator cards with trends
 * - SparklineChart: Mini line charts with hover interactions
 * - ProgressRing: Circular progress indicators
 * - StatComparisonCard: Period-over-period comparisons
 * - RealtimeMetrics: Live updating metric displays
 */

export { KPICard } from './kpi-card';
export type { KPICardProps, KPITrend } from './kpi-card';

export { SparklineChart } from './sparkline-chart';
export type {
  SparklineChartProps,
  SparklineDataPoint,
} from './sparkline-chart';

export { ProgressRing, ProgressRingGroup } from './progress-ring';
export type {
  ProgressRingProps,
  ProgressRingGroupProps,
} from './progress-ring';

export { StatComparisonCard } from './stat-comparison-card';
export type {
  StatComparisonCardProps,
  ComparisonPeriod,
} from './stat-comparison-card';

export { RealtimeMetrics, RealtimeActivityFeed } from './realtime-metrics';
export type {
  RealtimeMetricsProps,
  RealtimeMetric,
  RealtimeActivityFeedProps,
} from './realtime-metrics';

// Re-export existing metric card for backwards compatibility
export { MetricCard } from './metric-card';
export type { MetricCardProps } from './metric-card';
