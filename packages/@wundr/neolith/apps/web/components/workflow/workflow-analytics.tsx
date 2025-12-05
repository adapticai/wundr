'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
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
import { ACTION_TYPE_CONFIG, TRIGGER_TYPE_CONFIG } from '@/types/workflow';

import type {
  ActionType,
  TriggerType,
  WorkflowExecution,
} from '@/types/workflow';

/**
 * Props for WorkflowAnalytics component
 */
export interface WorkflowAnalyticsProps {
  /** List of workflow executions to analyze */
  executions: WorkflowExecution[];
  /** Trigger type for context */
  triggerType?: TriggerType;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
  /** Time range for analysis */
  timeRange?: 'day' | 'week' | 'month' | 'all';
}

/**
 * Analytics data structure for execution trends
 */
interface ExecutionTrendData {
  date: string;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Analytics data for trigger frequency
 */
interface TriggerFrequencyData {
  trigger: string;
  count: number;
}

/**
 * Analytics data for error breakdown
 */
interface ErrorBreakdownData {
  step: string;
  errorCount: number;
  errorRate: number;
}

/**
 * Analytics data for action performance
 */
interface ActionPerformanceData {
  actionType: string;
  avgDuration: number;
  successRate: number;
  count: number;
}

/**
 * Duration percentile data for performance analysis
 */
interface DurationPercentilesData {
  date: string;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
}

/**
 * Hourly execution data for trend analysis
 */
interface HourlyExecutionData {
  hour: string;
  executions: number;
  successful: number;
  failed: number;
}

/**
 * WorkflowAnalytics Component
 *
 * Displays comprehensive analytics for workflow executions including:
 * - Total executions and success/failure rates
 * - Execution trend charts over time
 * - Average execution time
 * - Most frequent triggers
 * - Error breakdown by step
 * - Action performance metrics
 */
export function WorkflowAnalytics({
  executions,
  triggerType,
  isLoading = false,
  className,
  timeRange = 'all',
}: WorkflowAnalyticsProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Auto-refresh data every 30 seconds when there are running executions
  useEffect(() => {
    const hasRunning = executions.some((e) => e.status === 'running');
    if (!hasRunning) {
return;
}

    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [executions]);

  // Filter executions by time range
  const filteredExecutions = useMemo(() => {
    if (timeRange === 'all') {
      return executions;
    }

    const cutoffDate = new Date();

    switch (timeRange) {
      case 'day':
        cutoffDate.setDate(cutoffDate.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
    }

    return executions.filter(
      (e) => new Date(e.startedAt) >= cutoffDate,
    );
  }, [executions, timeRange]);

  // Calculate aggregate metrics
  const metrics = useMemo(() => {
    const total = filteredExecutions.length;
    const completed = filteredExecutions.filter(
      (e) => e.status === 'completed',
    ).length;
    const failed = filteredExecutions.filter(
      (e) => e.status === 'failed',
    ).length;
    const running = filteredExecutions.filter(
      (e) => e.status === 'running',
    ).length;

    const completedExecutions = filteredExecutions.filter(
      (e) => e.status === 'completed' && e.duration,
    );
    const avgDuration =
      completedExecutions.length > 0
        ? Math.round(
            completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) /
              completedExecutions.length,
          )
        : 0;

    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const failureRate = total > 0 ? Math.round((failed / total) * 100) : 0;

    return {
      total,
      completed,
      failed,
      running,
      avgDuration,
      successRate,
      failureRate,
    };
  }, [filteredExecutions]);

  // Calculate execution trend data
  const trendData = useMemo((): ExecutionTrendData[] => {
    const groupedByDate = new Map<string, ExecutionTrendData>();

    filteredExecutions.forEach((execution) => {
      const date = new Date(execution.startedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, { date, completed: 0, failed: 0, total: 0 });
      }

      const data = groupedByDate.get(date)!;
      data.total += 1;
      if (execution.status === 'completed') {
data.completed += 1;
}
      if (execution.status === 'failed') {
data.failed += 1;
}
    });

    return Array.from(groupedByDate.values()).sort((a, b) => {
      const dateA = new Date(a.date + ', 2024');
      const dateB = new Date(b.date + ', 2024');
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredExecutions]);

  // Calculate error breakdown by action step
  const errorBreakdown = useMemo((): ErrorBreakdownData[] => {
    const errorMap = new Map<string, { count: number; total: number }>();

    filteredExecutions.forEach((execution) => {
      execution.actionResults.forEach((result) => {
        const actionLabel =
          ACTION_TYPE_CONFIG[result.actionType]?.label || result.actionType;

        if (!errorMap.has(actionLabel)) {
          errorMap.set(actionLabel, { count: 0, total: 0 });
        }

        const data = errorMap.get(actionLabel)!;
        data.total += 1;
        if (result.status === 'failed') {
          data.count += 1;
        }
      });
    });

    return Array.from(errorMap.entries())
      .map(([step, { count, total }]) => ({
        step,
        errorCount: count,
        errorRate: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .filter((item) => item.errorCount > 0)
      .sort((a, b) => b.errorCount - a.errorCount);
  }, [filteredExecutions]);

  // Calculate action performance metrics
  const actionPerformance = useMemo((): ActionPerformanceData[] => {
    const actionMap = new Map<
      ActionType,
      { durations: number[]; successCount: number; totalCount: number }
    >();

    filteredExecutions.forEach((execution) => {
      execution.actionResults.forEach((result) => {
        if (!actionMap.has(result.actionType)) {
          actionMap.set(result.actionType, {
            durations: [],
            successCount: 0,
            totalCount: 0,
          });
        }

        const data = actionMap.get(result.actionType)!;
        data.totalCount += 1;

        if (result.duration) {
          data.durations.push(result.duration);
        }

        if (result.status === 'completed') {
          data.successCount += 1;
        }
      });
    });

    return Array.from(actionMap.entries())
      .map(([actionType, { durations, successCount, totalCount }]) => {
        const avgDuration =
          durations.length > 0
            ? Math.round(
                durations.reduce((sum, d) => sum + d, 0) / durations.length,
              )
            : 0;
        const successRate =
          totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

        return {
          actionType: ACTION_TYPE_CONFIG[actionType]?.label || actionType,
          avgDuration,
          successRate,
          count: totalCount,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredExecutions]);

  // Calculate trigger frequency (mock data for now, would need trigger data from executions)
  const triggerFrequency = useMemo((): TriggerFrequencyData[] => {
    if (!triggerType) {
return [];
}

    return [
      {
        trigger: TRIGGER_TYPE_CONFIG[triggerType]?.label || triggerType,
        count: filteredExecutions.length,
      },
    ];
  }, [filteredExecutions, triggerType]);

  // Calculate duration percentiles for performance analysis
  const durationPercentiles = useMemo((): DurationPercentilesData[] => {
    const groupedByDate = new Map<string, number[]>();

    filteredExecutions
      .filter((e) => e.status === 'completed' && e.duration)
      .forEach((execution) => {
        const date = new Date(execution.startedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });

        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, []);
        }

        groupedByDate.get(date)!.push(execution.duration!);
      });

    return Array.from(groupedByDate.entries())
      .map(([date, durations]) => {
        const sorted = durations.sort((a, b) => a - b);
        const p50Index = Math.floor(sorted.length * 0.5);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);
        const avg = Math.round(
          sorted.reduce((sum, d) => sum + d, 0) / sorted.length,
        );

        return {
          date,
          p50: sorted[p50Index] || 0,
          p95: sorted[p95Index] || 0,
          p99: sorted[p99Index] || 0,
          avg,
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.date + ', 2024');
        const dateB = new Date(b.date + ', 2024');
        return dateA.getTime() - dateB.getTime();
      });
  }, [filteredExecutions]);

  // Calculate hourly execution trends
  const hourlyTrends = useMemo((): HourlyExecutionData[] => {
    const hourlyMap = new Map<number, HourlyExecutionData>();

    filteredExecutions.forEach((execution) => {
      const hour = new Date(execution.startedAt).getHours();

      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          executions: 0,
          successful: 0,
          failed: 0,
        });
      }

      const data = hourlyMap.get(hour)!;
      data.executions += 1;
      if (execution.status === 'completed') {
        data.successful += 1;
      } else if (execution.status === 'failed') {
        data.failed += 1;
      }
    });

    // Fill in missing hours with zero values
    for (let hour = 0; hour < 24; hour++) {
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, {
          hour: `${hour.toString().padStart(2, '0')}:00`,
          executions: 0,
          successful: 0,
          failed: 0,
        });
      }
    }

    return Array.from(hourlyMap.values()).sort((a, b) =>
      a.hour.localeCompare(b.hour),
    );
  }, [filteredExecutions]);

  // Chart configurations
  const trendChartConfig: ChartConfig = {
    completed: {
      label: 'Completed',
      color: 'hsl(var(--chart-2))',
    },
    failed: {
      label: 'Failed',
      color: 'hsl(var(--chart-1))',
    },
  };

  const percentilesChartConfig: ChartConfig = {
    p50: {
      label: 'P50 (Median)',
      color: 'hsl(var(--chart-3))',
    },
    p95: {
      label: 'P95',
      color: 'hsl(var(--chart-4))',
    },
    p99: {
      label: 'P99',
      color: 'hsl(var(--chart-5))',
    },
    avg: {
      label: 'Average',
      color: 'hsl(var(--chart-2))',
    },
  };

  const hourlyChartConfig: ChartConfig = {
    successful: {
      label: 'Successful',
      color: 'hsl(var(--chart-2))',
    },
    failed: {
      label: 'Failed',
      color: 'hsl(var(--chart-1))',
    },
  };

  const statusColors = {
    completed: 'hsl(142, 76%, 36%)',
    failed: 'hsl(0, 84%, 60%)',
    running: 'hsl(24, 95%, 53%)',
    other: 'hsl(0, 0%, 60%)',
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className='pb-2'>
                <div className='h-4 w-24 animate-pulse rounded bg-muted' />
              </CardHeader>
              <CardContent>
                <div className='h-8 w-16 animate-pulse rounded bg-muted' />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className='h-6 w-32 animate-pulse rounded bg-muted' />
              </CardHeader>
              <CardContent>
                <div className='h-64 animate-pulse rounded bg-muted' />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (filteredExecutions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className='flex flex-col items-center justify-center py-12'>
          <AnalyticsEmptyIcon className='h-12 w-12 text-muted-foreground' />
          <h3 className='mt-4 text-lg font-semibold'>No execution data</h3>
          <p className='mt-2 text-sm text-muted-foreground'>
            Execute the workflow to see analytics and insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Metrics */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='Total Executions'
          value={metrics.total}
          icon={<TotalIcon className='h-4 w-4' />}
          trend={null}
        />
        <MetricCard
          title='Success Rate'
          value={`${metrics.successRate}%`}
          subtitle={`${metrics.completed} completed`}
          icon={<SuccessIcon className='h-4 w-4' />}
          trend={metrics.successRate >= 80 ? 'positive' : metrics.successRate >= 50 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title='Failure Rate'
          value={`${metrics.failureRate}%`}
          subtitle={`${metrics.failed} failed`}
          icon={<FailureIcon className='h-4 w-4' />}
          trend={metrics.failureRate <= 10 ? 'positive' : metrics.failureRate <= 30 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title='Avg Execution Time'
          value={formatDuration(metrics.avgDuration)}
          icon={<ClockIcon className='h-4 w-4' />}
          trend={null}
        />
      </div>

      {/* Charts Grid */}
      <div className='grid gap-4 md:grid-cols-2'>
        {/* Execution Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Trend</CardTitle>
            <CardDescription>
              Workflow executions over time showing success and failure rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ChartContainer config={trendChartConfig} className='h-[300px]'>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='date'
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Area
                    type='monotone'
                    dataKey='completed'
                    stackId='1'
                    stroke='var(--color-completed)'
                    fill='var(--color-completed)'
                    fillOpacity={0.6}
                    name='Completed'
                  />
                  <Area
                    type='monotone'
                    dataKey='failed'
                    stackId='1'
                    stroke='var(--color-failed)'
                    fill='var(--color-failed)'
                    fillOpacity={0.6}
                    name='Failed'
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <EmptyChartPlaceholder message='Not enough data for trend analysis' />
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>
              Breakdown of execution statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: metrics.completed },
                    { name: 'Failed', value: metrics.failed },
                    { name: 'Running', value: metrics.running },
                  ].filter((item) => item.value > 0)}
                  cx='50%'
                  cy='50%'
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill='#8884d8'
                  dataKey='value'
                >
                  <Cell fill={statusColors.completed} />
                  <Cell fill={statusColors.failed} />
                  <Cell fill={statusColors.running} />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Error Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Error Breakdown by Step</CardTitle>
            <CardDescription>
              Actions with the highest error rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorBreakdown.length > 0 ? (
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={errorBreakdown}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='step'
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    angle={-45}
                    textAnchor='end'
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className='rounded-lg border bg-background p-2 shadow-md'>
                            <p className='font-medium'>{data.step}</p>
                            <p className='text-sm text-muted-foreground'>
                              Errors: {data.errorCount}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Error Rate: {data.errorRate}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey='errorCount' fill={statusColors.failed} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder message='No errors recorded' />
            )}
          </CardContent>
        </Card>

        {/* Action Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Action Performance</CardTitle>
            <CardDescription>
              Average execution time and success rate by action type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {actionPerformance.length > 0 ? (
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={actionPerformance}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='actionType'
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    angle={-45}
                    textAnchor='end'
                    height={80}
                  />
                  <YAxis
                    yAxisId='left'
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{
                      value: 'Duration (ms)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12 },
                    }}
                  />
                  <YAxis
                    yAxisId='right'
                    orientation='right'
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{
                      value: 'Success Rate (%)',
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className='rounded-lg border bg-background p-2 shadow-md'>
                            <p className='font-medium'>{data.actionType}</p>
                            <p className='text-sm text-muted-foreground'>
                              Avg Duration: {formatDuration(data.avgDuration)}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Success Rate: {data.successRate}%
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Executions: {data.count}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId='left'
                    dataKey='avgDuration'
                    fill='hsl(var(--chart-3))'
                    name='Avg Duration'
                  />
                  <Bar
                    yAxisId='right'
                    dataKey='successRate'
                    fill={statusColors.completed}
                    name='Success Rate'
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartPlaceholder message='No action data available' />
            )}
          </CardContent>
        </Card>

        {/* Duration Percentiles Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Duration Percentiles</CardTitle>
            <CardDescription>
              Performance distribution showing P50, P95, and P99 latencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {durationPercentiles.length > 0 ? (
              <ChartContainer
                config={percentilesChartConfig}
                className='h-[300px]'
              >
                <LineChart data={durationPercentiles}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='date'
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{
                      value: 'Duration (ms)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 12 },
                    }}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className='rounded-lg border bg-background p-2 shadow-md'>
                            <p className='font-medium'>{data.date}</p>
                            <p className='text-sm text-muted-foreground'>
                              P50 (Median): {formatDuration(data.p50)}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              P95: {formatDuration(data.p95)}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              P99: {formatDuration(data.p99)}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Average: {formatDuration(data.avg)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type='monotone'
                    dataKey='p50'
                    stroke='var(--color-p50)'
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name='P50 (Median)'
                  />
                  <Line
                    type='monotone'
                    dataKey='p95'
                    stroke='var(--color-p95)'
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name='P95'
                  />
                  <Line
                    type='monotone'
                    dataKey='p99'
                    stroke='var(--color-p99)'
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name='P99'
                  />
                  <Line
                    type='monotone'
                    dataKey='avg'
                    stroke='var(--color-avg)'
                    strokeWidth={2}
                    strokeDasharray='5 5'
                    dot={{ r: 3 }}
                    name='Average'
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyChartPlaceholder message='Not enough completed executions for percentile analysis' />
            )}
          </CardContent>
        </Card>

        {/* Hourly Execution Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Execution Distribution</CardTitle>
            <CardDescription>
              Execution patterns across 24 hours showing peak activity times
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hourlyTrends.some((h) => h.executions > 0) ? (
              <ChartContainer config={hourlyChartConfig} className='h-[300px]'>
                <ComposedChart data={hourlyTrends}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='hour'
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar
                    dataKey='successful'
                    stackId='a'
                    fill='var(--color-successful)'
                    name='Successful'
                  />
                  <Bar
                    dataKey='failed'
                    stackId='a'
                    fill='var(--color-failed)'
                    name='Failed'
                  />
                  <Line
                    type='monotone'
                    dataKey='executions'
                    stroke='hsl(var(--primary))'
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name='Total Executions'
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <EmptyChartPlaceholder message='No executions to display hourly trends' />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trigger Frequency Table */}
      {triggerFrequency.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Frequent Triggers</CardTitle>
            <CardDescription>
              Breakdown of what triggers this workflow most often
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {triggerFrequency.map((item) => (
                <div
                  key={item.trigger}
                  className='flex items-center justify-between rounded-lg border bg-muted/50 p-3'
                >
                  <div className='flex items-center gap-2'>
                    <TriggerIcon className='h-4 w-4 text-muted-foreground' />
                    <span className='font-medium'>{item.trigger}</span>
                  </div>
                  <span className='text-sm text-muted-foreground'>
                    {item.count} executions
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Error Analysis */}
      {metrics.failed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Analysis & Diagnostics</CardTitle>
            <CardDescription>
              Detailed breakdown of failures and common error patterns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {/* Error Summary */}
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='rounded-lg border bg-red-50 p-4 dark:bg-red-900/20'>
                  <div className='flex items-center gap-2'>
                    <FailureIcon className='h-5 w-5 text-red-600 dark:text-red-400' />
                    <span className='text-sm font-medium text-red-900 dark:text-red-100'>
                      Total Failures
                    </span>
                  </div>
                  <p className='mt-2 text-2xl font-bold text-red-600 dark:text-red-400'>
                    {metrics.failed}
                  </p>
                  <p className='text-xs text-red-600/70 dark:text-red-400/70'>
                    {metrics.failureRate}% of all executions
                  </p>
                </div>

                <div className='rounded-lg border bg-yellow-50 p-4 dark:bg-yellow-900/20'>
                  <div className='flex items-center gap-2'>
                    <AlertIcon className='h-5 w-5 text-yellow-600 dark:text-yellow-400' />
                    <span className='text-sm font-medium text-yellow-900 dark:text-yellow-100'>
                      Error Types
                    </span>
                  </div>
                  <p className='mt-2 text-2xl font-bold text-yellow-600 dark:text-yellow-400'>
                    {errorBreakdown.length}
                  </p>
                  <p className='text-xs text-yellow-600/70 dark:text-yellow-400/70'>
                    Distinct error sources
                  </p>
                </div>

                <div className='rounded-lg border bg-blue-50 p-4 dark:bg-blue-900/20'>
                  <div className='flex items-center gap-2'>
                    <InfoIconAlt className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                    <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                      Most Affected
                    </span>
                  </div>
                  <p className='mt-2 text-lg font-bold text-blue-600 dark:text-blue-400'>
                    {errorBreakdown[0]?.step || 'N/A'}
                  </p>
                  <p className='text-xs text-blue-600/70 dark:text-blue-400/70'>
                    {errorBreakdown[0]?.errorCount || 0} errors (
                    {errorBreakdown[0]?.errorRate || 0}%)
                  </p>
                </div>
              </div>

              {/* Error Details List */}
              {errorBreakdown.length > 0 && (
                <div>
                  <h4 className='mb-3 text-sm font-semibold'>
                    Error Breakdown by Action
                  </h4>
                  <div className='space-y-2'>
                    {errorBreakdown.slice(0, 5).map((error, index) => (
                      <div
                        key={error.step}
                        className='flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-900/10'
                      >
                        <div className='flex items-center gap-3'>
                          <span className='flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300'>
                            {index + 1}
                          </span>
                          <div>
                            <p className='font-medium text-foreground'>
                              {error.step}
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              Error rate: {error.errorRate}%
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p className='font-semibold text-red-600 dark:text-red-400'>
                            {error.errorCount}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            failures
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Data Indicator */}
      {executions.some((e) => e.status === 'running') && (
        <div className='flex items-center justify-center gap-2 rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/20'>
          <span className='relative flex h-3 w-3'>
            <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75' />
            <span className='relative inline-flex h-3 w-3 rounded-full bg-blue-500' />
          </span>
          <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
            Live data - Auto-refreshing every 30 seconds
          </span>
          <span className='text-xs text-blue-600 dark:text-blue-400'>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral' | null;
}

function MetricCard({ title, value, subtitle, icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {subtitle && (
          <p className='text-xs text-muted-foreground'>{subtitle}</p>
        )}
        {trend && (
          <div className='mt-1'>
            {trend === 'positive' && (
              <span className='text-xs font-medium text-green-600 dark:text-green-400'>
                Healthy
              </span>
            )}
            {trend === 'negative' && (
              <span className='text-xs font-medium text-red-600 dark:text-red-400'>
                Needs attention
              </span>
            )}
            {trend === 'neutral' && (
              <span className='text-xs font-medium text-yellow-600 dark:text-yellow-400'>
                Moderate
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChartPlaceholder({ message }: { message: string }) {
  return (
    <div className='flex h-[300px] items-center justify-center'>
      <p className='text-sm text-muted-foreground'>{message}</p>
    </div>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatDuration(ms: number): string {
  if (ms === 0) {
return '0ms';
}
  if (ms < 1000) {
return `${ms}ms`;
}
  if (ms < 60000) {
return `${(ms / 1000).toFixed(1)}s`;
}
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// =============================================================================
// Icons
// =============================================================================

function AnalyticsEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M3 3v18h18' />
      <path d='m19 9-5 5-4-4-3 3' />
    </svg>
  );
}

function TotalIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <rect x='3' y='3' width='7' height='7' />
      <rect x='14' y='3' width='7' height='7' />
      <rect x='14' y='14' width='7' height='7' />
      <rect x='3' y='14' width='7' height='7' />
    </svg>
  );
}

function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
      <polyline points='22 4 12 14.01 9 11.01' />
    </svg>
  );
}

function FailureIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='15' y1='9' x2='9' y2='15' />
      <line x1='9' y1='9' x2='15' y2='15' />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <polyline points='12 6 12 12 16 14' />
    </svg>
  );
}

function TriggerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z' />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' />
      <line x1='12' y1='9' x2='12' y2='13' />
      <line x1='12' y1='17' x2='12.01' y2='17' />
    </svg>
  );
}

function InfoIconAlt({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M12 16v-4' />
      <path d='M12 8h.01' />
    </svg>
  );
}
