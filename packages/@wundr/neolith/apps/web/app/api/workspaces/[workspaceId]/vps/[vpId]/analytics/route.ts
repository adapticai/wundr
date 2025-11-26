/**
 * VP Analytics API Route
 *
 * Provides comprehensive VP performance analytics including:
 * - Task completion metrics (total, by type, by priority)
 * - Response times and duration statistics
 * - Quality scores from human feedback
 * - Success rates and error rates
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/analytics - Get VP performance analytics
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/analytics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getVPMetrics } from '@/lib/services/vp-analytics-service';
import { calculateQualityScore } from '@/lib/services/vp-analytics-service-extended';
import {
  vpAnalyticsQuerySchema,
  createAnalyticsErrorResponse,
  VP_ANALYTICS_ERROR_CODES,
  parseDateRange,
} from '@/lib/validations/vp-analytics';

import type { NextRequest } from 'next/server';
import type { VPAnalyticsQueryInput } from '@/lib/validations/vp-analytics';
import type { Prisma } from '@prisma/client';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper to verify workspace and VP access
 */
async function verifyVPAccess(workspaceId: string, vpId: string, userId: string) {
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

  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
    },
  });

  if (!vp) {
    return null;
  }

  return { workspace, vp };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/analytics
 *
 * Get comprehensive VP performance analytics with optional date range filtering.
 * Includes task metrics, response times, quality scores, and breakdowns.
 *
 * Query Parameters:
 * - startDate: Start date in ISO format (optional)
 * - endDate: End date in ISO format (optional)
 * - timeRange: Predefined time range (24h, 7d, 30d, 90d, all) - default: 30d
 * - includeTaskBreakdown: Include task breakdown by type (boolean)
 * - includePriorityBreakdown: Include task breakdown by priority (boolean)
 * - includeQualityMetrics: Include quality metrics (boolean) - default: true
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace and VP IDs
 * @returns VP performance analytics data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/analytics?timeRange=30d&includeTaskBreakdown=true
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
          VP_ANALYTICS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate IDs
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid parameters',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyVPAccess(workspaceId, vpId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'VP not found or access denied',
          VP_ANALYTICS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = vpAnalyticsQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query: VPAnalyticsQueryInput = parseResult.data;

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
          VP_ANALYTICS_ERROR_CODES.INVALID_DATE_RANGE,
        ),
        { status: 400 },
      );
    }

    // Get basic metrics
    const metrics = await getVPMetrics(vpId, query.timeRange);

    // Build where condition for detailed queries
    const whereCondition: Prisma.taskWhereInput = {
      vpId,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Fetch task breakdowns if requested
    let taskBreakdown = undefined;
    if (query.includeTaskBreakdown) {
      // Note: Task type would need to be added to schema
      // For now, we'll group by status
      const tasksByStatus = await prisma.task.groupBy({
        by: ['status'],
        where: whereCondition,
        _count: {
          id: true,
        },
      });

      taskBreakdown = tasksByStatus.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    // Fetch priority breakdown if requested
    let priorityBreakdown = undefined;
    if (query.includePriorityBreakdown) {
      const tasksByPriority = await prisma.task.groupBy({
        by: ['priority'],
        where: whereCondition,
        _count: {
          id: true,
        },
      });

      priorityBreakdown = tasksByPriority.reduce(
        (acc, item) => {
          acc[item.priority] = item._count.id;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    // Calculate quality metrics if requested
    let qualityMetrics = undefined;
    if (query.includeQualityMetrics) {
      const qualityScore = await calculateQualityScore(vpId, startDate, endDate);
      qualityMetrics = {
        overallScore: qualityScore.score,
        feedbackCount: qualityScore.feedbackCount,
        breakdown: qualityScore.breakdown,
      };
    }

    // Calculate on-time completion rate
    const tasksWithDueDate = await prisma.task.findMany({
      where: {
        ...whereCondition,
        status: 'DONE',
        dueDate: { not: null },
        completedAt: { not: null },
      },
      select: {
        dueDate: true,
        completedAt: true,
      },
    });

    const onTimeCount = tasksWithDueDate.filter(
      (task) => task.completedAt && task.dueDate && task.completedAt <= task.dueDate,
    ).length;
    const onTimeRate =
      tasksWithDueDate.length > 0
        ? Math.round((onTimeCount / tasksWithDueDate.length) * 100)
        : null;

    // Build response
    const analytics = {
      vpId,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: query.timeRange,
      },
      metrics: {
        tasksCompleted: metrics.tasksCompleted,
        tasksInProgress: metrics.tasksInProgress,
        tasksFailed: metrics.tasksFailed,
        tasksCancelled: metrics.tasksCancelled,
        totalTasksAssigned: metrics.totalTasksAssigned,
        successRate: metrics.successRate,
        onTimeCompletionRate: onTimeRate,
      },
      performance: {
        avgDurationMinutes: metrics.avgDurationMinutes,
        avgDurationHours:
          metrics.avgDurationMinutes !== null
            ? Math.round((metrics.avgDurationMinutes / 60) * 100) / 100
            : null,
      },
      ...(taskBreakdown && { taskBreakdown }),
      ...(priorityBreakdown && { priorityBreakdown }),
      ...(qualityMetrics && { qualityMetrics }),
      calculatedAt: metrics.calculatedAt.toISOString(),
    };

    return NextResponse.json({
      data: analytics,
      message: 'VP analytics retrieved successfully',
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/vps/:vpId/analytics] Error:', error);
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        VP_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
