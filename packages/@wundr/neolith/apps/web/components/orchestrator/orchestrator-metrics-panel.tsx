'use client';

/**
 * OrchestratorMetricsPanel Component
 *
 * Recharts-based metrics visualization panel for a single orchestrator.
 * Shows token usage bar chart, session activity timeline, and task completion pie chart.
 *
 * @module components/orchestrator/orchestrator-metrics-panel
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestratorLiveMetrics {
  activeSessions: number;
  tasksCompletedToday: number;
  tokenUsage: { used: number; budget: number };
  avgResponseMs: number;
  sessionActivity: Array<{ hour: string; sessions: number }>;
  taskStatusBreakdown: Array<{ name: string; value: number; color: string }>;
  recentTasks: Array<{
    id: string;
    title: string;
    status: 'completed' | 'in_progress' | 'failed' | 'cancelled';
    durationMs: number | null;
    completedAt: string | null;
  }>;
}

export interface OrchestratorMetricsPanelProps {
  orchestratorId: string;
  workspaceSlug: string;
  /** Auto-refresh interval in ms (default 60s, 0 to disable) */
  refreshInterval?: number;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function utilizationColor(pct: number): string {
  if (pct < 70) return 'text-green-600 dark:text-green-400';
  if (pct < 90) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function progressIndicatorClass(pct: number): string {
  if (pct < 70) return '[&>div]:bg-green-500';
  if (pct < 90) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-red-500';
}

function taskStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className='h-3.5 w-3.5 text-green-500' />;
    case 'in_progress':
      return <Activity className='h-3.5 w-3.5 text-blue-500 animate-pulse' />;
    case 'failed':
      return <AlertTriangle className='h-3.5 w-3.5 text-red-500' />;
    default:
      return <Clock className='h-3.5 w-3.5 text-muted-foreground' />;
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-center gap-2 text-muted-foreground mb-2'>
        {icon}
        <span className='text-xs font-sans'>{label}</span>
      </div>
      <p
        className={cn(
          'text-2xl font-heading font-semibold',
          valueClass ?? 'text-foreground'
        )}
      >
        {value}
      </p>
      {sub && (
        <p className='text-xs font-sans text-muted-foreground mt-0.5'>{sub}</p>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MetricsPanelSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className='rounded-lg border bg-card p-4 space-y-2'>
            <Skeleton className='h-3 w-20' />
            <Skeleton className='h-7 w-14' />
            <Skeleton className='h-3 w-16' />
          </div>
        ))}
      </div>
      <div className='grid gap-4 md:grid-cols-2'>
        <Skeleton className='h-56 w-full rounded-lg' />
        <Skeleton className='h-56 w-full rounded-lg' />
      </div>
      <Skeleton className='h-48 w-full rounded-lg' />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OrchestratorMetricsPanel({
  orchestratorId,
  workspaceSlug,
  refreshInterval = 60_000,
  className,
}: OrchestratorMetricsPanelProps) {
  const [metrics, setMetrics] = useState<OrchestratorLiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(
    refreshInterval > 0 ? refreshInterval / 1000 : 0
  );

  const fetchMetrics = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/workspaces/${workspaceSlug}/orchestrators/${orchestratorId}/analytics?timeRange=24h`
        );

        if (res.ok) {
          const json = await res.json();
          const raw = json.data ?? json;

          // Map API response to our display shape; use safe defaults
          const mapped: OrchestratorLiveMetrics = {
            activeSessions:
              raw.metrics?.tasksInProgress ?? raw.activeSessions ?? 0,
            tasksCompletedToday:
              raw.metrics?.tasksCompleted ?? raw.tasksCompletedToday ?? 0,
            tokenUsage: raw.tokenUsage ?? { used: 0, budget: 0 },
            avgResponseMs: raw.performance?.avgDurationMinutes
              ? raw.performance.avgDurationMinutes * 60_000
              : (raw.avgResponseMs ?? 0),
            sessionActivity: raw.sessionActivity ?? [],
            taskStatusBreakdown: raw.taskStatusBreakdown ?? [
              {
                name: 'Completed',
                value: raw.metrics?.tasksCompleted ?? 0,
                color: '#22c55e',
              },
              {
                name: 'In Progress',
                value: raw.metrics?.tasksInProgress ?? 0,
                color: '#3b82f6',
              },
              {
                name: 'Failed',
                value: raw.metrics?.tasksFailed ?? 0,
                color: '#ef4444',
              },
              {
                name: 'Cancelled',
                value: raw.metrics?.tasksCancelled ?? 0,
                color: '#6b7280',
              },
            ],
            recentTasks: raw.recentTasks ?? [],
          };

          setMetrics(mapped);
        } else {
          setError('Failed to load metrics');
        }
      } catch {
        setError('Unable to reach metrics API');
      } finally {
        setLoading(false);
        setRefreshing(false);
        if (refreshInterval > 0) setCountdown(refreshInterval / 1000);
      }
    },
    [orchestratorId, workspaceSlug, refreshInterval]
  );

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = setInterval(() => fetchMetrics(), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  // Countdown ticker
  useEffect(() => {
    if (refreshInterval <= 0) return;
    const tick = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? refreshInterval / 1000 : prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshInterval]);

  if (loading) return <MetricsPanelSkeleton />;

  const tokenPct =
    metrics && metrics.tokenUsage.budget > 0
      ? (metrics.tokenUsage.used / metrics.tokenUsage.budget) * 100
      : 0;

  const tasksPieData = (metrics?.taskStatusBreakdown ?? []).filter(
    d => d.value > 0
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header row */}
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-heading font-semibold text-foreground'>
          Live Metrics
        </h3>
        <Button
          variant='outline'
          size='sm'
          onClick={() => fetchMetrics(true)}
          disabled={refreshing || loading}
          className='gap-1.5'
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
          />
          <span className='text-xs tabular-nums'>
            {refreshing
              ? 'Refreshing'
              : refreshInterval > 0
                ? `${countdown}s`
                : 'Refresh'}
          </span>
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className='rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2'>
          <p className='text-sm font-sans text-destructive'>{error}</p>
        </div>
      )}

      {/* Stat cells */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        <StatCell
          icon={<Users className='h-4 w-4' />}
          label='Active Sessions'
          value={String(metrics?.activeSessions ?? 0)}
          sub='running now'
        />
        <StatCell
          icon={<CheckCircle2 className='h-4 w-4' />}
          label='Tasks Today'
          value={String(metrics?.tasksCompletedToday ?? 0)}
          sub='completed'
        />
        <StatCell
          icon={<Coins className='h-4 w-4' />}
          label='Token Usage'
          value={
            metrics?.tokenUsage.budget && metrics.tokenUsage.budget > 0
              ? `${Math.round(tokenPct)}%`
              : formatNumber(metrics?.tokenUsage.used ?? 0)
          }
          sub={
            metrics?.tokenUsage.budget && metrics.tokenUsage.budget > 0
              ? `${formatNumber(metrics.tokenUsage.used)} / ${formatNumber(metrics.tokenUsage.budget)}`
              : 'tokens used'
          }
          valueClass={
            metrics?.tokenUsage.budget && metrics.tokenUsage.budget > 0
              ? utilizationColor(tokenPct)
              : undefined
          }
        />
        <StatCell
          icon={<Clock className='h-4 w-4' />}
          label='Avg Response'
          value={
            metrics?.avgResponseMs ? formatMs(metrics.avgResponseMs) : 'N/A'
          }
          sub='per task'
        />
      </div>

      {/* Token usage progress bar */}
      {metrics?.tokenUsage.budget && metrics.tokenUsage.budget > 0 ? (
        <Card>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-xs font-heading font-semibold text-foreground'>
              Token Budget
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4 pt-0 space-y-2'>
            <Progress
              value={tokenPct}
              className={cn('h-2', progressIndicatorClass(tokenPct))}
            />
            <div className='flex justify-between text-xs font-sans text-muted-foreground'>
              <span>{Math.round(tokenPct)}% consumed</span>
              <span>
                {formatNumber(
                  Math.max(
                    0,
                    metrics.tokenUsage.budget - metrics.tokenUsage.used
                  )
                )}{' '}
                remaining
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Charts */}
      <div className='grid gap-4 md:grid-cols-2'>
        {/* Session Activity Timeline */}
        <Card>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-xs font-heading font-semibold text-foreground'>
              Session Activity (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4 pt-0'>
            {metrics?.sessionActivity && metrics.sessionActivity.length > 0 ? (
              <ResponsiveContainer width='100%' height={180}>
                <BarChart
                  data={metrics.sessionActivity}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    strokeDasharray='3 3'
                    className='stroke-muted'
                  />
                  <XAxis
                    dataKey='hour'
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 6,
                      background: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar
                    dataKey='sessions'
                    fill='hsl(var(--primary))'
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className='flex flex-col items-center justify-center h-[180px] text-center'>
                <Activity className='h-8 w-8 text-muted-foreground/40 mb-2' />
                <p className='text-xs font-sans text-muted-foreground'>
                  No session activity data
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Completion Pie */}
        <Card>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-xs font-heading font-semibold text-foreground'>
              Task Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4 pt-0'>
            {tasksPieData.length > 0 ? (
              <div className='flex items-center gap-4'>
                <ResponsiveContainer width='60%' height={160}>
                  <PieChart>
                    <Pie
                      data={tasksPieData}
                      dataKey='value'
                      nameKey='name'
                      cx='50%'
                      cy='50%'
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {tasksPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        fontSize: 12,
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 6,
                        background: 'hsl(var(--popover))',
                        color: 'hsl(var(--popover-foreground))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className='flex-1 space-y-2'>
                  {tasksPieData.map(entry => (
                    <div key={entry.name} className='flex items-center gap-2'>
                      <span
                        className='inline-block h-2.5 w-2.5 rounded-full flex-shrink-0'
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className='text-xs font-sans text-foreground flex-1 truncate'>
                        {entry.name}
                      </span>
                      <span className='text-xs font-sans tabular-nums text-muted-foreground'>
                        {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center h-[160px] text-center'>
                <CheckCircle2 className='h-8 w-8 text-muted-foreground/40 mb-2' />
                <p className='text-xs font-sans text-muted-foreground'>
                  No task data for this period
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      {metrics?.recentTasks && metrics.recentTasks.length > 0 && (
        <Card>
          <CardHeader className='pb-2 pt-4 px-4'>
            <CardTitle className='text-xs font-heading font-semibold text-foreground'>
              Recent Task History
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-4 pt-0'>
            <div className='space-y-2'>
              {metrics.recentTasks.slice(0, 8).map(task => (
                <div
                  key={task.id}
                  className='flex items-center justify-between py-1.5 border-b border-border/50 last:border-0'
                >
                  <div className='flex items-center gap-2 min-w-0 flex-1'>
                    {taskStatusIcon(task.status)}
                    <span className='text-sm font-sans text-foreground truncate'>
                      {task.title}
                    </span>
                  </div>
                  <div className='flex items-center gap-3 ml-2 flex-shrink-0'>
                    {task.durationMs !== null && task.durationMs > 0 && (
                      <span className='text-xs font-sans tabular-nums text-muted-foreground'>
                        {formatMs(task.durationMs)}
                      </span>
                    )}
                    {task.completedAt && (
                      <span className='text-xs font-sans text-muted-foreground'>
                        {formatRelativeTime(task.completedAt)}
                      </span>
                    )}
                    <Badge
                      variant='outline'
                      className={cn(
                        'text-xs capitalize',
                        task.status === 'completed' &&
                          'border-green-200 text-green-700 dark:border-green-800 dark:text-green-400',
                        task.status === 'in_progress' &&
                          'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-400',
                        task.status === 'failed' &&
                          'border-red-200 text-red-700 dark:border-red-800 dark:text-red-400'
                      )}
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Supplementary: Token Usage Bar Chart (standalone) ────────────────────────

interface TokenUsageChartProps {
  orchestrators: Array<{
    id: string;
    title: string;
    tokenUsed: number;
    tokenBudget: number;
  }>;
  className?: string;
}

export function OrchestratorTokenUsageChart({
  orchestrators,
  className,
}: TokenUsageChartProps) {
  const data = orchestrators.map(o => ({
    name: o.title.length > 14 ? `${o.title.substring(0, 14)}…` : o.title,
    used: o.tokenUsed,
    remaining: Math.max(0, o.tokenBudget - o.tokenUsed),
    budget: o.tokenBudget,
  }));

  if (data.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className='pb-2 pt-4 px-4'>
        <CardTitle className='text-sm font-heading font-semibold text-foreground'>
          Token Usage by Orchestrator
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 pb-4 pt-0'>
        <ResponsiveContainer
          width='100%'
          height={Math.max(120, data.length * 36)}
        >
          <BarChart
            data={data}
            layout='vertical'
            margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
          >
            <CartesianGrid
              strokeDasharray='3 3'
              className='stroke-muted'
              horizontal={false}
            />
            <XAxis
              type='number'
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => formatNumber(v)}
            />
            <YAxis
              type='category'
              dataKey='name'
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <RechartsTooltip
              contentStyle={{
                fontSize: 12,
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                background: 'hsl(var(--popover))',
                color: 'hsl(var(--popover-foreground))',
              }}
              formatter={(value: number, name: string) => [
                formatNumber(value),
                name === 'used' ? 'Tokens Used' : 'Remaining',
              ]}
            />
            <Bar
              dataKey='used'
              stackId='a'
              fill='hsl(var(--primary))'
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey='remaining'
              stackId='a'
              fill='hsl(var(--muted))'
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default OrchestratorMetricsPanel;
