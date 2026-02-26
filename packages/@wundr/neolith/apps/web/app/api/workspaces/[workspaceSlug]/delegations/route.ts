/**
 * Delegations API Route
 *
 * Returns task delegation records scoped to a workspace organisation.
 * Consumed by the DelegationChainVisualization component.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/delegations - List task delegations
 *
 * Query parameters:
 * - taskId         (string, optional) - Filter to a specific task
 * - orchestratorId (string, optional) - Filter to delegations involving an orchestrator
 * - limit          (number, optional) - Maximum records to return (default 100)
 *
 * @module app/api/workspaces/[workspaceSlug]/delegations/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Shape returned for each delegation record
 */
interface DelegationRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  fromOrchestratorId: string;
  fromOrchestratorTitle: string;
  toOrchestratorId: string;
  toOrchestratorTitle: string;
  discipline: string | undefined;
  delegatedAt: string;
  completedAt: string | undefined;
  status: string;
  priority: string;
  note: string | undefined;
}

/**
 * Raw row returned by the taskDelegation findMany query
 */
interface RawDelegationRow {
  id: string;
  taskId: string;
  taskTitle?: string | null;
  task?: { subject?: string | null } | null;
  fromOrchestratorId: string;
  fromOrchestrator?: {
    id: string;
    title: string;
    discipline?: string | null;
  } | null;
  toOrchestratorId: string;
  toOrchestrator?: {
    id: string;
    title: string;
    discipline?: string | null;
  } | null;
  createdAt: Date;
  completedAt?: Date | null;
  status?: string | null;
  priority?: string | null;
  note?: string | null;
}

/**
 * Map a raw database row to the DelegationRecord shape expected by the client.
 */
function mapDelegation(d: RawDelegationRow): DelegationRecord {
  return {
    id: d.id,
    taskId: d.taskId,
    taskTitle: d.taskTitle ?? d.task?.subject ?? 'Untitled Task',
    fromOrchestratorId: d.fromOrchestratorId,
    fromOrchestratorTitle: d.fromOrchestrator?.title ?? 'Unknown',
    toOrchestratorId: d.toOrchestratorId,
    toOrchestratorTitle: d.toOrchestrator?.title ?? 'Unknown',
    discipline: d.toOrchestrator?.discipline ?? undefined,
    delegatedAt: d.createdAt.toISOString(),
    completedAt: d.completedAt?.toISOString(),
    status: d.status ?? 'pending',
    priority: d.priority ?? 'normal',
    note: d.note ?? undefined,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/delegations
 *
 * Retrieves task delegation records for the workspace organisation.
 * Supports optional filtering by taskId and orchestratorId.
 *
 * If the taskDelegation model is not yet present in the generated Prisma
 * client, the query falls back gracefully and returns an empty data array.
 *
 * @param request - Incoming Next.js request
 * @param context - Route context containing the workspaceSlug param
 * @returns JSON envelope `{ data: DelegationRecord[] }`
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Resolve route params
    const params = await context.params;
    const { workspaceSlug } = params;

    // Look up workspace and derive organisationId
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Verify the requesting user belongs to this organisation
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId') ?? undefined;
    const orchestratorId = searchParams.get('orchestratorId') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 500)
      : 100;

    // Query delegations - fall back to empty array if the model does not yet
    // exist in the generated Prisma client types.
    const delegations: DelegationRecord[] = await (
      (prisma as any).taskDelegation.findMany({
        where: {
          organizationId: workspace.organizationId,
          ...(taskId ? { taskId } : {}),
          ...(orchestratorId
            ? {
                OR: [
                  { fromOrchestratorId: orchestratorId },
                  { toOrchestratorId: orchestratorId },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          fromOrchestrator: {
            select: { id: true, title: true, discipline: true },
          },
          toOrchestrator: {
            select: { id: true, title: true, discipline: true },
          },
        },
      }) as Promise<RawDelegationRow[]>
    )
      .then((rows: RawDelegationRow[]) => rows.map(mapDelegation))
      .catch(() => [] as DelegationRecord[]);

    return NextResponse.json({ data: delegations });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/delegations] Error:',
      error
    );
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
