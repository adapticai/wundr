'use client';

import { clsx } from 'clsx';

export interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  className?: string;
}

export function BarChart({
  data,
  title,
  orientation = 'horizontal',
  showValues = true,
  className,
}: BarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  if (data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className={className}>
        {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}

        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="w-24 text-sm text-muted-foreground truncate" title={item.label}>
                {item.label}
              </span>
              <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color || '#78716c',
                  }}
                />
              </div>
              {showValues && (
                <span className="w-16 text-sm text-foreground text-right">
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}

      <div className="flex items-end gap-2 h-48">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || '#78716c',
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground mt-1 truncate max-w-full" title={item.label}>
              {item.label}
            </span>
            {showValues && (
              <span className="text-xs text-foreground">{item.value.toLocaleString()}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
