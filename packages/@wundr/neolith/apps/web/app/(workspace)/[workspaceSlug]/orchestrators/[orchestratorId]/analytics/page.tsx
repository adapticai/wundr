/**
 * Orchestrator Analytics Page
 *
 * Comprehensive analytics dashboard for orchestrator performance including:
 * - Task completion metrics with trend visualization
 * - Performance charts (success rate, duration, task volume)
 * - Budget vs actual usage tracking
 * - Activity timeline with filtering
 *
 * @module app/(workspace)/[workspaceSlug]/orchestrators/[orchestratorId]/analytics/page
 */
'use client';

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { BudgetOverview } from '@/components/budget/budget-overview';
import { OrchestratorActivityFeed } from '@/components/orchestrator/activity-feed';
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
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { useOrchestrator } from '@/hooks/use-orchestrator';
import { cn } from '@/lib/utils';

import type { BudgetUsage } from '@/components/budget/budget-overview';
import type { ChartConfig } from '@/components/ui/chart';
import type { MetricTimeRange } from '@/types/orchestrator-analytics';

// Types
interface AnalyticsMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  tasksCancelled: number;
  totalTasksAssigned: number;
  successRate: number;
  onTimeCompletionRate: number | null;
}

interface PerformanceMetrics {
  avgDurationMinutes: number | null;
  avgDurationHours: number | null;
}

interface TrendData {
  periodStart: string;
  periodEnd: string;
  tasksCompleted: number;
  avgDurationMinutes: number | null;
  successRate: number;
}

interface TrendComparison {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
}

interface AnalyticsData {
  orchestratorId: string;
  timeRange: {
    start: string;
    end: string;
    label: string;
  };
  metrics: AnalyticsMetrics;
  performance: PerformanceMetrics;
}

interface TrendsData {
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
    tasksCompleted: TrendComparison;
    successRate: TrendComparison;
  };
}

export default function OrchestratorAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;
  const orchestratorId = params.orchestratorId as string;
  const { setPageHeader } = usePageHeader();

  // State
  const [timeRange, setTimeRange] = useState<MetricTimeRange>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch orchestrator details
  const { orchestrator } = useOrchestrator(orchestratorId);

  // Set page header
  useEffect(() => {
    if (orchestrator) {
      setPageHeader(
        `${orchestrator.title} Analytics`,
        'Performance metrics and insights'
      );
    }
  }, [orchestrator, setPageHeader]);

  // Fetch analytics data
  useEffect(() => {
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

    if (orchestratorId && workspaceSlug) {
      fetchData();
    }
  }, [orchestratorId, workspaceSlug, timeRange]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!trends?.trends || trends.trends.length === 0) {
      return [];
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

  // Budget data derived from analytics metrics
  const budgetData: BudgetUsage = useMemo(() => {
    const current = analytics?.metrics.totalTasksAssigned
      ? analytics.metrics.totalTasksAssigned * 2500
      : 0;
    const limit = 1_000_000;
    const projectedExhaustion =
      current > 0 ? new Date(Date.now() + 48 * 60 * 60 * 1000) : undefined;
    const costEstimate = current * 0.00001;

    return {
      current,
      limit,
      period: 'daily',
      projectedExhaustion,
      costEstimate,
    };
  }, [analytics]);

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

  // Render loading state
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <AnalyticsSkeleton />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <Card className='max-w-md'>
          <CardContent className='pt-6 text-center'>
            <Activity className='h-12 w-12 text-destructive mx-auto mb-4' />
            <h3 className='text-lg font-semibold mb-2'>
              Failed to Load Analytics
            </h3>
            <p className='text-sm text-muted-foreground mb-4'>{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='p-4 md:p-6 space-y-6'>
      {/* Back Navigation */}
      <Button
        variant='ghost'
        onClick={() =>
          router.push(`/${workspaceSlug}/orchestrators/${orchestratorId}`)
        }
        className='gap-2'
      >
        <ArrowLeft className='h-4 w-4' />
        Back to Orchestrator
      </Button>

      {/* Header with Time Range Selector */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>
            Analytics Dashboard
          </h1>
          <p className='text-muted-foreground mt-1'>
            Performance metrics and insights for{' '}
            {orchestrator?.title || 'orchestrator'}
          </p>
        </div>
        <Select
          value={timeRange}
          onValueChange={value => setTimeRange(value as MetricTimeRange)}
        >
          <SelectTrigger className='w-[180px]'>
            <Clock className='mr-2 h-4 w-4' />
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='overview'>
            <BarChart3 className='h-4 w-4 mr-2' />
            Overview
          </TabsTrigger>
          <TabsTrigger value='budget'>
            <DollarSign className='h-4 w-4 mr-2' />
            Budget
          </TabsTrigger>
          <TabsTrigger value='activity'>
            <Activity className='h-4 w-4 mr-2' />
            Activity Timeline
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-6 mt-6'>
          {/* Key Metrics Summary */}
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
            <MetricCard
              title='Tasks Completed'
              value={analytics?.metrics.tasksCompleted || 0}
              trend={trends?.comparison?.tasksCompleted}
              format='number'
              icon={<Zap className='h-4 w-4' />}
            />
            <MetricCard
              title='Success Rate'
              value={analytics?.metrics.successRate || 0}
              trend={trends?.comparison?.successRate}
              format='percentage'
              icon={<TrendingUp className='h-4 w-4' />}
            />
            <MetricCard
              title='Avg Duration'
              value={analytics?.performance.avgDurationMinutes || 0}
              format='duration'
              icon={<Clock className='h-4 w-4' />}
            />
            <MetricCard
              title='On-Time Rate'
              value={analytics?.metrics.onTimeCompletionRate || 0}
              format='percentage'
              icon={<Activity className='h-4 w-4' />}
            />
          </div>

          {/* Charts Grid */}
          <div className='grid gap-6 md:grid-cols-2'>
            {/* Tasks Completed Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Task Completion Trends</CardTitle>
                <CardDescription>Daily task completion volume</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <NoDataPlaceholder label='No task completion data yet' />
                ) : (
                  <ChartContainer config={performanceChartConfig}>
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray='3 3'
                        className='stroke-muted'
                      />
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
                )}
              </CardContent>
            </Card>

            {/* Success Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Success Rate Trend</CardTitle>
                <CardDescription>
                  Task completion success percentage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <NoDataPlaceholder label='No success rate data yet' />
                ) : (
                  <ChartContainer config={successRateChartConfig}>
                    <AreaChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray='3 3'
                        className='stroke-muted'
                      />
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
                )}
              </CardContent>
            </Card>

            {/* Average Duration Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Response Time</CardTitle>
                <CardDescription>Average task completion time</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <NoDataPlaceholder label='No response time data yet' />
                ) : (
                  <ChartContainer config={durationChartConfig}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray='3 3'
                        className='stroke-muted'
                      />
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
                )}
              </CardContent>
            </Card>

            {/* Task Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
                <CardDescription>
                  Current task breakdown by status
                </CardDescription>
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

          {/* Summary Statistics */}
          {trends?.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>
                  Overall performance metrics for the selected time period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-6 md:grid-cols-3'>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>Total Tasks</p>
                    <p className='text-3xl font-bold'>
                      {trends.summary.totalTasksCompleted}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Across {trends.summary.totalDataPoints} data points
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>
                      Average Success Rate
                    </p>
                    <p className='text-3xl font-bold'>
                      {trends.summary.avgSuccessRate}%
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Across all tasks
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <p className='text-sm text-muted-foreground'>
                      Average Response Time
                    </p>
                    <p className='text-3xl font-bold'>
                      {trends.summary.avgResponseTimeMinutes
                        ? `${trends.summary.avgResponseTimeMinutes}min`
                        : 'N/A'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Per task completion
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Budget Tab */}
        <TabsContent value='budget' className='space-y-6 mt-6'>
          <BudgetOverview usage={budgetData} onViewChange={() => undefined} />

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Cost Analysis</CardTitle>
              <CardDescription>
                Estimated token costs based on task activity for the selected
                time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid gap-4 md:grid-cols-3'>
                <div className='space-y-1 p-4 border rounded-lg'>
                  <p className='text-sm text-muted-foreground'>
                    Estimated Total Cost
                  </p>
                  <p className='text-2xl font-bold'>
                    ${budgetData.costEstimate?.toFixed(4) || '0.0000'}
                  </p>
                </div>
                <div className='space-y-1 p-4 border rounded-lg'>
                  <p className='text-sm text-muted-foreground'>
                    Estimated Cost per Task
                  </p>
                  <p className='text-2xl font-bold'>
                    $
                    {analytics?.metrics.totalTasksAssigned
                      ? (
                          (budgetData.costEstimate || 0) /
                          analytics.metrics.totalTasksAssigned
                        ).toFixed(4)
                      : '0.0000'}
                  </p>
                </div>
                <div className='space-y-1 p-4 border rounded-lg'>
                  <p className='text-sm text-muted-foreground'>
                    Estimated Cost per 1K Tokens
                  </p>
                  <p className='text-2xl font-bold'>
                    $
                    {budgetData.current > 0
                      ? (
                          (budgetData.costEstimate || 0) /
                          (budgetData.current / 1000)
                        ).toFixed(4)
                      : '0.0000'}
                  </p>
                </div>
              </div>
              <p className='text-xs text-muted-foreground mt-4'>
                Cost estimates are calculated from task activity. Connect a
                billing provider in Settings for precise tracking.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Timeline Tab */}
        <TabsContent value='activity' className='space-y-6 mt-6'>
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                Detailed history of orchestrator activities and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrchestratorActivityFeed
                orchestratorId={orchestratorId}
                workspaceSlug={workspaceSlug}
                autoRefresh={true}
                refreshInterval={60000}
                initialLimit={50}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
  icon?: React.ReactNode;
}

function MetricCard({
  title,
  value,
  trend,
  format = 'number',
  icon,
}: MetricCardProps) {
  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${Math.round(val)}%`;
      case 'duration':
        return val < 60 ? `${Math.round(val)}min` : `${Math.round(val / 60)}h`;
      default:
        return val.toLocaleString();
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
        return null;
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
        <div className='flex items-center gap-2'>
          {icon}
          {getTrendIcon()}
        </div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{formatValue(value)}</div>
        {trend && (
          <p className={cn('text-xs mt-1', getTrendColor())}>
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
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// No Data Placeholder Component
function NoDataPlaceholder({ label }: { label: string }) {
  return (
    <div className='flex flex-col items-center justify-center h-[200px] text-center'>
      <BarChart3 className='h-8 w-8 text-muted-foreground/40 mb-3' />
      <p className='text-sm text-muted-foreground'>{label}</p>
      <p className='text-xs text-muted-foreground/70 mt-1'>
        Data will appear as tasks are completed
      </p>
    </div>
  );
}

// Loading Skeleton
function AnalyticsSkeleton() {
  return (
    <>
      {/* Header Skeleton */}
      <div className='flex items-center justify-between animate-pulse'>
        <div className='space-y-2'>
          <div className='h-8 w-64 bg-muted rounded' />
          <div className='h-4 w-96 bg-muted rounded' />
        </div>
        <div className='h-10 w-[180px] bg-muted rounded' />
      </div>

      {/* Tabs Skeleton */}
      <div className='h-10 w-full bg-muted rounded animate-pulse' />

      {/* Metrics Grid Skeleton */}
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

      {/* Charts Grid Skeleton */}
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
