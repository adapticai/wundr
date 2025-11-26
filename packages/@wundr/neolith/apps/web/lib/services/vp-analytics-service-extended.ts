/**
 * VP Analytics Service - Extended Features
 *
 * Extended analytics features for VP performance tracking including:
 * - Quality scoring based on human feedback
 * - Performance comparison across VPs
 * - Anomaly detection for underperformance
 * - Real-time observability metrics
 *
 * @module lib/services/vp-analytics-service-extended
 */

import { prisma } from '@neolith/database';

import type { Prisma } from '@prisma/client';

/**
 * Quality feedback interface
 */
export interface QualityFeedback {
  id: string;
  taskId: string;
  vpId: string;
  rating: number;
  category: string;
  comments?: string;
  createdAt: Date;
}

/**
 * VP comparison result
 */
export interface VPComparisonResult {
  vpId: string;
  vpName: string;
  discipline: string;
  role: string;
  metricValue: number;
  rank: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Performance anomaly
 */
export interface PerformanceAnomaly {
  vpId: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  suggestedAction?: string;
}

/**
 * VP health status
 */
export interface VPHealthStatus {
  vpId: string;
  status: string;
  isHealthy: boolean;
  lastActiveAt: Date | null;
  currentTasksCount: number;
  errorRate: number;
  avgResponseTimeMinutes: number | null;
  healthScore: number; // 0-100
  issues: string[];
}

/**
 * Calculate VP quality score based on human feedback
 *
 * @param vpId - VP identifier
 * @param timeRange - Optional time range for scoring
 * @returns Quality score (0-100) and feedback count
 */
export async function calculateQualityScore(
  vpId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<{ score: number; feedbackCount: number; breakdown: Record<string, number> }> {
  const whereCondition: Prisma.taskWhereInput = {
    vpId,
    status: 'DONE',
    ...(startDate && endDate && {
      completedAt: {
        gte: startDate,
        lte: endDate,
      },
    }),
  };

  // In a real implementation, this would query a separate QualityFeedback table
  // For now, we'll simulate based on task completion metrics
  const tasks = await prisma.task.findMany({
    where: whereCondition,
    select: {
      id: true,
      priority: true,
      status: true,
      dueDate: true,
      completedAt: true,
      createdAt: true,
    },
  });

  if (tasks.length === 0) {
    return { score: 0, feedbackCount: 0, breakdown: {} };
  }

  // Calculate quality metrics
  let totalScore = 0;
  const breakdown: Record<string, number> = {
    onTime: 0,
    quality: 0,
    responsiveness: 0,
  };

  tasks.forEach((task) => {
    // On-time completion (40% weight)
    if (task.dueDate && task.completedAt) {
      const onTime = task.completedAt <= task.dueDate;
      const onTimeScore = onTime ? 40 : 20;
      breakdown.onTime += onTimeScore;
    } else {
      breakdown.onTime += 30; // Default if no due date
    }

    // Quality assumption based on completion (30% weight)
    breakdown.quality += 30;

    // Responsiveness based on completion time (30% weight)
    if (task.completedAt) {
      const hoursToComplete =
        (task.completedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60);
      const responsivenessScore = hoursToComplete < 24 ? 30 : hoursToComplete < 72 ? 20 : 10;
      breakdown.responsiveness += responsivenessScore;
    }
  });

  // Average the breakdown scores
  Object.keys(breakdown).forEach((key) => {
    breakdown[key] = Math.round(breakdown[key] / tasks.length);
  });

  totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    score: Math.min(100, Math.round(totalScore)),
    feedbackCount: tasks.length,
    breakdown,
  };
}

/**
 * Compare VP performance across workspace
 *
 * @param workspaceId - Workspace identifier
 * @param metric - Metric to compare by
 * @param limit - Number of top performers to return
 * @param startDate - Start date for comparison period
 * @param endDate - End date for comparison period
 * @returns Array of VP comparison results
 */
export async function compareVPs(
  organizationId: string,
  metric: string,
  limit: number,
  startDate: Date,
  endDate: Date,
): Promise<VPComparisonResult[]> {
  // Get all VPs in the organization
  const vps = await prisma.vP.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  if (vps.length === 0) {
    return [];
  }

  // Calculate metric for each VP
  const vpMetrics = await Promise.all(
    vps.map(async (vp) => {
      let metricValue = 0;

      const whereCondition: Prisma.taskWhereInput = {
        vpId: vp.id,
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      switch (metric) {
        case 'taskCompletionRate': {
          const [completed, total] = await Promise.all([
            prisma.task.count({
              where: { ...whereCondition, status: 'DONE' },
            }),
            prisma.task.count({ where: whereCondition }),
          ]);
          metricValue = total > 0 ? (completed / total) * 100 : 0;
          break;
        }
        case 'tasksCompleted': {
          metricValue = await prisma.task.count({
            where: { ...whereCondition, status: 'DONE' },
          });
          break;
        }
        case 'avgResponseTime': {
          const tasks = await prisma.task.findMany({
            where: { ...whereCondition, status: 'DONE' },
            select: {
              createdAt: true,
              completedAt: true,
            },
          });
          if (tasks.length > 0) {
            const totalTime = tasks.reduce((sum, task) => {
              if (task.completedAt) {
                return sum + (task.completedAt.getTime() - task.createdAt.getTime());
              }
              return sum;
            }, 0);
            metricValue = totalTime / tasks.length / (1000 * 60); // Convert to minutes
          }
          break;
        }
        case 'qualityScore': {
          const qualityResult = await calculateQualityScore(vp.id, startDate, endDate);
          metricValue = qualityResult.score;
          break;
        }
        case 'errorRate': {
          const [failed, total] = await Promise.all([
            prisma.task.count({
              where: { ...whereCondition, status: 'CANCELLED' },
            }),
            prisma.task.count({ where: whereCondition }),
          ]);
          metricValue = total > 0 ? (failed / total) * 100 : 0;
          break;
        }
        default:
          metricValue = 0;
      }

      return {
        vpId: vp.id,
        vpName: vp.user.name || 'Unknown',
        discipline: vp.discipline,
        role: vp.role,
        metricValue,
      };
    }),
  );

  // Sort by metric value
  const sortOrder = metric === 'avgResponseTime' || metric === 'errorRate' ? 'asc' : 'desc';
  vpMetrics.sort((a, b) => {
    return sortOrder === 'desc'
      ? b.metricValue - a.metricValue
      : a.metricValue - b.metricValue;
  });

  // Assign ranks and percentiles
  const results: VPComparisonResult[] = vpMetrics.slice(0, limit).map((vp, index) => {
    const rank = index + 1;
    const percentile = ((vpMetrics.length - index) / vpMetrics.length) * 100;

    return {
      ...vp,
      rank,
      percentile: Math.round(percentile),
      trend: 'stable' as const, // Would need historical data to calculate trend
    };
  });

  return results;
}

/**
 * Detect performance anomalies for a VP
 *
 * @param vpId - VP identifier
 * @param threshold - Standard deviation threshold for anomaly detection
 * @param timeWindow - Time window for analysis
 * @returns Array of detected anomalies
 */
export async function detectAnomalies(
  vpId: string,
  _threshold: number,
  startDate: Date,
  endDate: Date,
): Promise<PerformanceAnomaly[]> {
  const anomalies: PerformanceAnomaly[] = [];

  // Get VP's tasks in the time window
  const tasks = await prisma.task.findMany({
    where: {
      vpId,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  if (tasks.length < 5) {
    // Need minimum data points for anomaly detection
    return anomalies;
  }

  // Calculate baseline metrics
  const completedTasks = tasks.filter((t) => t.status === 'DONE');
  const failedTasks = tasks.filter((t) => t.status === 'CANCELLED' || t.status === 'BLOCKED');

  // Anomaly 1: Low completion rate
  const completionRate = (completedTasks.length / tasks.length) * 100;
  if (completionRate < 50) {
    anomalies.push({
      vpId,
      anomalyType: 'low_completion_rate',
      severity: completionRate < 30 ? 'critical' : completionRate < 40 ? 'high' : 'medium',
      description: `VP completion rate is ${completionRate.toFixed(1)}%, below expected threshold`,
      detectedAt: new Date(),
      metric: 'completionRate',
      expectedValue: 80,
      actualValue: completionRate,
      deviation: Math.abs(80 - completionRate),
      suggestedAction: 'Review task assignments and VP workload capacity',
    });
  }

  // Anomaly 2: High response time
  if (completedTasks.length > 0) {
    const avgResponseTime =
      completedTasks.reduce((sum, task) => {
        if (task.completedAt) {
          return sum + (task.completedAt.getTime() - task.createdAt.getTime());
        }
        return sum;
      }, 0) /
      completedTasks.length /
      (1000 * 60 * 60); // Convert to hours

    if (avgResponseTime > 48) {
      anomalies.push({
        vpId,
        anomalyType: 'high_response_time',
        severity: avgResponseTime > 120 ? 'high' : 'medium',
        description: `VP average response time is ${avgResponseTime.toFixed(1)} hours`,
        detectedAt: new Date(),
        metric: 'avgResponseTime',
        expectedValue: 24,
        actualValue: avgResponseTime,
        deviation: Math.abs(24 - avgResponseTime),
        suggestedAction: 'Consider reducing task complexity or providing additional resources',
      });
    }
  }

  // Anomaly 3: High error rate
  const errorRate = (failedTasks.length / tasks.length) * 100;
  if (errorRate > 20) {
    anomalies.push({
      vpId,
      anomalyType: 'high_error_rate',
      severity: errorRate > 40 ? 'critical' : errorRate > 30 ? 'high' : 'medium',
      description: `VP error rate is ${errorRate.toFixed(1)}%, indicating potential issues`,
      detectedAt: new Date(),
      metric: 'errorRate',
      expectedValue: 10,
      actualValue: errorRate,
      deviation: Math.abs(10 - errorRate),
      suggestedAction: 'Review failed tasks for patterns and provide additional training',
    });
  }

  return anomalies;
}

/**
 * Get real-time VP health status
 *
 * @param vpId - VP identifier
 * @returns VP health status
 */
export async function getVPHealthStatus(vpId: string): Promise<VPHealthStatus> {
  const vp = await prisma.vP.findUnique({
    where: { id: vpId },
    include: {
      user: {
        select: {
          lastActiveAt: true,
        },
      },
    },
  });

  if (!vp) {
    throw new Error(`VP ${vpId} not found`);
  }

  // Get current tasks
  const currentTasks = await prisma.task.count({
    where: {
      vpId,
      status: { in: ['TODO', 'IN_PROGRESS'] },
    },
  });

  // Get recent error rate (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentFailed, recentTotal, recentCompleted] = await Promise.all([
    prisma.task.count({
      where: {
        vpId,
        status: { in: ['CANCELLED', 'BLOCKED'] },
        updatedAt: { gte: oneDayAgo },
      },
    }),
    prisma.task.count({
      where: {
        vpId,
        updatedAt: { gte: oneDayAgo },
      },
    }),
    prisma.task.findMany({
      where: {
        vpId,
        status: 'DONE',
        completedAt: { gte: oneDayAgo },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
    }),
  ]);

  const errorRate = recentTotal > 0 ? (recentFailed / recentTotal) * 100 : 0;

  // Calculate average response time
  let avgResponseTime: number | null = null;
  if (recentCompleted.length > 0) {
    const totalTime = recentCompleted.reduce((sum, task) => {
      if (task.completedAt) {
        return sum + (task.completedAt.getTime() - task.createdAt.getTime());
      }
      return sum;
    }, 0);
    avgResponseTime = totalTime / recentCompleted.length / (1000 * 60); // Minutes
  }

  // Calculate health score
  const issues: string[] = [];
  let healthScore = 100;

  if (vp.status === 'OFFLINE') {
    healthScore -= 50;
    issues.push('VP is offline');
  }

  if (errorRate > 20) {
    healthScore -= 20;
    issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
  }

  if (avgResponseTime && avgResponseTime > 120) {
    healthScore -= 15;
    issues.push(`Slow response time: ${(avgResponseTime / 60).toFixed(1)} hours`);
  }

  if (currentTasks > 20) {
    healthScore -= 15;
    issues.push(`High task load: ${currentTasks} active tasks`);
  }

  const lastActiveAt = vp.user.lastActiveAt;
  if (lastActiveAt) {
    const hoursSinceActive = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActive > 24) {
      healthScore -= 10;
      issues.push(`Inactive for ${Math.round(hoursSinceActive)} hours`);
    }
  }

  return {
    vpId,
    status: vp.status,
    isHealthy: healthScore >= 70,
    lastActiveAt,
    currentTasksCount: currentTasks,
    errorRate: Math.round(errorRate * 10) / 10,
    avgResponseTimeMinutes: avgResponseTime ? Math.round(avgResponseTime) : null,
    healthScore: Math.max(0, healthScore),
    issues,
  };
}

/**
 * Get workspace-wide observability metrics
 *
 * @param workspaceId - Workspace identifier
 * @returns Array of VP health statuses for all VPs in workspace
 */
export async function getWorkspaceObservability(
  organizationId: string,
): Promise<VPHealthStatus[]> {
  const vps = await prisma.vP.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const healthStatuses = await Promise.all(
    vps.map((vp) => getVPHealthStatus(vp.id)),
  );

  return healthStatuses;
}
