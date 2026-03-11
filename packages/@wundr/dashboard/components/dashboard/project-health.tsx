'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  Zap,
  Code,
  FileText,
  TrendingUp,
  TrendingDown,
  ServerCrash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthMetric {
  name: string;
  value: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
  trend: 'up' | 'down' | 'stable';
  details?: string[];
}

interface Issue {
  id: string;
  type: 'security' | 'performance' | 'quality' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

interface ServerHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database?: 'ok' | 'error';
    memory?: 'ok' | 'warning' | 'error';
  };
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

function serverStatusToMetricStatus(
  status: ServerHealthResponse['status']
): HealthMetric['status'] {
  switch (status) {
    case 'healthy':
      return 'excellent';
    case 'degraded':
      return 'warning';
    case 'unhealthy':
      return 'critical';
  }
}

function memoryCheckToDetails(memory?: 'ok' | 'warning' | 'error'): string[] {
  switch (memory) {
    case 'ok':
      return ['Memory usage is within normal limits'];
    case 'warning':
      return ['Memory usage is elevated (above 75%)'];
    case 'error':
      return ['Memory usage is critically high (above 90%)'];
    default:
      return ['Memory status unavailable'];
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getStatusColor(status: HealthMetric['status']) {
  switch (status) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-blue-600';
    case 'warning':
      return 'text-orange-600';
    case 'critical':
      return 'text-red-600';
  }
}

function getStatusIcon(status: HealthMetric['status']) {
  switch (status) {
    case 'excellent':
      return CheckCircle;
    case 'good':
      return CheckCircle;
    case 'warning':
      return AlertCircle;
    case 'critical':
      return XCircle;
  }
}

function getIssueIcon(type: Issue['type']) {
  switch (type) {
    case 'security':
      return Shield;
    case 'performance':
      return Zap;
    case 'quality':
      return Code;
    case 'maintenance':
      return FileText;
  }
}

function getSeverityColor(severity: Issue['severity']) {
  switch (severity) {
    case 'low':
      return 'text-green-600 border-green-200';
    case 'medium':
      return 'text-orange-600 border-orange-200';
    case 'high':
      return 'text-red-600 border-red-200';
    case 'critical':
      return 'text-red-700 border-red-300';
  }
}

function HealthMetricCard({ metric }: { metric: HealthMetric }) {
  const StatusIcon = getStatusIcon(metric.status);
  const TrendIcon =
    metric.trend === 'up'
      ? TrendingUp
      : metric.trend === 'down'
        ? TrendingDown
        : Clock;

  return (
    <Card>
      <CardHeader className='pb-4'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-lg'>{metric.name}</CardTitle>
          <div className='flex items-center space-x-2'>
            <StatusIcon
              className={cn('h-5 w-5', getStatusColor(metric.status))}
            />
            <TrendIcon
              className={cn('h-4 w-4', {
                'text-green-500': metric.trend === 'up',
                'text-red-500': metric.trend === 'down',
                'text-gray-500': metric.trend === 'stable',
              })}
            />
          </div>
        </div>
        <CardDescription>{metric.description}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <div className='flex justify-between text-sm'>
            <span>Score</span>
            <span className='font-medium'>{metric.value}/100</span>
          </div>
          <Progress value={metric.value} className='h-2' />
        </div>

        {metric.details && (
          <div className='space-y-1'>
            <p className='text-sm font-medium'>Key Points:</p>
            <ul className='text-xs text-muted-foreground space-y-1'>
              {metric.details.map((detail, index) => (
                <li key={index} className='flex items-center space-x-2'>
                  <div className='h-1 w-1 rounded-full bg-muted-foreground flex-shrink-0' />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const Icon = getIssueIcon(issue.type);

  return (
    <Card className='mb-4'>
      <CardContent className='pt-6'>
        <div className='flex items-start space-x-3'>
          <Icon className='h-5 w-5 mt-0.5 text-muted-foreground' />
          <div className='flex-1 space-y-2'>
            <div className='flex items-center justify-between'>
              <h4 className='text-sm font-medium'>{issue.title}</h4>
              <Badge
                variant='outline'
                className={cn('text-xs', getSeverityColor(issue.severity))}
              >
                {issue.severity}
              </Badge>
            </div>
            <p className='text-sm text-muted-foreground'>{issue.description}</p>
            {issue.file && (
              <p className='text-xs text-muted-foreground'>
                {issue.file}
                {issue.line && ` (line ${issue.line})`}
              </p>
            )}
            {issue.suggestion && (
              <div className='mt-2 p-2 bg-muted rounded-md'>
                <p className='text-xs font-medium text-muted-foreground mb-1'>
                  Suggestion:
                </p>
                <p className='text-xs text-muted-foreground'>
                  {issue.suggestion}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UnavailablePlaceholder({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className='flex flex-col items-center justify-center py-10 space-y-3'>
        <ServerCrash className='h-8 w-8 text-muted-foreground opacity-50' />
        <p className='text-sm text-muted-foreground'>{label} unavailable</p>
        <p className='text-xs text-muted-foreground'>
          No data source is configured for this metric.
        </p>
      </CardContent>
    </Card>
  );
}

export function ProjectHealth() {
  const [fetchState, setFetchState] = React.useState<FetchState>('idle');
  const [serverHealth, setServerHealth] =
    React.useState<ServerHealthResponse | null>(null);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchHealth() {
      setFetchState('loading');
      setFetchError(null);

      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error(
            `Health endpoint responded with status ${response.status}`
          );
        }
        const data: ServerHealthResponse = await response.json();
        if (!cancelled) {
          setServerHealth(data);
          setFetchState('success');
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : 'Failed to fetch health data'
          );
          setFetchState('error');
        }
      }
    }

    fetchHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Derive a single real metric from the server health response
  const serverMetric: HealthMetric | null = React.useMemo(() => {
    if (!serverHealth) return null;

    const statusToValue: Record<ServerHealthResponse['status'], number> = {
      healthy: 100,
      degraded: 60,
      unhealthy: 20,
    };

    return {
      name: 'System Health',
      value: statusToValue[serverHealth.status],
      status: serverStatusToMetricStatus(serverHealth.status),
      description: `Server is ${serverHealth.status}. Uptime: ${formatUptime(serverHealth.uptime)}. Version: ${serverHealth.version}.`,
      trend: 'stable',
      details: memoryCheckToDetails(serverHealth.checks.memory),
    };
  }, [serverHealth]);

  // The overall health score is based on the single real metric we have.
  // Code Quality, Security Score, Performance, and Maintainability have no API backing.
  const overallHealth = serverMetric ? serverMetric.value : null;

  return (
    <div className='space-y-6'>
      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            Project Health Score
            {fetchState === 'loading' && (
              <Badge variant='secondary'>Loading...</Badge>
            )}
            {fetchState === 'error' && (
              <Badge variant='destructive'>Unavailable</Badge>
            )}
            {fetchState === 'success' && overallHealth !== null && (
              <Badge
                variant={
                  overallHealth >= 90
                    ? 'default'
                    : overallHealth >= 80
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {overallHealth}/100
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Comprehensive health assessment of your project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchState === 'loading' && (
            <Progress value={0} className='h-3 animate-pulse' />
          )}
          {fetchState === 'error' && (
            <p className='text-sm text-destructive'>{fetchError}</p>
          )}
          {fetchState === 'success' && overallHealth !== null && (
            <Progress value={overallHealth} className='h-3' />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue='metrics' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='metrics'>Health Metrics</TabsTrigger>
          <TabsTrigger value='issues'>Issues & Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value='metrics' className='space-y-4'>
          {fetchState === 'loading' && (
            <div className='grid gap-4 md:grid-cols-2'>
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className='pb-4'>
                    <div className='h-5 w-32 bg-muted animate-pulse rounded' />
                    <div className='h-3 w-48 bg-muted animate-pulse rounded mt-2' />
                  </CardHeader>
                  <CardContent>
                    <div className='h-2 bg-muted animate-pulse rounded' />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {fetchState === 'error' && (
            <Card>
              <CardContent className='flex flex-col items-center justify-center py-10 space-y-3'>
                <ServerCrash className='h-8 w-8 text-destructive opacity-70' />
                <p className='text-sm font-medium'>Health data unavailable</p>
                <p className='text-xs text-muted-foreground'>{fetchError}</p>
              </CardContent>
            </Card>
          )}

          {fetchState === 'success' && (
            <div className='grid gap-4 md:grid-cols-2'>
              {serverMetric && <HealthMetricCard metric={serverMetric} />}
              <UnavailablePlaceholder label='Code Quality' />
              <UnavailablePlaceholder label='Security Score' />
              <UnavailablePlaceholder label='Performance' />
              <UnavailablePlaceholder label='Maintainability' />
            </div>
          )}
        </TabsContent>

        <TabsContent value='issues' className='space-y-4'>
          <Tabs defaultValue='all' className='space-y-4'>
            <TabsList>
              <TabsTrigger value='all'>All Issues (0)</TabsTrigger>
              <TabsTrigger value='security'>Security (0)</TabsTrigger>
              <TabsTrigger value='performance'>Performance (0)</TabsTrigger>
              <TabsTrigger value='quality'>Quality (0)</TabsTrigger>
              <TabsTrigger value='maintenance'>Maintenance (0)</TabsTrigger>
            </TabsList>

            <TabsContent value='all'>
              <ScrollArea className='h-[500px]'>
                <Card>
                  <CardContent className='flex flex-col items-center justify-center py-10 space-y-3'>
                    <ServerCrash className='h-8 w-8 text-muted-foreground opacity-50' />
                    <p className='text-sm text-muted-foreground'>
                      Health data unavailable
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      No issue tracking API is configured for this project.
                    </p>
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>

            {(
              ['security', 'performance', 'quality', 'maintenance'] as const
            ).map(type => (
              <TabsContent key={type} value={type}>
                <ScrollArea className='h-[500px]'>
                  <Card>
                    <CardContent className='flex flex-col items-center justify-center py-10 space-y-3'>
                      <ServerCrash className='h-8 w-8 text-muted-foreground opacity-50' />
                      <p className='text-sm text-muted-foreground capitalize'>
                        {type} data unavailable
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        No issue tracking API is configured for this project.
                      </p>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
