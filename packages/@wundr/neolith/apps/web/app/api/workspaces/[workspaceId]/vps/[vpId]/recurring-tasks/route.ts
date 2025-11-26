/**
 * VP Recurring Tasks API Routes
 *
 * Handles VP's recurring task schedules (daily, weekly, monthly).
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks - List recurring tasks
 * - POST /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks - Create recurring task
 * - DELETE /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks - Remove recurring task
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/recurring-tasks/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getRecurringTasks,
  addRecurringTask,
  removeRecurringTask,
} from '@/lib/services/vp-scheduling-service';
import { createErrorResponse, VP_ERROR_CODES } from '@/lib/validations/vp';
import { createRecurringTaskSchema } from '@/lib/validations/vp-scheduling';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to check if user has access to a VP within a workspace
 */
async function checkVPAccess(workspaceId: string, vpId: string, userId: string) {
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

  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    select: { id: true, userId: true },
  });

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks
 *
 * List VP's recurring task schedules.
 *
 * Requires authentication and workspace access.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
 * @returns List of recurring tasks
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/recurring-tasks
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "title": "Daily standup summary",
 *       "description": "Summarize team activities",
 *       "frequency": "DAILY",
 *       "scheduledTime": { "hour": 9, "minute": 0 },
 *       "priority": "MEDIUM"
 *     },
 *     {
 *       "title": "Weekly report",
 *       "frequency": "WEEKLY",
 *       "dayOfWeek": "FRIDAY",
 *       "scheduledTime": { "hour": 16, "minute": 0 },
 *       "priority": "HIGH"
 *     }
 *   ]
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const recurringTasks = await getRecurringTasks(vpId);

    return NextResponse.json({
      data: recurringTasks,
      count: recurringTasks.length,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks
 *
 * Create a new recurring task schedule for the VP.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with recurring task data
 * @param context - Route context containing workspace and VP IDs
 * @returns Created recurring task
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps/vp_456/recurring-tasks
 * Content-Type: application/json
 *
 * {
 *   "title": "Monthly backup review",
 *   "description": "Review all backup processes",
 *   "frequency": "MONTHLY",
 *   "dayOfMonth": 1,
 *   "scheduledTime": { "hour": 2, "minute": 0 },
 *   "priority": "HIGH",
 *   "estimatedHours": 2
 * }
 *
 * Response:
 * {
 *   "data": { ... created task ... },
 *   "message": "Recurring task created successfully"
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = createRecurringTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to create recurring tasks',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const updatedTasks = await addRecurringTask(vpId, parseResult.data);

    return NextResponse.json(
      {
        data: parseResult.data,
        allTasks: updatedTasks,
        message: 'Recurring task created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks
 *
 * Remove a recurring task from VP's schedule.
 * Requires authentication and admin/owner role in the VP's organization.
 *
 * @param request - Next.js request with task index
 * @param context - Route context containing workspace and VP IDs
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/workspaces/ws_123/vps/vp_456/recurring-tasks?index=0
 *
 * Response:
 * {
 *   "message": "Recurring task removed successfully",
 *   "remainingTasks": [ ... ]
 * }
 * ```
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const result = await checkVPAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('VP not found or access denied', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check for admin/owner role
    if (result.role !== 'OWNER' && result.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to remove recurring tasks',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const indexParam = searchParams.get('index');

    if (!indexParam) {
      return NextResponse.json(
        createErrorResponse(
          'Task index is required (query param: index)',
          VP_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const taskIndex = parseInt(indexParam, 10);
    if (isNaN(taskIndex) || taskIndex < 0) {
      return NextResponse.json(
        createErrorResponse('Invalid task index', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    try {
      const remainingTasks = await removeRecurringTask(vpId, taskIndex);

      return NextResponse.json({
        message: 'Recurring task removed successfully',
        remainingTasks,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid task index') {
        return NextResponse.json(
          createErrorResponse('Task index out of range', VP_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
      throw error;
    }
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/vps/:vpId/recurring-tasks] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse('An internal error occurred', VP_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
