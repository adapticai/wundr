'use client';

import { useState, useCallback, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { SyncStatus, ConflictResolution } from '@/types/notification';

interface SyncStatusProps {
  status: SyncStatus;
  lastSynced?: Date | null;
  progress?: number;
  onManualSync?: () => Promise<void>;
  className?: string;
}

export function SyncStatusIndicator({
  status,
  lastSynced,
  progress,
  onManualSync,
  className,
}: SyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = useCallback(async () => {
    if (!onManualSync || isSyncing) {
return;
}
    setIsSyncing(true);
    try {
      await onManualSync();
    } finally {
      setIsSyncing(false);
    }
  }, [onManualSync, isSyncing]);

  const formattedLastSynced = useMemo(() => {
    if (!lastSynced) {
return null;
}
    return formatRelativeTime(lastSynced);
  }, [lastSynced]);

  const statusConfig = getStatusConfig(status);
  const isActuallySyncing = status === 'syncing' || isSyncing;

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm',
        className,
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        {isActuallySyncing ? (
          <SyncingIcon className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <StatusIcon status={status} />
        )}
        <span className={cn('font-medium', statusConfig.textColor)}>
          {isActuallySyncing ? 'Syncing...' : statusConfig.label}
        </span>
      </div>

      {/* Progress bar */}
      {isActuallySyncing && progress !== undefined && (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Last synced timestamp */}
      {formattedLastSynced && status === 'synced' && (
        <span className="text-xs text-muted-foreground">
          {formattedLastSynced}
        </span>
      )}

      {/* Manual sync button */}
      {onManualSync && !isActuallySyncing && (
        <button
          type="button"
          onClick={handleManualSync}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Sync now"
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface ConflictResolutionDialogProps {
  conflict: ConflictResolution;
  isOpen: boolean;
  onResolve: (resolution: 'local' | 'server' | 'merge') => void;
  onClose: () => void;
}

export function ConflictResolutionDialog({
  conflict,
  isOpen,
  onResolve,
  onClose,
}: ConflictResolutionDialogProps) {
  if (!isOpen) {
return null;
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={cn(
          'w-full max-w-lg rounded-lg bg-popover shadow-lg',
          'animate-in fade-in-0 zoom-in-95 duration-200',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-yellow-100 p-2 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
              <AlertIcon className="h-5 w-5" />
            </div>
            <h2 id="conflict-dialog-title" className="text-lg font-semibold">
              Sync Conflict Detected
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Changes were made both locally and on the server. Choose how to resolve this conflict:
          </p>

          <div className="grid gap-3">
            {/* Keep local changes */}
            <button
              type="button"
              onClick={() => onResolve('local')}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                'hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <DeviceIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Keep local changes</p>
                <p className="text-sm text-muted-foreground">
                  Use the version saved on this device
                </p>
              </div>
            </button>

            {/* Keep server changes */}
            <button
              type="button"
              onClick={() => onResolve('server')}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                'hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              <div className="rounded-full bg-green-100 p-2 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                <CloudIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Keep server changes</p>
                <p className="text-sm text-muted-foreground">
                  Use the version from the server
                </p>
              </div>
            </button>

            {/* Merge (if available) */}
            <button
              type="button"
              onClick={() => onResolve('merge')}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                'hover:bg-accent hover:border-accent-foreground/20',
              )}
            >
              <div className="rounded-full bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <MergeIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">Merge changes</p>
                <p className="text-sm text-muted-foreground">
                  Combine both versions (when possible)
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Conflict detected at {conflict.createdAt.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SyncStatusBadgeProps {
  status: SyncStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function SyncStatusBadge({ status, size = 'md', className }: SyncStatusBadgeProps) {
  const config = getStatusConfig(status);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bgColor,
        config.textColor,
        sizeClasses,
        className,
      )}
    >
      {status === 'syncing' ? (
        <SyncingIcon className="h-3 w-3 animate-spin" />
      ) : (
        <span className={cn('h-2 w-2 rounded-full', config.dotColor)} />
      )}
      {config.label}
    </span>
  );
}

function getStatusConfig(status: SyncStatus) {
  switch (status) {
    case 'syncing':
      return {
        label: 'Syncing',
        textColor: 'text-primary',
        bgColor: 'bg-primary/10',
        dotColor: 'bg-primary',
      };
    case 'synced':
      return {
        label: 'Synced',
        textColor: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        dotColor: 'bg-green-500',
      };
    case 'error':
      return {
        label: 'Sync error',
        textColor: 'text-destructive',
        bgColor: 'bg-destructive/10',
        dotColor: 'bg-destructive',
      };
    case 'conflict':
      return {
        label: 'Conflict',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        dotColor: 'bg-yellow-500',
      };
    case 'idle':
    default:
      return {
        label: 'Idle',
        textColor: 'text-muted-foreground',
        bgColor: 'bg-muted',
        dotColor: 'bg-muted-foreground',
      };
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffSecs < 60) {
return 'just now';
}
  if (diffMins < 60) {
return `${diffMins}m ago`;
}
  if (diffHours < 24) {
return `${diffHours}h ago`;
}
  return date.toLocaleDateString();
}

function StatusIcon({ status }: { status: SyncStatus }) {
  const config = getStatusConfig(status);

  switch (status) {
    case 'synced':
      return <CheckIcon className={cn('h-4 w-4', config.textColor)} />;
    case 'error':
      return <AlertIcon className={cn('h-4 w-4', config.textColor)} />;
    case 'conflict':
      return <AlertIcon className={cn('h-4 w-4', config.textColor)} />;
    default:
      return <CloudIcon className={cn('h-4 w-4', config.textColor)} />;
  }
}

// Icons
function SyncingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" x2="12.01" y1="18" y2="18" />
    </svg>
  );
}

function MergeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}
