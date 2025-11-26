/**
 * VP Task Handoff API Routes
 *
 * Handles complete task transfer from one VP to another with context sharing.
 * Includes memory transfer and creates comprehensive audit trail.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/handoff - Handoff task to another VP
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/handoff/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { handoffTask } from '@/lib/services/vp-coordination-service';
import {
  handoffTaskSchema,
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
 * POST /api/workspaces/:workspaceId/vps/:vpId/handoff
 *
 * Handoff a task from the current VP to another VP with full context transfer.
 *
 * Workflow:
 * 1. Validate user has workspace access
 * 2. Verify both VPs exist and belong to same organization
 * 3. Verify task ownership
 * 4. Transfer task with context and memory
 * 5. Create comprehensive audit trail
 * 6. Notify target VP with context
 *
 * @param request - Next.js request with handoff data
 * @param context - Route context containing workspace and VP IDs
 * @returns Handoff result with transfer details
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

    const { toVpId, taskId, context: handoffContext, notes } = parseResult.data;

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
        userId: true,
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

    // Check if target VP is available
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
        description: true,
        status: true,
        priority: true,
        workspaceId: true,
        metadata: true,
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

    // Prepare handoff context with task state and memory
    const fullHandoffContext = {
      ...handoffContext,
      taskState: {
        status: task.status,
        priority: task.priority,
        currentMetadata: task.metadata,
      },
      handoffNotes: notes,
      handoffInitiatedBy: session.user.id,
    };

    // Execute handoff using service
    const result = await handoffTask(vpId, toVpId, taskId, fullHandoffContext);

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Handoff failed',
          VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Create notification for target VP with full context
    await prisma.notification.create({
      data: {
        userId: targetVP.userId,
        type: 'SYSTEM',
        title: 'Task Handed Off to You',
        body: `${sourceVP.role} has handed off task: ${task.title}`,
        priority: 'HIGH',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromVpId: vpId,
          toVpId,
          handoffAt: result.handoffAt.toISOString(),
          context: fullHandoffContext,
          notes,
          notificationType: 'TASK_HANDOFF',
          action: 'TASK_HANDOFF',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
        },
        read: false,
      },
    });

    // Create notification for source VP confirming handoff
    await prisma.notification.create({
      data: {
        userId: sourceVP.userId,
        type: 'SYSTEM',
        title: 'Task Handoff Complete',
        body: `Task "${task.title}" successfully handed off to ${targetVP.role}`,
        priority: 'NORMAL',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromVpId: vpId,
          toVpId,
          handoffAt: result.handoffAt.toISOString(),
          notificationType: 'TASK_HANDOFF_COMPLETE',
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
        context: result.context,
        handoffAt: result.handoffAt,
        message: result.message,
        auditTrail: {
          sourceVp: {
            id: sourceVP.id,
            role: sourceVP.role,
            discipline: sourceVP.discipline,
          },
          targetVp: {
            id: targetVP.id,
            role: targetVP.role,
            discipline: targetVP.discipline,
          },
          taskSnapshot: {
            title: task.title,
            status: task.status,
            priority: task.priority,
          },
        },
      },
      message: 'Task handed off successfully with full context transfer',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/handoff] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
