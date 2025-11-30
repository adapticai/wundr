/**
 * Batch User Presence API Route
 *
 * Get presence status for multiple users at once.
 *
 * Routes:
 * - POST /api/presence/users - Batch get user presence
 *
 * @module app/api/presence/users/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  batchPresenceSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { BatchPresenceInput, UserPresenceResponse, PresenceStatusType } from '@/lib/validations/presence';
import type { UserStatus, Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** User preferences with presence fields */
interface UserPreferences {
  presenceStatus?: PresenceStatusType;
  customStatus?: string | null;
  [key: string]: unknown;
}

/**
 * Check if user is online based on last activity
 */
function isUserOnline(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) {
return false;
}
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
 * POST /api/presence/users
 *
 * Get presence status for multiple users in a single request.
 * Requires authentication. Maximum 100 users per request.
 *
 * @param request - Next.js request with userIds array
 * @returns Array of user presence statuses
 *
 * @example
 * ```
 * POST /api/presence/users
 * Content-Type: application/json
 *
 * {
 *   "userIds": ["user_123", "user_456", "user_789"]
 * }
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "userId": "user_123",
 *       "status": "ONLINE",
 *       "customStatus": null,
 *       "lastSeen": "2024-01-15T10:30:00Z",
 *       "isOnline": true
 *     },
 *     {
 *       "userId": "user_456",
 *       "status": "OFFLINE",
 *       "customStatus": null,
 *       "lastSeen": "2024-01-15T09:00:00Z",
 *       "isOnline": false
 *     }
 *   ]
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
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid JSON body', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = batchPresenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Validation failed',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: BatchPresenceInput = parseResult.data;

    // Get users with presence info
    const users = await prisma.user.findMany({
      where: { id: { in: input.userIds } },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    // Build presence responses
    const presences = users.map(buildPresenceResponse);

    return NextResponse.json({
      data: presences,
    });
  } catch (error) {
    console.error('[POST /api/presence/users] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
