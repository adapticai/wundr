'use client';

import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Re-export React import for the useEffect hook

export interface KPITrend {
  /** Current period value */
  current: number;
  /** Previous period value for comparison */
  previous: number;
  /** Percentage change */
  percentageChange: number;
  /** Direction of trend */
  direction: 'up' | 'down' | 'stable';
  /** Whether the trend is positive for the business context */
  isPositive: boolean;
}

export interface KPICardProps {
  /** Title of the KPI */
  title: string;
  /** Main value to display */
  value: number | string;
  /** Trend data for comparison */
  trend?: KPITrend;
  /** Icon component to display */
  icon?: React.ReactNode;
  /** Format type for value display */
  format?: 'number' | 'currency' | 'percentage' | 'duration' | 'compact';
  /** Optional description or tooltip */
  description?: string;
  /** Target value for this KPI */
  target?: number;
  /** Status badge */
  status?: 'success' | 'warning' | 'danger' | 'info';
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Update interval for real-time data */
  updateInterval?: number;
  /** Callback for data refresh */
  onRefresh?: () => void;
}

function formatValue(
  value: number | string,
  format: KPICardProps['format'] = 'number'
): string {
  if (typeof value === 'string') {
    return value;
  }

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
    case 'duration':
      if (value < 60) {
        return `${Math.round(value)}s`;
      }
      if (value < 3600) {
        return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
      }
      return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
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

function getTrendIcon(direction: KPITrend['direction']) {
  switch (direction) {
    case 'up':
      return <TrendingUp className='w-4 h-4' />;
    case 'down':
      return <TrendingDown className='w-4 h-4' />;
    default:
      return <Minus className='w-4 h-4' />;
  }
}

function getStatusColor(status: KPICardProps['status']) {
  switch (status) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'warning':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'danger':
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
    case 'info':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function KPICard({
  title,
  value,
  trend,
  icon,
  format = 'number',
  description,
  target,
  status,
  isLoading = false,
  className,
  updateInterval,
  onRefresh,
}: KPICardProps) {
  // Real-time update effect
  React.useEffect(() => {
    if (updateInterval && onRefresh) {
      const interval = setInterval(onRefresh, updateInterval);
      return () => clearInterval(interval);
    }
  }, [updateInterval, onRefresh]);

  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardContent className='p-6'>
          <div className='flex items-start justify-between mb-4'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='w-10 h-10 rounded-lg' />
          </div>
          <Skeleton className='h-10 w-40 mb-3' />
          <Skeleton className='h-5 w-28' />
        </CardContent>
      </Card>
    );
  }

  const targetProgress =
    target && typeof value === 'number'
      ? Math.min((value / target) * 100, 100)
      : null;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all hover:shadow-md',
        className
      )}
    >
      <CardContent className='p-6'>
        {/* Header with title and icon */}
        <div className='flex items-start justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <h3 className='text-sm font-medium text-muted-foreground'>
              {title}
            </h3>
            {description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className='text-muted-foreground hover:text-foreground transition-colors'>
                      <Info className='w-4 h-4' />
                      <span className='sr-only'>More information</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className='max-w-xs'>{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                status ? getStatusColor(status) : 'bg-primary/10 text-primary'
              )}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Main value */}
        <div className='mb-3'>
          <p className='text-3xl font-bold tracking-tight'>
            {formatValue(value, format)}
          </p>
          {target && targetProgress !== null && (
            <p className='text-sm text-muted-foreground mt-1'>
              of {formatValue(target, format)} target
            </p>
          )}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className='flex items-center gap-2'>
            <Badge
              variant='outline'
              className={cn(
                'flex items-center gap-1 font-medium',
                trend.isPositive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400'
              )}
            >
              {getTrendIcon(trend.direction)}
              <span>
                {trend.percentageChange > 0 ? '+' : ''}
                {trend.percentageChange.toFixed(1)}%
              </span>
            </Badge>
            <span className='text-xs text-muted-foreground'>
              vs previous period
            </span>
          </div>
        )}

        {/* Target progress bar */}
        {target && targetProgress !== null && (
          <div className='mt-4'>
            <div className='w-full bg-muted rounded-full h-2 overflow-hidden'>
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  targetProgress >= 100
                    ? 'bg-emerald-500'
                    : targetProgress >= 75
                      ? 'bg-blue-500'
                      : targetProgress >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                )}
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              {targetProgress.toFixed(0)}% of target
            </p>
          </div>
        )}

        {/* Status badge */}
        {status && !icon && (
          <div className='mt-3'>
            <Badge variant='outline' className={getStatusColor(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
