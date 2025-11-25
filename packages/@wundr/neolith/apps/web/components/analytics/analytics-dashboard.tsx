'use client';

import { clsx } from 'clsx';
import { useState, useEffect, useCallback } from 'react';

import { BarChart } from './bar-chart';
import { Leaderboard } from './leaderboard';
import { LineChart } from './line-chart';
import { MetricCard } from './metric-card';

/**
 * Props for the AnalyticsDashboard component.
 */
export interface AnalyticsDashboardProps {
  /** The workspace ID to fetch analytics data for */
  workspaceId: string;
  /** Additional CSS classes to apply */
  className?: string;
}

interface UsageMetrics {
  messages: {
    total: number;
    averagePerDay: number;
    byDay: Array<{ date: string; count: number }>;
    byChannel: Array<{ channelId: string; channelName: string; count: number }>;
  };
  users: {
    totalMembers: number;
    activeUsers: number;
    newUsers: number;
    dailyActiveUsers: Array<{ date: string; count: number }>;
    topContributors: Array<{ userId: string; userName: string; messageCount: number }>;
  };
  channels: {
    total: number;
    public: number;
    private: number;
    newChannels: number;
    mostActive: Array<{ channelId: string; channelName: string; messageCount: number }>;
  };
  files: {
    totalUploaded: number;
    totalSize: number;
  };
  vp: {
    totalVPs: number;
    activeVPs: number;
    messagesSent: number;
  };
}

type Period = 'day' | 'week' | 'month' | 'quarter';

export function AnalyticsDashboard({ workspaceId, className }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [trends, setTrends] = useState<Record<string, { trend: string; percent: number }>>({});
  const [period, setPeriod] = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [metricsRes, messagesTrend, usersTrend] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/analytics/metrics?period=${period}`),
        fetch(`/api/workspaces/${workspaceId}/analytics/trends?metric=messages&period=${period}`),
        fetch(`/api/workspaces/${workspaceId}/analytics/trends?metric=active_users&period=${period}`),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

      const trendsData: Record<string, { trend: string; percent: number }> = {};
      if (messagesTrend.ok) {
        const data = await messagesTrend.json();
        trendsData.messages = { trend: data.trend?.trend, percent: data.trend?.changePercent };
      }
      if (usersTrend.ok) {
        const data = await usersTrend.json();
        trendsData.users = { trend: data.trend?.trend, percent: data.trend?.changePercent };
      }
      setTrends(trendsData);
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className={clsx('flex items-center justify-center py-12', className)}>
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <p className="text-muted-foreground">Failed to load analytics</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Analytics Dashboard</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'quarter'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                period === p
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Messages"
          value={metrics.messages.total}
          change={trends.messages ? {
            value: 0,
            percent: trends.messages.percent,
            trend: trends.messages.trend as 'up' | 'down' | 'stable',
          } : undefined}
          icon={<MessageIcon />}
        />
        <MetricCard
          title="Active Users"
          value={metrics.users.activeUsers}
          change={trends.users ? {
            value: 0,
            percent: trends.users.percent,
            trend: trends.users.trend as 'up' | 'down' | 'stable',
          } : undefined}
          icon={<UsersIcon />}
        />
        <MetricCard
          title="Files Uploaded"
          value={metrics.files.totalUploaded}
          icon={<FileIcon />}
        />
        <MetricCard
          title="Active VPs"
          value={metrics.vp.activeVPs}
          icon={<BotIcon />}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-card border border-border rounded-lg">
          <LineChart
            title="Messages Over Time"
            data={metrics.messages.byDay.map(d => ({ date: d.date, value: d.count }))}
            height={200}
          />
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <LineChart
            title="Daily Active Users"
            data={metrics.users.dailyActiveUsers.map(d => ({ date: d.date, value: d.count }))}
            color="#57534e"
            height={200}
          />
        </div>
      </div>

      {/* Leaderboards and bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-4 bg-card border border-border rounded-lg">
          <Leaderboard
            title="Top Contributors"
            data={metrics.users.topContributors.map(u => ({
              id: u.userId,
              name: u.userName,
              value: u.messageCount,
            }))}
            valueLabel="messages"
          />
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <BarChart
            title="Most Active Channels"
            data={metrics.channels.mostActive.slice(0, 5).map(c => ({
              label: c.channelName,
              value: c.messageCount,
            }))}
          />
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <BarChart
            title="Messages by Channel"
            data={metrics.messages.byChannel.slice(0, 5).map(c => ({
              label: c.channelName,
              value: c.count,
            }))}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-semibold text-foreground">{metrics.users.totalMembers}</p>
          <p className="text-sm text-muted-foreground">Total Members</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-semibold text-foreground">{metrics.channels.total}</p>
          <p className="text-sm text-muted-foreground">Channels</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-semibold text-foreground">{metrics.vp.totalVPs}</p>
          <p className="text-sm text-muted-foreground">VPs Configured</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-2xl font-semibold text-foreground">{formatBytes(metrics.files.totalSize)}</p>
          <p className="text-sm text-muted-foreground">Storage Used</p>
        </div>
      </div>
    </div>
  );
}

// Helper icons
function MessageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
return `${bytes} B`;
}
  if (bytes < 1024 * 1024) {
return `${(bytes / 1024).toFixed(1)} KB`;
}
  if (bytes < 1024 * 1024 * 1024) {
return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default AnalyticsDashboard;
