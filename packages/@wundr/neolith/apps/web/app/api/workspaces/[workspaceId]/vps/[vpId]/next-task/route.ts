/**
 * VP Next Task Polling API Routes
 *
 * Handles intelligent task selection for VPs based on priority,
 * dependencies, deadlines, and VP capabilities.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceId]/vps/[vpId]/next-task - Get next highest priority task
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/next-task/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse } from '@/lib/validations/task';
import {
  nextTaskFiltersSchema,
  BACKLOG_ERROR_CODES,
} from '@/lib/validations/task-backlog';

import type { NextTaskFiltersInput } from '@/lib/validations/task-backlog';
import type { Prisma, TaskPriority } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Priority order for task selection
 * CRITICAL = highest priority, LOW = lowest priority
 */
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * GET /api/workspaces/[workspaceId]/vps/[vpId]/next-task
 *
 * Returns the highest priority unassigned task the VP can work on.
 * Task selection criteria:
 * 1. CRITICAL priority first
 * 2. Then HIGH priority
 * 3. Then tasks with approaching deadlines
 * 4. Then MEDIUM/LOW priority
 *
 * Filters out tasks with unmet dependencies.
 *
 * Query Parameters:
 * - status: Filter by status (default: TODO)
 * - minPriority: Minimum priority to consider (CRITICAL, HIGH, MEDIUM, LOW)
 * - capabilities: VP capabilities to match (comma-separated)
 * - deadlineWithinHours: Consider tasks with deadline within X hours
 *
 * @param request - Next.js request object with query parameters
 * @param params - Route parameters (workspaceId, vpId)
 * @returns Next task for VP to work on, or null if none available
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/vps/vp_456/next-task?status=TODO&minPriority=HIGH
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; vpId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user (can be VP or human)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', BACKLOG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate route parameters
    const resolvedParams = await params;
    const { workspaceId, vpId } = resolvedParams;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createErrorResponse('Invalid parameters', BACKLOG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Verify VP exists and belongs to workspace
    const vp = await prisma.vP.findFirst({
      where: {
        id: vpId,
      },
      select: {
        id: true,
        role: true,
        capabilities: true,
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

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', BACKLOG_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // VP can be workspace-specific or organization-wide
    if (vp.workspaceId && vp.workspaceId !== workspaceId) {
      return NextResponse.json(
        createErrorResponse('VP not found in this workspace', BACKLOG_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to workspace (or is the VP itself)
    const isVPUser = session.user.id === vp.user.id;
    if (!isVPUser) {
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
            BACKLOG_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = nextTaskFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          BACKLOG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: NextTaskFiltersInput = parseResult.data;

    // Normalize status filter
    const statusArray =
      typeof filters.status === 'string' ? [filters.status] : filters.status;

    // Build base where clause
    const where: Prisma.taskWhereInput = {
      vpId,
      workspaceId,
      status: { in: statusArray as any[] },
      // Only unassigned or assigned to this VP
      OR: [
        { assignedToId: null },
        { assignedToId: vp.user.id },
      ],
    };

    // Apply minimum priority filter if specified
    if (filters.minPriority) {
      const minPriorityValue = PRIORITY_ORDER[filters.minPriority];
      const allowedPriorities = Object.entries(PRIORITY_ORDER)
        .filter(([_, value]) => value <= minPriorityValue)
        .map(([key]) => key);

      where.priority = { in: allowedPriorities as any[] };
    }

    // Apply deadline filter if specified
    if (filters.deadlineWithinHours) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + filters.deadlineWithinHours);

      where.dueDate = {
        lte: deadline,
        gte: new Date(), // Not overdue yet
      };
    }

    // Fetch candidate tasks
    const candidateTasks = await prisma.task.findMany({
      where,
      include: {
        workspace: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        channel: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: 'asc' }, // CRITICAL first
        { dueDate: 'asc' }, // Then by deadline
        { createdAt: 'asc' }, // Then oldest first
      ],
    });

    if (candidateTasks.length === 0) {
      return NextResponse.json({
        data: null,
        message: 'No available tasks for this VP',
      });
    }

    // Filter out tasks with unmet dependencies
    const availableTasks = [];

    for (const task of candidateTasks) {
      if (task.dependsOn.length === 0) {
        // No dependencies, task is available
        availableTasks.push(task);
        continue;
      }

      // Check if all dependencies are completed
      const unmetDependencies = await prisma.task.findMany({
        where: {
          id: { in: task.dependsOn },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        select: { id: true },
      });

      if (unmetDependencies.length === 0) {
        // All dependencies are met
        availableTasks.push(task);
      }
    }

    if (availableTasks.length === 0) {
      return NextResponse.json({
        data: null,
        message: 'No tasks available - all tasks have unmet dependencies',
        metadata: {
          totalCandidates: candidateTasks.length,
          blockedByDependencies: candidateTasks.length,
        },
      });
    }

    // Match VP capabilities if provided in filters
    let selectedTask = availableTasks[0];

    if (filters.capabilities && filters.capabilities.length > 0) {
      // Try to find a task that matches VP capabilities
      const vpCapabilities = Array.isArray(vp.capabilities)
        ? vp.capabilities
        : [];

      for (const task of availableTasks) {
        const taskMetadata = task.metadata as { requiredCapabilities?: string[] } | null;
        const requiredCapabilities = taskMetadata?.requiredCapabilities || [];

        if (requiredCapabilities.length === 0) {
          // No specific requirements, task is suitable
          selectedTask = task;
          break;
        }

        // Check if VP has all required capabilities
        const hasAllCapabilities = requiredCapabilities.every((cap) =>
          vpCapabilities.includes(cap),
        );

        if (hasAllCapabilities) {
          selectedTask = task;
          break;
        }
      }
    }

    return NextResponse.json({
      data: selectedTask,
      vp: {
        id: vp.id,
        role: vp.role,
        user: vp.user,
      },
      metadata: {
        totalAvailable: availableTasks.length,
        totalCandidates: candidateTasks.length,
        selectionCriteria: {
          priority: selectedTask.priority,
          hasDependencies: selectedTask.dependsOn.length > 0,
          hasDueDate: !!selectedTask.dueDate,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/[workspaceId]/vps/[vpId]/next-task] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', BACKLOG_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
