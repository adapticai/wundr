/**
 * Workflow Bulk Operations API Routes
 *
 * Handles bulk operations on multiple workflows.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceSlug/admin/workflows/bulk - Bulk update workflows
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/bulk/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check admin access
 */
async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { organization: true },
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

  if (!orgMembership || orgMembership.role === 'MEMBER') {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/workflows/bulk
 *
 * Bulk update workflows (enable/disable)
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
    const { workspaceSlug: workspaceId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { workflowIds, action } = body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid workflow IDs' },
        { status: 400 },
      );
    }

    if (!action || !['enable', 'disable'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "enable" or "disable"' },
        { status: 400 },
      );
    }

    const newStatus = action === 'enable' ? 'ACTIVE' : 'INACTIVE';

    // Update workflows
    const result = await prisma.workflow.updateMany({
      where: {
        id: { in: workflowIds },
        workspaceId, // Ensure workflows belong to this workspace
      },
      data: {
        status: newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error('[PATCH /api/workspaces/:workspaceSlug/admin/workflows/bulk]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
