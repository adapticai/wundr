/**
 * Workflow API Routes
 *
 * Handles listing and creating workflows for a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows - List workflows
 * - POST /api/workspaces/:workspaceId/workflows - Create a new workflow
 *
 * @module app/api/workspaces/[workspaceId]/workflows/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createWorkflowSchema,
  workflowFiltersSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { CreateWorkflowInput, WorkflowFiltersInput } from '@/lib/validations/workflow';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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
        workspaceId,
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
 * GET /api/workspaces/:workspaceId/workflows
 *
 * List workflows in a workspace with optional filtering and pagination.
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context with workspaceId
 * @returns Paginated list of workflows
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/workflows?status=ACTIVE&trigger=message.created&limit=20
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

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = workflowFiltersSchema.safeParse(searchParams);

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

    const filters: WorkflowFiltersInput = parseResult.data;

    // Build where clause
    const where: Prisma.workflowWhereInput = {
      workspaceId,
      ...(filters.status && { status: filters.status }),
      ...(filters.trigger && {
        trigger: {
          path: ['type'],
          equals: filters.trigger,
        },
      }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.tags && filters.tags.length > 0 && {
        tags: { hasSome: filters.tags },
      }),
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy
    const orderBy: Prisma.workflowOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch workflows and total count in parallel
    const [workflows, totalCount] = await Promise.all([
      prisma.workflow.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: {
            select: {
              workflowExecutions: true,
            },
          },
        },
      }),
      prisma.workflow.count({ where }),
    ]);

    // Enhance workflows with computed statistics and map to frontend types
    const enhancedWorkflows = workflows.map((workflow) => {
      const actions = workflow.actions as unknown as Array<{ type: string }>;

      // Map database status to frontend status
      const mapStatus = (dbStatus: string): 'active' | 'inactive' | 'draft' | 'error' => {
        const statusMap: Record<string, 'active' | 'inactive' | 'draft' | 'error'> = {
          'ACTIVE': 'active',
          'INACTIVE': 'inactive',
          'DRAFT': 'draft',
          'ARCHIVED': 'inactive',
        };
        return statusMap[dbStatus] || 'draft';
      };

      return {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: mapStatus(workflow.status),
        workspaceId: workflow.workspaceId,
        trigger: workflow.trigger,
        actions: actions,
        variables: [],
        createdAt: workflow.createdAt.toISOString(),
        updatedAt: workflow.updatedAt.toISOString(),
        createdBy: workflow.createdBy,
        lastRunAt: workflow.lastExecutedAt?.toISOString(),
        runCount: workflow.executionCount,
        errorCount: workflow.failureCount,
      };
    });

    return NextResponse.json({
      workflows: enhancedWorkflows,
      total: totalCount,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(totalCount / filters.limit),
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/workflows
 *
 * Create a new workflow in a workspace.
 *
 * @param request - Next.js request with workflow data
 * @param context - Route context with workspaceId
 * @returns Created workflow object
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/workflows
 * Content-Type: application/json
 *
 * {
 *   "name": "Welcome New Members",
 *   "description": "Send a welcome message when a new member joins",
 *   "trigger": { "type": "member.joined" },
 *   "actions": [{ "type": "message.send", "config": { "message": "Welcome!" } }]
 * }
 * ```
 */
export async function POST(
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

    // Get workspace ID from params
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check workspace access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Must be workspace member to create workflows
    if (!access.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse('You must be a workspace member to create workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', WORKFLOW_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createWorkflowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateWorkflowInput = parseResult.data;

    // Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        trigger: input.trigger as Prisma.InputJsonValue,
        actions: input.actions as unknown as Prisma.InputJsonValue,
        status: input.status,
        tags: input.tags ?? [],
        metadata: input.metadata as Prisma.InputJsonValue,
        workspaceId,
        createdBy: session.user.id,
      },
      include: {
        _count: {
          select: {
            workflowExecutions: true,
          },
        },
      },
    });

    // Map to frontend type format
    const actions = workflow.actions as unknown as Array<{ type: string }>;

    // Map database status to frontend status
    const mapStatus = (dbStatus: string): 'active' | 'inactive' | 'draft' | 'error' => {
      const statusMap: Record<string, 'active' | 'inactive' | 'draft' | 'error'> = {
        'ACTIVE': 'active',
        'INACTIVE': 'inactive',
        'DRAFT': 'draft',
        'ARCHIVED': 'inactive',
      };
      return statusMap[dbStatus] || 'draft';
    };

    const enhancedWorkflow = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: mapStatus(workflow.status),
      workspaceId: workflow.workspaceId,
      trigger: workflow.trigger,
      actions: actions,
      variables: [],
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      createdBy: workflow.createdBy,
      lastRunAt: workflow.lastExecutedAt?.toISOString(),
      runCount: workflow.executionCount,
      errorCount: workflow.failureCount,
    };

    return NextResponse.json(
      { workflow: enhancedWorkflow, message: 'Workflow created successfully' },
      { status: 201 },
    );
  } catch (error) {
    // Handle Prisma unique constraint errors
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'A workflow with this name already exists in the workspace',
          WORKFLOW_ERROR_CODES.WORKFLOW_ALREADY_EXISTS,
        ),
        { status: 409 },
      );
    }

    console.error('[POST /api/workspaces/:workspaceId/workflows] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
