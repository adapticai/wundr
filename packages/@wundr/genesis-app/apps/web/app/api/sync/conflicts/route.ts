/**
 * Sync Conflicts API Routes
 *
 * Handles listing and resolving sync conflicts.
 *
 * Routes:
 * - GET /api/sync/conflicts - List pending conflicts
 * - POST /api/sync/conflicts - Resolve conflicts
 *
 * @module app/api/sync/conflicts/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  batchResolveConflictsSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type {
  ConflictItem,
  BatchResolveConflictsInput,
  ResolveConflictInput,
} from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Resolve a single conflict
 */
async function resolveConflict(
  conflict: ConflictItem,
  resolution: ResolveConflictInput,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    let dataToApply: Record<string, unknown>;

    switch (resolution.resolution) {
      case 'CLIENT_WINS':
        dataToApply = conflict.clientData;
        break;
      case 'SERVER_WINS':
        // No update needed, server data is already in place
        return { success: true };
      case 'MERGE':
        if (!resolution.mergedData) {
          return { success: false, error: 'Merged data required for MERGE resolution' };
        }
        dataToApply = resolution.mergedData;
        break;
      case 'MANUAL':
        if (!resolution.mergedData) {
          return { success: false, error: 'Merged data required for MANUAL resolution' };
        }
        dataToApply = resolution.mergedData;
        break;
      default:
        return { success: false, error: `Unknown resolution: ${resolution.resolution}` };
    }

    // Apply the resolution based on entity type
    switch (conflict.entity) {
      case 'messages': {
        // Verify ownership
        const message = await prisma.message.findFirst({
          where: { id: conflict.entityId, authorId: userId },
        });

        if (!message) {
          return { success: false, error: 'Message not found or not owned by user' };
        }

        await prisma.message.update({
          where: { id: conflict.entityId },
          data: {
            content: dataToApply.content as string | undefined,
            metadata: dataToApply.metadata as Prisma.InputJsonValue,
            editedAt: new Date(),
          },
        });
        break;
      }

      case 'channels': {
        // Verify permission
        const membership = await prisma.channelMember.findFirst({
          where: {
            channelId: conflict.entityId,
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!membership) {
          return { success: false, error: 'No permission to edit channel' };
        }

        await prisma.channel.update({
          where: { id: conflict.entityId },
          data: {
            name: dataToApply.name as string | undefined,
            description: dataToApply.description as string | undefined,
            topic: dataToApply.topic as string | undefined,
          },
        });
        break;
      }

      case 'notifications': {
        // Verify ownership
        const notification = await prisma.notification.findFirst({
          where: { id: conflict.entityId, userId },
        });

        if (!notification) {
          return { success: false, error: 'Notification not found' };
        }

        await prisma.notification.update({
          where: { id: conflict.entityId },
          data: {
            read: dataToApply.read as boolean | undefined,
            archived: dataToApply.archived as boolean | undefined,
          },
        });
        break;
      }

      default:
        return { success: false, error: `Unsupported entity: ${conflict.entity}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`[CONFLICT] Error resolving conflict ${conflict.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET /api/sync/conflicts
 *
 * List pending sync conflicts for the current user.
 * Conflicts occur when offline changes conflict with server-side changes.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns List of pending conflicts
 *
 * @example
 * ```
 * GET /api/sync/conflicts
 *
 * Response:
 * {
 *   "data": {
 *     "conflicts": [
 *       {
 *         "id": "550e8400-e29b-41d4-a716-446655440000",
 *         "entity": "messages",
 *         "entityId": "msg_123",
 *         "clientData": { "content": "Client version" },
 *         "serverData": { "content": "Server version" },
 *         "conflictedAt": "2024-01-15T10:30:00Z",
 *         "suggestedResolution": "CLIENT_WINS"
 *       }
 *     ],
 *     "count": 1
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

    // Get conflicts from user preferences
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

    const conflicts = (prefs.syncConflicts as ConflictItem[]) ?? [];

    return NextResponse.json({
      data: {
        conflicts,
        count: conflicts.length,
      },
    });
  } catch (error) {
    console.error('[GET /api/sync/conflicts] Error:', error);
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
 * POST /api/sync/conflicts
 *
 * Resolve one or more sync conflicts.
 * Each conflict can be resolved using different strategies:
 * - CLIENT_WINS: Apply client's version
 * - SERVER_WINS: Keep server's version
 * - MERGE: Apply merged data
 * - MANUAL: Apply user-provided data
 *
 * Requires authentication.
 *
 * @param request - Next.js request with conflict resolutions
 * @returns Resolution results
 *
 * @example
 * ```
 * POST /api/sync/conflicts
 * Content-Type: application/json
 *
 * {
 *   "conflicts": [
 *     {
 *       "conflictId": "550e8400-e29b-41d4-a716-446655440000",
 *       "resolution": "CLIENT_WINS"
 *     },
 *     {
 *       "conflictId": "550e8400-e29b-41d4-a716-446655440001",
 *       "resolution": "MERGE",
 *       "mergedData": {
 *         "content": "Merged content combining both versions"
 *       }
 *     }
 *   ]
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "resolved": 2,
 *     "failed": 0,
 *     "remaining": 0,
 *     "results": [
 *       { "conflictId": "...", "success": true },
 *       { "conflictId": "...", "success": true }
 *     ]
 *   },
 *   "message": "2 conflicts resolved"
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
    const parseResult = batchResolveConflictsSchema.safeParse(body);
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

    const input: BatchResolveConflictsInput = parseResult.data;

    // Get current conflicts from user preferences
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

    const existingConflicts = (currentPrefs.syncConflicts as ConflictItem[]) ?? [];

    // Build a map of conflicts for quick lookup
    const conflictMap = new Map<string, ConflictItem>();
    for (const conflict of existingConflicts) {
      conflictMap.set(conflict.id, conflict);
    }

    // Process resolutions
    const results: { conflictId: string; success: boolean; error?: string }[] = [];
    const resolvedIds: string[] = [];
    let resolved = 0;
    let failed = 0;

    for (const resolution of input.conflicts) {
      const conflict = conflictMap.get(resolution.conflictId);

      if (!conflict) {
        results.push({
          conflictId: resolution.conflictId,
          success: false,
          error: 'Conflict not found',
        });
        failed++;
        continue;
      }

      const result = await resolveConflict(conflict, resolution, session.user.id);

      results.push({
        conflictId: resolution.conflictId,
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        resolved++;
        resolvedIds.push(resolution.conflictId);
      } else {
        failed++;
      }
    }

    // Remove resolved conflicts from user preferences
    const remainingConflicts = existingConflicts.filter(
      (c) => !resolvedIds.includes(c.id),
    );

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          syncConflicts: remainingConflicts,
        },
      },
    });

    const message = resolved === 1
      ? '1 conflict resolved'
      : `${resolved} conflicts resolved`;

    return NextResponse.json({
      data: {
        resolved,
        failed,
        remaining: remainingConflicts.length,
        results,
      },
      message,
    });
  } catch (error) {
    console.error('[POST /api/sync/conflicts] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
