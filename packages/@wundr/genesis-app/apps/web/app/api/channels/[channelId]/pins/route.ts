/**
 * Channel Pins API Routes
 *
 * Handles pinned messages for channels.
 * Pins are stored as metadata on the channel settings.
 *
 * Routes:
 * - GET /api/channels/:channelId/pins - Get pinned messages
 * - POST /api/channels/:channelId/pins - Pin a message
 * - DELETE /api/channels/:channelId/pins - Unpin a message (with messageId query param)
 *
 * @module app/api/channels/[channelId]/pins/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  pinMessageSchema,
  channelIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { PinMessageInput } from '@/lib/validations/message';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Type for channel settings with pins
 */
interface ChannelSettings {
  pinnedMessageIds?: string[];
  [key: string]: unknown;
}

/**
 * Helper function to check channel membership and get role
 */
async function checkChannelMembershipWithRole(channelId: string, userId: string) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          settings: true,
          workspaceId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * GET /api/channels/:channelId/pins
 *
 * Get all pinned messages in a channel.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns List of pinned messages
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MESSAGE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check channel membership
    const membership = await checkChannelMembershipWithRole(params.channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Get pinned message IDs from channel settings
    const settings = membership.channel.settings as ChannelSettings;
    const pinnedMessageIds = settings.pinnedMessageIds ?? [];

    if (pinnedMessageIds.length === 0) {
      return NextResponse.json({
        data: [],
      });
    }

    // Fetch pinned messages
    const pinnedMessages = await prisma.message.findMany({
      where: {
        id: { in: pinnedMessageIds },
        channelId: params.channelId,
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Maintain pin order from settings
    const orderedPins = pinnedMessageIds
      .map((id) => pinnedMessages.find((m) => m.id === id))
      .filter(Boolean);

    return NextResponse.json({
      data: orderedPins,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/pins] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/channels/:channelId/pins
 *
 * Pin a message to a channel.
 * Requires authentication, channel membership, and admin/owner role.
 *
 * @param request - Next.js request with message ID to pin
 * @param context - Route context containing channel ID
 * @returns Updated list of pinned messages
 *
 * @example
 * ```
 * POST /api/channels/ch_123/pins
 * Content-Type: application/json
 *
 * {
 *   "messageId": "msg_456"
 * }
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
        createErrorResponse('Authentication required', MESSAGE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = pinMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: PinMessageInput = parseResult.data;

    // Check channel membership and role
    const membership = await checkChannelMembershipWithRole(params.channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Only admins and owners can pin messages
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Only channel admins can pin messages',
          MESSAGE_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify message exists and belongs to this channel
    const message = await prisma.message.findUnique({
      where: { id: input.messageId },
      select: { id: true, channelId: true, isDeleted: true },
    });

    if (!message || message.isDeleted) {
      return NextResponse.json(
        createErrorResponse('Message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    if (message.channelId !== params.channelId) {
      return NextResponse.json(
        createErrorResponse(
          'Message does not belong to this channel',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get current pinned messages
    const settings = membership.channel.settings as ChannelSettings;
    const pinnedMessageIds = settings.pinnedMessageIds ?? [];

    // Check if already pinned
    if (pinnedMessageIds.includes(input.messageId)) {
      return NextResponse.json(
        createErrorResponse(
          'Message is already pinned',
          MESSAGE_ERROR_CODES.PIN_ALREADY_EXISTS,
        ),
        { status: 409 },
      );
    }

    // Add message to pins (at the beginning)
    const updatedPins = [input.messageId, ...pinnedMessageIds];

    // Update channel settings
    await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        settings: {
          ...settings,
          pinnedMessageIds: updatedPins,
        } as Prisma.InputJsonValue,
      },
    });

    // Fetch the pinned message to return
    const pinnedMessage = await prisma.message.findUnique({
      where: { id: input.messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: pinnedMessage, message: 'Message pinned successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/pins] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/channels/:channelId/pins
 *
 * Unpin a message from a channel.
 * Requires authentication, channel membership, and admin/owner role.
 *
 * @param request - Next.js request with messageId query param
 * @param context - Route context containing channel ID
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/channels/ch_123/pins?messageId=msg_456
 * ```
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', MESSAGE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get messageId from query params
    const messageId = request.nextUrl.searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json(
        createErrorResponse(
          'messageId query parameter is required',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check channel membership and role
    const membership = await checkChannelMembershipWithRole(params.channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Only admins and owners can unpin messages
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Only channel admins can unpin messages',
          MESSAGE_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get current pinned messages
    const settings = membership.channel.settings as ChannelSettings;
    const pinnedMessageIds = settings.pinnedMessageIds ?? [];

    // Check if message is pinned
    if (!pinnedMessageIds.includes(messageId)) {
      return NextResponse.json(
        createErrorResponse(
          'Message is not pinned',
          MESSAGE_ERROR_CODES.PIN_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Remove message from pins
    const updatedPins = pinnedMessageIds.filter((id) => id !== messageId);

    // Update channel settings
    await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        settings: {
          ...settings,
          pinnedMessageIds: updatedPins,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      message: 'Message unpinned successfully',
      unpinnedId: messageId,
    });
  } catch (error) {
    console.error('[DELETE /api/channels/:channelId/pins] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
