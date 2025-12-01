/**
 * OrchestratorTask Delegation API Route
 *
 * Allows Orchestrators to delegate tasks to humans or other Orchestrators.
 * Creates task assignment, notifications, and optional channel messages.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/delegate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  delegateTaskSchema,
  createErrorResponse,
  ORCHESTRATOR_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-conversation';

import type { DelegateTaskInput } from '@/lib/validations/orchestrator-conversation';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate
 *
 * Orchestrator delegates a task to a human or another Orchestrator.
 * - Validates task is assigned to this Orchestrator
 * - Re-assigns task to target user
 * - Creates notification for assignee
 * - Optionally posts to channel
 * - Tracks delegation chain in metadata
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Delegation details and updated task
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user (Orchestrator service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = delegateTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: DelegateTaskInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify Orchestrator exists and belongs to this workspace/organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: workspace.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify the authenticated user is the Orchestrator's user account
    if (orchestrator.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Unauthorized: You can only delegate tasks as your own Orchestrator',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify task exists and is assigned to this Orchestrator
    const task = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        orchestratorId: orchestratorId,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found or not assigned to this Orchestrator',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.TASK_NOT_ASSIGNED
        ),
        { status: 404 }
      );
    }

    // Verify target user exists and has workspace access
    const targetUser = await prisma.user.findFirst({
      where: {
        id: input.targetUserId,
        workspaceMembers: {
          some: {
            workspaceId,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        createErrorResponse(
          'Target user not found or does not have workspace access',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.USER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Build delegation chain
    const existingMetadata = (task.metadata as Record<string, unknown>) || {};
    const delegationChain = Array.isArray(existingMetadata.delegationChain)
      ? existingMetadata.delegationChain
      : [];

    delegationChain.push({
      from: orchestrator.user.id,
      fromName: orchestrator.user.name,
      to: targetUser.id,
      toName: targetUser.name,
      delegatedAt: new Date().toISOString(),
      note: input.note,
    });

    // Check if target user is an Orchestrator
    const targetOrchestrator = await prisma.orchestrator.findFirst({
      where: {
        userId: targetUser.id,
        organizationId: workspace.organizationId,
      },
      select: { id: true },
    });

    // Update task with new assignee
    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        assignedToId: targetUser.id,
        // Update orchestratorId only if target is an Orchestrator
        ...(targetOrchestrator && { orchestratorId: targetOrchestrator.id }),
        // Update priority if provided
        ...(input.priority && { priority: input.priority }),
        // Update due date if provided
        ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
        metadata: {
          ...existingMetadata,
          delegationChain,
          lastDelegation: {
            from: orchestrator.user.id,
            to: targetUser.id,
            at: new Date().toISOString(),
            note: input.note,
          },
          ...input.metadata,
        } as unknown as Prisma.InputJsonValue,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Create notification if enabled
    let notification = null;
    if (input.createNotification) {
      notification = await prisma.notification.create({
        data: {
          userId: targetUser.id,
          type: 'SYSTEM' as const,
          title: `Task Delegated: ${task.title}`,
          body:
            input.note ||
            `${orchestrator.user.name} has delegated a task to you`,
          priority:
            input.priority === 'CRITICAL'
              ? ('URGENT' as const)
              : ('NORMAL' as const),
          resourceId: task.id,
          resourceType: 'task',
          metadata: {
            taskId: task.id,
            delegatedBy: orchestrator.user.id,
            delegatedByName: orchestrator.user.name,
            priority: input.priority || task.priority,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Post to channel if provided
    let channelMessage = null;
    if (input.channelId) {
      const channel = await prisma.channel.findFirst({
        where: {
          id: input.channelId,
          workspaceId,
        },
      });

      if (channel) {
        channelMessage = await prisma.message.create({
          data: {
            content: `📋 **Task Delegated**\n\n**Task:** ${task.title}\n**From:** ${orchestrator.user.name}\n**To:** ${targetUser.name}\n${input.note ? `**Note:** ${input.note}` : ''}`,
            type: 'SYSTEM',
            channelId: channel.id,
            authorId: orchestrator.user.id,
            metadata: {
              taskId: task.id,
              delegation: true,
              targetUserId: targetUser.id,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          task: updatedTask,
          notification: notification
            ? {
                id: notification.id,
                userId: notification.userId,
                title: notification.title,
              }
            : null,
          channelMessage,
          delegationChainLength: delegationChain.length,
        },
        message: `Task delegated successfully to ${targetUser.name}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/delegate] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
