/**
 * Workflow Export API Route
 *
 * Handles exporting workflows to JSON with optional metadata and execution history.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/workflows/export - Export workflows to JSON
 * - GET /api/workspaces/:workspaceSlug/workflows/export?ids=id1,id2 - Export specific workflows
 *
 * @module app/api/workspaces/[workspaceSlug]/workflows/export/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceSlug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Export options
 */
interface ExportOptions {
  includeExecutionHistory?: boolean;
  includeMetadata?: boolean;
  includeVariables?: boolean;
  includePermissions?: boolean;
  prettyPrint?: boolean;
}

/**
 * Export request body for POST
 */
interface ExportRequestBody {
  workflowIds: string[];
  options?: ExportOptions;
}

/**
 * Exported workflow structure
 */
interface ExportedWorkflow {
  version: string;
  exportedAt: string;
  workflow: Record<string, unknown>;
  executionHistory?: unknown[];
  permissions?: unknown[];
}

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
    include: {
      organization: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * Helper to export workflows with options
 */
async function exportWorkflows(
  workspaceId: string,
  workflowIds: string[],
  options: ExportOptions = {}
): Promise<ExportedWorkflow[]> {
  const {
    includeExecutionHistory = false,
    includeMetadata = true,
    includeVariables = true,
    includePermissions = false,
  } = options;

  // Fetch workflows
  const workflows = await prisma.workflow.findMany({
    where: {
      id: { in: workflowIds },
      workspaceId,
    },
    include: {
      _count: {
        select: {
          workflowExecutions: true,
        },
      },
    },
  });

  if (workflows.length === 0) {
    throw new Error('No workflows found with the specified IDs');
  }

  // Export each workflow
  const exportedWorkflows = await Promise.all(
    workflows.map(async workflow => {
      const actions = workflow.actions as unknown as Array<{ type: string }>;

      // Map database status to frontend status
      const mapStatus = (
        dbStatus: string
      ): 'active' | 'inactive' | 'draft' | 'error' => {
        const statusMap: Record<
          string,
          'active' | 'inactive' | 'draft' | 'error'
        > = {
          ACTIVE: 'active',
          INACTIVE: 'inactive',
          DRAFT: 'draft',
          ARCHIVED: 'inactive',
        };
        return statusMap[dbStatus] || 'draft';
      };

      const workflowData: Record<string, unknown> = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: mapStatus(workflow.status),
        workspaceId: workflow.workspaceId,
        trigger: workflow.trigger,
        actions: actions,
      };

      // Add metadata if requested
      if (includeMetadata) {
        workflowData.createdAt = workflow.createdAt.toISOString();
        workflowData.updatedAt = workflow.updatedAt.toISOString();
        workflowData.createdBy = workflow.createdBy;
        workflowData.lastRunAt = workflow.lastExecutedAt?.toISOString();
        workflowData.runCount = workflow.executionCount;
        workflowData.errorCount = workflow.failureCount;
      }

      // Add variables if requested
      if (includeVariables) {
        workflowData.variables = [];
      }

      const exportData: ExportedWorkflow = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        workflow: workflowData,
      };

      // Fetch execution history if requested
      if (includeExecutionHistory) {
        const executions = await prisma.workflowExecution.findMany({
          where: { workflowId: workflow.id },
          orderBy: { startedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            error: true,
            triggeredBy: true,
          },
        });

        exportData.executionHistory = executions.map(e => ({
          id: e.id,
          status: e.status,
          startedAt: e.startedAt.toISOString(),
          completedAt: e.completedAt?.toISOString(),
          error: e.error,
          triggeredBy: e.triggeredBy,
        }));
      }

      // Add permissions if requested (placeholder for now)
      if (includePermissions) {
        exportData.permissions = [];
      }

      return exportData;
    })
  );

  return exportedWorkflows;
}

/**
 * GET /api/workspaces/:workspaceSlug/workflows/export
 *
 * Export specific workflows by IDs via query parameters.
 *
 * @param request - Next.js request with workflow IDs in query
 * @param context - Route context with workspaceSlug
 * @returns Exported workflows as JSON
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/workflows/export?ids=wf_1,wf_2&includeExecutionHistory=true
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

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const idsParam = searchParams.get('ids');
    const workflowIds = idsParam
      ? idsParam.split(',').map(id => id.trim())
      : [];

    if (workflowIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one workflow ID is required',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse export options from query params
    const options: ExportOptions = {
      includeExecutionHistory:
        searchParams.get('includeExecutionHistory') === 'true',
      includeMetadata: searchParams.get('includeMetadata') !== 'false', // default true
      includeVariables: searchParams.get('includeVariables') !== 'false', // default true
      includePermissions: searchParams.get('includePermissions') === 'true',
      prettyPrint: searchParams.get('prettyPrint') !== 'false', // default true
    };

    // Export workflows
    const exportedWorkflows = await exportWorkflows(
      workspaceId,
      workflowIds,
      options
    );

    // Return single workflow or array based on count
    const responseData =
      exportedWorkflows.length === 1 ? exportedWorkflows[0] : exportedWorkflows;

    // Format response based on prettyPrint option
    if (options.prettyPrint) {
      return new NextResponse(JSON.stringify(responseData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="workflows-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/workflows/export] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        error instanceof Error ? error.message : 'Export failed',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/workflows/export
 *
 * Export workflows with more control via POST body.
 *
 * @param request - Next.js request with workflow IDs and options
 * @param context - Route context with workspaceSlug
 * @returns Exported workflows as JSON
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/workflows/export
 * Content-Type: application/json
 *
 * {
 *   "workflowIds": ["wf_1", "wf_2"],
 *   "options": {
 *     "includeExecutionHistory": true,
 *     "includeMetadata": true,
 *     "prettyPrint": true
 *   }
 * }
 * ```
 */
export async function POST(
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

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Parse request body
    let body: ExportRequestBody;
    try {
      body = (await request.json()) as ExportRequestBody;
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { workflowIds, options = {} } = body;

    if (!Array.isArray(workflowIds) || workflowIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one workflow ID is required',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Export workflows
    const exportedWorkflows = await exportWorkflows(
      workspaceId,
      workflowIds,
      options
    );

    // Return single workflow or array based on count
    const responseData =
      exportedWorkflows.length === 1 ? exportedWorkflows[0] : exportedWorkflows;

    // Format response based on prettyPrint option
    if (options.prettyPrint !== false) {
      return new NextResponse(JSON.stringify(responseData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="workflows-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/workflows/export] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        error instanceof Error ? error.message : 'Export failed',
        WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
