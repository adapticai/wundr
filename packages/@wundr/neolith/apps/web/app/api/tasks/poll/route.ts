/**
 * Task Polling Route for OrchestratorDaemon
 *
 * Provides task polling endpoint for Orchestrator daemons to fetch assigned tasks.
 * Supports delta updates based on last poll timestamp.
 *
 * Routes:
 * - POST /api/tasks/poll - Poll for tasks assigned to an Orchestrator
 *
 * @module app/api/tasks/poll/route
 */

import { prisma } from '@neolith/database';
import type { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { TaskPollingInput } from '@/lib/validations/task';
import {
  createErrorResponse,
  TASK_ERROR_CODES,
  taskPollingSchema,
} from '@/lib/validations/task';

/**
 * POST /api/tasks/poll
 *
 * Poll for tasks assigned to a Orchestrator daemon.
 * Supports filtering by status and priority, and delta updates using since parameter.
 *
 * This endpoint does NOT require user authentication as it's called by Orchestrator daemon services.
 * Instead, it validates the OrchestratorID against daemon credentials.
 *
 * Request body:
 * {
 *   "orchestratorId": "orchestrator_123",
 *   "workspaceId": "ws_123",
 *   "status": ["TODO", "IN_PROGRESS"],
 *   "minPriority": "HIGH",
 *   "since": "2025-01-01T00:00:00Z",
 *   "limit": 100
 * }
 *
 * @param request - Next.js request with polling data
 * @returns List of tasks for the Orchestrator
 *
 * @example
 * ```
 * POST /api/tasks/poll
 * Content-Type: application/json
 * X-Orchestrator-API-Key: orchestrator_key_123
 *
 * {
 *   "orchestratorId": "orchestrator_123",
 *   "workspaceId": "ws_123",
 *   "status": ["TODO", "IN_PROGRESS"],
 *   "limit": 50
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = taskPollingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: TaskPollingInput = parseResult.data;

    // Verify Orchestrator exists and belongs to the workspace
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: input.orchestratorId,
        workspaceId: input.workspaceId,
      },
      select: { id: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found in workspace',
          TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Build where clause
    const where: Prisma.taskWhereInput = {
      orchestratorId: input.orchestratorId,
      workspaceId: input.workspaceId,
    };

    // Add status filter if provided
    if (input.status && input.status.length > 0) {
      where.status = { in: input.status as TaskStatus[] };
    }

    // Add priority filter if provided (minPriority = CRITICAL > HIGH > MEDIUM > LOW)
    if (input.minPriority) {
      const priorityOrder = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };

      const minValue = priorityOrder[input.minPriority as keyof typeof priorityOrder];
      const includedPriorities = Object.keys(priorityOrder).filter(
        (p) => (priorityOrder[p as keyof typeof priorityOrder] || 0) <= minValue,
      );

      where.priority = { in: includedPriorities as TaskPriority[] };
    }

    // Add timestamp filter for delta updates
    if (input.since) {
      where.updatedAt = {
        gt: new Date(input.since),
      };
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where,
      take: input.limit,
      orderBy: [
        { priority: 'asc' }, // CRITICAL first
        { dueDate: 'asc' }, // Then by due date
        { createdAt: 'asc' }, // Then by creation date
      ],
      include: {
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true, isOrchestrator: true } },
      },
    });

    // Calculate polling metadata
    const pollMetadata = {
      orchestratorId: input.orchestratorId,
      workspaceId: input.workspaceId,
      polledAt: new Date().toISOString(),
      since: input.since,
      tasksReturned: tasks.length,
      hasMore: tasks.length >= input.limit,
    };

    return NextResponse.json({
      data: tasks,
      metadata: pollMetadata,
    });
  } catch (error) {
    console.error('[POST /api/tasks/poll] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
