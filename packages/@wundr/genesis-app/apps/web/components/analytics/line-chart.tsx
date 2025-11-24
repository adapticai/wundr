'use client';

import { clsx } from 'clsx';
import { useMemo } from 'react';

export interface LineChartProps {
  data: Array<{ date: string; value: number }>;
  title?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  className?: string;
}

export function LineChart({
  data,
  title,
  color = '#3b82f6',
  height = 200,
  showGrid = true,
  className,
}: LineChartProps) {
  const { points, maxValue, minValue } = useMemo(() => {
    if (data.length === 0) {
return { points: '', maxValue: 0, minValue: 0 };
}

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 100;
      return `${x},${y}`;
    });

    return {
      points: pts.join(' '),
      maxValue: max,
      minValue: min,
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>}

      <div className="relative" style={{ height }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground">
          <span>{maxValue.toLocaleString()}</span>
          <span>{Math.round((maxValue + minValue) / 2).toLocaleString()}</span>
          <span>{minValue.toLocaleString()}</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 h-full">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full"
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
            <polygon
              points={`0,100 ${points} 100,100`}
              fill={color}
              fillOpacity="0.1"
            />

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-14 flex justify-between text-xs text-muted-foreground mt-1">
        {data.length > 0 && <span>{data[0].date}</span>}
        {data.length > 1 && <span>{data[data.length - 1].date}</span>}
      </div>
    </div>
  );
}
