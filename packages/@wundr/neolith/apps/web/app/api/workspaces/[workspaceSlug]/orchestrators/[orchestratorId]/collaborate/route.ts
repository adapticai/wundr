/**
 * OrchestratorCollaboration API Routes
 *
 * Manages collaboration requests between Orchestrators for joint task execution.
 * Allows Orchestrators to request, list, and end collaborations.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate - Request collaboration
 * - GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate - List active collaborations
 * - DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate - End collaboration
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/collaborate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  requestCollaboration,
  getCollaborativeTasks,
} from '@/lib/services/orchestrator-coordination-service';
import {
  collaborationRequestSchema,
  createCoordinationErrorResponse,
  ORCHESTRATOR_COORDINATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-coordination';

import type { VPCoordinationMetadata } from '@/lib/services/orchestrator-coordination-service';
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
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate
 *
 * Request collaboration with other Orchestrators on a task.
 *
 * @param request - Next.js request with collaboration data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Collaboration request result
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
    const { workspaceSlug: workspaceId, orchestratorId } = params;

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

    const { taskId, requiredOrchestratorIds, roles, note } = parseResult.data;

    // Verify Orchestrator exists and belongs to workspace
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: accessCheck.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      select: { id: true, role: true, discipline: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Orchestrator not found or not accessible',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Request collaboration using service
    const result = await requestCollaboration(orchestratorId, taskId, requiredOrchestratorIds, {
      roles,
      note,
    });

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Collaboration request failed',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Fetch task details for notification
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });

    // Fetch collaborator user IDs for notifications
    const collaborators = await prisma.orchestrator.findMany({
      where: { id: { in: requiredOrchestratorIds } },
      select: { userId: true, role: true },
    });

    // Create notifications for all collaborators
    await Promise.all(
      collaborators.map((collaborator) =>
        prisma.notification.create({
          data: {
            userId: collaborator.userId,
            type: 'SYSTEM',
            title: 'Collaboration Request',
            body: `${orchestrator.role} has requested your collaboration on: ${task?.title || 'a task'}`,
            priority: 'NORMAL',
            resourceId: taskId,
            resourceType: 'task',
            metadata: {
              taskId,
              primaryVpId: orchestratorId,
              requestedAt: result.createdAt.toISOString(),
              note,
              role: roles?.[collaborator.userId],
              notificationType: 'COLLABORATION_REQUEST',
            },
            read: false,
          },
        }),
      ),
    );

    return NextResponse.json({
      data: result,
      message: 'Collaboration request created successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate
 *
 * List all active collaborations for a Orchestrator.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns List of collaborative tasks
 */
export async function GET(
  _request: NextRequest,
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
    const { workspaceSlug: workspaceId, orchestratorId } = params;

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

    // Verify Orchestrator exists
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: accessCheck.organizationId,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Orchestrator not found',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get collaborative tasks
    const collaborativeTasks = await getCollaborativeTasks(orchestratorId);

    // Format response with collaboration details
    const formattedTasks = collaborativeTasks.map((task) => {
      const metadata = task.metadata as VPCoordinationMetadata;
      const collaborators = metadata.collaborators || [];

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        primaryOrchestrator: task.orchestrator,
        workspace: task.workspace,
        collaborators: collaborators.map((c) => ({
          orchestratorId: c.orchestratorId,
          role: c.role,
          addedAt: c.addedAt,
        })),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });

    return NextResponse.json({
      data: formattedTasks,
      count: formattedTasks.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate
 *
 * End a collaboration by removing Orchestrator from collaborators list.
 *
 * @param request - Next.js request with taskId in query params
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Success message
 */
export async function DELETE(
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
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    // Get taskId from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task ID is required',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

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

    // Verify Orchestrator exists
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: accessCheck.organizationId,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Orchestrator not found',
          ORCHESTRATOR_COORDINATION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get task and remove Orchestrator from collaborators
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, metadata: true, title: true },
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

    const metadata = (task.metadata as VPCoordinationMetadata) || {};
    const collaborators = metadata.collaborators || [];

    // Remove Orchestrator from collaborators
    const updatedCollaborators = collaborators.filter((c) => c.orchestratorId !== orchestratorId);

    // Update task metadata
    await prisma.task.update({
      where: { id: taskId },
      data: {
        metadata: {
          ...metadata,
          collaborators: updatedCollaborators,
        } as never,
      },
    });

    return NextResponse.json({
      message: 'Collaboration ended successfully',
      data: {
        taskId,
        orchestratorId,
        removedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/orchestrators/:orchestratorId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
