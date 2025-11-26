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
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    const membership = await prisma.workspace_members.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const period = (searchParams.get('period') || 'month') as 'day' | 'week' | 'month' | 'quarter' | 'year';

    const analyticsService = new AnalyticsServiceImpl({
      prisma: prisma as unknown as AnalyticsDatabaseClient,
      redis: redis as unknown as AnalyticsRedisClient,
    });
    const report = await analyticsService.generateInsightReport(workspaceId, period);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Analytics insights error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
