'use client';

import { useMemo } from 'react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

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
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    data.forEach((item, index) => {
      config[`item${index}`] = {
        label: item.label,
        color: item.color || 'hsl(var(--primary))',
      };
    });
    return {
      value: {
        label: 'Value',
      },
      ...config,
    };
  }, [data]);

  const chartData = useMemo(
    () =>
      data.map((item, index) => ({
        name: item.label,
        value: item.value,
        fill: item.color || 'hsl(var(--primary))',
      })),
    [data],
  );

  if (isLoading) {
    return (
      <div className={className}>
        {title && (
          <h3 className='text-sm font-medium text-foreground mb-3'>{title}</h3>
        )}
        <div className='flex items-center justify-center py-8'>
          <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={className}>
        {title && (
          <h3 className='text-sm font-medium text-foreground mb-3'>{title}</h3>
        )}
        <div className='flex items-center justify-center py-8'>
          <p className='text-muted-foreground text-sm'>No data available</p>
        </div>
      </div>
    );
  }

  const height = orientation === 'vertical' ? 250 : data.length * 40 + 50;

  return (
    <div className={className}>
      {title && (
        <h3 className='text-sm font-medium text-foreground mb-3'>{title}</h3>
      )}

      <ChartContainer config={chartConfig} className='w-full' style={{ height }}>
        <RechartsBarChart
          data={chartData}
          layout={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          margin={{
            top: 5,
            right: 10,
            left: orientation === 'horizontal' ? 80 : 10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          {orientation === 'horizontal' ? (
            <>
              <XAxis
                type='number'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={value => value.toLocaleString()}
              />
              <YAxis
                dataKey='name'
                type='category'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={75}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey='name'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                type='number'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={value => value.toLocaleString()}
              />
            </>
          )}
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator='line' />}
          />
          <Bar dataKey='value' radius={4} />
        </RechartsBarChart>
      </ChartContainer>
    </div>
  );
}
