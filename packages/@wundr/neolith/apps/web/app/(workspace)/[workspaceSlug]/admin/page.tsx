'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useSWR from 'swr';

import { usePageHeader } from '@/contexts/page-header-context';
import {
  useMembers,
  useRoles,
  useBilling,
  useAdminActivity,
} from '@/hooks/use-admin';
import { cn, getInitials } from '@/lib/utils';

/**
 * Admin Dashboard Metrics
 */
interface DashboardMetrics {
  users: {
    total: number;
    active: number;
    suspended: number;
    trend: number;
  };
  sessions: {
    active: number;
    today: number;
    trend: number;
  };
  invites: {
    pending: number;
    sent: number;
    accepted: number;
    trend: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
  activity: Array<{
    date: string;
    actions: number;
    users: number;
  }>;
  recentAlerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    createdAt: Date;
  }>;
  health: {
    status: 'healthy' | 'warning' | 'critical';
    database: 'connected' | 'disconnected';
    storage: 'available' | 'limited' | 'full';
    apiLatency: number;
  };
}

/**
 * Fetcher function for SWR
 */
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

/**
 * Admin Console Overview Page
 *
 * Provides a comprehensive dashboard of workspace admin metrics and quick actions
 */
export default function AdminPage() {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string;
  const { setPageHeader } = usePageHeader();

  // Set page header
  useEffect(() => {
    setPageHeader('Admin Console', 'Manage workspace administration settings');
  }, [setPageHeader]);

  // Fetch summary data
  const {
    members,
    total: memberCount,
    isLoading: membersLoading,
  } = useMembers(workspaceSlug, { limit: 5 });
  const { roles, isLoading: rolesLoading } = useRoles(workspaceSlug);
  const { billing, isLoading: billingLoading } = useBilling(workspaceSlug);
  const {
    activities,
    total: activityCount,
    isLoading: activityLoading,
  } = useAdminActivity(workspaceSlug, { limit: 5 });

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useSWR<DashboardMetrics>(
    `/api/workspaces/${workspaceSlug}/admin/metrics`,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  return (
    <div className='space-y-6'>
      {/* System Health Status */}
      {metrics?.health && (
        <div
          className={cn(
            'rounded-lg border p-4',
            metrics.health.status === 'critical' &&
              'border-red-500 bg-red-50 dark:bg-red-950',
            metrics.health.status === 'warning' &&
              'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
            metrics.health.status === 'healthy' &&
              'border-green-500 bg-green-50 dark:bg-green-950'
          )}
        >
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <HealthIcon
                className={cn(
                  'h-5 w-5',
                  metrics.health.status === 'critical' &&
                    'text-red-600 dark:text-red-400',
                  metrics.health.status === 'warning' &&
                    'text-yellow-600 dark:text-yellow-400',
                  metrics.health.status === 'healthy' &&
                    'text-green-600 dark:text-green-400'
                )}
              />
              <div>
                <h3 className='font-semibold'>
                  System Status:{' '}
                  {metrics.health.status === 'healthy'
                    ? 'Healthy'
                    : metrics.health.status === 'warning'
                      ? 'Warning'
                      : 'Critical'}
                </h3>
                <p className='text-sm text-muted-foreground'>
                  Database: {metrics.health.database} • Storage:{' '}
                  {metrics.health.storage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title='Total Users'
          value={metrics?.users.total ?? memberCount}
          description={`${metrics?.users.active ?? 0} active, ${metrics?.users.suspended ?? 0} suspended`}
          icon={<UsersIcon className='h-5 w-5' />}
          href={`/${workspaceSlug}/admin/members`}
          loading={metricsLoading || membersLoading}
          trend={metrics?.users.trend}
        />
        <StatCard
          title='Active Sessions'
          value={metrics?.sessions.active ?? 0}
          description={`${metrics?.sessions.today ?? 0} unique users today`}
          icon={<ActivityIcon className='h-5 w-5' />}
          href={`/${workspaceSlug}/admin/activity`}
          loading={metricsLoading}
          trend={metrics?.sessions.trend}
        />
        <StatCard
          title='Pending Invites'
          value={metrics?.invites.pending ?? 0}
          description={`${metrics?.invites.sent ?? 0} sent, ${metrics?.invites.accepted ?? 0} accepted`}
          icon={<MailIcon className='h-5 w-5' />}
          href={`/${workspaceSlug}/admin/members?tab=invites`}
          loading={metricsLoading}
          trend={metrics?.invites.trend}
        />
        <StatCard
          title='Storage Used'
          value={formatBytes(metrics?.storage.used ?? 0)}
          description={`${metrics?.storage.percentage.toFixed(1) ?? 0}% of ${formatBytes(metrics?.storage.limit ?? 0)}`}
          icon={<DatabaseIcon className='h-5 w-5' />}
          href={`/${workspaceSlug}/admin/billing`}
          loading={metricsLoading}
          valueClassName={
            (metrics?.storage.percentage ?? 0) > 90
              ? 'text-red-600'
              : (metrics?.storage.percentage ?? 0) > 75
                ? 'text-yellow-600'
                : undefined
          }
        />
      </div>

      {/* Activity Chart */}
      {metrics?.activity && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='font-semibold text-foreground'>Activity Overview</h2>
            <p className='text-sm text-muted-foreground'>
              Last 30 days of workspace activity
            </p>
          </div>
          <div className='p-6'>
            <div className='h-[300px]'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={metrics.activity}>
                  <defs>
                    <linearGradient
                      id='colorActions'
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='1'
                    >
                      <stop
                        offset='5%'
                        stopColor='hsl(var(--primary))'
                        stopOpacity={0.8}
                      />
                      <stop
                        offset='95%'
                        stopColor='hsl(var(--primary))'
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id='colorUsers' x1='0' y1='0' x2='0' y2='1'>
                      <stop
                        offset='5%'
                        stopColor='hsl(var(--chart-2))'
                        stopOpacity={0.8}
                      />
                      <stop
                        offset='95%'
                        stopColor='hsl(var(--chart-2))'
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    className='stroke-muted'
                  />
                  <XAxis
                    dataKey='date'
                    tickFormatter={value => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    className='text-xs'
                  />
                  <YAxis className='text-xs' />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelFormatter={value => {
                      const date = new Date(value);
                      return date.toLocaleDateString();
                    }}
                  />
                  <Area
                    type='monotone'
                    dataKey='actions'
                    stroke='hsl(var(--primary))'
                    fillOpacity={1}
                    fill='url(#colorActions)'
                    name='Actions'
                  />
                  <Area
                    type='monotone'
                    dataKey='users'
                    stroke='hsl(var(--chart-2))'
                    fillOpacity={1}
                    fill='url(#colorUsers)'
                    name='Active Users'
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Alerts and Notifications */}
      {metrics?.recentAlerts && metrics.recentAlerts.length > 0 && (
        <div className='rounded-lg border bg-card'>
          <div className='border-b px-6 py-4'>
            <h2 className='font-semibold text-foreground'>
              Notifications & Alerts
            </h2>
          </div>
          <div className='divide-y'>
            {metrics.recentAlerts.map(alert => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start gap-4 px-6 py-4',
                  alert.type === 'error' && 'bg-red-50 dark:bg-red-950/20',
                  alert.type === 'warning' &&
                    'bg-yellow-50 dark:bg-yellow-950/20',
                  alert.type === 'info' && 'bg-blue-50 dark:bg-blue-950/20'
                )}
              >
                <div className='flex-shrink-0 mt-0.5'>
                  {alert.type === 'error' && (
                    <AlertCircleIcon className='h-5 w-5 text-red-600 dark:text-red-400' />
                  )}
                  {alert.type === 'warning' && (
                    <AlertTriangleIcon className='h-5 w-5 text-yellow-600 dark:text-yellow-400' />
                  )}
                  {alert.type === 'info' && (
                    <InfoIcon className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                  )}
                </div>
                <div className='flex-1'>
                  <p className='text-sm text-foreground'>{alert.message}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {formatRelativeTime(alert.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className='rounded-lg border bg-card'>
        <div className='border-b px-6 py-4'>
          <h2 className='font-semibold text-foreground'>Quick Actions</h2>
        </div>
        <div className='grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4'>
          <QuickActionCard
            title='Invite Members'
            description='Add new members to your workspace'
            icon={<UserPlusIcon className='h-6 w-6' />}
            href={`/${workspaceSlug}/admin/members?invite=true`}
          />
          <QuickActionCard
            title='Create Role'
            description='Define custom permissions'
            icon={<ShieldPlusIcon className='h-6 w-6' />}
            href={`/${workspaceSlug}/admin/roles?create=true`}
          />
          <QuickActionCard
            title='View Activity'
            description='Review admin action logs'
            icon={<ClipboardListIcon className='h-6 w-6' />}
            href={`/${workspaceSlug}/admin/activity`}
          />
          <QuickActionCard
            title='Settings'
            description='Configure workspace preferences'
            icon={<SettingsIcon className='h-6 w-6' />}
            href={`/${workspaceSlug}/admin/settings`}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className='rounded-lg border bg-card'>
        <div className='flex items-center justify-between border-b px-6 py-4'>
          <h2 className='font-semibold text-foreground'>
            Recent Admin Activity
          </h2>
          <Link
            href={`/${workspaceSlug}/admin/activity`}
            className='text-sm text-primary hover:underline'
          >
            View All
          </Link>
        </div>
        <div className='divide-y'>
          {activityLoading ? (
            <ActivitySkeleton count={3} />
          ) : activities.length === 0 ? (
            <div className='px-6 py-8 text-center text-sm text-muted-foreground'>
              No recent activity
            </div>
          ) : (
            activities.slice(0, 5).map(activity => (
              <div
                key={activity.id}
                className='flex items-start gap-4 px-6 py-4'
              >
                <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted'>
                  <UserIcon className='h-5 w-5 text-muted-foreground' />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-foreground'>
                    <span className='font-medium'>
                      {activity.actor?.name || 'Unknown'}
                    </span>{' '}
                    {getActionDescription(activity.action)}
                    {activity.targetName && (
                      <>
                        {' '}
                        <span className='font-medium'>
                          {activity.targetName}
                        </span>
                      </>
                    )}
                  </p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Members */}
      <div className='rounded-lg border bg-card'>
        <div className='flex items-center justify-between border-b px-6 py-4'>
          <h2 className='font-semibold text-foreground'>Recent Members</h2>
          <Link
            href={`/${workspaceSlug}/admin/members`}
            className='text-sm text-primary hover:underline'
          >
            View All
          </Link>
        </div>
        <div className='divide-y'>
          {membersLoading ? (
            <MemberSkeleton count={3} />
          ) : members.length === 0 ? (
            <div className='px-6 py-8 text-center text-sm text-muted-foreground'>
              No members yet
            </div>
          ) : (
            members.slice(0, 5).map(member => (
              <div
                key={member.id}
                className='flex items-center justify-between px-6 py-4'
              >
                <div className='flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                    <span className='text-sm font-medium text-foreground'>
                      {getInitials(member.name || member.email || '')}
                    </span>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-foreground'>
                      {member.name || 'Unknown'}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {member.email}
                    </p>
                  </div>
                </div>
                <span className='rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium'>
                  {member.role?.name || 'No Role'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: React.ReactNode;
  href: string;
  loading?: boolean;
  valueClassName?: string;
  trend?: number;
}

function StatCard({
  title,
  value,
  description,
  icon,
  href,
  loading,
  valueClassName,
  trend,
}: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg border bg-card p-6 transition-colors hover:bg-accent',
        loading && 'pointer-events-none opacity-50'
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='text-muted-foreground'>{icon}</div>
        {trend !== undefined && trend !== 0 && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend > 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend > 0 ? (
              <TrendUpIcon className='h-3 w-3' />
            ) : (
              <TrendDownIcon className='h-3 w-3' />
            )}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <div className='mt-3'>
        <p className={cn('text-2xl font-bold', valueClassName)}>
          {loading ? '...' : value}
        </p>
        <p className='text-sm font-medium text-foreground'>{title}</p>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </div>
    </Link>
  );
}

// Quick Action Card Component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}

function QuickActionCard({
  title,
  description,
  icon,
  href,
}: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className='flex gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent'
    >
      <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
        {icon}
      </div>
      <div>
        <p className='font-medium text-foreground'>{title}</p>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
    </Link>
  );
}

// Skeleton Components
function ActivitySkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='flex items-start gap-4 px-6 py-4'>
          <div className='h-10 w-10 animate-pulse rounded-full bg-muted' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 w-3/4 animate-pulse rounded bg-muted' />
            <div className='h-3 w-1/4 animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </>
  );
}

function MemberSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='flex items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-3'>
            <div className='h-10 w-10 animate-pulse rounded-full bg-muted' />
            <div className='space-y-2'>
              <div className='h-4 w-24 animate-pulse rounded bg-muted' />
              <div className='h-3 w-32 animate-pulse rounded bg-muted' />
            </div>
          </div>
          <div className='h-5 w-16 animate-pulse rounded-full bg-muted' />
        </div>
      ))}
    </>
  );
}

// Utility Functions
function getActionDescription(action: string): string {
  const descriptions: Record<string, string> = {
    'member.invited': 'invited',
    'member.removed': 'removed member',
    'member.suspended': 'suspended member',
    'member.unsuspended': 'unsuspended member',
    'member.role_changed': 'changed role for',
    'role.created': 'created role',
    'role.updated': 'updated role',
    'role.deleted': 'deleted role',
    'settings.updated': 'updated workspace settings',
    'billing.plan_changed': 'updated billing plan',
    'channel.created': 'created channel',
    'channel.deleted': 'deleted channel',
  };
  return descriptions[action] || `performed ${action}`;
}

function formatRelativeTime(timestamp: Date | string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
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

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))}${sizes[i]}`;
}

// Icons
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

function MailIcon({ className }: { className?: string }) {
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
      <rect width='20' height='16' x='2' y='4' rx='2' />
      <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
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
      <ellipse cx='12' cy='5' rx='9' ry='3' />
      <path d='M3 5v14a9 3 0 0 0 18 0V5' />
      <path d='M3 12a9 3 0 0 0 18 0' />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
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
      <line x1='19' x2='19' y1='8' y2='14' />
      <line x1='22' x2='16' y1='11' y2='11' />
    </svg>
  );
}

function ShieldPlusIcon({ className }: { className?: string }) {
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
      <path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
      <line x1='12' x2='12' y1='9' y2='15' />
      <line x1='9' x2='15' y1='12' y2='12' />
    </svg>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
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
      <rect width='8' height='4' x='8' y='2' rx='1' ry='1' />
      <path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' />
      <path d='M12 11h4' />
      <path d='M12 16h4' />
      <path d='M8 11h.01' />
      <path d='M8 16h.01' />
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

function HealthIcon({ className }: { className?: string }) {
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

function AlertCircleIcon({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='10' />
      <line x1='12' x2='12' y1='8' y2='12' />
      <line x1='12' x2='12.01' y1='16' y2='16' />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
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
      <path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' />
      <line x1='12' x2='12' y1='9' y2='13' />
      <line x1='12' x2='12.01' y1='17' y2='17' />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
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
      <circle cx='12' cy='12' r='10' />
      <path d='M12 16v-4' />
      <path d='M12 8h.01' />
    </svg>
  );
}

function TrendUpIcon({ className }: { className?: string }) {
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
      <polyline points='22 7 13.5 15.5 8.5 10.5 2 17' />
      <polyline points='16 7 22 7 22 13' />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
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
      <polyline points='22 17 13.5 8.5 8.5 13.5 2 7' />
      <polyline points='16 17 22 17 22 11' />
    </svg>
  );
}
