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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const metric = searchParams.get('metric') || 'messages';
    const period = searchParams.get('period') || 'week';

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
      default:
        currentStart = new Date(now);
        currentStart.setMonth(now.getMonth() - 1);
        previousEnd = new Date(currentStart);
        previousStart = new Date(previousEnd);
        previousStart.setMonth(previousStart.getMonth() - 1);
        break;
    }

    const trend = await analyticsService.getTrend(
      workspaceId,
      metric,
      { start: currentStart, end: currentEnd },
      { start: previousStart, end: previousEnd },
    );

    return NextResponse.json({ metric, period, trend });
  } catch (error) {
    console.error('Analytics trends error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 },
    );
  }
}
