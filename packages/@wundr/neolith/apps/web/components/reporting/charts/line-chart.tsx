'use client';

/**
 * Line Chart Component
 * Reusable line chart with customization options
 */

import * as React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
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

interface LineChartProps {
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
  curved?: boolean;
}

const defaultColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function LineChart({
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
  curved = true,
}: LineChartProps) {
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
      <RechartsLineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
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
          <Line
            key={key}
            type={curved ? 'monotone' : 'linear'}
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLineChart>
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
