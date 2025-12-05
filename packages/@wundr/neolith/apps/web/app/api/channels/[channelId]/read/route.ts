/**
 * Channel Read Receipts API Routes
 *
 * Handles read receipt tracking and unread message counts.
 *
 * Routes:
 * - POST /api/channels/:channelId/read - Mark channel as read up to a message
 * - GET /api/channels/:channelId/read - Get unread count for the channel
 *
 * @module app/api/channels/[channelId]/read/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Schema for marking channel as read
 */
const markAsReadSchema = z.object({
  /** Message ID to mark as read up to (inclusive) */
  messageId: z.string().cuid('Invalid message ID').optional(),
});

type MarkAsReadInput = z.infer<typeof markAsReadSchema>;

/**
 * Helper function to check if user is a member of the channel
 */
async function checkChannelMembership(channelId: string, userId: string) {
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    include: {
      channel: {
        include: {
          workspace: {
            select: {
              id: true,
              organizationId: true,
            },
          },
        },
      },
    },
  });

  return membership;
}

/**
 * POST /api/channels/:channelId/read
 *
 * Mark channel as read up to a specific message.
 * Updates the lastReadAt timestamp for the user's channel membership.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request with optional messageId
 * @param context - Route context containing channel ID
 * @returns Success message with updated lastReadAt timestamp
 *
 * @example
 * ```
 * POST /api/channels/ch_123/read
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
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // If no body provided, mark as read with current timestamp
      body = {};
    }

    // Validate input
    const parseResult = markAsReadSchema.safeParse(body);
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

    const input: MarkAsReadInput = parseResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // If messageId provided, verify it exists and belongs to this channel
    if (input.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: input.messageId },
        select: { channelId: true, createdAt: true, isDeleted: true },
      });

      if (!message || message.isDeleted) {
        return NextResponse.json(
          createErrorResponse(
            'Message not found',
            MESSAGE_ERROR_CODES.NOT_FOUND,
          ),
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

      // Update lastReadAt to the message's timestamp
      const updatedMembership = await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId: params.channelId,
            userId: session.user.id,
          },
        },
        data: {
          lastReadAt: message.createdAt,
        },
        select: {
          lastReadAt: true,
        },
      });

      return NextResponse.json({
        data: {
          lastReadAt: updatedMembership.lastReadAt,
          messageId: input.messageId,
        },
        message: 'Channel marked as read',
      });
    } else {
      // No messageId provided - mark as read at current time
      const updatedMembership = await prisma.channelMember.update({
        where: {
          channelId_userId: {
            channelId: params.channelId,
            userId: session.user.id,
          },
        },
        data: {
          lastReadAt: new Date(),
        },
        select: {
          lastReadAt: true,
        },
      });

      return NextResponse.json({
        data: {
          lastReadAt: updatedMembership.lastReadAt,
        },
        message: 'Channel marked as read',
      });
    }
  } catch (error) {
    console.error('[POST /api/channels/:channelId/read] Error:', error);
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
 * GET /api/channels/:channelId/read
 *
 * Get unread message count for a channel.
 * Counts messages created after the user's lastReadAt timestamp.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Unread count and last read timestamp
 *
 * @example
 * ```
 * GET /api/channels/ch_123/read
 * Response:
 * {
 *   "data": {
 *     "unreadCount": 5,
 *     "lastReadAt": "2024-01-15T10:30:00Z",
 *     "hasUnread": true
 *   }
 * }
 * ```
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
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id,
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Count unread messages
    // Messages are unread if:
    // 1. They were created after lastReadAt
    // 2. They are not deleted
    // 3. They were not sent by the current user
    const unreadCount = await prisma.message.count({
      where: {
        channelId: params.channelId,
        isDeleted: false,
        authorId: {
          not: session.user.id, // Don't count own messages
        },
        ...(membership.lastReadAt && {
          createdAt: {
            gt: membership.lastReadAt,
          },
        }),
      },
    });

    // Get the most recent message for additional context
    const latestMessage = await prisma.message.findFirst({
      where: {
        channelId: params.channelId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      data: {
        unreadCount,
        lastReadAt: membership.lastReadAt,
        hasUnread: unreadCount > 0,
        latestMessageId: latestMessage?.id ?? null,
        latestMessageAt: latestMessage?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/read] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
