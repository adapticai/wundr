'use client';

import { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { WEBHOOK_EVENTS, INTEGRATION_STATUS_CONFIG } from '@/types/integration';

import type { Webhook } from '@/types/integration';

/**
 * Props for the WebhookList component
 */
export interface WebhookListProps {
  /** Array of webhooks to display */
  webhooks: Webhook[];
  /** Loading state for the list */
  isLoading?: boolean;
  /** Callback fired when testing a webhook */
  onTest: (webhook: Webhook) => void;
  /** Callback fired when editing a webhook */
  onEdit: (webhook: Webhook) => void;
  /** Callback fired when deleting a webhook */
  onDelete: (webhook: Webhook) => void;
  /** Callback to open the add webhook dialog */
  onAdd?: () => void;
  /** Additional CSS class names */
  className?: string;
}

export function WebhookList({
  webhooks,
  isLoading = false,
  onTest,
  onEdit,
  onDelete,
  onAdd,
  className,
}: WebhookListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive' | 'error'
  >('all');

  // Filter webhooks
  const filteredWebhooks = useMemo(() => {
    return webhooks.filter(webhook => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          webhook.name.toLowerCase().includes(query) ||
          webhook.url.toLowerCase().includes(query);
        if (!matchesSearch) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && webhook.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [webhooks, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Header Skeleton */}
        <div className='flex flex-wrap items-center gap-4'>
          <div className='h-10 flex-1 min-w-[200px] animate-pulse rounded-md bg-muted' />
          <div className='h-10 w-32 animate-pulse rounded-md bg-muted' />
          <div className='h-10 w-28 animate-pulse rounded-md bg-muted' />
        </div>

        {/* List Skeleton */}
        <div className='space-y-3'>
          {[...Array(3)].map((_, i) => (
            <WebhookItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className='flex flex-wrap items-center gap-4'>
        {/* Search */}
        <div className='relative flex-1 min-w-[200px]'>
          <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            placeholder='Search webhooks...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className='h-10 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
          aria-label='Filter by status'
        >
          <option value='all'>All Status</option>
          <option value='active'>Active</option>
          <option value='inactive'>Inactive</option>
          <option value='error'>Error</option>
        </select>

        {/* Add Button */}
        {onAdd && (
          <button
            type='button'
            onClick={onAdd}
            className='flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
          >
            <PlusIcon className='h-4 w-4' />
            Add Webhook
          </button>
        )}
      </div>

      {/* Webhook List */}
      {filteredWebhooks.length === 0 ? (
        <EmptyState
          hasFilters={searchQuery.trim() !== '' || statusFilter !== 'all'}
          onAdd={onAdd}
        />
      ) : (
        <div className='space-y-3'>
          {filteredWebhooks.map(webhook => (
            <WebhookItem
              key={webhook.id}
              webhook={webhook}
              onTest={() => onTest(webhook)}
              onEdit={() => onEdit(webhook)}
              onDelete={() => onDelete(webhook)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WebhookItemProps {
  webhook: Webhook;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function WebhookItem({ webhook, onTest, onEdit, onDelete }: WebhookItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusConfig = INTEGRATION_STATUS_CONFIG[webhook.status];
  const lastTriggeredText = webhook.lastTriggeredAt
    ? formatRelativeTime(new Date(webhook.lastTriggeredAt))
    : 'Never';

  // Mask URL for display
  const maskedUrl = useMemo(() => {
    try {
      const url = new URL(webhook.url);
      return `${url.protocol}//${url.hostname}/...`;
    } catch {
      return webhook.url.slice(0, 30) + '...';
    }
  }, [webhook.url]);

  return (
    <div className='rounded-lg border bg-card shadow-sm transition-all hover:shadow-md'>
      {/* Main Row */}
      <div className='flex items-center justify-between p-4'>
        <div className='flex items-center gap-4 min-w-0 flex-1'>
          {/* Expand Button */}
          <button
            type='button'
            onClick={() => setIsExpanded(!isExpanded)}
            className='shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground'
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <ChevronIcon
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>

          {/* Webhook Icon */}
          <div className='shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary'>
            <WebhookIcon className='h-5 w-5' />
          </div>

          {/* Name and URL */}
          <div className='min-w-0 flex-1'>
            <h4 className='truncate font-medium text-foreground'>
              {webhook.name}
            </h4>
            <p className='truncate text-sm text-muted-foreground font-mono'>
              {maskedUrl}
            </p>
          </div>

          {/* Status Badge */}
          <span
            className={cn(
              'shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {webhook.status === 'active' && (
              <span className='relative flex h-2 w-2'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75' />
                <span className='relative inline-flex h-2 w-2 rounded-full bg-green-500' />
              </span>
            )}
            {statusConfig.label}
          </span>

          {/* Success Rate */}
          <div className='shrink-0 text-right'>
            <p
              className={cn(
                'text-sm font-medium',
                webhook.deliverySuccessRate >= 95
                  ? 'text-green-600'
                  : webhook.deliverySuccessRate >= 80
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            >
              {webhook.deliverySuccessRate.toFixed(1)}%
            </p>
            <p className='text-xs text-muted-foreground'>Success rate</p>
          </div>

          {/* Last Triggered */}
          <div className='shrink-0 hidden sm:block text-right'>
            <p className='text-sm text-foreground'>{lastTriggeredText}</p>
            <p className='text-xs text-muted-foreground'>Last triggered</p>
          </div>
        </div>

        {/* Actions */}
        <div className='flex items-center gap-1 ml-4'>
          <button
            type='button'
            onClick={onTest}
            className='rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
            title='Test webhook'
          >
            <PlayIcon className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={onEdit}
            className='rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
            title='Edit webhook'
          >
            <EditIcon className='h-4 w-4' />
          </button>
          <button
            type='button'
            onClick={onDelete}
            className='rounded-md p-2 text-red-500 transition-colors hover:bg-red-500/10'
            title='Delete webhook'
          >
            <TrashIcon className='h-4 w-4' />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className='border-t bg-muted/30 px-4 py-3'>
          <div className='grid gap-4 sm:grid-cols-2'>
            {/* Events */}
            <div>
              <h5 className='text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2'>
                Subscribed Events
              </h5>
              <div className='flex flex-wrap gap-1'>
                {webhook.events.map(event => (
                  <span
                    key={event}
                    className='inline-flex rounded bg-background px-2 py-0.5 text-xs text-foreground'
                  >
                    {WEBHOOK_EVENTS[event]?.label || event}
                  </span>
                ))}
              </div>
            </div>

            {/* Retry Policy */}
            <div>
              <h5 className='text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2'>
                Retry Policy
              </h5>
              <p className='text-sm text-foreground'>
                Max {webhook.retryPolicy.maxRetries} retries
                {webhook.retryPolicy.exponentialBackoff &&
                  ' with exponential backoff'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WebhookItemSkeleton() {
  return (
    <div className='rounded-lg border bg-card p-4 shadow-sm'>
      <div className='flex items-center gap-4'>
        <div className='h-4 w-4 animate-pulse rounded bg-muted' />
        <div className='h-10 w-10 animate-pulse rounded-lg bg-muted' />
        <div className='flex-1 space-y-2'>
          <div className='h-5 w-40 animate-pulse rounded bg-muted' />
          <div className='h-4 w-32 animate-pulse rounded bg-muted' />
        </div>
        <div className='h-6 w-16 animate-pulse rounded-full bg-muted' />
        <div className='space-y-1'>
          <div className='h-4 w-12 animate-pulse rounded bg-muted' />
          <div className='h-3 w-16 animate-pulse rounded bg-muted' />
        </div>
        <div className='flex gap-1'>
          <div className='h-8 w-8 animate-pulse rounded bg-muted' />
          <div className='h-8 w-8 animate-pulse rounded bg-muted' />
          <div className='h-8 w-8 animate-pulse rounded bg-muted' />
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  hasFilters: boolean;
  onAdd?: () => void;
}

function EmptyState({ hasFilters, onAdd }: EmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12'>
      <WebhookIcon className='h-12 w-12 text-muted-foreground' />
      <h3 className='mt-4 text-lg font-semibold text-foreground'>
        {hasFilters ? 'No webhooks found' : 'No webhooks yet'}
      </h3>
      <p className='mt-2 text-sm text-muted-foreground'>
        {hasFilters
          ? 'Try adjusting your filters to find what you are looking for.'
          : 'Create your first webhook to receive real-time events.'}
      </p>
      {onAdd && !hasFilters && (
        <button
          type='button'
          onClick={onAdd}
          className='mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <PlusIcon className='h-4 w-4' />
          Add Webhook
        </button>
      )}
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
function SearchIcon({ className }: { className?: string }) {
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
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.3-4.3' />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d='M5 12h14' />
      <path d='M12 5v14' />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d='m9 18 6-6-6-6' />
    </svg>
  );
}

function WebhookIcon({ className }: { className?: string }) {
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
      <path d='M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2' />
      <path d='m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06' />
      <path d='m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8' />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
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
      <polygon points='6 3 20 12 6 21 6 3' />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d='M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' />
      <path d='m15 5 4 4' />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d='M3 6h18' />
      <path d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' />
      <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
    </svg>
  );
}
