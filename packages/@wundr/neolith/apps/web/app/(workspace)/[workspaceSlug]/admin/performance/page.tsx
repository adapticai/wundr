'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { PerformanceMonitoringDashboard } from '@/components/orchestrator/performance-monitoring-dashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { usePageHeader } from '@/contexts/page-header-context';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryStats {
  totalRequests: number;
  avgLatencyMs: number;
  errorRate: number;
  activeAgents: number;
  totalAgents: number;
}

interface AgentLoad {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline' | 'maintenance';
  currentLoad: number;
}

interface RoutingDecision {
  id: string;
  timestamp: string;
  agentName: string;
  confidence: number | null;
  matchedBy: string;
  escalated: boolean;
}

type RefreshInterval = '10' | '30' | '60' | '300';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtMs = (ms: number) => (ms === 0 ? '—' : `${Math.round(ms)}ms`);
const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`;
const fmtRelative = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
};

const loadBar = (load: number) =>
  load < 0.5 ? 'bg-green-500' : load < 0.8 ? 'bg-yellow-500' : 'bg-red-500';
const errorClass = (r: number) =>
  r < 0.01
    ? 'text-green-600 dark:text-green-400'
    : r < 0.05
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';
const latencyClass = (ms: number) =>
  ms < 200
    ? 'text-green-600 dark:text-green-400'
    : ms < 500
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';
const statusDot = (s: AgentLoad['status']) =>
  s === 'available'
    ? 'bg-green-500'
    : s === 'busy'
      ? 'bg-yellow-500'
      : s === 'maintenance'
        ? 'bg-blue-500'
        : 'bg-muted-foreground/40';

function StatCard({
  icon,
  label,
  value,
  sub,
  cls,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  cls?: string;
}) {
  return (
    <Card>
      <CardContent className='p-4'>
        <div className='flex items-center gap-2 text-muted-foreground mb-2'>
          {icon}
        </div>
        <p className='text-xs font-sans text-muted-foreground'>{label}</p>
        <p className={cn('text-2xl font-heading font-semibold', cls)}>
          {value}
        </p>
        <p className='text-xs font-sans text-muted-foreground mt-0.5'>{sub}</p>
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className='p-4'>
        <Skeleton className='h-4 w-4 mb-2' />
        <Skeleton className='h-3 w-20 mb-1' />
        <Skeleton className='h-7 w-16 mb-1' />
        <Skeleton className='h-3 w-24' />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerformancePage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [wsLoading, setWsLoading] = useState(true);

  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [agentLoads, setAgentLoads] = useState<AgentLoad[]>([]);
  const [decisions, setDecisions] = useState<RoutingDecision[]>([]);
  const [aggLoading, setAggLoading] = useState(false);
  const [aggError, setAggError] = useState<string | null>(null);

  const [interval, setInterval_] = useState<RefreshInterval>('30');
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    setPageHeader(
      'Performance Monitoring',
      'Real-time metrics and performance data for orchestrators and the daemon'
    );
  }, [setPageHeader]);

  useEffect(() => {
    async function loadWorkspace() {
      setWsLoading(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceSlug}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspaceId(data.workspace?.id ?? data.id ?? null);
        }
      } finally {
        setWsLoading(false);
      }
    }
    void loadWorkspace();
  }, [workspaceSlug]);

  const fetchAgg = useCallback(
    async (manual = false) => {
      if (!workspaceId) return;
      if (manual) setRefreshing(true);
      setAggError(null);
      try {
        const [mRes, aRes] = await Promise.all([
          fetch(
            `/api/traffic-manager/metrics?workspaceId=${workspaceId}&timeRange=1h`
          ),
          fetch('/api/traffic-manager/agents'),
        ]);

        if (mRes.ok) {
          const json = await mRes.json();
          const raw = json.data ?? json;
          setSummary(prev => ({
            totalRequests: raw.totalMessagesRouted ?? 0,
            avgLatencyMs: raw.averageRoutingLatencyMs ?? 0,
            errorRate: raw.errorRate ?? 0,
            activeAgents: prev?.activeAgents ?? 0,
            totalAgents: prev?.totalAgents ?? 0,
          }));
          setDecisions((raw.recentDecisions ?? []).slice(0, 10));
        }

        if (aRes.ok) {
          const json = await aRes.json();
          const list: AgentLoad[] = (json.data ?? []).map((a: AgentLoad) => ({
            id: a.id,
            name: a.name,
            status: a.status,
            currentLoad: a.currentLoad,
          }));
          setAgentLoads(list);
          setSummary(prev =>
            prev
              ? {
                  ...prev,
                  activeAgents: list.filter(
                    a => a.status === 'available' || a.status === 'busy'
                  ).length,
                  totalAgents: list.length,
                }
              : prev
          );
        }
      } catch {
        setAggError('Failed to load aggregation data. Please try again.');
      } finally {
        setAggLoading(false);
        setRefreshing(false);
        setCountdown(Number(interval));
      }
    },
    [workspaceId, interval]
  );

  useEffect(() => {
    if (!workspaceId) return;
    setAggLoading(true);
    void fetchAgg();
    const ms = Number(interval) * 1000;
    const timer = window.setInterval(() => void fetchAgg(), ms);
    return () => window.clearInterval(timer);
  }, [workspaceId, fetchAgg, interval]);

  useEffect(() => {
    const secs = Number(interval);
    setCountdown(secs);
    const tick = window.setInterval(
      () => setCountdown(p => (p <= 1 ? secs : p - 1)),
      1000
    );
    return () => window.clearInterval(tick);
  }, [interval]);

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (wsLoading) {
    return (
      <div className='space-y-6'>
        <div className='grid gap-3 grid-cols-2 sm:grid-cols-4'>
          {[0, 1, 2, 3].map(i => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <CardContent className='py-8'>
            <Skeleton className='h-64 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (!workspaceId) {
    return (
      <Card>
        <CardContent className='py-12 text-center'>
          <AlertTriangle className='h-10 w-10 text-muted-foreground/40 mx-auto mb-3' />
          <p className='text-sm font-sans font-medium text-muted-foreground'>
            Workspace not found
          </p>
          <p className='text-xs font-sans text-muted-foreground mt-1'>
            Unable to load performance data for this workspace.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedAgents = [...agentLoads].sort(
    (a, b) => b.currentLoad - a.currentLoad
  );

  return (
    <div className='space-y-6'>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <BarChart3 className='h-5 w-5 text-muted-foreground' />
          <h2 className='text-base font-semibold'>System Performance</h2>
        </div>
        <div className='flex items-center gap-2'>
          <Select
            value={interval}
            onValueChange={v => setInterval_(v as RefreshInterval)}
          >
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='10'>Refresh: 10s</SelectItem>
              <SelectItem value='30'>Refresh: 30s</SelectItem>
              <SelectItem value='60'>Refresh: 1m</SelectItem>
              <SelectItem value='300'>Refresh: 5m</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void fetchAgg(true)}
            disabled={refreshing || aggLoading}
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

      {/* ── Summary Stat Cards ──────────────────────────────────────────────── */}
      <div className='grid gap-3 grid-cols-2 sm:grid-cols-4'>
        {aggLoading && !summary ? (
          [0, 1, 2, 3].map(i => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={<Activity className='h-4 w-4' />}
              label='Total Requests'
              value={summary ? summary.totalRequests.toLocaleString() : '—'}
              sub='Last hour'
            />
            <StatCard
              icon={<Clock className='h-4 w-4' />}
              label='Avg Latency'
              value={summary ? fmtMs(summary.avgLatencyMs) : '—'}
              sub='Routing latency'
              cls={summary ? latencyClass(summary.avgLatencyMs) : undefined}
            />
            <StatCard
              icon={<AlertTriangle className='h-4 w-4' />}
              label='Error Rate'
              value={summary ? fmtPct(summary.errorRate) : '—'}
              sub={
                summary
                  ? summary.errorRate < 0.01
                    ? 'Healthy'
                    : summary.errorRate < 0.05
                      ? 'Warning'
                      : 'Critical'
                  : 'No data'
              }
              cls={summary ? errorClass(summary.errorRate) : undefined}
            />
            <StatCard
              icon={<Users className='h-4 w-4' />}
              label='Active Agents'
              value={summary ? String(summary.activeAgents) : '—'}
              sub={`of ${summary?.totalAgents ?? 0} total`}
            />
          </>
        )}
      </div>

      {/* ── PerformanceMonitoringDashboard ──────────────────────────────────── */}
      <PerformanceMonitoringDashboard workspaceId={workspaceId} />

      {aggError && (
        <div className='rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3'>
          <p className='text-sm font-sans text-destructive'>{aggError}</p>
        </div>
      )}

      {/* ── Workspace Aggregation ───────────────────────────────────────────── */}
      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Agent Utilization */}
        <Card>
          <CardHeader className='pb-3 pt-4 px-5'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                Agent Utilization
              </CardTitle>
              {!aggLoading && agentLoads.length > 0 && (
                <Badge variant='secondary' className='text-xs'>
                  {agentLoads.length} agents
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className='px-5 pb-5 pt-0'>
            {aggLoading && agentLoads.length === 0 ? (
              <div className='space-y-3'>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className='flex items-center gap-3'>
                    <Skeleton className='h-3 w-28 shrink-0' />
                    <Skeleton className='h-2 flex-1 rounded-full' />
                    <Skeleton className='h-3 w-8' />
                  </div>
                ))}
              </div>
            ) : agentLoads.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Users className='h-8 w-8 text-muted-foreground/40 mb-2' />
                <p className='text-sm font-sans text-muted-foreground'>
                  No agents available
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {sortedAgents.slice(0, 8).map(agent => (
                  <div key={agent.id} className='flex items-center gap-3'>
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        statusDot(agent.status)
                      )}
                    />
                    <span
                      className='text-xs font-sans text-foreground truncate shrink-0 w-28'
                      title={agent.name}
                    >
                      {agent.name}
                    </span>
                    <div className='flex-1 relative h-2 overflow-hidden rounded-full bg-secondary'>
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          loadBar(agent.currentLoad)
                        )}
                        style={{
                          width: `${Math.min(agent.currentLoad * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className='text-xs font-sans tabular-nums text-muted-foreground w-9 text-right shrink-0'>
                      {Math.round(agent.currentLoad * 100)}%
                    </span>
                  </div>
                ))}
                {sortedAgents.length > 8 && (
                  <p className='text-xs font-sans text-muted-foreground text-center pt-1'>
                    +{sortedAgents.length - 8} more agents
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Routing Decisions */}
        <Card>
          <CardHeader className='pb-3 pt-4 px-5'>
            <div className='flex items-center justify-between'>
              <CardTitle className='text-sm font-heading font-semibold text-foreground'>
                Recent Routing Decisions
              </CardTitle>
              {!aggLoading && decisions.length > 0 && (
                <Badge variant='secondary' className='text-xs'>
                  Last {decisions.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className='px-0 pb-0 pt-0'>
            {aggLoading && decisions.length === 0 ? (
              <div className='px-5 pb-5 space-y-2'>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className='flex gap-4'>
                    <Skeleton className='h-4 w-24' />
                    <Skeleton className='h-4 w-28' />
                    <Skeleton className='h-4 w-16' />
                    <Skeleton className='h-5 w-14 rounded-full' />
                  </div>
                ))}
              </div>
            ) : decisions.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-8 text-center'>
                <Activity className='h-8 w-8 text-muted-foreground/40 mb-2' />
                <p className='text-sm font-sans text-muted-foreground'>
                  No routing decisions yet
                </p>
                <p className='text-xs font-sans text-muted-foreground mt-1'>
                  Data appears once messages are routed
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='pl-5'>Agent</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className='text-right'>Conf.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className='pr-5'>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisions.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className='pl-5 font-sans text-sm font-medium text-foreground'>
                        {d.agentName}
                      </TableCell>
                      <TableCell className='text-xs font-sans text-muted-foreground capitalize'>
                        {d.matchedBy.replace(/_/g, ' ').toLowerCase()}
                      </TableCell>
                      <TableCell className='text-right font-sans tabular-nums text-sm text-foreground'>
                        {d.confidence != null
                          ? `${Math.round(d.confidence * 100)}%`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {d.escalated ? (
                          <Badge
                            variant='outline'
                            className='text-xs text-yellow-700 border-yellow-300 bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:bg-yellow-950/30'
                          >
                            Escalated
                          </Badge>
                        ) : (
                          <Badge
                            variant='secondary'
                            className='text-xs text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                          >
                            <CheckCircle2 className='h-3 w-3 mr-1' />
                            Routed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='pr-5 text-xs font-sans text-muted-foreground'>
                        {fmtRelative(d.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
