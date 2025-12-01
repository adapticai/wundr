'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { useAuth } from '@/hooks/use-auth';
import { usePageHeader } from '@/contexts/page-header-context';

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

interface Channel {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  unreadCount?: number;
}

interface DashboardErrors {
  activities?: string;
  stats?: string;
  channels?: string;
}

export function DashboardContent({ workspaceId }: DashboardContentProps) {
  const { setPageHeader } = usePageHeader();
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [errors, setErrors] = useState<DashboardErrors>({});

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
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
        setErrors(prev => ({ ...prev, activities: undefined }));
      } catch (error) {
        console.error('Failed to fetch activities:', error);
        setErrors(prev => ({
          ...prev,
          activities:
            error instanceof Error
              ? error.message
              : 'Failed to load recent activity',
        }));
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
        setErrors(prev => ({ ...prev, stats: undefined }));
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setErrors(prev => ({
          ...prev,
          stats:
            error instanceof Error
              ? error.message
              : 'Failed to load workspace statistics',
        }));
      } finally {
        setIsLoadingStats(false);
      }
    };

    const fetchChannels = async () => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/channels?limit=6`
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch channels: ${response.status} ${response.statusText}`
          );
        }
        const result = await response.json();
        setChannels(result.data || []);
        setErrors(prev => ({ ...prev, channels: undefined }));
      } catch (error) {
        console.error('Failed to fetch channels:', error);
        setErrors(prev => ({
          ...prev,
          channels:
            error instanceof Error ? error.message : 'Failed to load channels',
        }));
        setChannels([]);
      } finally {
        setIsLoadingChannels(false);
      }
    };

    fetchActivities();
    fetchStats();
    fetchChannels();
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

  const isLoading = isLoadingActivities || isLoadingStats || isLoadingChannels;

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
                  <Button variant='outline' size='sm'>
                    All
                  </Button>
                  <Button variant='ghost' size='sm'>
                    Channels
                  </Button>
                  <Button variant='ghost' size='sm'>
                    DMs
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {errors.activities ? (
                  <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
                    <p className='font-medium'>Error loading activity</p>
                    <p className='mt-1 text-xs'>{errors.activities}</p>
                  </div>
                ) : activities.length > 0 ? (
                  <div className='space-y-4'>
                    {activities.map(activity => (
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

            {/* Your Channels */}
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-4'>
                <div>
                  <CardTitle>Your Channels</CardTitle>
                  <CardDescription>Frequently visited channels</CardDescription>
                </div>
                <Button variant='ghost' size='sm' asChild>
                  <Link href={`/${workspaceId}/channels`}>See all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {errors.channels ? (
                  <div className='rounded-md bg-destructive/10 p-4 text-sm text-destructive'>
                    <p className='font-medium'>Error loading channels</p>
                    <p className='mt-1 text-xs'>{errors.channels}</p>
                  </div>
                ) : channels.length > 0 ? (
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                    {channels.map(channel => (
                      <Link
                        key={channel.id}
                        href={`/${workspaceId}/channels/${channel.id}`}
                        className='flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors'
                      >
                        <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
                          <HashIcon className='h-5 w-5 text-primary' />
                        </div>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium truncate'>
                            {channel.name}
                          </p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {channel.description || 'No description'}
                          </p>
                        </div>
                        {channel.unreadCount && channel.unreadCount > 0 && (
                          <Badge variant='default' className='ml-auto'>
                            {channel.unreadCount}
                          </Badge>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className='flex flex-col items-center justify-center py-8 text-center'>
                    <p className='text-sm text-muted-foreground'>
                      No channels yet
                    </p>
                    <Button variant='link' size='sm' asChild className='mt-2'>
                      <Link href={`/${workspaceId}/channels`}>
                        Create your first channel
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className='space-y-6'>
            {/* Quick Actions */}
            <Card>
              <CardHeader className='pb-4'>
                <CardTitle className='text-base'>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  asChild
                >
                  <Link href={`/${workspaceId}/channels/new`}>
                    <PlusIcon className='mr-2 h-4 w-4' />
                    New message
                  </Link>
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  asChild
                >
                  <Link href={`/${workspaceId}/channels`}>
                    <HashIcon className='mr-2 h-4 w-4' />
                    Create channel
                  </Link>
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  asChild
                >
                  <Link href={`/${workspaceId}/admin/members`}>
                    <UsersIcon className='mr-2 h-4 w-4' />
                    Invite teammate
                  </Link>
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  asChild
                >
                  <Link href={`/${workspaceId}/orchestrators`}>
                    <BotIcon className='mr-2 h-4 w-4' />
                    Browse orchestrators
                  </Link>
                </Button>
              </CardContent>
            </Card>

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

function HashIcon({ className }: { className?: string }) {
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
      <line x1='4' x2='20' y1='9' y2='9' />
      <line x1='4' x2='20' y1='15' y2='15' />
      <line x1='10' x2='8' y1='3' y2='21' />
      <line x1='16' x2='14' y1='3' y2='21' />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d='M5 12h14' />
      <path d='M12 5v14' />
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

function BotIcon({ className }: { className?: string }) {
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
      <path d='M12 8V4H8' />
      <rect width='16' height='12' x='4' y='8' rx='2' />
      <path d='M2 14h2' />
      <path d='M20 14h2' />
      <path d='M15 13v2' />
      <path d='M9 13v2' />
    </svg>
  );
}
