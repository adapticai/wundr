/**
 * Presence API Routes
 *
 * Handles getting and setting current user's presence status.
 *
 * Routes:
 * - GET /api/presence - Get own presence status
 * - PUT /api/presence - Set own presence status
 *
 * @module app/api/presence/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  setStatusSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type {
  SetStatusInput,
  UserPresenceResponse,
  PresenceStatusType,
} from '@/lib/validations/presence';
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
 * Map Prisma UserStatus to presence status
 */
function mapUserStatusToPresence(
  status: UserStatus,
  prefs: UserPreferences,
): UserPresenceResponse['status'] {
  // Check for explicit presence status in preferences
  if (prefs.presenceStatus) {
    return prefs.presenceStatus;
  }

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
    status: online ? mapUserStatusToPresence(user.status, prefs) : 'offline',
    customStatus: prefs.customStatus ?? undefined,
    lastSeen: user.lastActiveAt?.toISOString() ?? new Date(0).toISOString(),
    isOnline: online,
  };
}

/**
 * GET /api/presence
 *
 * Get the current user's presence status.
 * Requires authentication.
 *
 * @returns Current user's presence status
 *
 * @example
 * ```
 * GET /api/presence
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
export async function GET(_request: NextRequest): Promise<NextResponse> {
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

    // Get user with presence info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'User not found',
          PRESENCE_ERROR_CODES.USER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: buildPresenceResponse(user),
    });
  } catch (error) {
    console.error('[GET /api/presence] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/presence
 *
 * Set the current user's presence status.
 * Requires authentication.
 *
 * @param request - Next.js request with status data
 * @returns Updated presence status
 *
 * @example
 * ```
 * PUT /api/presence
 * Content-Type: application/json
 *
 * {
 *   "status": "BUSY",
 *   "customStatus": "In a meeting"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "userId": "user_123",
 *     "status": "BUSY",
 *     "customStatus": "In a meeting",
 *     "lastSeen": "2024-01-15T10:30:00Z",
 *     "isOnline": true
 *   },
 *   "message": "Status updated successfully"
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
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

    // Parse request body
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

    // Validate input
    const parseResult = setStatusSchema.safeParse(body);
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

    const input: SetStatusInput = parseResult.data;

    // Get current preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs = getPresenceFromPreferences(
      currentUser?.preferences ?? {},
    );

    // Update user status and preferences
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        status: input.status === 'offline' ? 'INACTIVE' : 'ACTIVE',
        lastActiveAt: new Date(),
        preferences: {
          ...currentPrefs,
          presenceStatus: input.status,
          customStatus: input.customStatus ?? undefined,
        },
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      data: buildPresenceResponse(user),
      message: 'Status updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/presence] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
