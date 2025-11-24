/**
 * Heartbeat API Route
 *
 * Endpoint for clients to send periodic heartbeats to update presence.
 * Implements rate limiting (10 heartbeats per minute).
 *
 * Routes:
 * - POST /api/presence/heartbeat - Send heartbeat
 *
 * @module app/api/presence/heartbeat/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  heartbeatSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { HeartbeatInput } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';

/**
 * Simple in-memory rate limiter for heartbeats
 * In production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Rate limit: 10 heartbeats per minute */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check if user is rate limited
 *
 * @param userId - The user ID to check
 * @returns True if rate limited, false otherwise
 */
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    // Start new window
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  // Increment count
  entry.count += 1;
  rateLimitStore.set(userId, entry);
  return false;
}

/**
 * Get remaining rate limit info
 *
 * @param userId - The user ID to check
 * @returns Rate limit info
 */
function getRateLimitInfo(userId: string): { remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now > entry.resetAt) {
    return { remaining: RATE_LIMIT_MAX, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  return {
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * POST /api/presence/heartbeat
 *
 * Send a heartbeat to update user's presence.
 * Rate limited to 10 requests per minute.
 * Requires authentication.
 *
 * @param request - Next.js request with optional channel ID
 * @returns Heartbeat acknowledgment
 *
 * @example
 * ```
 * POST /api/presence/heartbeat
 * Content-Type: application/json
 *
 * {
 *   "channelId": "ch_123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "timestamp": "2024-01-15T10:30:00Z",
 *   "rateLimit": {
 *     "remaining": 9,
 *     "resetAt": "2024-01-15T10:31:00Z"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Check rate limit
    if (isRateLimited(session.user.id)) {
      const rateLimitInfo = getRateLimitInfo(session.user.id);
      return NextResponse.json(
        createPresenceErrorResponse(
          'Rate limit exceeded. Maximum 10 heartbeats per minute.',
          PRESENCE_ERROR_CODES.RATE_LIMITED,
          {
            retryAfter: Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000),
          }
        ),
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(rateLimitInfo.resetAt / 1000)),
          },
        }
      );
    }

    // Parse request body (optional)
    let body: HeartbeatInput = {};
    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch {
      // Body is optional, ignore parse errors
    }

    // Validate input
    const parseResult = heartbeatSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Validation failed',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const now = input.timestamp ?? new Date();

    // Update user's last activity
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: now,
        // Also ensure status is active if currently offline
        status: 'ACTIVE',
      },
    });

    // If channel ID provided, could update channel-specific presence tracking
    // This could be used to track which channel the user is actively viewing
    if (input.channelId) {
      // Update channel member's last read timestamp
      await prisma.channelMember.updateMany({
        where: {
          channelId: input.channelId,
          userId: session.user.id,
        },
        data: {
          lastReadAt: now,
        },
      });
    }

    // Get rate limit info for response headers
    const rateLimitInfo = getRateLimitInfo(session.user.id);

    return NextResponse.json(
      {
        success: true,
        timestamp: now.toISOString(),
        rateLimit: {
          remaining: rateLimitInfo.remaining,
          resetAt: new Date(rateLimitInfo.resetAt).toISOString(),
        },
      },
      {
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
          'X-RateLimit-Reset': String(Math.floor(rateLimitInfo.resetAt / 1000)),
        },
      }
    );
  } catch (error) {
    console.error('[POST /api/presence/heartbeat] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
