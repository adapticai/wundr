/**
 * Workflow Executions API Route
 *
 * Handles listing execution history for a specific workflow.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId/executions - List executions
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/executions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  executionFiltersSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { ExecutionFiltersInput } from '@/lib/validations/workflow';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/workflows/:workflowId/executions
 *
 * List execution history for a workflow.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId and workflowId
 * @returns Paginated list of executions
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/workflows/wf_456/executions?status=COMPLETED&limit=10
 * ```
 */
export async function GET(
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
          WORKFLOW_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: workflowId,
        workspaceId,
      },
    });

    if (!workflow) {
      return NextResponse.json(
        createErrorResponse(
          'Workflow not found',
          WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = executionFiltersSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const filters: ExecutionFiltersInput = parseResult.data;

    // Build where clause
    const where: Prisma.workflowExecutionWhereInput = {
      workflowId,
      workspaceId,
      ...(filters.status && { status: filters.status }),
      ...(filters.from && { startedAt: { gte: filters.from } }),
      ...(filters.to && { startedAt: { lte: filters.to } }),
    };

    // Fetch executions, total count, and statistics in parallel
    const [executions, totalCount, statusCounts] = await Promise.all([
      prisma.workflowExecution.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: { startedAt: 'desc' },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.workflowExecution.count({ where }),
      // Get status breakdown
      prisma.workflowExecution.groupBy({
        by: ['status'],
        where: {
          workflowId,
          workspaceId,
        },
        _count: {
          status: true,
        },
      }),
    ]);

    // Calculate statistics
    const stats = {
      total: totalCount,
      byStatus: statusCounts.reduce(
        (acc, { status, _count }) => {
          acc[status] = _count.status;
          return acc;
        },
        {} as Record<string, number>
      ),
      successRate:
        totalCount > 0
          ? Math.round(
              ((statusCounts.find(s => s.status === 'COMPLETED')?._count
                .status ?? 0) /
                totalCount) *
                100
            )
          : 0,
    };

    // Calculate average duration for completed executions
    const completedExecutions = await prisma.workflowExecution.aggregate({
      where: {
        workflowId,
        workspaceId,
        status: 'COMPLETED',
        durationMs: { not: null },
      },
      _avg: {
        durationMs: true,
      },
    });

    return NextResponse.json({
      executions,
      pagination: {
        total: totalCount,
        offset: filters.offset,
        limit: filters.limit,
        hasMore: filters.offset + filters.limit < totalCount,
      },
      statistics: {
        ...stats,
        averageDurationMs: completedExecutions._avg.durationMs ?? 0,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/workflows/:workflowId/executions] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
