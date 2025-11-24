import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AnalyticsService } from '@genesis/core';

const analyticsService = new AnalyticsService({ prisma, redis });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
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
