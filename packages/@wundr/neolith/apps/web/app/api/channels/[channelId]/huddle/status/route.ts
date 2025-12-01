/**
 * Channel Huddle Status API Route
 *
 * Get the status of the active huddle in a channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/huddle/status - Get huddle status
 *
 * @module app/api/channels/[channelId]/huddle/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';
import type { HuddleResponse } from '@/lib/validations/call';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * GET /api/channels/:channelId/huddle/status
 *
 * Get the status of the active huddle in a channel.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Huddle status or null if no active huddle
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get channel ID from params
    const params = await context.params;
    const { channelId } = params;

    // Get channel with settings
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        settings: true,
        type: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get active huddle from channel settings
    const settings = channel.settings as {
      activeHuddle?: {
        id: string;
        name: string;
        roomName: string;
        status: 'active' | 'ended';
        createdAt: string;
        endedAt: string | null;
        createdBy: { id: string; name: string | null };
        participantCount: number;
      };
    } | null;

    const activeHuddle = settings?.activeHuddle;

    // If no active huddle or huddle has ended, return null
    if (!activeHuddle || activeHuddle.status !== 'active') {
      return NextResponse.json({
        data: null,
        message: 'No active huddle',
      });
    }

    // Return huddle status
    const response: HuddleResponse = {
      id: activeHuddle.id,
      workspaceId: channel.workspaceId,
      name: activeHuddle.name,
      description: `Huddle in #${channel.name}`,
      isPublic: channel.type === 'PUBLIC',
      roomName: activeHuddle.roomName,
      status: activeHuddle.status,
      createdAt: new Date(activeHuddle.createdAt),
      endedAt: activeHuddle.endedAt ? new Date(activeHuddle.endedAt) : null,
      createdBy: activeHuddle.createdBy,
      participantCount: activeHuddle.participantCount,
    };

    return NextResponse.json({
      data: response,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/huddle/status] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
