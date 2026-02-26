'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo, useCallback, useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useAdminActivity, type AdminAction } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

type ActivityFilterType =
  | 'all'
  | 'member.invited'
  | 'member.removed'
  | 'member.suspended'
  | 'member.unsuspended'
  | 'member.role_changed'
  | 'role.created'
  | 'role.updated'
  | 'role.deleted'
  | 'settings.updated'
  | 'billing.plan_changed'
  | 'channel.created'
  | 'channel.deleted';

/**
 * Activity Log Page
 *
 * Displays admin actions and audit logs with filtering
 */
export default function AdminActivityPage() {
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader(
      'Activity Log',
      'Review admin actions and audit trail for your workspace'
    );
  }, [setPageHeader]);

  const [filterAction, setFilterAction] = useState<ActivityFilterType>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>(
    '30d'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const { activities, isLoading, hasMore, loadMore } = useAdminActivity(
    workspaceSlug,
    {
      type: filterAction === 'all' ? undefined : (filterAction as any),
      limit: 50,
    }
  );

  // Filter activities based on search and date
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by date range
    if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filtered = filtered.filter(
        activity => new Date(activity.createdAt) >= cutoff
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        activity =>
          activity.actor?.name?.toLowerCase().includes(query) ||
          activity.action.toLowerCase().includes(query) ||
          activity.targetName?.toLowerCase().includes(query) ||
          (activity.metadata?.reason as string)?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [activities, dateRange, searchQuery]);

  const handleExport = useCallback(() => {
    const csv = [
      [
        'Timestamp',
        'Action',
        'Actor',
        'Resource',
        'Details',
        'IP Address',
      ].join(','),
      ...filteredActivities.map(activity =>
        [
          activity.createdAt instanceof Date
            ? activity.createdAt.toISOString()
            : activity.createdAt,
          activity.action,
          activity.actor?.name || 'Unknown',
          activity.targetName || activity.targetType || '',
          (activity.metadata?.reason as string) || '',
          activity.ipAddress || '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredActivities]);

  const actionFilterOptions: { value: ActivityFilterType; label: string }[] = [
    { value: 'all', label: 'All Actions' },
    { value: 'member.invited', label: 'Member Invites' },
    { value: 'member.removed', label: 'Member Removals' },
    { value: 'member.suspended', label: 'Member Suspended' },
    { value: 'member.role_changed', label: 'Role Changed' },
    { value: 'role.created', label: 'Role Created' },
    { value: 'role.updated', label: 'Role Updated' },
    { value: 'role.deleted', label: 'Role Deleted' },
    { value: 'settings.updated', label: 'Settings Changed' },
    { value: 'billing.plan_changed', label: 'Billing Updated' },
    { value: 'channel.created', label: 'Channel Created' },
    { value: 'channel.deleted', label: 'Channel Deleted' },
  ];

  const dateRangeOptions = [
    { value: '7d' as const, label: 'Last 7 days' },
    { value: '30d' as const, label: 'Last 30 days' },
    { value: '90d' as const, label: 'Last 90 days' },
    { value: 'all' as const, label: 'All time' },
  ];

  return (
    <div className='space-y-6'>
      {/* Action Button */}
      <div className='flex justify-end'>
        <button
          type='button'
          onClick={handleExport}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-input',
            'bg-background px-4 py-2 text-sm font-medium hover:bg-muted'
          )}
        >
          <DownloadIcon className='h-4 w-4' />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-wrap gap-3'>
          {/* Action Filter */}
          <select
            value={filterAction}
            onChange={e =>
              setFilterAction(e.target.value as ActivityFilterType)
            }
            className={cn(
              'rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            {actionFilterOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Date Range Filter */}
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as typeof dateRange)}
            className={cn(
              'rounded-md border border-input bg-background px-3 py-2 text-sm',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'
            )}
          >
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className='relative'>
          <SearchIcon className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <input
            type='text'
            placeholder='Search activity...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-md border border-input bg-background py-2 pl-9 pr-4',
              'text-sm placeholder:text-muted-foreground',
              'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
              'lg:w-64'
            )}
          />
        </div>
      </div>

      {/* Activity Stats */}
      <div className='grid gap-4 sm:grid-cols-4'>
        <StatCard
          label='Total Actions'
          value={filteredActivities.length}
          icon={ActivityIcon}
        />
        <StatCard
          label='Member Changes'
          value={
            filteredActivities.filter(a => a.action.startsWith('member.'))
              .length
          }
          icon={UsersIcon}
        />
        <StatCard
          label='Settings Updates'
          value={
            filteredActivities.filter(a => a.action === 'settings.updated')
              .length
          }
          icon={SettingsIcon}
        />
        <StatCard
          label='Unique Actors'
          value={new Set(filteredActivities.map(a => a.actorId)).size}
          icon={UserIcon}
        />
      </div>

      {/* Activity Timeline */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-4 py-3'>
          <h2 className='font-semibold text-foreground'>Timeline</h2>
        </div>

        {isLoading ? (
          <ActivitySkeleton count={10} />
        ) : filteredActivities.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <ActivityIcon className='h-12 w-12 text-muted-foreground/50' />
            <p className='mt-2 text-muted-foreground'>No activity found</p>
            <p className='text-sm text-muted-foreground'>
              Try adjusting your filters
            </p>
          </div>
        ) : (
          <div className='divide-y'>
            {filteredActivities.map((activity, index) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                showDate={
                  index === 0 ||
                  !isSameDay(
                    new Date(activity.createdAt),
                    new Date(filteredActivities[index - 1].createdAt)
                  )
                }
              />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className='border-t px-4 py-3 text-center'>
            <button
              type='button'
              onClick={loadMore}
              disabled={isLoading}
              className='text-sm text-primary hover:underline disabled:opacity-50'
            >
              Load more activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get timestamp string from AdminAction
function getTimestamp(activity: AdminAction): string {
  const createdAt = activity.createdAt;
  if (createdAt instanceof Date) {
    return createdAt.toISOString();
  }
  return String(createdAt);
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.FC<{ className?: string }>;
}) {
  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='flex items-center gap-2 text-muted-foreground'>
        <Icon className='h-4 w-4' />
        <span className='text-sm'>{label}</span>
      </div>
      <p className='mt-1 text-2xl font-bold text-foreground'>{value}</p>
    </div>
  );
}

// Activity Row Component
function ActivityRow({
  activity,
  showDate,
}: {
  activity: AdminAction;
  showDate: boolean;
}) {
  const actionConfig = getActionConfig(activity.action);
  const timestamp = getTimestamp(activity);
  const reason = activity.metadata?.reason;
  const reasonText =
    typeof reason === 'string'
      ? reason
      : reason
        ? JSON.stringify(reason)
        : null;

  return (
    <>
      {showDate && (
        <div className='border-t bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground'>
          {formatDate(timestamp)}
        </div>
      )}
      <div className='flex items-start gap-4 px-4 py-4'>
        {/* Actor Avatar */}
        <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted'>
          <UserIcon className='h-5 w-5 text-muted-foreground' />
        </div>

        {/* Content */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div>
              <p className='text-sm text-foreground'>
                <span className='font-medium'>
                  {activity.actor?.name || 'Unknown'}
                </span>{' '}
                {actionConfig.description}
                {activity.targetName && (
                  <>
                    {' '}
                    <span className='font-medium'>{activity.targetName}</span>
                  </>
                )}
              </p>
              {reasonText && (
                <p className='mt-1 text-sm text-muted-foreground'>
                  {reasonText}
                </p>
              )}
            </div>
            <span className='flex-shrink-0 text-xs text-muted-foreground'>
              {formatTime(timestamp)}
            </span>
          </div>

          {/* Metadata */}
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                actionConfig.className
              )}
            >
              {actionConfig.label}
            </span>
            {activity.ipAddress && (
              <span className='text-xs text-muted-foreground'>
                IP: {activity.ipAddress}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActivitySkeleton({ count }: { count: number }) {
  return (
    <div className='divide-y'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='flex items-start gap-4 px-4 py-4'>
          <div className='h-10 w-10 animate-pulse rounded-full bg-muted' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 w-3/4 animate-pulse rounded bg-muted' />
            <div className='h-3 w-1/2 animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}

// Utility Functions
function getActionConfig(actionType: string): {
  label: string;
  description: string;
  className: string;
} {
  const configs: Record<
    string,
    { label: string; description: string; className: string }
  > = {
    'member.invited': {
      label: 'Invite',
      description: 'invited',
      className:
        'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
    },
    'member.removed': {
      label: 'Remove',
      description: 'removed member',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
    'member.suspended': {
      label: 'Suspend',
      description: 'suspended member',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    'member.unsuspended': {
      label: 'Unsuspend',
      description: 'unsuspended member',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    'member.role_changed': {
      label: 'Role Change',
      description: 'changed role for',
      className:
        'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
    },
    'role.created': {
      label: 'Create',
      description: 'created role',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    'role.updated': {
      label: 'Update',
      description: 'updated role',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    },
    'role.deleted': {
      label: 'Delete',
      description: 'deleted role',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
    'settings.updated': {
      label: 'Settings',
      description: 'updated workspace settings',
      className:
        'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
    },
    'billing.plan_changed': {
      label: 'Billing',
      description: 'updated billing information',
      className:
        'bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300',
    },
    'channel.created': {
      label: 'Channel',
      description: 'created channel',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    },
    'channel.deleted': {
      label: 'Channel',
      description: 'deleted channel',
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    },
    'channel.archived': {
      label: 'Channel',
      description: 'archived channel',
      className:
        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    },
  };

  return (
    configs[actionType] || {
      label: 'Action',
      description: `performed ${actionType}`,
      className:
        'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    }
  );
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return 'Today';
  }
  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Icons
function DownloadIcon({ className }: { className?: string }) {
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
      <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
      <polyline points='7 10 12 15 17 10' />
      <line x1='12' x2='12' y1='15' y2='3' />
    </svg>
  );
}

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

function ActivityIcon({ className }: { className?: string }) {
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
      <path d='M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2' />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
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
      <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
      <circle cx='9' cy='7' r='4' />
      <path d='M22 21v-2a4 4 0 0 0-3-3.87' />
      <path d='M16 3.13a4 4 0 0 1 0 7.75' />
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

function UserIcon({ className }: { className?: string }) {
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
      <path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' />
      <circle cx='12' cy='7' r='4' />
    </svg>
  );
}
