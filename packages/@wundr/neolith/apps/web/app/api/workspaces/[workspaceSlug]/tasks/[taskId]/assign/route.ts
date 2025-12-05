/**
 * Task Assignment API Routes
 *
 * Handles assigning tasks to Orchestrators or users.
 *
 * Routes:
 * - POST /api/workspaces/[workspaceId]/tasks/[taskId]/assign - Assign task to Orchestrator or user
 *
 * @module app/api/workspaces/[workspaceId]/tasks/[taskId]/assign/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';
import {
  getAssignmentHistory,
  type TaskMetadata,
} from '@/lib/types/task-metadata';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';
import {
  assignTaskSchema,
  BACKLOG_ERROR_CODES,
} from '@/lib/validations/task-backlog';

import type { AssignTaskInput } from '@/lib/validations/task-backlog';
import type { NextRequest } from 'next/server';

/**
 * POST /api/workspaces/[workspaceId]/tasks/[taskId]/assign
 *
 * Assign a task to an Orchestrator or user. Validates that the assignee exists and
 * is accessible within the workspace. Logs the assignment change.
 *
 * Request body:
 * {
 *   "assigneeId": "user_123",
 *   "assigneeType": "ORCHESTRATOR" | "USER",
 *   "notes": "Assignment reason",
 *   "metadata": { ... }
 * }
 *
 * @param request - Next.js request with assignment data
 * @param params - Route parameters (workspaceId, taskId)
 * @returns Updated task with assignment
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/tasks/task_456/assign
 * Content-Type: application/json
 *
 * {
 *   "assigneeId": "orch_789",
 *   "assigneeType": "ORCHESTRATOR",
 *   "notes": "Orchestrator has relevant expertise"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; taskId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BACKLOG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const { workspaceSlug: workspaceId, taskId } = resolvedParams;

    if (!workspaceId || !taskId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check user has access to workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          BACKLOG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify task exists and belongs to workspace
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
      },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        assignedToId: true,
        status: true,
        metadata: true,
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
        createErrorResponse(
          'Task not found in this workspace',
          BACKLOG_ERROR_CODES.TASK_NOT_FOUND,
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
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = assignTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: AssignTaskInput = parseResult.data;

    // Verify assignee exists and is valid
    let assigneeUserId: string;

    if (input.assigneeType === 'ORCHESTRATOR') {
      // Lookup Orchestrator and get their user ID
      const orchestrator = await prisma.orchestrator.findFirst({
        where: {
          id: input.assigneeId,
        },
        select: {
          id: true,
          userId: true,
          workspaceId: true,
          organizationId: true,
        },
      });

      if (!orchestrator) {
        return NextResponse.json(
          createErrorResponse(
            'Orchestrator not found',
            BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      // Orchestrator can be workspace-specific or organization-wide
      if (
        orchestrator.workspaceId &&
        orchestrator.workspaceId !== workspaceId
      ) {
        return NextResponse.json(
          createErrorResponse(
            'Orchestrator not found in this workspace',
            BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      assigneeUserId = orchestrator.userId;
    } else {
      // Verify user exists and is a member of the workspace
      const user = await prisma.user.findUnique({
        where: { id: input.assigneeId },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json(
          createErrorResponse(
            'User not found',
            TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      // Check if user is a workspace member
      const isMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: input.assigneeId,
        },
      });

      if (!isMember) {
        return NextResponse.json(
          createErrorResponse(
            'User is not a member of this workspace',
            BACKLOG_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }

      assigneeUserId = input.assigneeId;
    }

    // Store old assignee for logging
    const oldAssigneeId = task.assignedToId;
    const oldAssigneeName = task.assignedTo?.name || 'Unassigned';

    // Get existing metadata and assignment history
    const existingMetadata = (task.metadata || {}) as TaskMetadata;
    const existingAssignmentHistory = getAssignmentHistory(existingMetadata);

    // Build updated metadata with proper typing
    const updatedMetadata: TaskMetadata = {
      ...existingMetadata,
      assignmentHistory: [
        ...existingAssignmentHistory,
        {
          timestamp: new Date().toISOString(),
          fromUserId: oldAssigneeId,
          toUserId: assigneeUserId,
          assigneeType: input.assigneeType,
          assignedBy: session.user.id,
          notes: input.notes,
        },
      ],
      ...(input.metadata || {}),
    };

    // Update task assignment
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        assignedToId: assigneeUserId,
        metadata: updatedMetadata as unknown as Prisma.InputJsonValue,
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
        channel: { select: { id: true, name: true } },
      },
    });

    // Log the assignment change
    console.log(
      `[Task Assignment] Task ${taskId} reassigned from ${oldAssigneeName} to ${updatedTask.assignedTo?.name || 'Unknown'} by ${session.user.name || session.user.email}`,
    );

    // Send notification to the new assignee (if different from the assigner)
    if (assigneeUserId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, displayName: true },
      });
      const assignerName =
        currentUser?.displayName || currentUser?.name || 'Someone';

      // Use task title from original task query
      const taskTitle = task.title || `Task #${taskId.slice(-6)}`;

      NotificationService.notifyTaskAssigned(
        assigneeUserId,
        taskId,
        taskTitle,
        assignerName,
      ).catch((err: Error) => {
        console.error(
          '[POST /api/workspaces/[workspaceId]/tasks/[taskId]/assign] Failed to send task assignment notification:',
          err,
        );
      });
    }

    return NextResponse.json({
      data: updatedTask,
      message: `Task assigned to ${updatedTask.assignedTo?.name || 'user'} successfully`,
      metadata: {
        previousAssignee: oldAssigneeName,
        newAssignee: updatedTask.assignedTo?.name,
        assigneeType: input.assigneeType,
      },
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceId]/tasks/[taskId]/assign] Error:',
      error,
    );

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Task not found',
            BACKLOG_ERROR_CODES.TASK_NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BACKLOG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
