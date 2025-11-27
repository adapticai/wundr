/**
 * OrchestratorAvailability API Routes
 *
 * Handles checking Orchestrator availability and reserving time slots for tasks.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability - Check availability
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability - Reserve time slot
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/availability/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  checkAvailability,
  reserveTimeSlot,
} from '@/lib/services/orchestrator-scheduling-service';
import { createErrorResponse, ORCHESTRATOR_ERROR_CODES } from '@/lib/validations/orchestrator';
import {
  checkAvailabilitySchema,
  reserveTimeSlotSchema,
  SCHEDULING_ERROR_CODES,
} from '@/lib/validations/orchestrator-scheduling';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 */
async function checkVPAccess(workspaceId: string, orchestratorId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  const orchestrator = await prisma.vP.findFirst({
    where: {
      id: orchestratorId,
      organizationId: workspace.organizationId,
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    select: { id: true, userId: true },
  });

  if (!orchestrator) {
    return null;
  }

  return { orchestrator, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability
 *
 * Check Orchestrator availability for a time slot and optionally get available slots.
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Availability status and available time slots
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/availability?startTime=2024-11-27T09:00:00Z&endTime=2024-11-27T17:00:00Z&includeSlots=true
 *
 * Response:
 * {
 *   "data": {
 *     "isAvailable": false,
 *     "availableSlots": [
 *       { "start": "2024-11-27T09:00:00Z", "end": "2024-11-27T11:00:00Z" },
 *       { "start": "2024-11-27T14:00:00Z", "end": "2024-11-27T17:00:00Z" }
 *     ],
 *     "conflicts": [
 *       {
 *         "taskId": "task_123",
 *         "taskTitle": "Code review",
 *         "start": "2024-11-27T11:00:00Z",
 *         "end": "2024-11-27T14:00:00Z"
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = checkAvailabilitySchema.safeParse({
      startTime: searchParams.get('startTime'),
      endTime: searchParams.get('endTime'),
      includeSlots: searchParams.get('includeSlots'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { startTime, endTime } = queryResult.data;

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (startDate >= endDate) {
      return NextResponse.json(
        createErrorResponse(
          'Start time must be before end time',
          SCHEDULING_ERROR_CODES.INVALID_TIME_RANGE,
        ),
        { status: 400 },
      );
    }

    const availability = await checkAvailability(orchestratorId, startDate, endDate);

    return NextResponse.json({ data: availability });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability
 *
 * Reserve a time slot for a task.
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request with reservation data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Reservation confirmation
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/orchestrators/orch_456/availability
 * Content-Type: application/json
 *
 * {
 *   "taskId": "task_789",
 *   "startTime": "2024-11-27T09:00:00Z",
 *   "durationMinutes": 120,
 *   "note": "Important client meeting preparation"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "success": true,
 *     "scheduledStart": "2024-11-27T09:00:00Z",
 *     "scheduledEnd": "2024-11-27T11:00:00Z"
 *   },
 *   "message": "Time slot reserved successfully"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = reserveTimeSlotSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, orchestratorId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found or access denied', ORCHESTRATOR_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const { taskId, startTime, durationMinutes } = parseResult.data;

    // Verify task exists and belongs to this Orchestrator
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        vpId: orchestratorId,
        workspaceId,
      },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found or does not belong to this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.TASK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const startDate = new Date(startTime);

    try {
      const reservation = await reserveTimeSlot(orchestratorId, taskId, startDate, durationMinutes);

      return NextResponse.json(
        {
          data: reservation,
          message: 'Time slot reserved successfully',
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'Time slot conflict detected') {
        return NextResponse.json(
          createErrorResponse(
            'Time slot conflict - Orchestrator is already scheduled during this time',
            SCHEDULING_ERROR_CODES.TIME_SLOT_CONFLICT,
          ),
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/availability] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
