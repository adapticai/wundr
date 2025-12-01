/**
 * OrchestratorTask Handoff API Routes
 *
 * Handles complete task transfer from one Orchestrator to another with context sharing.
 * Includes memory transfer and creates comprehensive audit trail.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/handoff - Handoff task to another Orchestrator
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/handoff/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { handoffTask } from '@/lib/services/orchestrator-coordination-service';
import {
  handoffTaskSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * Helper function to verify workspace access
 */
async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string
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
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/handoff
 *
 * Handoff a task from the current Orchestrator to another Orchestrator with full context transfer.
 *
 * Workflow:
 * 1. Validate user has workspace access
 * 2. Verify both Orchestrators exist and belong to same organization
 * 3. Verify task ownership
 * 4. Transfer task with context and memory
 * 5. Create comprehensive audit trail
 * 6. Notify target Orchestrator with context
 *
 * @param request - Next.js request with handoff data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Handoff result with transfer details
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Authentication required',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(
      workspaceId,
      session.user.id
    );
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = handoffTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Validation failed',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const {
      toOrchestratorId,
      taskId,
      context: handoffContext,
      notes,
    } = parseResult.data;

    // Verify source Orchestrator exists and belongs to workspace
    const sourceOrchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
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

    if (!sourceOrchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Source Orchestrator not found or not accessible',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify target Orchestrator exists and belongs to same organization
    const targetOrchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: toOrchestratorId,
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

    if (!targetOrchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target Orchestrator not found or not in same organization',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if target Orchestrator is available
    if (targetOrchestrator.status === 'OFFLINE') {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target Orchestrator is currently offline',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { targetOrchestratorStatus: targetOrchestrator.status }
        ),
        { status: 400 }
      );
    }

    // Verify task exists and belongs to source Orchestrator
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        orchestratorId: true,
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.TASK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (task.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task does not belong to source Orchestrator',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP
        ),
        { status: 403 }
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
    const result = await handoffTask(
      orchestratorId,
      toOrchestratorId,
      taskId,
      fullHandoffContext
    );

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Handoff failed',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR
        ),
        { status: 500 }
      );
    }

    // Create notification for target Orchestrator with full context
    await prisma.notification.create({
      data: {
        userId: targetOrchestrator.userId,
        type: 'SYSTEM',
        title: 'Task Handed Off to You',
        body: `${sourceOrchestrator.role} has handed off task: ${task.title}`,
        priority: 'HIGH',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromVpId: orchestratorId,
          toVpId: toOrchestratorId,
          handoffAt:
            result.handoffAt?.toISOString() ?? new Date().toISOString(),
          context: fullHandoffContext,
          notes,
          notificationType: 'TASK_HANDOFF',
          action: 'TASK_HANDOFF',
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
        },
        read: false,
      },
    });

    // Create notification for source Orchestrator confirming handoff
    await prisma.notification.create({
      data: {
        userId: sourceOrchestrator.userId,
        type: 'SYSTEM',
        title: 'Task Handoff Complete',
        body: `Task "${task.title}" successfully handed off to ${targetOrchestrator.role}`,
        priority: 'NORMAL',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromVpId: orchestratorId,
          toVpId: toOrchestratorId,
          handoffAt:
            result.handoffAt?.toISOString() ?? new Date().toISOString(),
          notificationType: 'TASK_HANDOFF_COMPLETE',
        },
        read: false,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        taskId: result.taskId,
        fromOrchestratorId: result.fromOrchestratorId,
        toOrchestratorId: result.toOrchestratorId,
        context: result.context,
        handoffAt: result.handoffAt,
        message: result.message,
        auditTrail: {
          sourceOrchestrator: {
            id: sourceOrchestrator.id,
            role: sourceOrchestrator.role,
            discipline: sourceOrchestrator.discipline,
          },
          targetOrchestrator: {
            id: targetOrchestrator.id,
            role: targetOrchestrator.role,
            discipline: targetOrchestrator.discipline,
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
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/handoff] Error:',
      error
    );
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
