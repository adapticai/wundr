'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

import { VPStatusBadge, VPStatusDot } from './vp-status-badge';

import type { VP } from '@/types/vp';

interface VPCardProps {
  vp: VP;
  workspaceId: string;
  onEdit?: (vp: VP) => void;
  onToggleStatus?: (vp: VP) => void;
  className?: string;
}

export function VPCard({
  vp,
  workspaceId,
  onEdit,
  onToggleStatus,
  className,
}: VPCardProps) {
  const lastActivityText = vp.lastActivityAt
    ? formatRelativeTime(new Date(vp.lastActivityAt))
    : 'No activity';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md',
        className,
      )}
    >
      {/* Header with Avatar and Status */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {vp.avatarUrl ? (
                <img
                  src={vp.avatarUrl}
                  alt={vp.title}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                getInitials(vp.title)
              )}
            </div>
            <VPStatusDot
              status={vp.status}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
            />
          </div>

          {/* Name and Discipline */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">{vp.title}</h3>
            {vp.discipline && (
              <p className="truncate text-sm text-muted-foreground">{vp.discipline}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <VPStatusBadge status={vp.status} size="sm" showPulse={false} />
      </div>

      {/* Description */}
      {vp.description && (
        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{vp.description}</p>
      )}

      {/* Stats */}
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MessageIcon className="h-4 w-4" />
          {vp.messageCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5">
          <AgentIcon className="h-4 w-4" />
          {vp.agentCount}
        </span>
        <span className="flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          {lastActivityText}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 border-t pt-4">
        <Link
          href={`/${workspaceId}/vps/${vp.id}`}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-center text-sm font-medium transition-colors hover:bg-accent"
        >
          View
        </Link>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(vp)}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Edit ${vp.title}`}
          >
            <EditIcon className="h-4 w-4" />
          </button>
        )}
        {onToggleStatus && (
          <button
            type="button"
            onClick={() => onToggleStatus(vp)}
            className={cn(
              'rounded-md border border-border bg-background p-1.5 transition-colors hover:bg-accent',
              vp.status === 'ACTIVE'
                ? 'text-green-600 hover:text-red-600'
                : 'text-muted-foreground hover:text-green-600',
            )}
            aria-label={vp.status === 'ACTIVE' ? `Deactivate ${vp.title}` : `Activate ${vp.title}`}
          >
            {vp.status === 'ACTIVE' ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function VPCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-5 shadow-sm">
      {/* Header Skeleton */}
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Description Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>

      {/* Stats Skeleton */}
      <div className="mb-4 flex items-center gap-4">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>

      {/* Actions Skeleton */}
      <div className="mt-auto flex items-center gap-2 border-t pt-4">
        <div className="h-8 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

// Utility functions
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
return 'Just now';
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

// Icons
function MessageIcon({ className }: { className?: string }) {
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
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function AgentIcon({ className }: { className?: string }) {
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
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
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

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
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
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
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
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
