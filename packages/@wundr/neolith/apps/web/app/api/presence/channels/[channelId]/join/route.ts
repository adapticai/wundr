/**
 * Channel Presence Join API Route
 *
 * Join a channel's presence tracking.
 *
 * Routes:
 * - POST /api/presence/channels/:channelId/join - Join channel presence
 *
 * @module app/api/presence/channels/[channelId]/join/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type {
  UserPresenceResponse,
  ChannelPresenceResponse,
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
 * Route context with channelId parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
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
  preferences: Prisma.JsonValue
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
  prefs: UserPreferences
): UserPresenceResponse['status'] {
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
 * POST /api/presence/channels/:channelId/join
 *
 * Join a channel's presence tracking. Updates user's last activity
 * and returns current channel presence.
 * Requires authentication and channel membership.
 *
 * @param request - Next.js request object
 * @param context - Route context with channelId parameter
 * @returns Updated channel presence
 *
 * @example
 * ```
 * POST /api/presence/channels/ch_123/join
 *
 * Response:
 * {
 *   "data": {
 *     "channelId": "ch_123",
 *     "totalOnline": 6,
 *     "onlineUsers": [...]
 *   },
 *   "message": "Joined channel presence"
 * }
 * ```
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Authentication required',
          PRESENCE_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate channelId parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Invalid channel ID format',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check if user is a member of the channel
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Must be a channel member to join presence',
          PRESENCE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Update user's last activity
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveAt: new Date() },
    });

    // Get channel with members
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                status: true,
                lastActiveAt: true,
                preferences: true,
              },
            },
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Channel not found',
          PRESENCE_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Build presence responses for online users
    const onlineUsers = channel.channelMembers
      .map(m => buildPresenceResponse(m.user))
      .filter(p => p.isOnline);

    const response: ChannelPresenceResponse = {
      channelId: params.channelId,
      presence: onlineUsers,
      totalOnline: onlineUsers.length,
    };

    return NextResponse.json({
      data: response,
      message: 'Joined channel presence',
    });
  } catch (error) {
    console.error(
      '[POST /api/presence/channels/:channelId/join] Error:',
      error
    );
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
