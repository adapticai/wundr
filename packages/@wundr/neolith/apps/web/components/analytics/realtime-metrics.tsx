'use client';

import { Activity, Users, TrendingUp, Clock } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface RealtimeMetric {
  /** Unique identifier */
  id: string;
  /** Metric label */
  label: string;
  /** Current value */
  value: number;
  /** Previous value for comparison */
  previousValue?: number;
  /** Format type */
  format?: 'number' | 'currency' | 'percentage' | 'compact';
  /** Status indicator */
  status?: 'active' | 'warning' | 'inactive';
  /** Last updated timestamp */
  lastUpdated?: Date;
}

export interface RealtimeMetricsProps {
  /** Array of metrics to display */
  metrics: RealtimeMetric[];
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Callback to fetch new data */
  onUpdate?: () => Promise<RealtimeMetric[]>;
  /** Show live indicator */
  showLiveIndicator?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function formatValue(
  value: number,
  format: RealtimeMetric['format'] = 'number'
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'compact':
      if (value < 1000) {
        return value.toLocaleString();
      }
      if (value < 1000000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      if (value < 1000000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      return `${(value / 1000000000).toFixed(1)}B`;
    default:
      return value.toLocaleString();
  }
}

function getStatusColor(status: RealtimeMetric['status']) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'inactive':
      return 'bg-gray-400';
    default:
      return 'bg-blue-500';
  }
}

function LiveIndicator({ isActive }: { isActive: boolean }) {
  return (
    <div className='flex items-center gap-2'>
      <div className='relative'>
        <div
          className={cn(
            'w-2 h-2 rounded-full',
            isActive ? 'bg-emerald-500' : 'bg-gray-400'
          )}
        />
        {isActive && (
          <div className='absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping' />
        )}
      </div>
      <span className='text-xs text-muted-foreground'>
        {isActive ? 'Live' : 'Paused'}
      </span>
    </div>
  );
}

export function RealtimeMetrics({
  metrics: initialMetrics,
  updateInterval = 5000,
  onUpdate,
  showLiveIndicator = true,
  className,
}: RealtimeMetricsProps) {
  const [metrics, setMetrics] =
    React.useState<RealtimeMetric[]>(initialMetrics);
  const [isLive, setIsLive] = React.useState(true);
  const [lastUpdate, setLastUpdate] = React.useState<Date>(new Date());

  React.useEffect(() => {
    if (!isLive || !onUpdate) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const newMetrics = await onUpdate();
        setMetrics(newMetrics);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to update metrics:', error);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isLive, onUpdate, updateInterval]);

  const toggleLive = () => setIsLive(!isLive);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-medium flex items-center gap-2'>
            <Activity className='w-4 h-4' />
            Real-time Metrics
          </CardTitle>
          {showLiveIndicator && (
            <button
              onClick={toggleLive}
              className='transition-opacity hover:opacity-70'
            >
              <LiveIndicator isActive={isLive} />
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className='space-y-3'>
        {metrics.map(metric => {
          const change =
            metric.previousValue !== undefined
              ? metric.value - metric.previousValue
              : 0;
          const hasChanged = change !== 0;

          return (
            <div
              key={metric.id}
              className={cn(
                'p-3 rounded-lg border transition-all',
                hasChanged && 'animate-pulse-once'
              )}
            >
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2'>
                  {metric.status && (
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        getStatusColor(metric.status)
                      )}
                    />
                  )}
                  <span className='text-sm font-medium text-muted-foreground'>
                    {metric.label}
                  </span>
                </div>
                {metric.lastUpdated && (
                  <span className='text-xs text-muted-foreground flex items-center gap-1'>
                    <Clock className='w-3 h-3' />
                    {new Date(metric.lastUpdated).toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className='flex items-end justify-between'>
                <span className='text-2xl font-bold'>
                  {formatValue(metric.value, metric.format)}
                </span>
                {hasChanged && (
                  <Badge
                    variant='outline'
                    className={cn(
                      'text-xs',
                      change > 0
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400'
                    )}
                  >
                    {change > 0 ? '+' : ''}
                    {formatValue(Math.abs(change), metric.format)}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}

        <div className='pt-3 border-t text-xs text-muted-foreground text-center'>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}

export interface RealtimeActivityFeedProps {
  /** Array of activity items */
  activities: Array<{
    id: string;
    type: 'user' | 'system' | 'alert' | 'success';
    message: string;
    timestamp: Date;
    metadata?: Record<string, any>;
  }>;
  /** Maximum items to display */
  maxItems?: number;
  /** Additional CSS classes */
  className?: string;
}

export function RealtimeActivityFeed({
  activities,
  maxItems = 10,
  className,
}: RealtimeActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <Users className='w-4 h-4' />;
      case 'alert':
        return <Activity className='w-4 h-4 text-amber-500' />;
      case 'success':
        return <TrendingUp className='w-4 h-4 text-emerald-500' />;
      default:
        return <Activity className='w-4 h-4' />;
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base font-medium flex items-center gap-2'>
          <Activity className='w-4 h-4' />
          Activity Feed
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className='space-y-2 max-h-96 overflow-y-auto'>
          {displayedActivities.map((activity, index) => (
            <div
              key={activity.id}
              className={cn(
                'p-3 rounded-lg border transition-all',
                index === 0 && 'bg-accent/50'
              )}
            >
              <div className='flex items-start gap-3'>
                <div className='mt-0.5'>{getActivityIcon(activity.type)}</div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-foreground break-words'>
                    {activity.message}
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    {activity.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
