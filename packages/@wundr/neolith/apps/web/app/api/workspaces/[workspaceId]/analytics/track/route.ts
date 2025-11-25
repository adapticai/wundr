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

const analyticsService = new AnalyticsServiceImpl({
  prisma: prisma as unknown as AnalyticsDatabaseClient,
  redis: redis as unknown as AnalyticsRedisClient,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const body = await request.json();

    const { eventType, eventData, sessionId } = body;

    if (!eventType) {
      return NextResponse.json({ error: 'Event type required' }, { status: 400 });
    }

    // Get metadata from request
    const userAgent = request.headers.get('user-agent') || undefined;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || undefined;

    await analyticsService.track({
      workspaceId,
      userId: session.user.id,
      eventType,
      eventData: eventData || {},
      sessionId,
      metadata: {
        userAgent,
        ipAddress: ip,
        platform: body.platform,
        version: body.version,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error);
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
