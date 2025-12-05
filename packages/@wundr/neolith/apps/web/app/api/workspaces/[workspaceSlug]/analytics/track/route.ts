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

    // Validate workspace ID format (UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json(
        { error: 'Invalid workspace ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Parse request body with validation
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    const { eventType, eventData, sessionId } = body;

    // Validate required fields
    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json(
        {
          error: 'Event type required and must be a string',
          code: 'MISSING_EVENT_TYPE',
        },
        { status: 400 }
      );
    }

    // Validate event type format (alphanumeric, underscores, dots)
    if (!/^[a-zA-Z0-9._-]+$/.test(eventType)) {
      return NextResponse.json(
        {
          error:
            'Invalid event type format. Use alphanumeric characters, dots, underscores, or dashes',
          code: 'INVALID_EVENT_TYPE',
        },
        { status: 400 }
      );
    }

    // Validate eventData if provided
    if (eventData !== undefined && typeof eventData !== 'object') {
      return NextResponse.json(
        { error: 'Event data must be an object', code: 'INVALID_EVENT_DATA' },
        { status: 400 }
      );
    }

    // Validate sessionId if provided
    if (sessionId !== undefined && typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID must be a string', code: 'INVALID_SESSION_ID' },
        { status: 400 }
      );
    }

    // Get metadata from request
    const userAgent = request.headers.get('user-agent') || undefined;
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined;

    await analyticsService.track({
      workspaceId,
      userId: session.user.id,
      eventType: eventType as never,
      eventData: (eventData || {}) as Record<
        string,
        string | number | boolean | undefined
      >,
      sessionId: sessionId as string | undefined,
      metadata: {
        userAgent,
        ipAddress: ip,
        platform: typeof body.platform === 'string' ? body.platform : undefined,
        version: typeof body.version === 'string' ? body.version : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully',
      eventType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/analytics/track]', error);
    return NextResponse.json(
      {
        error: 'Failed to track event',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
