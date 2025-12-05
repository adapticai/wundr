'use client';

import { cn } from '@/lib/utils';

import type { OrchestratorStatus } from '@/types/orchestrator';

export type DaemonHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

export interface OrchestratorHealthMetrics {
  messagesProcessed: number;
  avgResponseTime: number; // in ms
  errorRate: number; // percentage
  uptime: number; // percentage
}

export interface OrchestratorStatusData {
  id: string;
  title: string;
  discipline: string | null;
  avatarUrl: string | null;
  status: OrchestratorStatus;
  daemonHealth: DaemonHealthStatus;
  lastHeartbeat: Date | null;
  metrics?: OrchestratorHealthMetrics;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

/**
 * Props for the OrchestratorStatusCard component
 */
interface OrchestratorStatusCardProps {
  /** Orchestrator status data to display */
  orchestrator: OrchestratorStatusData;
  /** Callback when view details is clicked */
  onViewDetails?: (orchestratorId: string) => void;
  /** Callback when restart daemon is clicked */
  onRestartDaemon?: (orchestratorId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

const daemonHealthConfig: Record<
  DaemonHealthStatus,
  { label: string; color: string; bgColor: string; icon: typeof HeartIcon }
> = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: HeartIcon,
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: AlertTriangleIcon,
  },
  unhealthy: {
    label: 'Unhealthy',
    color: 'text-rose-700 dark:text-rose-300',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    icon: XCircleIcon,
  },
  unknown: {
    label: 'Unknown',
    color: 'text-stone-700 dark:text-stone-300',
    bgColor: 'bg-stone-100 dark:bg-stone-800',
    icon: HelpCircleIcon,
  },
};

const connectionStatusConfig: Record<
  OrchestratorStatusData['connectionStatus'],
  { label: string; color: string }
> = {
  connected: { label: 'Connected', color: 'text-emerald-600' },
  disconnected: { label: 'Disconnected', color: 'text-rose-600' },
  connecting: { label: 'Connecting...', color: 'text-amber-600' },
};

export function OrchestratorStatusCard({
  orchestrator,
  onViewDetails,
  onRestartDaemon,
  className,
}: OrchestratorStatusCardProps) {
  const healthConfig = daemonHealthConfig[orchestrator.daemonHealth];
  const HealthIcon = healthConfig.icon;
  const connectionConfig =
    connectionStatusConfig[orchestrator.connectionStatus];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-all',
        orchestrator.daemonHealth === 'unhealthy' && 'border-red-500/50',
        orchestrator.daemonHealth === 'degraded' && 'border-yellow-500/50',
        className,
      )}
    >
      {/* Header */}
      <div className='flex items-start gap-3'>
        {/* Avatar */}
        <div className='relative flex-shrink-0'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary font-heading'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {orchestrator.avatarUrl ? (
              <img
                src={orchestrator.avatarUrl}
                alt={orchestrator.title}
                className='h-full w-full rounded-lg object-cover'
              />
            ) : (
              getInitials(orchestrator.title)
            )}
          </div>
          <OrchestratorStatusDot
            status={orchestrator.status}
            className='absolute -bottom-0.5 -right-0.5'
          />
        </div>

        {/* Info */}
        <div className='flex-1 min-w-0'>
          <h3 className='truncate font-semibold text-foreground font-heading'>
            {orchestrator.title}
          </h3>
          {orchestrator.discipline && (
            <p className='truncate text-sm text-muted-foreground font-sans'>
              {orchestrator.discipline}
            </p>
          )}
        </div>
      </div>

      {/* Daemon Health Badge */}
      <div className='mt-4 flex items-center justify-between'>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium font-sans',
            healthConfig.bgColor,
            healthConfig.color,
          )}
        >
          <HealthIcon className='h-3.5 w-3.5' />
          {healthConfig.label}
        </div>

        <div
          className={cn(
            'flex items-center gap-1 text-xs font-sans',
            connectionConfig.color,
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              orchestrator.connectionStatus === 'connected' && 'bg-emerald-500',
              orchestrator.connectionStatus === 'disconnected' && 'bg-rose-500',
              orchestrator.connectionStatus === 'connecting' &&
                'bg-amber-500 animate-pulse',
            )}
          />
          {connectionConfig.label}
        </div>
      </div>

      {/* Last Heartbeat */}
      <div className='mt-3 flex items-center gap-2 text-xs text-muted-foreground'>
        <HeartPulseIcon className='h-3.5 w-3.5' />
        <span>
          Last heartbeat:{' '}
          {orchestrator.lastHeartbeat
            ? formatRelativeTime(orchestrator.lastHeartbeat)
            : 'Never'}
        </span>
      </div>

      {/* Metrics Preview */}
      {orchestrator.metrics && (
        <div className='mt-3 grid grid-cols-2 gap-2 border-t pt-3'>
          <MetricItem
            label='Response Time'
            value={`${orchestrator.metrics.avgResponseTime}ms`}
            status={
              orchestrator.metrics.avgResponseTime < 200
                ? 'good'
                : orchestrator.metrics.avgResponseTime < 500
                  ? 'warning'
                  : 'bad'
            }
          />
          <MetricItem
            label='Error Rate'
            value={`${orchestrator.metrics.errorRate.toFixed(1)}%`}
            status={
              orchestrator.metrics.errorRate < 1
                ? 'good'
                : orchestrator.metrics.errorRate < 5
                  ? 'warning'
                  : 'bad'
            }
          />
          <MetricItem
            label='Uptime'
            value={`${orchestrator.metrics.uptime.toFixed(1)}%`}
            status={
              orchestrator.metrics.uptime > 99
                ? 'good'
                : orchestrator.metrics.uptime > 95
                  ? 'warning'
                  : 'bad'
            }
          />
          <MetricItem
            label='Messages'
            value={orchestrator.metrics.messagesProcessed.toLocaleString()}
          />
        </div>
      )}

      {/* Actions */}
      <div className='mt-4 flex items-center gap-2 border-t pt-3'>
        {onViewDetails && (
          <button
            type='button'
            onClick={() => onViewDetails(orchestrator.id)}
            className={cn(
              'flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-center text-sm font-medium',
              'transition-colors hover:bg-accent',
            )}
          >
            View Details
          </button>
        )}
        {onRestartDaemon && orchestrator.daemonHealth !== 'healthy' && (
          <button
            type='button'
            onClick={() => onRestartDaemon(orchestrator.id)}
            className={cn(
              'rounded-md border border-border bg-background p-1.5 text-muted-foreground',
              'transition-colors hover:bg-accent hover:text-foreground',
            )}
            aria-label='Restart daemon'
            title='Restart daemon'
          >
            <RefreshIcon className='h-4 w-4' />
          </button>
        )}
      </div>
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  status?: 'good' | 'warning' | 'bad';
}

function MetricItem({ label, value, status }: MetricItemProps) {
  const statusColors = {
    good: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    bad: 'text-rose-600 dark:text-rose-400',
  };

  return (
    <div>
      <p className='text-xs text-muted-foreground font-sans'>{label}</p>
      <p
        className={cn(
          'text-sm font-medium font-sans',
          status && statusColors[status],
        )}
      >
        {value}
      </p>
    </div>
  );
}

interface OrchestratorStatusDotProps {
  status: OrchestratorStatus;
  className?: string;
}

function OrchestratorStatusDot({
  status,
  className,
}: OrchestratorStatusDotProps) {
  const statusColors: Record<OrchestratorStatus, string> = {
    ONLINE: 'bg-emerald-500',
    OFFLINE: 'bg-stone-400',
    BUSY: 'bg-yellow-500',
    AWAY: 'bg-orange-500',
  };

  return (
    <span
      className={cn(
        'flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-card',
        statusColors[status],
        className,
      )}
    />
  );
}

export function OrchestratorStatusCardSkeleton() {
  return (
    <div className='rounded-lg border bg-card p-4 shadow-sm'>
      {/* Header Skeleton */}
      <div className='flex items-start gap-3'>
        <div className='h-12 w-12 animate-pulse rounded-full bg-muted' />
        <div className='flex-1 space-y-2'>
          <div className='h-5 w-32 animate-pulse rounded bg-muted' />
          <div className='h-4 w-20 animate-pulse rounded bg-muted' />
        </div>
      </div>

      {/* Health Badge Skeleton */}
      <div className='mt-4 flex items-center justify-between'>
        <div className='h-6 w-20 animate-pulse rounded-full bg-muted' />
        <div className='h-4 w-24 animate-pulse rounded bg-muted' />
      </div>

      {/* Heartbeat Skeleton */}
      <div className='mt-3 h-4 w-40 animate-pulse rounded bg-muted' />

      {/* Metrics Skeleton */}
      <div className='mt-3 grid grid-cols-2 gap-2 border-t pt-3'>
        {[1, 2, 3, 4].map(i => (
          <div key={i}>
            <div className='h-3 w-16 animate-pulse rounded bg-muted' />
            <div className='mt-1 h-4 w-12 animate-pulse rounded bg-muted' />
          </div>
        ))}
      </div>

      {/* Actions Skeleton */}
      <div className='mt-4 flex items-center gap-2 border-t pt-3'>
        <div className='h-8 flex-1 animate-pulse rounded-md bg-muted' />
      </div>
    </div>
  );
}

// Utility functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffSecs < 30) {
    return 'Just now';
  }
  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleDateString();
}

// Icons
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' />
    </svg>
  );
}

function HeartPulseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' />
      <path d='M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27' />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' />
      <path d='M12 9v4' />
      <path d='M12 17h.01' />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='10' />
      <path d='m15 9-6 6' />
      <path d='m9 9 6 6' />
    </svg>
  );
}

function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='12' cy='12' r='10' />
      <path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3' />
      <path d='M12 17h.01' />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' />
      <path d='M21 3v5h-5' />
      <path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' />
      <path d='M8 16H3v5' />
    </svg>
  );
}
