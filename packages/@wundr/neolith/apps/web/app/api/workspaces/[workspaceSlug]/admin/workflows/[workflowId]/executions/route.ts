/**
 * Workflow Executions API Routes
 *
 * Handles workflow execution history retrieval.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/executions - Get execution history
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/[workflowId]/executions/route
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
 * GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/executions
 *
 * Get workflow execution history
 */
export async function GET(
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

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const limit = parseInt(searchParams.limit || '50');

    // Verify workflow belongs to workspace
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get executions
    const executions = await prisma.workflowExecution.findMany({
      where: { workflowId },
      take: limit,
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        triggeredBy: true,
        error: true,
      },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/executions]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
