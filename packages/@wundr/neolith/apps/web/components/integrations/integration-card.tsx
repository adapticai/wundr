'use client';

import { cn } from '@/lib/utils';
import {
  INTEGRATION_PROVIDERS,
  INTEGRATION_STATUS_CONFIG,
} from '@/types/integration';

import type {
  IntegrationConfig,
  IntegrationProvider,
  IntegrationStatus,
} from '@/types/integration';

/**
 * Props for the IntegrationCard component
 */
export interface IntegrationCardProps {
  /** The integration configuration data */
  integration: IntegrationConfig;
  /** Callback fired when testing the integration */
  onTest: () => void;
  /** Callback fired when syncing the integration */
  onSync: () => void;
  /** Callback to open integration settings */
  onSettings: () => void;
  /** Callback to disconnect the integration */
  onDisconnect: () => void;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}

export function IntegrationCard({
  integration,
  onTest,
  onSync,
  onSettings,
  onDisconnect,
  isLoading = false,
}: IntegrationCardProps) {
  const provider = INTEGRATION_PROVIDERS[integration.provider];
  const lastSyncText = integration.lastSyncAt
    ? formatRelativeTime(new Date(integration.lastSyncAt))
    : 'Never synced';

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-lg border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md',
        isLoading && 'pointer-events-none opacity-60',
      )}
    >
      {/* Header with Icon and Status */}
      <div className='mb-4 flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          {/* Provider Icon */}
          <ProviderIcon provider={integration.provider} className='h-12 w-12' />

          {/* Name and Provider */}
          <div className='min-w-0 flex-1'>
            <h3 className='truncate font-semibold text-foreground'>
              {integration.name}
            </h3>
            <p className='truncate text-sm text-muted-foreground'>
              {provider.name}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <IntegrationStatusBadge status={integration.status} />
      </div>

      {/* Description */}
      {integration.description && (
        <p className='mb-4 line-clamp-2 text-sm text-muted-foreground'>
          {integration.description}
        </p>
      )}

      {/* Error Message */}
      {integration.status === 'error' && integration.errorMessage && (
        <div className='mb-4 rounded-md bg-red-500/10 p-2 text-xs text-red-600'>
          {integration.errorMessage}
        </div>
      )}

      {/* Last Sync Info */}
      <div className='mb-4 flex items-center gap-2 text-sm text-muted-foreground'>
        <SyncIcon className='h-4 w-4' />
        <span>Last sync: {lastSyncText}</span>
      </div>

      {/* Actions */}
      <div className='mt-auto flex items-center gap-2 border-t pt-4'>
        <button
          type='button'
          onClick={onTest}
          disabled={isLoading}
          className='flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-center text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
          aria-label='Test integration'
        >
          Test
        </button>
        <button
          type='button'
          onClick={onSync}
          disabled={isLoading || integration.status === 'inactive'}
          className='rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50'
          aria-label='Sync integration'
        >
          <RefreshIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </button>
        <button
          type='button'
          onClick={onSettings}
          disabled={isLoading}
          className='rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50'
          aria-label='Integration settings'
        >
          <SettingsIcon className='h-4 w-4' />
        </button>
        <button
          type='button'
          onClick={onDisconnect}
          disabled={isLoading}
          className='rounded-md border border-border bg-background p-1.5 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50'
          aria-label='Disconnect integration'
        >
          <DisconnectIcon className='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}

export function IntegrationCardSkeleton() {
  return (
    <div className='flex flex-col rounded-lg border bg-card p-5 shadow-sm'>
      {/* Header Skeleton */}
      <div className='mb-4 flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          <div className='h-12 w-12 animate-pulse rounded-lg bg-muted' />
          <div className='space-y-2'>
            <div className='h-5 w-32 animate-pulse rounded bg-muted' />
            <div className='h-4 w-20 animate-pulse rounded bg-muted' />
          </div>
        </div>
        <div className='h-6 w-16 animate-pulse rounded-full bg-muted' />
      </div>

      {/* Description Skeleton */}
      <div className='mb-4 space-y-2'>
        <div className='h-4 w-full animate-pulse rounded bg-muted' />
        <div className='h-4 w-2/3 animate-pulse rounded bg-muted' />
      </div>

      {/* Sync Info Skeleton */}
      <div className='mb-4 flex items-center gap-2'>
        <div className='h-4 w-4 animate-pulse rounded bg-muted' />
        <div className='h-4 w-24 animate-pulse rounded bg-muted' />
      </div>

      {/* Actions Skeleton */}
      <div className='mt-auto flex items-center gap-2 border-t pt-4'>
        <div className='h-8 flex-1 animate-pulse rounded-md bg-muted' />
        <div className='h-8 w-8 animate-pulse rounded-md bg-muted' />
        <div className='h-8 w-8 animate-pulse rounded-md bg-muted' />
        <div className='h-8 w-8 animate-pulse rounded-md bg-muted' />
      </div>
    </div>
  );
}

interface IntegrationStatusBadgeProps {
  status: IntegrationStatus;
  className?: string;
}

export function IntegrationStatusBadge({
  status,
  className,
}: IntegrationStatusBadgeProps) {
  const config = INTEGRATION_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
        className,
      )}
      role='status'
      aria-label={`Status: ${config.label}`}
    >
      {status === 'active' && (
        <span className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-green-500' />
        </span>
      )}
      {status === 'pending' && (
        <span className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-pulse rounded-full bg-yellow-400 opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-yellow-500' />
        </span>
      )}
      {status === 'error' && (
        <span className='relative flex h-2 w-2'>
          <span className='relative inline-flex h-2 w-2 rounded-full bg-red-500' />
        </span>
      )}
      {status === 'inactive' && (
        <span className='relative flex h-2 w-2'>
          <span className='relative inline-flex h-2 w-2 rounded-full bg-gray-400' />
        </span>
      )}
      {config.label}
    </span>
  );
}

interface ProviderIconProps {
  provider: IntegrationProvider;
  className?: string;
}

function ProviderIcon({ provider, className }: ProviderIconProps) {
  const config = INTEGRATION_PROVIDERS[provider];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary',
        className,
      )}
    >
      {config.icon}
    </div>
  );
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
function SyncIcon({ className }: { className?: string }) {
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
      <path d='M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' />
      <path d='M3 3v5h5' />
      <path d='M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' />
      <path d='M16 16h5v5' />
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

function SettingsIcon({ className }: { className?: string }) {
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
      <path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  );
}

function DisconnectIcon({ className }: { className?: string }) {
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
      <path d='m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71' />
      <path d='m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71' />
      <line x1='8' y1='2' x2='8' y2='5' />
      <line x1='2' y1='8' x2='5' y2='8' />
      <line x1='16' y1='19' x2='16' y2='22' />
      <line x1='19' y1='16' x2='22' y2='16' />
    </svg>
  );
}
