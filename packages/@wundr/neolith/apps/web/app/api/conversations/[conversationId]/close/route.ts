/**
 * Conversation Close API Routes
 *
 * Handles closing DM conversations (removes from sidebar entirely).
 *
 * Routes:
 * - POST /api/conversations/:conversationId/close - Close a conversation
 *
 * @module app/api/conversations/[conversationId]/close/route
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
 * Route context with conversation ID parameter
 */
interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/conversations/:conversationId/close
 *
 * Close a conversation for the current user. This removes the user from
 * the conversation but preserves the message history for other participants.
 *
 * @param request - Next.js request object
 * @param context - Route context containing conversation ID
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
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { conversationId } = params;

    // Verify the conversation exists and user is a member
    const channel = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Conversation not found', ORG_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if user is a member
    const isMember = channel.channelMembers.some(m => m.userId === session.user.id);
    if (!isMember) {
      return NextResponse.json(
        createErrorResponse('You are not a member of this conversation', ORG_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // For DMs, instead of deleting membership (which could cause issues),
    // we mark as closed by setting leftAt. This hides it from the sidebar while preserving history.
    // The conversation can be reopened by sending a new message (which would clear leftAt).
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: conversationId,
          userId: session.user.id,
        },
      },
      data: {
        leftAt: new Date(),
        // Reset unread count when closing
        lastReadAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation closed successfully',
    });
  } catch (error) {
    console.error('[POST /api/conversations/:conversationId/close] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
