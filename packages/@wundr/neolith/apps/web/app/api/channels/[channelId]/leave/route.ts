/**
 * Channel Leave API Route
 *
 * Allows users to leave a channel.
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
  channelIdParamSchema,
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
 * Leave a channel. Cannot leave if you are the last admin.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Success message
 *
 * @example
 * ```
 * POST /api/channels/ch_123/leave
 * ```
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
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
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
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this channel',
          ORG_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 404 },
      );
    }

    // Cannot leave if you are the last admin
    if (membership.role === 'ADMIN') {
      const adminCount = await prisma.channelMember.count({
        where: {
          channelId: params.channelId,
          role: 'ADMIN',
        },
      });

      if (adminCount === 1) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot leave as the last admin. Promote another member first or delete the channel.',
            ORG_ERROR_CODES.CANNOT_LEAVE_LAST_ADMIN,
          ),
          { status: 400 },
        );
      }
    }

    // Leave channel
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      message: 'Successfully left channel',
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
