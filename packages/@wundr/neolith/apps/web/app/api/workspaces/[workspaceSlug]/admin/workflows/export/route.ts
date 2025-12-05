/**
 * Workflow Export API Routes
 *
 * Handles workflow data export.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows/export - Export workflows
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/export/route
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
 * GET /api/workspaces/:workspaceSlug/admin/workflows/export
 *
 * Export all workflows as JSON
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
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
        { status: 404 }
      );
    }

    // Get all workflows
    const workflows = await prisma.workflow.findMany({
      where: { workspaceId },
    });

    // Format for export
    const exportData = {
      exported_at: new Date().toISOString(),
      workspace_id: workspaceId,
      workspace_name: access.workspace.name,
      workflows: workflows.map(workflow => ({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        trigger: workflow.trigger,
        actions: workflow.actions,
        tags: workflow.tags,
        created_by: workflow.createdBy,
        created_at: workflow.createdAt.toISOString(),
        updated_at: workflow.updatedAt.toISOString(),
        execution_count: workflow.executionCount,
        failure_count: workflow.failureCount,
      })),
    };

    // Return as JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="workflows-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/workflows/export]',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
