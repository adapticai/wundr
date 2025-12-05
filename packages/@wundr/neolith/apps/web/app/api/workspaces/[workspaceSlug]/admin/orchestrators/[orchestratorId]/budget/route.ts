/**
 * Orchestrator Budget Management
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
 * GET - Get budget settings
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
      budgetLimit?: number;
      budgetUsed?: number;
      billingPeriod?: string;
      alertThreshold?: number;
    } | null;

    return NextResponse.json({
      budgetLimit: capabilities?.budgetLimit || 0,
      currentUsage: capabilities?.budgetUsed || 0,
      billingPeriod: capabilities?.billingPeriod || 'monthly',
      alertThreshold: capabilities?.alertThreshold || 80,
    });
  } catch (error) {
    console.error('[GET budget]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT - Update budget settings
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
    const { budgetLimit, billingPeriod, alertThreshold } = body;

    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    if (!orchestrator) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const capabilities = (orchestrator.capabilities || {}) as {
      budgetLimit?: number;
      budgetUsed?: number;
      billingPeriod?: string;
      alertThreshold?: number;
    };

    const updatedCapabilities = {
      ...capabilities,
      budgetLimit,
      billingPeriod,
      alertThreshold,
    };

    await prisma.orchestrator.update({
      where: { id: orchestratorId },
      data: { capabilities: updatedCapabilities as any },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT budget]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
