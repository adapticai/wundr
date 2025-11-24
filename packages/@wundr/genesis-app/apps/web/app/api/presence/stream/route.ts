/**
 * Presence Stream API Route (Server-Sent Events)
 *
 * SSE endpoint for real-time presence updates.
 * Clients can subscribe to user and channel presence changes.
 *
 * Routes:
 * - GET /api/presence/stream?channelIds=&userIds= - SSE stream for presence updates
 *
 * Events:
 * - presence:update - User presence changed
 * - presence:join - User joined channel presence
 * - presence:leave - User left channel presence
 * - heartbeat - Keep-alive ping
 *
 * @module app/api/presence/stream/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  streamQuerySchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { UserPresenceResponse, PresenceStatusType } from '@/lib/validations/presence';
import type { NextRequest } from 'next/server';
import type { UserStatus, Prisma } from '@prisma/client';

/** Time in ms after which a user is considered offline (5 minutes) */
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/** Heartbeat interval for SSE keep-alive (30 seconds) */
const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Poll interval for presence changes (5 seconds) */
const POLL_INTERVAL_MS = 5 * 1000;

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
 * Format SSE message
 *
 * @param event - Event name
 * @param data - Event data
 * @returns Formatted SSE message string
 */
function formatSSEMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * GET /api/presence/stream
 *
 * Server-Sent Events endpoint for real-time presence updates.
 * Requires authentication.
 *
 * Query Parameters:
 * - channelIds: Comma-separated channel IDs to subscribe to (max 10)
 * - userIds: Comma-separated user IDs to subscribe to (max 100)
 *
 * @param request - Next.js request with query parameters
 * @returns SSE stream
 *
 * @example
 * ```
 * GET /api/presence/stream?channelIds=ch_123,ch_456&userIds=user_789
 *
 * Events:
 * event: presence:update
 * data: {"userId":"user_123","status":"ONLINE","isOnline":true,...}
 *
 * event: presence:join
 * data: {"channelId":"ch_123","userId":"user_456"}
 *
 * event: heartbeat
 * data: {"timestamp":"2024-01-15T10:30:00Z"}
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = streamQuerySchema.safeParse(searchParams);

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

    const { channelIds = [], userIds = [] } = parseResult.data;

    // Verify user has access to requested channels
    if (channelIds.length > 0) {
      const channelMemberships = await prisma.channelMember.findMany({
        where: {
          channelId: { in: channelIds },
          userId: session.user.id,
        },
        select: { channelId: true },
      });

      const accessibleChannelIds = new Set(channelMemberships.map((m) => m.channelId));
      const unauthorizedChannels = channelIds.filter((id) => !accessibleChannelIds.has(id));

      if (unauthorizedChannels.length > 0) {
        return NextResponse.json(
          createPresenceErrorResponse(
            'Access denied to some channels',
            PRESENCE_ERROR_CODES.FORBIDDEN,
            { unauthorizedChannels }
          ),
          { status: 403 }
        );
      }
    }

    // Track previous presence states for change detection
    const previousPresence = new Map<string, UserPresenceResponse>();

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection confirmation
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            formatSSEMessage('connected', {
              timestamp: new Date().toISOString(),
              subscribedChannels: channelIds,
              subscribedUsers: userIds,
            })
          )
        );

        // Send initial presence state
        if (userIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              status: true,
              lastActiveAt: true,
              preferences: true,
            },
          });

          for (const user of users) {
            const presence = buildPresenceResponse(user);
            previousPresence.set(user.id, presence);
            controller.enqueue(
              encoder.encode(formatSSEMessage('presence:update', presence))
            );
          }
        }

        // Send channel presence for subscribed channels
        if (channelIds.length > 0) {
          const channels = await prisma.channel.findMany({
            where: { id: { in: channelIds } },
            include: {
              members: {
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

          for (const channel of channels) {
            const onlineUsers = channel.members
              .map((m) => buildPresenceResponse(m.user))
              .filter((p) => p.isOnline);

            controller.enqueue(
              encoder.encode(
                formatSSEMessage('channel:presence', {
                  channelId: channel.id,
                  totalOnline: onlineUsers.length,
                  onlineUsers,
                })
              )
            );

            // Store member presence for change detection
            for (const member of channel.members) {
              if (!previousPresence.has(member.user.id)) {
                previousPresence.set(member.user.id, buildPresenceResponse(member.user));
              }
            }
          }
        }

        // Set up polling interval for presence changes
        const pollInterval = setInterval(async () => {
          try {
            // Get all tracked user IDs
            const trackedUserIds = Array.from(previousPresence.keys());
            if (trackedUserIds.length === 0) return;

            // Fetch current presence
            const users = await prisma.user.findMany({
              where: { id: { in: trackedUserIds } },
              select: {
                id: true,
                status: true,
                lastActiveAt: true,
                preferences: true,
              },
            });

            // Detect and emit changes
            for (const user of users) {
              const currentPresence = buildPresenceResponse(user);
              const prevPresence = previousPresence.get(user.id);

              // Check for changes
              if (
                prevPresence &&
                (prevPresence.status !== currentPresence.status ||
                  prevPresence.isOnline !== currentPresence.isOnline ||
                  prevPresence.customStatus !== currentPresence.customStatus)
              ) {
                controller.enqueue(
                  encoder.encode(formatSSEMessage('presence:update', currentPresence))
                );
                previousPresence.set(user.id, currentPresence);
              }
            }
          } catch {
            // Ignore polling errors, connection will be cleaned up on close
          }
        }, POLL_INTERVAL_MS);

        // Set up heartbeat interval for keep-alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(
                formatSSEMessage('heartbeat', {
                  timestamp: new Date().toISOString(),
                })
              )
            );
          } catch {
            // Connection closed, intervals will be cleaned up
          }
        }, HEARTBEAT_INTERVAL_MS);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[GET /api/presence/stream] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
