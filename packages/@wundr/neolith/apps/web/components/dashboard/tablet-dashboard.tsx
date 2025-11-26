/**
 * Tablet Dashboard Component
 * @module components/dashboard/tablet-dashboard
 *
 * Dashboard layout optimized for tablet devices (768px-1024px).
 * Features 2-column grid for metrics, stacked cards, and touch-friendly interactions.
 */
'use client';

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

  return (
    <div className={cn('space-y-6 p-4 md:p-6', className)}>
      {/* Header Section */}
      {(header || actions) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {header && (
            <div className="flex-1">
              {header}
            </div>
          )}
          {actions && (
            <div className="flex flex-wrap gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Metrics Grid - 2 or 4 columns based on orientation */}
      {metrics.length > 0 && (
        <div className={cn(
          'grid gap-4',
          getMetricsColumns(),
        )}>
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}

      {/* Dashboard Cards - Responsive grid */}
      {cards.length > 0 && (
        <div className={cn(
          'grid gap-4 md:gap-6',
          getCardsColumns(),
        )}>
          {cards.map((card) => (
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
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">
          {metric.label}
        </p>
        {metric.icon && (
          <div className="text-muted-foreground">
            {metric.icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <p className="text-2xl md:text-3xl font-semibold text-foreground">
          {metric.value}
        </p>

        {metric.trend && metric.trendValue && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            metric.trend === 'up' && 'text-green-600 dark:text-green-400',
            metric.trend === 'down' && 'text-red-600 dark:text-red-400',
            metric.trend === 'stable' && 'text-muted-foreground',
          )}>
            {metric.trend === 'up' && <TrendUpIcon />}
            {metric.trend === 'down' && <TrendDownIcon />}
            {metric.trend === 'stable' && <TrendFlatIcon />}
            <span>{metric.trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DashboardCardComponent renders a dashboard card with responsive sizing
 */
function DashboardCardComponent({ card }: { card: DashboardCard }) {
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
    <div className={cn(
      'bg-card border border-border rounded-lg p-4 md:p-6',
      'hover:border-primary/50 transition-colors',
      getCardClass(),
    )}>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {card.title}
      </h3>
      <div className="tablet:chart-sm md:tablet:chart-md">
        {card.content}
      </div>
    </div>
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
      <h1 className="text-xl md:text-2xl font-semibold text-foreground">
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">
          {subtitle}
        </p>
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:bg-primary/90';
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
      case 'ghost':
        return 'hover:bg-muted text-foreground';
      default:
        return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2',
        'text-sm font-medium transition-colors',
        'min-h-[44px] min-w-[44px]', // Touch-friendly minimum size
        'touch-manipulation', // Optimize for touch
        getVariantClass(),
        className,
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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function TrendDownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrendFlatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M5 12h14" />
    </svg>
  );
}
