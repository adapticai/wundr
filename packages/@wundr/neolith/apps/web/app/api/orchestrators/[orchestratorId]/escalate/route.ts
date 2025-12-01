/**
 * OrchestratorTask Escalation API Route
 *
 * Allows Orchestrators (VPs) to escalate tasks when they need human intervention.
 *
 * Routes:
 * - POST /api/orchestrators/:id/escalate - Escalate a task
 *
 * @module app/api/orchestrators/[id]/escalate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  escalateTaskSchema,
  orchestratorIdParamSchema,
  createErrorResponse,
  ORCHESTRATOR_ERROR_CODES,
} from '@/lib/validations/orchestrator';

import type { EscalateTaskInput } from '@/lib/validations/orchestrator';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with OrchestratorID parameter
 */
interface RouteContext {
  params: Promise<{ orchestratorId: string }>;
}

/**
 * POST /api/orchestrators/:id/escalate
 *
 * Escalate a task when Orchestrator needs human intervention or help.
 * Requires authentication as the Orchestrator or admin/owner in the Orchestrator's organization.
 * Creates an escalation notification in the specified channel.
 *
 * @param request - Next.js request with escalation data
 * @param context - Route context containing OrchestratorID
 * @returns Escalation message and updated task
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/escalate
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
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate OrchestratorID parameter
    const params = await context.params;
    const paramResult = orchestratorIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid OrchestratorID format',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
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
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
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
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: EscalateTaskInput = parseResult.data;

    // Get Orchestrator and verify access
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: params.orchestratorId },
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          ORCHESTRATOR_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if authenticated user is the Orchestrator or has admin/owner role
    const isOrchestratorUser = session.user.id === orchestrator.user.id;
    let hasAdminAccess = false;

    if (!isOrchestratorUser) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orchestrator.organizationId,
            userId: session.user.id,
          },
        },
      });

      hasAdminAccess =
        membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    }

    if (!isOrchestratorUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to escalate tasks for this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get task and verify ownership
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      include: {
        orchestrator: true,
        channel: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found',
          ORCHESTRATOR_ERROR_CODES.TASK_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify task belongs to Orchestrator
    if (task.orchestratorId !== orchestrator.id) {
      return NextResponse.json(
        createErrorResponse(
          'Task does not belong to this Orchestrator',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Determine escalation channel (use provided or task's channel)
    const escalationChannelId = input.channelId ?? task.channelId;

    if (!escalationChannelId) {
      return NextResponse.json(
        createErrorResponse(
          'No channel specified for escalation',
          ORCHESTRATOR_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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
        createErrorResponse(
          'Channel not found',
          ORCHESTRATOR_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify channel belongs to Orchestrator's organization
    if (channel.workspace.organizationId !== orchestrator.organizationId) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not accessible',
          ORCHESTRATOR_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
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
        orchestratorId: orchestrator.id,
        orchestratorName: orchestrator.user.name,
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
    const escalationContent =
      `🚨 **Task Escalation** (${input.severity.toUpperCase()})\n\n` +
      `**Orchestrator:** ${orchestrator.user.name}\n` +
      `**Task:** ${task.title}\n` +
      `**Reason:** ${input.reason}\n\n` +
      'This task requires human intervention. Please review and assist.';

    const escalationMetadata = {
      type: 'escalation',
      severity: input.severity,
      taskId: task.id,
      orchestratorId: orchestrator.id,
      reason: input.reason,
      ...(input.context ?? {}),
    };

    const escalationMessage = await prisma.message.create({
      data: {
        content: escalationContent,
        type: 'SYSTEM',
        channelId: escalationChannelId,
        authorId: orchestrator.user.id,
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
            isOrchestrator: true,
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
    console.error('[POST /api/orchestrators/:id/escalate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
