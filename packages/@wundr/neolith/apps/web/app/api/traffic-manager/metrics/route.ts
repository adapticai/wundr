/**
 * Traffic Manager Metrics API Route
 *
 * Routes:
 * - GET /api/traffic-manager/metrics - Get traffic metrics and recent decisions
 *
 * @module app/api/traffic-manager/metrics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  TRAFFIC_MANAGER_ERROR_CODES,
} from '@/lib/validations/traffic-manager';

import type { NextRequest } from 'next/server';

/**
 * GET /api/traffic-manager/metrics
 *
 * Returns traffic metrics including routing distribution, latency, and recent decisions.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          TRAFFIC_MANAGER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'workspaceId is required',
          TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          TRAFFIC_MANAGER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 404 }
      );
    }

    const routingDecisionModel = (prisma as any).routingDecision;

    // Time windows
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Total and aggregations (last hour)
    const [
      totalCount,
      methodDistribution,
      agentCounts,
      avgLatency,
      escalatedCount,
      fallbackCount,
      recentDecisions,
    ] = await Promise.all([
      // Total messages routed
      routingDecisionModel
        .count({
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
          },
        })
        .catch(() => 0),

      // Distribution by matchedBy
      routingDecisionModel
        .groupBy({
          by: ['matchedBy'],
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
          },
          _count: { id: true },
        })
        .catch(() => []),

      // Per-agent counts
      routingDecisionModel
        .groupBy({
          by: ['agentId'],
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
          },
          _count: { id: true },
        })
        .catch(() => []),

      // Average routing latency
      routingDecisionModel
        .aggregate({
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
          },
          _avg: { routingLatencyMs: true },
        })
        .catch(() => ({ _avg: { routingLatencyMs: null } })),

      // Escalation count
      routingDecisionModel
        .count({
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
            escalated: true,
          },
        })
        .catch(() => 0),

      // Fallback count
      routingDecisionModel
        .count({
          where: {
            organizationId: workspace.organizationId,
            createdAt: { gte: oneHourAgo },
            fallbackUsed: true,
          },
        })
        .catch(() => 0),

      // Recent 20 decisions
      routingDecisionModel
        .findMany({
          where: { organizationId: workspace.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            agentId: true,
            agentName: true,
            confidence: true,
            matchedBy: true,
            channelId: true,
            escalated: true,
            routingLatencyMs: true,
            createdAt: true,
          },
        })
        .catch(() => []),
    ]);

    // Build distribution map
    const routingMethodDistribution: Record<string, number> = {};
    for (const row of methodDistribution as Array<{
      matchedBy: string;
      _count: { id: number };
    }>) {
      routingMethodDistribution[row.matchedBy] = row._count.id;
    }

    // Build agent utilization map
    const agentUtilization: Record<string, number> = {};
    const total = (totalCount as number) || 1;
    for (const row of agentCounts as Array<{
      agentId: string;
      _count: { id: number };
    }>) {
      agentUtilization[row.agentId] = row._count.id / total;
    }

    // Messages per minute (last 5 min window)
    const recentCount = await routingDecisionModel
      .count({
        where: {
          organizationId: workspace.organizationId,
          createdAt: { gte: fiveMinutesAgo },
        },
      })
      .catch(() => 0);
    const messagesPerMinute = (recentCount as number) / 5;

    return NextResponse.json({
      data: {
        totalMessagesRouted: totalCount as number,
        averageRoutingLatencyMs:
          (avgLatency as any)?._avg?.routingLatencyMs ?? 0,
        messagesPerMinute,
        escalationRate: total > 0 ? (escalatedCount as number) / total : 0,
        fallbackRate: total > 0 ? (fallbackCount as number) / total : 0,
        routingMethodDistribution,
        agentUtilization,
        windowStartedAt: oneHourAgo.toISOString(),
        recentDecisions: (recentDecisions as any[]).map((d: any) => ({
          id: d.id,
          timestamp: d.createdAt.toISOString(),
          channelId: d.channelId ?? '',
          agentName: d.agentName ?? 'Unknown',
          confidence: d.confidence,
          matchedBy: d.matchedBy,
          escalated: d.escalated,
        })),
      },
    });
  } catch (error) {
    console.error('[GET /api/traffic-manager/metrics] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        TRAFFIC_MANAGER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
