/**
 * Orchestrator Analytics
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
 * GET - Get orchestrator analytics
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

    // Get task statistics
    const [totalTasks, completedTasks, inProgressTasks, failedTasks] =
      await Promise.all([
        prisma.task.count({
          where: { orchestratorId },
        }),
        prisma.task.count({
          where: { orchestratorId, status: 'DONE' },
        }),
        prisma.task.count({
          where: { orchestratorId, status: 'IN_PROGRESS' },
        }),
        prisma.task.count({
          where: { orchestratorId, status: 'CANCELLED' },
        }),
      ]);

    // Get orchestrator for budget info
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: orchestratorId },
    });

    const capabilities = (orchestrator?.capabilities || {}) as {
      budgetLimit?: number;
      budgetUsed?: number;
    };

    // Mock usage data (in real app, this would come from metrics/logs)
    const totalRequests = totalTasks;
    const successfulRequests = completedTasks;
    const failedRequests = failedTasks;

    const analytics = {
      usage: {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgResponseTime: 250 + Math.random() * 200, // Mock data
      },
      budget: {
        spent: capabilities?.budgetUsed || 0,
        limit: capabilities?.budgetLimit || 0,
        costPerRequest:
          totalRequests > 0
            ? (capabilities?.budgetUsed || 0) / totalRequests
            : 0,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        failed: failedTasks,
      },
      timeline: generateMockTimeline(), // Mock data for demonstration
    };

    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('[GET analytics]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function generateMockTimeline() {
  const timeline = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    timeline.push({
      date: date.toISOString(),
      requests: Math.floor(Math.random() * 50) + 10,
      cost: Math.random() * 10 + 2,
    });
  }

  return timeline;
}
