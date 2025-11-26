/**
 * Typing Indicator API Routes
 *
 * Handles typing indicator signals for channels.
 * Uses a short TTL approach - typing status expires after a few seconds.
 *
 * Routes:
 * - POST /api/channels/:channelId/typing - Signal typing status
 *
 * @module app/api/channels/[channelId]/typing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  typingIndicatorSchema,
  channelIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { TypingIndicatorInput } from '@/lib/validations/message';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * In-memory store for typing indicators with TTL
 * In production, this should be replaced with Redis or similar
 */
const typingStore = new Map<
  string,
  Map<string, { userId: string; userName: string; expiresAt: number }>
>();

/**
 * TTL for typing indicators in milliseconds (5 seconds)
 */
const TYPING_TTL_MS = 5000;

/**
 * Cleanup expired typing indicators
 */
function cleanupExpiredTyping(channelId: string) {
  const channelTyping = typingStore.get(channelId);
  if (!channelTyping) {
return;
}

  const now = Date.now();
  for (const [userId, data] of channelTyping.entries()) {
    if (data.expiresAt <= now) {
      channelTyping.delete(userId);
    }
  }

  if (channelTyping.size === 0) {
    typingStore.delete(channelId);
  }
}

/**
 * Get current typing users for a channel
 */
function getTypingUsers(channelId: string, excludeUserId?: string) {
  cleanupExpiredTyping(channelId);
  const channelTyping = typingStore.get(channelId);
  if (!channelTyping) {
return [];
}

  const users: Array<{ userId: string; userName: string }> = [];
  for (const [userId, data] of channelTyping.entries()) {
    if (userId !== excludeUserId) {
      users.push({ userId: data.userId, userName: data.userName });
    }
  }
  return users;
}

/**
 * Helper function to check channel membership
 */
async function checkChannelMembership(channelId: string, userId: string) {
  const membership = await prisma.channel_members.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },
    },
  });

  return membership;
}

/**
 * POST /api/channels/:channelId/typing
 *
 * Signal that the current user is typing in a channel.
 * The typing status automatically expires after a short TTL.
 * Clients should call this endpoint periodically while the user is typing.
 *
 * @param request - Next.js request with optional isTyping flag
 * @param context - Route context containing channel ID
 * @returns Current typing users in the channel
 *
 * @example
 * ```
 * POST /api/channels/ch_123/typing
 * Content-Type: application/json
 *
 * {
 *   "isTyping": true
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

    // Parse request body (optional)
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is fine, use defaults
    }

    // Validate input
    const parseResult = typingIndicatorSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid request body',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: TypingIndicatorInput = parseResult.data;

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

    // Initialize channel typing store if needed
    if (!typingStore.has(params.channelId)) {
      typingStore.set(params.channelId, new Map());
    }

    const channelTyping = typingStore.get(params.channelId)!;

    if (input.isTyping) {
      // Add or update typing status
      channelTyping.set(session.user.id, {
        userId: session.user.id,
        userName: membership.user.displayName ?? membership.user.name ?? 'Unknown',
        expiresAt: Date.now() + TYPING_TTL_MS,
      });
    } else {
      // Remove typing status
      channelTyping.delete(session.user.id);
    }

    // Get current typing users (excluding current user)
    const typingUsers = getTypingUsers(params.channelId, session.user.id);

    return NextResponse.json({
      data: {
        channelId: params.channelId,
        typingUsers,
        isTyping: input.isTyping,
      },
    });
  } catch (error) {
    console.error('[POST /api/channels/:channelId/typing] Error:', error);
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
 * GET /api/channels/:channelId/typing
 *
 * Get current typing users in a channel.
 * Useful for polling or initial state fetch.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns List of currently typing users
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

    // Get current typing users (excluding current user)
    const typingUsers = getTypingUsers(params.channelId, session.user.id);

    return NextResponse.json({
      data: {
        channelId: params.channelId,
        typingUsers,
      },
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/typing] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
