/**
 * VP Task Delegation API Route
 *
 * Allows Virtual Persons (VPs) to delegate tasks to other VPs.
 *
 * Routes:
 * - POST /api/vps/:id/delegate - Delegate a task to another VP
 *
 * @module app/api/vps/[id]/delegate/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { delegateTask } from '@/lib/services/vp-coordination-service';
import { vpIdParamSchema } from '@/lib/validations/vp';
import {
  delegateTaskSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { DelegateTaskInput } from '@/lib/validations/vp-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/delegate
 *
 * Delegate a task from one VP to another VP.
 * Requires authentication as the VP or admin/owner in the VP's organization.
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing VP ID
 * @returns Updated task with delegation information
 *
 * @example
 * ```
 * POST /api/vps/vp_123/delegate
 * Content-Type: application/json
 *
 * {
 *   "toVpId": "vp_789",
 *   "taskId": "task_456",
 *   "note": "This task requires your expertise in frontend development",
 *   "priority": "HIGH"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
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

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Invalid VP ID format',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const fromVpId = params.id;

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
    const parseResult = delegateTaskSchema.safeParse(body);
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

    const input: DelegateTaskInput = parseResult.data;

    // Delegate the task using the coordination service
    const result = await delegateTask(
      fromVpId,
      input.toVpId,
      input.taskId,
      {
        note: input.note,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    );

    if (!result.success) {
      // Determine appropriate status code based on error
      let statusCode = 500;
      let errorCode: typeof VP_COORDINATION_ERROR_CODES[keyof typeof VP_COORDINATION_ERROR_CODES] = VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR;

      if (result.error?.includes('not found')) {
        statusCode = 404;
        errorCode = VP_COORDINATION_ERROR_CODES.NOT_FOUND;
      } else if (result.error?.includes('does not belong')) {
        statusCode = 403;
        errorCode = VP_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP;
      } else if (result.error?.includes('organization')) {
        statusCode = 400;
        errorCode = VP_COORDINATION_ERROR_CODES.DIFFERENT_ORGANIZATION;
      }

      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Delegation failed',
          errorCode,
        ),
        { status: statusCode },
      );
    }

    return NextResponse.json({
      data: result,
      message: result.message || 'Task delegated successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/delegate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
