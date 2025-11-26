/**
 * VP Task Escalation API Route
 *
 * Allows Virtual Persons (VPs) to escalate tasks when they need human intervention.
 *
 * Routes:
 * - POST /api/vps/:id/escalate - Escalate a task
 *
 * @module app/api/vps/[id]/escalate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  escalateTaskSchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { EscalateTaskInput } from '@/lib/validations/vp';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/escalate
 *
 * Escalate a task when VP needs human intervention or help.
 * Requires authentication as the VP or admin/owner in the VP's organization.
 * Creates an escalation notification in the specified channel.
 *
 * @param request - Next.js request with escalation data
 * @param context - Route context containing VP ID
 * @returns Escalation message and updated task
 *
 * @example
 * ```
 * POST /api/vps/vp_123/escalate
 * Content-Type: application/json
 *
 * {
 *   "taskId": "task_456",
 *   "reason": "Unable to access required API endpoint",
 *   "severity": "high",
 *   "channelId": "channel_789"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = escalateTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: EscalateTaskInput = parseResult.data;

    // Get VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if authenticated user is the VP or has admin/owner role
    const isVPUser = session.user.id === vp.user.id;
    let hasAdminAccess = false;

    if (!isVPUser) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: vp.organizationId,
            userId: session.user.id,
          },
        },
      });

      hasAdminAccess = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    }

    if (!isVPUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to escalate tasks for this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get task and verify ownership
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      include: {
        vp: true,
        channel: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse('Task not found', VP_ERROR_CODES.TASK_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify task belongs to VP
    if (task.vpId !== vp.id) {
      return NextResponse.json(
        createErrorResponse('Task does not belong to this VP', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Determine escalation channel (use provided or task's channel)
    const escalationChannelId = input.channelId ?? task.channelId;

    if (!escalationChannelId) {
      return NextResponse.json(
        createErrorResponse(
          'No channel specified for escalation',
          VP_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify channel exists and is accessible
    const channel = await prisma.channel.findUnique({
      where: { id: escalationChannelId },
      include: {
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Channel not found', VP_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify channel belongs to VP's organization
    if (channel.workspace.organizationId !== vp.organizationId) {
      return NextResponse.json(
        createErrorResponse('Channel not accessible', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Update task with escalation status
    const taskMetadata = task.metadata as Record<string, unknown> | null;
    const updatedTaskMetadata = {
      ...(taskMetadata ?? {}),
      escalation: {
        escalatedAt: new Date().toISOString(),
        reason: input.reason,
        severity: input.severity,
        vpId: vp.id,
        vpName: vp.user.name,
        context: input.context,
      },
    };

    const updatedTask = await prisma.task.update({
      where: { id: input.taskId },
      data: {
        status: 'BLOCKED',
        metadata: updatedTaskMetadata as Prisma.InputJsonValue,
      },
    });

    // Create escalation message in channel
    const escalationContent = `🚨 **Task Escalation** (${input.severity.toUpperCase()})\n\n` +
      `**VP:** ${vp.user.name}\n` +
      `**Task:** ${task.title}\n` +
      `**Reason:** ${input.reason}\n\n` +
      'This task requires human intervention. Please review and assist.';

    const escalationMetadata = {
      type: 'escalation',
      severity: input.severity,
      taskId: task.id,
      vpId: vp.id,
      reason: input.reason,
      ...(input.context ?? {}),
    };

    const escalationMessage = await prisma.message.create({
      data: {
        content: escalationContent,
        type: 'SYSTEM',
        channelId: escalationChannelId,
        authorId: vp.user.id,
        metadata: escalationMetadata as Prisma.InputJsonValue,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        task: updatedTask,
        escalationMessage,
      },
      message: 'Task escalated successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/escalate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
