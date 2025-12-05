/**
 * OrchestratorBacklog Item Route
 *
 * Handles GET, PATCH, and DELETE operations on specific backlog items.
 * Note: BacklogItem is a junction between Backlog and Task, so this route
 * primarily works with the underlying Task entity.
 *
 * Routes:
 * - GET /api/orchestrators/[id]/backlog/[itemId] - Get backlog item details
 * - PATCH /api/orchestrators/[id]/backlog/[itemId] - Update backlog item
 * - DELETE /api/orchestrators/[id]/backlog/[itemId] - Remove backlog item
 *
 * @module app/api/orchestrators/[id]/backlog/[itemId]/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  validateTaskDependencies,
  canTransitionToStatus,
} from '@/lib/services/task-service';
import {
  updateTaskSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { UpdateTaskInput } from '@/lib/validations/task';
import type { NextRequest } from 'next/server';

/**
 * GET /api/orchestrators/[id]/backlog/[itemId]
 *
 * Retrieve a specific backlog item with full task details, comments, and history.
 * This fetches the BacklogItem junction record along with the associated Task entity.
 *
 * @param request - Next.js request object
 * @param params - Route parameters (id = OrchestratorID, itemId = BacklogItem ID)
 * @returns Backlog item with task details
 *
 * @example
 * ```
 * GET /api/orchestrators/orch_123/backlog/backlog_item_456
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orchestratorId: string; itemId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get OrchestratorID and item ID from params
    const resolvedParams = await params;
    const orchestratorId = resolvedParams.orchestratorId;
    const itemId = resolvedParams.itemId;

    // Validate IDs
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    if (!itemId || itemId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid backlog item ID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify Orchestrator exists and get workspace
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check user has access to Orchestrator's workspace
    let workspaceMember = null;
    if (orchestrator.workspaceId) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: orchestrator.workspaceId,
          userId: session.user.id,
        },
      });

      if (!workspaceMember) {
        return NextResponse.json(
          createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Fetch backlog item with full task details
    const backlogItem = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      include: {
        backlog: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            orchestratorId: true,
          },
        },
        task: {
          include: {
            orchestrator: {
              select: {
                id: true,
                role: true,
                discipline: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
            workspace: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            assignedTo: { select: { id: true, name: true, email: true } },
            channel: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!backlogItem) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item not found',
          TASK_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the backlog item belongs to the requested Orchestrator
    if (backlogItem.backlog.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item does not belong to this Orchestrator',
          TASK_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Fetch task history (using Task model's updatedAt as a proxy for history)
    // In a production system, you might have a separate TaskHistory or AuditLog model
    const taskHistory = {
      created: backlogItem.task.createdAt,
      lastUpdated: backlogItem.task.updatedAt,
      completed: backlogItem.task.completedAt,
    };

    // Return comprehensive backlog item details
    return NextResponse.json({
      data: {
        id: backlogItem.id,
        position: backlogItem.position,
        addedAt: backlogItem.addedAt,
        backlog: backlogItem.backlog,
        task: backlogItem.task,
        history: taskHistory,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/orchestrators/[id]/backlog/[itemId]] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/orchestrators/[id]/backlog/[itemId]
 *
 * Update a backlog item's underlying task. This allows updating task properties
 * like title, description, priority, status, and story points (estimatedHours).
 *
 * Request body (all fields optional):
 * {
 *   "title": "Updated title",
 *   "description": "Updated description",
 *   "priority": "HIGH",
 *   "status": "IN_PROGRESS",
 *   "estimatedHours": 8,
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "tags": ["updated", "tags"],
 *   "assignedToId": "user_456"
 * }
 *
 * @param request - Next.js request with update data
 * @param params - Route parameters (id = OrchestratorID, itemId = BacklogItem ID)
 * @returns Updated backlog item with task details
 *
 * @example
 * ```
 * PATCH /api/orchestrators/orch_123/backlog/backlog_item_456
 * Content-Type: application/json
 *
 * {
 *   "title": "Updated task title",
 *   "priority": "HIGH",
 *   "status": "IN_PROGRESS",
 *   "estimatedHours": 8
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orchestratorId: string; itemId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get OrchestratorID and item ID from params
    const resolvedParams = await params;
    const orchestratorId = resolvedParams.orchestratorId;
    const itemId = resolvedParams.itemId;

    // Validate IDs
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    if (!itemId || itemId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid backlog item ID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify Orchestrator exists and get workspace
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check user has access to Orchestrator's workspace
    let workspaceMember = null;
    if (orchestrator.workspaceId) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: orchestrator.workspaceId,
          userId: session.user.id,
        },
      });

      if (!workspaceMember) {
        return NextResponse.json(
          createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Fetch backlog item to get task ID
    const backlogItem = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        taskId: true,
        backlog: {
          select: { orchestratorId: true },
        },
      },
    });

    if (!backlogItem) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item not found',
          TASK_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the backlog item belongs to the requested Orchestrator
    if (backlogItem.backlog.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item does not belong to this Orchestrator',
          TASK_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get current task state
    const currentTask = await prisma.task.findUnique({
      where: { id: backlogItem.taskId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        dependsOn: true,
        assignedToId: true,
      },
    });

    if (!currentTask) {
      return NextResponse.json(
        createErrorResponse(
          'Associated task not found',
          TASK_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateTaskInput = parseResult.data;

    // Validate status transition if changing status
    if (input.status && input.status !== currentTask.status) {
      const canTransition = await canTransitionToStatus(
        currentTask.id,
        input.status,
      );
      if (!canTransition.allowed) {
        return NextResponse.json(
          createErrorResponse(
            canTransition.reason || 'Invalid status transition',
            TASK_ERROR_CODES.INVALID_STATE_TRANSITION,
          ),
          { status: 400 },
        );
      }
    }

    // Validate dependencies if changing
    if (
      input.dependsOn &&
      JSON.stringify(input.dependsOn) !== JSON.stringify(currentTask.dependsOn)
    ) {
      const depValidation = await validateTaskDependencies(
        currentTask.id,
        input.dependsOn,
        currentTask.workspaceId,
      );

      if (!depValidation.valid) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid task dependencies',
            TASK_ERROR_CODES.DEPENDENCY_VIOLATION,
            {
              circularDependencies: depValidation.circularDependencies,
              unresolvedDependencies: depValidation.unresolvedDependencies,
            },
          ),
          { status: 400 },
        );
      }
    }

    // Verify assignee if provided
    if (input.assignedToId !== undefined && input.assignedToId !== null) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true },
      });

      if (!assignee) {
        return NextResponse.json(
          createErrorResponse(
            'Assignee not found',
            TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    // Update the underlying task
    const updatedTask = await prisma.task.update({
      where: { id: currentTask.id },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.priority && { priority: input.priority }),
        ...(input.status && { status: input.status }),
        ...(input.estimatedHours !== undefined && {
          estimatedHours: input.estimatedHours,
        }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
        ...(input.tags && { tags: input.tags }),
        ...(input.dependsOn && { dependsOn: input.dependsOn }),
        ...(input.assignedToId !== undefined && {
          assignedToId: input.assignedToId,
        }),
        ...(input.metadata && {
          metadata: input.metadata as Prisma.InputJsonValue,
        }),
        // Auto-set completedAt when status changes to DONE
        ...(input.status === 'DONE' && { completedAt: new Date() }),
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            discipline: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    // Fetch updated backlog item
    const updatedBacklogItem = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      include: {
        backlog: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updatedBacklogItem!.id,
        position: updatedBacklogItem!.position,
        addedAt: updatedBacklogItem!.addedAt,
        backlog: updatedBacklogItem!.backlog,
        task: updatedTask,
      },
      message: 'Backlog item updated successfully',
    });
  } catch (error) {
    console.error(
      '[PATCH /api/orchestrators/[id]/backlog/[itemId]] Error:',
      error,
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Backlog item or task not found',
            TASK_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/orchestrators/[id]/backlog/[itemId]
 *
 * Remove a backlog item. This deletes the BacklogItem junction record,
 * effectively removing the task from the backlog. The underlying Task
 * entity is NOT deleted, only the backlog association is removed.
 *
 * @param request - Next.js request object
 * @param params - Route parameters (id = OrchestratorID, itemId = BacklogItem ID)
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/orchestrators/orch_123/backlog/backlog_item_456
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orchestratorId: string; itemId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get OrchestratorID and item ID from params
    const resolvedParams = await params;
    const orchestratorId = resolvedParams.orchestratorId;
    const itemId = resolvedParams.itemId;

    // Validate IDs
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    if (!itemId || itemId.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid backlog item ID',
          TASK_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify Orchestrator exists and get workspace
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check user has access to Orchestrator's workspace
    let workspaceMember = null;
    if (orchestrator.workspaceId) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: orchestrator.workspaceId,
          userId: session.user.id,
        },
      });

      if (!workspaceMember) {
        return NextResponse.json(
          createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Fetch backlog item to verify ownership
    const backlogItem = await prisma.backlogItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        backlog: {
          select: { orchestratorId: true },
        },
      },
    });

    if (!backlogItem) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item not found',
          TASK_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the backlog item belongs to the requested Orchestrator
    if (backlogItem.backlog.orchestratorId !== orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Backlog item does not belong to this Orchestrator',
          TASK_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete the backlog item (this removes the task from the backlog but preserves the task)
    await prisma.backlogItem.delete({ where: { id: itemId } });

    return NextResponse.json(
      {
        data: null,
        message:
          'Backlog item removed successfully. The underlying task has been preserved.',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      '[DELETE /api/orchestrators/[id]/backlog/[itemId]] Error:',
      error,
    );

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Backlog item not found',
            TASK_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
