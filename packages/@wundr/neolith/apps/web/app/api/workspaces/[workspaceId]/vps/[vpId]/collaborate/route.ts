/**
 * VP Collaboration API Routes
 *
 * Manages collaboration requests between VPs for joint task execution.
 * Allows VPs to request, list, and end collaborations.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/collaborate - Request collaboration
 * - GET /api/workspaces/:workspaceId/vps/:vpId/collaborate - List active collaborations
 * - DELETE /api/workspaces/:workspaceId/vps/:vpId/collaborate - End collaboration
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/collaborate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  requestCollaboration,
  getCollaborativeTasks,
} from '@/lib/services/vp-coordination-service';
import {
  collaborationRequestSchema,
  createCoordinationErrorResponse,
  VP_COORDINATION_ERROR_CODES,
} from '@/lib/validations/vp-coordination';

import type { NextRequest } from 'next/server';
import type { VPCoordinationMetadata } from '@/lib/services/vp-coordination-service';

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
 * POST /api/workspaces/:workspaceId/vps/:vpId/collaborate
 *
 * Request collaboration with other VPs on a task.
 *
 * @param request - Next.js request with collaboration data
 * @param context - Route context containing workspace and VP IDs
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

    const { taskId, requiredVpIds, roles, note } = parseResult.data;

    // Verify VP exists and belongs to workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: accessCheck.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      select: { id: true, role: true, discipline: true, userId: true },
    });

    if (!vp) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'VP not found or not accessible',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Request collaboration using service
    const result = await requestCollaboration(vpId, taskId, requiredVpIds, {
      roles,
      note,
    });

    if (!result.success) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          result.error || 'Collaboration request failed',
          VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
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
    const collaborators = await prisma.vP.findMany({
      where: { id: { in: requiredVpIds } },
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
            body: `${vp.role} has requested your collaboration on: ${task?.title || 'a task'}`,
            priority: 'NORMAL',
            resourceId: taskId,
            resourceType: 'task',
            metadata: {
              taskId,
              primaryVpId: vpId,
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
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/collaborate
 *
 * List all active collaborations for a VP.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and VP IDs
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

    // Verify VP exists
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: accessCheck.organizationId,
      },
    });

    if (!vp) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'VP not found',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get collaborative tasks
    const collaborativeTasks = await getCollaborativeTasks(vpId);

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
        primaryVp: task.vp,
        workspace: task.workspace,
        collaborators: collaborators.map((c) => ({
          vpId: c.vpId,
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
    console.error('[GET /api/workspaces/:workspaceId/vps/:vpId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/vps/:vpId/collaborate
 *
 * End a collaboration by removing VP from collaborators list.
 *
 * @param request - Next.js request with taskId in query params
 * @param context - Route context containing workspace and VP IDs
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
          VP_COORDINATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, vpId } = params;

    // Get taskId from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'Task ID is required',
          VP_COORDINATION_ERROR_CODES.VALIDATION_ERROR,
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
          VP_COORDINATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify VP exists
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
        organizationId: accessCheck.organizationId,
      },
    });

    if (!vp) {
      return NextResponse.json(
        createCoordinationErrorResponse(
          'VP not found',
          VP_COORDINATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get task and remove VP from collaborators
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, metadata: true, title: true },
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

    const metadata = (task.metadata as VPCoordinationMetadata) || {};
    const collaborators = metadata.collaborators || [];

    // Remove VP from collaborators
    const updatedCollaborators = collaborators.filter((c) => c.vpId !== vpId);

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
        vpId,
        removedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/vps/:vpId/collaborate] Error:', error);
    return NextResponse.json(
      createCoordinationErrorResponse(
        'An internal error occurred',
        VP_COORDINATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
