import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AnalyticsService } from '@genesis/core';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
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

    const analyticsService = new AnalyticsService({ prisma, redis });
    const stats = await analyticsService.getRealTimeStats(workspaceId);

    return NextResponse.json({ stats, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch real-time stats' }, { status: 500 });
  }
}
