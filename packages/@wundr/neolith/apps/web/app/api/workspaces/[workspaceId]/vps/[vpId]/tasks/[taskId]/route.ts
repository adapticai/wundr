/**
 * VP Task Detail Route
 *
 * Individual task operations for VP autonomous operation management.
 * Provides detailed task retrieval, updates, and deletion.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId] - Get task details
 * - PATCH /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId] - Update task
 * - DELETE /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId] - Delete/cancel task
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateTaskSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Extended task details including subtasks, comments, and time tracking
 */
interface TaskDetails {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  estimatedHours: number | null;
  tags: string[];
  metadata: Prisma.JsonValue;
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  vp: {
    id: string;
    discipline: string;
    role: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  } | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  // Computed fields
  subtasks?: {
    id: string;
    title: string;
    status: string;
    priority: string;
  }[];
  comments?: {
    id: string;
    content: string;
    authorId: string;
    authorName: string | null;
    createdAt: Date;
  }[];
  timeTracking?: {
    totalHoursSpent: number;
    percentComplete: number;
    remainingHours: number | null;
  };
}

/**
 * GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]
 *
 * Retrieve complete task details including:
 * - All task fields
 * - Subtasks (tasks that depend on this task)
 * - Comments/logs from metadata
 * - Time tracking information
 * - Related entities (VP, workspace, channel, creator, assignee)
 *
 * @param request - Next.js request object
 * @param params - Route parameters (workspaceId, vpId, taskId)
 * @returns Complete task details with relations
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/tasks/task_789
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; vpId: string; taskId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get route params
    const resolvedParams = await params;
    const { workspaceId, vpId, taskId } = resolvedParams;

    // Validate IDs
    if (!workspaceId || !vpId || !taskId) {
      return NextResponse.json(
        createErrorResponse('Invalid route parameters', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify workspace access
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied to workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch task with all relations
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        vp: {
          select: {
            id: true,
            discipline: true,
            role: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task belongs to specified VP and workspace
    if (task.vpId !== vpId || task.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('Task does not belong to specified VP/workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Find subtasks (tasks that depend on this task)
    const subtasks = await prisma.task.findMany({
      where: {
        dependsOn: {
          has: taskId,
        },
        workspaceId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
      },
      orderBy: {
        priority: 'asc',
      },
    });

    // Extract comments from metadata
    const metadata = task.metadata as Record<string, unknown> | null;
    const comments = (metadata?.comments as Array<{
      id: string;
      content: string;
      authorId: string;
      authorName: string | null;
      createdAt: string;
    }>) || [];

    // Convert ISO strings back to Date objects
    const parsedComments = comments.map(comment => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
    }));

    // Calculate time tracking
    const hoursSpent = (metadata?.hoursSpent as number) || 0;
    const percentComplete = (metadata?.percentComplete as number) || 0;
    const remainingHours = task.estimatedHours
      ? Math.max(0, task.estimatedHours - hoursSpent)
      : null;

    const timeTracking = {
      totalHoursSpent: hoursSpent,
      percentComplete,
      remainingHours,
    };

    // Build response
    const taskDetails: TaskDetails = {
      ...task,
      subtasks,
      comments: parsedComments,
      timeTracking,
    };

    return NextResponse.json({
      data: taskDetails,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]
 *
 * Update task fields including:
 * - Status transitions (with validation)
 * - Progress updates
 * - Add comments/logs
 * - Update metadata
 * - Time tracking
 *
 * Request Body:
 * - title?: string
 * - description?: string
 * - priority?: TaskPriority
 * - status?: TaskStatus
 * - estimatedHours?: number
 * - dueDate?: string (ISO datetime)
 * - tags?: string[]
 * - dependsOn?: string[]
 * - assignedToId?: string
 * - metadata?: Record<string, unknown>
 * - comment?: string (adds a comment to metadata)
 * - progressUpdate?: { hoursSpent?: number, percentComplete?: number }
 *
 * @param request - Next.js request object
 * @param params - Route parameters (workspaceId, vpId, taskId)
 * @returns Updated task details
 *
 * @example
 * ```
 * PATCH /api/workspaces/ws_123/vps/vp_456/tasks/task_789
 * Body: {
 *   "status": "IN_PROGRESS",
 *   "comment": "Started working on this task",
 *   "progressUpdate": { "percentComplete": 25 }
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; vpId: string; taskId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get route params
    const resolvedParams = await params;
    const { workspaceId, vpId, taskId } = resolvedParams;

    // Validate IDs
    if (!workspaceId || !vpId || !taskId) {
      return NextResponse.json(
        createErrorResponse('Invalid route parameters', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify workspace access
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied to workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse request body
    const body = await request.json();

    // Extract special fields
    const { comment, progressUpdate, ...updateFields } = body;

    // Validate update fields
    const parseResult = updateTaskSchema.safeParse(updateFields);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid update data',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    // Fetch existing task
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task belongs to specified VP and workspace
    if (existingTask.vpId !== vpId || existingTask.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('Task does not belong to specified VP/workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Validate status transition if status is being updated
    if (parseResult.data.status) {
      const validTransitions: Record<string, string[]> = {
        TODO: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['BLOCKED', 'DONE', 'CANCELLED'],
        BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
        DONE: [], // Cannot transition from DONE
        CANCELLED: [], // Cannot transition from CANCELLED
      };

      const currentStatus = existingTask.status;
      const newStatus = parseResult.data.status;

      if (currentStatus !== newStatus) {
        const allowed = validTransitions[currentStatus] || [];
        if (!allowed.includes(newStatus)) {
          return NextResponse.json(
            createErrorResponse(
              `Invalid status transition from ${currentStatus} to ${newStatus}`,
              TASK_ERROR_CODES.INVALID_STATE_TRANSITION,
              { allowedTransitions: allowed },
            ),
            { status: 400 },
          );
        }
      }
    }

    // Validate assignee exists if being updated
    if (parseResult.data.assignedToId !== undefined && parseResult.data.assignedToId !== null) {
      const assignee = await prisma.user.findUnique({
        where: { id: parseResult.data.assignedToId },
      });

      if (!assignee) {
        return NextResponse.json(
          createErrorResponse('Assignee not found', TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND),
          { status: 404 },
        );
      }
    }

    // Build update data
    const existingMetadata = (existingTask.metadata as Record<string, unknown>) || {};
    let updatedMetadata = { ...existingMetadata };

    // Add comment if provided
    if (comment && typeof comment === 'string') {
      const comments = (existingMetadata.comments as Array<unknown>) || [];
      comments.push({
        id: `comment_${Date.now()}`,
        content: comment,
        authorId: session.user.id,
        authorName: session.user.name,
        createdAt: new Date().toISOString(),
      });
      updatedMetadata.comments = comments;
    }

    // Update progress tracking if provided
    if (progressUpdate) {
      if (typeof progressUpdate.hoursSpent === 'number') {
        updatedMetadata.hoursSpent = progressUpdate.hoursSpent;
      }
      if (typeof progressUpdate.percentComplete === 'number') {
        updatedMetadata.percentComplete = Math.max(0, Math.min(100, progressUpdate.percentComplete));
      }
    }

    // Merge custom metadata if provided
    if (parseResult.data.metadata) {
      updatedMetadata = { ...updatedMetadata, ...parseResult.data.metadata };
    }

    // Build update object
    const updateData: Prisma.taskUpdateInput = {
      ...parseResult.data,
      metadata: updatedMetadata as Prisma.InputJsonValue,
      // Set completedAt if transitioning to DONE
      ...(parseResult.data.status === 'DONE' && { completedAt: new Date() }),
    };

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        vp: {
          select: {
            id: true,
            discipline: true,
            role: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedTask,
      message: 'Task updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]
 *
 * Delete or cancel a task. By default, this sets the status to CANCELLED
 * to preserve task history. Use `?permanent=true` to permanently delete.
 *
 * Query Parameters:
 * - permanent: boolean (default false) - Permanently delete instead of cancelling
 * - reason: string - Optional reason for cancellation/deletion
 *
 * @param request - Next.js request object
 * @param params - Route parameters (workspaceId, vpId, taskId)
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/workspaces/ws_123/vps/vp_456/tasks/task_789?reason=Duplicate+task
 * DELETE /api/workspaces/ws_123/vps/vp_456/tasks/task_789?permanent=true
 * ```
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; vpId: string; taskId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get route params
    const resolvedParams = await params;
    const { workspaceId, vpId, taskId } = resolvedParams;

    // Validate IDs
    if (!workspaceId || !vpId || !taskId) {
      return NextResponse.json(
        createErrorResponse('Invalid route parameters', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const permanent = searchParams.get('permanent') === 'true';
    const reason = searchParams.get('reason') || undefined;

    // Verify workspace access (must be ADMIN or OWNER to delete)
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse('Access denied to workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Require ADMIN or OWNER role for permanent deletion
    if (permanent && !['ADMIN', 'OWNER'].includes(workspaceMember.role)) {
      return NextResponse.json(
        createErrorResponse('Only admins can permanently delete tasks', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Fetch task to verify it exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task belongs to specified VP and workspace
    if (task.vpId !== vpId || task.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('Task does not belong to specified VP/workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    if (permanent) {
      // Permanent deletion
      await prisma.task.delete({
        where: { id: taskId },
      });

      return NextResponse.json({
        message: 'Task permanently deleted',
        taskId,
      });
    } else {
      // Soft delete - cancel the task
      const existingMetadata = (task.metadata as Record<string, unknown>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        cancelledBy: session.user.id,
        cancelledAt: new Date().toISOString(),
        ...(reason && { cancellationReason: reason }),
      };

      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'CANCELLED',
          metadata: updatedMetadata,
        },
      });

      return NextResponse.json({
        message: 'Task cancelled successfully',
        taskId,
        reason: reason || null,
      });
    }
  } catch (error) {
    console.error('[DELETE /api/workspaces/[workspaceId]/vps/[vpId]/tasks/[taskId]] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
