/**
 * Admin Single Workflow API Routes
 *
 * Handles admin-level operations on individual workflows.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceSlug/admin/workflows/:workflowId - Update workflow
 * - DELETE /api/workspaces/:workspaceSlug/admin/workflows/:workflowId - Delete workflow
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/[workflowId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; workflowId: string }>;
}

/**
 * Helper to check admin access
 */
async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { organization: true },
  });

  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership || orgMembership.role === 'MEMBER') {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/workflows/:workflowId
 *
 * Update workflow status or other admin settings
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 },
      );
    }

    // Verify workflow belongs to workspace
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body;

    // Update workflow
    const updatedWorkflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        ...(status && { status }),
      },
    });

    return NextResponse.json({ workflow: updatedWorkflow });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceSlug/admin/workflows/:workflowId]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/admin/workflows/:workflowId
 *
 * Delete a workflow and all associated data
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId, workflowId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 },
      );
    }

    // Verify workflow belongs to workspace
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Delete workflow executions first
    await prisma.workflowExecution.deleteMany({
      where: { workflowId },
    });

    // Delete workflow
    await prisma.workflow.delete({
      where: { id: workflowId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceSlug/admin/workflows/:workflowId]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
