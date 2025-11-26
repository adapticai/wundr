/**
 * Single Message API Routes
 *
 * Handles operations on individual message entities.
 *
 * Routes:
 * - GET /api/messages/:id - Get message details with thread replies
 * - PATCH /api/messages/:id - Update message content (author only)
 * - DELETE /api/messages/:id - Delete message (author or admin)
 *
 * Features:
 * - Edit history tracking in message metadata
 * - Channel membership access control
 * - Soft delete with content replacement
 * - Thread reply count
 *
 * @module app/api/messages/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateMessageSchema,
  messageIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { UpdateMessageInput } from '@/lib/validations/message';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with message ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Helper function to get message with access check
 * Returns the message if the user has access via channel membership
 */
async function getMessageWithAccessCheck(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
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
      channel: {
        include: {
          members: {
            where: { userId },
            select: { userId: true, role: true },
          },
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
      _count: {
        select: {
          replies: true,
        },
      },
    },
  });

  if (!message) {
    return null;
  }

  // Check if user is a member of the channel
  const isMember = message.channel.members.length > 0;
  if (!isMember) {
    return null;
  }

  // Remove channel.members from response
  const { channel, ...rest } = message;
  const { members: _members, ...channelData } = channel;

  return {
    ...rest,
    channel: channelData,
    isOwner: message.authorId === userId,
    memberRole: message.channel.members[0]?.role ?? null,
  };
}

/**
 * GET /api/messages/:id
 *
 * Get details for a specific message.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context containing message ID
 * @returns Message details
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

    // Validate message ID parameter
    const params = await context.params;
    const paramResult = messageIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid message ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get message with access check
    const result = await getMessageWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Message not found or access denied', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if message is deleted
    if (result.isDeleted) {
      return NextResponse.json(
        createErrorResponse('This message has been deleted', MESSAGE_ERROR_CODES.MESSAGE_DELETED),
        { status: 410 },
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[GET /api/messages/:id] Error:', error);
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
 * PATCH /api/messages/:id
 *
 * Update an existing message.
 * Only the message author can edit their message.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing message ID
 * @returns Updated message object
 */
export async function PATCH(
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

    // Validate input
    const parseResult = updateMessageSchema.safeParse(body);
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

    const input: UpdateMessageInput = parseResult.data;

    // Get message with access check
    const result = await getMessageWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Message not found or access denied', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if message is deleted
    if (result.isDeleted) {
      return NextResponse.json(
        createErrorResponse('Cannot edit a deleted message', MESSAGE_ERROR_CODES.MESSAGE_DELETED),
        { status: 410 },
      );
    }

    // Only the message author can edit
    if (!result.isOwner) {
      return NextResponse.json(
        createErrorResponse(
          'You can only edit your own messages',
          MESSAGE_ERROR_CODES.CANNOT_EDIT,
        ),
        { status: 403 },
      );
    }

    // Track edit history in metadata
    const currentMetadata = result.metadata as Record<string, unknown> || {};
    const editHistory = (currentMetadata.editHistory as Array<{
      content: string;
      editedAt: string;
      editedBy: string;
    }>) || [];

    // Add current content to edit history
    editHistory.push({
      content: result.content,
      editedAt: new Date().toISOString(),
      editedBy: session.user.id,
    });

    // Merge metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...(input.metadata || {}),
      editHistory,
    };

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: params.id },
      data: {
        content: input.content,
        isEdited: true,
        editedAt: new Date(),
        metadata: updatedMetadata as Prisma.InputJsonValue,
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

    return NextResponse.json({
      data: updatedMessage,
      message: 'Message updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/messages/:id] Error:', error);
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
 * DELETE /api/messages/:id
 *
 * Soft delete a message.
 * Only the message author or channel admins can delete messages.
 *
 * @param request - Next.js request object
 * @param context - Route context containing message ID
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

    // Get message with access check
    const result = await getMessageWithAccessCheck(params.id, session.user.id);

    if (!result) {
      return NextResponse.json(
        createErrorResponse('Message not found or access denied', MESSAGE_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if message is already deleted
    if (result.isDeleted) {
      return NextResponse.json(
        createErrorResponse('Message is already deleted', MESSAGE_ERROR_CODES.MESSAGE_DELETED),
        { status: 410 },
      );
    }

    // Only the message author or channel admins/owners can delete
    const canDelete = result.isOwner ||
      result.memberRole === 'OWNER' ||
      result.memberRole === 'ADMIN';

    if (!canDelete) {
      return NextResponse.json(
        createErrorResponse(
          'You do not have permission to delete this message',
          MESSAGE_ERROR_CODES.CANNOT_DELETE,
        ),
        { status: 403 },
      );
    }

    // Soft delete the message
    await prisma.message.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        content: '[Message deleted]',
      },
    });

    return NextResponse.json({
      message: 'Message deleted successfully',
      deletedId: params.id,
    });
  } catch (error) {
    console.error('[DELETE /api/messages/:id] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
