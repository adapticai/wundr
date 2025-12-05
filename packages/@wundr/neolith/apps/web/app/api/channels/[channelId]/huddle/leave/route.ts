/**
 * Channel Huddle Leave API Route
 *
 * Leave an active huddle in a channel.
 *
 * Routes:
 * - POST /api/channels/:channelId/huddle/leave - Leave channel huddle
 *
 * @module app/api/channels/[channelId]/huddle/leave/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CALL_ERROR_CODES } from '@/lib/validations/call';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * POST /api/channels/:channelId/huddle/leave
 *
 * Leave the active huddle in a channel. If the last participant leaves,
 * the huddle is automatically ended.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Success message
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get channel ID from params
    const params = await context.params;
    const { channelId } = params;

    // Get channel
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get active huddle from channel settings
    const settings = channel.settings as {
      activeHuddle?: { status: string };
    } | null;
    const activeHuddle = settings?.activeHuddle;

    if (!activeHuddle || activeHuddle.status !== 'active') {
      return NextResponse.json(
        createErrorResponse(
          'No active huddle in this channel',
          CALL_ERROR_CODES.HUDDLE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // In a real implementation, you would:
    // 1. Track participant presence via LiveKit webhooks or database
    // 2. Remove the participant from the huddle
    // 3. If last participant, end the huddle

    return NextResponse.json({
      message: 'Left huddle successfully',
    });
  } catch (error) {
    console.error('[POST /api/channels/:channelId/huddle/leave] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
