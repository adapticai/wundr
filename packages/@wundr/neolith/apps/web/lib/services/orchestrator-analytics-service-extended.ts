/**
 * Orchestrator Analytics Service Extended
 * Extended analytics capabilities for advanced orchestrator insights
 * @module lib/services/orchestrator-analytics-service-extended
 */

import { prisma } from '@neolith/database';

/**
 * Perform deep analytics analysis
 */
export async function performDeepAnalysis(
  orchestratorId: string,
  analysisConfig: any
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] performDeepAnalysis called with:',
    {
      orchestratorId,
      analysisConfig,
    }
  );

  try {
    const lookbackDays = analysisConfig?.lookbackDays ?? 30;
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const [auditLogs, tasks, memories] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where: {
          actorId: orchestratorId,
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.task.findMany({
        where: {
          orchestratorId,
          createdAt: { gte: since },
        },
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          completedAt: true,
          tags: true,
        },
      }),
      prisma.orchestratorMemory.findMany({
        where: {
          orchestratorId,
          createdAt: { gte: since },
        },
        select: {
          memoryType: true,
          importance: true,
          createdAt: true,
        },
        take: 200,
      }),
    ]);

    const completedTasks = tasks.filter((t: any) => t.status === 'DONE');
    const failedTasks = tasks.filter((t: any) => t.status === 'CANCELLED');
    const successRate =
      tasks.length > 0
        ? Math.round((completedTasks.length / tasks.length) * 100)
        : 0;

    const avgDurationMs =
      completedTasks.length > 0
        ? completedTasks
            .filter((t: any) => t.completedAt && t.createdAt)
            .reduce((sum: number, t: any) => {
              return (
                sum +
                (new Date(t.completedAt).getTime() -
                  new Date(t.createdAt).getTime())
              );
            }, 0) / completedTasks.length
        : null;

    const actionFrequency: Record<string, number> = {};
    for (const log of auditLogs) {
      actionFrequency[log.action] = (actionFrequency[log.action] ?? 0) + 1;
    }

    const memoryTypeDistribution: Record<string, number> = {};
    for (const mem of memories) {
      memoryTypeDistribution[mem.memoryType] =
        (memoryTypeDistribution[mem.memoryType] ?? 0) + 1;
    }

    return {
      orchestratorId,
      analysisConfig,
      period: { since: since.toISOString(), until: new Date().toISOString() },
      summary: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        failedTasks: failedTasks.length,
        successRate,
        avgDurationMs: avgDurationMs ? Math.round(avgDurationMs) : null,
        totalAuditEvents: auditLogs.length,
        totalMemories: memories.length,
      },
      actionFrequency,
      memoryTypeDistribution,
      analysisTimestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[performDeepAnalysis] Error:', error);
    return null;
  }
}

/**
 * Get predictive insights
 */
export async function getPredictiveInsights(
  orchestratorId: string,
  predictionType: string
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] getPredictiveInsights called with:',
    {
      orchestratorId,
      predictionType,
    }
  );

  try {
    // Fetch recent audit logs to derive trend data
    const recentLogs = await (prisma as any).auditLog.findMany({
      where: {
        actorId: orchestratorId,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        action: true,
        severity: true,
        createdAt: true,
      },
    });

    // Group events by day to compute daily volumes
    const dailyVolumes: Record<string, number> = {};
    for (const log of recentLogs) {
      const day = new Date(log.createdAt).toISOString().split('T')[0];
      dailyVolumes[day] = (dailyVolumes[day] ?? 0) + 1;
    }

    const days = Object.keys(dailyVolumes).sort();
    const volumes = days.map(d => dailyVolumes[d]);

    // Simple linear trend: compare first half vs second half
    const mid = Math.floor(volumes.length / 2);
    const firstHalfAvg =
      volumes.slice(0, mid).reduce((s, v) => s + v, 0) / (mid || 1);
    const secondHalfAvg =
      volumes.slice(mid).reduce((s, v) => s + v, 0) /
      (volumes.length - mid || 1);

    const trendSlope = secondHalfAvg - firstHalfAvg;
    const predictedNextDayVolume = Math.max(
      0,
      Math.round(secondHalfAvg + trendSlope * 0.5)
    );

    const errorCount = recentLogs.filter(
      (l: any) => l.severity === 'error'
    ).length;
    const errorRate =
      recentLogs.length > 0
        ? Math.round((errorCount / recentLogs.length) * 100)
        : 0;

    return {
      orchestratorId,
      predictionType,
      insights: {
        trendDirection:
          trendSlope > 1
            ? 'increasing'
            : trendSlope < -1
              ? 'decreasing'
              : 'stable',
        trendSlope: Math.round(trendSlope * 100) / 100,
        predictedNextDayVolume,
        currentErrorRate: errorRate,
        riskLevel: errorRate > 20 ? 'high' : errorRate > 10 ? 'medium' : 'low',
        dataPoints: days.map((d, i) => ({ date: d, volume: volumes[i] })),
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[getPredictiveInsights] Error:', error);
    return null;
  }
}

/**
 * Analyze workflow patterns
 */
export async function analyzeWorkflowPatterns(
  orchestratorId: string,
  timeRange?: any
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] analyzeWorkflowPatterns called with:',
    {
      orchestratorId,
      timeRange,
    }
  );

  try {
    const since = timeRange?.start
      ? new Date(timeRange.start)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const until = timeRange?.end ? new Date(timeRange.end) : new Date();

    // Query workflow executions triggered by this orchestrator
    const executions = await prisma.workflowExecution.findMany({
      where: {
        triggeredBy: orchestratorId,
        startedAt: { gte: since, lte: until },
      },
      select: {
        id: true,
        status: true,
        triggerType: true,
        durationMs: true,
        startedAt: true,
        completedAt: true,
        workflowId: true,
      },
    });

    // Group by triggerType to identify patterns
    const patternMap: Record<
      string,
      { count: number; successCount: number; totalDurationMs: number }
    > = {};

    for (const exec of executions) {
      const key = exec.triggerType ?? 'unknown';
      if (!patternMap[key]) {
        patternMap[key] = { count: 0, successCount: 0, totalDurationMs: 0 };
      }
      patternMap[key].count += 1;
      if (exec.status === 'COMPLETED') {
        patternMap[key].successCount += 1;
      }
      if (exec.durationMs) {
        patternMap[key].totalDurationMs += exec.durationMs;
      }
    }

    const patterns = Object.entries(patternMap).map(([triggerType, stats]) => ({
      triggerType,
      executionCount: stats.count,
      successRate:
        stats.count > 0
          ? Math.round((stats.successCount / stats.count) * 100)
          : 0,
      avgDurationMs:
        stats.count > 0
          ? Math.round(stats.totalDurationMs / stats.count)
          : null,
    }));

    return {
      orchestratorId,
      period: { since: since.toISOString(), until: until.toISOString() },
      totalExecutions: executions.length,
      patterns,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[analyzeWorkflowPatterns] Error:', error);
    return null;
  }
}

/**
 * Generate anomaly detection report
 */
export async function detectAnomalies(
  orchestratorId: string,
  threshold?: number
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] detectAnomalies called with:',
    {
      orchestratorId,
      threshold,
    }
  );

  try {
    const zScoreThreshold = threshold ?? 2.0;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [tasks, auditLogs] = await Promise.all([
      prisma.task.findMany({
        where: {
          orchestratorId,
          status: 'DONE',
          completedAt: { not: null },
          createdAt: { gte: since },
        },
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      (prisma as any).auditLog.findMany({
        where: {
          actorId: orchestratorId,
          createdAt: { gte: since },
        },
        select: {
          severity: true,
          createdAt: true,
          action: true,
        },
      }),
    ]);

    // Compute task response times in ms
    const responseTimes = tasks
      .filter((t: any) => t.completedAt && t.createdAt)
      .map((t: any) => {
        return (
          new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()
        );
      });

    const anomalies: any[] = [];

    if (responseTimes.length > 2) {
      const mean =
        responseTimes.reduce((s: number, v: number) => s + v, 0) /
        responseTimes.length;
      const variance =
        responseTimes.reduce(
          (s: number, v: number) => s + Math.pow(v - mean, 2),
          0
        ) / responseTimes.length;
      const stdDev = Math.sqrt(variance);

      for (let i = 0; i < responseTimes.length; i++) {
        const zScore =
          stdDev > 0 ? Math.abs(responseTimes[i] - mean) / stdDev : 0;
        if (zScore > zScoreThreshold) {
          anomalies.push({
            type: 'response_time_outlier',
            taskId: tasks[i].id,
            responseTimeMs: responseTimes[i],
            zScore: Math.round(zScore * 100) / 100,
            meanMs: Math.round(mean),
            stdDevMs: Math.round(stdDev),
          });
        }
      }
    }

    // Group audit logs by day and detect error rate spikes
    const dailyErrors: Record<string, number> = {};
    const dailyTotal: Record<string, number> = {};
    for (const log of auditLogs) {
      const day = new Date(log.createdAt).toISOString().split('T')[0];
      dailyTotal[day] = (dailyTotal[day] ?? 0) + 1;
      if (log.severity === 'error') {
        dailyErrors[day] = (dailyErrors[day] ?? 0) + 1;
      }
    }

    const errorRates = Object.keys(dailyTotal).map(day => ({
      day,
      rate: dailyTotal[day] > 0 ? (dailyErrors[day] ?? 0) / dailyTotal[day] : 0,
    }));

    if (errorRates.length > 2) {
      const rates = errorRates.map(e => e.rate);
      const mean = rates.reduce((s, v) => s + v, 0) / rates.length;
      const stdDev = Math.sqrt(
        rates.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / rates.length
      );

      for (const { day, rate } of errorRates) {
        const zScore = stdDev > 0 ? Math.abs(rate - mean) / stdDev : 0;
        if (zScore > zScoreThreshold && rate > mean) {
          anomalies.push({
            type: 'error_rate_spike',
            date: day,
            errorRate: Math.round(rate * 100),
            zScore: Math.round(zScore * 100) / 100,
          });
        }
      }
    }

    return {
      orchestratorId,
      threshold: zScoreThreshold,
      anomalyCount: anomalies.length,
      anomalies,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[detectAnomalies] Error:', error);
    return null;
  }
}

/**
 * Create custom analytics dashboard
 */
export async function createCustomDashboard(
  orchestratorId: string,
  dashboardConfig: any
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] createCustomDashboard called with:',
    {
      orchestratorId,
      dashboardConfig,
    }
  );

  try {
    const dashboardId = `dashboard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist the dashboard config as an orchestrator memory entry
    await prisma.orchestratorMemory.create({
      data: {
        orchestratorId,
        memoryType: 'custom_dashboard',
        content: JSON.stringify({
          dashboardId,
          config: dashboardConfig,
          createdAt: new Date().toISOString(),
        }),
        importance: 0.8,
        metadata: {
          dashboardId,
          dashboardName: dashboardConfig?.name ?? 'Untitled Dashboard',
          widgetCount: Array.isArray(dashboardConfig?.widgets)
            ? dashboardConfig.widgets.length
            : 0,
        } as never,
      },
    });

    return {
      dashboardId,
      orchestratorId,
      config: dashboardConfig,
      createdAt: new Date().toISOString(),
      status: 'created',
    };
  } catch (error) {
    console.error('[createCustomDashboard] Error:', error);
    return null;
  }
}

/**
 * Export analytics data
 */
export async function exportAnalyticsData(
  orchestratorId: string,
  format: string,
  filters?: any
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] exportAnalyticsData called with:',
    {
      orchestratorId,
      format,
      filters,
    }
  );

  try {
    const since = filters?.startDate
      ? new Date(filters.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const until = filters?.endDate ? new Date(filters.endDate) : new Date();

    const tasks = await prisma.task.findMany({
      where: {
        orchestratorId,
        createdAt: { gte: since, lte: until },
        ...(filters?.status ? { status: filters.status } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        completedAt: true,
        tags: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const records = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
      durationMs:
        t.completedAt && t.createdAt
          ? new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()
          : null,
      tags: t.tags,
    }));

    const normalizedFormat = format.toLowerCase();

    if (normalizedFormat === 'csv') {
      const headers = [
        'id',
        'title',
        'status',
        'priority',
        'createdAt',
        'completedAt',
        'durationMs',
        'tags',
      ];
      const csvRows = [
        headers.join(','),
        ...records.map((r: any) =>
          [
            r.id,
            `"${(r.title ?? '').replace(/"/g, '""')}"`,
            r.status,
            r.priority,
            r.createdAt ?? '',
            r.completedAt ?? '',
            r.durationMs ?? '',
            `"${(r.tags ?? []).join(';')}"`,
          ].join(',')
        ),
      ];

      return {
        orchestratorId,
        format: 'csv',
        recordCount: records.length,
        period: { since: since.toISOString(), until: until.toISOString() },
        data: csvRows.join('\n'),
        exportedAt: new Date().toISOString(),
      };
    }

    // Default: JSON
    return {
      orchestratorId,
      format: 'json',
      recordCount: records.length,
      period: { since: since.toISOString(), until: until.toISOString() },
      data: records,
      exportedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[exportAnalyticsData] Error:', error);
    return null;
  }
}

/**
 * Quality score result
 */
export interface QualityScoreResult {
  score: number;
  breakdown: {
    accuracy?: number;
    performance?: number;
    reliability?: number;
    usability?: number;
    onTime?: number;
  };
  feedbackCount: number;
}

/**
 * Calculate quality score
 */
export async function calculateQualityScore(
  orchestratorId: string,
  startDate?: Date,
  endDate?: Date
): Promise<QualityScoreResult> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] calculateQualityScore called with:',
    {
      orchestratorId,
      startDate,
      endDate,
    }
  );

  try {
    const since = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const until = endDate ?? new Date();

    const tasks = await prisma.task.findMany({
      where: {
        orchestratorId,
        createdAt: { gte: since, lte: until },
      },
      select: {
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        completedAt: true,
      },
    });

    const totalTasks = tasks.length;

    if (totalTasks === 0) {
      return {
        score: 0,
        breakdown: {
          accuracy: 0,
          performance: 0,
          reliability: 0,
          usability: 0,
          onTime: 0,
        },
        feedbackCount: 0,
      };
    }

    // Reliability: success rate (completed / total)
    const completed = tasks.filter((t: any) => t.status === 'DONE').length;
    const cancelled = tasks.filter((t: any) => t.status === 'CANCELLED').length;
    const reliability =
      totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    // On-time: tasks completed before or on their due date
    const tasksWithDueDate = tasks.filter(
      (t: any) => t.dueDate && t.completedAt
    );
    const onTimeCount = tasksWithDueDate.filter(
      (t: any) =>
        new Date(t.completedAt).getTime() <= new Date(t.dueDate).getTime()
    ).length;
    const onTime =
      tasksWithDueDate.length > 0
        ? Math.round((onTimeCount / tasksWithDueDate.length) * 100)
        : reliability; // Fall back to reliability when no due dates exist

    // Performance: inverse of avg completion time relative to a 1-hour baseline
    const completedWithTimes = tasks.filter(
      (t: any) => t.status === 'DONE' && t.completedAt && t.createdAt
    );
    const avgDurationMs =
      completedWithTimes.length > 0
        ? completedWithTimes.reduce((s: number, t: any) => {
            return (
              s +
              (new Date(t.completedAt).getTime() -
                new Date(t.createdAt).getTime())
            );
          }, 0) / completedWithTimes.length
        : null;

    const baselineMs = 60 * 60 * 1000; // 1 hour
    const performance =
      avgDurationMs !== null
        ? Math.min(100, Math.round((baselineMs / avgDurationMs) * 100))
        : reliability;

    // Accuracy: percentage of tasks not cancelled
    const accuracy =
      totalTasks > 0
        ? Math.round(((totalTasks - cancelled) / totalTasks) * 100)
        : 0;

    // Usability: percentage that completed without being blocked
    const blocked = tasks.filter((t: any) => t.status === 'BLOCKED').length;
    const usability =
      totalTasks > 0
        ? Math.round(((totalTasks - blocked) / totalTasks) * 100)
        : 0;

    // Weighted composite score
    const score = Math.round(
      reliability * 0.3 +
        onTime * 0.25 +
        performance * 0.2 +
        accuracy * 0.15 +
        usability * 0.1
    );

    return {
      score,
      breakdown: {
        accuracy,
        performance,
        reliability,
        usability,
        onTime,
      },
      feedbackCount: totalTasks,
    };
  } catch (error) {
    console.error('[calculateQualityScore] Error:', error);
    return {
      score: 0,
      breakdown: {
        accuracy: 0,
        performance: 0,
        reliability: 0,
        usability: 0,
        onTime: 0,
      },
      feedbackCount: 0,
    };
  }
}

/**
 * Compare orchestrators
 */
export async function compareOrchestrators(
  orchestratorIds: string[],
  metrics: string[]
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] compareOrchestrators called with:',
    {
      orchestratorIds,
      metrics,
    }
  );

  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Run parallel queries for all requested orchestrators
    const taskQueryResults = await Promise.all(
      orchestratorIds.map(id =>
        prisma.task.findMany({
          where: {
            orchestratorId: id,
            createdAt: { gte: since },
          },
          select: {
            status: true,
            priority: true,
            createdAt: true,
            completedAt: true,
            dueDate: true,
          },
        })
      )
    );

    const orchestratorData = orchestratorIds.map((id, idx) => {
      const tasks = taskQueryResults[idx];
      const totalTasks = tasks.length;
      const completed = tasks.filter((t: any) => t.status === 'DONE').length;
      const failed = tasks.filter((t: any) => t.status === 'CANCELLED').length;

      const completedWithTimes = tasks.filter(
        (t: any) => t.status === 'DONE' && t.completedAt && t.createdAt
      );
      const avgDurationMs =
        completedWithTimes.length > 0
          ? completedWithTimes.reduce((s: number, t: any) => {
              return (
                s +
                (new Date(t.completedAt).getTime() -
                  new Date(t.createdAt).getTime())
              );
            }, 0) / completedWithTimes.length
          : null;

      const successRate =
        totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

      const metricValues: Record<string, number | null> = {};
      for (const metric of metrics) {
        switch (metric) {
          case 'successRate':
            metricValues[metric] = successRate;
            break;
          case 'totalTasks':
            metricValues[metric] = totalTasks;
            break;
          case 'completedTasks':
            metricValues[metric] = completed;
            break;
          case 'failedTasks':
            metricValues[metric] = failed;
            break;
          case 'avgDurationMs':
            metricValues[metric] = avgDurationMs
              ? Math.round(avgDurationMs)
              : null;
            break;
          default:
            metricValues[metric] = null;
        }
      }

      return { id, metrics: metricValues, totalTasks, successRate };
    });

    // Determine the winner by highest success rate, then total tasks as tiebreaker
    const sorted = [...orchestratorData].sort((a, b) => {
      if (b.successRate !== a.successRate) {
        return b.successRate - a.successRate;
      }
      return b.totalTasks - a.totalTasks;
    });

    const winner = sorted[0]?.id ?? null;

    return {
      orchestrators: orchestratorData.map(o => ({
        id: o.id,
        metrics: o.metrics,
      })),
      comparison: 'completed',
      winner,
      comparedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[compareOrchestrators] Error:', error);
    return {
      orchestrators: orchestratorIds.map(id => ({
        id,
        metrics: metrics.reduce(
          (acc: Record<string, null>, metric) => ({ ...acc, [metric]: null }),
          {}
        ),
      })),
      comparison: 'error',
      winner: null,
    };
  }
}

/**
 * Get workspace observability
 */
export async function getWorkspaceObservability(
  workspaceId: string,
  options?: any
): Promise<any> {
  console.log(
    '[OrchestratorAnalyticsServiceExtended] getWorkspaceObservability called with:',
    {
      workspaceId,
      options,
    }
  );

  try {
    // Fetch all orchestrators in this workspace
    const orchestrators = await prisma.orchestrator.findMany({
      where: { workspaceId },
      select: {
        id: true,
        status: true,
        role: true,
        discipline: true,
        _count: { select: { tasks: true } },
      },
    });

    const activeOrchestrators = orchestrators.filter(
      (o: any) => o.status === 'ONLINE' || o.status === 'BUSY'
    ).length;

    // Aggregate task metrics across all orchestrators in the workspace
    const orchestratorIds = orchestrators.map((o: any) => o.id);

    const [totalTasksCount, activeTasksCount, queuedTasksCount] =
      orchestratorIds.length > 0
        ? await Promise.all([
            prisma.task.count({
              where: { orchestratorId: { in: orchestratorIds } },
            }),
            prisma.task.count({
              where: {
                orchestratorId: { in: orchestratorIds },
                status: 'IN_PROGRESS',
              },
            }),
            prisma.task.count({
              where: {
                orchestratorId: { in: orchestratorIds },
                status: 'TODO',
              },
            }),
          ])
        : [0, 0, 0];

    // Compute a simple health score: penalise based on error/offline orchestrators
    const offlineCount = orchestrators.filter(
      (o: any) => o.status === 'OFFLINE'
    ).length;
    const healthScore =
      orchestrators.length > 0
        ? Math.max(
            0,
            Math.round(100 - (offlineCount / orchestrators.length) * 50)
          )
        : 100;

    // Collect recent high-severity audit log events as alerts
    const recentAlerts = await (prisma as any).auditLog.findMany({
      where: {
        actorId: { in: orchestratorIds },
        severity: { in: ['error', 'warn'] },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // last hour
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.maxAlerts ?? 10,
      select: {
        actorId: true,
        action: true,
        severity: true,
        createdAt: true,
        resourceType: true,
        resourceId: true,
      },
    });

    return {
      workspaceId,
      activeOrchestrators,
      totalOrchestrators: orchestrators.length,
      totalTasks: totalTasksCount,
      activeTasks: activeTasksCount,
      queuedTasks: queuedTasksCount,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        network: 0,
      },
      healthScore,
      alerts: recentAlerts.map((a: any) => ({
        orchestratorId: a.actorId,
        action: a.action,
        severity: a.severity,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        timestamp: new Date(a.createdAt).toISOString(),
      })),
      orchestratorBreakdown: orchestrators.map((o: any) => ({
        id: o.id,
        role: o.role,
        discipline: o.discipline,
        status: o.status,
        taskCount: o._count.tasks,
      })),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[getWorkspaceObservability] Error:', error);
    return {
      workspaceId,
      activeOrchestrators: 0,
      totalTasks: 0,
      activeTasks: 0,
      queuedTasks: 0,
      resourceUsage: {
        cpu: 0,
        memory: 0,
        network: 0,
      },
      healthScore: 100,
      alerts: [],
      timestamp: new Date().toISOString(),
    };
  }
}
