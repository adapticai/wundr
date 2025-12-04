/**
 * Task Assignment Route
 *
 * Handles assigning tasks from humans to Orchestrators or from Orchestrator to Orchestrator.
 *
 * Routes:
 * - POST /api/tasks/assign - Assign one or more tasks to a user
 *
 * @module app/api/tasks/assign/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';
import {
  createErrorResponse,
  TASK_ERROR_CODES,
  taskAssignmentSchema,
} from '@/lib/validations/task';

import type { TaskAssignmentInput } from '@/lib/validations/task';
import type { NextRequest } from 'next/server';

/**
 * POST /api/tasks/assign
 *
 * Assign one or more tasks to a user (human or Orchestrator).
 * Supports both human-to-Orchestrator assignment and Orchestrator-to-Orchestrator assignment.
 *
 * Request body:
 * {
 *   "taskIds": ["task_123", "task_456"],
 *   "assigneeId": "user_789",
 *   "reason": "Reassigning based on capacity",
 *   "metadata": { "priority": "urgent" }
 * }
 *
 * @param request - Next.js request with assignment data
 * @returns Assignment result with success/failure details
 *
 * @example
 * ```
 * POST /api/tasks/assign
 * Content-Type: application/json
 *
 * {
 *   "taskIds": ["task_123", "task_456"],
 *   "assigneeId": "orchestrator_789",
 *   "reason": "Orchestrator has capacity for these tasks"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const parseResult = taskAssignmentSchema.safeParse(body);
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

    const input: TaskAssignmentInput = parseResult.data;

    // Verify assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, isOrchestrator: true },
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

    // Fetch all tasks to verify access and get workspace info
    const tasks = await prisma.task.findMany({
      where: { id: { in: input.taskIds } },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (tasks.length === 0) {
      return NextResponse.json(
        createErrorResponse('No valid tasks found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Get unique workspace IDs
    const workspaceIds = [...new Set(tasks.map(t => t.workspaceId))];

    // Check user has access to all workspaces
    const membershipCount = await prisma.workspaceMember.count({
      where: {
        userId: session.user.id,
        workspaceId: { in: workspaceIds },
      },
    });

    if (membershipCount !== workspaceIds.length) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to one or more workspaces',
          TASK_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Check if not found tasks exist
    const foundTaskIds = tasks.map(t => t.id);
    const notFoundIds = input.taskIds.filter(
      (id: string) => !foundTaskIds.includes(id)
    );

    // Assign tasks in a transaction
    const assignedTasks = await prisma.$transaction(async tx => {
      const results = [];

      for (const taskId of foundTaskIds) {
        try {
          // Fetch current metadata
          const currentTask = await tx.task.findUnique({
            where: { id: taskId },
            select: { metadata: true },
          });

          const currentMetadata = currentTask?.metadata as Record<
            string,
            unknown
          > | null;

          const updated = await tx.task.update({
            where: { id: taskId },
            data: {
              assignedToId: input.assigneeId,
              metadata: {
                ...(currentMetadata || {}),
                ...(input.metadata || {}),
                ...(input.reason && { assignmentReason: input.reason }),
                lastAssignedAt: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  isOrchestrator: true,
                },
              },
            },
          });

          results.push({
            taskId,
            success: true,
            data: updated,
          });
        } catch (error) {
          results.push({
            taskId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    });

    // Determine overall success
    const successCount = assignedTasks.filter(r => r.success).length;
    const failureCount = assignedTasks.filter(r => !r.success).length;

    // Send notifications to the assignee for each successfully assigned task (if different from assigner)
    if (input.assigneeId !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, displayName: true },
      });
      const assignerName =
        currentUser?.displayName || currentUser?.name || 'Someone';

      // Send notifications for successfully assigned tasks
      for (const result of assignedTasks.filter(r => r.success)) {
        const taskData = result.data as { title?: string } | undefined;
        const taskTitle = taskData?.title || `Task #${result.taskId.slice(-6)}`;
        NotificationService.notifyTaskAssigned(
          input.assigneeId,
          result.taskId,
          taskTitle,
          assignerName
        ).catch((err: Error) => {
          console.error(
            `[POST /api/tasks/assign] Failed to send notification for task ${result.taskId}:`,
            err
          );
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          assigned: assignedTasks.filter(r => r.success),
          failed: assignedTasks.filter(r => !r.success),
          notFound: notFoundIds,
        },
        summary: {
          total: input.taskIds.length,
          successful: successCount,
          failed: failureCount,
          notFound: notFoundIds.length,
        },
        message:
          failureCount > 0 || notFoundIds.length > 0
            ? 'Partial assignment completed'
            : 'All tasks assigned successfully',
      },
      {
        status: failureCount > 0 || notFoundIds.length > 0 ? 207 : 200,
      }
    );
  } catch (error) {
    console.error('[POST /api/tasks/assign] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'One or more tasks not found',
            TASK_ERROR_CODES.NOT_FOUND
          ),
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
