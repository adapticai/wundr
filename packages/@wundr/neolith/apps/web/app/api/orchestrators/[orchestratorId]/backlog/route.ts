/**
 * OrchestratorBacklog Route
 *
 * Retrieves filtered tasks (backlog) for a specific Orchestrator.
 * Provides priority-sorted task list for Orchestrator management.
 *
 * Routes:
 * - GET /api/orchestrators/[id]/backlog - Get Orchestrator's task backlog
 * - POST /api/orchestrators/[id]/backlog - Add item to Orchestrator's backlog
 *
 * @module app/api/orchestrators/[id]/backlog/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpBacklogFiltersSchema,
  createBacklogItemSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { VPBacklogFiltersInput, CreateBacklogItemInput } from '@/lib/validations/task';
import type { TaskStatus, TaskPriority } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/orchestrators/[id]/backlog
 *
 * Retrieve Orchestrator's task backlog with filtering, pagination, and priority-based sorting.
 * Returns tasks assigned to or created for the Orchestrator, sorted by priority and due date.
 *
 * Query Parameters:
 * - status: Filter by status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
 * - priority: Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * - includeCompleted: Include completed tasks (default false)
 * - sortBy: Sort field (priority, dueDate, createdAt, status) - default "priority"
 * - sortOrder: Sort direction (asc, desc) - default "asc" for priority
 * - page: Pagination page (default 1)
 * - limit: Items per page (default 50, max 100)
 *
 * @param request - Next.js request object
 * @param params - Route parameters (id = OrchestratorID)
 * @returns Orchestrator's filtered task backlog with pagination
 *
 * @example
 * ```
 * GET /api/orchestrators/orch_123/backlog?status=TODO,IN_PROGRESS&priority=CRITICAL,HIGH&sortBy=priority
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orchestratorId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get OrchestratorID from params
    const resolvedParams = await params;
    const orchestratorId = resolvedParams.orchestratorId;

    // Validate OrchestratorID format
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify Orchestrator exists
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to Orchestrator's workspace
    let workspaceMember = null;
    if (orchestrator.workspaceId) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: orchestrator.workspaceId,
          userId: session.user.id,
        },
      });

      if (!workspaceMember) {
        return NextResponse.json(
          createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = vpBacklogFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
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
      ...(statusArray && { status: { in: statusArray as TaskStatus[] } }),
      ...(priorityArray && { priority: { in: priorityArray as TaskPriority[] } }),
      ...(!filters.includeCompleted && {
        status: { notIn: ['DONE', 'CANCELLED'] },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy with intelligent sorting
    const orderBy: Prisma.taskOrderByWithRelationInput[] = [];

    if (filters.sortBy === 'priority') {
      orderBy.push({ priority: filters.sortOrder });
      orderBy.push({ dueDate: 'asc' });
    } else if (filters.sortBy === 'dueDate') {
      orderBy.push({ dueDate: filters.sortOrder });
      orderBy.push({ priority: 'asc' });
    } else if (filters.sortBy === 'status') {
      orderBy.push({ status: filters.sortOrder });
      orderBy.push({ priority: 'asc' });
    } else {
      orderBy.push({ [filters.sortBy]: filters.sortOrder });
      orderBy.push({ priority: 'asc' });
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
        },
      }),
      prisma.task.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const hasNextPage = filters.page < totalPages;
    const hasPreviousPage = filters.page > 1;

    // Calculate metrics for this backlog
    const metricsWhere: Prisma.taskWhereInput = { orchestratorId: orchestratorId };
    const [totalTasks, todoCount, inProgressCount, blockedCount, doneCount] = await Promise.all([
      prisma.task.count({ where: metricsWhere }),
      prisma.task.count({ where: { ...metricsWhere, status: 'TODO' } }),
      prisma.task.count({ where: { ...metricsWhere, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...metricsWhere, status: 'BLOCKED' } }),
      prisma.task.count({ where: { ...metricsWhere, status: 'DONE' } }),
    ]);

    return NextResponse.json({
      data: tasks,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      metrics: {
        orchestratorId,
        total: totalTasks,
        byStatus: {
          todo: todoCount,
          inProgress: inProgressCount,
          blocked: blockedCount,
          done: doneCount,
        },
        completionRate:
          totalTasks > 0
            ? ((doneCount / (totalTasks - totalTasks + doneCount + todoCount + inProgressCount + blockedCount)) * 100).toFixed(2)
            : '0.00',
      },
    });
  } catch (error) {
    console.error('[GET /api/orchestrators/[id]/backlog] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/orchestrators/[id]/backlog
 *
 * Add a new backlog item (task) to a Orchestrator's backlog.
 * Requires authentication and access to the Orchestrator's workspace.
 *
 * Request body:
 * {
 *   "title": "Implement feature",
 *   "description": "Detailed description",
 *   "priority": "HIGH",
 *   "status": "TODO",
 *   "storyPoints": 5,
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "tags": ["feature", "backend"],
 *   "assignedToId": "user_789"
 * }
 *
 * @param request - Next.js request with backlog item creation data
 * @param params - Route parameters (id = OrchestratorID)
 * @returns Created task object
 *
 * @example
 * ```
 * POST /api/orchestrators/orch_123/backlog
 * Content-Type: application/json
 *
 * {
 *   "title": "Add authentication",
 *   "priority": "HIGH",
 *   "storyPoints": 8
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orchestratorId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get OrchestratorID from params
    const resolvedParams = await params;
    const orchestratorId = resolvedParams.orchestratorId;

    // Validate OrchestratorID format
    if (!orchestratorId || orchestratorId.length === 0) {
      return NextResponse.json(
        createErrorResponse('Invalid OrchestratorID', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

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
    const parseResult = createBacklogItemSchema.safeParse(body);
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

    const input: CreateBacklogItemInput = parseResult.data;

    // Verify Orchestrator exists and get workspace context
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', TASK_ERROR_CODES.ORCHESTRATOR_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to Orchestrator's workspace
    if (orchestrator.workspaceId) {
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: orchestrator.workspaceId,
          userId: session.user.id,
        },
      });

      if (!workspaceMember) {
        return NextResponse.json(
          createErrorResponse('Access denied', TASK_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Verify assignee if provided
    if (input.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assignedToId },
        select: { id: true },
      });

      if (!assignee) {
        return NextResponse.json(
          createErrorResponse('Assignee not found', TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND),
          { status: 404 },
        );
      }
    }

    // Prepare metadata with story points if provided
    const metadata: Record<string, unknown> = {};
    if (input.storyPoints !== undefined && input.storyPoints !== null) {
      metadata.storyPoints = input.storyPoints;
    }

    // Create backlog item (task)
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        tags: input.tags,
        metadata: metadata as Prisma.InputJsonValue,
        orchestratorId: orchestratorId,
        workspaceId: orchestrator.workspaceId!,
        createdById: session.user.id,
        assignedToId: input.assignedToId,
      },
      include: {
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        orchestrator: {
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: task,
        message: 'Backlog item created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/orchestrators/[id]/backlog] Error:', error);

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Required resource not found', TASK_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          createErrorResponse('Invalid foreign key reference', TASK_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
