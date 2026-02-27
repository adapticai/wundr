'use client';

import {
  Activity,
  Award,
  Clock,
  MessageSquare,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Leaderboard } from '@/components/analytics/leaderboard';
import { MetricCard } from '@/components/analytics/metric-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { getInitials } from '@/lib/utils';

// Types matching the workspace members API response
interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    status: string;
    lastActiveAt: string | null;
  };
}

interface MemberAnalytics {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  lastActiveAt: string | null;
  tasksCompleted: number;
  taskCompletionRate: number;
  messagesSent: number;
  avgMessagesPerDay: number;
}

type TimeRange = '7d' | '30d' | '90d';

function MemberSkeleton() {
  return (
    <div className='p-4 border rounded-lg space-y-3'>
      <div className='flex items-start gap-3'>
        <Skeleton className='w-12 h-12 rounded-full' />
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-3 w-20' />
        </div>
      </div>
      <Skeleton className='h-3 w-full' />
      <Skeleton className='h-3 w-3/4' />
    </div>
  );
}

export default function TeamAnalyticsPage(): JSX.Element {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();

  const [members, setMembers] = useState<MemberAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    setPageHeader(
      'Team Analytics',
      'Track team productivity and collaboration'
    );
  }, [setPageHeader]);

  const fetchData = useCallback(async () => {
    if (!workspaceSlug) return;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch workspace members list
      const membersRes = await fetch(
        `/api/workspaces/${workspaceSlug}/members`
      );

      if (!membersRes.ok) {
        const errorData = await membersRes
          .json()
          .catch(() => ({ error: 'Failed to fetch team members' }));
        throw new Error(errorData.error || 'Failed to fetch team members');
      }

      const membersData: { members: WorkspaceMember[] } =
        await membersRes.json();
      const workspaceMembers = membersData.members ?? [];

      if (workspaceMembers.length === 0) {
        setMembers([]);
        return;
      }

      // Calculate date range
      const days =
        selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : 90;
      const toDate = new Date();
      const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
      const fromParam = fromDate.toISOString();
      const toParam = toDate.toISOString();

      // Fetch per-user analytics in parallel (cap at 20 to avoid overwhelming the API)
      const membersToFetch = workspaceMembers.slice(0, 20);
      const analyticsResults = await Promise.allSettled(
        membersToFetch.map(member =>
          fetch(
            `/api/workspaces/${workspaceSlug}/users/${member.userId}/analytics?from=${fromParam}&to=${toParam}`
          ).then(res => (res.ok ? res.json() : null))
        )
      );

      const enrichedMembers: MemberAnalytics[] = membersToFetch.map(
        (member, index) => {
          const result = analyticsResults[index];
          const analytics =
            result.status === 'fulfilled' && result.value
              ? result.value.data
              : null;

          const displayName =
            member.user.displayName || member.user.name || member.user.email;

          return {
            userId: member.userId,
            name: displayName,
            email: member.user.email,
            avatarUrl: member.user.avatarUrl,
            role: member.role,
            status: member.user.status,
            lastActiveAt: member.user.lastActiveAt,
            tasksCompleted: analytics?.tasks?.completed ?? 0,
            taskCompletionRate: analytics?.tasks?.completionRate ?? 0,
            messagesSent: analytics?.messages?.sent ?? 0,
            avgMessagesPerDay: analytics?.messages?.avgPerDay ?? 0,
          };
        }
      );

      setMembers(enrichedMembers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load team analytics'
      );
    } finally {
      setIsLoading(false);
    }
  }, [workspaceSlug, selectedTimeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!workspaceSlug) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center'>
          <p className='text-lg font-medium text-foreground'>
            Invalid workspace
          </p>
          <p className='text-sm text-muted-foreground mt-2'>
            Unable to load team analytics
          </p>
        </div>
      </div>
    );
  }

  if (error && members.length === 0) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-center max-w-sm'>
          <Users className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
          <p className='text-base font-medium text-foreground mb-2'>
            Failed to load team analytics
          </p>
          <p className='text-sm text-muted-foreground mb-4'>{error}</p>
          <Button onClick={fetchData} size='sm'>
            <RefreshCw className='h-4 w-4 mr-2' />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Aggregate metrics from real data
  const totalTasks = members.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const totalMessages = members.reduce((sum, m) => sum + m.messagesSent, 0);
  const avgCompletionRate =
    members.length > 0
      ? members.reduce((sum, m) => sum + m.taskCompletionRate, 0) /
        members.length
      : 0;
  const activeMembers = members.filter(
    m =>
      m.status === 'ONLINE' ||
      m.status === 'AWAY' ||
      (m.lastActiveAt &&
        new Date(m.lastActiveAt) >
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  ).length;

  // Leaderboard data
  const tasksLeaderboard = [...members]
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5)
    .map(m => ({
      id: m.userId,
      name: m.name,
      value: m.tasksCompleted,
      avatarUrl: m.avatarUrl ?? undefined,
      subtitle: m.role,
    }));

  const messagesLeaderboard = [...members]
    .sort((a, b) => b.messagesSent - a.messagesSent)
    .slice(0, 5)
    .map(m => ({
      id: m.userId,
      name: m.name,
      value: m.messagesSent,
      avatarUrl: m.avatarUrl ?? undefined,
      subtitle: m.role,
    }));

  const completionRateLeaderboard = [...members]
    .filter(m => m.tasksCompleted > 0)
    .sort((a, b) => b.taskCompletionRate - a.taskCompletionRate)
    .slice(0, 5)
    .map(m => ({
      id: m.userId,
      name: m.name,
      value: Math.round(m.taskCompletionRate),
      avatarUrl: m.avatarUrl ?? undefined,
      subtitle: m.role,
    }));

  const hasData = !isLoading && members.length > 0;

  return (
    <div className='space-y-6'>
      {/* Time Range Selector */}
      <div className='flex justify-end'>
        <Tabs
          value={selectedTimeRange}
          onValueChange={v => setSelectedTimeRange(v as TimeRange)}
        >
          <TabsList>
            <TabsTrigger value='7d'>7 Days</TabsTrigger>
            <TabsTrigger value='30d'>30 Days</TabsTrigger>
            <TabsTrigger value='90d'>90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <MetricCard
          title='Team Size'
          value={isLoading ? 0 : members.length}
          icon={<Users className='w-5 h-5' />}
          format='number'
          isLoading={isLoading}
        />
        <MetricCard
          title='Active Members'
          value={isLoading ? 0 : activeMembers}
          icon={<Activity className='w-5 h-5' />}
          format='number'
          isLoading={isLoading}
        />
        <MetricCard
          title='Tasks Completed'
          value={isLoading ? 0 : totalTasks}
          icon={<Target className='w-5 h-5' />}
          format='number'
          isLoading={isLoading}
        />
        <MetricCard
          title='Avg Completion Rate'
          value={isLoading ? 0 : avgCompletionRate}
          icon={<TrendingUp className='w-5 h-5' />}
          format='percent'
          isLoading={isLoading}
        />
      </div>

      {/* Empty state */}
      {!isLoading && members.length === 0 && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <Users className='h-12 w-12 text-muted-foreground mb-4' />
            <CardTitle className='mb-2'>No team members found</CardTitle>
            <CardDescription className='max-w-sm'>
              Add members to your workspace to start tracking team analytics.
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      {(isLoading || hasData) && (
        <Tabs defaultValue='overview' className='space-y-6'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='leaderboard'>Leaderboard</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='w-5 h-5' />
                  Team Members
                </CardTitle>
                <CardDescription>
                  Individual activity for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <MemberSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {members.map(member => (
                      <div
                        key={member.userId}
                        className='p-4 border rounded-lg hover:bg-muted/50 transition-colors'
                      >
                        <div className='flex items-start gap-3'>
                          <Avatar className='w-10 h-10'>
                            <AvatarImage
                              src={member.avatarUrl ?? undefined}
                              alt={member.name}
                            />
                            <AvatarFallback>
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className='flex-1 min-w-0'>
                            <h4 className='font-medium text-sm truncate'>
                              {member.name}
                            </h4>
                            <p className='text-xs text-muted-foreground truncate'>
                              {member.role}
                            </p>
                          </div>
                        </div>
                        <div className='mt-3 grid grid-cols-2 gap-2'>
                          <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                            <Target className='w-3.5 h-3.5 flex-shrink-0' />
                            <span>
                              <span className='font-medium text-foreground'>
                                {member.tasksCompleted}
                              </span>{' '}
                              tasks
                            </span>
                          </div>
                          <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                            <MessageSquare className='w-3.5 h-3.5 flex-shrink-0' />
                            <span>
                              <span className='font-medium text-foreground'>
                                {member.messagesSent}
                              </span>{' '}
                              messages
                            </span>
                          </div>
                        </div>
                        {member.tasksCompleted > 0 && (
                          <div className='mt-3 space-y-1'>
                            <div className='flex justify-between text-xs'>
                              <span className='text-muted-foreground'>
                                Completion rate
                              </span>
                              <span className='font-medium'>
                                {member.taskCompletionRate.toFixed(0)}%
                              </span>
                            </div>
                            <div className='w-full bg-muted rounded-full h-1.5'>
                              <div
                                className='bg-primary h-1.5 rounded-full transition-all'
                                style={{
                                  width: `${Math.min(member.taskCompletionRate, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary */}
            {hasData && (
              <div className='grid gap-4 sm:grid-cols-2'>
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <MessageSquare className='w-4 h-4' />
                      Messaging Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-3'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          Total messages sent
                        </span>
                        <span className='font-medium'>
                          {totalMessages.toLocaleString()}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          Messages per member
                        </span>
                        <span className='font-medium'>
                          {members.length > 0
                            ? Math.round(
                                totalMessages / members.length
                              ).toLocaleString()
                            : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <Target className='w-4 h-4' />
                      Task Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-3'>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          Total tasks completed
                        </span>
                        <span className='font-medium'>
                          {totalTasks.toLocaleString()}
                        </span>
                      </div>
                      <div className='flex justify-between text-sm'>
                        <span className='text-muted-foreground'>
                          Tasks per member
                        </span>
                        <span className='font-medium'>
                          {members.length > 0
                            ? Math.round(
                                totalTasks / members.length
                              ).toLocaleString()
                            : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value='leaderboard' className='space-y-6'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <Target className='w-4 h-4 text-blue-500' />
                    Most Tasks Completed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Leaderboard
                    data={tasksLeaderboard}
                    valueLabel='Tasks'
                    showRank
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <MessageSquare className='w-4 h-4 text-emerald-500' />
                    Most Messages Sent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Leaderboard
                    data={messagesLeaderboard}
                    valueLabel='Messages'
                    showRank
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <Award className='w-4 h-4 text-amber-500' />
                    Highest Completion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completionRateLeaderboard.length > 0 ? (
                    <Leaderboard
                      data={completionRateLeaderboard}
                      valueLabel='%'
                      showRank
                      isLoading={isLoading}
                    />
                  ) : (
                    <p className='text-sm text-muted-foreground py-4 text-center'>
                      No task data available for this period.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
