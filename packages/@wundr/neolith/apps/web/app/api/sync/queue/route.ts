/**
 * Offline Queue Processing API Route
 *
 * Handles processing of queued offline operations.
 *
 * Routes:
 * - POST /api/sync/queue - Process offline queue items
 *
 * @module app/api/sync/queue/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  processQueueSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type {
  ProcessQueueInput,
  OfflineQueueItem,
  QueueProcessingResult,
  ConflictItem,
} from '@/lib/validations/notification';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Process a single queue item
 *
 * @param item - Queue item to process
 * @param userId - Authenticated user ID
 * @returns Processing result
 */
async function processQueueItem(
  item: OfflineQueueItem,
  userId: string,
): Promise<{
  success: boolean;
  entityId?: string;
  error?: string;
  conflict?: ConflictItem;
}> {
  try {
    switch (item.entity) {
      case 'messages': {
        return await processMessageOperation(item, userId);
      }
      case 'channels': {
        return await processChannelOperation(item, userId);
      }
      case 'notifications': {
        return await processNotificationOperation(item, userId);
      }
      default:
        return {
          success: false,
          error: `Unsupported entity type: ${item.entity}`,
        };
    }
  } catch (error) {
    console.error(`[QUEUE] Error processing item ${item.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process message operations
 */
async function processMessageOperation(
  item: OfflineQueueItem,
  userId: string,
): Promise<{
  success: boolean;
  entityId?: string;
  error?: string;
  conflict?: ConflictItem;
}> {
  const payload = item.payload as Record<string, unknown>;

  switch (item.operation) {
    case 'CREATE': {
      const channelId = payload.channelId as string;

      // Verify user has access to channel
      const membership = await prisma.channelMember.findFirst({
        where: { channelId, userId },
      });

      if (!membership) {
        return { success: false, error: 'Not a member of this channel' };
      }

      const messageType = (payload.type as string) ?? 'TEXT';
      const validTypes = ['TEXT', 'FILE', 'SYSTEM', 'COMMAND'] as const;
      const safeType = validTypes.includes(
        messageType as (typeof validTypes)[number],
      )
        ? (messageType as (typeof validTypes)[number])
        : 'TEXT';

      const message = await prisma.message.create({
        data: {
          content: payload.content as string,
          type: safeType,
          channelId,
          authorId: userId,
          parentId: payload.parentId as string | undefined,
          metadata: (payload.metadata as Prisma.InputJsonValue) ?? {},
        },
      });

      return { success: true, entityId: message.id };
    }

    case 'UPDATE': {
      if (!item.entityId) {
        return { success: false, error: 'Entity ID required for update' };
      }

      // Check for conflicts
      const existing = await prisma.message.findUnique({
        where: { id: item.entityId },
        select: { updatedAt: true, authorId: true, content: true },
      });

      if (!existing) {
        return { success: false, error: 'Message not found' };
      }

      if (existing.authorId !== userId) {
        return {
          success: false,
          error: 'Cannot edit message from another user',
        };
      }

      // Check for conflict (server was updated after client queued the change)
      if (existing.updatedAt > item.queuedAt) {
        return {
          success: false,
          error: 'Conflict detected',
          conflict: {
            id: crypto.randomUUID(),
            entity: 'messages',
            entityId: item.entityId,
            clientData: payload,
            serverData: { content: existing.content },
            conflictedAt: new Date().toISOString(),
            suggestedResolution: 'CLIENT_WINS',
          },
        };
      }

      await prisma.message.update({
        where: { id: item.entityId },
        data: {
          content: payload.content as string,
          metadata: payload.metadata as Prisma.InputJsonValue,
          editedAt: new Date(),
        },
      });

      return { success: true, entityId: item.entityId };
    }

    case 'DELETE': {
      if (!item.entityId) {
        return { success: false, error: 'Entity ID required for delete' };
      }

      const existing = await prisma.message.findUnique({
        where: { id: item.entityId },
        select: { authorId: true },
      });

      if (!existing) {
        // Already deleted, consider success
        return { success: true, entityId: item.entityId };
      }

      if (existing.authorId !== userId) {
        return {
          success: false,
          error: 'Cannot delete message from another user',
        };
      }

      await prisma.message.update({
        where: { id: item.entityId },
        data: { deletedAt: new Date() },
      });

      return { success: true, entityId: item.entityId };
    }

    default:
      return { success: false, error: `Unknown operation: ${item.operation}` };
  }
}

/**
 * Process channel operations
 */
async function processChannelOperation(
  item: OfflineQueueItem,
  userId: string,
): Promise<{
  success: boolean;
  entityId?: string;
  error?: string;
  conflict?: ConflictItem;
}> {
  const payload = item.payload as Record<string, unknown>;

  switch (item.operation) {
    case 'CREATE': {
      // Verify user has access to workspace
      const workspaceId = payload.workspaceId as string;
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });

      if (!membership) {
        return { success: false, error: 'Not a member of this workspace' };
      }

      const name = payload.name as string;
      // Generate slug from name
      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'channel';

      const channel = await prisma.channel.create({
        data: {
          name,
          slug,
          description: payload.description as string | undefined,
          type: (payload.type as 'PUBLIC' | 'PRIVATE') ?? 'PUBLIC',
          workspaceId,
          createdById: userId,
          channelMembers: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });

      return { success: true, entityId: channel.id };
    }

    case 'UPDATE': {
      if (!item.entityId) {
        return { success: false, error: 'Entity ID required for update' };
      }

      // Verify user can edit channel
      const membership = await prisma.channelMember.findFirst({
        where: {
          channelId: item.entityId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        return { success: false, error: 'No permission to edit this channel' };
      }

      await prisma.channel.update({
        where: { id: item.entityId },
        data: {
          name: payload.name as string | undefined,
          description: payload.description as string | undefined,
          topic: payload.topic as string | undefined,
        },
      });

      return { success: true, entityId: item.entityId };
    }

    case 'DELETE':
      // Channel deletion is not supported via offline queue
      return { success: false, error: 'Channel deletion must be done online' };

    default:
      return { success: false, error: `Unknown operation: ${item.operation}` };
  }
}

/**
 * Process notification operations
 */
async function processNotificationOperation(
  item: OfflineQueueItem,
  userId: string,
): Promise<{
  success: boolean;
  entityId?: string;
  error?: string;
}> {
  const payload = item.payload as Record<string, unknown>;

  switch (item.operation) {
    case 'UPDATE': {
      if (!item.entityId) {
        return { success: false, error: 'Entity ID required for update' };
      }

      // Verify ownership
      const existing = await prisma.notification.findFirst({
        where: { id: item.entityId, userId },
      });

      if (!existing) {
        return { success: false, error: 'Notification not found' };
      }

      await prisma.notification.update({
        where: { id: item.entityId },
        data: {
          read: payload.read as boolean | undefined,
          readAt: payload.read ? new Date() : undefined,
          archived: payload.archived as boolean | undefined,
        },
      });

      return { success: true, entityId: item.entityId };
    }

    case 'DELETE': {
      if (!item.entityId) {
        return { success: false, error: 'Entity ID required for delete' };
      }

      const existing = await prisma.notification.findFirst({
        where: { id: item.entityId, userId },
      });

      if (!existing) {
        return { success: true, entityId: item.entityId };
      }

      await prisma.notification.delete({
        where: { id: item.entityId },
      });

      return { success: true, entityId: item.entityId };
    }

    default:
      return {
        success: false,
        error: `Operation ${item.operation} not supported for notifications`,
      };
  }
}

/**
 * POST /api/sync/queue
 *
 * Process offline queue items that were created while the client was offline.
 * Operations are processed in order by default to maintain consistency.
 * Returns results for each item including any conflicts detected.
 * Requires authentication.
 *
 * @param request - Next.js request with queue items
 * @returns Processing results
 *
 * @example
 * ```
 * POST /api/sync/queue
 * Content-Type: application/json
 *
 * {
 *   "items": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "operation": "CREATE",
 *       "entity": "messages",
 *       "payload": {
 *         "channelId": "ch_123",
 *         "content": "Hello from offline!"
 *       },
 *       "queuedAt": "2024-01-15T10:00:00Z"
 *     }
 *   ],
 *   "sequential": true
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "processed": 1,
 *     "failed": 0,
 *     "conflicts": [],
 *     "results": [
 *       {
 *         "id": "550e8400-e29b-41d4-a716-446655440000",
 *         "success": true,
 *         "entityId": "msg_789"
 *       }
 *     ]
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
        createNotificationErrorResponse(
          'Authentication required',
          NOTIFICATION_ERROR_CODES.UNAUTHORIZED,
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
        createNotificationErrorResponse(
          'Invalid JSON body',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = processQueueSchema.safeParse(body);
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

    const input: ProcessQueueInput = parseResult.data;

    // Sort items by queuedAt for sequential processing
    const sortedItems = [...input.items].sort(
      (a, b) => a.queuedAt.getTime() - b.queuedAt.getTime(),
    );

    const results: QueueProcessingResult['results'] = [];
    const conflicts: ConflictItem[] = [];
    let processed = 0;
    let failed = 0;

    if (input.sequential) {
      // Process sequentially
      for (const item of sortedItems) {
        const result = await processQueueItem(item, session.user.id);
        results.push({
          id: item.id,
          success: result.success,
          entityId: result.entityId,
          error: result.error,
        });

        if (result.success) {
          processed++;
        } else {
          failed++;
          if (result.conflict) {
            conflicts.push(result.conflict);
          }
        }
      }
    } else {
      // Process in parallel
      const processingResults = await Promise.all(
        sortedItems.map(async item => {
          const result = await processQueueItem(item, session.user.id);
          return { item, result };
        }),
      );

      for (const { item, result } of processingResults) {
        results.push({
          id: item.id,
          success: result.success,
          entityId: result.entityId,
          error: result.error,
        });

        if (result.success) {
          processed++;
        } else {
          failed++;
          if (result.conflict) {
            conflicts.push(result.conflict);
          }
        }
      }
    }

    // Store conflicts for later resolution if any
    if (conflicts.length > 0) {
      // Store conflicts in user preferences for retrieval
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

      const existingConflicts =
        (currentPrefs.syncConflicts as ConflictItem[]) ?? [];

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          preferences: JSON.parse(
            JSON.stringify({
              ...currentPrefs,
              syncConflicts: [...existingConflicts, ...conflicts],
            }),
          ) as Prisma.InputJsonValue,
        },
      });
    }

    const response: QueueProcessingResult = {
      processed,
      failed,
      conflicts,
      results,
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[POST /api/sync/queue] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
