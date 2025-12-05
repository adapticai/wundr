'use client';

import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

import { DateRangePicker } from './date-range-picker';
import { MetricCard } from './metric-card';

/**
 * Props for the UsageAnalyticsDashboard component.
 */
export interface UsageAnalyticsDashboardProps {
  /** The workspace ID to fetch usage analytics for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * API Response structure for usage analytics
 */
interface UsageAnalyticsResponse {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  resourceUsage: {
    storage: {
      total: number; // bytes
      documents: number;
      images: number;
      videos: number;
      other: number;
      limit: number;
      percentUsed: number;
    };
    apiCalls: {
      total: number;
      successful: number;
      failed: number;
      limit: number;
      percentUsed: number;
    };
    bandwidth: {
      total: number; // bytes
      upload: number;
      download: number;
      limit: number;
      percentUsed: number;
    };
    computeTime: {
      total: number; // milliseconds
      orchestrators: number;
      workflows: number;
      limit: number;
      percentUsed: number;
    };
  };
  featureAdoption: {
    orchestrators: {
      active: number;
      total: number;
      adoptionRate: number;
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
    };
    workflows: {
      active: number;
      total: number;
      adoptionRate: number;
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
    };
    channels: {
      active: number;
      total: number;
      adoptionRate: number;
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
    };
    integrations: {
      active: number;
      total: number;
      adoptionRate: number;
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
    };
  };
  usageTrends: {
    daily: Array<{
      date: string;
      storage: number;
      apiCalls: number;
      bandwidth: number;
      computeTime: number;
    }>;
  };
  costAnalysis?: {
    total: number;
    breakdown: {
      storage: number;
      apiCalls: number;
      bandwidth: number;
      compute: number;
    };
    projectedMonthly: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  };
  topResourceConsumers: {
    byStorage: Array<{
      id: string;
      name: string;
      value: number;
      type: 'user' | 'orchestrator' | 'channel';
    }>;
    byApiCalls: Array<{
      id: string;
      name: string;
      value: number;
      type: 'user' | 'orchestrator' | 'integration';
    }>;
    byComputeTime: Array<{
      id: string;
      name: string;
      value: number;
      type: 'orchestrator' | 'workflow';
    }>;
  };
}

type Granularity = 'daily' | 'weekly' | 'monthly';

export function UsageAnalyticsDashboard({
  workspaceId,
  className,
}: UsageAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<UsageAnalyticsResponse | null>(null);
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({ granularity });
      if (dateRange.from) {
        queryParams.set('startDate', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        queryParams.set('endDate', dateRange.to.toISOString());
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/usage?${queryParams}`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch usage analytics' }));
        throw new Error(errorData.error || 'Failed to fetch usage analytics');
      }

      const data: UsageAnalyticsResponse = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Usage analytics fetch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load usage analytics'
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, granularity, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format timestamp to date string
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return timestamp;
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  if (error && !metrics) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <div className='max-w-md mx-auto'>
          <svg
            className='w-16 h-16 mx-auto text-muted-foreground mb-4'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
          <p className='text-lg font-medium text-foreground mb-2'>
            Failed to load usage analytics
          </p>
          <p className='text-muted-foreground mb-4'>{error}</p>
          <button
            onClick={fetchData}
            className='px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasData = metrics !== null;

  // Chart configurations
  const storageChartConfig: ChartConfig = {
    storage: {
      label: 'Storage',
      color: 'hsl(var(--chart-1))',
    },
  };

  const apiCallsChartConfig: ChartConfig = {
    apiCalls: {
      label: 'API Calls',
      color: 'hsl(var(--chart-2))',
    },
  };

  const bandwidthChartConfig: ChartConfig = {
    bandwidth: {
      label: 'Bandwidth',
      color: 'hsl(var(--chart-3))',
    },
  };

  const computeChartConfig: ChartConfig = {
    computeTime: {
      label: 'Compute Time',
      color: 'hsl(var(--chart-4))',
    },
  };

  const storageBreakdownConfig: ChartConfig = {
    documents: {
      label: 'Documents',
      color: 'hsl(var(--chart-1))',
    },
    images: {
      label: 'Images',
      color: 'hsl(var(--chart-2))',
    },
    videos: {
      label: 'Videos',
      color: 'hsl(var(--chart-3))',
    },
    other: {
      label: 'Other',
      color: 'hsl(var(--chart-4))',
    },
  };

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header with controls */}
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h2 className='text-lg sm:text-xl font-semibold text-foreground'>
            Usage Analytics
          </h2>
          {metrics?.workspace && (
            <p className='text-sm text-muted-foreground mt-0.5'>
              {metrics.workspace.name}
            </p>
          )}
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          {/* Granularity selector */}
          <div className='flex gap-2'>
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map(g => (
              <button
                key={g}
                onClick={() => {
                  setGranularity(g);
                  setDateRange({});
                }}
                disabled={isLoading}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  granularity === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onSelect={range => {
              setDateRange(range);
            }}
          />

          {/* Refresh button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
              'bg-muted text-muted-foreground hover:bg-muted/80',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title='Refresh data'
          >
            <RefreshIcon
              className={clsx('w-4 h-4', isLoading && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* Resource Usage Overview */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          title='Storage Used'
          value={metrics?.resourceUsage.storage.total || 0}
          icon={<StorageIcon />}
          format='bytes'
          isLoading={isLoading}
        />
        <MetricCard
          title='API Calls'
          value={metrics?.resourceUsage.apiCalls.total || 0}
          icon={<ApiIcon />}
          format='compact'
          isLoading={isLoading}
        />
        <MetricCard
          title='Bandwidth'
          value={metrics?.resourceUsage.bandwidth.total || 0}
          icon={<BandwidthIcon />}
          format='bytes'
          isLoading={isLoading}
        />
        <MetricCard
          title='Compute Time'
          value={
            metrics?.resourceUsage.computeTime.total
              ? metrics.resourceUsage.computeTime.total / 1000
              : 0
          }
          icon={<ComputeIcon />}
          format='duration'
          isLoading={isLoading}
        />
      </div>

      {/* Resource Limits */}
      {hasData && !isLoading && (
        <>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Storage Quota</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>
                      {formatBytes(metrics?.resourceUsage.storage.total || 0)}{' '}
                      of{' '}
                      {formatBytes(metrics?.resourceUsage.storage.limit || 0)}
                    </span>
                    <span className='font-medium'>
                      {metrics?.resourceUsage.storage.percentUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-3'>
                    <div
                      className={clsx(
                        'h-3 rounded-full transition-all',
                        (metrics?.resourceUsage.storage.percentUsed || 0) > 90
                          ? 'bg-destructive'
                          : (metrics?.resourceUsage.storage.percentUsed || 0) >
                              75
                            ? 'bg-yellow-500'
                            : 'bg-primary'
                      )}
                      style={{
                        width: `${Math.min(metrics?.resourceUsage.storage.percentUsed || 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>API Calls Quota</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='space-y-2'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>
                      {(
                        metrics?.resourceUsage.apiCalls.total || 0
                      ).toLocaleString()}{' '}
                      of{' '}
                      {(
                        metrics?.resourceUsage.apiCalls.limit || 0
                      ).toLocaleString()}
                    </span>
                    <span className='font-medium'>
                      {metrics?.resourceUsage.apiCalls.percentUsed.toFixed(1)}%
                    </span>
                  </div>
                  <div className='w-full bg-muted rounded-full h-3'>
                    <div
                      className={clsx(
                        'h-3 rounded-full transition-all',
                        (metrics?.resourceUsage.apiCalls.percentUsed || 0) > 90
                          ? 'bg-destructive'
                          : (metrics?.resourceUsage.apiCalls.percentUsed || 0) >
                              75
                            ? 'bg-yellow-500'
                            : 'bg-primary'
                      )}
                      style={{
                        width: `${Math.min(metrics?.resourceUsage.apiCalls.percentUsed || 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feature Adoption */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Feature Adoption</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>Orchestrators</span>
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        metrics?.featureAdoption.orchestrators.trend === 'up' &&
                          'text-emerald-600',
                        metrics?.featureAdoption.orchestrators.trend ===
                          'down' && 'text-rose-600',
                        metrics?.featureAdoption.orchestrators.trend ===
                          'stable' && 'text-muted-foreground'
                      )}
                    >
                      {metrics?.featureAdoption.orchestrators.trend === 'up' &&
                        '↑'}
                      {metrics?.featureAdoption.orchestrators.trend ===
                        'down' && '↓'}
                      {Math.abs(
                        metrics?.featureAdoption.orchestrators.changePercent ||
                          0
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className='text-2xl font-semibold'>
                    {metrics?.featureAdoption.orchestrators.adoptionRate.toFixed(
                      1
                    )}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {metrics?.featureAdoption.orchestrators.active} /{' '}
                    {metrics?.featureAdoption.orchestrators.total} active
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>Workflows</span>
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        metrics?.featureAdoption.workflows.trend === 'up' &&
                          'text-emerald-600',
                        metrics?.featureAdoption.workflows.trend === 'down' &&
                          'text-rose-600',
                        metrics?.featureAdoption.workflows.trend === 'stable' &&
                          'text-muted-foreground'
                      )}
                    >
                      {metrics?.featureAdoption.workflows.trend === 'up' && '↑'}
                      {metrics?.featureAdoption.workflows.trend === 'down' &&
                        '↓'}
                      {Math.abs(
                        metrics?.featureAdoption.workflows.changePercent || 0
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className='text-2xl font-semibold'>
                    {metrics?.featureAdoption.workflows.adoptionRate.toFixed(1)}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {metrics?.featureAdoption.workflows.active} /{' '}
                    {metrics?.featureAdoption.workflows.total} active
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>Channels</span>
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        metrics?.featureAdoption.channels.trend === 'up' &&
                          'text-emerald-600',
                        metrics?.featureAdoption.channels.trend === 'down' &&
                          'text-rose-600',
                        metrics?.featureAdoption.channels.trend === 'stable' &&
                          'text-muted-foreground'
                      )}
                    >
                      {metrics?.featureAdoption.channels.trend === 'up' && '↑'}
                      {metrics?.featureAdoption.channels.trend === 'down' &&
                        '↓'}
                      {Math.abs(
                        metrics?.featureAdoption.channels.changePercent || 0
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className='text-2xl font-semibold'>
                    {metrics?.featureAdoption.channels.adoptionRate.toFixed(1)}%
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {metrics?.featureAdoption.channels.active} /{' '}
                    {metrics?.featureAdoption.channels.total} active
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium'>Integrations</span>
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        metrics?.featureAdoption.integrations.trend === 'up' &&
                          'text-emerald-600',
                        metrics?.featureAdoption.integrations.trend ===
                          'down' && 'text-rose-600',
                        metrics?.featureAdoption.integrations.trend ===
                          'stable' && 'text-muted-foreground'
                      )}
                    >
                      {metrics?.featureAdoption.integrations.trend === 'up' &&
                        '↑'}
                      {metrics?.featureAdoption.integrations.trend === 'down' &&
                        '↓'}
                      {Math.abs(
                        metrics?.featureAdoption.integrations.changePercent || 0
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className='text-2xl font-semibold'>
                    {metrics?.featureAdoption.integrations.adoptionRate.toFixed(
                      1
                    )}
                    %
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {metrics?.featureAdoption.integrations.active} /{' '}
                    {metrics?.featureAdoption.integrations.total} active
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Trends */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Storage Usage Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={storageChartConfig}
                  className='h-[200px]'
                >
                  <AreaChart
                    data={metrics?.usageTrends.daily.map(d => ({
                      date: formatTimestamp(d.date),
                      storage: d.storage,
                    }))}
                    margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray='3 3'
                      className='stroke-muted'
                    />
                    <XAxis
                      dataKey='date'
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={value => formatBytes(value)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator='dot' />}
                    />
                    <Area
                      dataKey='storage'
                      type='monotone'
                      fill='var(--color-storage)'
                      fillOpacity={0.2}
                      stroke='var(--color-storage)'
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>API Calls Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={apiCallsChartConfig}
                  className='h-[200px]'
                >
                  <LineChart
                    data={metrics?.usageTrends.daily.map(d => ({
                      date: formatTimestamp(d.date),
                      apiCalls: d.apiCalls,
                    }))}
                    margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray='3 3'
                      className='stroke-muted'
                    />
                    <XAxis
                      dataKey='date'
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={32}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={value => value.toLocaleString()}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator='dot' />}
                    />
                    <Line
                      dataKey='apiCalls'
                      type='monotone'
                      stroke='var(--color-apiCalls)'
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Storage Breakdown & Cost Analysis */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Storage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={storageBreakdownConfig}
                  className='h-[250px]'
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                      data={[
                        {
                          name: 'documents',
                          value: metrics?.resourceUsage.storage.documents || 0,
                          fill: 'var(--color-documents)',
                        },
                        {
                          name: 'images',
                          value: metrics?.resourceUsage.storage.images || 0,
                          fill: 'var(--color-images)',
                        },
                        {
                          name: 'videos',
                          value: metrics?.resourceUsage.storage.videos || 0,
                          fill: 'var(--color-videos)',
                        },
                        {
                          name: 'other',
                          value: metrics?.resourceUsage.storage.other || 0,
                          fill: 'var(--color-other)',
                        },
                      ]}
                      dataKey='value'
                      nameKey='name'
                      cx='50%'
                      cy='50%'
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    />
                  </PieChart>
                </ChartContainer>
                <div className='grid grid-cols-2 gap-2 mt-4'>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]' />
                    <span className='text-xs text-muted-foreground'>
                      Documents:{' '}
                      {formatBytes(
                        metrics?.resourceUsage.storage.documents || 0
                      )}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]' />
                    <span className='text-xs text-muted-foreground'>
                      Images:{' '}
                      {formatBytes(metrics?.resourceUsage.storage.images || 0)}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-[hsl(var(--chart-3))]' />
                    <span className='text-xs text-muted-foreground'>
                      Videos:{' '}
                      {formatBytes(metrics?.resourceUsage.storage.videos || 0)}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div className='w-3 h-3 rounded-full bg-[hsl(var(--chart-4))]' />
                    <span className='text-xs text-muted-foreground'>
                      Other:{' '}
                      {formatBytes(metrics?.resourceUsage.storage.other || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {metrics?.costAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Cost Analysis</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <div className='flex justify-between items-start'>
                      <span className='text-sm text-muted-foreground'>
                        Current Period
                      </span>
                      <div className='text-right'>
                        <div className='text-2xl font-semibold'>
                          ${metrics.costAnalysis.total.toFixed(2)}
                        </div>
                        <div
                          className={clsx(
                            'text-xs font-medium',
                            metrics.costAnalysis.trend === 'up' &&
                              'text-rose-600',
                            metrics.costAnalysis.trend === 'down' &&
                              'text-emerald-600',
                            metrics.costAnalysis.trend === 'stable' &&
                              'text-muted-foreground'
                          )}
                        >
                          {metrics.costAnalysis.trend === 'up' && '↑'}
                          {metrics.costAnalysis.trend === 'down' && '↓'}
                          {Math.abs(metrics.costAnalysis.changePercent).toFixed(
                            1
                          )}
                          % vs last period
                        </div>
                      </div>
                    </div>
                    <div className='pt-4 space-y-3 border-t'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Storage</span>
                        <span className='font-medium'>
                          ${metrics.costAnalysis.breakdown.storage.toFixed(2)}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>API Calls</span>
                        <span className='font-medium'>
                          ${metrics.costAnalysis.breakdown.apiCalls.toFixed(2)}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Bandwidth</span>
                        <span className='font-medium'>
                          ${metrics.costAnalysis.breakdown.bandwidth.toFixed(2)}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>Compute</span>
                        <span className='font-medium'>
                          ${metrics.costAnalysis.breakdown.compute.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className='pt-3 border-t'>
                      <div className='flex justify-between items-center'>
                        <span className='text-sm font-medium'>
                          Projected Monthly
                        </span>
                        <span className='text-lg font-semibold'>
                          ${metrics.costAnalysis.projectedMonthly.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top Resource Consumers */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Top Storage Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics?.topResourceConsumers.byStorage
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className='flex items-center gap-3'>
                        <div className='flex-shrink-0 w-6 text-sm font-medium text-muted-foreground'>
                          #{index + 1}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium truncate'>
                            {item.name}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.type}
                          </div>
                        </div>
                        <div className='text-sm font-medium'>
                          {formatBytes(item.value)}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Top API Callers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics?.topResourceConsumers.byApiCalls
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className='flex items-center gap-3'>
                        <div className='flex-shrink-0 w-6 text-sm font-medium text-muted-foreground'>
                          #{index + 1}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium truncate'>
                            {item.name}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.type}
                          </div>
                        </div>
                        <div className='text-sm font-medium'>
                          {item.value.toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Top Compute Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {metrics?.topResourceConsumers.byComputeTime
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={item.id} className='flex items-center gap-3'>
                        <div className='flex-shrink-0 w-6 text-sm font-medium text-muted-foreground'>
                          #{index + 1}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium truncate'>
                            {item.name}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.type}
                          </div>
                        </div>
                        <div className='text-sm font-medium'>
                          {(item.value / 1000).toFixed(1)}s
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='space-y-6'>
          <Skeleton className='h-32 w-full' />
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Skeleton className='h-64 w-full' />
            <Skeleton className='h-64 w-full' />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper icons
function StorageIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className='w-5 h-5'
    >
      <ellipse cx='12' cy='5' rx='9' ry='3' />
      <path d='M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5' />
      <path d='M3 12c0 1.7 4 3 9 3s9-1.3 9-3' />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className='w-5 h-5'
    >
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' />
      <path d='m9 12 2 2 4-4' />
    </svg>
  );
}

function BandwidthIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className='w-5 h-5'
    >
      <path d='M5 12.55a11 11 0 0 1 14.08 0' />
      <path d='M1.42 9a16 16 0 0 1 21.16 0' />
      <path d='M8.53 16.11a6 6 0 0 1 6.95 0' />
      <circle cx='12' cy='20' r='1' />
    </svg>
  );
}

function ComputeIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className='w-5 h-5'
    >
      <rect width='14' height='8' x='5' y='2' rx='2' />
      <rect width='20' height='8' x='2' y='14' rx='2' />
      <path d='M6 18h2' />
      <path d='M12 18h6' />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      className={className}
    >
      <path d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2' />
    </svg>
  );
}

export default UsageAnalyticsDashboard;
