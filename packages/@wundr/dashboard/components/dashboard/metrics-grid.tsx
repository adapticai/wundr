'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  TestTube,
  Clock,
  Shield,
  Code,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { realtimeStore, WebSocketMessage } from '@/lib/websocket';
import { RealtimeData } from '@/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Metric {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  progress?: number;
  color?: 'green' | 'red' | 'blue' | 'orange' | 'purple';
}

/**
 * Shape of the data expected from GET /api/metrics.
 * Each field maps directly to one of the six metric cards.
 */
export interface MetricsData {
  linesOfCode: {
    value: number;
    changePercent: number;
    changeLabel: string;
  };
  testCoverage: {
    value: number; // 0–100
    changePercent: number;
    changeLabel: string;
  };
  buildTime: {
    valueMs: number; // milliseconds
    changePercent: number;
    changeLabel: string;
  };
  securityIssues: {
    value: number;
    changePercent: number;
    changeLabel: string;
  };
  activeFiles: {
    value: number;
    changePercent: number;
    changeLabel: string;
  };
  contributors: {
    value: number;
    changePercent: number;
    changeLabel: string;
  };
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

/**
 * Fetches metrics from /api/metrics.
 *
 * NOTE: /api/metrics does not yet exist. This function returns null so that
 * the component renders the "no data" empty state until the endpoint is
 * implemented. Replace this comment and the null return once the route is
 * available.
 */
async function fetchMetrics(): Promise<MetricsData | null> {
  // TODO: implement GET /api/metrics and remove the early return below.
  return null;

  // The fetch call below is wired up and ready; uncomment when the route exists.
  // const response = await fetch('/api/metrics', { cache: 'no-store' })
  // if (!response.ok) {
  //   throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`)
  // }
  // const json = await response.json()
  // return json as MetricsData
}

// ---------------------------------------------------------------------------
// Helpers – transform API data to Metric[]
// ---------------------------------------------------------------------------

function formatBuildTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function metricsDataToCards(data: MetricsData): Metric[] {
  return [
    {
      title: 'Lines of Code',
      value: data.linesOfCode.value.toLocaleString(),
      change: data.linesOfCode.changePercent,
      changeLabel: data.linesOfCode.changeLabel,
      icon: Code,
      description: 'Total lines across all packages',
      color: 'blue',
    },
    {
      title: 'Test Coverage',
      value: `${data.testCoverage.value}%`,
      change: data.testCoverage.changePercent,
      changeLabel: data.testCoverage.changeLabel,
      icon: TestTube,
      description: 'Unit and integration test coverage',
      progress: data.testCoverage.value,
      color: 'green',
    },
    {
      title: 'Build Time',
      value: formatBuildTime(data.buildTime.valueMs),
      change: data.buildTime.changePercent,
      changeLabel: data.buildTime.changeLabel,
      icon: Clock,
      description: 'Average build time across packages',
      color: 'orange',
    },
    {
      title: 'Security Issues',
      value: String(data.securityIssues.value),
      change: data.securityIssues.changePercent,
      changeLabel: data.securityIssues.changeLabel,
      icon: Shield,
      description: 'Known vulnerabilities in dependencies',
      color: 'red',
    },
    {
      title: 'Active Files',
      value: data.activeFiles.value.toLocaleString(),
      change: data.activeFiles.changePercent,
      changeLabel: data.activeFiles.changeLabel,
      icon: FileText,
      description: 'Files modified in last 30 days',
      color: 'purple',
    },
    {
      title: 'Contributors',
      value: String(data.contributors.value),
      change: data.contributors.changePercent,
      changeLabel: data.contributors.changeLabel,
      icon: Users,
      description: 'Active contributors this month',
      color: 'blue',
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <div className='h-4 w-24 bg-muted animate-pulse rounded' />
        <div className='h-4 w-4 bg-muted animate-pulse rounded-full' />
      </CardHeader>
      <CardContent>
        <div className='h-8 w-20 bg-muted animate-pulse rounded mb-2' />
        <div className='h-3 w-36 bg-muted animate-pulse rounded mb-2' />
        <div className='h-3 w-48 bg-muted animate-pulse rounded' />
      </CardContent>
    </Card>
  );
}

function MetricCard({
  metric,
  realtimeValue,
}: {
  metric: Metric;
  realtimeValue?: number;
}) {
  const displayValue =
    realtimeValue !== undefined
      ? `${realtimeValue.toFixed(1)}${metric.title.includes('%') ? '%' : ''}`
      : metric.value;

  const IconComponent = metric.icon;
  const isPositiveChange = metric.change > 0;
  const changeColor = isPositiveChange ? 'text-green-600' : 'text-red-600';
  const TrendIcon = isPositiveChange ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{metric.title}</CardTitle>
        <IconComponent
          className={cn('h-4 w-4', {
            'text-green-500': metric.color === 'green',
            'text-red-500': metric.color === 'red',
            'text-blue-500': metric.color === 'blue',
            'text-orange-500': metric.color === 'orange',
            'text-purple-500': metric.color === 'purple',
          })}
        />
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{displayValue}</div>
        <div className='flex items-center space-x-2 text-xs text-muted-foreground'>
          <div className={cn('flex items-center', changeColor)}>
            <TrendIcon className='h-3 w-3 mr-1' />
            <span>
              {metric.change > 0 ? '+' : ''}
              {metric.change.toFixed(1)}%
            </span>
          </div>
          <span>{metric.changeLabel}</span>
        </div>
        <p className='text-xs text-muted-foreground mt-2'>
          {metric.description}
        </p>
        {metric.progress !== undefined && (
          <Progress value={realtimeValue || metric.progress} className='mt-2' />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function MetricsGrid() {
  const [metrics, setMetrics] = React.useState<Metric[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [realtimeData, setRealtimeData] = React.useState<RealtimeData>({
    connected: false,
    lastUpdate: new Date(),
    events: [],
    metrics: [],
  });

  // Fetch metrics from API
  const loadMetrics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetrics();
      setMetrics(data !== null ? metricsDataToCards(data) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  // Subscribe to WebSocket realtime updates
  React.useEffect(() => {
    const messageHandler = (message: WebSocketMessage) => {
      try {
        const data = message.data ?? message.payload;
        if (message.type === 'realtime-data') {
          setRealtimeData({
            connected: true,
            lastUpdate: new Date(message.timestamp ?? Date.now()),
            events:
              ((data as Record<string, unknown>)
                .events as RealtimeData['events']) || [],
            metrics:
              ((data as Record<string, unknown>)
                .metrics as RealtimeData['metrics']) || [],
          });
        } else if (message.type === 'metrics-update') {
          setRealtimeData(prev => ({
            ...prev,
            connected: true,
            lastUpdate: new Date(message.timestamp ?? Date.now()),
            metrics: Array.isArray(data)
              ? (data as RealtimeData['metrics'])
              : [],
          }));
        }
      } catch (err) {
        console.error(
          'Error processing WebSocket message in MetricsGrid:',
          err
        );
      }
    };

    const unsubscribe = realtimeStore.subscribeToMessages(messageHandler);
    return unsubscribe;
  }, []);

  // Map realtime metrics by card title
  const getRealtimeValue = (metricTitle: string): number | undefined => {
    if (!realtimeData.metrics.length) return undefined;

    switch (metricTitle) {
      case 'Test Coverage':
        return realtimeData.metrics.find(m => m.name === 'testCoverage')?.value;
      case 'Build Time': {
        const buildTime = realtimeData.metrics.find(
          m => m.name === 'buildTime'
        )?.value;
        return buildTime ? buildTime / 1000 : undefined;
      }
      default:
        return undefined;
    }
  };

  // Loading state – render skeleton cards
  if (loading) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state – show message with retry button
  if (error) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card className='col-span-full'>
          <CardContent className='flex flex-col items-center justify-center py-8 gap-3'>
            <AlertCircle className='h-8 w-8 text-destructive' />
            <p className='text-sm text-muted-foreground text-center'>{error}</p>
            <button
              onClick={loadMetrics}
              className='flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline'
            >
              <RefreshCw className='h-3 w-3' />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No data state – API route not yet implemented or returned null
  if (metrics === null) {
    return (
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card className='col-span-full'>
          <CardContent className='flex flex-col items-center justify-center py-8 gap-2'>
            <p className='text-sm font-medium'>No metrics available</p>
            <p className='text-xs text-muted-foreground text-center'>
              The metrics API endpoint has not been implemented yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Data ready
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {metrics.map(metric => (
        <MetricCard
          key={metric.title}
          metric={metric}
          realtimeValue={getRealtimeValue(metric.title)}
        />
      ))}
    </div>
  );
}
