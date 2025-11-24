/**
 * User Presence API Route
 *
 * Get presence status for a specific user.
 *
 * Routes:
 * - GET /api/presence/users/:userId - Get user presence
 *
 * @module app/api/presence/users/[userId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  userIdParamSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { UserPresenceResponse, PresenceStatusType } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';
import type { UserStatus, Prisma } from '@prisma/client';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** User preferences with presence fields */
interface UserPreferences {
  presenceStatus?: PresenceStatusType;
  customStatus?: string | null;
  [key: string]: unknown;
}

/**
 * Route context with userId parameter
 */
interface RouteContext {
  params: Promise<{ userId: string }>;
}

/**
 * Check if user is online based on last activity
 */
function isUserOnline(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() < OFFLINE_THRESHOLD_MS;
}

/**
 * Get presence from user preferences
 */
function getPresenceFromPreferences(preferences: Prisma.JsonValue): UserPreferences {
  if (typeof preferences === 'object' && preferences !== null && !Array.isArray(preferences)) {
    return preferences as UserPreferences;
  }
  return {};
}

/**
 * Map Prisma UserStatus to presence status
 */
function mapUserStatusToPresence(status: UserStatus, prefs: UserPreferences): UserPresenceResponse['status'] {
  if (prefs.presenceStatus) {
    return prefs.presenceStatus;
  }

  switch (status) {
    case 'ACTIVE':
      return 'ONLINE';
    case 'INACTIVE':
    case 'PENDING':
    case 'SUSPENDED':
    default:
      return 'OFFLINE';
  }
}

/**
 * Build user presence response
 */
function buildPresenceResponse(user: {
  id: string;
  status: UserStatus;
  lastActiveAt: Date | null;
  preferences: Prisma.JsonValue;
}): UserPresenceResponse {
  const prefs = getPresenceFromPreferences(user.preferences);
  const online = isUserOnline(user.lastActiveAt);
  return {
    userId: user.id,
    status: online ? mapUserStatusToPresence(user.status, prefs) : 'OFFLINE',
    customStatus: prefs.customStatus ?? null,
    lastSeen: user.lastActiveAt?.toISOString() ?? new Date(0).toISOString(),
    isOnline: online,
  };
}

/**
 * GET /api/presence/users/:userId
 *
 * Get presence status for a specific user.
 * Requires authentication.
 *
 * @param request - Next.js request object
 * @param context - Route context with userId parameter
 * @returns User presence status
 *
 * @example
 * ```
 * GET /api/presence/users/user_123
 *
 * Response:
 * {
 *   "data": {
 *     "userId": "user_123",
 *     "status": "ONLINE",
 *     "customStatus": null,
 *     "lastSeen": "2024-01-15T10:30:00Z",
 *     "isOnline": true
 *   }
 * }
 * ```
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
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Validate userId parameter
    const params = await context.params;
    const paramResult = userIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid user ID format', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Get user with presence info
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
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: buildPresenceResponse(user),
    });
  } catch (error) {
    console.error('[GET /api/presence/users/:userId] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
