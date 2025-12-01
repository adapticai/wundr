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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    // Verify membership
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });

    const period = (searchParams.get('period') || 'month') as
      | 'day'
      | 'week'
      | 'month'
      | 'quarter'
      | 'year'
      | 'custom';
    const startDate = searchParams.get('from')
      ? new Date(searchParams.get('from')!)
      : undefined;
    const endDate = searchParams.get('to')
      ? new Date(searchParams.get('to')!)
      : undefined;

    const metrics = await analyticsService.getMetrics({
      workspaceId,
      period,
      startDate,
      endDate,
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Analytics metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
