'use client';

import * as React from 'react';
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
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface UsageDataPoint {
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface UsageChartProps {
  data: UsageDataPoint[];
  className?: string;
  showComparison?: boolean;
  previousPeriodData?: UsageDataPoint[];
}

const formatTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
};

const formatTimestamp = (date: Date, dataLength: number): string => {
  if (dataLength <= 24) {
    // Hourly view
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (dataLength <= 31) {
    // Daily view
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // Monthly view
  return date.toLocaleDateString('en-US', { month: 'short' });
};

export function UsageChart({
  data,
  className,
  showComparison,
  previousPeriodData,
}: UsageChartProps) {
  const [zoomDomain, setZoomDomain] = React.useState<[number, number] | null>(
    null
  );
  const [hoveredSeries, setHoveredSeries] = React.useState<string | null>(null);

  const chartData = React.useMemo(() => {
    return data.map(point => ({
      timestamp: point.timestamp.getTime(),
      timestampFormatted: formatTimestamp(point.timestamp, data.length),
      inputTokens: point.inputTokens,
      outputTokens: point.outputTokens,
      totalTokens: point.totalTokens,
    }));
  }, [data]);

  const comparisonData = React.useMemo(() => {
    if (!previousPeriodData || !showComparison) return null;
    return previousPeriodData.map(point => ({
      timestamp: point.timestamp.getTime(),
      totalTokens: point.totalTokens,
    }));
  }, [previousPeriodData, showComparison]);

  const stats = React.useMemo(() => {
    const total = data.reduce((sum, point) => sum + point.totalTokens, 0);
    const inputTotal = data.reduce((sum, point) => sum + point.inputTokens, 0);
    const outputTotal = data.reduce(
      (sum, point) => sum + point.outputTokens,
      0
    );
    const avg = data.length > 0 ? total / data.length : 0;
    const max = Math.max(...data.map(point => point.totalTokens));

    return { total, inputTotal, outputTotal, avg, max };
  }, [data]);

  const chartConfig = {
    inputTokens: {
      label: 'Input Tokens',
      color: 'hsl(var(--chart-1))',
    },
    outputTokens: {
      label: 'Output Tokens',
      color: 'hsl(var(--chart-2))',
    },
    totalTokens: {
      label: 'Total Tokens',
      color: 'hsl(var(--chart-3))',
    },
    previousTotal: {
      label: 'Previous Period',
      color: 'hsl(var(--muted-foreground))',
    },
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Token Usage Over Time</CardTitle>
            <CardDescription>
              Track input, output, and total token consumption
            </CardDescription>
          </div>
          <div className='flex gap-2'>
            <Badge variant='outline'>Total: {formatTokens(stats.total)}</Badge>
            <Badge variant='outline'>Avg: {formatTokens(stats.avg)}</Badge>
            <Badge variant='outline'>Peak: {formatTokens(stats.max)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {/* Legend */}
          <div className='flex flex-wrap gap-4 text-sm'>
            {Object.entries(chartConfig).map(([key, config]) => {
              if (key === 'previousTotal' && !showComparison) return null;

              return (
                <button
                  key={key}
                  className={cn(
                    'flex items-center gap-2 transition-opacity',
                    hoveredSeries && hoveredSeries !== key && 'opacity-40'
                  )}
                  onMouseEnter={() => setHoveredSeries(key)}
                  onMouseLeave={() => setHoveredSeries(null)}
                >
                  <div
                    className='h-3 w-3 rounded-sm'
                    style={{ backgroundColor: config.color }}
                  />
                  <span className='font-medium'>{config.label}</span>
                  {key === 'inputTokens' && (
                    <span className='text-muted-foreground'>
                      ({formatTokens(stats.inputTotal)})
                    </span>
                  )}
                  {key === 'outputTokens' && (
                    <span className='text-muted-foreground'>
                      ({formatTokens(stats.outputTotal)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Chart */}
          <ChartContainer config={chartConfig} className='h-[400px] w-full'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='timestampFormatted'
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ strokeWidth: 0 }}
                />
                <YAxis
                  tickFormatter={formatTokens}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ strokeWidth: 0 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={value => {
                        const point = chartData.find(
                          d => d.timestampFormatted === value
                        );
                        return point
                          ? new Date(point.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : value;
                      }}
                      formatter={value => formatTokens(Number(value))}
                    />
                  }
                />
                <Line
                  type='monotone'
                  dataKey='inputTokens'
                  stroke={chartConfig.inputTokens.color}
                  strokeWidth={2}
                  dot={false}
                  opacity={
                    hoveredSeries && hoveredSeries !== 'inputTokens' ? 0.3 : 1
                  }
                />
                <Line
                  type='monotone'
                  dataKey='outputTokens'
                  stroke={chartConfig.outputTokens.color}
                  strokeWidth={2}
                  dot={false}
                  opacity={
                    hoveredSeries && hoveredSeries !== 'outputTokens' ? 0.3 : 1
                  }
                />
                <Line
                  type='monotone'
                  dataKey='totalTokens'
                  stroke={chartConfig.totalTokens.color}
                  strokeWidth={2}
                  dot={false}
                  opacity={
                    hoveredSeries && hoveredSeries !== 'totalTokens' ? 0.3 : 1
                  }
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
