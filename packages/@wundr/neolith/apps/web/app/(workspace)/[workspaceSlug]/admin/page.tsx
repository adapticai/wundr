'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { usePageHeader } from '@/contexts/page-header-context';
import { useMembers, useRoles, useBilling, useAdminActivity } from '@/hooks/use-admin';
import { cn, getInitials } from '@/lib/utils';

/**
 * Admin Console Overview Page
 *
 * Provides a high-level dashboard of workspace admin metrics and quick actions
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
  const { members, total: memberCount, isLoading: membersLoading } = useMembers(workspaceSlug, { limit: 5 });
  const { roles, isLoading: rolesLoading } = useRoles(workspaceSlug);
  const { billing, isLoading: billingLoading } = useBilling(workspaceSlug);
  const { activities, total: activityCount, isLoading: activityLoading } = useAdminActivity(workspaceSlug, { limit: 5 });

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Members"
          value={memberCount}
          description="Active workspace members"
          icon={<UsersIcon className="h-5 w-5" />}
          href={`/${workspaceSlug}/admin/members`}
          loading={membersLoading}
        />
        <StatCard
          title="Custom Roles"
          value={roles.filter(r => !r.isSystem).length}
          description="Custom permission roles"
          icon={<ShieldIcon className="h-5 w-5" />}
          href={`/${workspaceSlug}/admin/roles`}
          loading={rolesLoading}
        />
        <StatCard
          title="Current Plan"
          value={billing?.plan.toUpperCase() ?? 'FREE'}
          description={billing?.status === 'active' ? 'Active subscription' : 'Free plan'}
          icon={<CreditCardIcon className="h-5 w-5" />}
          href={`/${workspaceSlug}/admin/billing`}
          loading={billingLoading}
          valueClassName={billing?.plan === 'free' ? 'text-muted-foreground' : 'text-primary'}
        />
        <StatCard
          title="Activity"
          value={activityCount}
          description="Admin actions logged"
          icon={<ActivityIcon className="h-5 w-5" />}
          href={`/${workspaceSlug}/admin/activity`}
          loading={activityLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold text-foreground">Quick Actions</h2>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Invite Members"
            description="Add new members to your workspace"
            icon={<UserPlusIcon className="h-6 w-6" />}
            href={`/${workspaceSlug}/admin/members?invite=true`}
          />
          <QuickActionCard
            title="Create Role"
            description="Define custom permissions"
            icon={<ShieldPlusIcon className="h-6 w-6" />}
            href={`/${workspaceSlug}/admin/roles?create=true`}
          />
          <QuickActionCard
            title="Workspace Settings"
            description="Configure workspace preferences"
            icon={<SettingsIcon className="h-6 w-6" />}
            href={`/${workspaceSlug}/admin/settings`}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-foreground">Recent Admin Activity</h2>
          <Link
            href={`/${workspaceSlug}/admin/activity`}
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="divide-y">
          {activityLoading ? (
            <ActivitySkeleton count={3} />
          ) : activities.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-4 px-6 py-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.actor?.name || 'Unknown'}</span>
                    {' '}
                    {getActionDescription(activity.action)}
                    {activity.targetName && (
                      <>
                        {' '}
                        <span className="font-medium">{activity.targetName}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Members */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold text-foreground">Recent Members</h2>
          <Link
            href={`/${workspaceSlug}/admin/members`}
            className="text-sm text-primary hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="divide-y">
          {membersLoading ? (
            <MemberSkeleton count={3} />
          ) : members.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No members yet
            </div>
          ) : (
            members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <span className="text-sm font-medium text-foreground">
                      {getInitials(member.name || member.email)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{member.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
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
}

function StatCard({ title, value, description, icon, href, loading, valueClassName }: StatCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg border bg-card p-6 transition-colors hover:bg-accent',
        loading && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-3">
        <p className={cn('text-2xl font-bold', valueClassName)}>
          {loading ? '...' : value}
        </p>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
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

function QuickActionCard({ title, description, icon, href }: QuickActionCardProps) {
  return (
    <Link
      href={href}
      className="flex gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

// Skeleton Components
function ActivitySkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-6 py-4">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
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
        <div key={i} className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
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

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

function ShieldPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <line x1="12" x2="12" y1="9" y2="15" />
      <line x1="9" x2="15" y1="12" y2="12" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
