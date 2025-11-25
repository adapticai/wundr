'use client';

import { cn } from '@/lib/utils';
import { WORKFLOW_STATUS_CONFIG, TRIGGER_TYPE_CONFIG } from '@/types/workflow';

import type { Workflow, WorkflowStatus, TriggerType } from '@/types/workflow';

export interface WorkflowCardProps {
  workflow: Workflow;
  onRun: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

export function WorkflowCard({
  workflow,
  onRun,
  onEdit,
  onToggle,
  onDelete,
  isLoading = false,
  compact = false,
}: WorkflowCardProps) {
  const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];
  const lastRunText = workflow.lastRunAt
    ? formatRelativeTime(new Date(workflow.lastRunAt))
    : 'Never';

  if (compact) {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm',
          isLoading && 'pointer-events-none opacity-60',
        )}
      >
        {/* Trigger Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <TriggerIcon type={workflow.trigger.type} className="h-5 w-5 text-primary" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{workflow.name}</h3>
            <WorkflowStatusBadge status={workflow.status} size="sm" />
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{triggerConfig.label}</span>
            <span>|</span>
            <span>{workflow.actions.length} actions</span>
            <span>|</span>
            <span>Last run: {lastRunText}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ToggleSwitch
            checked={workflow.status === 'active'}
            onChange={onToggle}
            disabled={isLoading || workflow.status === 'draft'}
          />
          <button
            type="button"
            onClick={onRun}
            disabled={isLoading || workflow.status !== 'active'}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Run workflow"
          >
            <PlayIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isLoading}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Edit workflow"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading}
            className="rounded-md p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            aria-label="Delete workflow"
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
          {/* Trigger Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <TriggerIcon type={workflow.trigger.type} className="h-6 w-6 text-primary" />
          </div>

          {/* Name and Trigger */}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading font-semibold text-foreground">{workflow.name}</h3>
            <p className="truncate text-sm font-sans text-muted-foreground">{triggerConfig.label}</p>
          </div>
        </div>

        {/* Status Badge */}
        <WorkflowStatusBadge status={workflow.status} />
      </div>

      {/* Description */}
      {workflow.description && (
        <p className="mb-4 line-clamp-2 text-sm font-sans text-muted-foreground">
          {workflow.description}
        </p>
      )}

      {/* Trigger -> Actions Flow */}
      <div className="mb-4 flex items-center gap-2 rounded-md bg-muted/50 p-3">
        <div className="flex items-center gap-1.5 rounded bg-background px-2 py-1 text-xs font-medium">
          <TriggerIcon type={workflow.trigger.type} className="h-3.5 w-3.5" />
          <span>{triggerConfig.label}</span>
        </div>
        <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />
        <div className="flex items-center gap-1 overflow-hidden">
          {workflow.actions.slice(0, 3).map((action, index) => (
            <div
              key={action.id}
              className="flex items-center gap-1 rounded bg-background px-2 py-1 text-xs"
            >
              <span className="truncate max-w-[80px]">
                {index + 1}. {action.type.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
          {workflow.actions.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{workflow.actions.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <RunIcon className="h-4 w-4" />
          <span>{workflow.runCount} runs</span>
        </div>
        {workflow.errorCount > 0 && (
          <div className="flex items-center gap-1.5 text-destructive">
            <ErrorIcon className="h-4 w-4" />
            <span>{workflow.errorCount} errors</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <ClockIcon className="h-4 w-4" />
          <span>Last: {lastRunText}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <ToggleSwitch
          checked={workflow.status === 'active'}
          onChange={onToggle}
          disabled={isLoading || workflow.status === 'draft'}
          label={workflow.status === 'active' ? 'Active' : 'Inactive'}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={isLoading || workflow.status !== 'active'}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
            aria-label="Run workflow"
          >
            <PlayIcon className="h-4 w-4" />
            Run
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={isLoading}
            className="rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Edit workflow"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading}
            className="rounded-md border border-border bg-background p-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            aria-label="Delete workflow"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowCardSkeleton() {
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
        <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
      </div>

      {/* Description Skeleton */}
      <div className="mb-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      </div>

      {/* Flow Skeleton */}
      <div className="mb-4 h-12 animate-pulse rounded-md bg-muted" />

      {/* Stats Skeleton */}
      <div className="mb-4 flex items-center gap-4">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>

      {/* Actions Skeleton */}
      <div className="mt-auto flex items-center justify-between border-t pt-4">
        <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function WorkflowStatusBadge({
  status,
  size = 'md',
  className,
}: WorkflowStatusBadgeProps) {
  const config = WORKFLOW_STATUS_CONFIG[status];

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
      {status === 'active' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
      {status === 'draft' && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      )}
      {status === 'error' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
        </span>
      )}
      {status === 'inactive' && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-600" />
        </span>
      )}
      {config.label}
    </span>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'group inline-flex items-center gap-2',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </button>
  );
}

interface TriggerIconProps {
  type: TriggerType;
  className?: string;
}

function TriggerIcon({ type, className }: TriggerIconProps) {
  const icons: Record<TriggerType, React.ReactNode> = {
    schedule: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    message: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    keyword: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <path d="M7 7h.01" />
      </svg>
    ),
    channel_join: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    channel_leave: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
    user_join: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <polyline points="16 11 18 13 22 9" />
      </svg>
    ),
    reaction: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    ),
    mention: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
    webhook: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
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
function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function RunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
