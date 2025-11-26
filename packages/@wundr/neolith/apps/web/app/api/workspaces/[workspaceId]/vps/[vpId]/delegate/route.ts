/**
 * VP Task Delegation API Route
 *
 * Allows VPs to delegate tasks to humans or other VPs.
 * Creates task assignment, notifications, and optional channel messages.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/vps/:vpId/delegate
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/delegate/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  delegateTaskSchema,
  createErrorResponse,
  VP_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/vp-conversation';

import type { DelegateTaskInput } from '@/lib/validations/vp-conversation';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/delegate
 *
 * VP delegates a task to a human or another VP.
 * - Validates task is assigned to this VP
 * - Re-assigns task to target user
 * - Creates notification for assignee
 * - Optionally posts to channel
 * - Tracks delegation chain in metadata
 *
 * @param request - Next.js request with delegation data
 * @param context - Route context containing workspace and VP IDs
 * @returns Delegation details and updated task
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
    const parseResult = delegateTaskSchema.safeParse(body);
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
          'Unauthorized: You can only delegate tasks as your own VP',
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
          VP_CONVERSATION_ERROR_CODES.USER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Build delegation chain
    const existingMetadata = (task.metadata as Record<string, unknown>) || {};
    const delegationChain = Array.isArray(existingMetadata.delegationChain)
      ? existingMetadata.delegationChain
      : [];

    delegationChain.push({
      from: vp.user.id,
      fromName: vp.user.name,
      to: targetUser.id,
      toName: targetUser.name,
      delegatedAt: new Date().toISOString(),
      note: input.note,
    });

    // Check if target user is a VP
    const targetVP = await prisma.vP.findFirst({
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
        // Update vpId only if target is a VP
        ...(targetVP && { vpId: targetVP.id }),
        // Update priority if provided
        ...(input.priority && { priority: input.priority }),
        // Update due date if provided
        ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
        metadata: {
          ...existingMetadata,
          delegationChain,
          lastDelegation: {
            from: vp.user.id,
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
          body: input.note || `${vp.user.name} has delegated a task to you`,
          priority: input.priority === 'CRITICAL' ? ('URGENT' as const) : ('NORMAL' as const),
          resourceId: task.id,
          resourceType: 'task',
          metadata: {
            taskId: task.id,
            delegatedBy: vp.user.id,
            delegatedByName: vp.user.name,
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
            content: `📋 **Task Delegated**\n\n**Task:** ${task.title}\n**From:** ${vp.user.name}\n**To:** ${targetUser.name}\n${input.note ? `**Note:** ${input.note}` : ''}`,
            type: 'SYSTEM',
            channelId: channel.id,
            authorId: vp.user.id,
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
      { status: 200 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/vps/:vpId/delegate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
