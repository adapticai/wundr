/**
 * Daemon Events API Route
 *
 * Handles event retrieval and acknowledgment for VP daemon services.
 *
 * Routes:
 * - GET /api/daemon/events - Get pending events
 * - DELETE /api/daemon/events - Acknowledge events
 *
 * @module app/api/daemon/events/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

/**
 * Schema for event acknowledgment request body
 */
const eventAckSchema = z.object({
  eventIds: z.array(z.string()).min(1, 'At least one event ID is required'),
});

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for event operations
 */
const EVENT_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  vpId: string;
  daemonId: string;
  scopes: string[];
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Pending event structure
 */
interface PendingEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  channelId?: string;
  messageId?: string;
}

/**
 * Verify daemon token from Authorization header
 */
async function verifyDaemonToken(request: NextRequest): Promise<AccessTokenPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

/**
 * GET /api/daemon/events - Get pending events
 *
 * Retrieves pending events for the VP daemon since a given timestamp.
 * Events include new messages, mentions, reactions, etc.
 *
 * @param request - Next.js request with authentication and since param
 * @returns List of pending events
 *
 * @example
 * ```
 * GET /api/daemon/events?since=2024-01-15T10:00:00Z
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: EVENT_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 5 * 60 * 1000); // Default: last 5 minutes

    // Get VP info
    const vp = await prisma.vps.findUnique({
      where: { id: token.vpId },
      select: {
        userId: true,
        organizationId: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'Unauthorized', code: EVENT_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Get channels the VP is a member of
    const memberships = await prisma.channels_members.findMany({
      where: { userId: vp.userId },
      select: { channelId: true },
    });
    const channelIds = memberships.map((m) => m.channelId);

    const events: PendingEvent[] = [];

    // Fetch new messages in VP's channels (using type assertion for Prisma column mapping)
    type MessageWithAuthorId = { id: string; content: string; createdAt: Date; channelId: string; authorId: string };
    const rawNewMessages = await prisma.messages.findMany({
      where: {
        channelId: { in: channelIds },
        createdAt: { gt: since },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    const newMessagesTyped = rawNewMessages as unknown as MessageWithAuthorId[];

    // Filter out own messages and get author/channel info
    const filteredMessages = newMessagesTyped.filter((m) => m.authorId !== vp.userId);
    const authorIds = Array.from(new Set(filteredMessages.map((m) => m.authorId)));
    const authors = await prisma.users.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, avatarUrl: true, isVP: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const channels = await prisma.channels.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, name: true },
    });
    const channelMap = new Map(channels.map((c) => [c.id, c]));

    // Add message events
    for (const message of filteredMessages) {
      events.push({
        id: `msg_${message.id}`,
        type: 'message_created',
        payload: {
          message: {
            id: message.id,
            content: message.content,
            author: authorMap.get(message.authorId) || { id: message.authorId, name: 'Unknown' },
            channel: channelMap.get(message.channelId) || { id: message.channelId, name: 'Unknown' },
            createdAt: message.createdAt.toISOString(),
          },
        },
        createdAt: message.createdAt.toISOString(),
        channelId: message.channelId,
        messageId: message.id,
      });
    }

    // Check for mentions (messages containing @vpname)
    const rawMentionMessages = await prisma.messages.findMany({
      where: {
        channelId: { in: channelIds },
        createdAt: { gt: since },
        content: { contains: `@${vp.userId}` },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const mentionMessagesTyped = rawMentionMessages as unknown as MessageWithAuthorId[];

    // Fetch additional author info for mentions
    const mentionAuthorIds = Array.from(new Set(mentionMessagesTyped.map((m) => m.authorId))).filter(
      (id) => !authorMap.has(id),
    );
    if (mentionAuthorIds.length > 0) {
      const mentionAuthors = await prisma.users.findMany({
        where: { id: { in: mentionAuthorIds } },
        select: { id: true, name: true, avatarUrl: true, isVP: true },
      });
      mentionAuthors.forEach((a) => authorMap.set(a.id, a));
    }

    // Add mention events (deduplicated from message events)
    const existingEventIds = new Set(events.map((e) => e.messageId));
    for (const message of mentionMessagesTyped) {
      if (!existingEventIds.has(message.id)) {
        events.push({
          id: `mention_${message.id}`,
          type: 'mention',
          payload: {
            message: {
              id: message.id,
              content: message.content,
              author: authorMap.get(message.authorId) || { id: message.authorId, name: 'Unknown' },
              channel: channelMap.get(message.channelId) || { id: message.channelId, name: 'Unknown' },
              createdAt: message.createdAt.toISOString(),
            },
          },
          createdAt: message.createdAt.toISOString(),
          channelId: message.channelId,
          messageId: message.id,
        });
      }
    }

    // Check Redis for any queued events (e.g., from webhooks)
    try {
      const queuedEventsKey = `daemon:events:${token.vpId}`;
      const queuedEvents = await redis.lrange(queuedEventsKey, 0, 99);

      for (const eventStr of queuedEvents) {
        try {
          const event = JSON.parse(eventStr) as PendingEvent;
          if (new Date(event.createdAt) > since) {
            events.push(event);
          }
        } catch {
          // Skip malformed events
        }
      }
    } catch (redisError) {
      console.error('Redis event fetch error:', redisError);
      // Continue with database events only
    }

    // Sort events by creation time
    events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[GET /api/daemon/events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get events', code: EVENT_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/daemon/events - Acknowledge events
 *
 * Marks events as acknowledged/processed by the daemon.
 *
 * @param request - Next.js request with event IDs to acknowledge
 * @returns Success status
 *
 * @example
 * ```
 * DELETE /api/daemon/events
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "eventIds": ["msg_123", "mention_456"]
 * }
 * ```
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: EVENT_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: EVENT_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = eventAckSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Event IDs required', code: EVENT_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    const { eventIds } = parseResult.data;

    // Store acknowledgment in Redis
    try {
      const ackKey = `daemon:ack:${token.vpId}`;
      const pipeline = redis.pipeline();

      for (const eventId of eventIds) {
        pipeline.sadd(ackKey, eventId);
      }

      // Set TTL on the acknowledgment set (24 hours)
      pipeline.expire(ackKey, 24 * 60 * 60);

      await pipeline.exec();

      // Remove acknowledged events from the queue
      const queuedEventsKey = `daemon:events:${token.vpId}`;
      const queuedEvents = await redis.lrange(queuedEventsKey, 0, -1);

      for (const eventStr of queuedEvents) {
        try {
          const event = JSON.parse(eventStr) as PendingEvent;
          if (eventIds.includes(event.id)) {
            await redis.lrem(queuedEventsKey, 1, eventStr);
          }
        } catch {
          // Skip malformed events
        }
      }
    } catch (redisError) {
      console.error('Redis event acknowledgment error:', redisError);
      // Continue - acknowledgment is best effort
    }

    return NextResponse.json({ success: true, acknowledged: eventIds.length });
  } catch (error) {
    console.error('[DELETE /api/daemon/events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge events', code: EVENT_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
