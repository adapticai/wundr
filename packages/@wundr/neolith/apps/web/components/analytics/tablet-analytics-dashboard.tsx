/**
 * Tablet Analytics Dashboard Component
 * @module components/analytics/tablet-analytics-dashboard
 *
 * Analytics dashboard optimized for tablet devices with responsive charts,
 * 2-column metric cards, and orientation-aware layout.
 */
'use client';

import { useState } from 'react';

import { useIsTablet, useOrientation } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import type { ChartDataPoint } from '@/types/api';

export interface AnalyticsMetric {
  id: string;
  label: string;
  value: number;
  format?: 'number' | 'percent' | 'currency' | 'compact';
  change?: {
    value: number;
    trend: 'up' | 'down' | 'stable';
  };
  icon?: React.ReactNode;
}

export interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'donut' | 'area';
  data: ChartDataPoint[];
  height?: number;
}

export interface TabletAnalyticsDashboardProps {
  metrics?: AnalyticsMetric[];
  charts?: ChartData[];
  timeRange?: {
    from?: Date;
    to?: Date;
  };
  onTimeRangeChange?: (range: { from?: Date; to?: Date }) => void;
  className?: string;
}

/**
 * TabletAnalyticsDashboard provides tablet-optimized analytics visualization:
 *
 * - Responsive charts that resize appropriately for tablet screens
 * - 2-column layout for metric cards
 * - Scrollable sections for long content
 * - Landscape/portrait mode support
 * - Touch-friendly controls (min 44x44px)
 * - Optimized chart heights for tablet viewing
 *
 * Chart heights by device:
 * - Portrait: 200px
 * - Landscape: 280px
 * - Desktop: 320px
 *
 * @example
 * ```tsx
 * <TabletAnalyticsDashboard
 *   workspaceId="workspace-123"
 *   metrics={analyticsMetrics}
 *   charts={chartConfigs}
 *   timeRange={{ from: startDate, to: endDate }}
 * />
 * ```
 */
export function TabletAnalyticsDashboard({
  metrics = [],
  charts = [],
  timeRange,
  onTimeRangeChange,
  className,
}: TabletAnalyticsDashboardProps) {
  const isTablet = useIsTablet();
  const orientation = useOrientation();
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Determine chart height based on device and orientation
  const getChartHeight = () => {
    if (!isTablet) {
      return 320;
    }
    return orientation === 'portrait' ? 200 : 280;
  };

  // Determine metrics grid columns
  const getMetricsColumns = () => {
    if (!isTablet) {
      return 'grid-cols-2 lg:grid-cols-4';
    }
    return orientation === 'portrait' ? 'grid-cols-2' : 'grid-cols-4';
  };

  // Determine charts grid columns
  const getChartsColumns = () => {
    if (!isTablet) {
      return 'grid-cols-1 lg:grid-cols-2';
    }
    return orientation === 'portrait' ? 'grid-cols-1' : 'grid-cols-2';
  };

  return (
    <div className={cn('h-full flex flex-col', className)}>
      {/* Header with Time Range Controls */}
      <div className='flex-shrink-0 border-b border-border bg-background p-4 md:p-6'>
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
          <div>
            <h2 className='text-xl md:text-2xl font-semibold text-foreground'>
              Analytics
            </h2>
            <p className='text-sm text-muted-foreground mt-1'>
              Workspace insights and performance metrics
            </p>
          </div>

          {onTimeRangeChange && (
            <TimeRangeSelector value={timeRange} onChange={onTimeRangeChange} />
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className='flex-1 overflow-y-auto'>
        <div className='p-4 md:p-6 space-y-6'>
          {/* Key Metrics Grid */}
          {metrics.length > 0 && (
            <section>
              <h3 className='text-lg font-semibold text-foreground mb-4'>
                Key Metrics
              </h3>
              <div className={cn('grid gap-4', getMetricsColumns())}>
                {metrics.map(metric => (
                  <AnalyticsMetricCard
                    key={metric.id}
                    metric={metric}
                    selected={selectedMetric === metric.id}
                    onClick={() =>
                      setSelectedMetric(
                        selectedMetric === metric.id ? null : metric.id
                      )
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {/* Charts Grid */}
          {charts.length > 0 && (
            <section>
              <h3 className='text-lg font-semibold text-foreground mb-4'>
                Trends & Analysis
              </h3>
              <div className={cn('grid gap-4 md:gap-6', getChartsColumns())}>
                {charts.map(chart => (
                  <ChartCard
                    key={chart.id}
                    chart={chart}
                    height={getChartHeight()}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Summary Cards */}
          <section>
            <h3 className='text-lg font-semibold text-foreground mb-4'>
              Summary
            </h3>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <SummaryCard
                label='Total Sessions'
                value='1,234'
                icon={<SessionsIcon />}
              />
              <SummaryCard
                label='Avg Duration'
                value='12m 34s'
                icon={<ClockIcon />}
              />
              <SummaryCard
                label='Active Users'
                value='456'
                icon={<UsersIcon />}
              />
              <SummaryCard
                label='Conversion Rate'
                value='3.2%'
                icon={<TargetIcon />}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * AnalyticsMetricCard displays a single metric with formatting and trends
 */
function AnalyticsMetricCard({
  metric,
  selected,
  onClick,
}: {
  metric: AnalyticsMetric;
  selected?: boolean;
  onClick?: () => void;
}) {
  const formatValue = (value: number, format?: string) => {
    switch (format) {
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'currency':
        return `$${value.toLocaleString()}`;
      case 'compact':
        return value >= 1000
          ? `${(value / 1000).toFixed(1)}k`
          : value.toLocaleString();
      default:
        return value.toLocaleString();
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left bg-card border rounded-lg p-4 transition-all',
        'min-h-[100px] touch-manipulation',
        selected
          ? 'border-primary shadow-md ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50 hover:shadow-sm'
      )}
    >
      <div className='flex items-start justify-between mb-2'>
        <p className='text-sm font-medium text-muted-foreground'>
          {metric.label}
        </p>
        {metric.icon && (
          <div className='text-muted-foreground'>{metric.icon}</div>
        )}
      </div>

      <p className='text-2xl md:text-3xl font-semibold text-foreground mb-1'>
        {formatValue(metric.value, metric.format)}
      </p>

      {metric.change && (
        <div
          className={cn(
            'flex items-center gap-1 text-sm font-medium',
            metric.change.trend === 'up' &&
              'text-green-600 dark:text-green-400',
            metric.change.trend === 'down' && 'text-red-600 dark:text-red-400',
            metric.change.trend === 'stable' && 'text-muted-foreground'
          )}
        >
          {metric.change.trend === 'up' && <ArrowUpIcon />}
          {metric.change.trend === 'down' && <ArrowDownIcon />}
          <span>{Math.abs(metric.change.value).toFixed(1)}%</span>
        </div>
      )}
    </button>
  );
}

/**
 * ChartCard wrapper for analytics charts
 */
function ChartCard({ chart, height }: { chart: ChartData; height: number }) {
  return (
    <div className='bg-card border border-border rounded-lg p-4 md:p-6'>
      <h4 className='text-base font-semibold text-foreground mb-4'>
        {chart.title}
      </h4>
      <div style={{ height: `${height}px` }}>
        {/* Placeholder for actual chart component */}
        <div className='w-full h-full flex items-center justify-center bg-muted/30 rounded border border-dashed border-border'>
          <p className='text-sm text-muted-foreground'>
            {chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} Chart
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SummaryCard displays a summary statistic
 */
function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className='bg-muted/50 rounded-lg p-4 text-center'>
      {icon && (
        <div className='flex justify-center mb-2 text-muted-foreground'>
          {icon}
        </div>
      )}
      <p className='text-xl md:text-2xl font-semibold text-foreground'>
        {value}
      </p>
      <p className='text-xs md:text-sm text-muted-foreground mt-1'>{label}</p>
    </div>
  );
}

/**
 * TimeRangeSelector for filtering analytics data
 */
function TimeRangeSelector({
  onChange,
}: {
  value?: { from?: Date; to?: Date };
  onChange: (range: { from?: Date; to?: Date }) => void;
}) {
  const presets = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
  ];

  const handlePresetClick = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ from, to });
  };

  return (
    <div className='flex gap-2'>
      {presets.map(preset => (
        <button
          key={preset.label}
          onClick={() => handlePresetClick(preset.days)}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'min-h-[44px] min-w-[44px] touch-manipulation',
            'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

// Icons
function ArrowUpIcon() {
  return (
    <svg
      className='w-4 h-4'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='m18 15-6-6-6 6' />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      className='w-4 h-4'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path strokeLinecap='round' strokeLinejoin='round' d='m6 9 6 6 6-6' />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg
      className='w-5 h-5'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <rect width='20' height='14' x='2' y='7' rx='2' />
      <path d='M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className='w-5 h-5'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      className='w-5 h-5'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg
      className='w-5 h-5'
      fill='none'
      viewBox='0 0 24 24'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='12' cy='12' r='10' />
      <circle cx='12' cy='12' r='6' />
      <circle cx='12' cy='12' r='2' />
    </svg>
  );
}
