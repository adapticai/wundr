'use client';

import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Webhook,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { AgentCommLogViewer } from '@/components/orchestrator/agent-comm-log-viewer';
import { CommunicationPreferences } from '@/components/settings/communication-preferences';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommStats {
  totalMessages: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  deliveryRate: number;
}

interface CommLog {
  id: string;
  channel: string;
  status: string;
  subject?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_MS = 10_000;

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className='h-3.5 w-3.5' />,
  in_app: <MessageSquare className='h-3.5 w-3.5' />,
  webhook: <Webhook className='h-3.5 w-3.5' />,
  sms: <Send className='h-3.5 w-3.5' />,
  push: <Activity className='h-3.5 w-3.5' />,
};

const STATUS_CLS: Record<string, string> = {
  delivered: 'border-green-500 text-green-600',
  sent: 'border-blue-500 text-blue-600',
  pending: 'border-yellow-500 text-yellow-600',
  failed: 'border-destructive text-destructive',
  bounced: 'border-orange-500 text-orange-600',
};

const INBOUND_WEBHOOKS = [
  {
    provider: 'Twilio',
    path: '/api/webhooks/twilio',
    description: 'Receive inbound SMS and WhatsApp messages',
  },
  {
    provider: 'SendGrid',
    path: '/api/webhooks/sendgrid',
    description: 'Parse inbound emails from SendGrid',
  },
  {
    provider: 'Email (SES)',
    path: '/api/webhooks/email',
    description: 'AWS SES delivery and bounce notifications',
  },
];

// ---------------------------------------------------------------------------
// WebhookRow
// ---------------------------------------------------------------------------

function WebhookRow({
  provider,
  path,
  description,
}: {
  provider: string;
  path: string;
  description: string;
}) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      setResult(res.ok ? 'success' : 'error');
    } catch {
      setResult('error');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className='flex items-center justify-between rounded-lg border px-4 py-3'>
      <div className='flex items-start gap-3'>
        <Webhook className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
        <div>
          <div className='flex items-center gap-2'>
            <p className='text-sm font-medium'>{provider}</p>
            {result === 'success' && (
              <Badge
                variant='outline'
                className='border-green-500 text-green-600 text-xs gap-1'
              >
                <CheckCircle2 className='h-3 w-3' />
                Reachable
              </Badge>
            )}
            {result === 'error' && (
              <Badge
                variant='outline'
                className='border-destructive text-destructive text-xs gap-1'
              >
                <XCircle className='h-3 w-3' />
                Unreachable
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>{description}</p>
          <p className='mt-0.5 font-mono text-xs text-muted-foreground'>
            {path}
          </p>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='sm' className='h-8 w-8 p-0' asChild>
          <a
            href={path}
            target='_blank'
            rel='noreferrer'
            aria-label={`Open ${provider} webhook`}
          >
            <ExternalLink className='h-3.5 w-3.5' />
          </a>
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? (
            <>
              <Loader2 className='h-3 w-3 mr-1.5 animate-spin' />
              Testing...
            </>
          ) : (
            'Test'
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageLogTab  (live feed + filters)
// ---------------------------------------------------------------------------

function MessageLogTab({ workspaceId }: { workspaceId: string | null }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(
    async (silent = false) => {
      silent ? setRefreshing(true) : setLoading(true);
      try {
        const p = new URLSearchParams({ limit: '50', page: '1' });
        if (channel !== 'all') p.set('channel', channel);
        if (status !== 'all') p.set('status', status);
        if (dateFrom) p.set('dateFrom', dateFrom);
        if (dateTo) p.set('dateTo', dateTo);
        const res = await fetch(`/api/communications?${p}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setLogs(json.data ?? []);
        setLastRefresh(new Date());
      } catch {
        if (!silent)
          toast({
            title: 'Error',
            description: 'Failed to load message logs.',
            variant: 'destructive',
          });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [channel, status, dateFrom, dateTo, toast]
  );

  useEffect(() => {
    fetchLogs();
    const id = setInterval(() => fetchLogs(true), POLL_MS);
    return () => clearInterval(id);
  }, [fetchLogs]);

  const filtered = search
    ? logs.filter(l =>
        [l.channel, l.status, l.subject ?? ''].some(v =>
          v.toLowerCase().includes(search.toLowerCase())
        )
      )
    : logs;

  return (
    <div className='space-y-4'>
      {/* Filters */}
      <div className='flex flex-wrap items-end gap-3'>
        <Input
          className='flex-1 min-w-[160px]'
          placeholder='Search subject, channel…'
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className='w-36'>
            <SelectValue placeholder='Channel' />
          </SelectTrigger>
          <SelectContent>
            {['all', 'email', 'in_app', 'webhook', 'sms', 'push'].map(v => (
              <SelectItem key={v} value={v}>
                {v === 'all' ? 'All Channels' : v.replace('_', '-')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-36'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            {['all', 'pending', 'sent', 'delivered', 'failed', 'bounced'].map(
              v => (
                <SelectItem key={v} value={v}>
                  {v === 'all' ? 'All Statuses' : v}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <Input
          type='date'
          className='w-36'
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          aria-label='Date from'
        />
        <Input
          type='date'
          className='w-36'
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          aria-label='Date to'
        />
        <Button
          variant='outline'
          size='sm'
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className='shrink-0'
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {lastRefresh && (
        <p className='text-xs text-muted-foreground'>
          Auto-refreshes every {POLL_MS / 1000}s. Last updated:{' '}
          {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Log rows */}
      {loading ? (
        <div className='space-y-2'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='h-14 w-full' />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className='py-10 text-center text-sm text-muted-foreground'>
            No messages match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-1.5'>
          {filtered.map(log => (
            <div
              key={log.id}
              className='flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm'
            >
              <div className='flex items-center gap-3 min-w-0'>
                <span className='text-muted-foreground'>
                  {CHANNEL_ICONS[log.channel] ?? (
                    <MessageSquare className='h-3.5 w-3.5' />
                  )}
                </span>
                <span className='truncate font-medium'>
                  {log.subject ?? '(no subject)'}
                </span>
                <Badge
                  variant='outline'
                  className='capitalize shrink-0 text-xs'
                >
                  {log.channel.replace('_', '-')}
                </Badge>
                <Badge
                  variant='outline'
                  className={`shrink-0 text-xs ${STATUS_CLS[log.status] ?? ''}`}
                >
                  {log.status}
                </Badge>
              </div>
              <span className='ml-4 shrink-0 text-xs text-muted-foreground'>
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {workspaceId && (
        <div className='pt-4 border-t'>
          <p className='mb-3 text-sm font-medium text-muted-foreground'>
            Full agent communication log
          </p>
          <AgentCommLogViewer workspaceId={workspaceId} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommunicationsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { setPageHeader } = usePageHeader();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [stats, setStats] = useState<CommStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setPageHeader(
      'Communications',
      'Monitor message logs, configure channel preferences, and manage inbound webhook endpoints'
    );
  }, [setPageHeader]);

  useEffect(() => {
    if (!workspaceSlug) return;
    fetch(`/api/workspaces/${workspaceSlug}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setWorkspaceId(d.id ?? d?.data?.id ?? null))
      .catch(() => setWorkspaceId(null))
      .finally(() => setWsLoading(false));
  }, [workspaceSlug]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    try {
      const res = await fetch('/api/communications/stats');
      if (res.ok) {
        const j = await res.json();
        setStats(j.data ?? null);
      }
    } catch {
      /* silent */
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(() => fetchStats(true), POLL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  const total = stats?.totalMessages ?? 0;
  const wsError = !wsLoading && workspaceId === null;

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='overview'>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='logs'>Message Log</TabsTrigger>
          <TabsTrigger value='routing'>Routing Rules</TabsTrigger>
          <TabsTrigger value='preferences'>Preferences</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value='overview' className='mt-4 space-y-6'>
          {/* Stat cards */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {[
              {
                label: 'Total Messages',
                value: statsLoading ? null : total.toLocaleString(),
              },
              {
                label: 'Active Channels',
                value: statsLoading
                  ? null
                  : Object.keys(stats?.byChannel ?? {}).length,
              },
              {
                label: 'Delivery Rate',
                value: statsLoading
                  ? null
                  : `${((stats?.deliveryRate ?? 0) * 100).toFixed(1)}%`,
                sub: 'delivered / attempted',
              },
              {
                label: 'Pending',
                value: statsLoading
                  ? null
                  : (stats?.byStatus?.pending ?? 0).toLocaleString(),
                sub: 'awaiting delivery',
              },
            ].map(({ label, value, sub }) => (
              <Card key={label}>
                <CardHeader className='pb-2'>
                  <CardDescription>{label}</CardDescription>
                  {value === null ? (
                    <Skeleton className='h-8 w-24 mt-1' />
                  ) : (
                    <CardTitle className='text-2xl'>{value}</CardTitle>
                  )}
                  {sub && value !== null && (
                    <p className='text-xs text-muted-foreground'>{sub}</p>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Channel distribution */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Channel Routing Distribution
              </CardTitle>
              <CardDescription>
                Message volume by communication channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className='space-y-2'>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className='h-8 w-full' />
                  ))}
                </div>
              ) : stats && Object.keys(stats.byChannel).length > 0 ? (
                <div className='space-y-2'>
                  {Object.entries(stats.byChannel)
                    .sort(([, a], [, b]) => b - a)
                    .map(([ch, count]) => {
                      const pct = total > 0 ? (count / total) * 100 : 0;
                      return (
                        <div key={ch} className='flex items-center gap-3'>
                          <div className='flex w-28 items-center gap-1.5 shrink-0 text-muted-foreground'>
                            {CHANNEL_ICONS[ch] ?? (
                              <MessageSquare className='h-3.5 w-3.5' />
                            )}
                            <span className='text-sm capitalize'>
                              {ch.replace('_', '-')}
                            </span>
                          </div>
                          <div className='flex-1 h-4 rounded bg-muted overflow-hidden'>
                            <div
                              className='h-full rounded bg-primary/60'
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className='w-24 text-right text-sm text-muted-foreground'>
                            {count.toLocaleString()} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No channel data available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Status Breakdown</CardTitle>
              <CardDescription>
                Messages grouped by delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className='flex gap-2'>
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className='h-8 w-24' />
                  ))}
                </div>
              ) : stats && Object.keys(stats.byStatus).length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {Object.entries(stats.byStatus)
                    .sort(([, a], [, b]) => b - a)
                    .map(([s, n]) => (
                      <Badge
                        key={s}
                        variant='outline'
                        className={`text-sm px-3 py-1 ${STATUS_CLS[s] ?? ''}`}
                      >
                        {s}: {n.toLocaleString()}
                      </Badge>
                    ))}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No status data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Log */}
        <TabsContent value='logs' className='mt-4'>
          {wsLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-10 w-full' />
              <Skeleton className='h-64 w-full' />
            </div>
          ) : wsError ? (
            <p className='text-sm text-muted-foreground'>
              Failed to load workspace data. Please refresh and try again.
            </p>
          ) : (
            <MessageLogTab workspaceId={workspaceId} />
          )}
        </TabsContent>

        {/* Routing Rules */}
        <TabsContent value='routing' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                Inbound Webhook Endpoints
              </CardTitle>
              <CardDescription>
                These endpoints receive inbound messages from external
                communication providers. Use the Test button to verify each is
                reachable.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {INBOUND_WEBHOOKS.map(ep => (
                <WebhookRow key={ep.path} {...ep} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value='preferences' className='mt-4'>
          {wsLoading ? (
            <Skeleton className='h-48 w-full' />
          ) : wsError ? (
            <p className='text-sm text-muted-foreground'>
              Failed to load workspace data. Please refresh and try again.
            </p>
          ) : workspaceId ? (
            <CommunicationPreferences orchestratorId={workspaceId} />
          ) : (
            <p className='text-sm text-muted-foreground'>
              No workspace data available.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
