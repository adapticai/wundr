/**
 * Channel Join API Route
 *
 * Allows users to self-join public channels.
 *
 * Routes:
 * - POST /api/channels/:channelId/join - Join a public channel
 *
 * @module app/api/channels/[channelId]/join/route
 */

import { prisma } from '@genesis/database';
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
 * POST /api/channels/:channelId/join
 *
 * Self-join a public channel. User must be a workspace member.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Created membership object
 *
 * @example
 * ```
 * POST /api/channels/ch_123/join
 * ```
 */
export async function POST(
  request: NextRequest,
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

    // Get channel with workspace info
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        workspace: true,
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

    // Check if channel is archived
    if (channel.isArchived) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot join archived channel',
          ORG_ERROR_CODES.CHANNEL_ARCHIVED,
        ),
        { status: 400 },
      );
    }

    // Only public channels can be self-joined
    if (channel.type !== 'PUBLIC') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot join private channel. Request an invite from a channel admin.',
          ORG_ERROR_CODES.CANNOT_JOIN_PRIVATE,
        ),
        { status: 403 },
      );
    }

    // Check if user is a workspace member
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: channel.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to join channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if user is already a member
    const existingMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You are already a member of this channel',
          ORG_ERROR_CODES.ALREADY_MEMBER,
        ),
        { status: 409 },
      );
    }

    // Join channel
    const membership = await prisma.channelMember.create({
      data: {
        channelId: params.channelId,
        userId: session.user.id,
        role: 'MEMBER',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: membership, message: 'Successfully joined channel' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/join] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
