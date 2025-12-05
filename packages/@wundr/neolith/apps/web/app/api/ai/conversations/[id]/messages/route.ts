/**
 * AI Conversation Messages API Route
 *
 * Handles adding messages to AI conversations.
 *
 * Routes:
 * - POST /api/ai/conversations/[id]/messages - Add a new message
 * - GET /api/ai/conversations/[id]/messages - Get conversation messages
 *
 * @module app/api/ai/conversations/[id]/messages/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  AddAIMessageInput,
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
 * Transform database message to AI message
 */
function transformToAIMessage(msg: any): AIMessage {
  return {
    id: msg.id,
    role: (msg.metadata as any)?.role || 'user',
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
    tokens: (msg.metadata as any)?.tokens,
    model: (msg.metadata as any)?.model,
    metadata: msg.metadata as any,
  };
}

/**
 * GET /api/ai/conversations/[id]/messages
 *
 * Get all messages in a conversation.
 *
 * @param request - Next.js request object
 * @param params - Route parameters with conversation ID
 * @returns List of messages
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

    // Check access
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

    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: {
        channelId: conversationId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    const aiMessages = messages.map(transformToAIMessage);

    return NextResponse.json({
      data: aiMessages,
    });
  } catch (error) {
    console.error(`[GET /api/ai/conversations/[id]/messages] Error:`, error);
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
 * POST /api/ai/conversations/[id]/messages
 *
 * Add a new message to the conversation.
 *
 * @param request - Next.js request with message data
 * @param params - Route parameters with conversation ID
 * @returns Created message
 *
 * @example
 * ```
 * POST /api/ai/conversations/conv_123/messages
 * Content-Type: application/json
 *
 * {
 *   "role": "user",
 *   "content": "What is TypeScript?",
 *   "model": "gpt-4o-mini"
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { id: conversationId } = await context.params;

    // Parse request body
    let body: Partial<AddAIMessageInput>;
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

    const { role, content, model, tokens, metadata } = body;

    // Validate required fields
    if (!role || !content) {
      return NextResponse.json(
        createErrorResponse(
          'role and content are required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
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

    if (channel.channelMembers.length === 0) {
      return NextResponse.json(
        createErrorResponse('Access denied', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Create message and update conversation metadata in a transaction
    const result = await prisma.$transaction(async tx => {
      // Create the message
      const message = await tx.message.create({
        data: {
          channelId: conversationId,
          authorId: session.user.id,
          content,
          type: role === 'system' ? 'SYSTEM' : 'TEXT',
          metadata: {
            role,
            model,
            tokens,
            ...metadata,
          },
        },
      });

      // Update conversation metadata
      const settings = (channel.settings as Record<string, unknown>) || {};
      const aiMetadata = (settings.aiMetadata as AIConversationMetadata) || {};

      const updatedMetadata: AIConversationMetadata = {
        ...aiMetadata,
        messageCount: (aiMetadata.messageCount || 0) + 1,
        lastMessagePreview: content.substring(0, 100),
        tokenUsage: {
          input: (aiMetadata.tokenUsage?.input || 0) + (tokens?.input || 0),
          output: (aiMetadata.tokenUsage?.output || 0) + (tokens?.output || 0),
          total:
            (aiMetadata.tokenUsage?.total || 0) +
            (tokens?.input || 0) +
            (tokens?.output || 0),
        },
      };

      await tx.channel.update({
        where: { id: conversationId },
        data: {
          settings: {
            ...settings,
            aiMetadata: updatedMetadata as any,
          } as any,
        },
      });

      return message;
    });

    const aiMessage = transformToAIMessage(result);

    return NextResponse.json(
      {
        data: aiMessage,
        message: 'Message added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[POST /api/ai/conversations/[id]/messages] Error:`, error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
