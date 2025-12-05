'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

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
  color = 'hsl(var(--primary))',
  height = 200,
  showGrid = true,
  className,
  isLoading = false,
}: LineChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      value: {
        label: 'Value',
        color: color,
      },
    }),
    [color],
  );

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const chartData = useMemo(
    () =>
      data.map(d => ({
        date: formatDate(d.date),
        value: d.value,
      })),
    [data],
  );

  if (isLoading) {
    return (
      <div className={className}>
        {title && (
          <h3 className='text-sm font-medium text-foreground mb-2'>{title}</h3>
        )}
        <div
          className='flex items-center justify-center'
          style={{ height }}
        >
          <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={className}>
        {title && (
          <h3 className='text-sm font-medium text-foreground mb-2'>{title}</h3>
        )}
        <div
          className='flex items-center justify-center'
          style={{ height }}
        >
          <p className='text-muted-foreground text-sm'>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && (
        <h3 className='text-sm font-medium text-foreground mb-2'>{title}</h3>
      )}

      <ChartContainer config={chartConfig} className='w-full' style={{ height }}>
        <AreaChart
          data={chartData}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 0,
          }}
        >
          {showGrid && (
            <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          )}
          <XAxis
            dataKey='date'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={value => value.toLocaleString()}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator='dot' />}
          />
          <Area
            dataKey='value'
            type='monotone'
            fill={'var(--color-value)'}
            fillOpacity={0.2}
            stroke={'var(--color-value)'}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
