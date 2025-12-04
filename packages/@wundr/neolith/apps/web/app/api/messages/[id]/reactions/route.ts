/**
 * Message Reactions API Routes
 *
 * Handles reaction operations for messages.
 *
 * Routes:
 * - GET /api/messages/:id/reactions - Get all reactions
 * - POST /api/messages/:id/reactions - Add a reaction
 * - DELETE /api/messages/:id/reactions - Remove a reaction (with emoji query param)
 *
 * @module app/api/messages/[id]/reactions/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  addReactionSchema,
  messageIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { AddReactionInput } from '@/lib/validations/message';
import type { NextRequest } from 'next/server';

/**
 * Route context with message ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to check message access
 */
async function checkMessageAccess(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      channel: {
        include: {
          channelMembers: {
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

  const hasAccess = message.channel.channelMembers.length > 0;
  return { message, hasAccess };
}

/**
 * GET /api/messages/:id/reactions
 *
 * Get all reactions for a message, grouped by emoji.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing message ID
 * @returns Reactions grouped by emoji with user details
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
          MESSAGE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid message ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check message access
    const { message, hasAccess } = await checkMessageAccess(
      params.id,
      session.user.id
    );

    if (!message) {
      return NextResponse.json(
        createErrorResponse('Message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    // Get all reactions for the message
    const reactions = await prisma.reaction.findMany({
      where: { messageId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group reactions by emoji
    const groupedReactions = reactions.reduce(
      (acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = {
            emoji: reaction.emoji,
            count: 0,
            users: [],
            hasReacted: false,
          };
        }
        acc[reaction.emoji].count++;
        acc[reaction.emoji].users.push(reaction.user);
        if (reaction.userId === session.user.id) {
          acc[reaction.emoji].hasReacted = true;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          emoji: string;
          count: number;
          users: Array<{
            id: string;
            name: string | null;
            displayName: string | null;
            avatarUrl: string | null;
          }>;
          hasReacted: boolean;
        }
      >
    );

    return NextResponse.json({
      data: Object.values(groupedReactions),
    });
  } catch (error) {
    console.error('[GET /api/messages/:id/reactions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/:id/reactions
 *
 * Add a reaction to a message.
 * Requires authentication and channel membership.
 * Users can only have one reaction per emoji per message.
 *
 * @param request - Next.js request with reaction data
 * @param context - Route context containing message ID
 * @returns Created reaction
 *
 * @example
 * ```
 * POST /api/messages/msg_123/reactions
 * Content-Type: application/json
 *
 * {
 *   "emoji": "thumbsup"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid message ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = addReactionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: AddReactionInput = parseResult.data;

    // Check message access
    const { message, hasAccess } = await checkMessageAccess(
      params.id,
      session.user.id
    );

    if (!message) {
      return NextResponse.json(
        createErrorResponse('Message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot react to a deleted message',
          MESSAGE_ERROR_CODES.MESSAGE_DELETED
        ),
        { status: 410 }
      );
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: params.id,
          userId: session.user.id,
          emoji: input.emoji,
        },
      },
    });

    if (existingReaction) {
      return NextResponse.json(
        createErrorResponse(
          'You have already reacted with this emoji',
          MESSAGE_ERROR_CODES.ALREADY_REACTED
        ),
        { status: 409 }
      );
    }

    // Create the reaction
    const reaction = await prisma.reaction.create({
      data: {
        emoji: input.emoji,
        messageId: params.id,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      { data: reaction, message: 'Reaction added successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/messages/:id/reactions] Error:', error);

    // Handle unique constraint violation
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'You have already reacted with this emoji',
          MESSAGE_ERROR_CODES.ALREADY_REACTED
        ),
        { status: 409 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/messages/:id/reactions
 *
 * Remove a reaction from a message.
 * Requires the emoji to be passed as a query parameter.
 * Users can only remove their own reactions.
 *
 * @param request - Next.js request with emoji query param
 * @param context - Route context containing message ID
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/messages/msg_123/reactions?emoji=thumbsup
 * ```
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          MESSAGE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid message ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get emoji from query params
    const emoji = request.nextUrl.searchParams.get('emoji');
    if (!emoji) {
      return NextResponse.json(
        createErrorResponse(
          'Emoji query parameter is required',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check message access
    const { message, hasAccess } = await checkMessageAccess(
      params.id,
      session.user.id
    );

    if (!message) {
      return NextResponse.json(
        createErrorResponse('Message not found', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    // Find and delete the reaction
    const reaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: params.id,
          userId: session.user.id,
          emoji: emoji,
        },
      },
    });

    if (!reaction) {
      return NextResponse.json(
        createErrorResponse(
          'Reaction not found',
          MESSAGE_ERROR_CODES.REACTION_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Delete the reaction
    await prisma.reaction.delete({
      where: { id: reaction.id },
    });

    return NextResponse.json({
      message: 'Reaction removed successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/messages/:id/reactions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
