/**
 * OrchestratorTask Handoff API Route
 *
 * Handles handing off tasks from one Orchestrator to another with context.
 *
 * Routes:
 * - POST /api/orchestrators/:id/handoff - Handoff a task to another Orchestrator
 *
 * @module app/api/orchestrators/[id]/handoff/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { handoffTask } from '@/lib/services/orchestrator-coordination-service';
import { orchestratorIdParamSchema } from '@/lib/validations/orchestrator';
import {
  handoffTaskSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { HandoffTaskInput } from '@/lib/validations/orchestrator-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/orchestrators/:id/handoff
 *
 * Handoff a task from the current Orchestrator to another Orchestrator with context transfer.
 * Requires authentication and Orchestrator ownership.
 *
 * @param request - Next.js request with handoff data
 * @param context - Route context containing source OrchestratorID
 * @returns Handoff result
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/handoff
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Invalid OrchestratorID format',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
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
      input.toOrchestratorId,
      input.taskId,
      handoffContext,
    );

    if (!result.success) {
      // Determine appropriate status code based on error
      let statusCode = 500;
      let errorCode: typeof ORCHESTRATOR_COORDINATION_ERROR_CODES[keyof typeof ORCHESTRATOR_COORDINATION_ERROR_CODES] = ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR;

      if (result.error?.includes('not found')) {
        statusCode = 404;
        errorCode = ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND;
      } else if (result.error?.includes('does not belong')) {
        statusCode = 403;
        errorCode = ORCHESTRATOR_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP;
      } else if (result.error?.includes('organization')) {
        statusCode = 400;
        errorCode = ORCHESTRATOR_COORDINATION_ERROR_CODES.DIFFERENT_ORGANIZATION;
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
    console.error('[POST /api/orchestrators/:id/handoff] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
