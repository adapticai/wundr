/**
 * AI Conversation Detail API Route
 *
 * Handles operations on a single AI conversation.
 *
 * Routes:
 * - GET /api/ai/conversations/[id] - Get conversation details
 * - PATCH /api/ai/conversations/[id] - Update conversation
 * - DELETE /api/ai/conversations/[id] - Delete conversation
 *
 * @module app/api/ai/conversations/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  UpdateAIConversationInput,
  AIConversation,
  AIMessage,
  AIConversationMetadata,
} from '@/types/ai-conversation';
import type { NextRequest } from 'next/server';

/**
 * Route context with conversation ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Transform channel to AI conversation with messages
 */
function transformToAIConversation(
  channel: any,
  userId: string
): AIConversation {
  const settings = (channel.settings as Record<string, unknown>) || {};
  const metadata = (settings.aiMetadata as AIConversationMetadata) || {};

  const messages: AIMessage[] = (channel.messages || []).map((msg: any) => ({
    id: msg.id,
    role: (msg.metadata as any)?.role || 'user',
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    tokens: (msg.metadata as any)?.tokens,
    model: (msg.metadata as any)?.model,
    metadata: msg.metadata as any,
  }));

  return {
    id: channel.id,
    title: metadata.title || 'New Conversation',
    workspaceId: channel.workspaceId,
    createdById: channel.createdById || userId,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    metadata,
    messages,
    isPinned: metadata.isPinned || false,
    isArchived: metadata.isArchived || false,
    hasAccess: true,
  };
}

/**
 * GET /api/ai/conversations/[id]
 *
 * Get a single AI conversation with all messages.
 *
 * @param request - Next.js request object
 * @param params - Route parameters with conversation ID
 * @returns AI conversation with messages
 */
export async function GET(
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { id: conversationId } = await context.params;

    // Fetch conversation channel with messages
    const channel = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { isDeleted: false },
        },
        channelMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if user has access
    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    const conversation = transformToAIConversation(channel, session.user.id);

    return NextResponse.json({
      data: conversation,
    });
  } catch (error) {
    console.error(`[GET /api/ai/conversations/[id]] Error:`, error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai/conversations/[id]
 *
 * Update AI conversation metadata.
 *
 * @param request - Next.js request with update data
 * @param params - Route parameters with conversation ID
 * @returns Updated AI conversation
 *
 * @example
 * ```
 * PATCH /api/ai/conversations/conv_123
 * Content-Type: application/json
 *
 * {
 *   "title": "Updated Title",
 *   "tags": ["updated", "tags"],
 *   "isPinned": true
 * }
 * ```
 */
export async function PATCH(
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { id: conversationId } = await context.params;

    // Parse request body
    let body: UpdateAIConversationInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Fetch existing conversation
    const channel = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check access
    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Update metadata
    const settings = (channel.settings as Record<string, unknown>) || {};
    const metadata = (settings.aiMetadata as AIConversationMetadata) || {};

    const updatedMetadata: AIConversationMetadata = {
      ...metadata,
      ...(body.title && { title: body.title }),
      ...(body.systemPrompt && { systemPrompt: body.systemPrompt }),
      ...(body.tags && { tags: body.tags }),
      ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
      ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
    };

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: conversationId },
      data: {
        settings: {
          ...settings,
          aiMetadata: updatedMetadata as any,
        } as any,
        ...(body.title && { description: `AI Conversation: ${body.title}` }),
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          where: { isDeleted: false },
        },
      },
    });

    const conversation = transformToAIConversation(
      updatedChannel,
      session.user.id
    );

    return NextResponse.json({
      data: conversation,
      message: 'Conversation updated successfully',
    });
  } catch (error) {
    console.error(`[PATCH /api/ai/conversations/[id]] Error:`, error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/conversations/[id]
 *
 * Soft delete an AI conversation.
 *
 * @param request - Next.js request object
 * @param params - Route parameters with conversation ID
 * @returns Success response
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { id: conversationId } = await context.params;

    // Fetch conversation
    const channel = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check access
    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Soft delete by archiving
    const settings = (channel.settings as Record<string, unknown>) || {};
    const metadata = (settings.aiMetadata as AIConversationMetadata) || {};

    await prisma.channel.update({
      where: { id: conversationId },
      data: {
        isArchived: true,
        settings: {
          ...settings,
          aiMetadata: {
            ...metadata,
            isArchived: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    console.error(`[DELETE /api/ai/conversations/[id]] Error:`, error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
