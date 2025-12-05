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
  { params }: { params: Promise<{ workspaceSlug: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
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
        { status: 400 },
      );
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    // Parse and validate period parameter
    const period = (searchParams.get('period') || 'month') as
      | 'day'
      | 'week'
      | 'month'
      | 'quarter'
      | 'year';

    const validPeriods = ['day', 'week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        {
          error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
          code: 'INVALID_PERIOD',
        },
        { status: 400 },
      );
    }

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    const report = await analyticsService.generateInsightReport(
      workspaceId,
      period,
    );

    return NextResponse.json({
      data: report,
      meta: {
        workspaceId,
        period,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/analytics/insights]', error);
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
