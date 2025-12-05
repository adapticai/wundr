'use client';

/**
 * Pie Chart Component
 * Reusable pie/donut chart with customization options
 */

import * as React from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
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

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  title?: string;
  description?: string;
  height?: number;
  showLegend?: boolean;
  colors?: string[];
  className?: string;
  donut?: boolean;
  innerRadius?: number;
  showLabels?: boolean;
}

const defaultColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function PieChart({
  data,
  title,
  description,
  height = 350,
  showLegend = true,
  colors = defaultColors,
  className,
  donut = false,
  innerRadius = 60,
  showLabels = true,
}: PieChartProps) {
  // Build chart config
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    data.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: colors[index % colors.length],
      };
    });
    return config;
  }, [data, colors]);

  // Calculate total for percentage
  const total = React.useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  const renderLabel = (entry: { name: string; value: number }) => {
    if (!showLabels) {
      return '';
    }
    const percent = ((entry.value / total) * 100).toFixed(0);
    return `${percent}%`;
  };

  const content = (
    <ChartContainer config={chartConfig} className={cn('w-full', className)}>
      <RechartsPieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={value => [
                `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
              ]}
            />
          }
        />
        {showLegend && <Legend />}
        <Pie
          data={data}
          cx='50%'
          cy='50%'
          labelLine={false}
          label={renderLabel}
          outerRadius={120}
          innerRadius={donut ? innerRadius : 0}
          dataKey='value'
          nameKey='name'
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </RechartsPieChart>
    </ChartContainer>
  );

  if (title) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent
          style={{ height }}
          className='flex items-center justify-center'
        >
          {content}
        </CardContent>
      </Card>
    );
  }

  return (
    <div style={{ height }} className='flex items-center justify-center'>
      {content}
    </div>
  );
}
