/**
 * VP Analytics Route
 *
 * Provides analytics and performance metrics for a specific VP.
 * Returns task completion rates, performance trends, and observability data.
 *
 * Routes:
 * - GET /api/vps/[id]/analytics - Get VP analytics and metrics
 *
 * @module app/api/vps/[id]/analytics/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getVPAnalytics,
  getVPMetrics,
} from '@/lib/services/vp-analytics-service';
import {
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { MetricTimeRange } from '@/types/vp-analytics';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vps/[id]/analytics
 *
 * Get analytics and performance metrics for a specific VP.
 * Includes task completion rates, trends, and summary statistics.
 *
 * Query Parameters:
 * - timeRange: Time range for metrics (24h, 7d, 30d, 90d, all) - default "7d"
 * - includeDaily: Include daily trends (default true)
 * - includeWeekly: Include weekly trends (default true)
 * - includeMonthly: Include monthly trends (default false)
 *
 * @param request - Next.js request object
 * @param context - Route context containing VP ID
 * @returns VP analytics data and metrics
 *
 * @example
 * ```
 * GET /api/vps/vp_123/analytics?timeRange=30d
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get VP ID from params
    const params = await context.params;
    const vpId = params.id;

    // Validate VP ID format
    if (!vpId || vpId.length === 0) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID', VP_ERROR_CODES.VALIDATION_ERROR),
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
          VP_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Fetch analytics data in parallel
    const [analytics, metrics] = await Promise.all([
      getVPAnalytics(vpId),
      getVPMetrics(vpId, timeRange),
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
    console.error('[GET /api/vps/[id]/analytics] Error:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
      if (error.message.includes('access denied')) {
        return NextResponse.json(
          createErrorResponse('Access denied', VP_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred while fetching analytics',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
