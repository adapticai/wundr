'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';

interface DashboardContentProps {
  userName: string;
  workspaceId: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  user: {
    name: string | null;
    displayName: string | null;
  };
  resourceType?: string | null;
  resourceName?: string | null;
  createdAt: string;
}

interface WorkspaceStats {
  membersCount: number;
  channelsCount: number;
  workflowsCount: number;
  vpsCount: number;
}

interface DashboardErrors {
  activities?: string;
  stats?: string;
}

export function DashboardContent({ userName, workspaceId }: DashboardContentProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errors, setErrors] = useState<DashboardErrors>({});

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/activity?limit=5`);
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setActivities(data.activities || []);
        setErrors((prev) => ({ ...prev, activities: undefined }));
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setErrors((prev) => ({
          ...prev,
          activities: error instanceof Error ? error.message : 'Failed to load recent activity',
        }));
        setActivities([]);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    const fetchStats = async () => {
      try {
        const [membersRes, workflowsRes, vpsRes, workspaceRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/members`),
          fetch(`/api/workspaces/${workspaceId}/workflows`),
          fetch(`/api/workspaces/${workspaceId}/vps`),
          fetch(`/api/workspaces/${workspaceId}`),
        ]);

        let membersCount = 0;
        let channelsCount = 0;
        let workflowsCount = 0;
        let vpsCount = 0;

        // Parse members response
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          membersCount = membersData.pagination?.totalCount || 0;
        } else {
          console.warn('Failed to fetch members count:', membersRes.status);
        }

        // Parse workflows response - API returns { workflows, total }
        if (workflowsRes.ok) {
          const workflowsData = await workflowsRes.json();
          workflowsCount = workflowsData.total || 0;
        } else {
          console.warn('Failed to fetch workflows count:', workflowsRes.status);
        }

        // Parse VPs response
        if (vpsRes.ok) {
          const vpsData = await vpsRes.json();
          vpsCount = vpsData.pagination?.totalCount || 0;
        } else {
          console.warn('Failed to fetch VPs count:', vpsRes.status);
        }

        // Parse workspace response for channels count
        if (workspaceRes.ok) {
          const workspaceData = await workspaceRes.json();
          channelsCount = workspaceData.data?._count?.channels || 0;
        } else {
          console.warn('Failed to fetch workspace details:', workspaceRes.status);
        }

        setStats({
          membersCount,
          channelsCount,
          workflowsCount,
          vpsCount,
        });
        setErrors((prev) => ({ ...prev, stats: undefined }));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setErrors((prev) => ({
          ...prev,
          stats: error instanceof Error ? error.message : 'Failed to load workspace statistics',
        }));
        // Set default stats on error
        setStats({
          membersCount: 0,
          channelsCount: 0,
          workflowsCount: 0,
          vpsCount: 0,
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchActivities();
    fetchStats();
  }, [workspaceId]);

  const formatActivityTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    return date.toLocaleDateString();
  };

  const formatActivityTitle = (activity: ActivityEntry): string => {
    const type = activity.type.split('.')[1] || activity.type;
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  const formatActivityDescription = (activity: ActivityEntry): string => {
    const userName = activity.user.displayName || activity.user.name || 'Unknown user';
    if (activity.resourceName) {
      return `${userName}: ${activity.resourceName}`;
    }
    return userName;
  };

  const isLoading = isLoadingActivities || isLoadingStats;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="py-2">
      <h1 className="text-3xl font-bold mb-8">Welcome, {userName}</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Recent Activity</h3>
            {errors.activities ? (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Error loading activity</p>
                <p className="mt-1 text-xs">{errors.activities}</p>
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.slice(0, 4).map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    title={formatActivityTitle(activity)}
                    description={formatActivityDescription(activity)}
                    time={formatActivityTime(activity.createdAt)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <ActivityIcon />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activity will appear here as your team works
                </p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            {errors.stats ? (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-medium">Error loading statistics</p>
                <p className="mt-1 text-xs">{errors.stats}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <StatItem label="Team Members" value={stats?.membersCount.toString() || '0'} />
                <StatItem label="Channels" value={stats?.channelsCount.toString() || '0'} />
                <StatItem label="Workflows" value={stats?.workflowsCount.toString() || '0'} />
                <StatItem label="Virtual Persons" value={stats?.vpsCount.toString() || '0'} />
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction
                label="Invite Team Member"
                href={`/${workspaceId}/admin/members`}
              />
              <QuickAction label="Create Channel" href={`/${workspaceId}/channels`} />
              <QuickAction label="New Workflow" href={`/${workspaceId}/workflows`} />
              <QuickAction label="View Activity" href={`/${workspaceId}/admin/activity`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {time}
      </span>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      {label}
      <ChevronRightIcon />
    </Link>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
