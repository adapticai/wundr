/**
 * OrchestratorBacklog API Routes
 *
 * Handles retrieving and adding tasks to a Orchestrator's backlog.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog - Get Orchestrator's task backlog
 * - POST /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog - Add task to Orchestrator's backlog
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  getTaskMetrics,
  validateTaskDependencies,
} from '@/lib/services/task-service';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';
import {
  vpBacklogFiltersSchema,
  addBacklogTaskSchema,
  BACKLOG_ERROR_CODES,
} from '@/lib/validations/task-backlog';

import type {
  VPBacklogFiltersInput,
  AddBacklogTaskInput,
} from '@/lib/validations/task-backlog';
import type { TaskStatus, TaskPriority } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog
 *
 * Returns tasks assigned to this Orchestrator in backlog order with optional filters.
 * Priority ordering: CRITICAL > HIGH > MEDIUM > LOW
 * Includes task statistics if requested.
 *
 * Query Parameters:
 * - status: Filter by status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
 * - priority: Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * - includeCompleted: Include completed tasks (default: false)
 * - includeStats: Include task statistics (default: false)
 * - page: Pagination page (default 1)
 * - limit: Items per page (default 50, max 100)
 * - sortBy: Sort field (priority, dueDate, createdAt, status)
 * - sortOrder: Sort direction (asc, desc)
 *
 * @param request - Next.js request object with query parameters
 * @param params - Route parameters (workspaceId, orchestratorId)
 * @returns Orchestrator's task backlog with optional statistics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/orchestrators/orch_456/backlog?status=TODO&priority=HIGH&includeStats=true
 * ```
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceSlug: string; orchestratorId: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
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
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check user has access to workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          BACKLOG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify Orchestrator exists and belongs to workspace
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
      },
      select: {
        id: true,
        role: true,
        workspaceId: true,
        organizationId: true,
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
          'Orchestrator not found',
          BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Orchestrator can be workspace-specific or organization-wide
    if (orchestrator.workspaceId && orchestrator.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found in this workspace',
          BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = vpBacklogFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: VPBacklogFiltersInput = parseResult.data;

    // Normalize status and priority filters
    const statusArray = filters.status
      ? typeof filters.status === 'string'
        ? [filters.status]
        : filters.status
      : undefined;

    const priorityArray = filters.priority
      ? typeof filters.priority === 'string'
        ? [filters.priority]
        : filters.priority
      : undefined;

    // Build where clause
    const where: Prisma.taskWhereInput = {
      orchestratorId: orchestratorId,
      workspaceId,
      ...(statusArray && { status: { in: statusArray as TaskStatus[] } }),
      ...(priorityArray && {
        priority: { in: priorityArray as TaskPriority[] },
      }),
      ...(!filters.includeCompleted && {
        status: { notIn: ['DONE', 'CANCELLED'] },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy with priority-aware sorting
    const orderBy: Prisma.taskOrderByWithRelationInput[] = [];

    // Priority sorting with custom order
    if (filters.sortBy === 'priority') {
      orderBy.push({ priority: filters.sortOrder });
    } else {
      // Always sort by priority first (CRITICAL > HIGH > MEDIUM > LOW)
      orderBy.push({ priority: 'asc' as const });

      // Then by requested field
      if (filters.sortBy === 'dueDate') {
        orderBy.push({ dueDate: filters.sortOrder });
      } else {
        orderBy.push({ [filters.sortBy]: filters.sortOrder });
      }
    }

    // Fetch tasks and total count in parallel
    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          workspace: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          channel: { select: { id: true, name: true } },
        },
      }),
      prisma.task.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    // Build response
    const response: Record<string, unknown> = {
      data: tasks,
      orchestrator: {
        id: orchestrator.id,
        role: orchestrator.role,
        user: orchestrator.user,
      },
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };

    // Add statistics if requested
    if (filters.includeStats) {
      const stats = await getTaskMetrics(orchestratorId, workspaceId);
      response.statistics = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        BACKLOG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog
 *
 * Add a new task to the Orchestrator's backlog.
 *
 * Request body:
 * {
 *   "title": "Task title",
 *   "description": "Task description",
 *   "priority": "HIGH",
 *   "status": "TODO",
 *   "estimatedHours": 8,
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "tags": ["feature", "backend"],
 *   "dependsOn": ["task_123"],
 *   "assignedToId": "user_456"
 * }
 *
 * @param request - Next.js request with task data
 * @param params - Route parameters (workspaceId, orchestratorId)
 * @returns Created task object
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/orchestrators/orch_456/backlog
 * Content-Type: application/json
 *
 * {
 *   "title": "Implement authentication",
 *   "priority": "HIGH"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ workspaceSlug: string; orchestratorId: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
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
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check user has access to workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          BACKLOG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify Orchestrator exists and belongs to workspace
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
      },
      select: {
        id: true,
        workspaceId: true,
        organizationId: true,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found',
          BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Orchestrator can be workspace-specific or organization-wide
    if (orchestrator.workspaceId && orchestrator.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found in this workspace',
          BACKLOG_ERROR_CODES.ORCHESTRATOR_NOT_FOUND
        ),
        { status: 404 }
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
    const parseResult = addBacklogTaskSchema.safeParse(body);
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

    const input: AddBacklogTaskInput = parseResult.data;

    // Validate task dependencies
    const depValidation = await validateTaskDependencies(
      'new-task', // temporary ID for new task
      input.dependsOn || [],
      workspaceId
    );

    if (!depValidation.isValid) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid task dependencies',
          TASK_ERROR_CODES.DEPENDENCY_VIOLATION,
          {
            circularDependencies: depValidation.circularDependencies,
            unresolvedDependencies: depValidation.unresolvedDependencies,
          }
        ),
        { status: 400 }
      );
    }

    // Verify assignee if provided
    if (input.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true },
      });

      if (!assignee) {
        return NextResponse.json(
          createErrorResponse(
            'Assignee not found',
            TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND
          ),
          { status: 404 }
        );
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        estimatedHours: input.estimatedHours,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        tags: input.tags,
        dependsOn: input.dependsOn,
        metadata: input.metadata as Prisma.InputJsonValue,
        orchestratorId: orchestratorId,
        workspaceId,
        channelId: input.channelId,
        createdById: session.user.id,
        assignedToId: input.assignedToId,
      },
      include: {
        orchestrator: {
          select: {
            id: true,
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        data: task,
        message: 'Task added to Orchestrator backlog successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/backlog] Error:',
      error
    );

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse(
            'Required resource not found',
            BACKLOG_ERROR_CODES.INTERNAL_ERROR
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
