/**
 * VP Task Handoff API Route
 *
 * Handles handing off tasks from one VP to another with context.
 *
 * Routes:
 * - POST /api/vps/:id/handoff - Handoff a task to another VP
 *
 * @module app/api/vps/[id]/handoff/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { handoffTask } from '@/lib/services/vp-coordination-service';
import { vpIdParamSchema } from '@/lib/validations/vp';
import {
  handoffTaskSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { HandoffTaskInput } from '@/lib/validations/vp-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/handoff
 *
 * Handoff a task from the current VP to another VP with context transfer.
 * Requires authentication and VP ownership.
 *
 * @param request - Next.js request with handoff data
 * @param context - Route context containing source VP ID
 * @returns Handoff result
 *
 * @example
 * ```
 * POST /api/vps/vp_123/handoff
 * Content-Type: application/json
 *
 * {
 *   "toVpId": "vp_456",
 *   "taskId": "task_789",
 *   "context": {
 *     "progress": "50%",
 *     "blockers": ["Waiting for API keys"],
 *     "notes": "Frontend is complete, backend needs work"
 *   },
 *   "notes": "Handing off due to expertise mismatch"
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
    const parseResult = handoffTaskSchema.safeParse(body);
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

    const input: HandoffTaskInput = parseResult.data;

    // Add notes to context if provided
    const handoffContext = {
      ...input.context,
      ...(input.notes && { handoffNotes: input.notes }),
    };

    // Handoff the task
    const result = await handoffTask(
      fromVpId,
      input.toVpId,
      input.taskId,
      handoffContext,
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
          result.error || 'Handoff failed',
          errorCode,
        ),
        { status: statusCode },
      );
    }

    return NextResponse.json({
      data: result,
      message: result.message || 'Task handed off successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/handoff] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
