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
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/analytics/comparison
 *
 * Compare Orchestrator performance across workspace.
 * Returns comparison data for multiple orchestrators across selected metrics.
 *
 * Query Parameters:
 * - orchestratorIds: Array of orchestrator IDs to compare (2-10 required)
 * - metrics: Array of metrics to compare (task_completion_rate, average_task_duration, etc.)
 * - timeRange: Object with start/end ISO datetime strings and optional granularity
 * - normalization: Normalization method (none, percentage, zscore) - default: none
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Orchestrator comparison data
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/analytics/comparison?orchestratorIds[]=id1&orchestratorIds[]=id2&metrics[]=task_completion_rate
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
    const { workspaceSlug: workspaceId } = params;

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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const orchestratorIds = searchParams.getAll('orchestratorIds[]');
    const metrics = searchParams.getAll('metrics[]');
    const timeRangeStart = searchParams.get('timeRange.start');
    const timeRangeEnd = searchParams.get('timeRange.end');
    const timeRangeGranularity = searchParams.get('timeRange.granularity');
    const normalization = searchParams.get('normalization') || 'none';

    // Build validation input
    const validationInput = {
      orchestratorIds,
      metrics,
      timeRange: {
        start:
          timeRangeStart ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: timeRangeEnd || new Date().toISOString(),
        ...(timeRangeGranularity && { granularity: timeRangeGranularity }),
      },
      normalization,
    };

    // Validate query parameters
    const parseResult =
      orchestratorComparisonQuerySchema.safeParse(validationInput);

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

    // Get Orchestrator comparison data
    const comparison = await compareOrchestrators(
      query.orchestratorIds,
      query.metrics,
    );

    // Build response
    const response = {
      workspaceId,
      orchestratorIds: query.orchestratorIds,
      metrics: query.metrics,
      timeRange: query.timeRange,
      normalization: query.normalization,
      comparison,
    };

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
