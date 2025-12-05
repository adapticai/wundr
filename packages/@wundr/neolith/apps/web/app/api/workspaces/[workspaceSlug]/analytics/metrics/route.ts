import {
  AnalyticsServiceImpl,
  redis,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
} from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { getServerSession } from '@/lib/auth';

import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    // Validate workspace ID format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json(
        { error: 'Invalid workspace ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Verify membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const period = (searchParams.get('period') || 'month') as
      | 'day'
      | 'week'
      | 'month'
      | 'quarter'
      | 'year'
      | 'custom';
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const metricsFilter = searchParams
      .get('metrics')
      ?.split(',')
      .filter(Boolean);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '100', 10)),
      1000
    );

    // Validate period
    const validPeriods = ['day', 'week', 'month', 'quarter', 'year', 'custom'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        {
          error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
          code: 'INVALID_PERIOD',
        },
        { status: 400 }
      );
    }

    // Parse and validate dates
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (fromParam) {
      startDate = new Date(fromParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid from date format. Use ISO 8601 format (YYYY-MM-DD)',
            code: 'INVALID_DATE',
          },
          { status: 400 }
        );
      }
    }

    if (toParam) {
      endDate = new Date(toParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid to date format. Use ISO 8601 format (YYYY-MM-DD)',
            code: 'INVALID_DATE',
          },
          { status: 400 }
        );
      }
    }

    // Validate date range
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: 'from date must be before to date', code: 'INVALID_RANGE' },
        { status: 400 }
      );
    }

    // Custom period requires dates
    if (period === 'custom' && (!startDate || !endDate)) {
      return NextResponse.json(
        {
          error: 'Custom period requires both from and to dates',
          code: 'MISSING_DATES',
        },
        { status: 400 }
      );
    }

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    const metrics = await analyticsService.getMetrics({
      workspaceId,
      period,
      startDate,
      endDate,
      metrics: metricsFilter,
    });

    // Return with pagination metadata
    return NextResponse.json({
      data: metrics,
      pagination: {
        page,
        limit,
        // Note: total calculation would require additional queries
        // This is a placeholder for future implementation
      },
      meta: {
        workspaceId,
        period,
        dateRange: {
          from: startDate?.toISOString(),
          to: endDate?.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/analytics/metrics]',
      error
    );
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
