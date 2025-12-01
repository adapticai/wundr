/**
 * Task Completion API Routes
 *
 * Handles marking tasks as complete with results, notes, and artifacts.
 * Triggers workflow webhooks and posts status updates to channels.
 *
 * Routes:
 * - POST /api/workspaces/[workspaceId]/tasks/[taskId]/complete - Mark task as complete
 *
 * @module app/api/workspaces/[workspaceId]/tasks/[taskId]/complete/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createErrorResponse } from '@/lib/validations/task';

import type { CompleteTaskInput } from '@/lib/validations/task-backlog';
import {
  BACKLOG_ERROR_CODES,
  completeTaskSchema,
} from '@/lib/validations/task-backlog';

/**
 * POST /api/workspaces/[workspaceId]/tasks/[taskId]/complete
 *
 * Mark a task as complete (DONE status). Records completion time, results,
 * and artifacts. If completed by an Orchestrator, posts status to assigned channel.
 * Triggers any configured workflow webhooks.
 *
 * Request body:
 * {
 *   "result": { ... },
 *   "notes": "Completion notes",
 *   "artifacts": ["file_id_1", "url_1"],
 *   "metadata": { ... }
 * }
 *
 * @param request - Next.js request with completion data
 * @param params - Route parameters (workspaceId, taskId)
 * @returns Updated task with completion data
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/tasks/task_456/complete
 * Content-Type: application/json
 *
 * {
 *   "notes": "Successfully implemented authentication",
 *   "artifacts": ["https://github.com/repo/pull/123"]
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string; taskId: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user (can be Orchestrator or human)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          BACKLOG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const { workspaceSlug: workspaceId, taskId } = resolvedParams;

    if (!workspaceId || !taskId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        channelId: true,
        status: true,
        orchestratorId: true,
        assignedToId: true,
        completedAt: true,
        orchestrator: {
          select: {
            id: true,
            role: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            isOrchestrator: true,
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

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found in this workspace',
          BACKLOG_ERROR_CODES.TASK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if task is already completed
    if (task.status === 'DONE') {
      return NextResponse.json(
        createErrorResponse(
          'Task is already completed',
          BACKLOG_ERROR_CODES.ALREADY_COMPLETED
        ),
        { status: 400 }
      );
    }

    // Check if task is cancelled
    if (task.status === 'CANCELLED') {
      return NextResponse.json(
        createErrorResponse(
          'Cannot complete a cancelled task',
          BACKLOG_ERROR_CODES.INVALID_STATE
        ),
        { status: 400 }
      );
    }

    // Verify user has permission to complete the task
    const isAssignee = task.assignedToId === session.user.id;
    const isOrchestratorUser = task.orchestrator.userId === session.user.id;

    // Check if user is a workspace member
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!isAssignee && !isOrchestratorUser && !workspaceMember) {
      return NextResponse.json(
        createErrorResponse(
          'You do not have permission to complete this task',
          BACKLOG_ERROR_CODES.FORBIDDEN
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
        createErrorResponse(
          'Invalid JSON body',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = completeTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: CompleteTaskInput = parseResult.data;

    const completedAt = new Date();

    // Update task to DONE status
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'DONE',
        completedAt,
        metadata: {
          ...(task as any).metadata,
          completion: {
            completedBy: session.user.id,
            completedAt: completedAt.toISOString(),
            result: input.result,
            notes: input.notes,
            artifacts: input.artifacts,
            ...input.metadata,
          },
        } as Prisma.InputJsonValue,
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

    // Log completion
    console.log(
      `[Task Completion] Task ${taskId} "${task.title}" completed by ${session.user.name || session.user.email}`
    );

    // If Orchestrator completed the task and there's a channel, post status message
    if (task.assignedTo?.isOrchestrator && task.channelId) {
      try {
        await prisma.message.create({
          data: {
            content: `Task completed: **${task.title}**${input.notes ? `\n\n${input.notes}` : ''}${input.artifacts.length > 0 ? `\n\nArtifacts:\n${input.artifacts.map(a => `- ${a}`).join('\n')}` : ''}`,
            type: 'SYSTEM',
            channelId: task.channelId,
            authorId: task.orchestrator.userId,
            metadata: {
              taskId: task.id,
              eventType: 'task_completed',
              completedAt: completedAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        console.error(
          '[Task Completion] Failed to post channel message:',
          error
        );
        // Don't fail the completion if channel message fails
      }
    }

    // Trigger workflow webhooks
    try {
      const webhooks = await prisma.webhook.findMany({
        where: {
          workspaceId,
          status: 'ACTIVE',
          events: {
            has: 'task.completed',
          },
        },
      });

      if (webhooks.length > 0) {
        // Queue webhook deliveries
        const deliveries = webhooks.map(webhook => ({
          webhookId: webhook.id,
          event: 'task.completed',
          payload: {
            task: {
              id: updatedTask.id,
              title: updatedTask.title,
              status: updatedTask.status,
              completedAt: completedAt.toISOString(),
              completedBy: session.user.id,
              orchestratorId: task.orchestratorId,
              workspaceId,
            },
            completion: input,
          } as Prisma.InputJsonValue,
          status: 'PENDING' as const,
          attemptCount: 0,
        }));

        await prisma.webhookDelivery.createMany({
          data: deliveries,
        });

        console.log(
          `[Task Completion] Queued ${webhooks.length} webhook deliveries`
        );
      }
    } catch (error) {
      console.error('[Task Completion] Failed to queue webhooks:', error);
      // Don't fail the completion if webhook queueing fails
    }

    return NextResponse.json({
      data: updatedTask,
      message: 'Task marked as complete successfully',
      metadata: {
        completedAt: completedAt.toISOString(),
        completedBy: session.user.name || session.user.email,
        artifactCount: input.artifacts.length,
        channelNotified: !!task.channelId && !!task.assignedTo?.isOrchestrator,
      },
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceId]/tasks/[taskId]/complete] Error:',
      error
    );

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Task not found',
            BACKLOG_ERROR_CODES.TASK_NOT_FOUND
          ),
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BACKLOG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
