/**
 * Individual Task Route
 *
 * Handles GET, PATCH (update), and DELETE operations on specific tasks.
 *
 * Routes:
 * - GET /api/tasks/[id] - Get a specific task
 * - PATCH /api/tasks/[id] - Update a task
 * - DELETE /api/tasks/[id] - Delete a task
 *
 * @module app/api/tasks/[id]/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  validateTaskDependencies,
  canTransitionToStatus,
} from '@/lib/services/task-service';
import {
  updateTaskSchema,
  taskIdParamSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { UpdateTaskInput } from '@/lib/validations/task';
import type { NextRequest } from 'next/server';

/**
 * GET /api/tasks/[id]
 *
 * Retrieve a specific task by ID with all relationships.
 *
 * @param request - Next.js request object
 * @param params - Route parameters (id)
 * @returns Task object with relationships
 *
 * @example
 * ```
 * GET /api/tasks/task_123
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const paramResult = taskIdParamSchema.safeParse(resolvedParams);

    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid task ID',
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { id } = paramResult.data;

    // Fetch task
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Check user has access to task's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: task.workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    console.error('[GET /api/tasks/[id]] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/[id]
 *
 * Update a specific task. Only allows updating fields relevant to task management.
 * Validates state transitions and dependencies.
 *
 * Request body (all fields optional):
 * {
 *   "title": "Updated title",
 *   "description": "Updated description",
 *   "priority": "HIGH",
 *   "status": "IN_PROGRESS",
 *   "estimatedHours": 10,
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "tags": ["updated", "tags"],
 *   "dependsOn": ["task_123"],
 *   "assignedToId": "user_456"
 * }
 *
 * @param request - Next.js request with update data
 * @param params - Route parameters (id)
 * @returns Updated task object
 *
 * @example
 * ```
 * PATCH /api/tasks/task_123
 * Content-Type: application/json
 *
 * {
 *   "status": "IN_PROGRESS",
 *   "priority": "HIGH"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const paramResult = taskIdParamSchema.safeParse(resolvedParams);

    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid task ID',
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { id } = paramResult.data;

    // Get current task
    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        dependsOn: true,
      },
    });

    if (!currentTask) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Check user has access to task's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: currentTask.workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 }
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
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateTaskInput = parseResult.data;

    // Validate status transition if changing status
    if (input.status && input.status !== currentTask.status) {
      const canTransition = await canTransitionToStatus(id, input.status);
      if (!canTransition.allowed) {
        return NextResponse.json(
          createErrorResponse(
            canTransition.reason || 'Invalid status transition',
            TASK_ERROR_CODES.INVALID_STATE_TRANSITION
          ),
          { status: 400 }
        );
      }
    }

    // Validate dependencies if changing
    if (input.dependsOn && input.dependsOn !== currentTask.dependsOn) {
      const depValidation = await validateTaskDependencies(
        id,
        input.dependsOn,
        currentTask.workspaceId
      );

      if (!depValidation.isValid) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid task dependencies',
            TASK_ERROR_CODES.DEPENDENCY_VIOLATION,
            {
              circularDependencies: depValidation.circularDependencies,
              unresolvedDependencies: depValidation.unresolvedDependencies,
            }
          ),
          { status: 400 }
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
            TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND
          ),
          { status: 404 }
        );
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
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
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      data: updatedTask,
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/tasks/[id]] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/[id]
 *
 * Delete a specific task. Only workspace members can delete tasks.
 * Soft delete is not implemented - task is permanently removed.
 *
 * @param request - Next.js request object
 * @param params - Route parameters (id)
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/tasks/task_123
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const paramResult = taskIdParamSchema.safeParse(resolvedParams);

    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid task ID',
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { id } = paramResult.data;

    // Fetch task to check workspace access
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, workspaceId: true },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Check user has access to task's workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: task.workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Delete task
    await prisma.task.delete({ where: { id } });

    return NextResponse.json(
      { data: null, message: 'Task deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/tasks/[id]] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
