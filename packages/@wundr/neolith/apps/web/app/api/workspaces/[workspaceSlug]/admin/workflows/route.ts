/**
 * Admin Workflow API Routes
 *
 * Handles admin-level workflow management including listing, stats, and bulk operations.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows - List all workflows with admin stats
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/route
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

/**
 * GET /api/workspaces/:workspaceSlug/admin/workflows
 *
 * List all workflows with admin-level information including stats and permissions
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

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 }
      );
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const status = searchParams.status;
    const trigger = searchParams.trigger;
    const search = searchParams.search;
    const limit = parseInt(searchParams.limit || '50');
    const includeStats = searchParams.includeStats === 'true';

    // Build where clause
    const where: any = {
      workspaceId,
      ...(status && status !== 'all' && { status }),
      ...(trigger &&
        trigger !== 'all' && {
          trigger: {
            path: ['type'],
            equals: trigger,
          },
        }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Fetch workflows without creator info (creator relation doesn't exist)
    const workflows = await prisma.workflow.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            workflowExecutions: true,
          },
        },
      },
    });

    // Calculate stats if requested
    let stats = null;
    if (includeStats) {
      const allWorkflows = await prisma.workflow.findMany({
        where: { workspaceId },
        select: {
          status: true,
          executionCount: true,
          failureCount: true,
          _count: {
            select: {
              workflowExecutions: true,
            },
          },
        },
      });

      const totalExecutions = allWorkflows.reduce(
        (sum, w) => sum + w.executionCount,
        0
      );
      const failedExecutions = allWorkflows.reduce(
        (sum, w) => sum + w.failureCount,
        0
      );

      // Calculate average execution time from recent executions
      const recentExecutions = await prisma.workflowExecution.findMany({
        where: {
          workflow: { workspaceId },
          status: 'COMPLETED',
          durationMs: { not: null },
        },
        take: 100,
        orderBy: { startedAt: 'desc' },
        select: { durationMs: true },
      });

      const avgExecutionTime =
        recentExecutions.length > 0
          ? Math.round(
              recentExecutions.reduce(
                (sum, e) => sum + (e.durationMs || 0),
                0
              ) / recentExecutions.length
            )
          : 0;

      stats = {
        total: allWorkflows.length,
        active: allWorkflows.filter(w => w.status === 'ACTIVE').length,
        inactive: allWorkflows.filter(w => w.status === 'INACTIVE').length,
        draft: allWorkflows.filter(w => w.status === 'DRAFT').length,
        totalExecutions,
        failedExecutions,
        avgExecutionTime,
      };
    }

    // Format workflows
    const formattedWorkflows = workflows.map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      trigger: workflow.trigger,
      actions: workflow.actions,
      createdBy: workflow.createdBy,
      lastExecutedAt: workflow.lastExecutedAt,
      executionCount: workflow.executionCount,
      failureCount: workflow.failureCount,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    }));

    return NextResponse.json({
      workflows: formattedWorkflows,
      ...(stats && { stats }),
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/workflows]',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
