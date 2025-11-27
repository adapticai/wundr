'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import type { MetricTimeRange, VPAnalytics, VPMetrics } from '@/types/orchestrator-analytics';

interface VPAnalyticsCardProps {
  vpId: string;
  className?: string;
  timeRange?: MetricTimeRange;
}

/**
 * OrchestratorAnalytics Card Component
 *
 * Displays key performance metrics and analytics for a VP.
 * Shows task completion rates, average duration, and trend indicators.
 */
export function VPAnalyticsCard({
  vpId,
  className,
  timeRange = '7d',
}: VPAnalyticsCardProps) {
  const [metrics, setMetrics] = useState<VPMetrics | null>(null);
  const [analytics, setAnalytics] = useState<VPAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/orchestrators/${vpId}/analytics?timeRange=${timeRange}`,
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
  }, [vpId, timeRange]);

  if (loading) {
    return <VPAnalyticsCardSkeleton className={className} />;
  }

  if (error || !metrics || !analytics) {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/50 bg-destructive/10 p-4',
          className,
        )}
      >
        <p className="text-sm font-sans text-destructive">
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
    'all': 'All Time',
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-5 shadow-sm',
        className,
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground">
          Performance Analytics
        </h3>
        <span className="text-sm font-sans text-muted-foreground">
          {timeRangeLabels[metrics.timeRange]}
        </span>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Tasks Completed */}
        <MetricItem
          label="Completed"
          value={metrics.tasksCompleted}
          icon={<CheckIcon className="h-4 w-4" />}
          color="text-green-600 dark:text-green-400"
        />

        {/* Success Rate */}
        <MetricItem
          label="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          icon={<TargetIcon className="h-4 w-4" />}
          color="text-blue-600 dark:text-blue-400"
        />

        {/* In Progress */}
        <MetricItem
          label="In Progress"
          value={metrics.tasksInProgress}
          icon={<ClockIcon className="h-4 w-4" />}
          color="text-yellow-600 dark:text-yellow-400"
        />

        {/* Avg Duration */}
        <MetricItem
          label="Avg Duration"
          value={
            metrics.avgDurationMinutes
              ? formatDuration(metrics.avgDurationMinutes)
              : 'N/A'
          }
          icon={<TimerIcon className="h-4 w-4" />}
          color="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Summary Stats */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between text-sm font-sans">
          <span className="text-muted-foreground">Total Assigned</span>
          <span className="font-medium text-foreground">
            {metrics.totalTasksAssigned}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm font-sans">
          <span className="text-muted-foreground">Failed</span>
          <span className="font-medium text-destructive">
            {metrics.tasksFailed}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm font-sans">
          <span className="text-muted-foreground">Cancelled</span>
          <span className="font-medium text-muted-foreground">
            {metrics.tasksCancelled}
          </span>
        </div>
      </div>

      {/* Trend Indicator */}
      {analytics.summary.trendDirection !== 'stable' && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/50 p-2">
          {analytics.summary.trendDirection === 'up' ? (
            <TrendUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <TrendDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <span className="text-xs font-sans text-muted-foreground">
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
    <div className="flex items-center gap-3 rounded-md border bg-background p-3">
      <div className={cn('flex-shrink-0', color)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-sans text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-heading text-lg font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton
 */
export function VPAnalyticsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-5 shadow-sm', className)}>
      {/* Header Skeleton */}
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border bg-background p-3"
          >
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-5 w-12 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Summary Skeleton */}
      <div className="border-t pt-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-12 animate-pulse rounded bg-muted" />
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

// Icons

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function TimerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}
