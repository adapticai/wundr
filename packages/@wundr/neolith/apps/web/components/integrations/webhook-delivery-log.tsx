'use client';

import { useState, useMemo, useCallback } from 'react';

import { cn } from '@/lib/utils';
import { WEBHOOK_EVENTS } from '@/types/integration';

import type { WebhookDelivery, WebhookDeliveryStatus } from '@/types/integration';

/**
 * Props for the WebhookDeliveryLog component
 */
export interface WebhookDeliveryLogProps {
  /** Array of webhook delivery records */
  deliveries: WebhookDelivery[];
  /** Loading state for the log */
  isLoading?: boolean;
  /** Callback fired when retrying a failed delivery */
  onRetry: (delivery: WebhookDelivery) => Promise<void>;
  /** Callback to load more deliveries (pagination) */
  onLoadMore?: () => void;
  /** Whether there are more deliveries to load */
  hasMore?: boolean;
  /** Additional CSS class names */
  className?: string;
}

const STATUS_CONFIG: Record<
  WebhookDeliveryStatus,
  { label: string; color: string; bgColor: string; icon: React.FC<{ className?: string }> }
> = {
  success: {
    label: 'Success',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    icon: CheckIcon,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    icon: XIcon,
  },
  pending: {
    label: 'Pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-500/10',
    icon: ClockIcon,
  },
  retrying: {
    label: 'Retrying',
    color: 'text-stone-600',
    bgColor: 'bg-stone-500/10',
    icon: RefreshIcon,
  },
};

export function WebhookDeliveryLog({
  deliveries,
  isLoading = false,
  onRetry,
  onLoadMore,
  hasMore = false,
  className,
}: WebhookDeliveryLogProps) {
  const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      // Status filter
      if (statusFilter !== 'all' && delivery.status !== statusFilter) {
        return false;
      }

      // Date filter
      if (dateRange !== 'all') {
        const deliveryDate = new Date(delivery.timestamp);
        const now = new Date();
        let startDate: Date;

        switch (dateRange) {
          case 'today': {
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            startDate = todayStart;
            break;
          }
          case 'week': {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - 7);
            startDate = weekStart;
            break;
          }
          case 'month': {
            const monthStart = new Date(now);
            monthStart.setMonth(monthStart.getMonth() - 1);
            startDate = monthStart;
            break;
          }
        }

        if (deliveryDate < startDate) {
          return false;
        }
      }

      return true;
    });
  }, [deliveries, statusFilter, dateRange]);

  // Stats
  const stats = useMemo(() => {
    const total = deliveries.length;
    const success = deliveries.filter((d) => d.status === 'success').length;
    const failed = deliveries.filter((d) => d.status === 'failed').length;
    const pending = deliveries.filter((d) => d.status === 'pending' || d.status === 'retrying').length;
    const successRate = total > 0 ? (success / total) * 100 : 0;

    return { total, success, failed, pending, successRate };
  }, [deliveries]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (isLoading && deliveries.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between items-center">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <DeliveryItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Stats and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {stats.total} deliveries
          </span>
          <span className="text-green-600">{stats.success} success</span>
          <span className="text-red-600">{stats.failed} failed</span>
          {stats.pending > 0 && (
            <span className="text-yellow-600">{stats.pending} pending</span>
          )}
          <span
            className={cn(
              'font-medium',
              stats.successRate >= 95
                ? 'text-green-600'
                : stats.successRate >= 80
                  ? 'text-yellow-600'
                  : 'text-red-600',
            )}
          >
            {stats.successRate.toFixed(1)}% success rate
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="retrying">Retrying</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by date"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      {filteredDeliveries.length === 0 ? (
        <EmptyState statusFilter={statusFilter} />
      ) : (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          {/* Delivery Items */}
          <div className="space-y-3">
            {filteredDeliveries.map((delivery) => (
              <DeliveryItem
                key={delivery.id}
                delivery={delivery}
                isExpanded={expandedId === delivery.id}
                onToggle={() => handleToggleExpand(delivery.id)}
                onRetry={() => onRetry(delivery)}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isLoading}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DeliveryItemProps {
  delivery: WebhookDelivery;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
}

function DeliveryItem({ delivery, isExpanded, onToggle, onRetry }: DeliveryItemProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const statusConfig = STATUS_CONFIG[delivery.status];
  const StatusIcon = statusConfig.icon;

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  return (
    <div className="relative pl-10">
      {/* Timeline Dot */}
      <div
        className={cn(
          'absolute left-3 top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card',
          statusConfig.bgColor,
        )}
      >
        <StatusIcon className={cn('h-2.5 w-2.5', statusConfig.color)} />
      </div>

      {/* Card */}
      <div className="rounded-lg border bg-card shadow-sm">
        {/* Header */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Event Badge */}
            <span className="shrink-0 inline-flex rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {WEBHOOK_EVENTS[delivery.event]?.label || delivery.event}
            </span>

            {/* Timestamp */}
            <span className="text-sm text-muted-foreground">
              {new Date(delivery.timestamp).toLocaleString()}
            </span>

            {/* Duration */}
            {delivery.duration && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {delivery.duration}ms
              </span>
            )}

            {/* Response Code */}
            {delivery.response && (
              <span
                className={cn(
                  'hidden sm:inline text-sm font-mono',
                  delivery.response.statusCode >= 200 && delivery.response.statusCode < 300
                    ? 'text-green-600'
                    : 'text-red-600',
                )}
              >
                {delivery.response.statusCode}
              </span>
            )}
          </div>

          {/* Status & Expand */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                statusConfig.bgColor,
                statusConfig.color,
              )}
            >
              {statusConfig.label}
            </span>
            <ChevronIcon
              className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
            />
          </div>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t bg-muted/30 p-4 space-y-4">
            {/* Request Details */}
            <div>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Request
              </h5>
              <div className="rounded-md bg-background border p-3 font-mono text-xs overflow-x-auto">
                <p className="text-muted-foreground mb-1">
                  POST {delivery.request.url}
                </p>
                {Object.entries(delivery.request.headers).slice(0, 3).map(([key, value]) => (
                  <p key={key} className="text-muted-foreground">
                    {key}: {value}
                  </p>
                ))}
                <pre className="mt-2 text-foreground whitespace-pre-wrap break-all">
                  {formatJSON(delivery.request.body)}
                </pre>
              </div>
            </div>

            {/* Response Details */}
            {delivery.response && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Response
                </h5>
                <div className="rounded-md bg-background border p-3 font-mono text-xs overflow-x-auto">
                  <p
                    className={cn(
                      'mb-1',
                      delivery.response.statusCode >= 200 && delivery.response.statusCode < 300
                        ? 'text-green-600'
                        : 'text-red-600',
                    )}
                  >
                    HTTP {delivery.response.statusCode}
                  </p>
                  {delivery.response.body && (
                    <pre className="mt-2 text-foreground whitespace-pre-wrap break-all">
                      {formatJSON(delivery.response.body)}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {delivery.error && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Error
                </h5>
                <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-600">
                  {delivery.error}
                </div>
              </div>
            )}

            {/* Retry Info & Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                {delivery.retryCount > 0 && (
                  <span>Retried {delivery.retryCount} time(s)</span>
                )}
                {delivery.nextRetryAt && (
                  <span className="ml-2">
                    Next retry: {new Date(delivery.nextRetryAt).toLocaleString()}
                  </span>
                )}
              </div>
              {delivery.status === 'failed' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isRetrying ? (
                    <>
                      <LoadingSpinner className="h-3 w-3" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshIcon className="h-3 w-3" />
                      Retry
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryItemSkeleton() {
  return (
    <div className="relative pl-10">
      <div className="absolute left-3 top-4 h-4 w-4 animate-pulse rounded-full bg-muted" />
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="flex-1" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  statusFilter: string;
}

function EmptyState({ statusFilter }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12">
      <HistoryIcon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">No deliveries found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {statusFilter !== 'all'
          ? 'Try adjusting your filters to see more results.'
          : 'Webhook deliveries will appear here when events are triggered.'}
      </p>
    </div>
  );
}

// Utility functions
function formatJSON(str: string): string {
  try {
    const obj = JSON.parse(str);
    return JSON.stringify(obj, null, 2);
  } catch {
    return str;
  }
}

// Icons
function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function RefreshIcon({ className }: { className?: string }) {
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

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
