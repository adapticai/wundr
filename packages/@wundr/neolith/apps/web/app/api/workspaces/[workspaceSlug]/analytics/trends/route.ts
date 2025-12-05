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
    const metric = searchParams.get('metric') || 'messages';
    const period = searchParams.get('period') || 'week';

    // Validate metric
    const validMetrics = [
      'messages',
      'active_users',
      'files',
      'channels',
      'tasks',
      'workflows',
    ];
    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        {
          error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`,
          code: 'INVALID_METRIC',
        },
        { status: 400 }
      );
    }

    // Validate period
    const validPeriods = ['day', 'week', 'month', 'quarter', 'year'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        {
          error: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
          code: 'INVALID_PERIOD',
        },
        { status: 400 }
      );
    }

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    // Calculate current and previous period dates
    const now = new Date();
    let currentStart: Date;
    const currentEnd = now;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'day':
        currentStart = new Date(now);
        currentStart.setHours(0, 0, 0, 0);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 1);
        break;
      case 'week':
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - 7);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 7);
        break;
      case 'month':
        currentStart = new Date(now);
        currentStart.setMonth(now.getMonth() - 1);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setMonth(previousStart.getMonth() - 1);
        break;
      case 'quarter':
        currentStart = new Date(now);
        currentStart.setMonth(now.getMonth() - 3);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setMonth(previousStart.getMonth() - 3);
        break;
      case 'year':
        currentStart = new Date(now);
        currentStart.setFullYear(now.getFullYear() - 1);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setFullYear(previousStart.getFullYear() - 1);
        break;
      default:
        currentStart = new Date(now);
        currentStart.setDate(now.getDate() - 7);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setDate(previousStart.getDate() - 7);
    }

    const trend = await analyticsService.getTrend(
      workspaceId,
      metric,
      { start: currentStart, end: currentEnd },
      { start: previousStart, end: previousEnd }
    );

    return NextResponse.json({
      data: {
        metric,
        period,
        trend,
      },
      meta: {
        workspaceId,
        currentPeriod: {
          start: currentStart.toISOString(),
          end: currentEnd.toISOString(),
        },
        previousPeriod: {
          start: previousStart.toISOString(),
          end: previousEnd.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/analytics/trends]', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trends',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
