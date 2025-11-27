/**
 * OrchestratorComparison Analytics API Route
 *
 * Compares Orchestrator performance across a workspace.
 * Ranks Orchestrators by various metrics to identify top performers and improvement areas.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/analytics/comparison - Compare Orchestrator performance
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/analytics/comparison/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { compareOrchestrators } from '@/lib/services/orchestrator-analytics-service-extended';
import {
  orchestratorComparisonQuerySchema,
  createAnalyticsErrorResponse,
  ORCHESTRATOR_ANALYTICS_ERROR_CODES,
} from '@/lib/validations/orchestrator-analytics';

import type { OrchestratorComparisonQueryInput } from '@/lib/validations/orchestrator-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Helper to verify workspace access
 */
async function verifyWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true, name: true },
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

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/analytics/comparison
 *
 * Compare Orchestrator performance across workspace.
 * Returns ranked list of Orchestrators by selected metric with percentile rankings.
 *
 * Query Parameters:
 * - metric: Metric to compare by (taskCompletionRate, avgResponseTime, qualityScore, tasksCompleted, errorRate)
 * - timeRange: Time range for comparison (24h, 7d, 30d, 90d) - default: 30d
 * - limit: Number of top performers to return (1-50) - default: 10
 * - discipline: Filter by discipline (optional)
 * - includeInactive: Include inactive Orchestrators (boolean) - default: false
 * - sortOrder: Sort order (asc, desc) - default: desc
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Orchestrator comparison data with rankings
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/analytics/comparison?metric=taskCompletionRate&limit=10
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
    const { workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Invalid workspace ID',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const access = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAnalyticsErrorResponse(
          'Workspace not found or access denied',
          ORCHESTRATOR_ANALYTICS_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = orchestratorComparisonQuerySchema.safeParse(searchParams);

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

    const query: OrchestratorComparisonQueryInput = parseResult.data;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    switch (query.timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get Orchestrator comparison data
    const comparison = await compareOrchestrators(
      access.workspace.organizationId,
      query.metric,
      query.limit,
      startDate,
      endDate,
    );

    // Filter by discipline if specified
    let filteredComparison = comparison;
    if (query.discipline) {
      filteredComparison = comparison.filter(
        (orchestrator) => orchestrator.discipline.toLowerCase() === query.discipline?.toLowerCase(),
      );
    }

    // Filter inactive Orchestrators if not included
    if (!query.includeInactive) {
      const activeOrchestratorIds = await prisma.orchestrator
        .findMany({
          where: {
            organizationId: access.workspace.organizationId,
            status: { not: 'OFFLINE' },
          },
          select: { id: true },
        })
        .then((orchestrators) => orchestrators.map((orchestrator) => orchestrator.id));

      filteredComparison = filteredComparison.filter((orchestrator) =>
        activeOrchestratorIds.includes(orchestrator.orchestratorId),
      );
    }

    // Get total Orchestrator count for context
    const totalOrchestratorCount = await prisma.orchestrator.count({
      where: {
        organizationId: access.workspace.organizationId,
        ...(query.discipline && { discipline: query.discipline }),
        ...(query.includeInactive ? {} : { status: { not: 'OFFLINE' } }),
      },
    });

    // Calculate summary statistics
    const metricValues = filteredComparison.map((orchestrator) => orchestrator.metricValue);
    const avgMetricValue =
      metricValues.length > 0
        ? metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length
        : 0;
    const maxMetricValue = metricValues.length > 0 ? Math.max(...metricValues) : 0;
    const minMetricValue = metricValues.length > 0 ? Math.min(...metricValues) : 0;

    // Build response
    const response = {
      workspaceId,
      workspaceName: access.workspace.name,
      metric: query.metric,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: query.timeRange,
      },
      rankings: filteredComparison.map((orchestrator) => ({
        rank: orchestrator.rank,
        orchestratorId: orchestrator.orchestratorId,
        orchestratorName: orchestrator.orchestratorName,
        discipline: orchestrator.discipline,
        role: orchestrator.role,
        metricValue: Math.round(orchestrator.metricValue * 100) / 100,
        percentile: orchestrator.percentile,
        trend: orchestrator.trend,
      })),
      summary: {
        totalOrchestrators: totalOrchestratorCount,
        rankedOrchestrators: filteredComparison.length,
        metric: query.metric,
        avgValue: Math.round(avgMetricValue * 100) / 100,
        maxValue: Math.round(maxMetricValue * 100) / 100,
        minValue: Math.round(minMetricValue * 100) / 100,
      },
      insights: [] as string[],
    };

    // Add insights
    if (filteredComparison.length === 0) {
      response.insights.push('No Orchestrator data available for the selected criteria');
    } else {
      const topPerformer = filteredComparison[0];
      response.insights.push(
        `Top performer: ${topPerformer.orchestratorName} (${topPerformer.discipline}) with ${Math.round(topPerformer.metricValue * 100) / 100}`,
      );

      if (filteredComparison.length >= 3) {
        const topThreeAvg =
          filteredComparison.slice(0, 3).reduce((sum, orchestrator) => sum + orchestrator.metricValue, 0) / 3;
        response.insights.push(
          `Top 3 average: ${Math.round(topThreeAvg * 100) / 100}`,
        );
      }
    }

    return NextResponse.json({
      data: response,
      message: 'Orchestrator comparison retrieved successfully',
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/analytics/comparison] Error:',
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
