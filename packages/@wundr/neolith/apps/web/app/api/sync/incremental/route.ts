/**
 * Incremental Sync API Route
 *
 * Handles incremental sync with sync token for efficient data synchronization.
 *
 * Routes:
 * - POST /api/sync/incremental - Perform incremental sync using sync token
 *
 * @module app/api/sync/incremental/route
 */

import { randomUUID } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  incrementalSyncSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { IncrementalSyncInput, SyncEntity, SyncResponse } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * Generate a sync token encoding the sync timestamp
 */
function generateSyncToken(timestamp: Date): string {
  const data = {
    ts: timestamp.toISOString(),
    id: randomUUID().slice(0, 8),
  };
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Parse a sync token to get the timestamp
 */
function parseSyncToken(token: string): Date | null {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64url').toString());
    return new Date(data.ts);
  } catch {
    return null;
  }
}

/**
 * Default entities for incremental sync
 */
const DEFAULT_ENTITIES: SyncEntity[] = ['messages', 'channels', 'notifications'];

/**
 * Maximum items per entity for incremental sync
 */
const INCREMENTAL_LIMIT = 50;

/**
 * POST /api/sync/incremental
 *
 * Perform an incremental sync using a sync token from a previous sync.
 * Returns only changes since the last sync, making it efficient for
 * frequent synchronization.
 * Requires authentication.
 *
 * @param request - Next.js request with sync token
 * @returns Sync response with changes since last sync
 *
 * @example
 * ```
 * POST /api/sync/incremental
 * Content-Type: application/json
 *
 * {
 *   "syncToken": "eyJhbGciOiJIUzI1NiJ9...",
 *   "entities": ["messages", "notifications"]
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "syncToken": "eyJhbGciOiJIUzI1NiJ9...",
 *     "changes": [
 *       {
 *         "entity": "messages",
 *         "created": [...],
 *         "updated": [...],
 *         "deleted": []
 *       }
 *     ],
 *     "hasMore": false,
 *     "syncedAt": "2024-01-15T10:30:00Z"
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
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createNotificationErrorResponse('Invalid JSON body', NOTIFICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = incrementalSyncSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Validation failed',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: IncrementalSyncInput = parseResult.data;

    // Parse sync token
    const lastSyncAt = parseSyncToken(input.syncToken);
    if (!lastSyncAt) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid sync token',
          NOTIFICATION_ERROR_CODES.SYNC_ERROR,
        ),
        { status: 400 },
      );
    }

    const entities = input.entities ?? DEFAULT_ENTITIES;
    const syncedAt = new Date();

    // Date filter for changes since last sync
    const dateFilter = { updatedAt: { gt: lastSyncAt } };

    // Fetch changes for each entity
    const changes: SyncResponse['changes'] = [];

    for (const entity of entities) {
      switch (entity) {
        case 'messages': {
          const messages = await prisma.message.findMany({
            where: {
              ...dateFilter,
              channel: {
                members: { some: { userId: session.user.id } },
                ...(input.workspaceId && { workspaceId: input.workspaceId }),
              },
              deletedAt: null,
            },
            take: INCREMENTAL_LIMIT,
            orderBy: { updatedAt: 'desc' },
            include: {
              author: {
                select: { id: true, name: true, avatarUrl: true },
              },
              reactions: true,
            },
          });

          // Separate by creation time relative to last sync
          const created = messages.filter((m) => m.createdAt > lastSyncAt);
          const updated = messages.filter((m) => m.createdAt <= lastSyncAt);

          // Get recently deleted messages
          const deletedMessages = await prisma.message.findMany({
            where: {
              deletedAt: { gt: lastSyncAt },
              channel: {
                members: { some: { userId: session.user.id } },
              },
            },
            select: { id: true },
            take: INCREMENTAL_LIMIT,
          });

          changes.push({
            entity: 'messages',
            created,
            updated,
            deleted: deletedMessages.map((m) => m.id),
          });
          break;
        }

        case 'channels': {
          const channels = await prisma.channel.findMany({
            where: {
              ...dateFilter,
              members: { some: { userId: session.user.id } },
              ...(input.workspaceId && { workspaceId: input.workspaceId }),
            },
            take: INCREMENTAL_LIMIT,
            orderBy: { updatedAt: 'desc' },
            include: {
              _count: { select: { members: true } },
            },
          });

          const created = channels.filter((c) => c.createdAt > lastSyncAt);
          const updated = channels.filter((c) => c.createdAt <= lastSyncAt);

          // Check for removed memberships (user left or was removed)
          const removedMemberships = await prisma.channelMember.findMany({
            where: {
              userId: session.user.id,
              leftAt: { gt: lastSyncAt },
            },
            select: { channelId: true },
          });

          changes.push({
            entity: 'channels',
            created,
            updated,
            deleted: removedMemberships.map((m) => m.channelId),
          });
          break;
        }

        case 'users': {
          const users = await prisma.user.findMany({
            where: {
              ...dateFilter,
              channelMemberships: {
                some: {
                  channel: {
                    members: { some: { userId: session.user.id } },
                  },
                },
              },
            },
            take: INCREMENTAL_LIMIT,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              lastActiveAt: true,
              updatedAt: true,
            },
          });

          // All user changes in incremental sync are updates
          changes.push({
            entity: 'users',
            created: [],
            updated: users,
            deleted: [],
          });
          break;
        }

        case 'notifications': {
          const notifications = await prisma.notification.findMany({
            where: {
              ...dateFilter,
              userId: session.user.id,
            },
            take: INCREMENTAL_LIMIT,
            orderBy: { updatedAt: 'desc' },
          });

          const created = notifications.filter((n) => n.createdAt > lastSyncAt);
          const updated = notifications.filter((n) => n.createdAt <= lastSyncAt);

          changes.push({
            entity: 'notifications',
            created,
            updated,
            deleted: [],
          });
          break;
        }

        case 'workspaces': {
          const workspaces = await prisma.workspace.findMany({
            where: {
              ...dateFilter,
              members: { some: { userId: session.user.id } },
            },
            take: INCREMENTAL_LIMIT,
            orderBy: { updatedAt: 'desc' },
          });

          const created = workspaces.filter((w) => w.createdAt > lastSyncAt);
          const updated = workspaces.filter((w) => w.createdAt <= lastSyncAt);

          changes.push({
            entity: 'workspaces',
            created,
            updated,
            deleted: [],
          });
          break;
        }
      }
    }

    // Check if there might be more changes
    const hasMore = changes.some(
      (c) =>
        c.created.length >= INCREMENTAL_LIMIT ||
        c.updated.length >= INCREMENTAL_LIMIT,
    );

    // Generate new sync token
    const newSyncToken = generateSyncToken(syncedAt);

    // Update user's sync preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs =
      typeof user?.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          sync: {
            lastSyncAt: syncedAt.toISOString(),
            lastSyncToken: newSyncToken,
          },
        },
      },
    });

    const response: SyncResponse = {
      syncToken: newSyncToken,
      changes,
      hasMore,
      syncedAt: syncedAt.toISOString(),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[POST /api/sync/incremental] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
