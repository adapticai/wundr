'use client';

import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  Server,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { MetricCard } from './metric-card';

interface PerformanceAnalyticsDashboardProps {
  workspaceId: string;
}

// Performance Metrics Types
interface PageLoadMetric {
  timestamp: string;
  hour: string;
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
}

interface ApiResponseMetric {
  timestamp: string;
  hour: string;
  endpoint: string;
  avgResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  requests: number;
}

interface ErrorMetric {
  timestamp: string;
  hour: string;
  total: number;
  client: number;
  server: number;
  network: number;
  errorRate: number;
}

interface ThroughputMetric {
  timestamp: string;
  hour: string;
  requests: number;
  successfulRequests: number;
  failedRequests: number;
  avgThroughput: number;
}

// Chart Configurations
const pageLoadChartConfig = {
  fcp: {
    label: 'First Contentful Paint',
    color: 'hsl(var(--chart-1))',
  },
  lcp: {
    label: 'Largest Contentful Paint',
    color: 'hsl(var(--chart-2))',
  },
  fid: {
    label: 'First Input Delay',
    color: 'hsl(var(--chart-3))',
  },
  ttfb: {
    label: 'Time to First Byte',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

const apiResponseChartConfig = {
  p50: {
    label: '50th Percentile',
    color: 'hsl(var(--chart-1))',
  },
  p95: {
    label: '95th Percentile',
    color: 'hsl(var(--chart-2))',
  },
  p99: {
    label: '99th Percentile',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const errorRateChartConfig = {
  client: {
    label: 'Client Errors',
    color: 'hsl(var(--chart-1))',
  },
  server: {
    label: 'Server Errors',
    color: 'hsl(var(--chart-2))',
  },
  network: {
    label: 'Network Errors',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const throughputChartConfig = {
  successful: {
    label: 'Successful Requests',
    color: 'hsl(var(--chart-1))',
  },
  failed: {
    label: 'Failed Requests',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

/**
 * API response structure for performance metrics
 */
interface PerformanceMetricsResponse {
  pageLoad?: {
    metrics: PageLoadMetric[];
  };
  apiResponse?: {
    metrics: ApiResponseMetric[];
  };
  errors?: {
    metrics: ErrorMetric[];
  };
  throughput?: {
    metrics: ThroughputMetric[];
  };
}

export function PerformanceAnalyticsDashboard({
  workspaceId,
}: PerformanceAnalyticsDashboardProps) {
  const [pageLoadData, setPageLoadData] = useState<PageLoadMetric[]>([]);
  const [apiResponseData, setApiResponseData] = useState<ApiResponseMetric[]>(
    []
  );
  const [errorData, setErrorData] = useState<ErrorMetric[]>([]);
  const [throughputData, setThroughputData] = useState<ThroughputMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/analytics/metrics?type=performance`
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to fetch performance metrics' }));
        throw new Error(
          errorData.error || 'Failed to fetch performance metrics'
        );
      }

      const data: PerformanceMetricsResponse = await response.json();

      const pageLoad = data.pageLoad?.metrics ?? [];
      const apiResponse = data.apiResponse?.metrics ?? [];
      const errors = data.errors?.metrics ?? [];
      const throughput = data.throughput?.metrics ?? [];

      setPageLoadData(pageLoad);
      setApiResponseData(apiResponse);
      setErrorData(errors);
      setThroughputData(throughput);
      setHasData(
        pageLoad.length > 0 ||
          apiResponse.length > 0 ||
          errors.length > 0 ||
          throughput.length > 0
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load performance data'
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();

    // Refresh every 30 seconds while mounted
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate summary metrics
  const avgLCP = pageLoadData.length
    ? Math.round(
        pageLoadData.reduce((sum, d) => sum + d.lcp, 0) / pageLoadData.length
      )
    : 0;

  const avgApiResponse = apiResponseData.length
    ? Math.round(
        apiResponseData.reduce((sum, d) => sum + d.p50, 0) /
          apiResponseData.length
      )
    : 0;

  const totalErrors = errorData.reduce((sum, d) => sum + d.total, 0);
  const avgErrorRate = errorData.length
    ? errorData.reduce((sum, d) => sum + d.errorRate, 0) / errorData.length
    : 0;

  const avgThroughput = throughputData.length
    ? Math.round(
        throughputData.reduce((sum, d) => sum + d.avgThroughput, 0) /
          throughputData.length
      )
    : 0;

  // Calculate trends (compare last 6 hours vs previous 6 hours)
  const getLCPTrend = () => {
    if (pageLoadData.length < 12)
      return { value: 0, percent: 0, trend: 'stable' as const };
    const recent =
      pageLoadData.slice(-6).reduce((sum, d) => sum + d.lcp, 0) / 6;
    const previous =
      pageLoadData.slice(-12, -6).reduce((sum, d) => sum + d.lcp, 0) / 6;
    const change = recent - previous;
    const percent = (change / previous) * 100;
    return {
      value: Math.round(change),
      percent: Math.abs(percent),
      trend:
        change > 0
          ? ('up' as const)
          : change < 0
            ? ('down' as const)
            : ('stable' as const),
    };
  };

  const getApiTrend = () => {
    if (apiResponseData.length < 12)
      return { value: 0, percent: 0, trend: 'stable' as const };
    const recent =
      apiResponseData.slice(-6).reduce((sum, d) => sum + d.p50, 0) / 6;
    const previous =
      apiResponseData.slice(-12, -6).reduce((sum, d) => sum + d.p50, 0) / 6;
    const change = recent - previous;
    const percent = (change / previous) * 100;
    return {
      value: Math.round(change),
      percent: Math.abs(percent),
      trend:
        change > 0
          ? ('up' as const)
          : change < 0
            ? ('down' as const)
            : ('stable' as const),
    };
  };

  const getErrorTrend = () => {
    if (errorData.length < 12)
      return { value: 0, percent: 0, trend: 'stable' as const };
    const recent =
      errorData.slice(-6).reduce((sum, d) => sum + d.errorRate, 0) / 6;
    const previous =
      errorData.slice(-12, -6).reduce((sum, d) => sum + d.errorRate, 0) / 6;
    const change = recent - previous;
    const percent = Math.abs((change / (previous || 1)) * 100);
    return {
      value: Number(change.toFixed(2)),
      percent,
      trend:
        change > 0
          ? ('up' as const)
          : change < 0
            ? ('down' as const)
            : ('stable' as const),
    };
  };

  const getThroughputTrend = () => {
    if (throughputData.length < 12)
      return { value: 0, percent: 0, trend: 'stable' as const };
    const recent =
      throughputData.slice(-6).reduce((sum, d) => sum + d.avgThroughput, 0) / 6;
    const previous =
      throughputData
        .slice(-12, -6)
        .reduce((sum, d) => sum + d.avgThroughput, 0) / 6;
    const change = recent - previous;
    const percent = (change / previous) * 100;
    return {
      value: Math.round(change),
      percent: Math.abs(percent),
      trend:
        change > 0
          ? ('up' as const)
          : change < 0
            ? ('down' as const)
            : ('stable' as const),
    };
  };

  if (error && !hasData) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center max-w-sm'>
          <BarChart3 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
          <p className='text-base font-medium text-foreground mb-2'>
            Failed to load performance data
          </p>
          <p className='text-sm text-muted-foreground mb-4'>{error}</p>
          <Button onClick={fetchData} size='sm'>
            <Activity className='h-4 w-4 mr-2' />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoading && !hasData) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center max-w-sm'>
          <BarChart3 className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
          <p className='text-base font-medium text-foreground mb-2'>
            No performance data available
          </p>
          <p className='text-sm text-muted-foreground'>
            Performance metrics will appear here once your workspace has
            sufficient activity. Check back after enabling monitoring
            integrations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header with Status Badge */}
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-muted-foreground mt-1 text-sm'>
            Real-time performance metrics and system health monitoring
          </p>
        </div>
        <Badge
          variant={avgErrorRate < 1 ? 'default' : 'destructive'}
          className='text-sm px-3 py-1'
        >
          <Activity className='w-4 h-4 mr-1' />
          {avgErrorRate < 1 ? 'Healthy' : 'Degraded'}
        </Badge>
      </div>

      {/* Key Metrics Overview */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <MetricCard
          title='Avg Page Load (LCP)'
          value={avgLCP}
          format='duration'
          icon={<Clock className='w-5 h-5' />}
          change={getLCPTrend()}
          isLoading={isLoading}
        />
        <MetricCard
          title='API Response Time (P50)'
          value={avgApiResponse}
          format='duration'
          icon={<Zap className='w-5 h-5' />}
          change={getApiTrend()}
          isLoading={isLoading}
        />
        <MetricCard
          title='Error Rate'
          value={avgErrorRate.toFixed(2)}
          format='percent'
          icon={<AlertCircle className='w-5 h-5' />}
          change={getErrorTrend()}
          isLoading={isLoading}
        />
        <MetricCard
          title='Throughput'
          value={avgThroughput}
          icon={<TrendingUp className='w-5 h-5' />}
          change={getThroughputTrend()}
          isLoading={isLoading}
        />
      </div>

      {/* Performance Charts */}
      <Tabs defaultValue='page-load' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='page-load'>
            <Clock className='w-4 h-4 mr-2' />
            Page Load
          </TabsTrigger>
          <TabsTrigger value='api-response'>
            <Server className='w-4 h-4 mr-2' />
            API Response
          </TabsTrigger>
          <TabsTrigger value='errors'>
            <AlertCircle className='w-4 h-4 mr-2' />
            Errors
          </TabsTrigger>
          <TabsTrigger value='throughput'>
            <BarChart3 className='w-4 h-4 mr-2' />
            Throughput
          </TabsTrigger>
        </TabsList>

        {/* Page Load Metrics */}
        <TabsContent value='page-load' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals - Last 24 Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={pageLoadChartConfig}
                className='h-[400px]'
              >
                <LineChart data={pageLoadData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='hour'
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={value => `${value}ms`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line
                    type='monotone'
                    dataKey='fcp'
                    stroke='var(--color-fcp)'
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type='monotone'
                    dataKey='lcp'
                    stroke='var(--color-lcp)'
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type='monotone'
                    dataKey='fid'
                    stroke='var(--color-fid)'
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type='monotone'
                    dataKey='ttfb'
                    stroke='var(--color-ttfb)'
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className='grid gap-4 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Cumulative Layout Shift (CLS)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    cls: {
                      label: 'CLS Score',
                      color: 'hsl(var(--chart-5))',
                    },
                  }}
                  className='h-[200px]'
                >
                  <AreaChart data={pageLoadData}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='hour' tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type='monotone'
                      dataKey='cls'
                      stroke='var(--color-cls)'
                      fill='var(--color-cls)'
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Performance Score</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {pageLoadData.slice(-1).map(data => {
                  const lcpScore =
                    data.lcp < 2500 ? 100 : data.lcp < 4000 ? 50 : 0;
                  const fidScore =
                    data.fid < 100 ? 100 : data.fid < 300 ? 50 : 0;
                  const clsScore =
                    data.cls < 0.1 ? 100 : data.cls < 0.25 ? 50 : 0;
                  const overallScore = Math.round(
                    (lcpScore + fidScore + clsScore) / 3
                  );

                  return (
                    <div key={data.timestamp} className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <span className='text-4xl font-bold'>
                          {overallScore}
                        </span>
                        <Badge
                          variant={
                            overallScore >= 90
                              ? 'default'
                              : overallScore >= 50
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {overallScore >= 90
                            ? 'Good'
                            : overallScore >= 50
                              ? 'Needs Improvement'
                              : 'Poor'}
                        </Badge>
                      </div>
                      <div className='space-y-2 text-sm'>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>LCP</span>
                          <span className='font-medium'>
                            {Math.round(data.lcp)}ms
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>FID</span>
                          <span className='font-medium'>
                            {Math.round(data.fid)}ms
                          </span>
                        </div>
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>CLS</span>
                          <span className='font-medium'>
                            {data.cls.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Response Times */}
        <TabsContent value='api-response' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>API Response Time Percentiles</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={apiResponseChartConfig}
                className='h-[400px]'
              >
                <AreaChart data={apiResponseData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='hour'
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={value => `${value}ms`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area
                    type='monotone'
                    dataKey='p50'
                    stroke='var(--color-p50)'
                    fill='var(--color-p50)'
                    fillOpacity={0.2}
                    stackId='1'
                  />
                  <Area
                    type='monotone'
                    dataKey='p95'
                    stroke='var(--color-p95)'
                    fill='var(--color-p95)'
                    fillOpacity={0.2}
                    stackId='2'
                  />
                  <Area
                    type='monotone'
                    dataKey='p99'
                    stroke='var(--color-p99)'
                    fill='var(--color-p99)'
                    fillOpacity={0.2}
                    stackId='3'
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request Volume by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  requests: {
                    label: 'Total Requests',
                    color: 'hsl(var(--chart-4))',
                  },
                }}
                className='h-[250px]'
              >
                <BarChart data={apiResponseData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis dataKey='hour' tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey='requests'
                    fill='var(--color-requests)'
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Rates */}
        <TabsContent value='errors' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={errorRateChartConfig}
                className='h-[400px]'
              >
                <BarChart data={errorData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='hour'
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey='client'
                    fill='var(--color-client)'
                    stackId='errors'
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey='server'
                    fill='var(--color-server)'
                    stackId='errors'
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey='network'
                    fill='var(--color-network)'
                    stackId='errors'
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className='grid gap-4 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Error Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    errorRate: {
                      label: 'Error Rate %',
                      color: 'hsl(var(--destructive))',
                    },
                  }}
                  className='h-[200px]'
                >
                  <LineChart data={errorData}>
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis dataKey='hour' tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={value => `${value}%`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type='monotone'
                      dataKey='errorRate'
                      stroke='var(--color-errorRate)'
                      strokeWidth={2}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Total Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='text-4xl font-bold'>{totalErrors}</span>
                    <Badge variant='destructive'>Last 24h</Badge>
                  </div>
                  <div className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Client Errors (4xx)
                      </span>
                      <span className='font-medium'>
                        {errorData.reduce((sum, d) => sum + d.client, 0)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Server Errors (5xx)
                      </span>
                      <span className='font-medium'>
                        {errorData.reduce((sum, d) => sum + d.server, 0)}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Network Errors
                      </span>
                      <span className='font-medium'>
                        {errorData.reduce((sum, d) => sum + d.network, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Throughput */}
        <TabsContent value='throughput' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Request Throughput</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={throughputChartConfig}
                className='h-[400px]'
              >
                <BarChart data={throughputData}>
                  <CartesianGrid strokeDasharray='3 3' />
                  <XAxis
                    dataKey='hour'
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey='successfulRequests'
                    fill='var(--color-successful)'
                    stackId='requests'
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey='failedRequests'
                    fill='var(--color-failed)'
                    stackId='requests'
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className='grid gap-4 md:grid-cols-3'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Avg Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>{avgThroughput}</div>
                <p className='text-xs text-muted-foreground mt-1'>
                  requests/minute
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>
                  {(
                    (throughputData.reduce(
                      (sum, d) => sum + d.successfulRequests,
                      0
                    ) /
                      throughputData.reduce((sum, d) => sum + d.requests, 0)) *
                    100
                  ).toFixed(1)}
                  %
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  of all requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Peak Throughput</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>
                  {Math.max(...throughputData.map(d => d.avgThroughput))}
                </div>
                <p className='text-xs text-muted-foreground mt-1'>
                  requests/minute
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
