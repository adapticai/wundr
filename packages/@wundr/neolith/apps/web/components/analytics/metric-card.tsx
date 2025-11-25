'use client';

import { Card, CardContent } from '@/components/ui/card';
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
  format?: 'number' | 'percent' | 'duration' | 'bytes';
  /** Additional CSS classes to apply */
  className?: string;
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
return `${value}s`;
}
      if (value < 3600) {
return `${Math.floor(value / 60)}m`;
}
      return `${Math.floor(value / 3600)}h`;
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
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
}: MetricCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-sans text-muted-foreground">{title}</p>
            <p className="text-2xl font-heading font-semibold text-foreground mt-1">
              {formatValue(value, format)}
            </p>
          </div>
          {icon && (
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>

        {change && (
          <div className="flex items-center gap-1 mt-2">
            <span
              className={cn(
                'text-sm font-sans font-medium',
                change.trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
                change.trend === 'down' && 'text-rose-600 dark:text-rose-400',
                change.trend === 'stable' && 'text-muted-foreground',
              )}
            >
              {change.trend === 'up' && '↑'}
              {change.trend === 'down' && '↓'}
              {change.percent !== 0 && `${Math.abs(change.percent).toFixed(1)}%`}
            </span>
            <span className="text-xs font-sans text-muted-foreground">vs previous period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
