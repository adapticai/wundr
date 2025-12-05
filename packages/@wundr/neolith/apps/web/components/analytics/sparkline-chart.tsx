'use client';

import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SparklineDataPoint {
  /** X-axis value (timestamp or index) */
  x: number | string;
  /** Y-axis value */
  y: number;
  /** Optional label for tooltip */
  label?: string;
}

export interface SparklineChartProps {
  /** Data points for the sparkline */
  data: SparklineDataPoint[];
  /** Title of the metric */
  title: string;
  /** Current value to display */
  currentValue: number | string;
  /** Format type for value display */
  format?: 'number' | 'currency' | 'percentage' | 'compact';
  /** Color of the line */
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  /** Show data points */
  showPoints?: boolean;
  /** Show area fill */
  filled?: boolean;
  /** Height of the chart in pixels */
  height?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when hovering over a point */
  onHover?: (point: SparklineDataPoint | null) => void;
}

function formatValue(
  value: number | string,
  format: SparklineChartProps['format'] = 'number'
): string {
  if (typeof value === 'string') {
    return value;
  }

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

function getColorClasses(color: SparklineChartProps['color'] = 'primary') {
  const colors = {
    primary: {
      stroke: 'stroke-primary',
      fill: 'fill-primary/10',
      point: 'fill-primary',
    },
    success: {
      stroke: 'stroke-emerald-500',
      fill: 'fill-emerald-500/10',
      point: 'fill-emerald-500',
    },
    warning: {
      stroke: 'stroke-amber-500',
      fill: 'fill-amber-500/10',
      point: 'fill-amber-500',
    },
    danger: {
      stroke: 'stroke-rose-500',
      fill: 'fill-rose-500/10',
      point: 'fill-rose-500',
    },
    info: {
      stroke: 'stroke-blue-500',
      fill: 'fill-blue-500/10',
      point: 'fill-blue-500',
    },
  };
  return colors[color];
}

function generatePath(
  data: SparklineDataPoint[],
  width: number,
  height: number,
  filled: boolean = false
): string {
  if (data.length === 0) {
    return '';
  }

  const values = data.map(d => d.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((point, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - ((point.y - min) / range) * height;
    return { x, y };
  });

  let path = `M ${points[0].x} ${points[0].y}`;

  // Use smooth curves for better appearance
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` Q ${cpx} ${prev.y}, ${curr.x} ${curr.y}`;
  }

  if (filled) {
    path += ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  }

  return path;
}

export function SparklineChart({
  data,
  title,
  currentValue,
  format = 'number',
  color = 'primary',
  showPoints = false,
  filled = true,
  height = 60,
  isLoading = false,
  className,
  onHover,
}: SparklineChartProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] =
    React.useState<SparklineDataPoint | null>(null);
  const [mousePosition, setMousePosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) {
        return;
      }

      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const index = Math.round((x / rect.width) * (data.length - 1));
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      const point = data[clampedIndex];

      setHoveredPoint(point);
      setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      onHover?.(point);
    },
    [data, onHover]
  );

  const handleMouseLeave = React.useCallback(() => {
    setHoveredPoint(null);
    setMousePosition(null);
    onHover?.(null);
  }, [onHover]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className='p-4'>
          <Skeleton className='h-4 w-32 mb-2' />
          <Skeleton className='h-8 w-24 mb-3' />
          <Skeleton className='h-[60px] w-full' />
        </CardContent>
      </Card>
    );
  }

  const colorClasses = getColorClasses(color);
  const viewBoxWidth = 100;
  const viewBoxHeight = height;
  const path = generatePath(data, viewBoxWidth, viewBoxHeight, filled);

  const values = data.map(d => d.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className='p-4'>
        <div className='mb-3'>
          <h3 className='text-sm font-medium text-muted-foreground mb-1'>
            {title}
          </h3>
          <p className='text-2xl font-bold tracking-tight'>
            {hoveredPoint
              ? formatValue(hoveredPoint.y, format)
              : formatValue(currentValue, format)}
          </p>
          {hoveredPoint && hoveredPoint.label && (
            <p className='text-xs text-muted-foreground mt-1'>
              {hoveredPoint.label}
            </p>
          )}
        </div>

        <div className='relative'>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className='w-full'
            style={{ height: `${height}px` }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Area fill */}
            {filled && (
              <path
                d={path}
                className={cn(colorClasses.fill, 'transition-all duration-300')}
              />
            )}

            {/* Line */}
            <path
              d={path}
              className={cn(colorClasses.stroke, 'transition-all duration-300')}
              fill='none'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            />

            {/* Data points */}
            {showPoints &&
              data.map((point, i) => {
                const x = (i / (data.length - 1 || 1)) * viewBoxWidth;
                const y =
                  viewBoxHeight - ((point.y - min) / range) * viewBoxHeight;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r='2'
                    className={cn(
                      colorClasses.point,
                      'transition-all duration-300'
                    )}
                  />
                );
              })}

            {/* Hover indicator */}
            {mousePosition && hoveredPoint && (
              <>
                <line
                  x1={
                    mousePosition.x *
                    (viewBoxWidth /
                      (svgRef.current?.getBoundingClientRect().width || 1))
                  }
                  y1='0'
                  x2={
                    mousePosition.x *
                    (viewBoxWidth /
                      (svgRef.current?.getBoundingClientRect().width || 1))
                  }
                  y2={viewBoxHeight}
                  stroke='currentColor'
                  strokeWidth='1'
                  strokeDasharray='2,2'
                  className='opacity-50'
                />
                <circle
                  cx={
                    mousePosition.x *
                    (viewBoxWidth /
                      (svgRef.current?.getBoundingClientRect().width || 1))
                  }
                  cy={
                    viewBoxHeight -
                    ((hoveredPoint.y - min) / range) * viewBoxHeight
                  }
                  r='4'
                  className={cn(colorClasses.point, 'stroke-background')}
                  strokeWidth='2'
                />
              </>
            )}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
