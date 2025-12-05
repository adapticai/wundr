/**
 * OrchestratorWork Schedule API Routes
 *
 * Handles Orchestrator work schedule configuration including work hours,
 * active days, timezone, breaks, and batch processing windows.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule - Get Orchestrator's work schedule
 * - PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule - Update Orchestrator work schedule
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/schedule/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getWorkSchedule,
  updateWorkSchedule,
} from '@/lib/services/orchestrator-scheduling-service';
import {
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';
import {
  getWorkScheduleSchema,
  updateWorkScheduleSchema,
} from '@/lib/validations/orchestrator-scheduling';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Helper function to check if user has access to an Orchestrator within a workspace
 */
async function checkVPAccess(
  workspaceId: string,
  orchestratorId: string,
  userId: string,
) {
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

  const orchestrator = await prisma.orchestrator.findFirst({
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
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule
 *
 * Get Orchestrator's work schedule configuration including:
 * - Work hours per day (e.g., 09:00-17:00)
 * - Active days (Mon-Fri)
 * - Timezone (e.g., America/New_York)
 * - Break times (lunch, etc.)
 * - Batch processing windows (e.g., 2AM-4AM for heavy tasks)
 * - Office hours for availability
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Orchestrator work schedule configuration
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/schedule
 *
 * Response:
 * {
 *   "data": {
 *     "workHours": { "startHour": 9, "startMinute": 0, "endHour": 17, "endMinute": 0 },
 *     "activeDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
 *     "timezone": "America/New_York",
 *     "breakTimes": [{ "startHour": 12, "startMinute": 0, "endHour": 13, "endMinute": 0 }],
 *     "batchWindows": [{ "startHour": 2, "startMinute": 0, "endHour": 4, "endMinute": 0 }],
 *     "officeHours": { "startHour": 9, "startMinute": 0, "endHour": 17, "endMinute": 0 }
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
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(
      workspaceId,
      orchestratorId,
      session.user.id,
    );
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryResult = getWorkScheduleSchema.safeParse({
      detailed: searchParams.get('detailed'),
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

    const schedule = await getWorkSchedule(orchestratorId);

    // Return default schedule if none configured
    if (!schedule) {
      return NextResponse.json({
        data: {
          workHours: {
            startHour: 9,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          },
          activeDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          timezone: 'America/New_York',
          breakTimes: [],
          batchWindows: [],
          officeHours: {
            startHour: 9,
            startMinute: 0,
            endHour: 17,
            endMinute: 0,
          },
        },
        message: 'Using default schedule configuration',
      });
    }

    return NextResponse.json({ data: schedule });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule
 *
 * Update Orchestrator's work schedule configuration.
 * Requires authentication and admin/owner role in the Orchestrator's organization.
 *
 * @param request - Next.js request with schedule update data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Updated work schedule
 *
 * @example
 * ```
 * PATCH /api/workspaces/ws_123/orchestrators/orch_456/schedule
 * Content-Type: application/json
 *
 * {
 *   "workHours": { "startHour": 8, "startMinute": 0, "endHour": 16, "endMinute": 0 },
 *   "activeDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"],
 *   "timezone": "America/Los_Angeles"
 * }
 *
 * Response:
 * {
 *   "data": { ... updated schedule ... },
 *   "message": "Work schedule updated successfully"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const parseResult = updateWorkScheduleSchema.safeParse(body);
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

    const result = await checkVPAccess(
      workspaceId,
      orchestratorId,
      session.user.id,
    );
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to update Orchestrator schedule',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const updatedSchedule = await updateWorkSchedule(
      orchestratorId,
      parseResult.data,
    );

    return NextResponse.json({
      data: updatedSchedule,
      message: 'Work schedule updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:workspaceId/orchestrators/:orchestratorId/schedule] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
