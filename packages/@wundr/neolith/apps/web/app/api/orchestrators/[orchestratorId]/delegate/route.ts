/**
 * OrchestratorTask Delegation API Route
 *
 * Allows Orchestrators (VPs) to delegate tasks to other VPs.
 *
 * Routes:
 * - POST /api/orchestrators/:id/delegate - Delegate a task to another Orchestrator
 *
 * @module app/api/orchestrators/[id]/delegate/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { delegateTask } from '@/lib/services/orchestrator-coordination-service';
import { orchestratorIdParamSchema } from '@/lib/validations/orchestrator';
import {
  delegateTaskSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { DelegateTaskInput } from '@/lib/validations/orchestrator-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * POST /api/orchestrators/:id/delegate
 *
 * Delegate a task from one Orchestrator to another Orchestrator.
 * Requires authentication as the Orchestrator or admin/owner in the Orchestrator's organization.
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing OrchestratorID
 * @returns Updated task with delegation information
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/delegate
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

    const fromVpId = params.orchestratorId;

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
    const parseResult = delegateTaskSchema.safeParse(body);
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

    const input: DelegateTaskInput = parseResult.data;

    // Delegate the task using the coordination service
    const result = await delegateTask(
      fromVpId,
      input.toOrchestratorId,
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
    console.error('[POST /api/orchestrators/:id/delegate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
