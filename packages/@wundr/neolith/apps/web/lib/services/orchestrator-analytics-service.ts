/**
 * Orchestrator Analytics Service
 * Provides analytics and metrics for orchestrator operations
 * @module lib/services/orchestrator-analytics-service
 */

import { prisma } from '@neolith/database';

import type {
  OrchestratorAnalytics,
  OrchestratorMetrics,
  OrchestratorMetricsSummary,
  MetricsPeriod,
  MetricTimeRange,
} from '@/types/orchestrator-analytics';

/**
 * Calculate time range boundaries
 */
function getTimeRangeBoundaries(timeRange: MetricTimeRange): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();

  switch (timeRange) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '90d':
      start.setDate(start.getDate() - 90);
      break;
    case 'all':
      start.setFullYear(2020); // Set to a very early date
      break;
    default:
      start.setDate(start.getDate() - 7);
  }

  return { start, end };
}

/**
 * Get orchestrator metrics for a specific time range
 *
 * @param orchestratorId - The orchestrator ID
 * @param timeRange - Time range for metrics
 * @returns Orchestrator metrics
 */
export async function getOrchestratorMetrics(
  orchestratorId: string,
  timeRange: MetricTimeRange = '7d'
): Promise<OrchestratorMetrics | null> {
  try {
    const { start, end } = getTimeRangeBoundaries(timeRange);

    // Fetch task data from the database
    const tasks = await prisma.task.findMany({
      where: {
        orchestratorId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    // Calculate task-related metrics
    const tasksCompleted = tasks.filter(t => t.status === 'DONE').length;
    const tasksInProgress = tasks.filter(
      t => t.status === 'IN_PROGRESS'
    ).length;
    const tasksFailed = tasks.filter(t => t.status === 'CANCELLED').length;
    const tasksCancelled = tasks.filter(t => t.status === 'CANCELLED').length;

    const totalTasksAssigned = tasks.length;

    // Calculate success rate
    const completedOrCancelled = tasksCompleted + tasksCancelled;
    const successRate =
      completedOrCancelled > 0
        ? Math.round((tasksCompleted / completedOrCancelled) * 100)
        : 0;

    // Calculate average duration
    const completedWithDuration = tasks.filter(
      t => t.status === 'DONE' && t.completedAt
    );

    const avgDurationMinutes =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, t) => {
            const duration =
              t.completedAt && t.createdAt
                ? (t.completedAt.getTime() - t.createdAt.getTime()) /
                  (1000 * 60)
                : 0;
            return sum + duration;
          }, 0) / completedWithDuration.length
        : null;

    return {
      orchestratorId,
      tasksCompleted,
      tasksInProgress,
      tasksFailed,
      tasksCancelled,
      avgDurationMinutes: avgDurationMinutes
        ? Math.round(avgDurationMinutes * 10) / 10
        : null,
      successRate,
      totalTasksAssigned,
      timeRange,
      calculatedAt: new Date(),
    };
  } catch (error) {
    console.error('[getOrchestratorMetrics] Error:', error);
    return null;
  }
}

/**
 * Get orchestrator analytics with trends
 *
 * @param orchestratorId - The orchestrator ID
 * @returns Orchestrator analytics with daily/weekly/monthly trends
 */
export async function getOrchestratorAnalytics(
  orchestratorId: string
): Promise<OrchestratorAnalytics> {
  try {
    // Fetch all tasks for the orchestrator
    const tasks = await prisma.task.findMany({
      where: { orchestratorId },
      select: {
        status: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary statistics
    const completedTasks = tasks.filter(t => t.status === 'DONE');
    const failedTasks = tasks.filter(t => t.status === 'CANCELLED');

    const totalTasksCompleted = completedTasks.length;
    const totalTasksFailed = failedTasks.length;
    const totalTasks = totalTasksCompleted + totalTasksFailed;

    const overallSuccessRate =
      totalTasks > 0 ? Math.round((totalTasksCompleted / totalTasks) * 100) : 0;

    // Calculate average response time
    const completedWithDuration = completedTasks.filter(
      t => t.completedAt && t.createdAt
    );

    const avgResponseTimeMinutes =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce((sum, t) => {
            const duration =
              t.completedAt && t.createdAt
                ? (t.completedAt.getTime() - t.createdAt.getTime()) /
                  (1000 * 60)
                : 0;
            return sum + duration;
          }, 0) / completedWithDuration.length
        : null;

    // Group tasks by day for daily trends
    const dailyGroups = new Map<string, typeof tasks>();
    tasks.forEach(task => {
      const dateKey = task.createdAt.toISOString().split('T')[0];
      if (!dailyGroups.has(dateKey)) {
        dailyGroups.set(dateKey, []);
      }
      dailyGroups.get(dateKey)!.push(task);
    });

    const daily: MetricsPeriod[] = Array.from(dailyGroups.entries())
      .slice(0, 30)
      .map(([dateKey, dayTasks]) => {
        const completed = dayTasks.filter(t => t.status === 'DONE').length;
        const failed = dayTasks.filter(t => t.status === 'CANCELLED').length;
        const total = completed + failed;

        const durationTasks = dayTasks.filter(
          t => t.status === 'DONE' && t.completedAt && t.createdAt
        );

        const avgDuration =
          durationTasks.length > 0
            ? durationTasks.reduce((sum, t) => {
                const duration =
                  t.completedAt && t.createdAt
                    ? (t.completedAt.getTime() - t.createdAt.getTime()) /
                      (1000 * 60)
                    : 0;
                return sum + duration;
              }, 0) / durationTasks.length
            : null;

        const date = new Date(dateKey);
        return {
          periodStart: date,
          periodEnd: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          tasksCompleted: completed,
          avgDurationMinutes: avgDuration
            ? Math.round(avgDuration * 10) / 10
            : null,
          successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });

    // For weekly and monthly, aggregate the daily data
    const weekly: MetricsPeriod[] = [];
    const monthly: MetricsPeriod[] = [];

    // Find most/least productive days
    const sortedDays = [...daily].sort(
      (a, b) => b.tasksCompleted - a.tasksCompleted
    );
    const mostProductiveDay = sortedDays[0]?.periodStart.toLocaleDateString();
    const leastProductiveDay =
      sortedDays[sortedDays.length - 1]?.periodStart.toLocaleDateString();

    // Determine trend direction
    const recentDays = daily.slice(0, 7);
    const olderDays = daily.slice(7, 14);
    const recentAvg =
      recentDays.reduce((sum, d) => sum + d.tasksCompleted, 0) /
      (recentDays.length || 1);
    const olderAvg =
      olderDays.reduce((sum, d) => sum + d.tasksCompleted, 0) /
      (olderDays.length || 1);
    const trendDirection: 'up' | 'down' | 'stable' =
      recentAvg > olderAvg * 1.1
        ? 'up'
        : recentAvg < olderAvg * 0.9
          ? 'down'
          : 'stable';

    const summary: OrchestratorMetricsSummary = {
      totalTasksCompleted,
      totalTasksFailed,
      overallSuccessRate,
      avgResponseTimeMinutes: avgResponseTimeMinutes
        ? Math.round(avgResponseTimeMinutes * 10) / 10
        : null,
      mostProductiveDay,
      leastProductiveDay,
      trendDirection,
    };

    return {
      orchestratorId,
      daily,
      weekly,
      monthly,
      summary,
    };
  } catch (error) {
    console.error('[getOrchestratorAnalytics] Error:', error);
    // Return empty analytics on error
    return {
      orchestratorId,
      daily: [],
      weekly: [],
      monthly: [],
      summary: {
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        overallSuccessRate: 0,
        avgResponseTimeMinutes: null,
        trendDirection: 'stable',
      },
    };
  }
}

/**
 * Track orchestrator event (not implemented - would require new table)
 */
export async function trackEvent(
  orchestratorId: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  console.log('[trackEvent] Event tracking not yet implemented:', {
    orchestratorId,
    eventType,
    eventData,
  });
  // Would require creating an orchestratorActivity table in the schema
}

/**
 * Generate analytics report
 */
export async function generateAnalyticsReport(
  orchestratorId: string,
  reportType: string
): Promise<{
  orchestratorId: string;
  reportType: string;
  generatedAt: Date;
  data: OrchestratorAnalytics;
}> {
  const analytics = await getOrchestratorAnalytics(orchestratorId);

  return {
    orchestratorId,
    reportType,
    generatedAt: new Date(),
    data: analytics,
  };
}

/**
 * Get performance statistics
 */
export async function getPerformanceStats(orchestratorId: string): Promise<{
  messageCount: number;
  avgResponseTime: number | null;
  activeConversations: number;
  successRate: number;
}> {
  try {
    const metrics = await getOrchestratorMetrics(orchestratorId, '7d');

    // Get message count - count messages where the orchestrator is the author
    const messageCount = await prisma.message.count({
      where: {
        authorId: orchestratorId,
      },
    });

    // Count active conversations (messages in last 24 hours)
    const activeConversations = await prisma.message.count({
      where: {
        authorId: orchestratorId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      messageCount,
      avgResponseTime: metrics?.avgDurationMinutes || null,
      activeConversations,
      successRate: metrics?.successRate || 0,
    };
  } catch (error) {
    console.error('[getPerformanceStats] Error:', error);
    return {
      messageCount: 0,
      avgResponseTime: null,
      activeConversations: 0,
      successRate: 0,
    };
  }
}

/**
 * Calculate success rate
 */
export async function calculateSuccessRate(
  orchestratorId: string,
  timeRange: MetricTimeRange = '7d'
): Promise<number> {
  const metrics = await getOrchestratorMetrics(orchestratorId, timeRange);
  return metrics?.successRate || 0;
}

/**
 * Get orchestrator trends
 */
export async function getOrchestratorTrends(
  orchestratorId: string,
  metric: string,
  timeRange: MetricTimeRange = '7d'
): Promise<{
  orchestratorId: string;
  metric: string;
  timeRange: { start: Date; end: Date };
  dataPoints: Array<{ date: Date; value: number }>;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
}> {
  try {
    const { start, end } = getTimeRangeBoundaries(timeRange);
    const analytics = await getOrchestratorAnalytics(orchestratorId);

    // Filter daily data to time range
    const relevantDays = analytics.daily.filter(
      d => d.periodStart >= start && d.periodStart <= end
    );

    // Extract data points based on metric type
    const dataPoints = relevantDays.map(d => ({
      date: d.periodStart,
      value:
        metric === 'completionRate'
          ? d.successRate
          : metric === 'avgDuration'
            ? d.avgDurationMinutes || 0
            : d.tasksCompleted,
    }));

    // Calculate trend
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, d) => sum + d.value, 0) / (firstHalf.length || 1);
    const secondAvg =
      secondHalf.reduce((sum, d) => sum + d.value, 0) /
      (secondHalf.length || 1);

    const changePercentage = firstAvg
      ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
      : 0;

    const trend: 'up' | 'down' | 'stable' =
      changePercentage > 10 ? 'up' : changePercentage < -10 ? 'down' : 'stable';

    return {
      orchestratorId,
      metric,
      timeRange: { start, end },
      dataPoints,
      trend,
      changePercentage,
    };
  } catch (error) {
    console.error('[getOrchestratorTrends] Error:', error);
    const { start, end } = getTimeRangeBoundaries(timeRange);
    return {
      orchestratorId,
      metric,
      timeRange: { start, end },
      dataPoints: [],
      trend: 'stable',
      changePercentage: 0,
    };
  }
}
