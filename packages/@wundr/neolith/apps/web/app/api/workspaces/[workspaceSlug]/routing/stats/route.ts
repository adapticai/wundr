/**
 * Routing Statistics API Route
 *
 * Returns aggregated routing statistics for a workspace: task breakdown by
 * discipline, average routing latency, success rate, and per-orchestrator
 * decision counts.
 *
 * Routes:
 * - GET /api/workspaces/[workspaceSlug]/routing/stats - Get routing statistics
 *
 * @module app/api/workspaces/[workspaceSlug]/routing/stats/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { createErrorResponse, TASK_ERROR_CODES } from '@/lib/validations/task';

import type { NextRequest } from 'next/server';

// =============================================================================
// Validation Schemas
// =============================================================================

const statsQuerySchema = z.object({
  /**
   * Look-back window in days. Defaults to 30.
   * Capped at 365 to protect query performance.
   */
  days: z.coerce.number().int().positive().max(365).default(30),
});

// =============================================================================
// Route Context
// =============================================================================

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

// =============================================================================
// Helper: safe average
// =============================================================================

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * GET /api/workspaces/[workspaceSlug]/routing/stats
 *
 * Returns routing statistics for the workspace's organization over a
 * configurable look-back window (default: 30 days).
 *
 * Response shape:
 * {
 *   period: { days: 30, from: "...", to: "..." },
 *   totalDecisions: 120,
 *   averageRoutingLatencyMs: 42,
 *   successRate: 0.93,
 *   fallbackRate: 0.07,
 *   escalationRate: 0.05,
 *   byDiscipline: [
 *     { discipline: "engineering", count: 80, percentage: 66.7 },
 *     ...
 *   ],
 *   byMatchedBy: [
 *     { matchedBy: "discipline_match", count: 96, percentage: 80 },
 *     ...
 *   ],
 *   byOrchestrator: [
 *     { agentId: "...", agentName: "...", count: 60, avgLatencyMs: 38 },
 *     ...
 *   ],
 *   tasksByStatus: {
 *     TODO: 10, IN_PROGRESS: 5, DONE: 80, BLOCKED: 3, CANCELLED: 2
 *   },
 * }
 *
 * @param request - Next.js request with optional ?days= query parameter
 * @param context - Route context with workspace slug
 * @returns Routing statistics object
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
        createErrorResponse(
          'Authentication required',
          TASK_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceSlug }, { slug: workspaceSlug }] },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse('Workspace not found', TASK_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this workspace',
          TASK_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse query parameters
    const rawDays = request.nextUrl.searchParams.get('days');
    const parseResult = statsQuerySchema.safeParse({
      days: rawDays ?? undefined,
    });
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          TASK_ERROR_CODES.VALIDATION_ERROR,
          {
            errors: parseResult.error.flatten().fieldErrors,
          }
        ),
        { status: 400 }
      );
    }

    const { days } = parseResult.data;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Fetch all routing decisions in the window for the org (no taskId relation
    // in schema, so we scope by organizationId and createdAt range)
    const decisions = await prisma.routingDecision.findMany({
      where: {
        organizationId: workspace.organizationId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        agentId: true,
        agentName: true,
        confidence: true,
        matchedBy: true,
        fallbackUsed: true,
        escalated: true,
        routingLatencyMs: true,
        metadata: true,
        createdAt: true,
      },
    });

    const totalDecisions = decisions.length;

    // Average routing latency
    const averageRoutingLatencyMs = Math.round(
      avg(decisions.map(d => d.routingLatencyMs))
    );

    // Fallback and escalation rates
    const fallbackCount = decisions.filter(d => d.fallbackUsed).length;
    const escalationCount = decisions.filter(d => d.escalated).length;
    const fallbackRate =
      totalDecisions > 0
        ? parseFloat((fallbackCount / totalDecisions).toFixed(4))
        : 0;
    const escalationRate =
      totalDecisions > 0
        ? parseFloat((escalationCount / totalDecisions).toFixed(4))
        : 0;

    // Success rate: non-fallback decisions are considered successful
    const successRate =
      totalDecisions > 0
        ? parseFloat(
            ((totalDecisions - fallbackCount) / totalDecisions).toFixed(4)
          )
        : 0;

    // --- By discipline (from metadata.discipline) ---
    const disciplineMap = new Map<string, number>();
    for (const d of decisions) {
      const meta = (d.metadata as Record<string, unknown>) ?? {};
      const discipline = (meta.discipline as string | undefined) ?? 'unknown';
      disciplineMap.set(discipline, (disciplineMap.get(discipline) ?? 0) + 1);
    }
    const byDiscipline = Array.from(disciplineMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([discipline, count]) => ({
        discipline,
        count,
        percentage:
          totalDecisions > 0
            ? parseFloat(((count / totalDecisions) * 100).toFixed(1))
            : 0,
      }));

    // --- By matchedBy strategy ---
    const matchedByMap = new Map<string, number>();
    for (const d of decisions) {
      matchedByMap.set(d.matchedBy, (matchedByMap.get(d.matchedBy) ?? 0) + 1);
    }
    const byMatchedBy = Array.from(matchedByMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([matchedBy, count]) => ({
        matchedBy,
        count,
        percentage:
          totalDecisions > 0
            ? parseFloat(((count / totalDecisions) * 100).toFixed(1))
            : 0,
      }));

    // --- By orchestrator / agent ---
    const orchestratorMap = new Map<
      string,
      { agentName: string | null; count: number; latencies: number[] }
    >();
    for (const d of decisions) {
      const existing = orchestratorMap.get(d.agentId);
      if (existing) {
        existing.count += 1;
        existing.latencies.push(d.routingLatencyMs);
      } else {
        orchestratorMap.set(d.agentId, {
          agentName: d.agentName,
          count: 1,
          latencies: [d.routingLatencyMs],
        });
      }
    }

    // Resolve agent names for any that are missing
    const missingNameIds = Array.from(orchestratorMap.entries())
      .filter(([, v]) => !v.agentName)
      .map(([id]) => id);

    if (missingNameIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: missingNameIds } },
        select: { id: true, name: true },
      });
      for (const u of users) {
        const entry = orchestratorMap.get(u.id);
        if (entry) entry.agentName = u.name;
      }
    }

    const byOrchestrator = Array.from(orchestratorMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([agentId, { agentName, count, latencies }]) => ({
        agentId,
        agentName,
        count,
        avgLatencyMs: Math.round(avg(latencies)),
      }));

    // --- Task status breakdown for workspace tasks in the period ---
    const taskStatusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: {
        workspaceId: workspace.id,
        createdAt: { gte: fromDate, lte: toDate },
      },
      _count: { status: true },
    });

    const tasksByStatus: Record<string, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      BLOCKED: 0,
      CANCELLED: 0,
    };
    for (const row of taskStatusCounts) {
      tasksByStatus[row.status] = row._count.status;
    }

    const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);
    const taskSuccessRate =
      totalTasks > 0
        ? parseFloat((tasksByStatus.DONE / totalTasks).toFixed(4))
        : 0;

    return NextResponse.json({
      data: {
        period: {
          days,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
        },
        totalDecisions,
        averageRoutingLatencyMs,
        successRate,
        fallbackRate,
        escalationRate,
        byDiscipline,
        byMatchedBy,
        byOrchestrator,
        tasks: {
          total: totalTasks,
          successRate: taskSuccessRate,
          byStatus: tasksByStatus,
        },
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/routing/stats] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TASK_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
