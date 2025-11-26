/**
 * Task CRUD API Routes
 *
 * Handles listing and creating tasks for VP management.
 *
 * Routes:
 * - GET /api/tasks - List tasks with optional filters and sorting
 * - POST /api/tasks - Create a new task
 *
 * @module app/api/tasks/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { validateTaskDependencies } from '@/lib/services/task-service';
import {
  createTaskSchema,
  taskFiltersSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { CreateTaskInput, TaskFiltersInput } from '@/lib/validations/task';
import type { NextRequest } from 'next/server';

/**
 * GET /api/tasks
 *
 * List tasks with optional filtering, pagination, and sorting.
 * Requires authentication. Users can only see tasks from workspaces they belong to.
 *
 * Query Parameters:
 * - vpId: Filter by VP ID
 * - workspaceId: Filter by workspace ID
 * - status: Filter by status (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
 * - priority: Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * - search: Search by title or description
 * - tags: Filter by tags
 * - sortBy: Sort field (createdAt, updatedAt, priority, dueDate, title, status)
 * - sortOrder: Sort direction (asc, desc)
 * - page: Pagination page (default 1)
 * - limit: Items per page (default 20, max 100)
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of tasks
 *
 * @example
 * ```
 * GET /api/tasks?vpId=vp_123&status=TODO&priority=HIGH&sortBy=priority&limit=50
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = taskFiltersSchema.safeParse(searchParams);

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

    const filters: TaskFiltersInput = parseResult.data;

    // Get workspaces the user has access to
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });

    const accessibleWorkspaceIds = userWorkspaces.map((m) => m.workspaceId);

    if (!accessibleWorkspaceIds.length) {
      return NextResponse.json({
        data: [],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    // Check authorization for specific workspace filter
    if (filters.workspaceId && !accessibleWorkspaceIds.includes(filters.workspaceId)) {
      return NextResponse.json(
        createErrorResponse('Access denied to this workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

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

    // Build where clause with priority-based sorting
    const where: Prisma.taskWhereInput = {
      workspaceId: filters.workspaceId
        ? filters.workspaceId
        : { in: accessibleWorkspaceIds },
      ...(filters.vpId && { vpId: filters.vpId }),
      ...(filters.channelId && { channelId: filters.channelId }),
      ...(filters.assignedToId && { assignedToId: filters.assignedToId }),
      ...(statusArray && { status: { in: statusArray as any[] } }),
      ...(priorityArray && { priority: { in: priorityArray as any[] } }),
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.tags?.length && { tags: { hasSome: filters.tags } }),
      ...(!filters.includeCompleted && {
        status: { notIn: ['DONE', 'CANCELLED'] },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy with priority-aware sorting
    const orderBy: Prisma.taskOrderByWithRelationInput[] = [];

    // Always sort by priority first (unless sorting by priority)
    if (filters.sortBy !== 'priority') {
      orderBy.push({ priority: 'asc' as const });
    }

    // Then sort by requested field
    if (filters.sortBy === 'dueDate') {
      orderBy.push({ dueDate: filters.sortOrder });
    } else if (filters.sortBy === 'priority') {
      orderBy.push({ priority: filters.sortOrder });
    } else {
      orderBy.push({ [filters.sortBy]: filters.sortOrder });
    }

    // Fetch tasks and total count in parallel
    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          vp: {
            select: {
              id: true,
              role: true,
              user: { select: { name: true, email: true } },
            },
          },
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
    });
  } catch (error) {
    console.error('[GET /api/tasks] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/tasks
 *
 * Create a new task for a VP. Requires authentication and access to the workspace.
 * Validates task dependencies to prevent circular references.
 *
 * Request body:
 * {
 *   "title": "Implement feature",
 *   "description": "Detailed description",
 *   "priority": "HIGH",
 *   "status": "TODO",
 *   "vpId": "vp_123",
 *   "workspaceId": "ws_123",
 *   "estimatedHours": 8,
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "tags": ["feature", "backend"],
 *   "dependsOn": ["task_456"],
 *   "assignedToId": "user_789"
 * }
 *
 * @param request - Next.js request with task creation data
 * @returns Created task object
 *
 * @example
 * ```
 * POST /api/tasks
 * Content-Type: application/json
 *
 * {
 *   "title": "Add authentication",
 *   "priority": "HIGH",
 *   "vpId": "vp_123",
 *   "workspaceId": "ws_123"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', TASK_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
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
    const parseResult = createTaskSchema.safeParse(body);
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

    const input: CreateTaskInput = parseResult.data;

    // Check user has access to workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: input.workspaceId,
        userId: session.user.id,
      },
    });

    if (!workspaceMember) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          TASK_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify VP exists and belongs to the same workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: input.vpId,
      },
      select: { id: true, workspaceId: true },
    });

    if (!vp || (vp.workspaceId && vp.workspaceId !== input.workspaceId)) {
      return NextResponse.json(
        createErrorResponse('VP not found in this workspace', TASK_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Validate task dependencies
    const depValidation = await validateTaskDependencies(
      'new-task', // temporary ID for new task
      input.dependsOn || [],
      input.workspaceId,
    );

    if (!depValidation.isValid) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid task dependencies',
          TASK_ERROR_CODES.DEPENDENCY_VIOLATION,
          {
            circularDependencies: depValidation.circularDependencies,
            unresolvedDependencies: depValidation.unresolvedDependencies,
          },
        ),
        { status: 400 },
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
          createErrorResponse('Assignee not found', TASK_ERROR_CODES.ASSIGNEE_NOT_FOUND),
          { status: 404 },
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
        vpId: input.vpId,
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        createdById: session.user.id,
        assignedToId: input.assignedToId,
      },
      include: {
        vp: {
          select: {
            id: true,
            role: true,
            user: { select: { name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ data: task, message: 'Task created successfully' }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/tasks] Error:', error);

    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Required resource not found', TASK_ERROR_CODES.NOT_FOUND),
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
