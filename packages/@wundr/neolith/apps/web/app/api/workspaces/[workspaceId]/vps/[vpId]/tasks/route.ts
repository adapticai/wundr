/**
 * VP-Specific Tasks API Routes
 *
 * Handles task listing and assignment for a specific VP within a workspace.
 * All tasks are scoped to both the workspace and the VP.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks - List tasks for VP
 * - POST /api/workspaces/[workspaceId]/vps/[vpId]/tasks - Assign new task to VP
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/tasks/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { validateTaskDependencies } from '@/lib/services/task-service';
import {
  createTaskSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { CreateTaskInput } from '@/lib/validations/task';
import type { NextRequest } from 'next/server';

/**
 * Route context with params as a Promise (Next.js 16+)
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    vpId: string;
  }>;
}

/**
 * GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks
 *
 * List tasks assigned to a specific VP within a workspace.
 * Supports pagination, filtering by status, and cursor-based navigation.
 *
 * Query Parameters:
 * - limit: Items per page (default 20, max 100)
 * - cursor: Cursor for pagination (task ID)
 * - status: Filter by status (PENDING, IN_PROGRESS, COMPLETED, FAILED) - comma-separated
 * - priority: Filter by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * - includeCompleted: Include completed tasks (default false)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId and vpId
 * @returns Paginated list of tasks for the VP
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/tasks?status=TODO,IN_PROGRESS&limit=50
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext,
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

    const resolvedParams = await params;
    const { workspaceId, vpId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Workspace ID and VP ID are required', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
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
          TASK_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify VP exists and belongs to the workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
      },
      select: { id: true, workspaceId: true, organizationId: true },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', TASK_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check VP belongs to workspace or organization
    if (vp.workspaceId && vp.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('VP does not belong to this workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Parse status filter - map common aliases to actual enum values
    let statusFilter: string[] | undefined;
    if (statusParam) {
      const statusMap: Record<string, string> = {
        PENDING: 'TODO',
        IN_PROGRESS: 'IN_PROGRESS',
        COMPLETED: 'DONE',
        FAILED: 'CANCELLED',
        TODO: 'TODO',
        DONE: 'DONE',
        BLOCKED: 'BLOCKED',
        CANCELLED: 'CANCELLED',
      };

      statusFilter = statusParam
        .split(',')
        .map((s) => statusMap[s.trim().toUpperCase()] || s.trim().toUpperCase())
        .filter((s) => ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'].includes(s));

      if (statusFilter.length === 0) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid status filter. Valid values: PENDING, IN_PROGRESS, COMPLETED, FAILED, TODO, DONE, BLOCKED, CANCELLED',
            TASK_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }
    }

    // Parse priority filter
    let priorityFilter: string[] | undefined;
    if (priorityParam) {
      priorityFilter = priorityParam
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter((p) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(p));

      if (priorityFilter.length === 0) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid priority filter. Valid values: CRITICAL, HIGH, MEDIUM, LOW',
            TASK_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }
    }

    // Build where clause
    const where: Prisma.TaskWhereInput = {
      vpId,
      workspaceId,
      ...(statusFilter && { status: { in: statusFilter as any[] } }),
      ...(priorityFilter && { priority: { in: priorityFilter as any[] } }),
      ...(!includeCompleted &&
        !statusFilter && {
          status: { notIn: ['DONE', 'CANCELLED'] },
        }),
    };

    // Build cursor-based pagination
    const findManyArgs: Prisma.TaskFindManyArgs = {
      where,
      take: limit + 1, // Fetch one extra to determine if there are more results
      orderBy: [
        { priority: 'asc' }, // CRITICAL first
        { createdAt: 'desc' }, // Then newest first
      ],
      include: {
        vp: {
          select: {
            id: true,
            role: true,
            discipline: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    };

    // Add cursor if provided
    if (cursor) {
      findManyArgs.cursor = { id: cursor };
      findManyArgs.skip = 1; // Skip the cursor
    }

    // Fetch tasks
    const tasks = await prisma.task.findMany(findManyArgs);

    // Check if there are more results
    const hasMore = tasks.length > limit;
    if (hasMore) {
      tasks.pop(); // Remove the extra item
    }

    // Get next cursor
    const nextCursor = hasMore && tasks.length > 0 ? tasks[tasks.length - 1].id : null;

    // Get total count for metadata
    const totalCount = await prisma.task.count({ where });

    return NextResponse.json({
      data: tasks,
      pagination: {
        limit,
        cursor: cursor || null,
        nextCursor,
        hasMore,
        totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceId]/vps/[vpId]/tasks] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/vps/[vpId]/tasks
 *
 * Assign a new task to a specific VP. Requires authentication and workspace access.
 * Validates task dependencies and ensures VP belongs to the workspace.
 *
 * Request body:
 * {
 *   "title": "Implement feature",
 *   "description": "Detailed description",
 *   "priority": "HIGH",
 *   "dueDate": "2025-12-31T00:00:00Z",
 *   "dependencies": ["task_456"],
 *   "estimatedHours": 8,
 *   "tags": ["feature", "backend"],
 *   "channelId": "channel_123",
 *   "assignedToId": "user_789"
 * }
 *
 * @param request - Next.js request with task creation data
 * @param context - Route context with workspaceId and vpId
 * @returns Created task object
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/vps/vp_456/tasks
 * Content-Type: application/json
 *
 * {
 *   "title": "Review pull request",
 *   "description": "Review PR #123 for authentication feature",
 *   "priority": "HIGH",
 *   "dueDate": "2025-12-01T00:00:00Z"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext,
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

    const resolvedParams = await params;
    const { workspaceId, vpId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Workspace ID and VP ID are required', TASK_ERROR_CODES.VALIDATION_ERROR),
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

    // Ensure body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse('Request body must be an object', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input - merge route params with body
    const parseResult = createTaskSchema.safeParse({
      ...body,
      vpId,
      workspaceId,
    });

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
        workspaceId,
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

    // Verify VP exists and belongs to the workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
      },
      select: { id: true, workspaceId: true, organizationId: true },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', TASK_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check VP belongs to workspace or organization
    if (vp.workspaceId && vp.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('VP does not belong to this workspace', TASK_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Validate task dependencies
    const depValidation = await validateTaskDependencies(
      'new-task', // temporary ID for new task
      input.dependsOn || [],
      workspaceId,
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

    // Verify channel if provided
    if (input.channelId) {
      const channel = await prisma.channel.findFirst({
        where: {
          id: input.channelId,
          workspaceId,
        },
        select: { id: true },
      });

      if (!channel) {
        return NextResponse.json(
          createErrorResponse('Channel not found in this workspace', TASK_ERROR_CODES.NOT_FOUND),
          { status: 404 },
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

      // Check if assignee has access to workspace
      const assigneeAccess = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: input.assignedToId,
        },
      });

      if (!assigneeAccess) {
        return NextResponse.json(
          createErrorResponse(
            'Assignee does not have access to this workspace',
            TASK_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
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
        vpId,
        workspaceId,
        channelId: input.channelId,
        createdById: session.user.id,
        assignedToId: input.assignedToId,
      },
      include: {
        vp: {
          select: {
            id: true,
            role: true,
            discipline: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        workspace: { select: { id: true, name: true } },
        channel: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      { data: task, message: 'Task assigned successfully to VP' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/[workspaceId]/vps/[vpId]/tasks] Error:', error);

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
          createErrorResponse('Foreign key constraint failed', TASK_ERROR_CODES.VALIDATION_ERROR),
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
