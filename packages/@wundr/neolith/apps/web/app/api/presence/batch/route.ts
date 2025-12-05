/**
 * Batch Presence API Route
 *
 * Get presence status for multiple users at once.
 *
 * Routes:
 * - POST /api/presence/batch - Get presence for multiple users
 *
 * @module app/api/presence/batch/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { PresenceStatusType } from '@/lib/validations/presence';
import type { UserStatus, Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** Maximum number of users to query at once */
const MAX_BATCH_SIZE = 100;

/** Request body schema */
const batchPresenceSchema = z.object({
  userIds: z.array(z.string()).min(1).max(MAX_BATCH_SIZE),
});

/** User preferences with presence fields */
interface UserPreferences {
  presenceStatus?: PresenceStatusType;
  customStatus?: string | null;
  [key: string]: unknown;
}

/** Individual user presence in batch response */
interface BatchUserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  customStatus: string | null;
  lastSeen: string | null;
  updatedAt: string;
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
function getPresenceFromPreferences(
  preferences: Prisma.JsonValue,
): UserPreferences {
  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    return preferences as UserPreferences;
  }
  return {};
}

/**
 * Map Prisma UserStatus to lowercase presence status
 */
function mapUserStatusToPresence(
  status: UserStatus,
  prefs: UserPreferences,
  isOnline: boolean,
): 'online' | 'offline' | 'away' | 'busy' {
  if (!isOnline) {
    return 'offline';
  }

  // Check user preferences first
  if (prefs.presenceStatus) {
    const statusMap: Record<string, 'online' | 'offline' | 'away' | 'busy'> = {
      ONLINE: 'online',
      OFFLINE: 'offline',
      AWAY: 'away',
      BUSY: 'busy',
      DND: 'busy',
      online: 'online',
      offline: 'offline',
      away: 'away',
      busy: 'busy',
    };
    return statusMap[prefs.presenceStatus] || 'online';
  }

  // Default based on account status
  switch (status) {
    case 'ACTIVE':
      return 'online';
    case 'INACTIVE':
    case 'PENDING':
    case 'SUSPENDED':
    default:
      return 'offline';
  }
}

/**
 * Build batch presence response for a user
 */
function buildBatchPresenceResponse(user: {
  id: string;
  status: UserStatus;
  lastActiveAt: Date | null;
  preferences: Prisma.JsonValue;
}): BatchUserPresence {
  const prefs = getPresenceFromPreferences(user.preferences);
  const online = isUserOnline(user.lastActiveAt);
  const presenceStatus = mapUserStatusToPresence(user.status, prefs, online);

  return {
    userId: user.id,
    status: presenceStatus,
    customStatus: prefs.customStatus ?? null,
    lastSeen: user.lastActiveAt?.toISOString() ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * POST /api/presence/batch
 *
 * Get presence status for multiple users at once.
 * Requires authentication.
 *
 * @param request - Next.js request with JSON body containing userIds array
 * @returns Array of user presence data
 *
 * @example
 * ```
 * POST /api/presence/batch
 * {
 *   "userIds": ["user_123", "user_456", "user_789"]
 * }
 *
 * Response:
 * {
 *   "presence": [
 *     {
 *       "userId": "user_123",
 *       "status": "online",
 *       "customStatus": null,
 *       "lastSeen": "2024-01-15T10:30:00Z",
 *       "updatedAt": "2024-01-15T10:35:00Z"
 *     },
 *     ...
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
        createPresenceErrorResponse(
          'Authentication required',
          PRESENCE_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Invalid JSON body',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const parseResult = batchPresenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Invalid request parameters',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const { userIds } = parseResult.data;

    // Fetch all requested users in a single query
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    // Build presence response for each user
    const presence: BatchUserPresence[] = users.map(buildBatchPresenceResponse);

    // For any requested userIds not found, return offline status
    const foundUserIds = new Set(users.map(u => u.id));
    for (const userId of userIds) {
      if (!foundUserIds.has(userId)) {
        presence.push({
          userId,
          status: 'offline',
          customStatus: null,
          lastSeen: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ presence });
  } catch (error) {
    console.error('[POST /api/presence/batch] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
