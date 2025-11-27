'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { usePageHeader } from '@/contexts/page-header-context';
import type { DashboardActivityApiResponse } from '@/types/api';

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
  teamMembers: number;
  channels: number;
  workflows: number;
  orchestrators: number; // formerly VPs
}

interface DashboardErrors {
  activities?: string;
  stats?: string;
}

export function DashboardContent({ workspaceId }: DashboardContentProps) {
  const { setPageHeader } = usePageHeader();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [errors, setErrors] = useState<DashboardErrors>({});

  useEffect(() => {
    setPageHeader('Dashboard', 'Overview of your workspace');
  }, [setPageHeader]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/dashboard/activity?limit=5&type=all`);
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();

        // Transform dashboard activity API response to match ActivityEntry interface
        const transformedActivities: ActivityEntry[] = (result.data || []).map((activity: DashboardActivityApiResponse) => ({
          id: activity.id,
          type: activity.type,
          user: {
            name: activity.actor.name,
            displayName: activity.actor.displayName,
          },
          resourceType: activity.target?.type || null,
          resourceName: activity.target?.name || activity.content?.substring(0, 50) || null,
          createdAt: activity.timestamp,
        }));

        setActivities(transformedActivities);
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
        const response = await fetch(`/api/workspaces/${workspaceId}/dashboard/stats?includeActivity=false`);

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const statsData = result.data;

        setStats({
          teamMembers: statsData.members.total || 0,
          channels: statsData.channels.total || 0,
          workflows: statsData.workflows.total || 0,
          orchestrators: statsData.members.orchestratorCount || 0,
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
          teamMembers: 0,
          channels: 0,
          workflows: 0,
          orchestrators: 0,
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
                <StatItem label="Team Members" value={stats?.teamMembers.toString() || '0'} />
                <StatItem label="Channels" value={stats?.channels.toString() || '0'} />
                <StatItem label="Workflows" value={stats?.workflows.toString() || '0'} />
                <StatItem label="Orchestrators" value={stats?.orchestrators.toString() || '0'} />
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
