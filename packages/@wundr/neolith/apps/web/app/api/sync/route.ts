/**
 * Sync API Routes
 *
 * Handles full sync and sync status for offline-first functionality.
 *
 * Routes:
 * - POST /api/sync - Perform full sync
 * - GET /api/sync - Get sync status
 *
 * @module app/api/sync/route
 */

import { randomUUID } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  syncRequestSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { SyncRequestInput, SyncEntity, SyncResponse } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * Generate a sync token encoding the sync timestamp
 *
 * @param timestamp - Sync timestamp
 * @returns Encoded sync token
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
 *
 * @param token - Sync token
 * @returns Parsed timestamp or null if invalid
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
 * Default entities to sync
 */
const DEFAULT_ENTITIES: SyncEntity[] = ['messages', 'channels', 'users', 'notifications'];

/**
 * GET /api/sync
 *
 * Get the current sync status for the user.
 * Returns information about last sync, pending changes, and connectivity.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns Sync status information
 *
 * @example
 * ```
 * GET /api/sync
 *
 * Response:
 * {
 *   "data": {
 *     "lastSyncAt": "2024-01-15T10:30:00Z",
 *     "pendingChanges": 5,
 *     "entities": {
 *       "messages": { "synced": 150, "pending": 2 },
 *       "channels": { "synced": 10, "pending": 0 },
 *       ...
 *     },
 *     "status": "SYNCED"
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
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get user's sync status from preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const prefs =
      typeof user?.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    const syncPrefs = prefs.sync as Record<string, unknown> | undefined;
    const lastSyncAt = syncPrefs?.lastSyncAt as string | undefined;

    // Get counts of user's data
    const [messageCount, channelCount, notificationCount] = await Promise.all([
      prisma.message.count({
        where: {
          channel: {
            channelMembers: { some: { userId: session.user.id } },
          },
        },
      }),
      prisma.channel.count({
        where: {
          channelMembers: { some: { userId: session.user.id } },
        },
      }),
      prisma.notification.count({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({
      data: {
        lastSyncAt: lastSyncAt ?? null,
        pendingChanges: 0, // Pending changes tracked client-side via IndexedDB
        entities: {
          messages: { synced: messageCount, pending: 0 },
          channels: { synced: channelCount, pending: 0 },
          notifications: { synced: notificationCount, pending: 0 },
        },
        status: 'SYNCED',
      },
    });
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/sync
 *
 * Perform a full or incremental sync of specified entities.
 * Returns all changes since the last sync token (if provided) or all data.
 * Requires authentication.
 *
 * @param request - Next.js request with sync parameters
 * @returns Sync response with changes and new sync token
 *
 * @example Full sync
 * ```
 * POST /api/sync
 * Content-Type: application/json
 *
 * {
 *   "entities": ["messages", "channels"],
 *   "workspaceId": "ws_123",
 *   "limit": 100
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
 *         "deleted": ["msg_123", "msg_456"]
 *       },
 *       ...
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
    const parseResult = syncRequestSchema.safeParse(body);
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

    const input: SyncRequestInput = parseResult.data;
    const entities = input.entities ?? DEFAULT_ENTITIES;
    const limit = input.limit ?? 100;

    // Parse last sync token if provided
    const lastSyncAt = input.lastSyncToken
      ? parseSyncToken(input.lastSyncToken)
      : null;

    // Build base where clause for date filtering
    const dateFilter = lastSyncAt
      ? { updatedAt: { gt: lastSyncAt } }
      : {};

    // Sync timestamp
    const syncedAt = new Date();

    // Fetch changes for each entity
    const changes: SyncResponse['changes'] = [];

    for (const entity of entities) {
      switch (entity) {
        case 'messages': {
          const [messages, deletedMessages] = await Promise.all([
            prisma.message.findMany({
              where: {
                ...dateFilter,
                channel: {
                  channelMembers: { some: { userId: session.user.id } },
                  ...(input.workspaceId && { workspaceId: input.workspaceId }),
                },
                deletedAt: null,
              },
              take: limit,
              orderBy: { updatedAt: 'desc' },
              include: {
                author: {
                  select: { id: true, name: true, avatarUrl: true },
                },
                reactions: true,
              },
            }),
            // Get soft-deleted messages for sync
            input.includeDeleted
              ? prisma.message.findMany({
                  where: {
                    ...dateFilter,
                    channel: {
                      channelMembers: { some: { userId: session.user.id } },
                    },
                    deletedAt: { not: null },
                  },
                  select: { id: true },
                  take: limit,
                })
              : [],
          ]);

          // Separate created vs updated based on lastSyncAt
          const created = lastSyncAt
            ? messages.filter((m) => m.createdAt > lastSyncAt)
            : messages;
          const updated = lastSyncAt
            ? messages.filter((m) => m.createdAt <= lastSyncAt)
            : [];

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
              channelMembers: { some: { userId: session.user.id } },
              ...(input.workspaceId && { workspaceId: input.workspaceId }),
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            include: {
              _count: { select: { channelMembers: true } },
            },
          });

          const created = lastSyncAt
            ? channels.filter((c) => c.createdAt > lastSyncAt)
            : channels;
          const updated = lastSyncAt
            ? channels.filter((c) => c.createdAt <= lastSyncAt)
            : [];

          changes.push({
            entity: 'channels',
            created,
            updated,
            deleted: [],
          });
          break;
        }

        case 'users': {
          // Get users from channels the user is a member of
          const users = await prisma.user.findMany({
            where: {
              ...dateFilter,
              channelMembers: {
                some: {
                  channel: {
                    channelMembers: { some: { userId: session.user.id } },
                  },
                },
              },
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              lastActiveAt: true,
            },
          });

          changes.push({
            entity: 'users',
            created: lastSyncAt ? [] : users,
            updated: lastSyncAt ? users : [],
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
            take: limit,
            orderBy: { updatedAt: 'desc' },
          });

          const created = lastSyncAt
            ? notifications.filter((n) => n.createdAt > lastSyncAt)
            : notifications;
          const updated = lastSyncAt
            ? notifications.filter((n) => n.createdAt <= lastSyncAt)
            : [];

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
              workspaceMembers: { some: { userId: session.user.id } },
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
          });

          const created = lastSyncAt
            ? workspaces.filter((w) => w.createdAt > lastSyncAt)
            : workspaces;
          const updated = lastSyncAt
            ? workspaces.filter((w) => w.createdAt <= lastSyncAt)
            : [];

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

    // Check if there's more data to sync
    const hasMore = changes.some(
      (c) => c.created.length >= limit || c.updated.length >= limit,
    );

    // Generate new sync token
    const syncToken = generateSyncToken(syncedAt);

    // Update user's last sync timestamp
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
            lastSyncToken: syncToken,
          },
        },
      },
    });

    const response: SyncResponse = {
      syncToken,
      changes,
      hasMore,
      syncedAt: syncedAt.toISOString(),
    };

    return NextResponse.json({ data: response });
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
