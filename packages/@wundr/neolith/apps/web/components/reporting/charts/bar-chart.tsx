'use client';

/**
 * Bar Chart Component
 * Reusable bar chart with stacking and grouping options
 */

import * as React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

interface BarChartProps {
  data: Array<Record<string, string | number>>;
  dataKeys: string[];
  xAxisKey: string;
  title?: string;
  description?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  colors?: string[];
  className?: string;
  stacked?: boolean;
  horizontal?: boolean;
}

const defaultColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function BarChart({
  data,
  dataKeys,
  xAxisKey,
  title,
  description,
  height = 350,
  showGrid = true,
  showLegend = true,
  colors = defaultColors,
  className,
  stacked = false,
  horizontal = false,
}: BarChartProps) {
  // Build chart config from data keys
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    dataKeys.forEach((key, index) => {
      config[key] = {
        label: key.charAt(0).toUpperCase() + key.slice(1),
        color: colors[index % colors.length],
      };
    });
    return config;
  }, [dataKeys, colors]);

  const content = (
    <ChartContainer config={chartConfig} className={cn('w-full', className)}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray='3 3' vertical={false} />}
        {horizontal ? (
          <>
            <XAxis type='number' tickLine={false} axisLine={false} />
            <YAxis
              type='category'
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
          </>
        ) : (
          <>
            <XAxis
              type='category'
              dataKey={xAxisKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis type='number' tickLine={false} axisLine={false} />
          </>
        )}
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend && <Legend />}
        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );

  if (title) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent style={{ height }}>{content}</CardContent>
      </Card>
    );
  }

  return <div style={{ height }}>{content}</div>;
}
