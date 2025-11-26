/**
 * VP Backlog Route
 *
 * Retrieves filtered tasks (backlog) for a specific VP.
 * Provides priority-sorted task list for VP management.
 *
 * Routes:
 * - GET /api/vps/[id]/backlog - Get VP's task backlog
 *
 * @module app/api/vps/[id]/backlog/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpBacklogFiltersSchema,
  createErrorResponse,
  TASK_ERROR_CODES,
} from '@/lib/validations/task';

import type { VPBacklogFiltersInput } from '@/lib/validations/task';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * GET /api/vps/[id]/backlog
 *
 * Retrieve VP's task backlog with filtering, pagination, and priority-based sorting.
 * Returns tasks assigned to or created for the VP, sorted by priority and due date.
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
 * @param params - Route parameters (id = VP ID)
 * @returns VP's filtered task backlog with pagination
 *
 * @example
 * ```
 * GET /api/vps/vp_123/backlog?status=TODO,IN_PROGRESS&priority=CRITICAL,HIGH&sortBy=priority
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    // Get VP ID from params
    const resolvedParams = await params;
    const vpId = resolvedParams.id;

    // Validate VP ID format
    if (!vpId || vpId.length === 0) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID', TASK_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify VP exists
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      select: { id: true, workspaceId: true, userId: true },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', TASK_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to VP's workspace
    let workspaceMember = null;
    if (vp.workspaceId) {
      workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: vp.workspaceId,
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
    const where: Prisma.TaskWhereInput = {
      vpId,
      ...(statusArray && { status: { in: statusArray as any[] } }),
      ...(priorityArray && { priority: { in: priorityArray as any[] } }),
      ...(!filters.includeCompleted && {
        status: { notIn: ['DONE', 'CANCELLED'] },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy with intelligent sorting
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];

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
          creator: { select: { id: true, name: true, email: true } },
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
    const metricsWhere: Prisma.TaskWhereInput = { vpId };
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
        vpId,
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
    console.error('[GET /api/vps/[id]/backlog] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', TASK_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
