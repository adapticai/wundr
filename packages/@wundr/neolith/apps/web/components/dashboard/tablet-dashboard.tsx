/**
 * Tablet Dashboard Component
 * @module components/dashboard/tablet-dashboard
 *
 * Dashboard layout optimized for tablet devices (768px-1024px).
 * Features 2-column grid for metrics, stacked cards, and touch-friendly interactions.
 */
'use client';

import * as React from 'react';

import { useIsTablet, useOrientation } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: React.ReactNode;
}

export interface DashboardCard {
  id: string;
  title: string;
  content: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export interface TabletDashboardProps {
  metrics?: DashboardMetric[];
  cards?: DashboardCard[];
  header?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  error?: Error | string;
  onRetry?: () => void;
  emptyStateMessage?: string;
}

/**
 * TabletDashboard provides an optimized layout for tablet devices:
 *
 * - 2-column grid for key metrics
 * - Responsive card layout based on orientation
 * - Touch-friendly interaction areas (min 44x44px)
 * - Optimized spacing and typography for tablets
 * - Landscape/portrait mode support
 *
 * @example
 * ```tsx
 * <TabletDashboard
 *   metrics={[
 *     { id: '1', label: 'Total Users', value: '1,234', trend: 'up', trendValue: '+12%' },
 *     { id: '2', label: 'Revenue', value: '$45.2K', trend: 'up', trendValue: '+8%' }
 *   ]}
 *   cards={[
 *     { id: '1', title: 'Activity', content: <ActivityChart /> }
 *   ]}
 * />
 * ```
 */
export function TabletDashboard({
  metrics = [],
  cards = [],
  header,
  actions,
  className,
  isLoading = false,
  error,
  onRetry,
  emptyStateMessage = 'No data available',
}: TabletDashboardProps) {
  const isTablet = useIsTablet();
  const orientation = useOrientation();

  // Determine grid columns based on orientation and metrics count
  const getMetricsColumns = () => {
    if (!isTablet) {
      return 'grid-cols-2 sm:grid-cols-4';
    }
    if (orientation === 'portrait') {
      return 'grid-cols-2';
    }
    return 'grid-cols-4';
  };

  const getCardsColumns = () => {
    if (!isTablet) {
      return 'grid-cols-1 lg:grid-cols-2';
    }
    if (orientation === 'portrait') {
      return 'grid-cols-1';
    }
    return 'grid-cols-2';
  };

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-6 p-4 md:p-6', className)}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6 p-4 md:p-6', className)}>
        <LoadingState metricsCount={4} cardsCount={2} />
      </div>
    );
  }

  // Empty state
  const isEmpty = metrics.length === 0 && cards.length === 0;
  if (isEmpty) {
    return (
      <div className={cn('space-y-6 p-4 md:p-6', className)}>
        <EmptyState message={emptyStateMessage} />
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-6 p-4 md:p-6', className)}
      role='main'
      aria-label='Dashboard'
    >
      {/* Header Section */}
      {(header || actions) && (
        <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
          {header && <div className='flex-1'>{header}</div>}
          {actions && (
            <div
              className='flex flex-wrap gap-2'
              role='toolbar'
              aria-label='Dashboard actions'
            >
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Metrics Grid - 2 or 4 columns based on orientation */}
      {metrics.length > 0 && (
        <div
          className={cn('grid gap-4', getMetricsColumns())}
          role='region'
          aria-label='Key metrics'
        >
          {metrics.map(metric => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}

      {/* Dashboard Cards - Responsive grid */}
      {cards.length > 0 && (
        <div
          className={cn('grid gap-4 md:gap-6', getCardsColumns())}
          role='region'
          aria-label='Dashboard cards'
        >
          {cards.map(card => (
            <DashboardCardComponent key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MetricCard displays a single metric with optional trend indicator
 */
function MetricCard({ metric }: { metric: DashboardMetric }) {
  if (!metric || !metric.id) {
    return null;
  }

  const getTrendAriaLabel = () => {
    if (!metric.trend || !metric.trendValue) {
      return '';
    }
    const direction =
      metric.trend === 'up'
        ? 'increased'
        : metric.trend === 'down'
          ? 'decreased'
          : 'stable';
    return `${direction} by ${metric.trendValue}`;
  };

  return (
    <article
      className='bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors'
      role='article'
      aria-label={`${metric.label} metric`}
    >
      <div className='flex items-start justify-between mb-2'>
        <p
          className='text-sm font-medium text-muted-foreground'
          id={`metric-label-${metric.id}`}
        >
          {metric.label}
        </p>
        {metric.icon && (
          <div className='text-muted-foreground' aria-hidden='true'>
            {metric.icon}
          </div>
        )}
      </div>

      <div className='flex items-end justify-between'>
        <p
          className='text-2xl md:text-3xl font-semibold text-foreground'
          aria-labelledby={`metric-label-${metric.id}`}
        >
          {metric.value}
        </p>

        {metric.trend && metric.trendValue && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              metric.trend === 'up' && 'text-green-600 dark:text-green-400',
              metric.trend === 'down' && 'text-red-600 dark:text-red-400',
              metric.trend === 'stable' && 'text-muted-foreground'
            )}
            role='status'
            aria-label={getTrendAriaLabel()}
          >
            {metric.trend === 'up' && <TrendUpIcon aria-hidden='true' />}
            {metric.trend === 'down' && <TrendDownIcon aria-hidden='true' />}
            {metric.trend === 'stable' && <TrendFlatIcon aria-hidden='true' />}
            <span aria-hidden='true'>{metric.trendValue}</span>
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * DashboardCardComponent renders a dashboard card with responsive sizing
 */
function DashboardCardComponent({ card }: { card: DashboardCard }) {
  if (!card || !card.id) {
    return null;
  }

  const getCardClass = () => {
    if (!card.size) {
      return '';
    }

    switch (card.size) {
      case 'small':
        return 'md:col-span-1';
      case 'large':
        return 'md:col-span-2';
      default:
        return '';
    }
  };

  return (
    <section
      className={cn(
        'bg-card border border-border rounded-lg p-4 md:p-6',
        'hover:border-primary/50 transition-colors',
        getCardClass()
      )}
      aria-labelledby={`card-title-${card.id}`}
    >
      <h3
        id={`card-title-${card.id}`}
        className='text-lg font-semibold text-foreground mb-4'
      >
        {card.title}
      </h3>
      <div className='tablet:chart-sm md:tablet:chart-md'>{card.content}</div>
    </section>
  );
}

/**
 * TabletDashboardHeader - Standardized header component
 */
export function TabletDashboardHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className='text-xl md:text-2xl font-semibold text-foreground'>
        {title}
      </h1>
      {subtitle && (
        <p className='text-sm text-muted-foreground mt-1'>{subtitle}</p>
      )}
    </div>
  );
}

/**
 * TabletDashboardAction - Touch-friendly action button
 */
export function TabletDashboardAction({
  children,
  onClick,
  variant = 'primary',
  className,
  disabled = false,
  ariaLabel,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-secondary/50';
      case 'ghost':
        return 'hover:bg-muted text-foreground disabled:text-muted-foreground';
      default:
        return '';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2',
        'text-sm font-medium transition-colors',
        'min-h-[44px] min-w-[44px]', // Touch-friendly minimum size
        'touch-manipulation', // Optimize for touch
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        getVariantClass(),
        className
      )}
    >
      {children}
    </button>
  );
}

// Trend Icons
function TrendUpIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <path d='m18 15-6-6-6 6' />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );
}

function TrendFlatIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='w-4 h-4'
    >
      <path d='M5 12h14' />
    </svg>
  );
}

/**
 * LoadingState - Skeleton loading UI
 */
function LoadingState({
  metricsCount = 4,
  cardsCount = 2,
}: {
  metricsCount?: number;
  cardsCount?: number;
}) {
  return (
    <div
      className='space-y-6'
      role='status'
      aria-label='Loading dashboard data'
    >
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {Array.from({ length: metricsCount }).map((_, i) => (
          <div
            key={i}
            className='bg-card border border-border rounded-lg p-4 animate-pulse'
          >
            <div className='h-4 bg-muted rounded w-2/3 mb-4' />
            <div className='h-8 bg-muted rounded w-1/2' />
          </div>
        ))}
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6'>
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div
            key={i}
            className='bg-card border border-border rounded-lg p-4 md:p-6 animate-pulse'
          >
            <div className='h-6 bg-muted rounded w-1/3 mb-4' />
            <div className='h-64 bg-muted rounded' />
          </div>
        ))}
      </div>
      <span className='sr-only'>Loading dashboard content...</span>
    </div>
  );
}

/**
 * ErrorState - Error message with retry option
 */
function ErrorState({
  error,
  onRetry,
}: {
  error: Error | string;
  onRetry?: () => void;
}) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div
      className='flex flex-col items-center justify-center min-h-[400px] text-center p-6'
      role='alert'
      aria-live='assertive'
    >
      <div className='rounded-full bg-destructive/10 p-3 mb-4'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-6 h-6 text-destructive'
          aria-hidden='true'
        >
          <circle cx='12' cy='12' r='10' />
          <line x1='12' y1='8' x2='12' y2='12' />
          <line x1='12' y1='16' x2='12.01' y2='16' />
        </svg>
      </div>
      <h3 className='text-lg font-semibold text-foreground mb-2'>
        Unable to load dashboard
      </h3>
      <p className='text-sm text-muted-foreground mb-6 max-w-md'>
        {errorMessage}
      </p>
      {onRetry && (
        <TabletDashboardAction
          onClick={onRetry}
          variant='primary'
          ariaLabel='Retry loading dashboard'
        >
          Try Again
        </TabletDashboardAction>
      )}
    </div>
  );
}

/**
 * EmptyState - No data available message
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div
      className='flex flex-col items-center justify-center min-h-[400px] text-center p-6'
      role='status'
      aria-label='No dashboard data'
    >
      <div className='rounded-full bg-muted p-3 mb-4'>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='w-6 h-6 text-muted-foreground'
          aria-hidden='true'
        >
          <rect x='3' y='3' width='18' height='18' rx='2' ry='2' />
          <line x1='9' y1='9' x2='15' y2='15' />
          <line x1='15' y1='9' x2='9' y2='15' />
        </svg>
      </div>
      <h3 className='text-lg font-semibold text-foreground mb-2'>
        No Data Available
      </h3>
      <p className='text-sm text-muted-foreground max-w-md'>{message}</p>
    </div>
  );
}
