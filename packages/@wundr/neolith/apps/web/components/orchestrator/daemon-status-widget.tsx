'use client';

import { useState, useEffect, useCallback } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DaemonStatusWidgetProps {
  workspaceId: string;
  compact?: boolean;
  className?: string;
}

interface DaemonStatus {
  connected: boolean;
  uptime: number;
  activeAgents: number;
  messagesPerMin: number;
  avgLatencyMs: number;
  lastHeartbeat: string;
  components: {
    scheduler: 'healthy' | 'degraded' | 'down';
    channels: 'healthy' | 'degraded' | 'down';
    storage: 'healthy' | 'degraded' | 'down';
  };
}

const REFRESH_INTERVAL_MS = 15_000;

const componentColors: Record<'healthy' | 'degraded' | 'down', string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHeartbeat(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className='relative inline-flex h-2.5 w-2.5'>
      {connected && (
        <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75' />
      )}
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          connected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    </span>
  );
}

export function DaemonStatusWidget({
  workspaceId,
  compact = false,
  className,
}: DaemonStatusWidgetProps) {
  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/daemon/status?workspaceId=${workspaceId}`);
      if (!res.ok) {
        setUnreachable(true);
        setStatus(null);
        return;
      }
      const data: DaemonStatus = await res.json();
      setStatus(data);
      setUnreachable(false);
    } catch {
      setUnreachable(true);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return compact ? (
      <CompactSkeleton className={className} />
    ) : (
      <FullSkeleton className={className} />
    );
  }

  if (unreachable || !status) {
    if (compact) {
      return (
        <div
          className={cn('flex items-center gap-2 text-sm font-sans', className)}
        >
          <StatusDot connected={false} />
          <span className='text-muted-foreground'>Daemon not connected</span>
        </div>
      );
    }
    return (
      <Card className={cn('border-destructive/50 bg-destructive/5', className)}>
        <CardContent className='flex items-center gap-2 p-4'>
          <StatusDot connected={false} />
          <span className='text-sm font-sans text-destructive'>
            Daemon Unreachable
          </span>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-3 text-sm font-sans', className)}
      >
        <StatusDot connected={status.connected} />
        <span className='text-foreground'>
          Daemon: {status.connected ? 'Connected' : 'Disconnected'}
        </span>
        <Badge variant='secondary' className='text-xs'>
          {status.activeAgents} agents
        </Badge>
        <span className='text-muted-foreground'>
          {status.messagesPerMin} msg/min
        </span>
      </div>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader className='pb-3 pt-4 px-4'>
        <div className='flex items-center justify-between'>
          <CardTitle className='text-sm font-heading font-semibold text-foreground'>
            Daemon Status
          </CardTitle>
          <div className='flex items-center gap-1.5'>
            <StatusDot connected={status.connected} />
            <span
              className={cn(
                'text-xs font-sans font-medium',
                status.connected
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500'
              )}
            >
              {status.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-3 px-4 pb-4 pt-0'>
        {/* Stats row */}
        <div className='grid grid-cols-4 gap-2'>
          <StatCell label='Uptime' value={formatUptime(status.uptime)} />
          <StatCell label='Agents' value={String(status.activeAgents)} />
          <StatCell label='Msg/min' value={String(status.messagesPerMin)} />
          <StatCell label='Latency' value={`${status.avgLatencyMs}ms`} />
        </div>

        {/* Health bar */}
        <div>
          <p className='mb-1.5 text-xs font-sans text-muted-foreground'>
            Components
          </p>
          <div className='flex gap-1.5'>
            {(
              Object.entries(status.components) as [
                keyof DaemonStatus['components'],
                'healthy' | 'degraded' | 'down',
              ][]
            ).map(([name, health]) => (
              <TooltipProvider key={name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'h-2 flex-1 rounded-full',
                        componentColors[health]
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className='text-xs capitalize'>
                      {name}: {health}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          <div className='mt-1 flex gap-1.5'>
            {(
              Object.keys(status.components) as Array<
                keyof DaemonStatus['components']
              >
            ).map(name => (
              <p
                key={name}
                className='flex-1 text-center text-xs font-sans text-muted-foreground capitalize'
              >
                {name}
              </p>
            ))}
          </div>
        </div>

        {/* Last heartbeat */}
        <p className='text-xs font-sans text-muted-foreground'>
          Last heartbeat:{' '}
          <span className='text-foreground'>
            {formatHeartbeat(status.lastHeartbeat)}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border bg-background px-2 py-1.5 text-center'>
      <p className='text-xs font-sans text-muted-foreground'>{label}</p>
      <p className='text-sm font-heading font-semibold text-foreground'>
        {value}
      </p>
    </div>
  );
}

function FullSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className='pb-3 pt-4 px-4'>
        <div className='flex items-center justify-between'>
          <Skeleton className='h-4 w-28' />
          <Skeleton className='h-4 w-20' />
        </div>
      </CardHeader>
      <CardContent className='space-y-3 px-4 pb-4 pt-0'>
        <div className='grid grid-cols-4 gap-2'>
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className='h-12 rounded-md' />
          ))}
        </div>
        <Skeleton className='h-2 w-full rounded-full' />
        <Skeleton className='h-3 w-48' />
      </CardContent>
    </Card>
  );
}

function CompactSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Skeleton className='h-2.5 w-2.5 rounded-full' />
      <Skeleton className='h-4 w-36' />
      <Skeleton className='h-5 w-16 rounded-full' />
    </div>
  );
}

export default DaemonStatusWidget;
