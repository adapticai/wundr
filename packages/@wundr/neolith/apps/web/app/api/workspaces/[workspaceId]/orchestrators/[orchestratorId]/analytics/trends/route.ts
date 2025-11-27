/**
 * OrchestratorAnalytics Trends API Route
 *
 * Provides Orchestrator performance trends over time with daily/weekly/monthly aggregations.
 * Includes comparison to previous periods for trend analysis.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics/trends - Get Orchestrator performance trends
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/analytics/trends/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getOrchestratorTrends } from '@/lib/services/orchestrator-analytics-service';
import {
  orchestratorTrendsQuerySchema,
  createAnalyticsErrorResponse,
  ORCHESTRATOR_ANALYTICS_ERROR_CODES,
  parseDateRange,
} from '@/lib/validations/orchestrator-analytics';

import type { OrchestratorTrendsQueryInput } from '@/lib/validations/orchestrator-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
}

/**
 * Helper to verify workspace and Orchestrator access
 */
async function verifyVPAccess(workspaceId: string, orchestratorId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  const orchestrator = await prisma.vP.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
    },
  });

  if (!orchestrator) {
    return null;
  }

  return { workspace, orchestrator };
}

/**
 * Calculate period-over-period change
 */
function calculateChange(current: number, previous: number): {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
} {
  if (previous === 0) {
    return { value: current, percentage: 0, direction: 'stable' };
  }

  const value = current - previous;
  const percentage = Math.round((value / previous) * 100);
  const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'stable';

  return { value, percentage, direction };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics/trends
 *
 * Get Orchestrator performance trends over time with aggregations.
 * Returns daily, weekly, or monthly trend data with optional comparison to previous period.
 *
 * Query Parameters:
 * - startDate: Start date in ISO format (optional)
 * - endDate: End date in ISO format (optional)
 * - timeRange: Predefined time range (24h, 7d, 30d, 90d, all) - default: 30d
 * - period: Aggregation period (daily, weekly, monthly) - default: daily
 * - includePreviousPeriod: Compare to previous period (boolean) - default: true
 * - metrics: Array of metrics to include - default: ["tasksCompleted", "avgResponseTime", "qualityScore"]
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator performance trends data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/analytics/trends?period=daily&timeRange=30d
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    // Validate IDs
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = orchestratorTrendsQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query: OrchestratorTrendsQueryInput = parseResult.data;

    // Parse date range
    let startDate: Date;
    let endDate: Date;
    try {
      const dateRange = parseDateRange(query);
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    } catch (error) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          error instanceof Error ? error.message : 'Invalid date range',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.INVALID_DATE_RANGE,
        ),
        { status: 400 },
      );
    }

    // Get trends for current period
    const trends = await getOrchestratorTrends(orchestratorId, 'completions', query.timeRange);

    // Get previous period data if requested
    let comparison = null;

    if (query.includePreviousPeriod) {
      const periodLength = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodLength);
      const previousEndDate = new Date(startDate.getTime() - 1); // Day before current period

      // Calculate metrics for previous period
      const previousTasks = await prisma.task.findMany({
        where: {
          vpId: orchestratorId,
          updatedAt: {
            gte: previousStartDate,
            lte: previousEndDate,
          },
          status: { in: ['DONE', 'CANCELLED'] },
        },
        select: {
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const previousCompleted = previousTasks.filter((t) => t.status === 'DONE').length;
      const previousTotal = previousTasks.length;
      const previousSuccessRate =
        previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0;

      // Calculate current period totals
      const currentCompleted = trends.reduce((sum, t) => sum + t.tasksCompleted, 0);
      const currentTotal = trends.reduce(
        (sum, t) => sum + (t.tasksCompleted / (t.successRate / 100)),
        0,
      );
      const currentSuccessRate = currentTotal > 0 ? (currentCompleted / currentTotal) * 100 : 0;

      // Calculate average response time for previous period
      let previousAvgResponseTime: number | null = null;
      if (previousTasks.length > 0) {
        const totalTime = previousTasks.reduce((sum, task) => {
          return sum + (task.updatedAt.getTime() - task.createdAt.getTime());
        }, 0);
        previousAvgResponseTime = totalTime / previousTasks.length / (1000 * 60); // Minutes
      }

      const currentAvgResponseTime =
        trends.reduce((sum, t) => sum + (t.avgDurationMinutes || 0), 0) / trends.length;

      comparison = {
        tasksCompleted: calculateChange(currentCompleted, previousCompleted),
        successRate: calculateChange(currentSuccessRate, previousSuccessRate),
        avgResponseTime: calculateChange(
          currentAvgResponseTime,
          previousAvgResponseTime || 0,
        ),
      };
    }

    // Format trends data
    const formattedTrends = trends.map((period) => ({
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      tasksCompleted: period.tasksCompleted,
      avgDurationMinutes: period.avgDurationMinutes,
      avgDurationHours:
        period.avgDurationMinutes !== null
          ? Math.round((period.avgDurationMinutes / 60) * 100) / 100
          : null,
      successRate: period.successRate,
      ...(period.peakHour && { peakHour: period.peakHour }),
    }));

    // Build response
    const response = {
      orchestratorId,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: query.timeRange,
      },
      period: query.period,
      trends: formattedTrends,
      ...(comparison && { comparison }),
      summary: {
        totalDataPoints: trends.length,
        totalTasksCompleted: trends.reduce((sum, t) => sum + t.tasksCompleted, 0),
        avgSuccessRate:
          trends.length > 0
            ? Math.round(
                trends.reduce((sum, t) => sum + t.successRate, 0) / trends.length,
              )
            : 0,
        avgResponseTimeMinutes:
          trends.length > 0
            ? Math.round(
                trends.reduce((sum, t) => sum + (t.avgDurationMinutes || 0), 0) /
                  trends.length,
              )
            : null,
      },
    };

    return NextResponse.json({
      data: response,
      message: 'Orchestrator trends retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics/trends] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
