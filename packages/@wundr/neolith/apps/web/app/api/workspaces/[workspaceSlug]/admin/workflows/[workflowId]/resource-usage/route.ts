/**
 * Workflow Resource Usage API Routes
 *
 * Handles workflow resource usage metrics retrieval.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/resource-usage - Get resource usage
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/workflows/[workflowId]/resource-usage/route
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
 * GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/resource-usage
 *
 * Get workflow resource usage metrics
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
    const { workspaceSlug: workspaceId, workflowId } = params;

    const access = await checkAdminAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Verify workflow belongs to workspace
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow || workflow.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Get all completed executions
    const completedExecutions = await prisma.workflowExecution.findMany({
      where: {
        workflowId,
        status: 'COMPLETED',
        durationMs: { not: null },
      },
      select: {
        durationMs: true,
        startedAt: true,
      },
    });

    if (completedExecutions.length === 0) {
      return NextResponse.json({
        usage: {
          avgExecutionTime: 0,
          maxExecutionTime: 0,
          minExecutionTime: 0,
          totalExecutions: 0,
          avgMemoryUsage: 0,
          totalApiCalls: 0,
          last24h: { executions: 0, avgTime: 0 },
          last7d: { executions: 0, avgTime: 0 },
        },
      });
    }

    // Calculate execution time metrics
    const durations = completedExecutions
      .map(e => e.durationMs || 0)
      .filter(d => d > 0);

    const avgExecutionTime = Math.round(
      durations.reduce((sum, d) => sum + d, 0) / durations.length
    );
    const maxExecutionTime = Math.max(...durations);
    const minExecutionTime = Math.min(...durations);

    // Calculate memory and API call metrics from metadata
    const totalMemory = 0;
    const totalApiCalls = 0;
    const memoryCount = 0;

    // Note: metadata field was removed from the select above, so this is placeholder code
    // If needed, add metadata back to the select and type it properly

    const avgMemoryUsage = 0; // Placeholder since metadata was removed

    // Calculate time-based metrics
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last24hExecutions = completedExecutions.filter(
      e => new Date(e.startedAt) >= last24h
    );
    const last7dExecutions = completedExecutions.filter(
      e => new Date(e.startedAt) >= last7d
    );

    const last24hAvgTime =
      last24hExecutions.length > 0
        ? Math.round(
            last24hExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) /
              last24hExecutions.length
          )
        : 0;

    const last7dAvgTime =
      last7dExecutions.length > 0
        ? Math.round(
            last7dExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) /
              last7dExecutions.length
          )
        : 0;

    const usage = {
      avgExecutionTime,
      maxExecutionTime,
      minExecutionTime,
      totalExecutions: completedExecutions.length,
      avgMemoryUsage,
      totalApiCalls,
      last24h: {
        executions: last24hExecutions.length,
        avgTime: last24hAvgTime,
      },
      last7d: {
        executions: last7dExecutions.length,
        avgTime: last7dAvgTime,
      },
    };

    return NextResponse.json({ usage });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/workflows/:workflowId/resource-usage]',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
