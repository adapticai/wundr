'use client';

/**
 * DaemonStatusBadge Component
 *
 * Compact badge showing daemon online/offline connection status per orchestrator.
 * Features pulse animation when active and tooltip with connection details.
 *
 * @module components/orchestrator/daemon-status-badge
 */

import { useCallback, useEffect, useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DaemonConnectionDetails {
  connected: boolean;
  lastHeartbeat: string | null;
  uptimeSeconds: number | null;
  latencyMs: number | null;
  version: string | null;
}

interface DaemonStatusBadgeProps {
  orchestratorId: string;
  /** Show full badge with label, or just the dot indicator */
  compact?: boolean;
  /** Polling interval in ms (default 30s) */
  pollInterval?: number;
  className?: string;
}

const POLL_INTERVAL_MS = 30_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHeartbeat(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── Dot Indicator ────────────────────────────────────────────────────────────

function ConnectionDot({
  connected,
  size = 'md',
  loading = false,
}: {
  connected: boolean;
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';

  if (loading) {
    return (
      <span
        className={cn(
          'relative inline-flex rounded-full bg-muted animate-pulse',
          dotSize
        )}
      />
    );
  }

  return (
    <span className={cn('relative inline-flex', dotSize)}>
      {connected && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75'
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          dotSize,
          connected ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DaemonStatusBadge({
  orchestratorId,
  compact = false,
  pollInterval = POLL_INTERVAL_MS,
  className,
}: DaemonStatusBadgeProps) {
  const [status, setStatus] = useState<DaemonConnectionDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/orchestrators/${orchestratorId}/daemon-status`
      );
      if (!res.ok) {
        setStatus({
          connected: false,
          lastHeartbeat: null,
          uptimeSeconds: null,
          latencyMs: null,
          version: null,
        });
        return;
      }
      const data: DaemonConnectionDetails = await res.json();
      setStatus(data);
    } catch {
      setStatus({
        connected: false,
        lastHeartbeat: null,
        uptimeSeconds: null,
        latencyMs: null,
        version: null,
      });
    } finally {
      setLoading(false);
    }
  }, [orchestratorId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  const connected = status?.connected ?? false;

  const tooltipContent = (
    <div className='space-y-1.5 text-xs'>
      <div className='flex items-center gap-1.5'>
        <ConnectionDot connected={connected} size='sm' loading={loading} />
        <span className='font-medium'>
          {loading ? 'Checking...' : connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      {!loading && status && (
        <>
          {status.lastHeartbeat && (
            <p className='text-muted-foreground'>
              Last heartbeat: {formatHeartbeat(status.lastHeartbeat)}
            </p>
          )}
          {status.uptimeSeconds !== null && status.uptimeSeconds > 0 && (
            <p className='text-muted-foreground'>
              Uptime: {formatUptime(status.uptimeSeconds)}
            </p>
          )}
          {status.latencyMs !== null && (
            <p className='text-muted-foreground'>
              Latency: {status.latencyMs}ms
            </p>
          )}
          {status.version && (
            <p className='text-muted-foreground'>Version: {status.version}</p>
          )}
        </>
      )}
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex items-center', className)}>
              <ConnectionDot
                connected={connected}
                size='sm'
                loading={loading}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side='top' className='max-w-[200px]'>
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-sans font-medium cursor-default',
              loading
                ? 'border-muted bg-muted/30 text-muted-foreground'
                : connected
                  ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
              className
            )}
            role='status'
            aria-label={
              loading
                ? 'Checking daemon status'
                : connected
                  ? 'Daemon connected'
                  : 'Daemon disconnected'
            }
          >
            <ConnectionDot connected={connected} size='sm' loading={loading} />
            {loading
              ? 'Checking'
              : connected
                ? 'Daemon Online'
                : 'Daemon Offline'}
          </span>
        </TooltipTrigger>
        <TooltipContent side='bottom' className='max-w-[200px]'>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default DaemonStatusBadge;
