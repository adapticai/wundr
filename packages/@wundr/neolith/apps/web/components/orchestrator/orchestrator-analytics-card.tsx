'use client';

import {
  Check,
  Target,
  Clock,
  Timer,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import type {
  MetricTimeRange,
  OrchestratorAnalytics,
  OrchestratorMetrics,
} from '@/types/orchestrator-analytics';

interface OrchestratorAnalyticsCardProps {
  orchestratorId: string;
  className?: string;
  timeRange?: MetricTimeRange;
}

/**
 * OrchestratorAnalytics Card Component
 *
 * Displays key performance metrics and analytics for an Orchestrator.
 * Shows task completion rates, average duration, and trend indicators.
 */
export function OrchestratorAnalyticsCard({
  orchestratorId,
  className,
  timeRange = '7d',
}: OrchestratorAnalyticsCardProps) {
  const [metrics, setMetrics] = useState<OrchestratorMetrics | null>(null);
  const [analytics, setAnalytics] = useState<OrchestratorAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/orchestrators/${orchestratorId}/analytics?timeRange=${timeRange}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const data = await response.json();
        setMetrics(data.metrics);
        setAnalytics(data.data);
      } catch (err) {
        console.error('Error fetching Orchestrator analytics:', err);
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [orchestratorId, timeRange]);

  if (loading) {
    return <OrchestratorAnalyticsCardSkeleton className={className} />;
  }

  if (error || !metrics || !analytics) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/10 p-4',
          className
        )}
      >
        <p className='text-sm font-sans text-destructive'>
          {error || 'No analytics data available'}
        </p>
      </div>
    );
  }

  const timeRangeLabels: Record<MetricTimeRange, string> = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    all: 'All Time',
  };

  return (
    <div className={cn('rounded-lg border bg-card p-5 shadow-sm', className)}>
      {/* Header */}
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='font-heading font-semibold text-foreground'>
          Performance Analytics
        </h3>
        <span className='text-sm font-sans text-muted-foreground'>
          {timeRangeLabels[metrics.timeRange]}
        </span>
      </div>

      {/* Key Metrics Grid */}
      <div className='grid grid-cols-2 gap-4 mb-4'>
        {/* Tasks Completed */}
        <MetricItem
          label='Completed'
          value={metrics.tasksCompleted}
          icon={<Check className='h-4 w-4' />}
          color='text-green-600 dark:text-green-400'
        />

        {/* Success Rate */}
        <MetricItem
          label='Success Rate'
          value={`${metrics.successRate.toFixed(1)}%`}
          icon={<Target className='h-4 w-4' />}
          color='text-blue-600 dark:text-blue-400'
        />

        {/* In Progress */}
        <MetricItem
          label='In Progress'
          value={metrics.tasksInProgress}
          icon={<Clock className='h-4 w-4' />}
          color='text-yellow-600 dark:text-yellow-400'
        />

        {/* Avg Duration */}
        <MetricItem
          label='Avg Duration'
          value={
            metrics.avgDurationMinutes
              ? formatDuration(metrics.avgDurationMinutes)
              : 'N/A'
          }
          icon={<Timer className='h-4 w-4' />}
          color='text-purple-600 dark:text-purple-400'
        />
      </div>

      {/* Summary Stats */}
      <div className='border-t pt-4 space-y-2'>
        <div className='flex items-center justify-between text-sm font-sans'>
          <span className='text-muted-foreground'>Total Assigned</span>
          <span className='font-medium text-foreground'>
            {metrics.totalTasksAssigned}
          </span>
        </div>

        <div className='flex items-center justify-between text-sm font-sans'>
          <span className='text-muted-foreground'>Failed</span>
          <span className='font-medium text-destructive'>
            {metrics.tasksFailed}
          </span>
        </div>

        <div className='flex items-center justify-between text-sm font-sans'>
          <span className='text-muted-foreground'>Cancelled</span>
          <span className='font-medium text-muted-foreground'>
            {metrics.tasksCancelled}
          </span>
        </div>
      </div>

      {/* Trend Indicator */}
      {analytics.summary.trendDirection !== 'stable' && (
        <div className='mt-4 flex items-center gap-2 rounded-md bg-muted/50 p-2'>
          {analytics.summary.trendDirection === 'up' ? (
            <TrendingUp className='h-4 w-4 text-green-600 dark:text-green-400' />
          ) : (
            <TrendingDown className='h-4 w-4 text-red-600 dark:text-red-400' />
          )}
          <span className='text-xs font-sans text-muted-foreground'>
            Performance trending{' '}
            {analytics.summary.trendDirection === 'up' ? 'upward' : 'downward'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Metric Item
 */
interface MetricItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function MetricItem({ label, value, icon, color }: MetricItemProps) {
  return (
    <div className='flex items-center gap-3 rounded-md border bg-background p-3'>
      <div className={cn('flex-shrink-0', color)}>{icon}</div>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-xs font-sans text-muted-foreground'>
          {label}
        </p>
        <p className='truncate font-heading text-lg font-semibold text-foreground'>
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton
 */
export function OrchestratorAnalyticsCardSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-5 shadow-sm', className)}>
      {/* Header Skeleton */}
      <div className='mb-4 flex items-center justify-between'>
        <div className='h-6 w-40 animate-pulse rounded bg-muted' />
        <div className='h-4 w-24 animate-pulse rounded bg-muted' />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className='grid grid-cols-2 gap-4 mb-4'>
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className='flex items-center gap-3 rounded-md border bg-background p-3'
          >
            <div className='h-8 w-8 animate-pulse rounded bg-muted' />
            <div className='flex-1 space-y-2'>
              <div className='h-3 w-16 animate-pulse rounded bg-muted' />
              <div className='h-5 w-12 animate-pulse rounded bg-muted' />
            </div>
          </div>
        ))}
      </div>

      {/* Summary Skeleton */}
      <div className='border-t pt-4 space-y-2'>
        {[1, 2, 3].map(i => (
          <div key={i} className='flex items-center justify-between'>
            <div className='h-4 w-24 animate-pulse rounded bg-muted' />
            <div className='h-4 w-12 animate-pulse rounded bg-muted' />
          </div>
        ))}
      </div>
    </div>
  );
}

// Utility Functions

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
