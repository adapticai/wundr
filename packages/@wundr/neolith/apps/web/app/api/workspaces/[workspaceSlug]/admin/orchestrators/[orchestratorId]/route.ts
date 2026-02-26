/**
 * Admin Orchestrator Management Routes
 *
 * Single orchestrator admin operations
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
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
 * PATCH - Update orchestrator status
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
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
    const { status } = body;

    const orchestrator = await prisma.orchestrator.update({
      where: { id: orchestratorId },
      data: { status },
    });

    return NextResponse.json({ orchestrator });
  } catch (error) {
    console.error('[PATCH orchestrator]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE - Delete orchestrator
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
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

    await prisma.orchestrator.delete({
      where: { id: orchestratorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE orchestrator]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
