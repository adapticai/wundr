'use client';

import { cn } from '@/lib/utils';
import {
  DEPLOYMENT_STATUS_CONFIG,
  DEPLOYMENT_TYPE_CONFIG,
  HEALTH_STATUS_CONFIG,
} from '@/types/deployment';

import type {
  Deployment,
  DeploymentStatus,
  HealthStatus,
  DeploymentType,
} from '@/types/deployment';

export interface DeploymentCardProps {
  deployment: Deployment;
  onViewLogs: () => void;
  onRestart: () => void;
  onStop: () => void;
  onDelete: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function DeploymentCard({
  deployment,
  onViewLogs,
  onRestart,
  onStop,
  onDelete,
  isLoading = false,
  compact = false,
}: DeploymentCardProps) {
  const lastDeployText = deployment.deployedAt
    ? formatRelativeTime(new Date(deployment.deployedAt))
    : 'Never deployed';

  const uptimeText = formatUptime(deployment.health.uptime);

  if (compact) {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm',
          isLoading && 'pointer-events-none opacity-60',
        )}
      >
        {/* Type Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <TypeIcon type={deployment.type} className="h-5 w-5 text-primary" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{deployment.name}</h3>
            <DeploymentStatusBadge status={deployment.status} size="sm" />
            <HealthBadge status={deployment.health.status} size="sm" />
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{DEPLOYMENT_TYPE_CONFIG[deployment.type].label}</span>
            <span>|</span>
            <span>{deployment.environment}</span>
            <span>|</span>
            <span>v{deployment.version}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewLogs}
            disabled={isLoading}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="View logs"
          >
            <LogsIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={isLoading || deployment.status !== 'running'}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Restart deployment"
          >
            <RestartIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={isLoading || deployment.status === 'stopped'}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Stop deployment"
          >
            <StopIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading}
            className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            aria-label="Delete deployment"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md',
        isLoading && 'pointer-events-none opacity-60',
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Type Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <TypeIcon type={deployment.type} className="h-6 w-6 text-primary" />
          </div>

          {/* Name and Type */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading font-semibold text-foreground">
              {deployment.name}
            </h3>
            <p className="truncate text-sm font-sans text-muted-foreground">
              {DEPLOYMENT_TYPE_CONFIG[deployment.type].label} • {deployment.environment}
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2">
          <DeploymentStatusBadge status={deployment.status} />
          <HealthBadge status={deployment.health.status} />
        </div>
      </div>

      {/* Description */}
      {deployment.description && (
        <p className="mb-4 line-clamp-2 text-sm font-sans text-muted-foreground">
          {deployment.description}
        </p>
      )}

      {/* Details Grid */}
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-md bg-muted/50 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Version</p>
          <p className="font-mono text-sm font-medium">v{deployment.version}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Region</p>
          <p className="text-sm font-medium">{deployment.config.region}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Replicas</p>
          <p className="text-sm font-medium">{deployment.config.replicas}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Uptime</p>
          <p className="text-sm font-medium">{uptimeText}</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <ActivityIcon className="h-4 w-4" />
          <span>{formatNumber(deployment.stats.requests)} reqs</span>
        </div>
        {deployment.stats.errors > 0 && (
          <div className="flex items-center gap-1.5 text-destructive">
            <ErrorIcon className="h-4 w-4" />
            <span>{deployment.stats.errors} errors</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          <span>{deployment.stats.latencyP50}ms (p50)</span>
        </div>
      </div>

      {/* URL */}
      {deployment.url && (
        <div className="mb-4">
          <a
            href={deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <LinkIcon className="h-4 w-4" />
            {deployment.url}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <p className="text-xs text-muted-foreground">Deployed {lastDeployText}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewLogs}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            aria-label="View logs"
          >
            <LogsIcon className="h-4 w-4" />
            Logs
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={isLoading || deployment.status !== 'running'}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Restart"
          >
            <RestartIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={isLoading || deployment.status === 'stopped'}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Stop"
          >
            <StopIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading}
            className="rounded-md border border-border bg-background p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            aria-label="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeploymentCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-5 shadow-sm">
      {/* Header Skeleton */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      {/* Details Skeleton */}
      <div className="mb-4 h-24 animate-pulse rounded-md bg-muted" />

      {/* Stats Skeleton */}
      <div className="mb-4 flex items-center gap-4">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Actions Skeleton */}
      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

interface DeploymentStatusBadgeProps {
  status: DeploymentStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function DeploymentStatusBadge({
  status,
  size = 'md',
  className,
}: DeploymentStatusBadgeProps) {
  const config = DEPLOYMENT_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.color,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className,
      )}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {status === 'running' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {status === 'deploying' && (
        <span className="h-2 w-2 animate-spin rounded-full border border-blue-500 border-t-transparent" />
      )}
      {status === 'updating' && (
        <span className="h-2 w-2 animate-spin rounded-full border border-yellow-500 border-t-transparent" />
      )}
      {status === 'failed' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
      )}
      {status === 'stopped' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gray-400" />
        </span>
      )}
      {config.label}
    </span>
  );
}

interface HealthBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function HealthBadge({ status, size = 'md', className }: HealthBadgeProps) {
  const config = HEALTH_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className,
      )}
      role="status"
      aria-label={`Health: ${config.label}`}
    >
      <span className={config.color}>{config.label}</span>
    </span>
  );
}

interface TypeIconProps {
  type: DeploymentType;
  className?: string;
}

function TypeIcon({ type, className }: TypeIconProps) {
  const icons: Record<DeploymentType, React.ReactNode> = {
    service: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
    agent: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    workflow: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
      </svg>
    ),
    integration: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
      </svg>
    ),
  };

  return <>{icons[type]}</>;
}

// Utility functions
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
}

function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Icons
function LogsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function RestartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
