/**
 * Task Execution API Routes
 *
 * Handles triggering task execution on the orchestrator daemon and
 * querying the current execution status of a task.
 *
 * Routes:
 * - POST /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute - Send task to daemon
 * - GET  /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute - Get execution status
 *
 * @module app/api/workspaces/[workspaceSlug]/tasks/[taskId]/execute/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const executeTaskSchema = z.object({
  /** Override which session manager should handle execution */
  sessionManagerId: z.string().optional(),
  /** Arbitrary execution context forwarded to the daemon */
  context: z.record(z.unknown()).optional(),
});

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
// Helper Functions
// =============================================================================

/**
 * Redis key used to track per-task execution status.
 */
function executionKey(taskId: string): string {
  return `task:execution:${taskId}`;
}

/**
 * Forward a task to the daemon's HTTP execution endpoint.
 * Returns the session ID assigned by the daemon, or null on failure.
 */
async function forwardExecutionToDaemon(
  orchestratorId: string,
  payload: {
    taskId: string;
    title: string;
    description?: string;
    priority: string;
    context?: Record<string, unknown>;
    sessionManagerId?: string;
  }
): Promise<{ sessionId: string | null; status: string }> {
  try {
    const registrationRaw = await redis.get(
      `daemon:registration:${orchestratorId}`
    );
    if (!registrationRaw) {
      return { sessionId: null, status: 'daemon_not_connected' };
    }

    const registration = JSON.parse(registrationRaw) as {
      host: string;
      port: number;
      protocol: string;
    };

    const daemonBaseUrl = `${registration.protocol}://${registration.host}:${registration.port}`;
    const response = await fetch(`${daemonBaseUrl}/tasks/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { sessionId: null, status: 'daemon_error' };
    }

    const data = (await response.json()) as { sessionId?: string };
    return {
      sessionId: data.sessionId ?? null,
      status: 'executing',
    };
  } catch {
    return { sessionId: null, status: 'daemon_unreachable' };
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute
 *
 * Trigger execution of a previously routed task. The task must already exist
 * and belong to the workspace. The request is forwarded to the daemon
 * connected to the task's orchestrator.
 *
 * Request body (optional):
 * {
 *   "sessionManagerId": "sm_abc123",
 *   "context": { "priority": "urgent" }
 * }
 *
 * @param request - Next.js request
 * @param context - Route context with workspace slug and task ID
 * @returns Session ID and execution status
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

    // Fetch the task
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: workspace.id },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        orchestratorId: true,
        metadata: true,
        orchestrator: {
          select: {
            id: true,
            status: true,
            sessionManagers: {
              where: { status: 'ACTIVE' },
              select: { id: true, name: true },
              take: 1,
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

    // Tasks that are already done or cancelled cannot be executed
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      return NextResponse.json(
        createErrorResponse(
          `Task is already ${task.status.toLowerCase()} and cannot be executed`,
          TASK_ERROR_CODES.INVALID_STATE_TRANSITION
        ),
        { status: 409 }
      );
    }

    // Parse optional body
    let body: unknown = {};
    try {
      const raw = await request.text();
      if (raw) {
        body = JSON.parse(raw);
      }
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          TASK_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = executeTaskSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Determine which session manager to use
    const sessionManagerId =
      input.sessionManagerId ??
      task.orchestrator.sessionManagers[0]?.id ??
      null;

    // Transition task to IN_PROGRESS
    const currentMetadata = (task.metadata as Prisma.JsonObject) ?? {};
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        metadata: {
          ...currentMetadata,
          executionRequestedAt: new Date().toISOString(),
          executionRequestedBy: session.user.id,
          sessionManagerId,
        } as Prisma.InputJsonValue,
      },
    });

    // Forward execution to daemon
    const daemonResult = await forwardExecutionToDaemon(task.orchestrator.id, {
      taskId: task.id,
      title: task.title,
      description: task.description ?? undefined,
      priority: task.priority,
      context: input.context,
      sessionManagerId: sessionManagerId ?? undefined,
    });

    // Persist execution state in Redis for fast polling
    const executionState = {
      taskId: task.id,
      sessionId: daemonResult.sessionId,
      status: daemonResult.status,
      startedAt: new Date().toISOString(),
      progress: 0,
      output: null,
    };

    try {
      await redis.setex(
        executionKey(taskId),
        24 * 60 * 60, // 24 hours TTL
        JSON.stringify(executionState)
      );
    } catch (redisError) {
      console.error('[execute] Redis write error:', redisError);
      // Non-fatal - execution state can be reconstructed from DB
    }

    return NextResponse.json({
      taskId: task.id,
      sessionId: daemonResult.sessionId,
      status: daemonResult.status,
      sessionManagerId,
      message:
        daemonResult.status === 'executing'
          ? 'Task forwarded to daemon for execution'
          : 'Task queued - daemon not currently reachable',
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute] Error:',
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

/**
 * GET /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute
 *
 * Poll the current execution status of a task. Checks Redis first for
 * live status reported by the daemon, then falls back to the database task
 * record for persistence.
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace slug and task ID
 * @returns Current execution status, output, progress, and session ID
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
      select: { id: true },
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

    // Fetch task from DB
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId: workspace.id },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
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

    // Attempt to read live execution state from Redis
    let executionState: {
      taskId: string;
      sessionId: string | null;
      status: string;
      startedAt: string;
      progress: number;
      output: string | null;
    } | null = null;

    try {
      const raw = await redis.get(executionKey(taskId));
      if (raw) {
        executionState = JSON.parse(raw);
      }
    } catch (redisError) {
      console.error('[execute GET] Redis read error:', redisError);
    }

    // Derive a normalized status from the DB task status when no live state exists
    const dbStatus = task.status;
    const derivedStatus =
      dbStatus === 'DONE'
        ? 'completed'
        : dbStatus === 'CANCELLED'
          ? 'cancelled'
          : dbStatus === 'BLOCKED'
            ? 'blocked'
            : dbStatus === 'IN_PROGRESS'
              ? 'executing'
              : 'pending';

    const taskMeta = (task.metadata as Record<string, unknown>) ?? {};

    return NextResponse.json({
      data: {
        taskId: task.id,
        status: executionState?.status ?? derivedStatus,
        sessionId:
          executionState?.sessionId ??
          (taskMeta.sessionId as string | undefined) ??
          null,
        progress: executionState?.progress ?? (dbStatus === 'DONE' ? 100 : 0),
        output: executionState?.output ?? null,
        startedAt:
          executionState?.startedAt ??
          (taskMeta.executionRequestedAt as string | undefined) ??
          null,
        completedAt: task.completedAt?.toISOString() ?? null,
        taskStatus: task.status,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/tasks/[taskId]/execute] Error:',
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
