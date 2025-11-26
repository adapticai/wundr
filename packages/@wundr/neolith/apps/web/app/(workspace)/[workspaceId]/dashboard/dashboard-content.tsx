'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export function DashboardContent({ userName, workspaceId }: DashboardContentProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/activity?limit=5`);
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    const fetchStats = async () => {
      try {
        const [membersRes, workflowsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/members`),
          fetch(`/api/workspaces/${workspaceId}/workflows`),
        ]);

        let membersCount = 0;
        let channelsCount = 0;
        let workflowsCount = 0;

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          membersCount = membersData.pagination?.totalCount || membersData.data?.length || 0;
        }

        if (workflowsRes.ok) {
          const workflowsData = await workflowsRes.json();
          workflowsCount = workflowsData.pagination?.totalCount || workflowsData.data?.length || 0;
        }

        // Fetch workspace details to get channels count
        const workspaceRes = await fetch(`/api/workspaces/${workspaceId}`);
        if (workspaceRes.ok) {
          const workspaceData = await workspaceRes.json();
          channelsCount = workspaceData.data?._count?.channels || 0;
        }

        setStats({
          membersCount,
          channelsCount,
          workflowsCount,
          vpsCount: 0, // TODO: Add VPs count when endpoint is available
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
            {activities.length > 0 ? (
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
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <StatItem label="Team Members" value={stats?.membersCount.toString() || '0'} />
              <StatItem label="Channels" value={stats?.channelsCount.toString() || '0'} />
              <StatItem label="Workflows" value={stats?.workflowsCount.toString() || '0'} />
              <StatItem label="Virtual Persons" value={stats?.vpsCount.toString() || '0'} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <QuickAction
                label="Invite Team Member"
                href={`/${workspaceId}/settings/members`}
              />
              <QuickAction label="Create Channel" href={`/${workspaceId}/channels/new`} />
              <QuickAction label="New Workflow" href={`/${workspaceId}/workflows/new`} />
              <QuickAction label="View Activity" href={`/${workspaceId}/activity`} />
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
