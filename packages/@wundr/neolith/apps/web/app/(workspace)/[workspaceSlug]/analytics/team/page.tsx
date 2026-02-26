'use client';

import {
  Activity,
  TrendingUp,
  Clock,
  Users,
  MessageSquare,
  Target,
  Zap,
  Award,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

import { Leaderboard } from '@/components/analytics/leaderboard';
import { MetricCard } from '@/components/analytics/metric-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageHeader } from '@/contexts/page-header-context';
import { cn, getInitials } from '@/lib/utils';

// Types
interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  tasksCompleted: number;
  activeHours: number;
  responseTime: number;
  collaborationScore: number;
  productivity: number;
}

interface TimeSeriesData {
  date: string;
  productivity: number;
  collaboration: number;
  activity: number;
}

interface CollaborationPattern {
  from: string;
  to: string;
  interactions: number;
}

interface ResponseTimeData {
  hour: string;
  avgResponseTime: number;
  count: number;
}

// Generate mock data with realistic patterns
function generateMockTeamData(): TeamMember[] {
  const names = [
    'Alice Johnson',
    'Bob Smith',
    'Charlie Davis',
    'Diana Wilson',
    'Ethan Brown',
    'Fiona Martinez',
    'George Lee',
    'Hannah Taylor',
  ];

  return names.map((name, index) => ({
    id: `member-${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(' ', '.')}@company.com`,
    avatarUrl: undefined,
    role: ['Engineer', 'Designer', 'Product Manager', 'QA Engineer'][index % 4],
    tasksCompleted: Math.floor(Math.random() * 50) + 20,
    activeHours: Math.floor(Math.random() * 160) + 80,
    responseTime: Math.floor(Math.random() * 120) + 15,
    collaborationScore: Math.floor(Math.random() * 40) + 60,
    productivity: Math.floor(Math.random() * 30) + 70,
  }));
}

function generateTimeSeriesData(): TimeSeriesData[] {
  const days = 30;
  const data: TimeSeriesData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    data.push({
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      productivity: Math.floor(Math.random() * 30) + 70,
      collaboration: Math.floor(Math.random() * 40) + 60,
      activity: Math.floor(Math.random() * 50) + 50,
    });
  }

  return data;
}

function generateResponseTimeData(): ResponseTimeData[] {
  const hours = [
    '9AM',
    '10AM',
    '11AM',
    '12PM',
    '1PM',
    '2PM',
    '3PM',
    '4PM',
    '5PM',
    '6PM',
  ];
  return hours.map(hour => ({
    hour,
    avgResponseTime: Math.floor(Math.random() * 60) + 20,
    count: Math.floor(Math.random() * 30) + 10,
  }));
}

function generateCollaborationMatrix(
  members: TeamMember[]
): CollaborationPattern[] {
  const patterns: CollaborationPattern[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (Math.random() > 0.3) {
        patterns.push({
          from: members[i].name,
          to: members[j].name,
          interactions: Math.floor(Math.random() * 50) + 5,
        });
      }
    }
  }
  return patterns.sort((a, b) => b.interactions - a.interactions);
}

// Chart configurations
const productivityChartConfig = {
  productivity: {
    label: 'Productivity',
    color: 'hsl(var(--chart-1))',
  },
  collaboration: {
    label: 'Collaboration',
    color: 'hsl(var(--chart-2))',
  },
  activity: {
    label: 'Activity',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const responseTimeChartConfig = {
  avgResponseTime: {
    label: 'Avg Response Time (min)',
    color: 'hsl(var(--chart-4))',
  },
} satisfies ChartConfig;

export default function TeamAnalyticsPage(): JSX.Element {
  const params = useParams();
  const workspaceSlug = params?.workspaceSlug as string | undefined;
  const { setPageHeader } = usePageHeader();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData[]>(
    []
  );
  const [collaborationPatterns, setCollaborationPatterns] = useState<
    CollaborationPattern[]
  >([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    '7d' | '30d' | '90d'
  >('30d');

  useEffect(() => {
    setPageHeader(
      'Team Analytics',
      'Track team productivity and collaboration'
    );
  }, [setPageHeader]);

  useEffect(() => {
    // Simulate data loading
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));

      const members = generateMockTeamData();
      setTeamMembers(members);
      setTimeSeriesData(generateTimeSeriesData());
      setResponseTimeData(generateResponseTimeData());
      setCollaborationPatterns(generateCollaborationMatrix(members));
      setIsLoading(false);
    };

    loadData();
  }, [selectedTimeRange]);

  if (!workspaceSlug) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
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

  // Calculate aggregate metrics
  const totalTasks = teamMembers.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const avgProductivity =
    teamMembers.reduce((sum, m) => sum + m.productivity, 0) /
      teamMembers.length || 0;
  const avgResponseTime =
    teamMembers.reduce((sum, m) => sum + m.responseTime, 0) /
      teamMembers.length || 0;
  const avgCollaboration =
    teamMembers.reduce((sum, m) => sum + m.collaborationScore, 0) /
      teamMembers.length || 0;

  // Leaderboard data
  const productivityLeaderboard = [...teamMembers]
    .sort((a, b) => b.productivity - a.productivity)
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      name: m.name,
      value: m.productivity,
      avatarUrl: m.avatarUrl,
      subtitle: m.role,
    }));

  const tasksLeaderboard = [...teamMembers]
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      name: m.name,
      value: m.tasksCompleted,
      avatarUrl: m.avatarUrl,
      subtitle: m.role,
    }));

  const collaborationLeaderboard = [...teamMembers]
    .sort((a, b) => b.collaborationScore - a.collaborationScore)
    .slice(0, 5)
    .map(m => ({
      id: m.id,
      name: m.name,
      value: m.collaborationScore,
      avatarUrl: m.avatarUrl,
      subtitle: m.role,
    }));

  return (
    <div className='min-h-screen bg-background'>
      <div className='max-w-7xl mx-auto px-4 py-8'>
        {/* Data notice */}
        <div className='mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'>
          Team analytics integration is coming soon. The data shown below is
          illustrative and does not reflect actual workspace activity.
        </div>

        {/* Time Range Selector */}
        <div className='flex justify-end mb-6'>
          <Tabs
            value={selectedTimeRange}
            onValueChange={v =>
              setSelectedTimeRange(v as typeof selectedTimeRange)
            }
          >
            <TabsList>
              <TabsTrigger value='7d'>7 Days</TabsTrigger>
              <TabsTrigger value='30d'>30 Days</TabsTrigger>
              <TabsTrigger value='90d'>90 Days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Key Metrics */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          <MetricCard
            title='Team Size'
            value={teamMembers.length}
            icon={<Users className='w-5 h-5' />}
            format='number'
            isLoading={isLoading}
          />
          <MetricCard
            title='Total Tasks Completed'
            value={totalTasks}
            icon={<Target className='w-5 h-5' />}
            format='number'
            isLoading={isLoading}
          />
          <MetricCard
            title='Avg Productivity'
            value={avgProductivity}
            icon={<TrendingUp className='w-5 h-5' />}
            format='percent'
            isLoading={isLoading}
          />
          <MetricCard
            title='Avg Response Time'
            value={avgResponseTime}
            icon={<Clock className='w-5 h-5' />}
            format='duration'
            isLoading={isLoading}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue='overview' className='space-y-6'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='leaderboard'>Leaderboard</TabsTrigger>
            <TabsTrigger value='collaboration'>Collaboration</TabsTrigger>
            <TabsTrigger value='response-times'>Response Times</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview' className='space-y-6'>
            {/* Productivity Trends */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Activity className='w-5 h-5' />
                  Team Productivity Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='h-80 flex items-center justify-center'>
                    <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
                  </div>
                ) : (
                  <ChartContainer
                    config={productivityChartConfig}
                    className='h-80 w-full'
                  >
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='date' />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Line
                        type='monotone'
                        dataKey='productivity'
                        stroke='var(--color-productivity)'
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type='monotone'
                        dataKey='collaboration'
                        stroke='var(--color-collaboration)'
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type='monotone'
                        dataKey='activity'
                        stroke='var(--color-activity)'
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Team Members Grid */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Users className='w-5 h-5' />
                  Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
                  </div>
                ) : (
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {teamMembers.map(member => (
                      <div
                        key={member.id}
                        className='p-4 border rounded-lg hover:bg-muted/50 transition-colors'
                      >
                        <div className='flex items-start gap-3'>
                          <Avatar className='w-12 h-12'>
                            <AvatarImage
                              src={member.avatarUrl}
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
                            <div className='flex gap-2 mt-2'>
                              <Badge variant='secondary' className='text-xs'>
                                {member.tasksCompleted} tasks
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className='mt-4 space-y-2'>
                          <div className='flex justify-between text-xs'>
                            <span className='text-muted-foreground'>
                              Productivity
                            </span>
                            <span className='font-medium'>
                              {member.productivity}%
                            </span>
                          </div>
                          <div className='w-full bg-muted rounded-full h-1.5'>
                            <div
                              className='bg-primary h-1.5 rounded-full transition-all'
                              style={{ width: `${member.productivity}%` }}
                            />
                          </div>
                          <div className='flex justify-between text-xs'>
                            <span className='text-muted-foreground'>
                              Collaboration
                            </span>
                            <span className='font-medium'>
                              {member.collaborationScore}%
                            </span>
                          </div>
                          <div className='w-full bg-muted rounded-full h-1.5'>
                            <div
                              className='bg-emerald-500 h-1.5 rounded-full transition-all'
                              style={{ width: `${member.collaborationScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value='leaderboard' className='space-y-6'>
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg'>
                    <Award className='w-5 h-5 text-amber-500' />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Leaderboard
                    data={productivityLeaderboard}
                    valueLabel='Score'
                    showRank
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2 text-lg'>
                    <Target className='w-5 h-5 text-blue-500' />
                    Most Tasks
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
                  <CardTitle className='flex items-center gap-2 text-lg'>
                    <MessageSquare className='w-5 h-5 text-emerald-500' />
                    Best Collaborators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Leaderboard
                    data={collaborationLeaderboard}
                    valueLabel='Score'
                    showRank
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Collaboration Tab */}
          <TabsContent value='collaboration' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <MessageSquare className='w-5 h-5' />
                  Collaboration Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
                  </div>
                ) : (
                  <div className='space-y-3'>
                    {collaborationPatterns
                      .slice(0, 10)
                      .map((pattern, index) => (
                        <div
                          key={`${pattern.from}-${pattern.to}`}
                          className='flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors'
                        >
                          <span className='text-xs font-medium text-muted-foreground w-6'>
                            #{index + 1}
                          </span>
                          <div className='flex items-center gap-2 flex-1'>
                            <Avatar className='w-8 h-8'>
                              <AvatarFallback className='text-xs'>
                                {getInitials(pattern.from)}
                              </AvatarFallback>
                            </Avatar>
                            <span className='text-sm font-medium'>
                              {pattern.from}
                            </span>
                            <svg
                              className='w-4 h-4 text-muted-foreground'
                              fill='none'
                              viewBox='0 0 24 24'
                              stroke='currentColor'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
                              />
                            </svg>
                            <Avatar className='w-8 h-8'>
                              <AvatarFallback className='text-xs'>
                                {getInitials(pattern.to)}
                              </AvatarFallback>
                            </Avatar>
                            <span className='text-sm font-medium'>
                              {pattern.to}
                            </span>
                          </div>
                          <Badge variant='secondary'>
                            {pattern.interactions} interactions
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Response Times Tab */}
          <TabsContent value='response-times' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Clock className='w-5 h-5' />
                  Average Response Times by Hour
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='h-80 flex items-center justify-center'>
                    <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
                  </div>
                ) : (
                  <ChartContainer
                    config={responseTimeChartConfig}
                    className='h-80 w-full'
                  >
                    <BarChart data={responseTimeData}>
                      <CartesianGrid strokeDasharray='3 3' />
                      <XAxis dataKey='hour' />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend />
                      <Bar
                        dataKey='avgResponseTime'
                        fill='var(--color-avgResponseTime)'
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Response Time Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Zap className='w-5 h-5' />
                  Fastest Responders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin' />
                  </div>
                ) : (
                  <Leaderboard
                    data={[...teamMembers]
                      .sort((a, b) => a.responseTime - b.responseTime)
                      .slice(0, 5)
                      .map(m => ({
                        id: m.id,
                        name: m.name,
                        value: m.responseTime,
                        avatarUrl: m.avatarUrl,
                        subtitle: `${m.role} - ${m.responseTime}min avg`,
                      }))}
                    valueLabel='Minutes'
                    showRank
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
