'use client';

import { clsx } from 'clsx';
import { useMemo, useState } from 'react';

/**
 * Props for the LineChart component.
 */
export interface LineChartProps {
  /** Array of data points with date and value */
  data: Array<{ date: string; value: number }>;
  /** Optional title displayed above the chart */
  title?: string;
  /** Line color in CSS format (default: hsl(var(--primary))) */
  color?: string;
  /** Chart height in pixels (default: 200) */
  height?: number;
  /** Whether to show grid lines (default: true) */
  showGrid?: boolean;
  /** Additional CSS classes to apply */
  className?: string;
  /** Loading state */
  isLoading?: boolean;
}

export function LineChart({
  data,
  title,
  color,
  height = 200,
  showGrid = true,
  className,
  isLoading = false,
}: LineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number; date: string } | null>(null);

  const chartColor = color || 'hsl(var(--primary))';

  const { points, pointsArray, maxValue, minValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: '', pointsArray: [], maxValue: 0, minValue: 0 };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const ptsArray = data.map((d, i) => {
      const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 100;
      return { x, y, value: d.value, date: d.date };
    });

    return {
      points: ptsArray.map(p => `${p.x},${p.y}`).join(' '),
      pointsArray: ptsArray,
      maxValue: max,
      minValue: min,
    };
  }, [data]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center', className)} style={{ height }}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>}

      <div className="relative w-full" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground">
          <span>{maxValue.toLocaleString()}</span>
          <span>{Math.round((maxValue + minValue) / 2).toLocaleString()}</span>
          <span>{minValue.toLocaleString()}</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 h-full relative">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Grid lines */}
            {showGrid && (
              <g stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.5">
                <line x1="0" y1="25" x2="100" y2="25" />
                <line x1="0" y1="50" x2="100" y2="50" />
                <line x1="0" y1="75" x2="100" y2="75" />
              </g>
            )}

            {/* Area fill */}
            {points && (
              <polygon
                points={`0,100 ${points} 100,100`}
                fill={chartColor}
                fillOpacity="0.1"
              />
            )}

            {/* Line */}
            {points && (
              <polyline
                points={points}
                fill="none"
                stroke={chartColor}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Interactive points */}
            {pointsArray.map((point, index) => (
              <circle
                key={`point-${index}`}
                cx={point.x}
                cy={point.y}
                r="3"
                fill={chartColor}
                stroke="white"
                strokeWidth="1"
                className="cursor-pointer hover:r-4 transition-all"
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() => setHoveredPoint(point)}
                style={{ pointerEvents: 'all' }}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md border border-border whitespace-nowrap pointer-events-none z-10"
              style={{
                left: `${hoveredPoint.x}%`,
                top: `${hoveredPoint.y}%`,
                transform: 'translate(-50%, -120%)',
              }}
            >
              <div className="font-medium">{formatDate(hoveredPoint.date)}</div>
              <div className="text-muted-foreground">{hoveredPoint.value.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-14 flex justify-between text-xs text-muted-foreground mt-1">
        {data.length > 0 && <span>{formatDate(data[0].date)}</span>}
        {data.length > 1 && <span>{formatDate(data[data.length - 1].date)}</span>}
      </div>
    </div>
  );
}
