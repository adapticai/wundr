'use client';

import {
  Activity,
  Calendar,
  CheckCircle,
  FileText,
  Hash,
  MessageSquare,
  UserPlus,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { useActivity } from '@/hooks/use-activity';
import { cn } from '@/lib/utils';

import type { ActivityEntry, ActivityType } from '@/hooks/use-activity';

/**
 * Activity Feed Page
 *
 * Displays a chronological feed of workspace activities with filtering
 * and pagination capabilities.
 */
export default function ActivityPage() {
  const params = useParams();
  const workspaceId = params?.workspaceId as string;

  // State
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Calculate date range
  const dateFilter = useMemo(() => {
    const now = new Date();
    let dateFrom: string | undefined;

    switch (dateRange) {
      case 'today':
        dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        break;
      case 'week':
        dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case 'month':
        dateFrom = new Date(now.setDate(now.getDate() - 30)).toISOString();
        break;
      default:
        dateFrom = undefined;
    }

    return dateFrom;
  }, [dateRange]);

  // Fetch activities
  const { activities, isLoading, error, loadMore, hasMore, refresh } = useActivity(
    workspaceId,
    {
      type: typeFilter,
      dateFrom: dateFilter,
      limit: 20,
    },
  );

  // Activity type counts
  const activityCounts = useMemo(() => {
    const counts: Record<ActivityType, number> = {
      all: activities.length,
      message: 0,
      task: 0,
      workflow: 0,
      member: 0,
      file: 0,
      channel: 0,
    };

    activities.forEach((activity) => {
      if (activity.type !== 'all') {
        counts[activity.type]++;
      }
    });

    return counts;
  }, [activities]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Feed</h1>
          <p className="text-sm text-muted-foreground">
            Track all workspace activities in one place
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <RefreshIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Activity Type Filter */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">Type:</span>
          {(
            [
              { key: 'all', label: 'All', icon: Activity },
              { key: 'message', label: 'Messages', icon: MessageSquare },
              { key: 'task', label: 'Tasks', icon: CheckCircle },
              { key: 'workflow', label: 'Workflows', icon: WorkflowIcon },
              { key: 'member', label: 'Members', icon: UserPlus },
              { key: 'file', label: 'Files', icon: FileText },
              { key: 'channel', label: 'Channels', icon: Hash },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-xs',
                  typeFilter === key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-background text-muted-foreground',
                )}
              >
                {activityCounts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-muted-foreground">Time:</span>
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Past Week' },
              { key: 'month', label: 'Past Month' },
              { key: 'all', label: 'All Time' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDateRange(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                dateRange === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertIcon className="h-5 w-5" />
            <p className="text-sm font-medium">Failed to load activities</p>
          </div>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error.message}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && activities.length === 0 && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && activities.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No Activity Yet"
          description={
            typeFilter === 'all'
              ? 'Activity will appear here as your team works in this workspace.'
              : `No ${typeFilter} activities found for the selected time period. Try adjusting your filters.`
          }
          action={{
            label: 'Clear Filters',
            onClick: () => {
              setTypeFilter('all');
              setDateRange('all');
            },
            variant: 'outline',
          }}
        />
      )}

      {/* Activity List */}
      {!isLoading && !error && activities.length > 0 && (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={loadMore}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Activity Card Component
 */
interface ActivityCardProps {
  activity: ActivityEntry;
}

function ActivityCard({ activity }: ActivityCardProps) {
  const icon = getActivityIcon(activity.type);
  const Icon = icon.component;

  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
      <div className="flex gap-4">
        {/* Icon & Avatar */}
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              icon.bgColor,
            )}
          >
            <Icon className={cn('h-5 w-5', icon.color)} />
          </div>
          {activity.actor.avatarUrl ? (
            <img
              src={activity.actor.avatarUrl}
              alt={activity.actor.displayName || activity.actor.name || 'User'}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <span className="text-xs font-medium text-muted-foreground">
                {(activity.actor.displayName || activity.actor.name || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold">
                  {activity.actor.displayName || activity.actor.name || 'Unknown user'}
                </span>
                {activity.actor.isOrchestrator && (
                  <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                    AI
                  </span>
                )}
                <span className="text-muted-foreground"> {activity.action} </span>
                {activity.target && (
                  <>
                    <span className="text-muted-foreground">
                      {getTargetTypeLabel(activity.target.type)}
                    </span>
                    <span className="font-medium"> {activity.target.name}</span>
                  </>
                )}
              </p>
            </div>
            <time
              className="whitespace-nowrap text-xs text-muted-foreground"
              dateTime={activity.timestamp}
            >
              {formatRelativeTime(activity.timestamp)}
            </time>
          </div>

          {/* Content Preview */}
          {activity.content && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {activity.content}
            </p>
          )}

          {/* Metadata Tags */}
          {Object.keys(activity.metadata).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {renderMetadataTags(activity)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Activity Card Skeleton
 */
function ActivityCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="h-8 w-8 rounded-full bg-muted" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Get activity icon configuration
 */
function getActivityIcon(type: ActivityType): {
  component: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
} {
  switch (type) {
    case 'message':
      return {
        component: MessageSquare,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
      };
    case 'task':
      return {
        component: CheckCircle,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
      };
    case 'workflow':
      return {
        component: WorkflowIcon,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/20',
      };
    case 'member':
      return {
        component: UserPlus,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/20',
      };
    case 'file':
      return {
        component: FileText,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/20',
      };
    case 'channel':
      return {
        component: Hash,
        color: 'text-teal-600 dark:text-teal-400',
        bgColor: 'bg-teal-100 dark:bg-teal-900/20',
      };
    default:
      return {
        component: Activity,
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-900/20',
      };
  }
}

/**
 * Get target type label
 */
function getTargetTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    channel: 'in',
    task: '',
    workflow: '',
    workspace: 'the workspace',
    file: '',
    user: '',
  };
  return labels[type] || '';
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

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
  if (diffDays < 30) {
return `${Math.floor(diffDays / 7)}w ago`;
}

  return date.toLocaleDateString();
}

/**
 * Render metadata tags
 */
function renderMetadataTags(activity: ActivityEntry): React.ReactNode {
  const tags: React.ReactNode[] = [];

  // Task metadata
  if (activity.type === 'task') {
    if (activity.metadata.priority) {
      tags.push(
        <span
          key="priority"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
        >
          {String(activity.metadata.priority).toUpperCase()}
        </span>,
      );
    }
    if (activity.metadata.status) {
      tags.push(
        <span
          key="status"
          className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
        >
          {String(activity.metadata.status)}
        </span>,
      );
    }
  }

  // Workflow metadata
  if (activity.type === 'workflow') {
    if (activity.metadata.status) {
      tags.push(
        <span
          key="status"
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            activity.metadata.status === 'COMPLETED'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300',
          )}
        >
          {String(activity.metadata.status)}
        </span>,
      );
    }
  }

  // Message metadata
  if (activity.type === 'message') {
    if (activity.metadata.replyCount && typeof activity.metadata.replyCount === 'number') {
      tags.push(
        <span key="replies" className="rounded-full bg-muted px-2 py-0.5 text-xs">
          {activity.metadata.replyCount} replies
        </span>,
      );
    }
  }

  return tags;
}

/**
 * Icons
 */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}
