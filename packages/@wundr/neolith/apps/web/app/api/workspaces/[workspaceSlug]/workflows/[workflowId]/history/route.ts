/**
 * Workflow Execution History API Route
 *
 * Comprehensive execution history endpoint with:
 * - Pagination (limit, cursor-based)
 * - Status filtering (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, TIMEOUT)
 * - Date range filtering
 * - Single execution details retrieval
 * - Step-by-step execution logs
 * - Input/output data
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId/history - List execution history
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId/history?executionId=:id - Get single execution
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/history/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  executionFiltersSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type {
  ExecutionFiltersInput,
  WorkflowStepResult,
} from '@/lib/validations/workflow';
import type {
  Prisma,
  WorkflowExecution as PrismaworkflowExecution,
} from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * Extended execution data with workflow details
 */
interface ExecutionWithWorkflow extends PrismaworkflowExecution {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    trigger: Prisma.JsonValue;
    status: string;
  };
}

/**
 * Formatted execution response
 */
interface FormattedExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: string;
  triggeredBy: string;
  triggerType: string;
  triggerData: Record<string, unknown> | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  isSimulation: boolean;
  workflow: {
    id: string;
    name: string;
    description: string | null;
    trigger: unknown;
    status: string;
  };
  // Additional fields for single execution
  steps?: WorkflowStepResult[];
  executionSummary?: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
}

/**
 * List response with pagination
 */
interface ListExecutionsResponse {
  executions: FormattedExecution[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Single execution response
 */
interface SingleExecutionResponse {
  execution: FormattedExecution;
}

/**
 * Format execution for response
 */
function formatExecution(
  execution: ExecutionWithWorkflow,
  includeSteps = false
): FormattedExecution {
  const steps = includeSteps
    ? (execution.steps as unknown as WorkflowStepResult[])
    : undefined;

  const formatted: FormattedExecution = {
    id: execution.id,
    workflowId: execution.workflowId,
    workspaceId: execution.workspaceId,
    status: execution.status,
    triggeredBy: execution.triggeredBy,
    triggerType: execution.triggerType,
    triggerData: execution.triggerData as Record<string, unknown> | null,
    error: execution.error,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString() || null,
    durationMs: execution.durationMs,
    isSimulation: execution.isSimulation,
    workflow: {
      id: execution.workflow.id,
      name: execution.workflow.name,
      description: execution.workflow.description,
      trigger: execution.workflow.trigger,
      status: execution.workflow.status,
    },
  };

  // Add step details if requested
  if (includeSteps && steps) {
    formatted.steps = steps;
    formatted.executionSummary = {
      totalSteps: steps.length,
      successfulSteps: steps.filter(s => s.status === 'success').length,
      failedSteps: steps.filter(s => s.status === 'failed').length,
      skippedSteps: steps.filter(s => s.status === 'skipped').length,
    };
  }

  return formatted;
}

/**
 * GET /api/workspaces/:workspaceId/workflows/:workflowId/history
 *
 * List execution history or get single execution details.
 *
 * Query Parameters:
 * - executionId: (optional) Get single execution by ID
 * - status: (optional) Filter by status (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED, TIMEOUT)
 * - from: (optional) Filter by start date (ISO 8601)
 * - to: (optional) Filter by end date (ISO 8601)
 * - limit: (optional) Number of results (default: 20, max: 100)
 * - offset: (optional) Offset for pagination (default: 0)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId and workflowId
 * @returns Execution history list or single execution details
 *
 * @example
 * ```
 * // List executions
 * GET /api/workspaces/ws_123/workflows/wf_456/history?status=COMPLETED&limit=10
 *
 * // Get single execution
 * GET /api/workspaces/ws_123/workflows/wf_456/history?executionId=exec_789
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<
  NextResponse<
    | ListExecutionsResponse
    | SingleExecutionResponse
    | { error: string; message: string }
  >
> {
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
    const searchParams = request.nextUrl.searchParams;
    const executionId = searchParams.get('executionId');

    // Check workspace exists and user has access
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
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

    // Handle single execution request
    if (executionId) {
      const execution = await prisma.workflowExecution.findUnique({
        where: {
          id: executionId,
          workspaceId,
          workflowId,
        },
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
              trigger: true,
              status: true,
            },
          },
        },
      });

      if (!execution) {
        return NextResponse.json(
          createErrorResponse(
            'Execution not found',
            WORKFLOW_ERROR_CODES.EXECUTION_NOT_FOUND
          ),
          { status: 404 }
        );
      }

      // Format with full step details
      const formatted = formatExecution(
        execution as ExecutionWithWorkflow,
        true
      );

      return NextResponse.json({
        execution: formatted,
      });
    }

    // Handle list request with filters
    const searchParamsObj = Object.fromEntries(searchParams);
    const parseResult = executionFiltersSchema.safeParse(searchParamsObj);

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
              description: true,
              trigger: true,
              status: true,
            },
          },
        },
      }),
      prisma.workflowExecution.count({ where }),
    ]);

    // Format executions (without step details for list)
    const formattedExecutions = executions.map(exec =>
      formatExecution(exec as ExecutionWithWorkflow, false)
    );

    return NextResponse.json({
      executions: formattedExecutions,
      pagination: {
        total: totalCount,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < totalCount,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/workflows/:workflowId/history] Error:',
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
