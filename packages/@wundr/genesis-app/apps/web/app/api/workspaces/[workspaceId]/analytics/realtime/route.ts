import {
  AnalyticsServiceImpl,
  redis,
  type AnalyticsDatabaseClient,
  type AnalyticsRedisClient,
} from '@genesis/core';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { getServerSession } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;

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
    const stats = await analyticsService.getRealTimeStats(workspaceId);

    return NextResponse.json({ stats, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch real-time stats' }, { status: 500 });
  }
}
