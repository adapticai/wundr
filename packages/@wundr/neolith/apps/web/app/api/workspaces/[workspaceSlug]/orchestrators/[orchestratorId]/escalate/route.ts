/**
 * OrchestratorTask Escalation API Route
 *
 * Allows Orchestrators to escalate blocked tasks to human supervisors.
 * Creates notifications and task handoff with full context.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/escalate
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/escalate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  escalateTaskSchema,
  createErrorResponse,
  ORCHESTRATOR_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-conversation';

import type { EscalateTaskInput } from '@/lib/validations/orchestrator-conversation';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/escalate
 *
 * Orchestrator escalates a blocked task to human supervisor.
 * - Validates task is assigned to this Orchestrator
 * - Updates task status to BLOCKED
 * - Creates notification for target users or workspace admins
 * - Optionally posts to channel
 * - Links original task with full context
 *
 * @param request - Next.js request with escalation data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Escalation details and created notifications
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
    const parseResult = escalateTaskSchema.safeParse(body);
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

    const input: EscalateTaskInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
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
          'Unauthorized: You can only escalate tasks as your own Orchestrator',
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
      include: {
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
          'Task not found or not assigned to this Orchestrator',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.TASK_NOT_ASSIGNED
        ),
        { status: 404 }
      );
    }

    // Determine escalation targets
    let targetUserIds: string[] = [];

    if (input.targetUserIds && input.targetUserIds.length > 0) {
      // Verify target users exist and have access to workspace
      const targetUsers = await prisma.user.findMany({
        where: {
          id: { in: input.targetUserIds },
          workspaceMembers: {
            some: {
              workspaceId,
            },
          },
        },
        select: { id: true },
      });

      if (targetUsers.length !== input.targetUserIds.length) {
        return NextResponse.json(
          createErrorResponse(
            'One or more target users not found or do not have workspace access',
            ORCHESTRATOR_CONVERSATION_ERROR_CODES.USER_NOT_FOUND
          ),
          { status: 404 }
        );
      }

      targetUserIds = targetUsers.map(u => u.id);
    } else {
      // Default to workspace admins/owners
      const workspaceAdmins = await prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          role: { in: ['ADMIN', 'OWNER'] },
        },
        select: {
          userId: true,
        },
      });

      if (workspaceAdmins.length === 0) {
        return NextResponse.json(
          createErrorResponse(
            'No workspace admins found to escalate to',
            ORCHESTRATOR_CONVERSATION_ERROR_CODES.USER_NOT_FOUND
          ),
          { status: 404 }
        );
      }

      targetUserIds = workspaceAdmins.map(admin => admin.userId);
    }

    // Use severity if provided, otherwise fallback to priority
    const severity = input.severity ?? input.priority;

    // Update task status to BLOCKED
    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: 'BLOCKED',
        metadata: {
          ...(task.metadata as Record<string, unknown>),
          escalation: {
            escalatedAt: new Date().toISOString(),
            escalatedBy: orchestrator.user.id,
            reason: input.reason,
            severity: severity,
            context: input.context,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Create notifications for target users
    const notifications = await Promise.all(
      targetUserIds.map(userId =>
        prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM' as const,
            title: `Task Escalation: ${task.title}`,
            body: input.reason,
            priority:
              severity === 'critical' ? ('URGENT' as const) : ('HIGH' as const),
            resourceId: task.id,
            resourceType: 'task',
            metadata: {
              taskId: task.id,
              orchestratorId,
              orchestratorName: orchestrator.user.name,
              severity: severity,
              context: input.context,
            } as unknown as Prisma.InputJsonValue,
          },
        })
      )
    );

    // If channel ID provided, post escalation message to channel
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
            content: `⚠️ **Task Escalation** (${severity.toUpperCase()})\n\n**Task:** ${task.title}\n**Reason:** ${input.reason}\n\nTask has been escalated for review.`,
            type: 'SYSTEM',
            channelId: channel.id,
            authorId: orchestrator.user.id,
            metadata: {
              taskId: task.id,
              escalation: true,
              severity: severity,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          task: updatedTask,
          notifications: notifications.map(n => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
          })),
          channelMessage,
          escalatedTo: targetUserIds,
        },
        message: `Task escalated successfully to ${targetUserIds.length} user(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/escalate] Error:',
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
