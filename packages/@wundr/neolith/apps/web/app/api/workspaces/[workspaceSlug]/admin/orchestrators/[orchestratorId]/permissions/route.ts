/**
 * Orchestrator Permissions Management
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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

  if (!orgMembership || !['OWNER', 'ADMIN'].includes(orgMembership.role)) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * GET - Get permissions
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
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    if (!orchestrator) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const capabilities = orchestrator.capabilities as {
      allowedUserIds?: string[];
      permissions?: string[];
    } | null;

    return NextResponse.json({
      allowedUserIds: capabilities?.allowedUserIds || [],
      permissions: capabilities?.permissions || ['orchestrator.use'],
    });
  } catch (error) {
    console.error('[GET permissions]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT - Update permissions
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
    const { workspaceSlug: workspaceId, orchestratorId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { allowedUserIds, permissions } = body;

    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    if (!orchestrator) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const capabilities = (orchestrator.capabilities || {}) as {
      allowedUserIds?: string[];
      permissions?: string[];
    };

    const updatedCapabilities = {
      ...capabilities,
      allowedUserIds,
      permissions,
    };

    await prisma.orchestrator.update({
      where: { id: orchestratorId },
      data: { capabilities: updatedCapabilities as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT permissions]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
