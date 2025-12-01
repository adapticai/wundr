'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type TimeRange = '1h' | '24h' | '7d' | '30d';

export interface MetricsData {
  timestamp: string;
  tokenUsage?: number;
  sessionCount?: number;
  errorRate?: number;
  responseTime?: number;
}

interface MetricsChartsPanelProps {
  data: MetricsData[];
  className?: string;
  onTimeRangeChange?: (range: TimeRange) => void;
}

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
}) => {
  const ranges: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
  ];

  return (
    <div className='flex gap-2'>
      {ranges.map(range => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            selected === range.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

export const MetricsChartsPanel: React.FC<MetricsChartsPanelProps> = ({
  data,
  className,
  onTimeRangeChange,
}) => {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('24h');

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range);
    onTimeRangeChange?.(range);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '1h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className='bg-popover border border-border rounded-lg shadow-lg p-3'>
          <p className='text-sm font-medium mb-2'>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className='text-sm' style={{ color: entry.color }}>
              {entry.name}:{' '}
              {typeof entry.value === 'number'
                ? entry.value.toFixed(2)
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className='flex justify-end'>
        <TimeRangeSelector
          selected={timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {/* Token Usage Chart */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Token Usage Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id='colorTokens' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#8884d8' stopOpacity={0.8} />
                    <stop offset='95%' stopColor='#8884d8' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='timestamp'
                  tickFormatter={formatTimestamp}
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type='monotone'
                  dataKey='tokenUsage'
                  stroke='#8884d8'
                  fillOpacity={1}
                  fill='url(#colorTokens)'
                  name='Tokens'
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session Count Chart */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='timestamp'
                  tickFormatter={formatTimestamp}
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type='monotone'
                  dataKey='sessionCount'
                  stroke='#82ca9d'
                  strokeWidth={2}
                  name='Sessions'
                  dot={{ fill: '#82ca9d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Error Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Error Rate (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='timestamp'
                  tickFormatter={formatTimestamp}
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey='errorRate'
                  fill='#ff6b6b'
                  name='Error Rate'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Average Response Time (ms)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={250}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id='colorResponse'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='5%' stopColor='#ffd93d' stopOpacity={0.8} />
                    <stop offset='95%' stopColor='#ffd93d' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='timestamp'
                  tickFormatter={formatTimestamp}
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className='text-xs'
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type='monotone'
                  dataKey='responseTime'
                  stroke='#ffd93d'
                  fillOpacity={1}
                  fill='url(#colorResponse)'
                  name='Response Time'
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

MetricsChartsPanel.displayName = 'MetricsChartsPanel';
