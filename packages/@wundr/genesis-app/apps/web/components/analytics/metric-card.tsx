'use client';

import { clsx } from 'clsx';

export interface MetricCardProps {
  title: string;
  value: number | string;
  change?: {
    value: number;
    percent: number;
    trend: 'up' | 'down' | 'stable';
  };
  icon?: React.ReactNode;
  format?: 'number' | 'percent' | 'duration' | 'bytes';
  className?: string;
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') return value;

  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'duration':
      if (value < 60) return `${value}s`;
      if (value < 3600) return `${Math.floor(value / 60)}m`;
      return `${Math.floor(value / 3600)}h`;
    case 'bytes':
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
    <div
      className={clsx(
        'p-4 bg-card border border-border rounded-lg',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
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
            className={clsx(
              'text-sm font-medium',
              change.trend === 'up' && 'text-green-500',
              change.trend === 'down' && 'text-red-500',
              change.trend === 'stable' && 'text-muted-foreground'
            )}
          >
            {change.trend === 'up' && '↑'}
            {change.trend === 'down' && '↓'}
            {change.percent !== 0 && `${Math.abs(change.percent).toFixed(1)}%`}
          </span>
          <span className="text-xs text-muted-foreground">vs previous period</span>
        </div>
      )}
    </div>
  );
}
