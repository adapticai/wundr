/**
 * OrchestratorDelegation API Routes
 *
 * Allows a Orchestrator to delegate tasks to another Orchestrator within the same workspace/organization.
 * Validates Orchestrator compatibility and creates delegation tracking chain.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate-orchestrator - Delegate task to another Orchestrator
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/delegate-orchestrator/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { delegateTask } from '@/lib/services/orchestrator-coordination-service';
import {
  delegateTaskSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; orchestratorId: string }>;
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
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate-orchestrator
 *
 * Delegate a task from the current Orchestrator to another Orchestrator.
 *
 * Workflow:
 * 1. Validate user has workspace access
 * 2. Verify both Orchestrators exist and belong to same organization
 * 3. Check Orchestrator compatibility (discipline/capability alignment)
 * 4. Create delegation record and update task ownership
 * 5. Notify target Orchestrator
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing workspace and OrchestratorIDs
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
          ORCHESTRATOR_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, orchestratorId } = params;

    // Validate workspace access
    const accessCheck = await verifyWorkspaceAccess(workspaceId, session.user.id);
    if (!accessCheck.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          accessCheck.error || 'Access denied',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.FORBIDDEN,
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

    const { toOrchestratorId, taskId, note, priority, dueDate } = parseResult.data;

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
        capabilities: true,
        organizationId: true,
      },
    });

    if (!sourceOrchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Source Orchestrator not found or not accessible',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
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
        capabilities: true,
        status: true,
        userId: true,
      },
    });

    if (!targetOrchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target Orchestrator not found or not in same organization',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if target Orchestrator is available (not OFFLINE)
    if (targetOrchestrator.status === 'OFFLINE') {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Target Orchestrator is currently offline',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
          { targetOrchestratorStatus: targetOrchestrator.status },
        ),
        { status: 400 },
      );
    }

    // Verify task exists and belongs to source Orchestrator
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        orchestratorId: true,
        title: true,
        workspaceId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task not found',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.TASK_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (task.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task does not belong to source Orchestrator',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.INVALID_OWNERSHIP,
        ),
        { status: 403 },
      );
    }

    // Delegate task using service
    const result = await delegateTask(orchestratorId, toOrchestratorId, taskId, {
      note,
      priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Delegation failed',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Create notification for target Orchestrator
    await prisma.notification.create({
      data: {
        userId: targetOrchestrator.userId,
        type: 'SYSTEM',
        title: 'New Task Delegated',
        body: `You have been delegated task: ${task.title}`,
        priority: 'NORMAL',
        resourceId: taskId,
        resourceType: 'task',
        metadata: {
          taskId,
          fromOrchestratorId: orchestratorId,
          toOrchestratorId: toOrchestratorId,
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
        fromOrchestratorId: result.fromOrchestratorId,
        toOrchestratorId: result.toOrchestratorId,
        delegatedAt: result.delegatedAt,
        message: result.message,
        compatibility: {
          sourceDiscipline: sourceOrchestrator.discipline,
          targetDiscipline: targetOrchestrator.discipline,
          sourceRole: sourceOrchestrator.role,
          targetRole: targetOrchestrator.role,
        },
      },
      message: 'Task delegated successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate-orchestrator] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
