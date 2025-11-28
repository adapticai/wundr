/**
 * Conversation Hide API Routes
 *
 * Handles hiding DM conversations for users (hides from sidebar but preserves history).
 *
 * Routes:
 * - POST /api/conversations/:conversationId/hide - Hide a conversation
 *
 * @module app/api/conversations/[conversationId]/hide/route
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
 * POST /api/conversations/:conversationId/hide
 *
 * Hide a conversation from the sidebar for the current user.
 * The conversation is preserved and can be unhidden by messaging again.
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

    // Verify the user is a member of the conversation (channel)
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: conversationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse('Conversation not found or access denied', ORG_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Update the channel member to set leftAt to hide from sidebar.
    // This can be reopened by sending a new message (which would clear leftAt).
    await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: conversationId,
          userId: session.user.id,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation hidden successfully',
    });
  } catch (error) {
    console.error('[POST /api/conversations/:conversationId/hide] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
