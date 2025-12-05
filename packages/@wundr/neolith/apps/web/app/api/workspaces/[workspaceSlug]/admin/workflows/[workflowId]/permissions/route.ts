/**
 * Workflow Permissions API Routes
 *
 * Handles workflow permission management.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions - Get permissions
 * - PUT /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions - Update permissions
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/[workflowId]/permissions/route
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
 * GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions
 *
 * Get workflow permissions for all workspace members
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

    // Get workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { metadata: true },
    });

    if (!workflow || workflow.metadata === null) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get workspace members
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Extract permissions from workflow metadata
    const workflowMetadata = workflow.metadata as any;
    const savedPermissions = workflowMetadata?.permissions || {};

    // Build permissions array
    const permissions = workspaceMembers.map(member => ({
      userId: member.user.id,
      userName: member.user.name || 'Unknown',
      userEmail: member.user.email || '',
      canExecute: savedPermissions[member.user.id]?.canExecute ?? true,
      canEdit: savedPermissions[member.user.id]?.canEdit ?? false,
    }));

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions
 *
 * Update workflow permissions
 */
export async function PUT(
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

    const body = await request.json();
    const { permissions } = body;

    // Get current workflow
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { metadata: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Build permissions object
    const permissionsMap: Record<string, { canExecute: boolean; canEdit: boolean }> = {};
    for (const perm of permissions) {
      permissionsMap[perm.userId] = {
        canExecute: perm.canExecute,
        canEdit: perm.canEdit,
      };
    }

    // Update workflow metadata
    const currentMetadata = (workflow.metadata || {}) as any;
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        metadata: {
          ...currentMetadata,
          permissions: permissionsMap,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/permissions]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
