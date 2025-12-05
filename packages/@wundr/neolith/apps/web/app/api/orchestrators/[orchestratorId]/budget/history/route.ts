/**
 * Token Budget History API Routes
 *
 * Handles retrieving historical token usage data with configurable
 * time ranges and aggregation granularity.
 *
 * Routes:
 * - GET /api/orchestrators/:orchestratorId/budget/history - Get usage history
 *
 * @module app/api/orchestrators/[orchestratorId]/budget/history/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  orchestratorIdParamSchema,
  usageHistoryQuerySchema,
  createErrorResponse,
  BUDGET_ERROR_CODES,
} from '@/lib/validations/token-budget';

import type {
  UsageHistoryQuery,
  UsageHistoryEntry,
  TimeRangePreset,
  Granularity,
} from '@/lib/validations/token-budget';
import type { NextRequest } from 'next/server';

/**
 * Route context with orchestrator ID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an orchestrator
 */
async function getOrchestratorWithAccessCheck(
  orchestratorId: string,
  userId: string,
) {
  const userOrganizations = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true, role: true },
  });

  const accessibleOrgIds = userOrganizations.map(m => m.organizationId);

  const orchestrator = await prisma.orchestrator.findUnique({
    where: { id: orchestratorId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (
    !orchestrator ||
    !accessibleOrgIds.includes(orchestrator.organizationId)
  ) {
    return null;
  }

  return orchestrator;
}

/**
 * Calculate date range from preset
 */
function getDateRangeFromPreset(preset: TimeRangePreset): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (preset) {
    case 'LAST_24_HOURS':
      start.setHours(start.getHours() - 24);
      break;
    case 'LAST_7_DAYS':
      start.setDate(start.getDate() - 7);
      break;
    case 'LAST_30_DAYS':
      start.setDate(start.getDate() - 30);
      break;
    case 'LAST_90_DAYS':
      start.setDate(start.getDate() - 90);
      break;
    case 'THIS_MONTH':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'LAST_MONTH':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(1);
      end.setHours(0, 0, 0, 0);
      break;
    case 'THIS_YEAR':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'CUSTOM':
      // Will be handled by explicit startDate/endDate
      break;
  }

  return { start, end };
}

/**
 * Get SQL interval for granularity
 */
function getIntervalForGranularity(granularity: Granularity): string {
  switch (granularity) {
    case 'HOUR':
      return '1 hour';
    case 'DAY':
      return '1 day';
    case 'WEEK':
      return '7 days';
    case 'MONTH':
      return '1 month';
  }
}

/**
 * Get SQL date truncation for granularity
 */
function getDateTruncForGranularity(granularity: Granularity): string {
  switch (granularity) {
    case 'HOUR':
      return 'hour';
    case 'DAY':
      return 'day';
    case 'WEEK':
      return 'week';
    case 'MONTH':
      return 'month';
  }
}

/**
 * Query usage history from database with aggregation
 */
async function queryUsageHistory(
  orchestratorId: string,
  startDate: Date,
  endDate: Date,
  granularity: Granularity,
  limit: number,
  offset: number,
): Promise<{ entries: UsageHistoryEntry[]; total: number }> {
  const dateTrunc = getDateTruncForGranularity(granularity);
  const interval = getIntervalForGranularity(granularity);

  // Query aggregated usage data
  // This assumes there's a token_usage table tracking usage
  const entries = await prisma.$queryRaw<
    Array<{
      period_start: Date;
      period_end: Date;
      tokens_used: bigint;
      request_count: bigint;
      avg_tokens: number;
      peak_tokens: bigint | null;
    }>
  >`
    SELECT
      DATE_TRUNC(${dateTrunc}, created_at) as period_start,
      DATE_TRUNC(${dateTrunc}, created_at) + INTERVAL ${interval} as period_end,
      COALESCE(SUM(tokens_used), 0) as tokens_used,
      COUNT(*) as request_count,
      COALESCE(AVG(tokens_used), 0) as avg_tokens,
      MAX(tokens_used) as peak_tokens
    FROM token_usage
    WHERE orchestrator_id = ${orchestratorId}
      AND created_at >= ${startDate}
      AND created_at < ${endDate}
    GROUP BY DATE_TRUNC(${dateTrunc}, created_at)
    ORDER BY period_start DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Get total count of periods
  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT DATE_TRUNC(${dateTrunc}, created_at)) as count
    FROM token_usage
    WHERE orchestrator_id = ${orchestratorId}
      AND created_at >= ${startDate}
      AND created_at < ${endDate}
  `;

  const total = Number(countResult[0]?.count ?? 0);

  const usageEntries: UsageHistoryEntry[] = entries.map(entry => ({
    periodStart: entry.period_start,
    periodEnd: entry.period_end,
    tokensUsed: Number(entry.tokens_used),
    requestCount: Number(entry.request_count),
    avgTokensPerRequest: Number(entry.avg_tokens),
    peakTokensPerRequest: entry.peak_tokens
      ? Number(entry.peak_tokens)
      : undefined,
  }));

  return { entries: usageEntries, total };
}

/**
 * GET /api/orchestrators/:orchestratorId/budget/history
 *
 * Get historical token usage data with configurable time range
 * and aggregation granularity.
 *
 * Query Parameters:
 * - timeRange: Time range preset (LAST_24_HOURS, LAST_7_DAYS, etc.)
 * - startDate: Custom start date (ISO 8601) - required if timeRange is CUSTOM
 * - endDate: Custom end date (ISO 8601) - required if timeRange is CUSTOM
 * - granularity: Aggregation granularity (HOUR, DAY, WEEK, MONTH)
 * - limit: Maximum number of results (default: 100)
 * - offset: Pagination offset (default: 0)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing orchestrator ID
 * @returns Paginated usage history with statistics
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
        createErrorResponse(
          'Authentication required',
          BUDGET_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate orchestrator ID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid orchestrator ID format',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      timeRange: searchParams.get('timeRange') || 'LAST_7_DAYS',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      granularity: searchParams.get('granularity') || 'DAY',
      limit: searchParams.get('limit') || '100',
      offset: searchParams.get('offset') || '0',
    };

    // Validate query parameters
    const parseResult = usageHistoryQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          BUDGET_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const query: UsageHistoryQuery = parseResult.data;

    // Get orchestrator with access check
    const orchestrator = await getOrchestratorWithAccessCheck(
      params.orchestratorId,
      session.user.id,
    );

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          BUDGET_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (query.timeRange === 'CUSTOM') {
      if (!query.startDate || !query.endDate) {
        return NextResponse.json(
          createErrorResponse(
            'startDate and endDate are required for CUSTOM time range',
            BUDGET_ERROR_CODES.INVALID_TIME_RANGE,
          ),
          { status: 400 },
        );
      }
      startDate = new Date(query.startDate);
      endDate = new Date(query.endDate);
    } else {
      const range = getDateRangeFromPreset(query.timeRange);
      startDate = range.start;
      endDate = range.end;
    }

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json(
        createErrorResponse(
          'startDate must be before endDate',
          BUDGET_ERROR_CODES.INVALID_TIME_RANGE,
        ),
        { status: 400 },
      );
    }

    // Query usage history
    const { entries, total } = await queryUsageHistory(
      orchestrator.id,
      startDate,
      endDate,
      query.granularity,
      query.limit,
      query.offset,
    );

    // Calculate summary statistics
    const totalTokens = entries.reduce(
      (sum, entry) => sum + entry.tokensUsed,
      0,
    );
    const totalRequests = entries.reduce(
      (sum, entry) => sum + entry.requestCount,
      0,
    );
    const avgTokensPerRequest =
      totalRequests > 0 ? totalTokens / totalRequests : 0;

    return NextResponse.json({
      data: {
        orchestratorId: orchestrator.id,
        orchestratorName: orchestrator.user.name,
        timeRange: {
          preset: query.timeRange,
          startDate,
          endDate,
        },
        granularity: query.granularity,
        summary: {
          totalTokens,
          totalRequests,
          avgTokensPerRequest: Math.round(avgTokensPerRequest * 100) / 100,
          periodCount: entries.length,
        },
        history: entries,
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + entries.length < total,
        },
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/:orchestratorId/budget/history] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BUDGET_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
