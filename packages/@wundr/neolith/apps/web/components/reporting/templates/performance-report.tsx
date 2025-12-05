'use client';

/**
 * Performance Report Template
 * Pre-built template for performance analytics reports
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { AreaChart } from '../charts/area-chart';
import { BarChart } from '../charts/bar-chart';
import { LineChart } from '../charts/line-chart';

import type { DateRange, MetricCardData } from '../types';

interface PerformanceReportProps {
  dateRange?: DateRange;
  metrics: MetricCardData[];
  timeSeriesData: Array<Record<string, string | number>>;
  categoryData: Array<Record<string, string | number>>;
  className?: string;
}

function MetricCard({ metric }: { metric: MetricCardData }) {
  const Icon = metric.icon;
  const trendColor =
    metric.trend === 'up'
      ? 'text-green-600'
      : metric.trend === 'down'
        ? 'text-red-600'
        : 'text-muted-foreground';

  const TrendIcon =
    metric.trend === 'up'
      ? TrendingUp
      : metric.trend === 'down'
        ? TrendingDown
        : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metric.value}</div>
        {metric.change !== undefined && (
          <div className={cn('text-xs flex items-center gap-1 mt-1', trendColor)}>
            {TrendIcon && <TrendIcon className="h-3 w-3" />}
            <span>
              {metric.change > 0 ? '+' : ''}
              {metric.change}%
            </span>
            {metric.changeLabel && (
              <span className="text-muted-foreground">{metric.changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PerformanceReport({
  dateRange,
  metrics,
  timeSeriesData,
  categoryData,
  className,
}: PerformanceReportProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Performance Report
        </h2>
        {dateRange && (
          <p className="text-muted-foreground">
            {dateRange.from.toLocaleDateString()} -{' '}
            {dateRange.to.toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <MetricCard key={index} metric={metric} />
        ))}
      </div>

      {/* Time Series Chart */}
      <AreaChart
        title="Trend Over Time"
        description="Performance metrics tracked over the selected period"
        data={timeSeriesData}
        dataKeys={Object.keys(timeSeriesData[0] || {}).filter(
          (k) => k !== 'date' && k !== 'name',
        )}
        xAxisKey="date"
        height={400}
        stacked
        gradient
      />

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <BarChart
          title="Category Breakdown"
          description="Performance by category"
          data={categoryData}
          dataKeys={Object.keys(categoryData[0] || {}).filter(
            (k) => k !== 'category' && k !== 'name',
          )}
          xAxisKey="category"
          height={350}
        />

        <LineChart
          title="Comparative Analysis"
          description="Side-by-side comparison"
          data={categoryData}
          dataKeys={Object.keys(categoryData[0] || {}).filter(
            (k) => k !== 'category' && k !== 'name',
          )}
          xAxisKey="category"
          height={350}
        />
      </div>
    </div>
  );
}
