/**
 * Channel Messages API Routes
 *
 * Handles listing and creating messages within a channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/messages - List messages with cursor pagination
 * - POST /api/channels/:channelId/messages - Send a new message
 *
 * @module app/api/channels/[channelId]/messages/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  sendMessageSchema,
  messageListSchema,
  channelIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { SendMessageInput, MessageListInput } from '@/lib/validations/message';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

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
 * GET /api/channels/:channelId/messages
 *
 * List messages in a channel with cursor-based pagination.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing channel ID
 * @returns Paginated list of messages
 *
 * @example
 * ```
 * GET /api/channels/ch_123/messages?limit=50&cursor=msg_abc&direction=before
 * ```
 */
export async function GET(
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

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = messageListSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: MessageListInput = parseResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(params.channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Build where clause
    const where: Prisma.messageWhereInput = {
      channelId: params.channelId,
      isDeleted: false,
      // Only fetch top-level messages unless includeReplies is true
      ...(!filters.includeReplies && { parentId: null }),
    };

    // Add cursor condition for pagination
    let cursorCondition: Prisma.messageWhereInput = {};
    if (filters.cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: filters.cursor },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        cursorCondition = {
          createdAt: filters.direction === 'before'
            ? { lt: cursorMessage.createdAt }
            : { gt: cursorMessage.createdAt },
        };
      }
    }

    // Fetch messages
    const messages = await prisma.message.findMany({
      where: {
        ...where,
        ...cursorCondition,
      },
      take: filters.limit + 1, // Fetch one extra to determine if there are more
      orderBy: {
        createdAt: filters.direction === 'before' ? 'desc' : 'asc',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        messageAttachments: {
          include: {
            file: {
              select: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                size: true,
                thumbnailUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Check if there are more messages
    const hasMore = messages.length > filters.limit;
    const resultMessages = hasMore ? messages.slice(0, filters.limit) : messages;

    // Reverse if fetching before cursor to maintain chronological order
    if (filters.direction === 'before') {
      resultMessages.reverse();
    }

    // Determine cursors
    const nextCursor = hasMore
      ? resultMessages[resultMessages.length - 1]?.id ?? null
      : null;
    const prevCursor = resultMessages[0]?.id ?? null;

    // Update last read timestamp for the user
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({
      data: resultMessages,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor,
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/messages] Error:', error);
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
 * POST /api/channels/:channelId/messages
 *
 * Send a new message to a channel.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request with message data
 * @param context - Route context containing channel ID
 * @returns Created message object
 *
 * @example
 * ```
 * POST /api/channels/ch_123/messages
 * Content-Type: application/json
 *
 * {
 *   "content": "Hello, world!",
 *   "type": "TEXT",
 *   "parentId": "msg_456"
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
    const parseResult = sendMessageSchema.safeParse(body);
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

    const input: SendMessageInput = parseResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(params.channelId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // If parentId provided, verify parent message exists and belongs to same channel
    if (input.parentId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: input.parentId },
        select: { channelId: true, isDeleted: true, parentId: true },
      });

      if (!parentMessage || parentMessage.isDeleted) {
        return NextResponse.json(
          createErrorResponse(
            'Parent message not found',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 404 },
        );
      }

      if (parentMessage.channelId !== params.channelId) {
        return NextResponse.json(
          createErrorResponse(
            'Parent message belongs to a different channel',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 400 },
        );
      }

      // Don't allow nested threads (parent must be a top-level message)
      if (parentMessage.parentId) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot reply to a thread reply',
            MESSAGE_ERROR_CODES.INVALID_PARENT,
          ),
          { status: 400 },
        );
      }
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: input.content,
        type: input.type,
        metadata: input.metadata as Prisma.InputJsonValue,
        channelId: params.channelId,
        authorId: session.user.id,
        parentId: input.parentId,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        reactions: true,
        messageAttachments: {
          include: {
            file: {
              select: {
                id: true,
                filename: true,
                originalName: true,
                mimeType: true,
                size: true,
                thumbnailUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      { data: message, message: 'Message sent successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/messages] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
