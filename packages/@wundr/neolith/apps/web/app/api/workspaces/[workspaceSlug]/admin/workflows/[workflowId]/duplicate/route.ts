/**
 * Workflow Duplicate API Routes
 *
 * Handles workflow duplication.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/duplicate - Duplicate workflow
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/[workflowId]/duplicate/route
 */

import { prisma, Prisma } from '@neolith/database';
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
 * POST /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/duplicate
 *
 * Duplicate a workflow
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
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
        { status: 404 }
      );
    }

    // Get original workflow
    const originalWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!originalWorkflow || originalWorkflow.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Create duplicate
    const duplicatedWorkflow = await prisma.workflow.create({
      data: {
        name: `${originalWorkflow.name} (Copy)`,
        description: originalWorkflow.description,
        trigger: (originalWorkflow.trigger ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        actions: (originalWorkflow.actions ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        status: 'DRAFT', // Always start as draft
        tags: Array.isArray(originalWorkflow.tags) ? originalWorkflow.tags : [],
        metadata: (originalWorkflow.metadata ??
          Prisma.JsonNull) as Prisma.InputJsonValue,
        workspaceId: originalWorkflow.workspaceId,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({ workflow: duplicatedWorkflow });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/duplicate]',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
