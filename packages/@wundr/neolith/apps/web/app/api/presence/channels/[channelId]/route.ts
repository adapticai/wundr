/**
 * Channel Presence API Route
 *
 * Get presence status for users in a specific channel.
 *
 * Routes:
 * - GET /api/presence/channels/:channelId - Get channel presence
 *
 * @module app/api/presence/channels/[channelId]/route
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
 * GET /api/presence/channels/:channelId
 *
 * Get presence status for all members in a channel.
 * Requires authentication and channel membership for private channels.
 *
 * @param request - Next.js request object
 * @param context - Route context with channelId parameter
 * @returns Channel presence with online users
 *
 * @example
 * ```
 * GET /api/presence/channels/ch_123
 *
 * Response:
 * {
 *   "data": {
 *     "channelId": "ch_123",
 *     "totalOnline": 5,
 *     "onlineUsers": [
 *       {
 *         "userId": "user_123",
 *         "status": "ONLINE",
 *         "customStatus": null,
 *         "lastSeen": "2024-01-15T10:30:00Z",
 *         "isOnline": true
 *       }
 *     ]
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

    // Check if user is a member of the channel
    const isMember = channel.channelMembers.some(
      m => m.userId === session.user.id
    );

    // For private channels, only members can see presence
    if (channel.type === 'PRIVATE' && !isMember) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Access denied to this channel',
          PRESENCE_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
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
    });
  } catch (error) {
    console.error('[GET /api/presence/channels/:channelId] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
