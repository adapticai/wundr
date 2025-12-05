/**
 * Channel Star API Routes
 *
 * Handles starring/unstarring channels for users.
 *
 * Routes:
 * - POST /api/channels/:channelId/star - Star a channel
 * - DELETE /api/channels/:channelId/star - Unstar a channel
 *
 * @module app/api/channels/[channelId]/star/route
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
 * POST /api/channels/:channelId/star
 *
 * Star a channel for the current user.
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

    // Verify the user is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Update the channel member to set isStarred = true
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
      data: {
        isStarred: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Channel starred successfully',
    });
  } catch (error) {
    console.error('[POST /api/channels/:channelId/star] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/channels/:channelId/star
 *
 * Unstar a channel for the current user.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Success message
 */
export async function DELETE(
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

    // Verify the user is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Update the channel member to set isStarred = false
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
      data: {
        isStarred: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Channel unstarred successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/channels/:channelId/star] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
