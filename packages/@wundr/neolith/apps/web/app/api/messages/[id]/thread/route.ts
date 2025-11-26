/**
 * Thread API Routes
 *
 * Handles thread operations for messages.
 *
 * Routes:
 * - GET /api/messages/:id/thread - Get thread replies
 * - POST /api/messages/:id/thread - Reply to thread
 *
 * @module app/api/messages/[id]/thread/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  sendMessageSchema,
  threadListSchema,
  messageIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { SendMessageInput, ThreadListInput } from '@/lib/validations/message';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with message ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to get parent message and check access
 */
async function getParentMessageWithAccess(messageId: string, userId: string) {
  const message = await prisma.messages.findUnique({
    where: { id: messageId },
    include: {
      channel: {
        include: {
          members: {
            where: { userId },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!message) {
    return { message: null, hasAccess: false };
  }

  const hasAccess = message.channel.members.length > 0;
  return { message, hasAccess };
}

/**
 * GET /api/messages/:id/thread
 *
 * Get all replies to a thread (parent message).
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing parent message ID
 * @returns Paginated list of thread replies
 *
 * @example
 * ```
 * GET /api/messages/msg_123/thread?limit=50&cursor=msg_abc
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

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid message ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = threadListSchema.safeParse(searchParams);

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

    const filters: ThreadListInput = parseResult.data;

    // Get parent message and check access
    const { message: parentMessage, hasAccess } = await getParentMessageWithAccess(
      params.id,
      session.user.id,
    );

    if (!parentMessage) {
      return NextResponse.json(
        createErrorResponse('Parent message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Check if parent message is deleted
    if (parentMessage.isDeleted) {
      return NextResponse.json(
        createErrorResponse('Parent message has been deleted', MESSAGE_ERROR_CODES.MESSAGE_DELETED),
        { status: 410 },
      );
    }

    // Check if this is already a reply (can't have nested threads)
    if (parentMessage.parentId) {
      return NextResponse.json(
        createErrorResponse(
          'This message is a reply, not a thread parent',
          MESSAGE_ERROR_CODES.INVALID_PARENT,
        ),
        { status: 400 },
      );
    }

    // Build cursor condition
    let cursorCondition: Prisma.MessageWhereInput = {};
    if (filters.cursor) {
      const cursorMessage = await prisma.messages.findUnique({
        where: { id: filters.cursor },
        select: { createdAt: true },
      });

      if (cursorMessage) {
        cursorCondition = {
          createdAt: { gt: cursorMessage.createdAt },
        };
      }
    }

    // Fetch thread replies
    const replies = await prisma.messages.findMany({
      where: {
        parentId: params.id,
        isDeleted: false,
        ...cursorCondition,
      },
      take: filters.limit + 1,
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        author: {
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
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        attachments: {
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

    // Check if there are more replies
    const hasMore = replies.length > filters.limit;
    const resultReplies = hasMore ? replies.slice(0, filters.limit) : replies;

    // Get total reply count
    const totalCount = await prisma.messages.count({
      where: {
        parentId: params.id,
        isDeleted: false,
      },
    });

    return NextResponse.json({
      data: {
        parentMessage: {
          id: parentMessage.id,
          content: parentMessage.content,
          createdAt: parentMessage.createdAt,
        },
        replies: resultReplies,
      },
      pagination: {
        hasMore,
        nextCursor: hasMore
          ? resultReplies[resultReplies.length - 1]?.id ?? null
          : null,
        prevCursor: resultReplies[0]?.id ?? null,
        totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/messages/:id/thread] Error:', error);
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
 * POST /api/messages/:id/thread
 *
 * Reply to a thread.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request with reply data
 * @param context - Route context containing parent message ID
 * @returns Created reply message
 *
 * @example
 * ```
 * POST /api/messages/msg_123/thread
 * Content-Type: application/json
 *
 * {
 *   "content": "This is a thread reply!"
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

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid message ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
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

    // Validate input (reuse sendMessageSchema but ignore parentId)
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

    // Get parent message and check access
    const { message: parentMessage, hasAccess } = await getParentMessageWithAccess(
      params.id,
      session.user.id,
    );

    if (!parentMessage) {
      return NextResponse.json(
        createErrorResponse('Parent message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Check if parent message is deleted
    if (parentMessage.isDeleted) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot reply to a deleted message',
          MESSAGE_ERROR_CODES.MESSAGE_DELETED,
        ),
        { status: 410 },
      );
    }

    // Check if this is already a reply (can't have nested threads)
    if (parentMessage.parentId) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot create nested threads - reply to the original message instead',
          MESSAGE_ERROR_CODES.INVALID_PARENT,
        ),
        { status: 400 },
      );
    }

    // Create the reply
    const reply = await prisma.messages.create({
      data: {
        content: input.content,
        type: input.type,
        metadata: input.metadata as Prisma.InputJsonValue,
        channelId: parentMessage.channelId,
        authorId: session.user.id,
        parentId: params.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        reactions: true,
        attachments: {
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
      { data: reply, message: 'Reply sent successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/messages/:id/thread] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
