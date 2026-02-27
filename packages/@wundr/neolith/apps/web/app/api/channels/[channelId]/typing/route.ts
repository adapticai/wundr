/**
 * Typing Indicator API Routes
 *
 * Handles typing indicator signals for channels.
 * Uses a short TTL approach - typing status expires after a few seconds.
 * Typing state is stored in Redis when available, with an in-memory Map as
 * a fallback for environments where Redis is not configured.
 *
 * Routes:
 * - POST /api/channels/:channelId/typing - Signal typing status
 * - GET  /api/channels/:channelId/typing - Retrieve current typing users
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
 * In-memory fallback store for typing indicators
 */
const memoryTypingStore = new Map<
  string,
  Map<string, { userId: string; userName: string; expiresAt: number }>
>();

/**
 * TTL for typing indicators in seconds (5 seconds)
 */
const TYPING_TTL_S = 5;
const TYPING_TTL_MS = TYPING_TTL_S * 1000;

/**
 * Lazy Redis client initialization
 */
let redisClient: any = null;
let redisAvailable: boolean | null = null;

async function getRedisClient(): Promise<any> {
  if (redisAvailable === false) return null;
  if (redisClient) return redisClient;

  try {
    const ioredisModule = await import('ioredis').catch(() => null);
    if (!ioredisModule || !process.env.REDIS_URL) {
      redisAvailable = false;
      return null;
    }
    const Redis = ioredisModule.default;
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    await redisClient.connect();
    redisAvailable = true;
    return redisClient;
  } catch {
    redisAvailable = false;
    return null;
  }
}

/**
 * Cleanup expired typing indicators (in-memory fallback)
 */
function cleanupExpiredTyping(channelId: string) {
  const channelTyping = memoryTypingStore.get(channelId);
  if (!channelTyping) return;

  const now = Date.now();
  for (const [userId, data] of channelTyping.entries()) {
    if (data.expiresAt <= now) {
      channelTyping.delete(userId);
    }
  }

  if (channelTyping.size === 0) {
    memoryTypingStore.delete(channelId);
  }
}

/**
 * Get current typing users for a channel
 */
async function getTypingUsersAsync(
  channelId: string,
  excludeUserId?: string
): Promise<Array<{ userId: string; userName: string }>> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const key = `typing:${channelId}`;
      const entries = await redis.hgetall(key);
      const users: Array<{ userId: string; userName: string }> = [];
      for (const [userId, value] of Object.entries(entries)) {
        if (userId !== excludeUserId) {
          try {
            const parsed = JSON.parse(value as string);
            users.push({ userId, userName: parsed.userName });
          } catch {
            /* skip malformed entries */
          }
        }
      }
      return users;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  cleanupExpiredTyping(channelId);
  const channelTyping = memoryTypingStore.get(channelId);
  if (!channelTyping) return [];

  const users: Array<{ userId: string; userName: string }> = [];
  for (const [userId, data] of channelTyping.entries()) {
    if (userId !== excludeUserId) {
      users.push({ userId: data.userId, userName: data.userName });
    }
  }
  return users;
}

/**
 * Set typing status for a user in a channel
 */
async function setTypingStatus(
  channelId: string,
  userId: string,
  userName: string
): Promise<void> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const key = `typing:${channelId}`;
      await redis.hset(
        key,
        userId,
        JSON.stringify({ userName, timestamp: Date.now() })
      );
      await redis.expire(key, TYPING_TTL_S + 1); // Slightly longer TTL for the hash itself
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  if (!memoryTypingStore.has(channelId)) {
    memoryTypingStore.set(channelId, new Map());
  }
  memoryTypingStore.get(channelId)!.set(userId, {
    userId,
    userName,
    expiresAt: Date.now() + TYPING_TTL_MS,
  });
}

/**
 * Remove typing status for a user in a channel
 */
async function removeTypingStatus(
  channelId: string,
  userId: string
): Promise<void> {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const key = `typing:${channelId}`;
      await redis.hdel(key, userId);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const channelTyping = memoryTypingStore.get(channelId);
  if (channelTyping) {
    channelTyping.delete(userId);
    if (channelTyping.size === 0) {
      memoryTypingStore.delete(channelId);
    }
  }
}

/**
 * Helper function to check channel membership
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

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: TypingIndicatorInput = parseResult.data;

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    if (input.isTyping) {
      // Add or update typing status
      await setTypingStatus(
        params.channelId,
        session.user.id,
        membership.user.displayName ?? membership.user.name ?? 'Unknown'
      );
    } else {
      // Remove typing status
      await removeTypingStatus(params.channelId, session.user.id);
    }

    // Get current typing users (excluding current user)
    const typingUsers = await getTypingUsersAsync(
      params.channelId,
      session.user.id
    );

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
        MESSAGE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
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

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check channel membership
    const membership = await checkChannelMembership(
      params.channelId,
      session.user.id
    );
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          MESSAGE_ERROR_CODES.NOT_CHANNEL_MEMBER
        ),
        { status: 403 }
      );
    }

    // Get current typing users (excluding current user)
    const typingUsers = await getTypingUsersAsync(
      params.channelId,
      session.user.id
    );

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
        MESSAGE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
