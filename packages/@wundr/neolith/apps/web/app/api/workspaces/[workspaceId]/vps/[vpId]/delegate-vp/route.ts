/**
 * VP Delegation API Routes
 *
 * Allows a VP to delegate tasks to another VP within the same workspace/organization.
 * Validates VP compatibility and creates delegation tracking chain.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/delegate-vp - Delegate task to another VP
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/delegate-vp/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { delegateTask } from '@/lib/services/vp-coordination-service';
import {
  delegateTaskSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to verify workspace access
 */
async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<{ success: boolean; organizationId?: string; error?: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  });

  if (!workspace) {
    return { success: false, error: 'Workspace not found' };
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
    return { success: false, error: 'Access denied to workspace' };
  }

  return { success: true, organizationId: workspace.organizationId };
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/delegate-vp
 *
 * Delegate a task from the current VP to another VP.
 *
 * Workflow:
 * 1. Validate user has workspace access
 * 2. Verify both VPs exist and belong to same organization
 * 3. Check VP compatibility (discipline/capability alignment)
 * 4. Create delegation record and update task ownership
 * 5. Notify target VP
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing workspace and VP IDs
 * @returns Delegation result with tracking information
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

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          VP_COORDINATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
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

    const { toVpId, taskId, note, priority, dueDate } = parseResult.data;

    // Verify source VP exists and belongs to workspace
    const sourceVP = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: accessCheck.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      select: {
        id: true,
        discipline: true,
        role: true,
        capabilities: true,
        organizationId: true,
      },
    });

    if (!sourceVP) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Source VP not found or not accessible',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify target VP exists and belongs to same organization
    const targetVP = await prisma.vP.findFirst({
      where: {
        id: toVpId,
        organizationId: accessCheck.organizationId,
      },
      select: {
        id: true,
        discipline: true,
        role: true,
        capabilities: true,
        status: true,
        userId: true,
      },
    });

    if (!targetVP) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target VP not found or not in same organization',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if target VP is available (not OFFLINE)
    if (targetVP.status === 'OFFLINE') {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target VP is currently offline',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { targetVpStatus: targetVP.status },
        ),
        { status: 400 },
      );
    }

    // Verify task exists and belongs to source VP
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        vpId: true,
        title: true,
        workspaceId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task not found',
          VP_COORDINATION_ERROR_CODES.TASK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (task.vpId !== vpId) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task does not belong to source VP',
          VP_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP,
        ),
        { status: 403 },
      );
    }

    // Delegate task using service
    const result = await delegateTask(vpId, toVpId, taskId, {
      note,
      priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Delegation failed',
          VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Create notification for target VP
    await prisma.notification.create({
      data: {
        userId: targetVP.userId,
        type: 'SYSTEM',
        title: 'New Task Delegated',
        body: `You have been delegated task: ${task.title}`,
        priority: 'NORMAL',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromVpId: vpId,
          toVpId,
          delegatedAt: result.delegatedAt.toISOString(),
          note,
          notificationType: 'TASK_DELEGATED',
        },
        read: false,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        taskId: result.taskId,
        fromVpId: result.fromVpId,
        toVpId: result.toVpId,
        delegatedAt: result.delegatedAt,
        message: result.message,
        compatibility: {
          sourceDiscipline: sourceVP.discipline,
          targetDiscipline: targetVP.discipline,
          sourceRole: sourceVP.role,
          targetRole: targetVP.role,
        },
      },
      message: 'Task delegated successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/delegate-vp] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
