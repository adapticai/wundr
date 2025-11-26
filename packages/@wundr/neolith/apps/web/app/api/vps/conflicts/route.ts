/**
 * VP Conflict Resolution API Route
 *
 * Handles resolving conflicts between multiple VPs.
 *
 * Routes:
 * - POST /api/vps/conflicts - Resolve a conflict between VPs
 *
 * @module app/api/vps/conflicts/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { resolveConflict } from '@/lib/services/vp-coordination-service';
import {
  conflictResolutionSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { ConflictResolutionInput } from '@/lib/validations/vp-coordination';
import type { NextRequest } from 'next/server';

/**
 * POST /api/vps/conflicts
 *
 * Resolve a conflict between multiple VPs.
 * Requires authentication and admin/owner role.
 *
 * @param request - Next.js request with conflict resolution data
 * @returns Conflict resolution result
 *
 * @example
 * ```
 * POST /api/vps/conflicts
 * Content-Type: application/json
 *
 * {
 *   "vpIds": ["vp_123", "vp_456"],
 *   "conflictType": "priority_conflict",
 *   "resolution": {
 *     "decision": "Split task into two subtasks",
 *     "assignedTo": {
 *       "vp_123": "task_subtask_1",
 *       "vp_456": "task_subtask_2"
 *     }
 *   },
 *   "taskId": "task_789",
 *   "note": "Both VPs needed to work on different aspects"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Authentication required',
          VP_COORDINATION_ERROR_CODES.UNAUTHORIZED,
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
        createCoordinationErrorResponse(
          'Invalid JSON body',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = conflictResolutionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Validation failed',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: ConflictResolutionInput = parseResult.data;

    // Resolve the conflict
    const result = await resolveConflict(
      input.vpIds,
      input.conflictType,
      input.resolution,
      {
        taskId: input.taskId,
        workspaceId: input.workspaceId,
        note: input.note,
      },
    );

    if (!result.success) {
      // Determine appropriate status code based on error
      let statusCode = 500;
      let errorCode: typeof VP_COORDINATION_ERROR_CODES[keyof typeof VP_COORDINATION_ERROR_CODES] = VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR;

      if (result.error?.includes('not found')) {
        statusCode = 404;
        errorCode = VP_COORDINATION_ERROR_CODES.NOT_FOUND;
      } else if (result.error?.includes('organization')) {
        statusCode = 400;
        errorCode = VP_COORDINATION_ERROR_CODES.DIFFERENT_ORGANIZATION;
      }

      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Conflict resolution failed',
          errorCode,
        ),
        { status: statusCode },
      );
    }

    return NextResponse.json({
      data: result,
      message: result.message || 'Conflict resolved successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/conflicts] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
