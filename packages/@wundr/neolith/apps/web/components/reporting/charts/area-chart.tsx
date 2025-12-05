'use client';

/**
 * Area Chart Component
 * Reusable area chart with stacking and gradient options
 */

import * as React from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
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

interface AreaChartProps {
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
  gradient?: boolean;
}

const defaultColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function AreaChart({
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
  gradient = true,
}: AreaChartProps) {
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
      <RechartsAreaChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {gradient && (
          <defs>
            {dataKeys.map((key, index) => {
              const color = colors[index % colors.length];
              return (
                <linearGradient
                  key={key}
                  id={`gradient-${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                </linearGradient>
              );
            })}
          </defs>
        )}
        {showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} />}
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {showLegend && <Legend />}
        {dataKeys.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            fill={gradient ? `url(#gradient-${key})` : colors[index % colors.length]}
            strokeWidth={2}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsAreaChart>
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
