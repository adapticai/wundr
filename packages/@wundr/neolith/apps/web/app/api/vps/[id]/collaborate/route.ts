/**
 * VP Collaboration API Route
 *
 * Handles requesting collaboration from multiple VPs on a task.
 *
 * Routes:
 * - POST /api/vps/:id/collaborate - Request collaboration on a task
 *
 * @module app/api/vps/[id]/collaborate/route
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { requestCollaboration } from '@/lib/services/vp-coordination-service';
import { vpIdParamSchema } from '@/lib/validations/vp';
import {
  collaborationRequestSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { CollaborationRequestInput } from '@/lib/validations/vp-coordination';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/collaborate
 *
 * Request collaboration from other VPs on a task.
 * Requires authentication and task ownership by the requesting VP.
 *
 * @param request - Next.js request with collaboration data
 * @param context - Route context containing primary VP ID
 * @returns Collaboration result
 *
 * @example
 * ```
 * POST /api/vps/vp_123/collaborate
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

    const primaryVpId = params.id;

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
    const parseResult = collaborationRequestSchema.safeParse(body);
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

    const input: CollaborationRequestInput = parseResult.data;

    // Validate that primary VP is not in the collaborators list
    if (input.requiredVpIds.includes(primaryVpId)) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Primary VP cannot be a collaborator',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Request collaboration
    const result = await requestCollaboration(
      primaryVpId,
      input.taskId,
      input.requiredVpIds,
      {
        roles: input.roles,
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
      } else if (result.error?.includes('does not belong')) {
        statusCode = 403;
        errorCode = VP_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP;
      } else if (result.error?.includes('organization')) {
        statusCode = 400;
        errorCode = VP_COORDINATION_ERROR_CODES.DIFFERENT_ORGANIZATION;
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
    console.error('[POST /api/vps/:id/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
