/**
 * Channel Leave API Routes
 *
 * Handles leaving channels for users.
 *
 * Routes:
 * - POST /api/channels/:channelId/leave - Leave a channel
 *
 * @module app/api/channels/[channelId]/leave/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
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
 * POST /api/channels/:channelId/leave
 *
 * Leave a channel. User will be removed from the channel membership.
 * Note: Cannot leave DM channels - use close conversation instead.
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

    const params = await context.params;
    const { channelId } = params;

    // Get the channel to verify it exists and check type
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        channelMembers: {
          where: { userId: session.user.id },
        },
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

    // Check if user is a member
    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Cannot leave DM channels - use close conversation instead
    if (channel.type === 'DM') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot leave direct message conversations. Use close conversation instead.',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check if user is the only admin - prevent orphaning the channel
    const adminCount = await prisma.channelMember.count({
      where: {
        channelId,
        role: 'ADMIN',
      },
    });

    const userMembership = channel.channelMembers[0];
    if (userMembership.role === 'ADMIN' && adminCount === 1) {
      // Count total members
      const totalMembers = await prisma.channelMember.count({
        where: { channelId },
      });

      if (totalMembers > 1) {
        return NextResponse.json(
          createErrorResponse(
            'You are the only admin. Please assign another admin before leaving.',
            ORG_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }
    }

    // Remove the user from the channel
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully left the channel',
    });
  } catch (error) {
    console.error('[POST /api/channels/:channelId/leave] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
