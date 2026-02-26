'use client';

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Clock,
  Coins,
  Minus,
  RefreshCw,
  Timer,
  Users,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
  totalMessages: number;
  messagesPerMinute: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  activeAgents: number;
  totalAgents: number;
  tokenUsage: { used: number; budget: number };
  uptime: number;
  escalationRate: number;
  fallbackRate: number;
}

export interface AgentMetric {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  messagesHandled: number;
  avgResponseMs: number;
  errorCount: number;
  lastActive: string;
  utilization: number;
}

export interface PerformanceMonitoringDashboardProps {
  workspaceId: string;
  refreshInterval?: number;
  className?: string;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

type TimeRange = '1h' | '6h' | '24h' | '7d';

interface RawMetricsResponse {
  totalMessagesRouted?: number;
  averageRoutingLatencyMs?: number;
  messagesPerMinute?: number;
  escalationRate?: number;
  fallbackRate?: number;
  routingMethodDistribution?: Record<string, number>;
  agentUtilization?: Record<string, number>;
  recentDecisions?: unknown[];
  p95LatencyMs?: number;
  errorRate?: number;
  tokenUsage?: { used: number; budget: number };
  uptime?: number;
}

interface RawOrchestrator {
  id: string;
  name: string;
  status?: string;
  messagesHandled?: number;
  avgResponseMs?: number;
  errorCount?: number;
  lastActive?: string;
  utilization?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (secs < 60) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function latencyColor(ms: number): string {
  if (ms < 200) return 'text-green-600 dark:text-green-400';
  if (ms < 500) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function errorRateColor(rate: number): string {
  if (rate < 0.01) return 'text-green-600 dark:text-green-400';
  if (rate < 0.05) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function utilizationColor(pct: number): string {
  if (pct < 70) return 'text-green-600 dark:text-green-400';
  if (pct < 90) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function agentStatusVariant(
  status: AgentMetric['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'error') return 'destructive';
  return 'secondary';
}

function progressColor(value: number): string {
  if (value < 70) return 'bg-green-500';
  if (value < 90) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TrendIndicatorProps {
  value: number;
  goodDirection: 'up' | 'down';
  className?: string;
}

function TrendIndicator({ value, goodDirection, className }: TrendIndicatorProps) {
  if (value === 0) {
    return <Minus className={cn('h-3 w-3 text-muted-foreground', className)} />;
  }
  const isPositive = value > 0;
  const isGood = goodDirection === 'up' ? isPositive : !isPositive;
  return isPositive ? (
    <ArrowUp
      className={cn('h-3 w-3', isGood ? 'text-green-500' : 'text-red-500', className)}
    />
  ) : (
    <ArrowDown
      className={cn('h-3 w-3', isGood ? 'text-green-500' : 'text-red-500', className)}
    />
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  valueClassName?: string;
  trend?: number;
  goodDirection?: 'up' | 'down';
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  valueClassName,
  trend,
  goodDirection = 'up',
}: StatCardProps) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-2 text-muted-foreground'>{icon}</div>
          {trend !== undefined && (
            <TrendIndicator value={trend} goodDirection={goodDirection} />
          )}
        </div>
        <div className='mt-2'>
          <p className='text-xs font-sans text-muted-foreground'>{label}</p>
          <p className={cn('text-2xl font-heading font-semibold text-foreground', valueClassName)}>
            {value}
          </p>
          <p className='mt-0.5 text-xs font-sans text-muted-foreground'>{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton helpers
function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <Skeleton className='h-4 w-4 rounded' />
        <div className='mt-2 space-y-1.5'>
          <Skeleton className='h-3 w-20' />
          <Skeleton className='h-7 w-16' />
          <Skeleton className='h-3 w-24' />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTabSkeleton() {
  return (
    <div className='space-y-4'>
      {[0, 1, 2].map(i => (
        <div key={i} className='space-y-2'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-2 w-full rounded-full' />
          <Skeleton className='h-3 w-16' />
        </div>
      ))}
    </div>
  );
}

function AgentsTabSkeleton() {
  return (
    <div className='space-y-2'>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className='flex items-center gap-4'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-5 w-14 rounded-full' />
          <Skeleton className='h-4 w-12' />
          <Skeleton className='h-4 w-16' />
          <Skeleton className='h-2 flex-1 rounded-full' />
        </div>
      ))}
    </div>
  );
}

function RoutingTabSkeleton() {
  return (
    <div className='space-y-3'>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className='space-y-1'>
          <div className='flex justify-between'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-3 w-10' />
          </div>
          <Skeleton className='h-2 w-full rounded-full' />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PerformanceMonitoringDashboard({
  workspaceId,
  refreshInterval = 15_000,
  className,
}: PerformanceMonitoringDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetric[]>([]);
  const [routingDistribution, setRoutingDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [countdown, setCountdown] = useState(refreshInterval / 1000);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setRefreshing(true);
      }
      setError(null);

      try {
        const [metricsRes, orchestratorsRes] = await Promise.all([
          fetch(
            `/api/traffic-manager/metrics?workspaceId=${workspaceId}&timeRange=${timeRange}`
          ),
          fetch(
            `/api/workspaces/${workspaceId}/admin/orchestrators?limit=100`
          ),
        ]);

        if (metricsRes.ok) {
          const raw: RawMetricsResponse = await metricsRes.json();
          setMetrics({
            totalMessages: raw.totalMessagesRouted ?? 0,
            messagesPerMinute: raw.messagesPerMinute ?? 0,
            avgLatencyMs: raw.averageRoutingLatencyMs ?? 0,
            p95LatencyMs: raw.p95LatencyMs ?? 0,
            errorRate: raw.errorRate ?? 0,
            activeAgents: 0, // will be computed from orchestrators
            totalAgents: 0,
            tokenUsage: raw.tokenUsage ?? { used: 0, budget: 0 },
            uptime: raw.uptime ?? 0,
            escalationRate: raw.escalationRate ?? 0,
            fallbackRate: raw.fallbackRate ?? 0,
          });
          setRoutingDistribution(raw.routingMethodDistribution ?? {});
        }

        if (orchestratorsRes.ok) {
          const orchData = await orchestratorsRes.json();
          const rawList: RawOrchestrator[] = orchData.orchestrators ?? orchData.data ?? [];
          const agents: AgentMetric[] = rawList.map(o => ({
            id: o.id,
            name: o.name,
            status:
              o.status === 'ACTIVE'
                ? 'active'
                : o.status === 'ERROR'
                  ? 'error'
                  : 'idle',
            messagesHandled: o.messagesHandled ?? 0,
            avgResponseMs: o.avgResponseMs ?? 0,
            errorCount: o.errorCount ?? 0,
            lastActive: o.lastActive ?? new Date().toISOString(),
            utilization: o.utilization ?? 0,
          }));
          setAgentMetrics(agents);

          // Back-fill activeAgents / totalAgents into metrics
          setMetrics(prev =>
            prev
              ? {
                  ...prev,
                  activeAgents: agents.filter(a => a.status === 'active').length,
                  totalAgents: agents.length,
                }
              : prev
          );
        }
      } catch (err) {
        console.error('[PerformanceMonitoringDashboard] fetch error:', err);
        setError('Failed to load metrics. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setCountdown(refreshInterval / 1000);
      }
    },
    [workspaceId, timeRange, refreshInterval]
  );

  // Initial fetch and auto-refresh
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData(), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? refreshInterval / 1000 : prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshInterval]);

  // Derived values
  const avgUtilization =
    agentMetrics.length > 0
      ? agentMetrics.reduce((sum, a) => sum + a.utilization, 0) / agentMetrics.length
      : 0;

  const tokenPct =
    metrics && metrics.tokenUsage.budget > 0
      ? (metrics.tokenUsage.used / metrics.tokenUsage.budget) * 100
      : 0;

  const totalRoutingMessages = Object.values(routingDistribution).reduce(
    (sum, v) => sum + v,
    0
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='font-heading text-xl font-semibold text-foreground'>
            Performance Monitoring
          </h2>
          <p className='text-sm font-sans text-muted-foreground'>
            Real-time orchestrator and daemon metrics
          </p>
        </div>

        <div className='flex items-center gap-2'>
          {/* Time range */}
          <Select value={timeRange} onValueChange={v => setTimeRange(v as TimeRange)}>
            <SelectTrigger className='w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1h'>Last 1h</SelectItem>
              <SelectItem value='6h'>Last 6h</SelectItem>
              <SelectItem value='24h'>Last 24h</SelectItem>
              <SelectItem value='7d'>Last 7d</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh button */}
          <Button
            variant='outline'
            size='sm'
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className='gap-1.5'
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
            />
            <span className='text-xs tabular-nums'>
              {refreshing ? 'Refreshing' : `${countdown}s`}
            </span>
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className='rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3'>
          <p className='text-sm font-sans text-destructive'>{error}</p>
        </div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6'>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            {/* Messages / min */}
            <StatCard
              icon={<Activity className='h-4 w-4' />}
              label='Messages / min'
              value={metrics ? String(metrics.messagesPerMinute) : '—'}
              subtitle={`${formatNumber(metrics?.totalMessages ?? 0)} total`}
              goodDirection='up'
            />

            {/* Avg Latency */}
            <StatCard
              icon={<Clock className='h-4 w-4' />}
              label='Avg Latency'
              value={metrics ? `${metrics.avgLatencyMs}ms` : '—'}
              subtitle={
                metrics ? `p95: ${metrics.p95LatencyMs}ms` : 'No data'
              }
              valueClassName={metrics ? latencyColor(metrics.avgLatencyMs) : undefined}
              goodDirection='down'
            />

            {/* Error Rate */}
            <StatCard
              icon={<AlertTriangle className='h-4 w-4' />}
              label='Error Rate'
              value={metrics ? formatPercent(metrics.errorRate) : '—'}
              subtitle={
                metrics
                  ? metrics.errorRate < 0.01
                    ? 'Healthy'
                    : metrics.errorRate < 0.05
                      ? 'Warning'
                      : 'Critical'
                  : 'No data'
              }
              valueClassName={metrics ? errorRateColor(metrics.errorRate) : undefined}
              goodDirection='down'
            />

            {/* Active Agents */}
            <StatCard
              icon={<Users className='h-4 w-4' />}
              label='Active Agents'
              value={metrics ? String(metrics.activeAgents) : '—'}
              subtitle={`of ${metrics?.totalAgents ?? 0} total`}
              goodDirection='up'
            />

            {/* Token Usage */}
            <StatCard
              icon={<Coins className='h-4 w-4' />}
              label='Token Usage'
              value={
                metrics
                  ? `${Math.round(tokenPct)}%`
                  : '—'
              }
              subtitle={
                metrics
                  ? `${formatNumber(metrics.tokenUsage.used)} / ${formatNumber(metrics.tokenUsage.budget)}`
                  : 'No data'
              }
              valueClassName={
                metrics ? utilizationColor(tokenPct) : undefined
              }
              goodDirection='down'
            />

            {/* Uptime */}
            <StatCard
              icon={<Timer className='h-4 w-4' />}
              label='Uptime'
              value={metrics ? formatUptime(metrics.uptime) : '—'}
              subtitle='Since last restart'
              goodDirection='up'
            />
          </>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full grid-cols-4 sm:w-auto sm:inline-flex'>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='agents'>Agents</TabsTrigger>
          <TabsTrigger value='routing'>Routing</TabsTrigger>
          <TabsTrigger value='tokens'>Tokens</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ───────────────────────────────────────────────────── */}
        <TabsContent value='overview' className='mt-4'>
          {loading ? (
            <Card>
              <CardContent className='p-5'>
                <OverviewTabSkeleton />
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {/* Escalation Rate */}
              <Card>
                <CardHeader className='pb-2 pt-4 px-5'>
                  <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                    Escalation Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-5 pb-5 pt-0 space-y-2'>
                  <div className='flex items-end justify-between'>
                    <span
                      className={cn(
                        'text-2xl font-heading font-semibold',
                        metrics ? errorRateColor(metrics.escalationRate) : 'text-foreground'
                      )}
                    >
                      {metrics ? formatPercent(metrics.escalationRate) : '—'}
                    </span>
                    <span className='text-xs font-sans text-muted-foreground pb-0.5'>
                      of all messages
                    </span>
                  </div>
                  <div className='relative h-2 w-full overflow-hidden rounded-full bg-secondary'>
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progressColor((metrics?.escalationRate ?? 0) * 100)
                      )}
                      style={{
                        width: `${Math.min((metrics?.escalationRate ?? 0) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className='text-xs font-sans text-muted-foreground'>
                    {(metrics?.escalationRate ?? 0) < 0.05
                      ? 'Within normal range'
                      : 'Above recommended threshold'}
                  </p>
                </CardContent>
              </Card>

              {/* Fallback Rate */}
              <Card>
                <CardHeader className='pb-2 pt-4 px-5'>
                  <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                    Fallback Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-5 pb-5 pt-0 space-y-2'>
                  <div className='flex items-end justify-between'>
                    <span
                      className={cn(
                        'text-2xl font-heading font-semibold',
                        metrics ? errorRateColor(metrics.fallbackRate) : 'text-foreground'
                      )}
                    >
                      {metrics ? formatPercent(metrics.fallbackRate) : '—'}
                    </span>
                    <span className='text-xs font-sans text-muted-foreground pb-0.5'>
                      of all routes
                    </span>
                  </div>
                  <div className='relative h-2 w-full overflow-hidden rounded-full bg-secondary'>
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        progressColor((metrics?.fallbackRate ?? 0) * 100)
                      )}
                      style={{
                        width: `${Math.min((metrics?.fallbackRate ?? 0) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <p className='text-xs font-sans text-muted-foreground'>
                    {(metrics?.fallbackRate ?? 0) < 0.1
                      ? 'Routing is stable'
                      : 'High fallback detected'}
                  </p>
                </CardContent>
              </Card>

              {/* Agent Utilization */}
              <Card>
                <CardHeader className='pb-2 pt-4 px-5'>
                  <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                    Agent Utilization
                  </CardTitle>
                </CardHeader>
                <CardContent className='px-5 pb-5 pt-0 space-y-2'>
                  <div className='flex items-end justify-between'>
                    <span
                      className={cn(
                        'text-2xl font-heading font-semibold',
                        utilizationColor(avgUtilization)
                      )}
                    >
                      {agentMetrics.length > 0 ? `${Math.round(avgUtilization)}%` : '—'}
                    </span>
                    <span className='text-xs font-sans text-muted-foreground pb-0.5'>
                      average
                    </span>
                  </div>
                  <Progress
                    value={avgUtilization}
                    className={cn(
                      'h-2',
                      avgUtilization < 70
                        ? '[&>div]:bg-green-500'
                        : avgUtilization < 90
                          ? '[&>div]:bg-yellow-500'
                          : '[&>div]:bg-red-500'
                    )}
                  />
                  <p className='text-xs font-sans text-muted-foreground'>
                    {agentMetrics.length > 0
                      ? `${agentMetrics.filter(a => a.status === 'active').length} active / ${agentMetrics.length} total agents`
                      : 'No agents found'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Agents Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value='agents' className='mt-4'>
          <Card>
            <CardHeader className='pb-3 pt-4 px-5'>
              <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                Agent Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className='px-0 pb-0 pt-0'>
              {loading ? (
                <div className='px-5 pb-5'>
                  <AgentsTabSkeleton />
                </div>
              ) : agentMetrics.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-center'>
                  <Users className='h-10 w-10 text-muted-foreground/40 mb-3' />
                  <p className='text-sm font-sans font-medium text-muted-foreground'>
                    No agents found
                  </p>
                  <p className='text-xs font-sans text-muted-foreground mt-1'>
                    Agents will appear here once they are active in this workspace
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='pl-5'>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-right'>Messages</TableHead>
                      <TableHead className='text-right'>Avg Response</TableHead>
                      <TableHead className='text-right'>Errors</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Last Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentMetrics.map(agent => (
                      <TableRow key={agent.id}>
                        <TableCell className='pl-5 font-sans font-medium text-foreground'>
                          {agent.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={agentStatusVariant(agent.status)}
                            className={cn(
                              'capitalize text-xs',
                              agent.status === 'active' &&
                                'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                            )}
                          >
                            {agent.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right font-sans tabular-nums text-sm text-foreground'>
                          {formatNumber(agent.messagesHandled)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-sans tabular-nums text-sm',
                            latencyColor(agent.avgResponseMs)
                          )}
                        >
                          {agent.avgResponseMs}ms
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-sans tabular-nums text-sm',
                            agent.errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                          )}
                        >
                          {agent.errorCount}
                        </TableCell>
                        <TableCell className='min-w-[120px]'>
                          <div className='flex items-center gap-2'>
                            <div className='flex-1'>
                              <div className='relative h-1.5 w-full overflow-hidden rounded-full bg-secondary'>
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    progressColor(agent.utilization)
                                  )}
                                  style={{
                                    width: `${Math.min(agent.utilization, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <span
                              className={cn(
                                'text-xs font-sans tabular-nums w-9 text-right',
                                utilizationColor(agent.utilization)
                              )}
                            >
                              {Math.round(agent.utilization)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='text-xs font-sans text-muted-foreground'>
                          {formatRelativeTime(agent.lastActive)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Routing Tab ────────────────────────────────────────────────────── */}
        <TabsContent value='routing' className='mt-4'>
          <Card>
            <CardHeader className='pb-3 pt-4 px-5'>
              <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                Routing Method Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className='px-5 pb-5 pt-0'>
              {loading ? (
                <RoutingTabSkeleton />
              ) : Object.keys(routingDistribution).length === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-center'>
                  <Activity className='h-10 w-10 text-muted-foreground/40 mb-3' />
                  <p className='text-sm font-sans font-medium text-muted-foreground'>
                    No routing data available
                  </p>
                  <p className='text-xs font-sans text-muted-foreground mt-1'>
                    Routing distribution will appear once messages are processed
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {Object.entries(routingDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([method, count]) => {
                      const pct =
                        totalRoutingMessages > 0
                          ? (count / totalRoutingMessages) * 100
                          : 0;
                      return (
                        <div key={method} className='space-y-1'>
                          <div className='flex items-center justify-between'>
                            <span className='text-sm font-sans font-medium capitalize text-foreground'>
                              {method.replace(/_/g, ' ').toLowerCase()}
                            </span>
                            <div className='flex items-center gap-2'>
                              <span className='text-xs font-sans tabular-nums text-muted-foreground'>
                                {formatNumber(count)}
                              </span>
                              <span className='text-xs font-sans tabular-nums text-foreground w-12 text-right'>
                                {pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className='relative h-2 w-full overflow-hidden rounded-full bg-secondary'>
                            <div
                              className='h-full rounded-full bg-primary transition-all'
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tokens Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value='tokens' className='mt-4'>
          <Card>
            <CardHeader className='pb-3 pt-4 px-5'>
              <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                Token Budget
              </CardTitle>
            </CardHeader>
            <CardContent className='px-5 pb-5 pt-0'>
              {loading ? (
                <div className='space-y-4'>
                  <Skeleton className='h-4 w-48' />
                  <Skeleton className='h-4 w-full rounded-full' />
                  <div className='flex justify-between'>
                    <Skeleton className='h-3 w-20' />
                    <Skeleton className='h-3 w-20' />
                  </div>
                  <Skeleton className='h-16 w-full rounded-md' />
                </div>
              ) : !metrics || metrics.tokenUsage.budget === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-center'>
                  <Coins className='h-10 w-10 text-muted-foreground/40 mb-3' />
                  <p className='text-sm font-sans font-medium text-muted-foreground'>
                    No token budget configured
                  </p>
                  <p className='text-xs font-sans text-muted-foreground mt-1'>
                    Token usage will appear here once a budget is set
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  <div className='flex items-end justify-between'>
                    <div>
                      <p className='text-xs font-sans text-muted-foreground'>Used</p>
                      <p
                        className={cn(
                          'text-3xl font-heading font-semibold',
                          utilizationColor(tokenPct)
                        )}
                      >
                        {formatNumber(metrics.tokenUsage.used)}
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='text-xs font-sans text-muted-foreground'>Budget</p>
                      <p className='text-lg font-heading font-semibold text-foreground'>
                        {formatNumber(metrics.tokenUsage.budget)}
                      </p>
                    </div>
                  </div>

                  <Progress
                    value={tokenPct}
                    className={cn(
                      'h-3',
                      tokenPct < 70
                        ? '[&>div]:bg-green-500'
                        : tokenPct < 90
                          ? '[&>div]:bg-yellow-500'
                          : '[&>div]:bg-red-500'
                    )}
                  />

                  <div className='flex items-center justify-between text-xs font-sans text-muted-foreground'>
                    <span>{Math.round(tokenPct)}% consumed</span>
                    <span>
                      {formatNumber(
                        Math.max(0, metrics.tokenUsage.budget - metrics.tokenUsage.used)
                      )}{' '}
                      remaining
                    </span>
                  </div>

                  <div
                    className={cn(
                      'rounded-md border px-4 py-3',
                      tokenPct < 70
                        ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                        : tokenPct < 90
                          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
                          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                    )}
                  >
                    <p
                      className={cn(
                        'text-sm font-sans font-medium',
                        tokenPct < 70
                          ? 'text-green-700 dark:text-green-400'
                          : tokenPct < 90
                            ? 'text-yellow-700 dark:text-yellow-400'
                            : 'text-red-700 dark:text-red-400'
                      )}
                    >
                      {tokenPct < 70
                        ? 'Token budget is healthy'
                        : tokenPct < 90
                          ? 'Approaching token limit — consider expanding budget'
                          : 'Critical: token budget nearly exhausted'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceMonitoringDashboard;
