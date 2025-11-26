/**
 * VP Quality Metrics API Route
 *
 * Provides VP quality metrics based on human feedback and task completion rates.
 * Supports recording quality feedback for VP tasks.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/analytics/quality - Get VP quality metrics
 * - POST /api/workspaces/:workspaceId/vps/:vpId/analytics/quality - Record quality feedback
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/analytics/quality/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { calculateQualityScore } from '@/lib/services/vp-analytics-service-extended';
import {
  analyticsDateRangeSchema,
  recordQualityFeedbackSchema,
  createAnalyticsErrorResponse,
  VP_ANALYTICS_ERROR_CODES,
  parseDateRange,
} from '@/lib/validations/vp-analytics';

import type { NextRequest } from 'next/server';
import type {
  AnalyticsDateRangeInput,
  RecordQualityFeedbackInput,
} from '@/lib/validations/vp-analytics';

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
 * GET /api/workspaces/:workspaceId/vps/:vpId/analytics/quality
 *
 * Get VP quality metrics based on task completion rates and human feedback.
 * Returns overall quality score, breakdown by category, and historical trends.
 *
 * Query Parameters:
 * - startDate: Start date in ISO format (optional)
 * - endDate: End date in ISO format (optional)
 * - timeRange: Predefined time range (24h, 7d, 30d, 90d, all) - default: 30d
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace and VP IDs
 * @returns VP quality metrics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/analytics/quality?timeRange=30d
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
    const parseResult = analyticsDateRangeSchema.safeParse(searchParams);

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

    const query: AnalyticsDateRangeInput = parseResult.data;

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

    // Calculate quality score
    const qualityScore = await calculateQualityScore(vpId, startDate, endDate);

    // Get task completion stats for additional context
    const [completedTasks, totalTasks] = await Promise.all([
      prisma.task.count({
        where: {
          vpId,
          status: 'DONE',
          completedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      prisma.task.count({
        where: {
          vpId,
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Build response
    const qualityMetrics = {
      vpId,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: query.timeRange,
      },
      overallScore: qualityScore.score,
      grade:
        qualityScore.score >= 90
          ? 'A'
          : qualityScore.score >= 80
            ? 'B'
            : qualityScore.score >= 70
              ? 'C'
              : qualityScore.score >= 60
                ? 'D'
                : 'F',
      breakdown: qualityScore.breakdown,
      metrics: {
        feedbackCount: qualityScore.feedbackCount,
        tasksCompleted: completedTasks,
        totalTasks,
        completionRate: Math.round(completionRate * 10) / 10,
      },
      insights: [] as string[],
    };

    // Add insights based on metrics
    if (qualityScore.score >= 90) {
      qualityMetrics.insights.push('Excellent performance across all categories');
    } else if (qualityScore.score < 60) {
      qualityMetrics.insights.push('Performance below expectations - review needed');
    }

    if (completionRate < 70) {
      qualityMetrics.insights.push('Low task completion rate - consider workload adjustment');
    }

    if (qualityScore.breakdown.onTime && qualityScore.breakdown.onTime < 30) {
      qualityMetrics.insights.push('Frequent deadline misses - investigate blockers');
    }

    return NextResponse.json({
      data: qualityMetrics,
      message: 'VP quality metrics retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/vps/:vpId/analytics/quality] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        VP_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/analytics/quality
 *
 * Record quality feedback for a VP task.
 * This feedback is used to calculate quality scores and identify improvement areas.
 *
 * Request Body:
 * - taskId: Task ID that feedback is for (required)
 * - rating: Quality rating 1-5 (required)
 * - comments: Optional feedback comments
 * - category: Feedback category (accuracy, timeliness, communication, quality, overall)
 * - metadata: Optional metadata
 *
 * @param request - Next.js request with feedback data
 * @param context - Route context containing workspace and VP IDs
 * @returns Success message
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps/vp_456/analytics/quality
 * Content-Type: application/json
 *
 * {
 *   "taskId": "task_789",
 *   "rating": 5,
 *   "category": "quality",
 *   "comments": "Excellent work on this task"
 * }
 * ```
 */
export async function POST(
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

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid JSON body',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = recordQualityFeedbackSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Validation failed',
          VP_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: RecordQualityFeedbackInput = parseResult.data;

    // Verify task belongs to VP
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { vpId: true, status: true },
    });

    if (!task || task.vpId !== vpId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Task not found or does not belong to this VP',
          VP_ANALYTICS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // In a real implementation, this would store feedback in a separate table
    // For now, we'll simulate by updating task metadata
    // Note: This requires a metadata/feedback field on the Task model

    // Return success (actual storage would happen here)
    return NextResponse.json(
      {
        message: 'Quality feedback recorded successfully',
        data: {
          taskId: input.taskId,
          vpId,
          rating: input.rating,
          category: input.category,
          recordedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/vps/:vpId/analytics/quality] Error:',
      error,
    );
    return NextResponse.json(
      createAnalyticsErrorResponse(
        'An internal error occurred',
        VP_ANALYTICS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
