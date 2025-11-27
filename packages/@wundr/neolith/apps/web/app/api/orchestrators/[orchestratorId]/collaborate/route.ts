/**
 * OrchestratorCollaboration API Route
 *
 * Handles requesting collaboration from multiple VPs on a task.
 *
 * Routes:
 * - POST /api/orchestrators/:id/collaborate - Request collaboration on a task
 *
 * @module app/api/orchestrators/[id]/collaborate/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { requestCollaboration } from '@/lib/services/orchestrator-coordination-service';
import { orchestratorIdParamSchema } from '@/lib/validations/orchestrator';
import {
  collaborationRequestSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { CollaborationRequestInput } from '@/lib/validations/orchestrator-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * POST /api/orchestrators/:id/collaborate
 *
 * Request collaboration from other VPs on a task.
 * Requires authentication and task ownership by the requesting Orchestrator.
 *
 * @param request - Next.js request with collaboration data
 * @param context - Route context containing primary OrchestratorID
 * @returns Collaboration result
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/collaborate
 * Content-Type: application/json
 *
 * {
 *   "taskId": "task_789",
 *   "requiredVpIds": ["vp_456", "vp_789"],
 *   "roles": {
 *     "vp_456": "code_reviewer",
 *     "vp_789": "technical_advisor"
 *   },
 *   "note": "Need expertise in both backend and frontend for this feature"
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

    const primaryVpId = params.orchestratorId;

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
    const parseResult = collaborationRequestSchema.safeParse(body);
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

    const input: CollaborationRequestInput = parseResult.data;

    // Validate that primary Orchestrator is not in the collaborators list
    if (input.requiredOrchestratorIds.includes(primaryVpId)) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Primary Orchestrator cannot be a collaborator',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Request collaboration
    const result = await requestCollaboration(
      primaryVpId,
      input.taskId,
      input.requiredOrchestratorIds,
      {
        roles: input.roles,
        note: input.note,
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
          result.error || 'Collaboration request failed',
          errorCode,
        ),
        { status: statusCode },
      );
    }

    return NextResponse.json({
      data: result,
      message: result.message || 'Collaboration request sent successfully',
    });
  } catch (error) {
    console.error('[POST /api/orchestrators/:id/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
