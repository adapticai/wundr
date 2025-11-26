/**
 * Workflow Execution by ID API Routes
 *
 * Handles getting and cancelling a specific workflow execution.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/workflows/executions/:executionId - Get execution details
 * - DELETE /api/workspaces/:workspaceId/workflows/executions/:executionId - Cancel execution
 *
 * @module app/api/workspaces/[workspaceId]/workflows/executions/[executionId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  WORKFLOW_ERROR_CODES,
} from '@/lib/validations/workflow';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspaceId and executionId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; executionId: string }>;
}

/**
 * GET /api/workspaces/:workspaceId/workflows/executions/:executionId
 *
 * Get details of a specific workflow execution.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and executionId
 * @returns Execution details
 */
export async function GET(
  _request: NextRequest,
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
    const { workspaceId, executionId } = params;

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

    // Get execution
    const execution = await prisma.workflowExecution.findUnique({
      where: {
        id: executionId,
        workspaceId,
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
        createErrorResponse('Execution not found', WORKFLOW_ERROR_CODES.EXECUTION_NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ execution });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/workflows/executions/:executionId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/workflows/executions/:executionId
 *
 * Cancel a running workflow execution.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and executionId
 * @returns Success response
 */
export async function DELETE(
  _request: NextRequest,
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
    const { workspaceId, executionId } = params;

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

    // Check workspace membership
    const workspaceMembership = await prisma.workspace_members.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse('You must be a workspace member to cancel executions', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get execution
    const execution = await prisma.workflowExecution.findUnique({
      where: {
        id: executionId,
        workspaceId,
      },
    });

    if (!execution) {
      return NextResponse.json(
        createErrorResponse('Execution not found', WORKFLOW_ERROR_CODES.EXECUTION_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if execution can be cancelled
    if (!['PENDING', 'RUNNING'].includes(execution.status)) {
      return NextResponse.json(
        createErrorResponse(
          `Cannot cancel execution with status: ${execution.status}`,
          WORKFLOW_ERROR_CODES.EXECUTION_FAILED,
        ),
        { status: 400 },
      );
    }

    // Cancel execution
    const updatedExecution = await prisma.workflowExecution.update({
      where: { id: executionId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
        error: 'Cancelled by user',
      },
    });

    return NextResponse.json({
      success: true,
      execution: updatedExecution,
      message: 'Execution cancelled successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/workflows/executions/:executionId] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
