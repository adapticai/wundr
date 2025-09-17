'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useGitActivity } from '@/hooks/use-git-activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SummaryCard } from '@/components/dashboard/summary-card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  AreaChart,
  Area
} from 'recharts';
import {
  GitBranch,
  GitCommit,
  Users,
  FileText,
  Plus,
  Minus,
  Calendar,
  Clock,
  TrendingUp,
  Activity,
  Code,
  RefreshCw,
  GitPullRequest,
  AlertCircle,
  Star,
  GitMerge
} from 'lucide-react';
import { format, subDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { TimeRange } from '@/types/data';

interface RepositoryInfo {
  name: string;
  branch: string;
  lastCommit: {
    hash: string;
    author: string;
    message: string;
    date: string;
  };
  status: {
    clean: boolean;
    staged: number;
    modified: number;
    untracked: number;
  };
}

interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
  additions: number;
  deletions: number;
  files: string[];
}

interface ContributorStats {
  author: string;
  commits: number;
  additions: number;
  deletions: number;
  files: number;
  percentage: number;
}

export default function GitDashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [repoInfo, setRepoInfo] = useState<RepositoryInfo | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  
  const { data, loading, error, refresh, stats, heatmapData } = useGitActivity({
    timeRange,
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
  });

  // Fetch additional git information
  const fetchGitInfo = async () => {
    try {
      // Get repository status
      const statusResponse = await fetch('/api/git?action=status');
      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        if (statusResult.success) {
          const status = statusResult.data;
          setRepoInfo({
            name: 'wundr', // Could be extracted from git remote
            branch: status.branch,
            lastCommit: {
              hash: '',
              author: '',
              message: '',
              date: new Date().toISOString(),
            },
            status: {
              clean: status.clean,
              staged: status.staged.length,
              modified: status.modified.length,
              untracked: status.untracked.length,
            },
          });
        }
      }

      // Get commit log
      const logResponse = await fetch(`/api/git?action=log&limit=50&stat=true`);
      if (logResponse.ok) {
        const logResult = await logResponse.json();
        if (logResult.success) {
          setCommits(logResult.data);
          if (logResult.data.length > 0 && repoInfo) {
            setRepoInfo(prev => prev ? {
              ...prev,
              lastCommit: {
                hash: logResult.data[0].hash,
                author: logResult.data[0].author,
                message: logResult.data[0].message,
                date: logResult.data[0].date,
              }
            } : null);
          }
        }
      }

      // Get branches
      const branchesResponse = await fetch('/api/git?action=branches');
      if (branchesResponse.ok) {
        const branchesResult = await branchesResponse.json();
        if (branchesResult.success) {
          setBranches(branchesResult.data.map((b: any) => b.name));
        }
      }
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  };

  // Fetch git info on component mount
  useEffect(() => {
    fetchGitInfo();
  }, []);

  // Process contributor statistics
  const contributorStats = useMemo((): ContributorStats[] => {
    if (!commits.length) return [];
    
    const contributorMap = new Map<string, ContributorStats>();
    const totalCommits = commits.length;
    
    commits.forEach(commit => {
      const existing = contributorMap.get(commit.author) || {
        author: commit.author,
        commits: 0,
        additions: 0,
        deletions: 0,
        files: 0,
        percentage: 0,
      };
      
      existing.commits++;
      existing.additions += commit.additions;
      existing.deletions += commit.deletions;
      existing.files += commit.files.length;
      
      contributorMap.set(commit.author, existing);
    });
    
    return Array.from(contributorMap.values())
      .map(contributor => ({
        ...contributor,
        percentage: (contributor.commits / totalCommits) * 100,
      }))
      .sort((a, b) => b.commits - a.commits);
  }, [commits]);

  // Process file change patterns
  const fileChangeData = useMemo(() => {
    if (!data.length) return [];
    
    return data.map(activity => ({
      date: format(new Date(activity.timestamp), 'MM/dd'),
      additions: activity.additions,
      deletions: activity.deletions,
      net: activity.additions - activity.deletions,
    })).slice(-30); // Last 30 data points
  }, [data]);

  // Process commit frequency data
  const commitFrequencyData = useMemo(() => {
    if (!data.length) return [];
    
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      commits: 0,
      label: `${hour.toString().padStart(2, '0')}:00`,
    }));
    
    // This would ideally use actual commit timestamps
    // For now, we'll simulate based on activity data
    data.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      hourlyData[hour].commits += activity.commits;
    });
    
    return hourlyData;
  }, [data]);

  // Generate heatmap data
  const calendarHeatmapData = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 365);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    const activityMap = new Map(
      heatmapData.map(d => [d.date, d.count])
    );
    
    return allDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
        day: day.getDay(),
        week: Math.floor((day.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)),
      };
    });
  }, [heatmapData]);

  // Code churn metrics
  const churnMetrics = useMemo(() => {
    if (!data.length) return { churn: 0, stability: 0 };
    
    const totalAdditions = data.reduce((sum, d) => sum + d.additions, 0);
    const totalDeletions = data.reduce((sum, d) => sum + d.deletions, 0);
    const churn = totalAdditions + totalDeletions;
    const stability = totalAdditions > 0 ? (totalAdditions / (totalAdditions + totalDeletions)) * 100 : 0;
    
    return { churn, stability };
  }, [data]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Git Integration & Activity</h1>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message}
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 w-full"
              onClick={() => error.retry?.()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Git Integration & Activity</h1>
          <p className="text-sm text-muted-foreground">
            Repository insights and development metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { refresh(); fetchGitInfo(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Repository Info Card */}
      {repoInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Repository Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Repository</p>
                <p className="text-lg font-semibold">{repoInfo.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Branch</p>
                <Badge variant="outline">{repoInfo.branch}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={repoInfo.status.clean ? "default" : "secondary"}>
                  {repoInfo.status.clean ? "Clean" : "Modified"}
                </Badge>
              </div>
              {repoInfo.lastCommit.hash && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Commit</p>
                    <p className="text-sm font-mono">{repoInfo.lastCommit.hash.substring(0, 8)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Author</p>
                    <p className="text-sm">{repoInfo.lastCommit.author}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p className="text-sm">{format(new Date(repoInfo.lastCommit.date), 'PPp')}</p>
                  </div>
                </>
              )}
            </div>
            {!repoInfo.status.clean && (
              <div className="mt-4 flex gap-4">
                <div className="text-sm">
                  <span className="font-medium">Staged:</span> {repoInfo.status.staged}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Modified:</span> {repoInfo.status.modified}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Untracked:</span> {repoInfo.status.untracked}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Commits"
          value={stats.totalCommits}
          icon={GitCommit}
          description={`Avg ${stats.averageCommitsPerDay.toFixed(1)}/day`}
        />
        <SummaryCard
          title="Active Contributors"
          value={stats.activeContributors}
          icon={Users}
          description={`${contributorStats.length} total contributors`}
        />
        <SummaryCard
          title="Lines Added"
          value={stats.totalAdditions}
          icon={Plus}
          variant="info"
          description="Code additions"
        />
        <SummaryCard
          title="Lines Removed"
          value={stats.totalDeletions}
          icon={Minus}
          variant="warning"
          description="Code deletions"
        />
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="commits">Commits</TabsTrigger>
          <TabsTrigger value="contributors">Contributors</TabsTrigger>
          <TabsTrigger value="files">File Changes</TabsTrigger>
          <TabsTrigger value="heatmap">Calendar</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Commit Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'PPp')}
                    />
                    <Area
                      type="monotone"
                      dataKey="commits"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commit Frequency by Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={commitFrequencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="commits" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Commits Tab */}
        <TabsContent value="commits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Commits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {commits.slice(0, 10).map((commit) => (
                  <div key={commit.hash} className="border-b pb-3 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{commit.message}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{commit.author}</span>
                          <span>{format(new Date(commit.date), 'MMM dd, HH:mm')}</span>
                          <code className="px-1 py-0.5 bg-muted rounded text-xs">
                            {commit.shortHash}
                          </code>
                        </div>
                      </div>
                      <div className="flex gap-2 text-sm">
                        <Badge variant="secondary">
                          <Plus className="h-3 w-3 mr-1" />
                          {commit.additions}
                        </Badge>
                        <Badge variant="secondary">
                          <Minus className="h-3 w-3 mr-1" />
                          {commit.deletions}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contributors Tab */}
        <TabsContent value="contributors" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contributor Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contributorStats.slice(0, 8).map((contributor, index) => (
                    <div key={contributor.author} className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{contributor.author}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{contributor.commits} commits</span>
                          <span>•</span>
                          <span>{contributor.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-green-600">+{contributor.additions}</div>
                        <div className="text-red-600">-{contributor.deletions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contribution Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={contributorStats.slice(0, 5)}
                      dataKey="commits"
                      nameKey="author"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                    >
                      {contributorStats.slice(0, 5).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* File Changes Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>File Changes Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={fileChangeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="additions" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="deletions" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Heatmap Tab */}
        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commit Activity Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[800px] space-y-1">
                  {/* Days of the week labels */}
                  <div className="flex gap-1">
                    <div className="w-8"></div>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="w-3 text-xs text-center text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar grid */}
                  <div className="space-y-1">
                    {Array.from({ length: 53 }, (_, week) => (
                      <div key={week} className="flex gap-1">
                        {week % 4 === 0 && (
                          <div className="w-8 text-xs text-muted-foreground">
                            {format(subDays(new Date(), (52 - week) * 7), 'MMM')}
                          </div>
                        )}
                        {week % 4 !== 0 && <div className="w-8"></div>}
                        {Array.from({ length: 7 }, (_, day) => {
                          const dayData = calendarHeatmapData.find(
                            d => d.week === week && d.day === day
                          );
                          const intensity = dayData 
                            ? Math.min(4, Math.floor(dayData.count / 2))
                            : 0;
                          const colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
                          
                          return (
                            <div
                              key={day}
                              className="w-3 h-3 rounded-sm border border-gray-200 dark:border-gray-700"
                              style={{ backgroundColor: colors[intensity] }}
                              title={dayData ? `${dayData.date}: ${dayData.count} commits` : ''}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <span className="text-xs text-muted-foreground">Less</span>
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-sm border border-gray-200"
                        style={{ backgroundColor: ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'][i] }}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground">More</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Code Churn</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{churnMetrics.churn.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Total lines changed</p>
                <div className="mt-4">
                  <p className="text-sm font-medium">Code Stability</p>
                  <Progress value={churnMetrics.stability} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {churnMetrics.stability.toFixed(1)}% additions vs deletions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Branch Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{branches.length}</div>
                <p className="text-sm text-muted-foreground">Total branches</p>
                <div className="mt-4 space-y-1">
                  {branches.slice(0, 5).map((branch) => (
                    <Badge key={branch} variant="outline" className="mr-1">
                      {branch}
                    </Badge>
                  ))}
                  {branches.length > 5 && (
                    <Badge variant="outline">+{branches.length - 5} more</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Repository Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Commit Frequency</span>
                    <Badge variant={stats.commitFrequency === 'high' ? 'default' : 
                           stats.commitFrequency === 'medium' ? 'secondary' : 'outline'}>
                      {stats.commitFrequency}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Most Active Hour</span>
                    <span className="text-sm font-medium">{stats.mostActiveHour}:00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Repository Status</span>
                    <Badge variant={repoInfo?.status.clean ? 'default' : 'secondary'}>
                      {repoInfo?.status.clean ? 'Clean' : 'Modified'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}