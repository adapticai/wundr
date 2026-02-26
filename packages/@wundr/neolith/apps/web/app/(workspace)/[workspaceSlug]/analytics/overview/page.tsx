'use client';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckSquare,
  MessageSquare,
  RefreshCw,
  Users,
  Workflow,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageHeader } from '@/contexts/page-header-context';

interface OverviewSummary {
  totalMessages: number;
  totalMembers: number;
  totalChannels: number;
  activeOrchestrators: number;
  completedTasks: number;
  successfulWorkflows: number;
}

interface TrendData {
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

interface AnalyticsResponse {
  summary: OverviewSummary;
  workflowMetrics: {
    successRate: number;
  };
}

function MetricRow({
  label,
  value,
  trendData,
  description,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string | number;
  trendData?: TrendData;
  description: string;
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className='h-8 w-24 mb-1' />
            <Skeleton className='h-4 w-32' />
          </>
        ) : (
          <>
            <div className='text-2xl font-bold'>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className='flex items-center gap-1 text-xs text-muted-foreground mt-1'>
              {trendData && trendData.trend !== 'stable' && (
                <span
                  className={
                    trendData.trend === 'up'
                      ? 'text-green-600 dark:text-green-400 flex items-center gap-0.5'
                      : 'text-red-600 dark:text-red-400 flex items-center gap-0.5'
                  }
                >
                  {trendData.trend === 'up' ? (
                    <ArrowUp className='h-3 w-3' />
                  ) : (
                    <ArrowDown className='h-3 w-3' />
                  )}
                  {trendData.changePercent.toFixed(1)}%
                </span>
              )}
              <span>{description}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsOverviewPage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader(
      'Analytics Overview',
      'Key metrics and workspace activity at a glance'
    );
  }, [setPageHeader]);

  const fetchData = useCallback(async () => {
    if (!workspaceSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [metricsRes, messagesTrend, tasksTrend] = await Promise.all([
        fetch(`/api/workspaces/${workspaceSlug}/analytics?granularity=daily`),
        fetch(
          `/api/workspaces/${workspaceSlug}/analytics/trends?metric=messages&period=daily`
        ),
        fetch(
          `/api/workspaces/${workspaceSlug}/analytics/trends?metric=tasks&period=daily`
        ),
      ]);

      if (!metricsRes.ok) {
        const errorData = await metricsRes
          .json()
          .catch(() => ({ error: 'Failed to fetch overview' }));
        throw new Error(errorData.error || 'Failed to fetch overview');
      }

      const metricsData: AnalyticsResponse = await metricsRes.json();
      setData(metricsData);

      const trendsData: Record<string, TrendData> = {};
      if (messagesTrend.ok) {
        const t = await messagesTrend.json();
        if (t.trend) {
          trendsData.messages = {
            trend: t.trend.trend || 'stable',
            changePercent: t.trend.changePercent || 0,
          };
        }
      }
      if (tasksTrend.ok) {
        const t = await tasksTrend.json();
        if (t.trend) {
          trendsData.tasks = {
            trend: t.trend.trend || 'stable',
            changePercent: t.trend.changePercent || 0,
          };
        }
      }
      setTrends(trendsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData =
    data?.summary &&
    (data.summary.totalMessages > 0 ||
      data.summary.totalMembers > 0 ||
      data.summary.totalChannels > 0);

  if (error && !data) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-center py-16'>
          <div className='text-center max-w-sm'>
            <BarChart3 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
            <p className='text-base font-medium text-foreground mb-2'>
              Failed to load overview
            </p>
            <p className='text-sm text-muted-foreground mb-4'>{error}</p>
            <button
              onClick={fetchData}
              className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors'
            >
              <RefreshCw className='h-4 w-4' />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Metrics Grid */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <MetricRow
          label='Total Messages'
          value={data?.summary.totalMessages ?? 0}
          trendData={trends.messages}
          description='vs. previous period'
          icon={MessageSquare}
          isLoading={isLoading}
        />
        <MetricRow
          label='Active Members'
          value={data?.summary.totalMembers ?? 0}
          description='workspace members'
          icon={Users}
          isLoading={isLoading}
        />
        <MetricRow
          label='Completed Tasks'
          value={data?.summary.completedTasks ?? 0}
          trendData={trends.tasks}
          description='vs. previous period'
          icon={CheckSquare}
          isLoading={isLoading}
        />
        <MetricRow
          label='Workflow Success Rate'
          value={
            data?.workflowMetrics.successRate != null
              ? `${data.workflowMetrics.successRate.toFixed(1)}%`
              : '—'
          }
          description='of all executed workflows'
          icon={Workflow}
          isLoading={isLoading}
        />
      </div>

      {/* Secondary metrics */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <MetricRow
          label='Active Orchestrators'
          value={data?.summary.activeOrchestrators ?? 0}
          description='currently running'
          icon={Activity}
          isLoading={isLoading}
        />
        <MetricRow
          label='Channels'
          value={data?.summary.totalChannels ?? 0}
          description='total channels'
          icon={MessageSquare}
          isLoading={isLoading}
        />
        <MetricRow
          label='Successful Workflows'
          value={data?.summary.successfulWorkflows ?? 0}
          description='completed successfully'
          icon={Workflow}
          isLoading={isLoading}
        />
      </div>

      {/* Empty state when no data yet */}
      {!isLoading && !hasData && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <BarChart3 className='h-12 w-12 text-muted-foreground mb-4' />
            <CardTitle className='mb-2'>No activity yet</CardTitle>
            <CardDescription className='max-w-sm'>
              Overview metrics will appear here once your workspace has
              messages, active orchestrators, or completed tasks.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* Charts placeholder — shown when data exists */}
      {!isLoading && hasData && (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Message Volume</CardTitle>
              <CardDescription>
                Daily messages over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-xs text-muted-foreground'>
                Visit the{' '}
                <a
                  href='../analytics'
                  className='underline underline-offset-2 hover:text-foreground'
                >
                  Analytics Dashboard
                </a>{' '}
                for detailed time-series charts.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task Completion</CardTitle>
              <CardDescription>
                Tasks completed over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-xs text-muted-foreground'>
                Visit the{' '}
                <a
                  href='../analytics'
                  className='underline underline-offset-2 hover:text-foreground'
                >
                  Analytics Dashboard
                </a>{' '}
                for detailed time-series charts.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
