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

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  executionFiltersSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { ExecutionFiltersInput } from '@/lib/validations/workflow';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; workflowId: string }>;
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
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
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
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
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
        createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
        { status: 404 },
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
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: ExecutionFiltersInput = parseResult.data;

    // Build where clause
    const where: Prisma.WorkflowExecutionWhereInput = {
      workflowId,
      workspaceId,
      ...(filters.status && { status: filters.status }),
      ...(filters.from && { startedAt: { gte: filters.from } }),
      ...(filters.to && { startedAt: { lte: filters.to } }),
    };

    // Fetch executions and total count in parallel
    const [executions, totalCount] = await Promise.all([
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
    ]);

    return NextResponse.json({
      executions,
      total: totalCount,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows/:workflowId/executions] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
