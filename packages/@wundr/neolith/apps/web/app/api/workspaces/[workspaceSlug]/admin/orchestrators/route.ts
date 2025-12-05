/**
 * Admin Orchestrators API Routes
 *
 * Handles admin-level orchestrator management including listing with enhanced stats,
 * bulk operations, and comprehensive filtering.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/orchestrators - List with admin stats
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/orchestrators/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma, OrchestratorStatus } from '@neolith/database';
import type { NextRequest } from 'next/server';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper function to check admin access
 */
async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  // Check organization membership
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
 * GET /api/workspaces/:workspaceSlug/admin/orchestrators
 *
 * List orchestrators with admin-level stats including budget, permissions, and usage
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check admin access
    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const status = searchParams.status;
    const discipline = searchParams.discipline;
    const search = searchParams.search;
    const limit = parseInt(searchParams.limit || '100');

    // Build where clause
    const where: Prisma.orchestratorWhereInput = {
      organizationId: access.workspace.organizationId,
      ...(status &&
        status !== 'all' && { status: status as OrchestratorStatus }),
      ...(discipline && discipline !== 'all' && { discipline }),
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { role: { contains: search, mode: 'insensitive' } },
          { discipline: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Fetch orchestrators
    const orchestrators = await prisma.orchestrator.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    // Get task statistics
    const orchestratorIds = orchestrators.map(o => o.id);

    const [completedTaskCounts, activeTaskCounts] = await Promise.all([
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          status: 'DONE',
        },
        _count: {
          id: true,
        },
      }),
      prisma.task.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          status: { in: ['TODO', 'IN_PROGRESS'] },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const completedTaskMap = new Map(
      completedTaskCounts.map(item => [item.orchestratorId, item._count.id])
    );
    const activeTaskMap = new Map(
      activeTaskCounts.map(item => [item.orchestratorId, item._count.id])
    );

    // Enhanced orchestrators with admin data
    const enhancedOrchestrators = orchestrators.map(orchestrator => {
      // Parse capabilities to extract budget and permissions if stored there
      const capabilities = orchestrator.capabilities as {
        budgetLimit?: number;
        budgetUsed?: number;
        permissions?: string[];
      } | null;

      return {
        id: orchestrator.id,
        title: `${orchestrator.role} - ${orchestrator.discipline}`,
        discipline: orchestrator.discipline,
        role: orchestrator.role,
        status: orchestrator.status,
        user: orchestrator.user,
        organization: orchestrator.organization,
        statistics: {
          totalTasks: orchestrator._count.tasks,
          tasksCompleted: completedTaskMap.get(orchestrator.id) ?? 0,
          activeTasks: activeTaskMap.get(orchestrator.id) ?? 0,
        },
        capabilities: orchestrator.capabilities,
        createdAt: orchestrator.createdAt,
        updatedAt: orchestrator.updatedAt,
        budgetLimit: capabilities?.budgetLimit || 0,
        budgetUsed: capabilities?.budgetUsed || 0,
        permissions: capabilities?.permissions || [],
        isEnabled: orchestrator.status !== 'OFFLINE',
      };
    });

    // Calculate stats
    const stats = {
      total: enhancedOrchestrators.length,
      online: enhancedOrchestrators.filter(o => o.status === 'ONLINE').length,
      offline: enhancedOrchestrators.filter(o => o.status === 'OFFLINE').length,
      busy: enhancedOrchestrators.filter(o => o.status === 'BUSY').length,
      totalBudget: enhancedOrchestrators.reduce(
        (sum, o) => sum + (o.budgetLimit || 0),
        0
      ),
      usedBudget: enhancedOrchestrators.reduce(
        (sum, o) => sum + (o.budgetUsed || 0),
        0
      ),
    };

    return NextResponse.json({
      orchestrators: enhancedOrchestrators,
      stats,
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/orchestrators]',
      error
    );
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
