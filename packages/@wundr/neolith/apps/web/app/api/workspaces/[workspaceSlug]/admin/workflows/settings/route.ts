/**
 * Workflow Default Settings API Routes
 *
 * Handles workspace-level workflow default settings.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows/settings - Get default settings
 * - PUT /api/workspaces/:workspaceSlug/admin/workflows/settings - Update default settings
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/settings/route
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

const DEFAULT_SETTINGS = {
  autoEnable: false,
  maxExecutionTime: 300,
  retryOnFailure: true,
  retryCount: 3,
  notifyOnFailure: true,
  notifyOnSuccess: false,
};

/**
 * GET /api/workspaces/:workspaceSlug/admin/workflows/settings
 *
 * Get workspace workflow default settings
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
    const { workspaceSlug: workspaceId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 },
      );
    }

    // Get workspace settings from metadata
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const workspaceSettings = (workspace?.settings || {}) as any;
    const settings = {
      ...DEFAULT_SETTINGS,
      ...workspaceSettings.workflowDefaults,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug]/admin/workflows/settings]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/workspaces/:workspaceSlug/admin/workflows/settings
 *
 * Update workspace workflow default settings
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
    const { workspaceSlug: workspaceId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { settings } = body;

    // Get current workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const currentSettings = (workspace?.settings || {}) as any;

    // Update workspace settings
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...currentSettings,
          workflowDefaults: settings,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/workspaces/:workspaceSlug/admin/workflows/settings]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
