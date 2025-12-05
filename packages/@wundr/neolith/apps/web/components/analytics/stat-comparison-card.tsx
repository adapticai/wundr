'use client';

import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


export interface ComparisonPeriod {
  /** Label for the period */
  label: string;
  /** Value for this period */
  value: number;
  /** Optional metadata */
  metadata?: {
    /** Number of items/transactions */
    count?: number;
    /** Average value */
    average?: number;
    /** Peak value */
    peak?: number;
  };
}

export interface StatComparisonCardProps {
  /** Title of the comparison */
  title: string;
  /** Current period data */
  current: ComparisonPeriod;
  /** Previous period data */
  previous: ComparisonPeriod;
  /** Format type for value display */
  format?: 'number' | 'currency' | 'percentage' | 'duration' | 'compact';
  /** Icon component */
  icon?: React.ReactNode;
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Comparison mode */
  mode?: 'absolute' | 'percentage' | 'both';
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function formatValue(
  value: number,
  format: StatComparisonCardProps['format'] = 'number',
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

function calculateChange(current: number, previous: number) {
  if (previous === 0) {
    return { absolute: current, percentage: current > 0 ? 100 : 0 };
  }
  const absolute = current - previous;
  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  return { absolute, percentage };
}

function getTrendInfo(change: number) {
  if (change > 0) {
    return {
      direction: 'up' as const,
      icon: <TrendingUp className='w-4 h-4' />,
      color:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400',
    };
  }
  if (change < 0) {
    return {
      direction: 'down' as const,
      icon: <TrendingDown className='w-4 h-4' />,
      color:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
    };
  }
  return {
    direction: 'stable' as const,
    icon: <Minus className='w-4 h-4' />,
    color: 'border-muted bg-muted text-muted-foreground',
  };
}

export function StatComparisonCard({
  title,
  current,
  previous,
  format = 'number',
  icon,
  showDetails = false,
  mode = 'both',
  isLoading = false,
  className,
}: StatComparisonCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <Skeleton className='h-5 w-40' />
            <Skeleton className='w-10 h-10 rounded-lg' />
          </div>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <Skeleton className='h-24 w-full' />
            <Skeleton className='h-16 w-full' />
          </div>
        </CardContent>
      </Card>
    );
  }

  const change = calculateChange(current.value, previous.value);
  const trend = getTrendInfo(change.absolute);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-base font-medium'>{title}</CardTitle>
          {icon && (
            <div className='w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center'>
              {icon}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        {/* Period comparison */}
        <div className='grid grid-cols-2 gap-4'>
          {/* Previous period */}
          <div className='space-y-1'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              {previous.label}
            </p>
            <p className='text-2xl font-bold text-muted-foreground/70'>
              {formatValue(previous.value, format)}
            </p>
            {showDetails && previous.metadata && (
              <div className='text-xs text-muted-foreground space-y-0.5 mt-2'>
                {previous.metadata.count !== undefined && (
                  <p>Count: {previous.metadata.count.toLocaleString()}</p>
                )}
                {previous.metadata.average !== undefined && (
                  <p>
                    Avg: {formatValue(previous.metadata.average, format)}
                  </p>
                )}
                {previous.metadata.peak !== undefined && (
                  <p>Peak: {formatValue(previous.metadata.peak, format)}</p>
                )}
              </div>
            )}
          </div>

          {/* Arrow indicator */}
          <div className='flex items-center justify-center'>
            <ArrowRight className='w-6 h-6 text-muted-foreground/40' />
          </div>

          {/* Current period */}
          <div className='space-y-1'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              {current.label}
            </p>
            <p className='text-2xl font-bold'>
              {formatValue(current.value, format)}
            </p>
            {showDetails && current.metadata && (
              <div className='text-xs text-muted-foreground space-y-0.5 mt-2'>
                {current.metadata.count !== undefined && (
                  <p>Count: {current.metadata.count.toLocaleString()}</p>
                )}
                {current.metadata.average !== undefined && (
                  <p>
                    Avg: {formatValue(current.metadata.average, format)}
                  </p>
                )}
                {current.metadata.peak !== undefined && (
                  <p>Peak: {formatValue(current.metadata.peak, format)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Change indicator */}
        <div className='pt-3 border-t'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium text-muted-foreground'>
              Change
            </span>
            <div className='flex items-center gap-2'>
              {(mode === 'absolute' || mode === 'both') && (
                <Badge variant='outline' className={trend.color}>
                  <span className='flex items-center gap-1'>
                    {trend.icon}
                    {change.absolute > 0 && '+'}
                    {formatValue(change.absolute, format)}
                  </span>
                </Badge>
              )}
              {(mode === 'percentage' || mode === 'both') && (
                <Badge variant='outline' className={trend.color}>
                  <span className='flex items-center gap-1'>
                    {trend.icon}
                    {change.percentage > 0 && '+'}
                    {change.percentage.toFixed(1)}%
                  </span>
                </Badge>
              )}
            </div>
          </div>

          {/* Progress bar visualization */}
          <div className='mt-3 space-y-2'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>Previous</span>
              <span>Current</span>
            </div>
            <div className='relative h-2 bg-muted rounded-full overflow-hidden'>
              <div
                className={cn(
                  'absolute h-full transition-all duration-500',
                  change.absolute > 0
                    ? 'bg-emerald-500'
                    : change.absolute < 0
                      ? 'bg-rose-500'
                      : 'bg-muted-foreground',
                )}
                style={{
                  width: `${Math.min(
                    (previous.value /
                      Math.max(current.value, previous.value)) *
                      100,
                    100,
                  )}%`,
                }}
              />
              <div
                className={cn(
                  'absolute h-full transition-all duration-500',
                  change.absolute > 0
                    ? 'bg-emerald-600'
                    : change.absolute < 0
                      ? 'bg-rose-600'
                      : 'bg-muted-foreground',
                )}
                style={{
                  width: `${Math.min(
                    (current.value /
                      Math.max(current.value, previous.value)) *
                      100,
                    100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
