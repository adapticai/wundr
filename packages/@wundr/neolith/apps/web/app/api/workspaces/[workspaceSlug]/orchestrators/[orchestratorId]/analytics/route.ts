/**
 * OrchestratorAnalytics API Route
 *
 * Provides comprehensive Orchestrator performance analytics including:
 * - Task completion metrics (total, by type, by priority)
 * - Response times and duration statistics
 * - Quality scores from human feedback
 * - Success rates and error rates
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics - Get Orchestrator performance analytics
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/analytics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getOrchestratorMetrics } from '@/lib/services/orchestrator-analytics-service';
import { calculateQualityScore } from '@/lib/services/orchestrator-analytics-service-extended';
import {
  orchestratorAnalyticsQuerySchema,
  createAnalyticsErrorResponse,
  ORCHESTRATOR_ANALYTICS_ERROR_CODES,
  parseDateRange,
} from '@/lib/validations/orchestrator-analytics';

import type {
  OrchestratorAnalyticsQueryInput,
  AnalyticsDateRangeInput,
} from '@/lib/validations/orchestrator-analytics';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Helper to verify workspace and Orchestrator access
 */
async function verifyOrchestratorAccess(
  workspaceId: string,
  orchestratorId: string,
  userId: string
) {
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

  const orchestrator = await prisma.orchestrator.findFirst({
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
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics
 *
 * Get comprehensive Orchestrator performance analytics with optional date range filtering.
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
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator performance analytics data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/analytics?timeRange=30d&includeTaskBreakdown=true
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Validate IDs
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify access
    const access = await verifyOrchestratorAccess(
      workspaceId,
      orchestratorId,
      session.user.id
    );
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult =
      orchestratorAnalyticsQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const query: OrchestratorAnalyticsQueryInput = parseResult.data;

    // Parse date range - convert timeRange to AnalyticsDateRangeInput format
    let startDate: Date;
    let endDate: Date;
    try {
      const dateRangeInput: AnalyticsDateRangeInput = {
        start: query.timeRange.start,
        end: query.timeRange.end,
        preset: 'custom' as const,
      };
      const dateRange = parseDateRange(dateRangeInput);
      startDate = dateRange.start;
      endDate = dateRange.end;
    } catch (error) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          error instanceof Error ? error.message : 'Invalid date range',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.INVALID_TIME_RANGE
        ),
        { status: 400 }
      );
    }

    // Get basic metrics - use a default timeRange string
    const metrics = await getOrchestratorMetrics(
      orchestratorId,
      '30d' // Default time range for the service
    );

    // Build where condition for detailed queries
    const whereCondition: Prisma.taskWhereInput = {
      orchestratorId: orchestratorId,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Fetch task breakdowns if requested (checking groupBy as a proxy for breakdown requests)
    let taskBreakdown = undefined;
    const includeTaskBreakdown = query.groupBy?.includes('status') ?? false;
    if (includeTaskBreakdown) {
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
        {} as Record<string, number>
      );
    }

    // Fetch priority breakdown if requested (checking groupBy as a proxy)
    let priorityBreakdown = undefined;
    const includePriorityBreakdown =
      query.groupBy?.includes('priority') ?? false;
    if (includePriorityBreakdown) {
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
        {} as Record<string, number>
      );
    }

    // Calculate quality metrics if requested (default to true)
    let qualityMetrics = undefined;
    const includeQualityMetrics =
      query.metrics.includes('task_completion_rate') ||
      query.metrics.length === 0;
    if (includeQualityMetrics) {
      const qualityScore = await calculateQualityScore(
        orchestratorId,
        startDate,
        endDate
      );
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
      task =>
        task.completedAt && task.dueDate && task.completedAt <= task.dueDate
    ).length;
    const onTimeRate =
      tasksWithDueDate.length > 0
        ? Math.round((onTimeCount / tasksWithDueDate.length) * 100)
        : null;

    // Build response
    const analytics = {
      orchestratorId,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: 'custom',
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
      message: 'Orchestrator analytics retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/analytics] Error:',
      error
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ANALYTICS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
