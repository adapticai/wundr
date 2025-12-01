'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Props for the MetricCard component.
 */
export interface MetricCardProps {
  /** Title label for the metric */
  title: string;
  /** The metric value to display */
  value: number | string;
  /** Optional change indicator showing trend vs previous period */
  change?: {
    /** Absolute change value */
    value: number;
    /** Percentage change */
    percent: number;
    /** Direction of change */
    trend: 'up' | 'down' | 'stable';
  };
  /** Optional icon displayed in the card */
  icon?: React.ReactNode;
  /** Format for displaying the value */
  format?: 'number' | 'percent' | 'duration' | 'bytes' | 'currency' | 'compact';
  /** Additional CSS classes to apply */
  className?: string;
  /** Show loading skeleton state */
  isLoading?: boolean;
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') {
    return value;
  }

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'duration':
      if (value < 60) {
        return `${Math.round(value)}s`;
      }
      if (value < 3600) {
        return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
      }
      if (value < 86400) {
        return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
      }
      return `${Math.floor(value / 86400)}d ${Math.floor((value % 86400) / 3600)}h`;
    case 'bytes':
      if (value < 1024) {
        return `${value} B`;
      }
      if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`;
      }
      if (value < 1024 * 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      }
      return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
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
    case 'number':
    default:
      return value.toLocaleString();
  }
}

export function MetricCard({
  title,
  value,
  change,
  icon,
  format = 'number',
  className,
  isLoading = false,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className='p-4 sm:p-6'>
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <Skeleton className='h-4 w-24 mb-2' />
              <Skeleton className='h-8 w-32' />
            </div>
            {icon && (
              <Skeleton className='w-10 h-10 sm:w-12 sm:h-12 rounded-lg' />
            )}
          </div>
          <Skeleton className='h-4 w-36 mt-3' />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className='p-4 sm:p-6'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-sans text-muted-foreground truncate'>
              {title}
            </p>
            <p className='text-2xl sm:text-3xl font-heading font-semibold text-foreground mt-1 break-words'>
              {formatValue(value, format)}
            </p>
          </div>
          {icon && (
            <div className='w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0'>
              {icon}
            </div>
          )}
        </div>

        {change && (
          <div className='flex items-center gap-1.5 mt-3'>
            <span
              className={cn(
                'text-sm font-sans font-medium inline-flex items-center gap-0.5',
                change.trend === 'up' &&
                  'text-emerald-600 dark:text-emerald-400',
                change.trend === 'down' && 'text-rose-600 dark:text-rose-400',
                change.trend === 'stable' && 'text-muted-foreground'
              )}
              aria-label={`${change.trend === 'up' ? 'Increased' : change.trend === 'down' ? 'Decreased' : 'No change'} by ${Math.abs(change.percent).toFixed(1)}%`}
            >
              {change.trend === 'up' && (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 10l7-7m0 0l7 7m-7-7v18'
                  />
                </svg>
              )}
              {change.trend === 'down' && (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 14l-7 7m0 0l-7-7m7 7V3'
                  />
                </svg>
              )}
              {change.trend === 'stable' && (
                <svg
                  className='w-4 h-4'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 12h14'
                  />
                </svg>
              )}
              {change.percent !== 0 &&
                `${Math.abs(change.percent).toFixed(1)}%`}
              {change.percent === 0 && 'No change'}
            </span>
            <span className='text-xs font-sans text-muted-foreground'>
              vs previous period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
