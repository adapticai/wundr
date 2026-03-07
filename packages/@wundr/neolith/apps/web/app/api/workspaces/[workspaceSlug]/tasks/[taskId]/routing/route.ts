/**
 * Task Routing Decision API Route
 *
 * Returns the routing decision for a specific task, including which
 * orchestrator and session manager the task was assigned to, and the
 * reasoning behind the decision.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceSlug]/tasks/[taskId]/routing - Get routing decision
 *
 * @module app/api/workspaces/[workspaceSlug]/tasks/[taskId]/routing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';

import type { NextRequest } from 'next/server';

// =============================================================================
// Route Context
// =============================================================================

interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    taskId: string;
  }>;
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * GET /api/workspaces/[workspaceSlug]/tasks/[taskId]/routing
 *
 * Retrieve the routing decision for a task. Verifies that the requesting user
 * is a workspace member before returning data.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace slug and task ID
 * @returns Routing decision with orchestrator and session manager details
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    const { workspaceSlug, taskId } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this workspace',
          TASK_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Fetch the task to verify it belongs to this workspace
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: workspace.id },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        orchestratorId: true,
        metadata: true,
        createdAt: true,
        orchestrator: {
          select: {
            id: true,
            discipline: true,
            role: true,
            status: true,
            user: { select: { id: true, name: true, email: true } },
            sessionManagers: {
              select: {
                id: true,
                name: true,
                status: true,
                disciplineId: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        createErrorResponse(
          'Task not found in this workspace',
          TASK_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Look up the most recent routing decision for this task from the
    // routingDecision table. The taskId is stored in the metadata JSON field
    // because the schema links routingDecision to message, not task.
    const routingDecision = await prisma.routingDecision.findFirst({
      where: {
        organizationId: workspace.organizationId,
        metadata: {
          path: ['taskId'],
          equals: taskId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!routingDecision) {
      return NextResponse.json({
        data: {
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
          },
          routingDecision: null,
          orchestrator: task.orchestrator
            ? {
                id: task.orchestrator.id,
                discipline: task.orchestrator.discipline,
                role: task.orchestrator.role,
                status: task.orchestrator.status,
                agentName: task.orchestrator.user.name,
                sessionManagers: task.orchestrator.sessionManagers,
              }
            : null,
          message: 'No routing decision found for this task',
        },
      });
    }

    // Resolve the session manager if stored in metadata
    const routingMeta =
      (routingDecision.metadata as Record<string, unknown>) ?? {};
    const sessionManagerId = routingMeta.sessionManagerId as string | undefined;

    let sessionManager: { id: string; name: string; status: string } | null =
      null;
    if (sessionManagerId) {
      sessionManager = await prisma.sessionManager.findUnique({
        where: { id: sessionManagerId },
        select: { id: true, name: true, status: true },
      });
    }

    return NextResponse.json({
      data: {
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        },
        routingDecision: {
          id: routingDecision.id,
          agentId: routingDecision.agentId,
          agentName: routingDecision.agentName,
          confidence: routingDecision.confidence,
          reasoning: routingDecision.reasoning,
          matchedBy: routingDecision.matchedBy,
          fallbackUsed: routingDecision.fallbackUsed,
          escalated: routingDecision.escalated,
          routingLatencyMs: routingDecision.routingLatencyMs,
          createdAt: routingDecision.createdAt,
        },
        orchestrator: task.orchestrator
          ? {
              id: task.orchestrator.id,
              discipline: task.orchestrator.discipline,
              role: task.orchestrator.role,
              status: task.orchestrator.status,
              agentName: task.orchestrator.user.name,
            }
          : null,
        sessionManager,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/tasks/[taskId]/routing] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
