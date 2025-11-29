/**
 * Individual User Status API Route
 *
 * Get status for a specific user.
 *
 * Routes:
 * - GET /api/users/:userId/status - Get user status
 *
 * @module app/api/users/[userId]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  userIdParamSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { NextRequest } from 'next/server';

/**
 * Route context with userId parameter
 */
interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * GET /api/users/:userId/status
 *
 * Get status for a specific user.
 * Requires authentication.
 *
 * @param request - Next.js request object
 * @param context - Route context with userId parameter
 * @returns User status
 *
 * @example
 * ```
 * GET /api/users/user_123/status
 *
 * Response:
 * {
 *   "data": {
 *     "userId": "user_123",
 *     "status": "ONLINE",
 *     "customStatus": "Working on project",
 *     "lastSeen": "2024-01-15T10:30:00Z",
 *     "isOnline": true
 *   }
 * }
 * ```
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
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate userId parameter
    const params = await context.params;
    const paramResult = userIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid user ID format', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get user with status info
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createPresenceErrorResponse('User not found', PRESENCE_ERROR_CODES.USER_NOT_FOUND),
        { status: 404 },
      );
    }

    // Build response
    const prefs =
      typeof user.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    const isOnline = user.lastActiveAt
      ? Date.now() - user.lastActiveAt.getTime() < 5 * 60 * 1000
      : false;

    return NextResponse.json({
      data: {
        userId: user.id,
        status: prefs.presenceStatus ?? (user.status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE'),
        customStatus: (prefs.customStatus as string | null | undefined) ?? null,
        lastSeen: user.lastActiveAt?.toISOString() ?? new Date(0).toISOString(),
        isOnline,
      },
    });
  } catch (error) {
    console.error('[GET /api/users/:userId/status] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
