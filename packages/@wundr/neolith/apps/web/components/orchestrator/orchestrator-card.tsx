'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

import { OrchestratorStatusBadge, OrchestratorStatusDot } from './orchestrator-status-badge';

import type { Orchestrator } from '@/types/orchestrator';

interface OrchestratorCardProps {
  orchestrator: Orchestrator;
  workspaceId: string;
  onEdit?: (orchestrator: Orchestrator) => void;
  onEditWithAI?: (orchestrator: Orchestrator) => void;
  onToggleStatus?: (orchestrator: Orchestrator) => void;
  className?: string;
}

export function OrchestratorCard({
  orchestrator,
  workspaceId,
  onEdit,
  onEditWithAI,
  onToggleStatus,
  className,
}: OrchestratorCardProps) {
  const lastActivityText = orchestrator.lastActivityAt
    ? formatRelativeTime(new Date(orchestrator.lastActivityAt))
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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
              {orchestrator.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orchestrator.avatarUrl}
                  alt={orchestrator.title}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                getInitials(orchestrator.title)
              )}
            </div>
            <OrchestratorStatusDot
              status={orchestrator.status}
              size="sm"
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
            />
          </div>

          {/* Name and Discipline */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading font-semibold text-foreground">{orchestrator.title}</h3>
            {orchestrator.discipline && (
              <p className="truncate text-sm font-sans text-muted-foreground">{orchestrator.discipline}</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <OrchestratorStatusBadge status={orchestrator.status} size="sm" showPulse={false} />
      </div>

      {/* Description */}
      {orchestrator.description && (
        <p className="mb-4 line-clamp-2 text-sm font-sans text-muted-foreground">{orchestrator.description}</p>
      )}

      {/* Stats */}
      <div className="mb-4 flex items-center gap-4 text-sm font-sans text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MessageIcon className="h-4 w-4" />
          {orchestrator.messageCount.toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5">
          <AgentIcon className="h-4 w-4" />
          {orchestrator.agentCount}
        </span>
        <span className="flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          {lastActivityText}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-2 border-t pt-4">
        <Link
          href={`/${workspaceId}/orchestrators/${orchestrator.id}`}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-center text-sm font-sans font-medium transition-colors hover:bg-accent"
        >
          View
        </Link>
        {onEditWithAI && (
          <button
            type="button"
            onClick={() => onEditWithAI(orchestrator)}
            className="rounded-md border border-primary/20 bg-primary/5 p-1.5 text-primary transition-colors hover:bg-primary/10 hover:border-primary/30"
            aria-label={`Edit ${orchestrator.title} with AI`}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(orchestrator)}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Edit ${orchestrator.title}`}
          >
            <EditIcon className="h-4 w-4" />
          </button>
        )}
        {onToggleStatus && (
          <button
            type="button"
            onClick={() => onToggleStatus(orchestrator)}
            className={cn(
              'rounded-md border border-border bg-background p-1.5 transition-colors hover:bg-accent',
              orchestrator.status === 'ONLINE'
                ? 'text-emerald-600 hover:text-rose-600 dark:text-emerald-400 dark:hover:text-rose-400'
                : 'text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400',
            )}
            aria-label={orchestrator.status === 'ONLINE' ? `Set ${orchestrator.title} Offline` : `Set ${orchestrator.title} Online`}
          >
            {orchestrator.status === 'ONLINE' ? (
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

export function OrchestratorCardSkeleton() {
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
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

// Backwards compatibility exports
export const VPCard = OrchestratorCard;
export const VPCardSkeleton = OrchestratorCardSkeleton;

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
