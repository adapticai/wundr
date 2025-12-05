'use client';

import {
  Activity,
  ArrowUp,
  Calendar,
  CheckCircle,
  FileText,
  Hash,
  MessageSquare,
  UserPlus,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineDot,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@/components/ui/timeline';
import { useActivity } from '@/hooks/use-activity';
import { useRealtimeActivity } from '@/hooks/use-realtime-activity';
import { cn } from '@/lib/utils';

import type { ActivityEntry, ActivityType } from '@/hooks/use-activity';

/**
 * Activity Feed Page
 *
 * Displays a chronological feed of workspace activities with filtering,
 * pagination, and real-time updates.
 */
export default function ActivityPage() {
  const params = useParams();
  const workspaceId = params?.workspaceSlug as string;

  // State
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all');
  const [dateRange, setDateRange] = useState<
    'today' | 'week' | 'month' | 'all'
  >('all');
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const activityListRef = useRef<HTMLDivElement>(null);

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
  const { activities: baseActivities, isLoading, error, loadMore, hasMore, refresh } =
    useActivity(workspaceId, {
      type: typeFilter,
      dateFrom: dateFilter,
      limit: 20,
    });

  // Real-time activity updates
  const {
    activities,
    newActivityCount,
    isPolling,
    clearNewActivities,
    pollNow,
  } = useRealtimeActivity({
    workspaceId,
    initialActivities: baseActivities,
    typeFilter,
    dateFilter,
    enabled: true,
    pollingInterval: 30000, // 30 seconds
  });

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

    activities.forEach(activity => {
      if (activity.type !== 'all') {
        counts[activity.type]++;
      }
    });

    return counts;
  }, [activities]);

  // Scroll to top handler
  const scrollToTop = useCallback(() => {
    activityListRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    clearNewActivities();
  }, [clearNewActivities]);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (activityListRef.current) {
        const rect = activityListRef.current.getBoundingClientRect();
        setIsScrolledDown(rect.top < -100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className='space-y-6'>
      {/* New Activity Indicator */}
      {newActivityCount > 0 && isScrolledDown && (
        <div className='fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top'>
          <button
            type='button'
            onClick={scrollToTop}
            className='inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl'
          >
            <ArrowUp className='h-4 w-4' />
            {newActivityCount} new {newActivityCount === 1 ? 'activity' : 'activities'}
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between' ref={activityListRef}>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Activity Feed</h1>
          <p className='text-sm text-muted-foreground'>
            Track all workspace activities in one place
            {isPolling && (
              <span className='ml-2 inline-flex items-center gap-1 text-xs text-primary'>
                <span className='inline-block h-2 w-2 rounded-full bg-primary animate-pulse' />
                Live
              </span>
            )}
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={pollNow}
            disabled={isLoading}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
            title='Check for new activities'
          >
            <RefreshIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Check Now
          </button>
          <button
            type='button'
            onClick={refresh}
            disabled={isLoading}
            className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50'
          >
            <RefreshIcon className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4'>
        {/* Activity Type Filter */}
        <div className='flex flex-wrap gap-2'>
          <span className='text-sm font-medium text-muted-foreground'>
            Type:
          </span>
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
              type='button'
              onClick={() => setTypeFilter(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Icon className='h-3.5 w-3.5' />
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
        <div className='flex flex-wrap gap-2'>
          <span className='text-sm font-medium text-muted-foreground'>
            Time:
          </span>
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
              type='button'
              onClick={() => setDateRange(key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                dateRange === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Calendar className='h-3.5 w-3.5' />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20'>
          <div className='flex items-center gap-2 text-red-800 dark:text-red-200'>
            <AlertIcon className='h-5 w-5' />
            <p className='text-sm font-medium'>Failed to load activities</p>
          </div>
          <p className='mt-1 text-sm text-red-600 dark:text-red-300'>
            {error.message}
          </p>
          <button
            type='button'
            onClick={refresh}
            className='mt-2 text-sm font-medium text-red-800 hover:text-red-900 dark:text-red-200'
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && activities.length === 0 && (
        <div className='space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && activities.length === 0 && (
        <EmptyState
          icon={Activity}
          title='No Activity Yet'
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
        <div className='relative'>
          <Timeline>
            {activities.map((activity, index) => (
              <TimelineItem key={activity.id}>
                <TimelineDot
                  variant={getActivityVariant(activity)}
                  icon={getActivityIconComponent(activity.type)}
                />
                {index < activities.length - 1 && <TimelineConnector />}
                <TimelineContent>
                  <div className='flex items-start justify-between gap-2'>
                    <TimelineTitle>
                      <div className='flex items-center gap-2'>
                        {activity.actor.avatarUrl ? (
                          <img
                            src={activity.actor.avatarUrl}
                            alt={
                              activity.actor.displayName ||
                              activity.actor.name ||
                              'User'
                            }
                            className='h-6 w-6 rounded-full object-cover'
                          />
                        ) : (
                          <div className='flex h-6 w-6 items-center justify-center rounded-full bg-muted'>
                            <span className='text-xs font-medium text-muted-foreground'>
                              {(
                                activity.actor.displayName ||
                                activity.actor.name ||
                                '?'
                              )[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span>
                          {activity.actor.displayName ||
                            activity.actor.name ||
                            'Unknown user'}
                        </span>
                        {activity.actor.isOrchestrator && (
                          <span className='rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'>
                            AI
                          </span>
                        )}
                      </div>
                    </TimelineTitle>
                    <TimelineTime>
                      <time dateTime={activity.timestamp}>
                        {formatRelativeTime(activity.timestamp)}
                      </time>
                    </TimelineTime>
                  </div>
                  <TimelineDescription>
                    <span className='text-muted-foreground'>
                      {activity.action}{' '}
                    </span>
                    {activity.target && (
                      <>
                        <span className='text-muted-foreground'>
                          {getTargetTypeLabel(activity.target.type)}
                        </span>
                        <span className='font-medium'>
                          {' '}
                          {activity.target.name}
                        </span>
                      </>
                    )}
                  </TimelineDescription>
                  {activity.content && (
                    <p className='mt-2 text-sm text-muted-foreground line-clamp-2'>
                      {activity.content}
                    </p>
                  )}
                  {Object.keys(activity.metadata).length > 0 && (
                    <div className='mt-3 flex flex-wrap gap-2'>
                      {renderMetadataTags(activity)}
                    </div>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>

          {/* Load More Button */}
          {hasMore && (
            <div className='flex justify-center pt-8'>
              <button
                type='button'
                onClick={loadMore}
                className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent'
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
 * Get timeline variant based on activity action
 */
function getActivityVariant(
  activity: ActivityEntry,
): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const action = activity.action.toLowerCase();

  if (action.includes('create') || action.includes('add')) {
    return 'success';
  }
  if (
    action.includes('update') ||
    action.includes('edit') ||
    action.includes('change')
  ) {
    return 'info';
  }
  if (action.includes('delete') || action.includes('remove')) {
    return 'warning';
  }
  if (action.includes('fail') || action.includes('error')) {
    return 'error';
  }

  return 'default';
}

/**
 * Get icon component based on activity type
 */
function getActivityIconComponent(
  type: ActivityType,
): React.ReactElement | undefined {
  const iconMap: Record<ActivityType, React.ComponentType<any>> = {
    message: MessageSquare,
    task: CheckCircle,
    workflow: WorkflowIcon,
    member: UserPlus,
    file: FileText,
    channel: Hash,
    all: Activity,
  };

  const IconComponent = iconMap[type] || Activity;
  return <IconComponent className='h-4 w-4' />;
}

/**
 * Activity Timeline Skeleton
 */
function ActivityCardSkeleton() {
  return (
    <TimelineItem>
      <div className='h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted' />
      <TimelineConnector />
      <TimelineContent>
        <div className='space-y-2'>
          <div className='h-4 w-3/4 animate-pulse rounded bg-muted' />
          <div className='h-3 w-full animate-pulse rounded bg-muted' />
          <div className='flex gap-2'>
            <div className='h-5 w-16 animate-pulse rounded-full bg-muted' />
            <div className='h-5 w-16 animate-pulse rounded-full bg-muted' />
          </div>
        </div>
      </TimelineContent>
    </TimelineItem>
  );
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
          key='priority'
          className='rounded-full bg-muted px-2 py-0.5 text-xs font-medium'
        >
          {String(activity.metadata.priority).toUpperCase()}
        </span>,
      );
    }
    if (activity.metadata.status) {
      tags.push(
        <span
          key='status'
          className='rounded-full bg-muted px-2 py-0.5 text-xs font-medium'
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
          key='status'
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
    if (
      activity.metadata.replyCount &&
      typeof activity.metadata.replyCount === 'number'
    ) {
      tags.push(
        <span
          key='replies'
          className='rounded-full bg-muted px-2 py-0.5 text-xs'
        >
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
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <path d='M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2' />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
    >
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  );
}
