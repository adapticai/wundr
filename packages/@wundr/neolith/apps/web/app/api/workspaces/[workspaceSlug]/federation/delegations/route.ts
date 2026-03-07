/**
 * Federation Task Delegations API Routes
 *
 * Manages task delegation records between federated orchestrator daemon nodes
 * within a workspace organisation.
 *
 * Routes:
 * - GET  /api/workspaces/:workspaceSlug/federation/delegations - List delegations
 * - POST /api/workspaces/:workspaceSlug/federation/delegations - Create a delegation
 *
 * @module app/api/workspaces/[workspaceSlug]/federation/delegations/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

async function resolveWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
    select: { id: true, organizationId: true },
  });
  if (!workspace) return null;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
    select: { role: true },
  });
  if (!orgMembership) return null;

  return { workspace, orgMembership };
}

/**
 * GET /api/workspaces/:workspaceSlug/federation/delegations
 *
 * Returns a paginated list of TaskDelegation records scoped to the orchestrators
 * belonging to the organisation that owns the workspace.
 *
 * Query parameters:
 * - status         string  - Filter by delegation status
 * - fromId         string  - Filter by source orchestrator ID
 * - toId           string  - Filter by target orchestrator ID
 * - limit          number  - Max records (default 50)
 * - page           number  - Page number (default 1)
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status') ?? undefined;
    const fromId = sp.get('fromId') ?? undefined;
    const toId = sp.get('toId') ?? undefined;
    const limit = Math.min(parseInt(sp.get('limit') ?? '50', 10), 200);
    const page = Math.max(parseInt(sp.get('page') ?? '1', 10), 1);
    const skip = (page - 1) * limit;

    // Collect orchestrator IDs that belong to this org
    const orgOrchestrators = await prisma.orchestrator.findMany({
      where: { organizationId: access.workspace.organizationId },
      select: { id: true },
    });
    const orgIds = orgOrchestrators.map(o => o.id);

    const where = {
      // Only delegations where at least one end belongs to this org
      OR: [
        { fromOrchestratorId: { in: orgIds } },
        { toOrchestratorId: { in: orgIds } },
      ],
      ...(status && {
        status: status as
          | 'PENDING'
          | 'IN_PROGRESS'
          | 'COMPLETED'
          | 'FAILED'
          | 'CANCELLED',
      }),
      ...(fromId && { fromOrchestratorId: fromId }),
      ...(toId && { toOrchestratorId: toId }),
    };

    const [delegations, total] = await Promise.all([
      prisma.taskDelegation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.taskDelegation.count({ where }),
    ]);

    return NextResponse.json({
      data: delegations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:slug/federation/delegations]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/federation/delegations
 *
 * Create a task delegation record, routing a task from one orchestrator to another.
 * Requires ADMIN or OWNER role.
 *
 * Request body:
 * - fromOrchestratorId  string   - Source orchestrator ID
 * - toOrchestratorId    string   - Target orchestrator ID
 * - taskType            string   - Type of task being delegated
 * - taskPayload         object   - Task payload data
 * - context             object?  - Optional shared context
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;
    const access = await resolveWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 403 }
      );
    }

    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Organisation admin or owner required.',
        },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      fromOrchestratorId,
      toOrchestratorId,
      taskType,
      taskPayload,
      context: delegationContext,
    } = body;

    if (!fromOrchestratorId || typeof fromOrchestratorId !== 'string') {
      return NextResponse.json(
        { error: 'fromOrchestratorId is required' },
        { status: 400 }
      );
    }
    if (!toOrchestratorId || typeof toOrchestratorId !== 'string') {
      return NextResponse.json(
        { error: 'toOrchestratorId is required' },
        { status: 400 }
      );
    }
    if (!taskType || typeof taskType !== 'string') {
      return NextResponse.json(
        { error: 'taskType is required' },
        { status: 400 }
      );
    }
    if (!taskPayload || typeof taskPayload !== 'object') {
      return NextResponse.json(
        { error: 'taskPayload must be an object' },
        { status: 400 }
      );
    }

    // Verify both orchestrators belong to this organisation
    const [fromOrch, toOrch] = await Promise.all([
      prisma.orchestrator.findFirst({
        where: {
          id: fromOrchestratorId,
          organizationId: access.workspace.organizationId,
        },
        select: { id: true },
      }),
      prisma.orchestrator.findFirst({
        where: {
          id: toOrchestratorId,
          organizationId: access.workspace.organizationId,
        },
        select: { id: true },
      }),
    ]);

    if (!fromOrch) {
      return NextResponse.json(
        { error: 'Source orchestrator not found in this organisation' },
        { status: 404 }
      );
    }
    if (!toOrch) {
      return NextResponse.json(
        { error: 'Target orchestrator not found in this organisation' },
        { status: 404 }
      );
    }

    const delegation = await prisma.taskDelegation.create({
      data: {
        fromOrchestratorId,
        toOrchestratorId,
        taskType,
        taskPayload: taskPayload as object,
        context: delegationContext as object | undefined,
        status: 'PENDING',
      },
    });

    return NextResponse.json(
      { data: delegation, message: 'Task delegation created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:slug/federation/delegations]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
