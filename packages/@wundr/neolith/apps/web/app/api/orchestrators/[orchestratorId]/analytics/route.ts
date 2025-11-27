/**
 * OrchestratorAnalytics Route
 *
 * Provides analytics and performance metrics for a specific Orchestrator.
 * Returns task completion rates, performance trends, and observability data.
 *
 * Routes:
 * - GET /api/orchestrators/[id]/analytics - Get Orchestrator analytics and metrics
 *
 * @module app/api/orchestrators/[id]/analytics/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getOrchestratorAnalytics,
  getOrchestratorMetrics,
} from '@/lib/services/orchestrator-analytics-service';
import {
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { MetricTimeRange } from '@/types/orchestrator-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orchestrators/[id]/analytics
 *
 * Get analytics and performance metrics for a specific Orchestrator.
 * Includes task completion rates, trends, and summary statistics.
 *
 * Query Parameters:
 * - timeRange: Time range for metrics (24h, 7d, 30d, 90d, all) - default "7d"
 * - includeDaily: Include daily trends (default true)
 * - includeWeekly: Include weekly trends (default true)
 * - includeMonthly: Include monthly trends (default false)
 *
 * @param request - Next.js request object
 * @param context - Route context containing OrchestratorID
 * @returns Orchestrator analytics data and metrics
 *
 * @example
 * ```
 * GET /api/orchestrators/orch_123/analytics?timeRange=30d
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
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get OrchestratorID from params
    const params = await context.params;
    const orchestratorId = params.id;

    // Validate OrchestratorID format
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const timeRange = (searchParams.get('timeRange') || '7d') as MetricTimeRange;
    const includeDaily = searchParams.get('includeDaily') !== 'false';
    const includeWeekly = searchParams.get('includeWeekly') !== 'false';
    const includeMonthly = searchParams.get('includeMonthly') === 'true';

    // Validate time range
    const validTimeRanges: MetricTimeRange[] = ['24h', '7d', '30d', '90d', 'all'];
    if (!validTimeRanges.includes(timeRange)) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`,
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Fetch analytics data in parallel
    const [analytics, metrics] = await Promise.all([
      getOrchestratorAnalytics(orchestratorId),
      getOrchestratorMetrics(orchestratorId, timeRange),
    ]);

    // Filter trends based on query parameters
    const filteredAnalytics = {
      ...analytics,
      daily: includeDaily ? analytics.daily : [],
      weekly: includeWeekly ? analytics.weekly : [],
      monthly: includeMonthly ? analytics.monthly : [],
    };

    return NextResponse.json({
      data: filteredAnalytics,
      metrics,
    });
  } catch (error) {
    console.error('[GET /api/orchestrators/[id]/analytics] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          createErrorResponse('Orchestrator not found', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
      if (error.message.includes('access denied')) {
        return NextResponse.json(
          createErrorResponse('Access denied', ORCHESTRATOR_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred while fetching analytics',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
