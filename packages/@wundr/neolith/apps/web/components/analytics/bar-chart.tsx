'use client';

import { clsx } from 'clsx';
import { useState } from 'react';

export interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  showValues?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function BarChart({
  data,
  title,
  orientation = 'horizontal',
  showValues = true,
  className,
  isLoading = false,
}: BarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxValue = Math.max(...data.map(d => d.value), 1);

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className={className}>
        {title && <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>}

        <div className="space-y-2">
          {data.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-center gap-3 relative"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="w-24 text-sm text-muted-foreground truncate" title={item.label}>
                {item.label}
              </span>
              <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative group">
                <div
                  className="h-full rounded transition-all duration-300 hover:opacity-90"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, 2)}%`,
                    backgroundColor: item.color || 'hsl(var(--primary))',
                  }}
                />
                {hoveredIndex === index && (
                  <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md border border-border z-10 whitespace-nowrap">
                    {item.label}: {item.value.toLocaleString()}
                  </div>
                )}
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

      <div className="flex items-end gap-2 h-48 relative">
        {data.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className="flex-1 flex flex-col items-center relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t transition-all duration-300 hover:opacity-90 cursor-pointer"
                style={{
                  height: `${Math.max((item.value / maxValue) * 100, 5)}%`,
                  backgroundColor: item.color || 'hsl(var(--primary))',
                }}
                title={`${item.label}: ${item.value.toLocaleString()}`}
              />
            </div>
            {hoveredIndex === index && (
              <div className="absolute bottom-full mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md border border-border z-10 whitespace-nowrap">
                {item.label}: {item.value.toLocaleString()}
              </div>
            )}
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
