'use client';

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  MessageSquare,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

export interface AgentCommLogViewerProps {
  workspaceId: string;
  orchestratorId?: string;
  className?: string;
}

export interface CommLogEntry {
  id: string;
  channel: string;
  direction: string;
  status: string;
  subject?: string;
  preview: string;
  recipientName?: string;
  senderName?: string;
  createdAt: string;
}

interface CommStats {
  totalMessages: number;
  deliveryRate: number;
  avgResponseTime: string;
  activeChannels: number;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WA',
  internal: 'Int',
  voice: 'Voice',
  slack: 'Slack',
};

const CHANNEL_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-700',
  sms: 'bg-green-100 text-green-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
  internal: 'bg-purple-100 text-purple-700',
  voice: 'bg-orange-100 text-orange-700',
  slack: 'bg-rose-100 text-rose-700',
};

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className='pt-4 pb-3'>
        <p className='text-xs text-muted-foreground mb-1'>{label}</p>
        <p className='text-xl font-semibold'>{value}</p>
      </CardContent>
    </Card>
  );
}

export function AgentCommLogViewer({
  workspaceId,
  orchestratorId,
  className,
}: AgentCommLogViewerProps) {
  const [logs, setLogs] = useState<CommLogEntry[]>([]);
  const [stats, setStats] = useState<CommStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [channelFilter, setChannelFilter] = useState('all');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const PAGE_SIZE = 20;

  const buildLogsUrl = useCallback(
    (skip: number) => {
      const params = new URLSearchParams({
        workspaceId,
        skip: skip.toString(),
        take: PAGE_SIZE.toString(),
      });
      if (channelFilter !== 'all') params.set('channel', channelFilter);
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (orchestratorId) params.set('orchestratorId', orchestratorId);
      return `/api/communications?${params.toString()}`;
    },
    [workspaceId, channelFilter, directionFilter, statusFilter, orchestratorId]
  );

  const fetchStats = useCallback(async () => {
    const params = new URLSearchParams({ workspaceId });
    if (orchestratorId) params.set('orchestratorId', orchestratorId);
    try {
      const res = await fetch(`/api/communications/stats?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch {
      // stats are non-critical, fail silently
    }
  }, [workspaceId, orchestratorId]);

  const fetchLogs = useCallback(
    async (reset = true) => {
      const skip = reset ? 0 : offset;
      if (reset) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const res = await fetch(buildLogsUrl(skip));
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();

        const entries: CommLogEntry[] = data.data ?? data ?? [];
        const total: number = data.total ?? entries.length;

        if (reset) {
          setLogs(entries);
          setOffset(entries.length);
        } else {
          setLogs(prev => [...prev, ...entries]);
          setOffset(prev => prev + entries.length);
        }

        setHasMore(skip + entries.length < total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load communications'
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [buildLogsUrl, offset]
  );

  useEffect(() => {
    fetchLogs(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, orchestratorId, channelFilter, directionFilter, statusFilter]);

  const filteredLogs = search
    ? logs.filter(
        l =>
          l.preview.toLowerCase().includes(search.toLowerCase()) ||
          l.subject?.toLowerCase().includes(search.toLowerCase()) ||
          l.senderName?.toLowerCase().includes(search.toLowerCase()) ||
          l.recipientName?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats */}
      {stats && (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <StatCard label='Total Messages' value={stats.totalMessages} />
          <StatCard
            label='Delivery Rate'
            value={`${stats.deliveryRate}%`}
          />
          <StatCard label='Avg Response Time' value={stats.avgResponseTime} />
          <StatCard label='Active Channels' value={stats.activeChannels} />
        </div>
      )}

      {/* Filter Bar */}
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search messages...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>

        <div className='flex gap-2'>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className='w-[130px]'>
              <SelectValue placeholder='Channel' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All channels</SelectItem>
              <SelectItem value='email'>Email</SelectItem>
              <SelectItem value='sms'>SMS</SelectItem>
              <SelectItem value='whatsapp'>WhatsApp</SelectItem>
              <SelectItem value='internal'>Internal</SelectItem>
              <SelectItem value='voice'>Voice</SelectItem>
              <SelectItem value='slack'>Slack</SelectItem>
            </SelectContent>
          </Select>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className='w-[130px]'>
              <SelectValue placeholder='Direction' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All directions</SelectItem>
              <SelectItem value='inbound'>Inbound</SelectItem>
              <SelectItem value='outbound'>Outbound</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[120px]'>
              <SelectValue placeholder='Status' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All statuses</SelectItem>
              <SelectItem value='sent'>Sent</SelectItem>
              <SelectItem value='delivered'>Delivered</SelectItem>
              <SelectItem value='failed'>Failed</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm font-medium text-muted-foreground'>
            Communication Logs
          </CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='space-y-3 p-4'>
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
            </div>
          ) : error ? (
            <div className='flex flex-col items-center justify-center gap-3 py-12'>
              <AlertCircle className='h-8 w-8 text-destructive' />
              <p className='text-sm text-muted-foreground'>{error}</p>
              <Button
                variant='outline'
                size='sm'
                onClick={() => fetchLogs(true)}
              >
                Retry
              </Button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className='flex flex-col items-center justify-center gap-2 py-12 text-center'>
              <MessageSquare className='h-10 w-10 text-muted-foreground/40' />
              <p className='text-sm font-medium text-muted-foreground'>
                No messages found
              </p>
              <p className='text-xs text-muted-foreground'>
                {logs.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Communications will appear here once they are recorded'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-[110px]'>Time</TableHead>
                  <TableHead className='w-[80px]'>Channel</TableHead>
                  <TableHead className='w-[60px]'>Dir</TableHead>
                  <TableHead>From / To</TableHead>
                  <TableHead>Subject / Preview</TableHead>
                  <TableHead className='w-[100px]'>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className='text-xs text-muted-foreground whitespace-nowrap'>
                      {formatTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium',
                          CHANNEL_COLORS[log.channel] ??
                            'bg-muted text-muted-foreground'
                        )}
                      >
                        {CHANNEL_LABELS[log.channel] ?? log.channel}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.direction === 'inbound' ? (
                        <ArrowDown className='h-4 w-4 text-green-600' />
                      ) : (
                        <ArrowUp className='h-4 w-4 text-blue-600' />
                      )}
                    </TableCell>
                    <TableCell className='text-xs'>
                      <span className='text-muted-foreground'>
                        {log.direction === 'inbound'
                          ? log.senderName ?? 'Unknown'
                          : log.recipientName ?? 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className='max-w-[260px]'>
                      {log.subject && (
                        <p className='truncate text-xs font-medium'>
                          {log.subject}
                        </p>
                      )}
                      <p className='truncate text-xs text-muted-foreground'>
                        {log.preview}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border text-xs capitalize',
                          STATUS_STYLES[log.status] ??
                            'bg-muted text-muted-foreground'
                        )}
                        variant='outline'
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Load More */}
          {hasMore && !isLoading && !error && (
            <div className='flex justify-center border-t p-4'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => fetchLogs(false)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentCommLogViewer;
