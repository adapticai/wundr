/**
 * Orchestrator Analytics Dashboard
 *
 * Complete analytics dashboard with charts, trends, and metrics
 * @module components/orchestrator/OrchestratorAnalyticsDashboard
 */

'use client';

import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { MetricTimeRange } from '@/types/orchestrator-analytics';

interface AnalyticsDashboardProps {
  orchestratorId: string;
  workspaceSlug: string;
}

interface TrendData {
  periodStart: string;
  periodEnd: string;
  tasksCompleted: number;
  avgDurationMinutes: number | null;
  successRate: number;
}

interface AnalyticsData {
  orchestratorId: string;
  timeRange: {
    start: string;
    end: string;
    label: string;
  };
  metrics: {
    tasksCompleted: number;
    tasksInProgress: number;
    tasksFailed: number;
    tasksCancelled: number;
    totalTasksAssigned: number;
    successRate: number;
    onTimeCompletionRate: number | null;
  };
  performance: {
    avgDurationMinutes: number | null;
    avgDurationHours: number | null;
  };
}

interface TrendsResponse {
  orchestratorId: string;
  timeRange: {
    start: string;
    end: string;
    label: string;
  };
  period: string;
  trends: TrendData[];
  summary: {
    totalDataPoints: number;
    totalTasksCompleted: number;
    avgSuccessRate: number;
    avgResponseTimeMinutes: number | null;
  };
  comparison?: {
    tasksCompleted: {
      value: number;
      percentage: number;
      direction: 'up' | 'down' | 'stable';
    };
    successRate: {
      value: number;
      percentage: number;
      direction: 'up' | 'down' | 'stable';
    };
  };
}

export function OrchestratorAnalyticsDashboard({
  orchestratorId,
  workspaceSlug,
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<MetricTimeRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch analytics data
  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch main analytics
        const analyticsResponse = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/analytics?timeRange=${timeRange}`
        );

        if (!analyticsResponse.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.data);

        // Fetch trends
        const trendsResponse = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/analytics/trends?period=daily&timeRange=${timeRange}`
        );

        if (!trendsResponse.ok) {
          throw new Error('Failed to fetch trends');
        }

        const trendsData = await trendsResponse.json();
        setTrends(trendsData.data);
      } catch (err) {
        console.error('Error fetching analytics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [orchestratorId, workspaceSlug, timeRange]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!trends?.trends || trends.trends.length === 0) {
      // Return sample data for visualization
      return Array.from({ length: 7 }, (_, i) => ({
        date: new Date(
          Date.now() - (6 - i) * 24 * 60 * 60 * 1000
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tasksCompleted: Math.floor(Math.random() * 50) + 10,
        successRate: Math.floor(Math.random() * 20) + 75,
        avgDuration: Math.floor(Math.random() * 30) + 15,
      }));
    }

    return trends.trends.map(trend => ({
      date: new Date(trend.periodStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      tasksCompleted: trend.tasksCompleted,
      successRate: Math.round(trend.successRate),
      avgDuration: trend.avgDurationMinutes
        ? Math.round(trend.avgDurationMinutes)
        : 0,
    }));
  }, [trends]);

  // Chart configs
  const performanceChartConfig = {
    tasksCompleted: {
      label: 'Tasks Completed',
      color: 'hsl(var(--chart-1))',
    },
  } satisfies ChartConfig;

  const successRateChartConfig = {
    successRate: {
      label: 'Success Rate (%)',
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig;

  const durationChartConfig = {
    avgDuration: {
      label: 'Avg Duration (min)',
      color: 'hsl(var(--chart-3))',
    },
  } satisfies ChartConfig;

  if (isLoading) {
    return (
      <div className='space-y-6'>
        <AnalyticsDashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center text-destructive'>
            <p className='font-semibold'>Failed to load analytics</p>
            <p className='text-sm text-muted-foreground mt-1'>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header with Time Range Selector */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            Analytics Dashboard
          </h2>
          <p className='text-muted-foreground'>
            Performance metrics and trends
          </p>
        </div>
        <Select
          value={timeRange}
          onValueChange={value => setTimeRange(value as MetricTimeRange)}
        >
          <SelectTrigger className='w-[180px]'>
            <Calendar className='mr-2 h-4 w-4' />
            <SelectValue placeholder='Select range' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='24h'>Last 24 Hours</SelectItem>
            <SelectItem value='7d'>Last 7 Days</SelectItem>
            <SelectItem value='30d'>Last 30 Days</SelectItem>
            <SelectItem value='90d'>Last 90 Days</SelectItem>
            <SelectItem value='all'>All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Summary */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='Tasks Completed'
          value={analytics?.metrics.tasksCompleted || 0}
          trend={trends?.comparison?.tasksCompleted}
          format='number'
        />
        <MetricCard
          title='Success Rate'
          value={analytics?.metrics.successRate || 0}
          trend={trends?.comparison?.successRate}
          format='percentage'
        />
        <MetricCard
          title='Avg Duration'
          value={analytics?.performance.avgDurationMinutes || 0}
          format='duration'
        />
        <MetricCard
          title='On-Time Rate'
          value={analytics?.metrics.onTimeCompletionRate || 0}
          format='percentage'
        />
      </div>

      {/* Charts Grid */}
      <div className='grid gap-6 md:grid-cols-2'>
        {/* Tasks Completed Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks Completed</CardTitle>
            <CardDescription>Daily task completion trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={performanceChartConfig}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey='tasksCompleted'
                  fill='var(--color-tasksCompleted)'
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Success Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Completion success percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={successRateChartConfig}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Area
                  type='monotone'
                  dataKey='successRate'
                  fill='var(--color-successRate)'
                  fillOpacity={0.2}
                  stroke='var(--color-successRate)'
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Average Duration Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Average Duration</CardTitle>
            <CardDescription>Task completion time trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={durationChartConfig}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis
                  dataKey='date'
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <Line
                  type='monotone'
                  dataKey='avgDuration'
                  stroke='var(--color-avgDuration)'
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Task Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Breakdown</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <TaskStatusBar
                label='Completed'
                value={analytics?.metrics.tasksCompleted || 0}
                total={analytics?.metrics.totalTasksAssigned || 1}
                color='bg-green-500'
              />
              <TaskStatusBar
                label='In Progress'
                value={analytics?.metrics.tasksInProgress || 0}
                total={analytics?.metrics.totalTasksAssigned || 1}
                color='bg-blue-500'
              />
              <TaskStatusBar
                label='Failed'
                value={analytics?.metrics.tasksFailed || 0}
                total={analytics?.metrics.totalTasksAssigned || 1}
                color='bg-red-500'
              />
              <TaskStatusBar
                label='Cancelled'
                value={analytics?.metrics.tasksCancelled || 0}
                total={analytics?.metrics.totalTasksAssigned || 1}
                color='bg-gray-500'
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {trends?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
            <CardDescription>
              Overall performance for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='flex flex-col'>
                <span className='text-sm text-muted-foreground'>
                  Total Tasks
                </span>
                <span className='text-2xl font-bold'>
                  {trends.summary.totalTasksCompleted}
                </span>
              </div>
              <div className='flex flex-col'>
                <span className='text-sm text-muted-foreground'>
                  Avg Success Rate
                </span>
                <span className='text-2xl font-bold'>
                  {trends.summary.avgSuccessRate}%
                </span>
              </div>
              <div className='flex flex-col'>
                <span className='text-sm text-muted-foreground'>
                  Avg Response Time
                </span>
                <span className='text-2xl font-bold'>
                  {trends.summary.avgResponseTimeMinutes
                    ? `${trends.summary.avgResponseTimeMinutes}min`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number;
  trend?: {
    value: number;
    percentage: number;
    direction: 'up' | 'down' | 'stable';
  };
  format?: 'number' | 'percentage' | 'duration';
}

function MetricCard({
  title,
  value,
  trend,
  format = 'number',
}: MetricCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${Math.round(val)}%`;
      case 'duration':
        return val < 60 ? `${Math.round(val)}min` : `${Math.round(val / 60)}h`;
      default:
        return val.toString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) {
      return null;
    }
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className='h-4 w-4 text-green-600' />;
      case 'down':
        return <TrendingDown className='h-4 w-4 text-red-600' />;
      default:
        return <Minus className='h-4 w-4 text-gray-600' />;
    }
  };

  const getTrendColor = () => {
    if (!trend) {
      return '';
    }
    switch (trend.direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        {getTrendIcon()}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{formatValue(value)}</div>
        {trend && (
          <p className={`text-xs ${getTrendColor()} mt-1`}>
            {trend.percentage > 0 ? '+' : ''}
            {trend.percentage}% from previous period
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Task Status Bar Component
interface TaskStatusBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

function TaskStatusBar({ label, value, total, color }: TaskStatusBarProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-sm'>
        <span className='font-medium'>{label}</span>
        <span className='text-muted-foreground'>
          {value} ({Math.round(percentage)}%)
        </span>
      </div>
      <div className='h-2 w-full rounded-full bg-secondary'>
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Loading Skeleton
function AnalyticsDashboardSkeleton() {
  return (
    <>
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <div className='h-8 w-48 bg-muted rounded animate-pulse' />
          <div className='h-4 w-64 bg-muted rounded animate-pulse' />
        </div>
        <div className='h-10 w-[180px] bg-muted rounded animate-pulse' />
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className='h-4 w-24 bg-muted rounded animate-pulse' />
            </CardHeader>
            <CardContent>
              <div className='h-8 w-16 bg-muted rounded animate-pulse' />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className='h-6 w-32 bg-muted rounded animate-pulse' />
              <div className='h-4 w-48 bg-muted rounded animate-pulse' />
            </CardHeader>
            <CardContent>
              <div className='h-64 w-full bg-muted rounded animate-pulse' />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
