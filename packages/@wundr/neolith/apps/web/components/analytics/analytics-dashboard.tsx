'use client';

import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';

import { BarChart } from './bar-chart';
import { DateRangePicker } from './date-range-picker';
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

/**
 * API Response structure matching /api/workspaces/[workspaceId]/analytics
 */
interface AnalyticsResponse {
  workspace: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
    granularity: string;
  };
  summary: {
    totalMessages: number;
    totalChannels: number;
    totalMembers: number;
    totalVPs: number;
    totalTasks: number;
    totalWorkflows: number;
    activeVPs: number;
    completedTasks: number;
    successfulWorkflows: number;
  };
  timeSeries: {
    messageVolume: Array<{ timestamp: string; value: number }>;
    taskCompletion: Array<{ timestamp: string; value: number }>;
    workflowExecution: Array<{ timestamp: string; value: number }>;
  };
  vpActivity: Array<{
    orchestratorId: string;
    vpName: string;
    messageCount: number;
    taskCount: number;
    completedTasks: number;
    status: string;
  }>;
  channelEngagement: Array<{
    channelId: string;
    channelName: string;
    messageCount: number;
    memberCount: number;
    type: string;
  }>;
  taskMetrics: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageCompletionHours?: number;
  };
  workflowMetrics: {
    byStatus: Record<string, number>;
    successRate: number;
    averageDurationMs?: number;
  };
}

interface TrendData {
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

type Granularity = 'daily' | 'weekly' | 'monthly';

export function AnalyticsDashboard({ workspaceId, className }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsResponse | null>(null);
  const [trends, setTrends] = useState<Record<string, TrendData>>({});
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({ granularity });
      if (dateRange.from) {
        queryParams.set('startDate', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        queryParams.set('endDate', dateRange.to.toISOString());
      }

      const [metricsRes, messagesTrend, tasksTrend] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/analytics?${queryParams}`),
        fetch(`/api/workspaces/${workspaceId}/analytics/trends?metric=messages&period=${granularity}`),
        fetch(`/api/workspaces/${workspaceId}/analytics/trends?metric=tasks&period=${granularity}`),
      ]);

      if (!metricsRes.ok) {
        const errorData = await metricsRes.json().catch(() => ({ error: 'Failed to fetch metrics' }));
        throw new Error(errorData.error || 'Failed to fetch metrics');
      }

      const data: AnalyticsResponse = await metricsRes.json();
      setMetrics(data);

      const trendsData: Record<string, TrendData> = {};
      if (messagesTrend.ok) {
        const data = await messagesTrend.json();
        if (data.trend) {
          trendsData.messages = {
            trend: data.trend.trend || 'stable',
            changePercent: data.trend.changePercent || 0,
          };
        }
      }
      if (tasksTrend.ok) {
        const data = await tasksTrend.json();
        if (data.trend) {
          trendsData.tasks = {
            trend: data.trend.trend || 'stable',
            changePercent: data.trend.changePercent || 0,
          };
        }
      }
      setTrends(trendsData);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, granularity, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: 'json' | 'csv' = 'csv') => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/analytics/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granularity, format }),
      });

      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${workspaceId}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${workspaceId}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export analytics');
    } finally {
      setIsExporting(false);
    }
  };

  // Format timestamp to date string
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return timestamp;
    }
  };

  if (error && !metrics) {
    return (
      <div className={clsx('text-center py-12', className)}>
        <div className="max-w-md mx-auto">
          <svg
            className="w-16 h-16 mx-auto text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-lg font-medium text-foreground mb-2">Failed to load analytics</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if there's any data to display
  const hasData = metrics?.summary && (
    metrics.summary.totalMessages > 0 ||
    metrics.summary.totalMembers > 0 ||
    metrics.summary.totalChannels > 0
  );

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header with controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Analytics Dashboard</h2>
          {metrics?.workspace && (
            <p className="text-sm text-muted-foreground mt-0.5">{metrics.workspace.name}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Granularity selector */}
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => {
                  setGranularity(g);
                  setDateRange({});
                }}
                disabled={isLoading}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  granularity === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onSelect={(range) => {
              setDateRange(range);
            }}
          />

          {/* Export button */}
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting || !hasData || isLoading}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <DownloadIcon />
                Export
              </>
            )}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && !hasData && (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <svg
            className="w-16 h-16 mx-auto text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-lg font-medium text-foreground mb-2">No analytics data yet</p>
          <p className="text-muted-foreground">Start using your workspace to see analytics</p>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Messages"
          value={metrics?.summary.totalMessages || 0}
          change={trends.messages ? {
            value: 0,
            percent: trends.messages.changePercent,
            trend: trends.messages.trend,
          } : undefined}
          icon={<MessageIcon />}
          format="compact"
          isLoading={isLoading}
        />
        <MetricCard
          title="Active VPs"
          value={metrics?.summary.activeVPs || 0}
          icon={<BotIcon />}
          isLoading={isLoading}
        />
        <MetricCard
          title="Completed Tasks"
          value={metrics?.summary.completedTasks || 0}
          change={trends.tasks ? {
            value: 0,
            percent: trends.tasks.changePercent,
            trend: trends.tasks.trend,
          } : undefined}
          icon={<TaskIcon />}
          format="compact"
          isLoading={isLoading}
        />
        <MetricCard
          title="Workflow Success Rate"
          value={metrics?.workflowMetrics.successRate || 0}
          icon={<WorkflowIcon />}
          format="percent"
          isLoading={isLoading}
        />
      </div>

      {/* Charts row */}
      {hasData && !isLoading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 sm:p-6 bg-card border border-border rounded-lg">
              <LineChart
                title="Messages Over Time"
                data={metrics?.timeSeries.messageVolume.map(d => ({
                  date: formatTimestamp(d.timestamp),
                  value: d.value,
                })) || []}
                height={200}
              />
            </div>
            <div className="p-4 sm:p-6 bg-card border border-border rounded-lg">
              <LineChart
                title="Task Completion"
                data={metrics?.timeSeries.taskCompletion.map(d => ({
                  date: formatTimestamp(d.timestamp),
                  value: d.value,
                })) || []}
                color="#57534e"
                height={200}
              />
            </div>
          </div>

          {/* Leaderboards and bars */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-4 sm:p-6 bg-card border border-border rounded-lg">
              <Leaderboard
                title="Top VPs by Messages"
                data={metrics?.orchestratorActivity.slice(0, 5).map(vp => ({
                  id: vp.orchestratorId,
                  name: vp.orchestratorName,
                  value: vp.messageCount,
                  subtitle: vp.status,
                })) || []}
                valueLabel="messages"
              />
            </div>
            <div className="p-4 sm:p-6 bg-card border border-border rounded-lg">
              <BarChart
                title="Most Active Channels"
                data={metrics?.channelEngagement.slice(0, 5).map(c => ({
                  label: c.channelName,
                  value: c.messageCount,
                })) || []}
              />
            </div>
            <div className="p-4 sm:p-6 bg-card border border-border rounded-lg">
              <BarChart
                title="Tasks by Status"
                data={Object.entries(metrics?.taskMetrics.byStatus || {}).map(([status, count]) => ({
                  label: status,
                  value: count,
                })) || []}
              />
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                {metrics?.summary.totalMembers.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total Members</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                {metrics?.summary.totalChannels.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Channels</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                {metrics?.summary.totalVPs.toLocaleString() || 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">VPs Configured</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-2xl sm:text-3xl font-semibold text-foreground">
                {metrics?.taskMetrics.averageCompletionHours?.toFixed(1) || 'N/A'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Avg Hours to Complete</p>
            </div>
          </div>
        </>
      )}
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

function TaskIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M12 6v2" />
      <rect x="8" y="10" width="8" height="4" rx="1" />
      <path d="M12 14v2" />
      <rect x="8" y="18" width="8" height="4" rx="1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default AnalyticsDashboard;
