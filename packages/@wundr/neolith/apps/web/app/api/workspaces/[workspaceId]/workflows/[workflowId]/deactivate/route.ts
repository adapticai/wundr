/**
 * Workflow Deactivate API Route
 *
 * Handles deactivating a workflow.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/workflows/:workflowId/deactivate - Deactivate workflow
 *
 * @module app/api/workspaces/[workspaceId]/workflows/[workflowId]/deactivate/route
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
 * Route context with workspaceId and workflowId parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; workflowId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/workflows/:workflowId/deactivate
 *
 * Deactivate a workflow.
 *
 * @param _request - Next.js request object
 * @param context - Route context with workspaceId and workflowId
 * @returns Deactivated workflow
 */
export async function POST(
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
        createErrorResponse('You must be a workspace member to deactivate workflows', WORKFLOW_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Get workflow
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

    // Check if workflow is already inactive
    if (workflow.status === 'INACTIVE') {
      return NextResponse.json({ workflow, message: 'Workflow is already inactive' });
    }

    // Check if workflow is archived
    if (workflow.status === 'ARCHIVED') {
      return NextResponse.json(
        createErrorResponse('Cannot deactivate an archived workflow', WORKFLOW_ERROR_CODES.WORKFLOW_INACTIVE),
        { status: 400 },
      );
    }

    // Deactivate workflow
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'INACTIVE' },
      include: {
        _count: {
          select: {
            executions: true,
          },
        },
      },
    });

    return NextResponse.json({ workflow: updatedWorkflow, message: 'Workflow deactivated successfully' });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/workflows/:workflowId/deactivate] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', WORKFLOW_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
