/**
 * Task Status Update API Route
 *
 * Updates task status with validation and state transition checks.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceId/tasks/:taskId/status - Update task status
 *
 * @module app/api/workspaces/[workspaceId]/tasks/[taskId]/status/route
 */

import { prisma } from '@neolith/database';
import type { Prisma, TaskStatus } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  blockTaskAfterMaxRetries,
  recordTaskFailure,
} from '@/lib/services/task-retry-service';
import { canTransitionToStatus } from '@/lib/services/task-service';
import {
  createErrorResponse,
  isValidStatusTransition,
  updateTaskStatusSchema,
  WORK_SESSION_ERROR_CODES,
} from '@/lib/validations/work-session';

/**
 * Route context with path parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    taskId: string;
  }>;
}

/**
 * PATCH /api/workspaces/:workspaceId/tasks/:taskId/status
 *
 * Update task status with validation.
 * Enforces valid state transitions and handles completion logic.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and task IDs
 * @returns Updated task
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (or Orchestrator daemon)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORK_SESSION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, taskId } = params;

    // Parse request body
    const body = await request.json();
    const validationResult = updateTaskStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse('Validation error', WORK_SESSION_ERROR_CODES.VALIDATION_ERROR, {
          errors: validationResult.error.errors,
        }),
        { status: 400 },
      );
    }

    const { status, result, notes, metadata } = validationResult.data;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORK_SESSION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Get current task
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', WORK_SESSION_ERROR_CODES.TASK_NOT_FOUND),
        { status: 404 },
      );
    }

    // Validate state transition
    if (!isValidStatusTransition(task.status, status)) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid state transition from ${task.status} to ${status}`,
          WORK_SESSION_ERROR_CODES.INVALID_STATE_TRANSITION,
          {
            currentStatus: task.status,
            requestedStatus: status,
          },
        ),
        { status: 400 },
      );
    }

    // Check if transition is allowed based on dependencies
    const canTransition = await canTransitionToStatus(taskId, status as TaskStatus);
    if (!canTransition.allowed) {
      return NextResponse.json(
        createErrorResponse(
          canTransition.reason || 'Cannot transition to this status',
          WORK_SESSION_ERROR_CODES.INVALID_STATE_TRANSITION,
          {
            currentStatus: task.status,
            requestedStatus: status,
            reason: canTransition.reason,
          },
        ),
        { status: 400 },
      );
    }

    // Prepare update data
    const currentMetadata = (task.metadata as Prisma.JsonObject) || {};
    const updateData: Prisma.taskUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    // Handle DONE status
    if (status === 'DONE') {
      updateData.completedAt = new Date();

      // Store result in metadata if provided
      if (result) {
        updateData.metadata = {
          ...currentMetadata,
          result,
          completedAt: new Date().toISOString(),
          progress: 100,
        } as Prisma.JsonObject;
      }
    }

    // Handle BLOCKED status - record failure for retry logic
    if (status === 'BLOCKED' && task.status === 'IN_PROGRESS') {
      const errorMessage = notes || 'Task blocked during execution';
      const retryInfo = await recordTaskFailure(taskId, errorMessage);

      // Update metadata with retry information
      updateData.metadata = {
        ...currentMetadata,
        ...(metadata && metadata),
        blockedReason: errorMessage,
        blockedAt: new Date().toISOString(),
        retryInfo: {
          shouldRetry: retryInfo.shouldRetry,
          retryCount: retryInfo.retryCount,
          nextRetryAt: retryInfo.nextRetryAt?.toISOString(),
        },
      } as Prisma.JsonObject;

      // If max retries exceeded, keep blocked status
      if (!retryInfo.shouldRetry) {
        await blockTaskAfterMaxRetries(taskId, errorMessage);
      }
    }

    // Handle notes
    if (notes && !updateData.metadata) {
      updateData.metadata = {
        ...currentMetadata,
        statusNotes: notes,
        statusUpdatedAt: new Date().toISOString(),
      } as Prisma.JsonObject;
    }

    // Apply additional metadata
    if (metadata && !updateData.metadata) {
      updateData.metadata = {
        ...currentMetadata,
        ...metadata,
      } as Prisma.JsonObject;
    }

    // Update the task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
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
      },
    });

    return NextResponse.json({
      message: 'Task status updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORK_SESSION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
