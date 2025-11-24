/**
 * Workflow by ID API Routes
 *
 * Handles getting, updating, and deleting a specific workflow.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/:workflowId - Get workflow details
 * - PATCH /api/workspaces/:workspaceId/workflows/:workflowId - Update workflow
 * - DELETE /api/workspaces/:workspaceId/workflows/:workflowId - Delete workflow
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateWorkflowSchema,
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { UpdateWorkflowInput } from '@/lib/validations/workflow';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; workflowId: string }>;
}

/**
 * Helper to check workspace access and get workflow
 */
async function getWorkflowWithAccess(
  workspaceId: string,
  workflowId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) return { error: 'workspace_not_found' };

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) return { error: 'workspace_not_found' };

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  const workflow = await prisma.workflow.findUnique({
    where: {
      id: workflowId,
      workspaceId,
    },
    include: {
      _count: {
        select: {
          executions: true,
        },
      },
    },
  });

  if (!workflow) return { error: 'workflow_not_found' };

  return {
    workspace,
    orgMembership,
    workspaceMembership,
    workflow,
  };
}

/**
 * GET /api/workspaces/:workspaceId/workflows/:workflowId
 *
 * Get details of a specific workflow.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and workflowId
 * @returns Workflow details
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
          { status: 404 }
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ workflow: result.workflow });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows/:workflowId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceId/workflows/:workflowId
 *
 * Update a workflow.
 *
 * @param request - Next.js request with update data
 * @param context - Route context with workspaceId and workflowId
 * @returns Updated workflow
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
          { status: 404 }
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 }
        );
      }
    }

    // Must be workspace member to update workflows
    if (!result.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse('You must be a workspace member to update workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', WORKFLOW_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateWorkflowSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          WORKFLOW_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateWorkflowInput = parseResult.data;

    // Build update data
    const updateData: Prisma.WorkflowUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.trigger !== undefined) updateData.trigger = input.trigger as Prisma.InputJsonValue;
    if (input.actions !== undefined) updateData.actions = input.actions as unknown as Prisma.InputJsonValue;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.metadata !== undefined) updateData.metadata = input.metadata as Prisma.InputJsonValue;

    // Update workflow
    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updateData,
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    return NextResponse.json({ workflow, message: 'Workflow updated successfully' });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceId/workflows/:workflowId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/workflows/:workflowId
 *
 * Delete a workflow.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and workflowId
 * @returns Success response
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', WORKFLOW_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    // Get params
    const params = await context.params;
    const { workspaceId, workflowId } = params;

    // Get workflow with access check
    const result = await getWorkflowWithAccess(workspaceId, workflowId, session.user.id);

    if ('error' in result) {
      if (result.error === 'workspace_not_found') {
        return NextResponse.json(
          createErrorResponse('Workspace not found or access denied', WORKFLOW_ERROR_CODES.WORKSPACE_NOT_FOUND),
          { status: 404 }
        );
      }
      if (result.error === 'workflow_not_found') {
        return NextResponse.json(
          createErrorResponse('Workflow not found', WORKFLOW_ERROR_CODES.WORKFLOW_NOT_FOUND),
          { status: 404 }
        );
      }
    }

    // Must be workspace admin to delete workflows
    if (!result.workspaceMembership || result.workspaceMembership.role !== 'ADMIN') {
      return NextResponse.json(
        createErrorResponse('Admin role required to delete workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Delete workflow and its executions in a transaction
    await prisma.$transaction([
      prisma.workflowExecution.deleteMany({
        where: { workflowId },
      }),
      prisma.workflow.delete({
        where: { id: workflowId },
      }),
    ]);

    return NextResponse.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/workflows/:workflowId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 }
    );
  }
}
