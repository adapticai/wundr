/**
 * Bulk Orchestrator Operations
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
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

  if (!orgMembership || !['OWNER', 'ADMIN'].includes(orgMembership.role)) {
    return null;
  }

  return { workspace, orgMembership };
}

/**
 * PATCH - Bulk update orchestrators
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { orchestratorIds, action } = body as {
      orchestratorIds: string[];
      action: 'enable' | 'disable';
    };

    const newStatus = action === 'enable' ? 'ONLINE' : 'OFFLINE';

    await prisma.orchestrator.updateMany({
      where: {
        id: { in: orchestratorIds },
        organizationId: access.workspace.organizationId,
      },
      data: { status: newStatus },
    });

    return NextResponse.json({ success: true, updated: orchestratorIds.length });
  } catch (error) {
    console.error('[PATCH bulk orchestrators]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
