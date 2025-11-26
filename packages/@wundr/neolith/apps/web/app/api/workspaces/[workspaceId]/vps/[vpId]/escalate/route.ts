/**
 * VP Task Escalation API Route
 *
 * Allows VPs to escalate blocked tasks to human supervisors.
 * Creates notifications and task handoff with full context.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/escalate
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/escalate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  escalateTaskSchema,
  createErrorResponse,
  VP_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/vp-conversation';

import type { EscalateTaskInput } from '@/lib/validations/vp-conversation';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/escalate
 *
 * VP escalates a blocked task to human supervisor.
 * - Validates task is assigned to this VP
 * - Updates task status to BLOCKED
 * - Creates notification for target users or workspace admins
 * - Optionally posts to channel
 * - Links original task with full context
 *
 * @param request - Next.js request with escalation data
 * @param context - Route context containing workspace and VP IDs
 * @returns Escalation details and created notifications
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (VP service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          VP_CONVERSATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceId, vpId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
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
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = escalateTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: EscalateTaskInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          VP_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify VP exists and belongs to this workspace/organization
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
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

    if (!vp) {
      return NextResponse.json(
        createErrorResponse(
          'VP not found or access denied',
          VP_CONVERSATION_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the authenticated user is the VP's user account
    if (vp.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Unauthorized: You can only escalate tasks as your own VP',
          VP_CONVERSATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify task exists and is assigned to this VP
    const task = await prisma.task.findFirst({
      where: {
        id: input.taskId,
        vpId,
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
          'Task not found or not assigned to this VP',
          VP_CONVERSATION_ERROR_CODES.TASK_NOT_ASSIGNED,
        ),
        { status: 404 },
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
            VP_CONVERSATION_ERROR_CODES.USER_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      targetUserIds = targetUsers.map((u) => u.id);
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
            VP_CONVERSATION_ERROR_CODES.USER_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      targetUserIds = workspaceAdmins.map((admin) => admin.userId);
    }

    // Update task status to BLOCKED
    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: 'BLOCKED',
        metadata: {
          ...(task.metadata as Record<string, unknown>),
          escalation: {
            escalatedAt: new Date().toISOString(),
            escalatedBy: vp.user.id,
            reason: input.reason,
            severity: input.severity,
            context: input.context,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Create notifications for target users
    const notifications = await Promise.all(
      targetUserIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: 'SYSTEM' as const,
            title: `Task Escalation: ${task.title}`,
            body: input.reason,
            priority: input.severity === 'critical' ? ('URGENT' as const) : ('HIGH' as const),
            resourceId: task.id,
            resourceType: 'task',
            metadata: {
              taskId: task.id,
              vpId,
              vpName: vp.user.name,
              severity: input.severity,
              context: input.context,
            } as unknown as Prisma.InputJsonValue,
          },
        }),
      ),
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
            content: `⚠️ **Task Escalation** (${input.severity.toUpperCase()})\n\n**Task:** ${task.title}\n**Reason:** ${input.reason}\n\nTask has been escalated for review.`,
            type: 'SYSTEM',
            channelId: channel.id,
            authorId: vp.user.id,
            metadata: {
              taskId: task.id,
              escalation: true,
              severity: input.severity,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    return NextResponse.json(
      {
        data: {
          task: updatedTask,
          notifications: notifications.map((n) => ({
            id: n.id,
            userId: n.userId,
            title: n.title,
          })),
          channelMessage,
          escalatedTo: targetUserIds,
        },
        message: `Task escalated successfully to ${targetUserIds.length} user(s)`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/escalate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
