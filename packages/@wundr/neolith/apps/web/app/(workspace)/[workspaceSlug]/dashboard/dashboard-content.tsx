'use client';

import { useEffect, useState } from 'react';

import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { usePageHeader } from '@/contexts/page-header-context';
import { useAuth } from '@/hooks/use-auth';

import { AdminDashboardSection } from './components/admin-dashboard-section';
import { ChannelsWidget } from './components/channels-widget';
import { MemberDashboardSection } from './components/member-dashboard-section';
import { QuickActionsWidget } from './components/quick-actions-widget';
import { StatusWidget } from './components/status-widget';
import { ThreadsWidget } from './components/threads-widget';
import { WorkspaceSwitcherWidget } from './components/workspace-switcher-widget';

interface DashboardContentProps {
  workspaceId: string;
}

interface ActivityEntry {
  id: string;
  type: string;
  action: string;
  actor: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

interface WorkspaceStats {
  members: {
    total: number;
    activeToday: number;
    orchestratorCount: number;
  };
  channels: {
    total: number;
  };
  messages: {
    today: number;
  };
  workflows: {
    total: number;
  };
}

export function DashboardContent({ workspaceId }: DashboardContentProps) {
  const { setPageHeader } = usePageHeader();
  const { user, role } = useAuth();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'channels' | 'dms'
  >('all');

  // Determine if user is admin
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  };

  useEffect(() => {
    setPageHeader('Home', 'Your workspace overview');
  }, [setPageHeader]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/activity?limit=10&type=all`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch activities: ${response.status} ${response.statusText}`
          );
        }
        const result = await response.json();
        setActivities(result.data || []);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setActivities([]);
      } finally {
        setIsLoadingActivities(false);
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/dashboard/stats?includeActivity=false`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch stats: ${response.status} ${response.statusText}`
          );
        }
        const result = await response.json();
        setStats(result.data);
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
  };

  // Filter activities based on the selected filter
  const filteredActivities = activities.filter(activity => {
    if (activityFilter === 'all') {
      return true;
    }
    if (activityFilter === 'channels') {
      return activity.target?.type === 'channel';
    }
    if (activityFilter === 'dms') {
      return (
        activity.target?.type === 'direct_message' ||
        activity.type === 'direct_message'
      );
    }
    return true;
  });

  const isLoading = isLoadingActivities || isLoadingStats;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className='h-full overflow-auto'>
      {/* Header with Greeting */}
      <div className='border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex items-center gap-4 px-6 py-6'>
          <div className='flex-1'>
            <h1 className='text-3xl font-bold tracking-tight'>
              {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
            </h1>
            <p className='text-muted-foreground mt-1'>
              Here's what's happening in your workspace
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='p-6'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Left Column - Main Content (2 columns wide on large screens) */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Quick Actions Widget - Top of dashboard */}
            <QuickActionsWidget workspaceSlug={workspaceId} />

            {/* Role-based sections */}
            {isAdmin ? (
              <AdminDashboardSection workspaceId={workspaceId} />
            ) : (
              <MemberDashboardSection workspaceId={workspaceId} />
            )}
            {/* Recent Activity Feed */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest updates from your workspace
                  </CardDescription>
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant={activityFilter === 'all' ? 'outline' : 'ghost'}
                    size='sm'
                    onClick={() => setActivityFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={
                      activityFilter === 'channels' ? 'outline' : 'ghost'
                    }
                    size='sm'
                    onClick={() => setActivityFilter('channels')}
                  >
                    Channels
                  </Button>
                  <Button
                    variant={activityFilter === 'dms' ? 'outline' : 'ghost'}
                    size='sm'
                    onClick={() => setActivityFilter('dms')}
                  >
                    DMs
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredActivities.length > 0 ? (
                  <div className='space-y-4'>
                    {filteredActivities.map(activity => (
                      <div
                        key={activity.id}
                        className='flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0'
                      >
                        <UserAvatar
                          user={{
                            name:
                              activity.actor.displayName || activity.actor.name,
                            avatarUrl: activity.actor.avatarUrl,
                          }}
                          size='md'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-start justify-between gap-2'>
                            <div className='flex-1'>
                              <p className='text-sm font-medium'>
                                {activity.actor.displayName ||
                                  activity.actor.name ||
                                  'Unknown user'}
                                {activity.actor.isOrchestrator && (
                                  <Badge
                                    variant='secondary'
                                    className='ml-2 text-xs'
                                  >
                                    AI
                                  </Badge>
                                )}
                              </p>
                              <p className='text-sm text-muted-foreground mt-0.5'>
                                {activity.action}{' '}
                                {activity.target &&
                                  `in #${activity.target.name}`}
                              </p>
                              {activity.content && (
                                <p className='text-sm mt-2 line-clamp-2'>
                                  {activity.content}
                                </p>
                              )}
                            </div>
                            <span className='text-xs text-muted-foreground whitespace-nowrap'>
                              {formatActivityTime(activity.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center py-12 text-center'>
                    <div className='rounded-full bg-muted p-4 mb-4'>
                      <ActivityIcon className='h-6 w-6 text-muted-foreground' />
                    </div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      No recent activity
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      Activity will appear here as your team works
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Channels Widget - Integrated starred/frequent channels */}
            <ChannelsWidget workspaceSlug={workspaceId} limit={6} />
          </div>

          {/* Right Sidebar */}
          <div className='space-y-6'>
            {/* Workspace Switcher Widget - Show if user has multiple workspaces */}
            <WorkspaceSwitcherWidget currentWorkspaceSlug={workspaceId} />

            {/* Status Widget */}
            <StatusWidget workspaceSlug={workspaceId} />

            {/* Threads & Mentions Widget */}
            <ThreadsWidget workspaceSlug={workspaceId} limit={5} />

            {/* Workspace Stats */}
            {stats && (
              <Card>
                <CardHeader className='pb-4'>
                  <CardTitle className='text-base'>Workspace Stats</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <div className='h-2 w-2 rounded-full bg-green-500'></div>
                      <span className='text-sm text-muted-foreground'>
                        Members online
                      </span>
                    </div>
                    <span className='text-sm font-medium'>
                      {stats.members.activeToday}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                      Messages today
                    </span>
                    <span className='text-sm font-medium'>
                      {stats.messages.today}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                      Active channels
                    </span>
                    <span className='text-sm font-medium'>
                      {stats.channels.total}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-muted-foreground'>
                      Total members
                    </span>
                    <span className='text-sm font-medium'>
                      {stats.members.total}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon Components
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
      <path d='M12 20h9' />
      <path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
    </svg>
  );
}
