/**
 * Health Dashboard - Orchestrator Health Status API
 *
 * GET /api/admin/health/orchestrators - List orchestrator health metrics
 *
 * Query Parameters:
 * - status: Filter by status (online, offline, error, degraded)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (lastActivity, errorCount, sessions, tokenUsage)
 * - sortOrder: Sort direction (asc, desc)
 *
 * @module app/api/admin/health/orchestrators/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface OrchestratorHealthStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error' | 'degraded';
  sessions: number;
  tokenBudget: {
    used: number;
    limit: number;
    percent: number;
  };
  lastActivity: string;
  responseTime: number;
  errorCount: number;
}

type StatusFilter = 'online' | 'offline' | 'busy' | 'away';
type SortField = 'lastActivity' | 'errorCount' | 'sessions' | 'tokenUsage';
type SortOrder = 'asc' | 'desc';

/**
 * GET /api/admin/health/orchestrators
 *
 * Returns health status for all orchestrators with pagination and filtering.
 * Includes session count, token usage, error count, and response time metrics.
 *
 * Requires admin authentication.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user and check admin role
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin in any organization
    const adminMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status') as StatusFilter | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10))
    );
    const sortBy = (searchParams.get('sortBy') || 'lastActivity') as SortField;
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as SortOrder;

    // Build where clause for status filter
    const statusMap: Record<string, any> = {
      online: 'ONLINE',
      offline: 'OFFLINE',
      busy: 'BUSY',
      away: 'AWAY',
    };

    const where =
      statusFilter && statusMap[statusFilter]
        ? { status: statusMap[statusFilter] as any }
        : {};

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch orchestrators with related data
    const [orchestrators, totalCount] = await Promise.all([
      prisma.orchestrator.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          budgetConfig: {
            select: {
              hourlyLimit: true,
              dailyLimit: true,
              monthlyLimit: true,
            },
          },
          sessionManagers: {
            where: { status: 'ACTIVE' },
            select: { id: true },
          },
          _count: {
            select: {
              tokenUsage: true,
            },
          },
        },
        orderBy: { updatedAt: sortOrder },
      }),
      prisma.orchestrator.count({ where }),
    ]);

    // Calculate time windows for metrics
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch token usage and error counts for each orchestrator
    const orchestratorIds = orchestrators.map(o => o.id);

    const [
      tokenUsageByOrchestrator,
      errorCountsByOrchestrator,
      responseTimeAuditLogs,
    ] = await Promise.all([
      // Get hourly token usage for each orchestrator
      prisma.tokenUsage.groupBy({
        by: ['orchestratorId'],
        where: {
          orchestratorId: { in: orchestratorIds },
          createdAt: { gte: oneHourAgo },
        },
        _sum: {
          totalTokens: true,
        },
      }),

      // Get error counts from audit logs
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: {
          actorId: { in: orchestratorIds },
          actorType: 'orchestrator',
          severity: { in: ['error', 'critical'] },
          createdAt: { gte: oneDayAgo },
        },
        _count: true,
      }),

      // Get recent audit logs with durationMs metadata for response time calculation
      prisma.auditLog.findMany({
        where: {
          actorId: { in: orchestratorIds },
          actorType: 'orchestrator',
          createdAt: { gte: oneHourAgo },
        },
        select: {
          actorId: true,
          metadata: true,
        },
      }),
    ]);

    // Create lookup maps
    const tokenUsageMap = new Map(
      tokenUsageByOrchestrator.map(t => [
        t.orchestratorId,
        t._sum.totalTokens || 0,
      ])
    );

    const errorCountMap = new Map(
      errorCountsByOrchestrator.map(e => [e.actorId, e._count])
    );

    // Build per-orchestrator average response time from audit log durationMs metadata
    const responseTimeSumMap = new Map<
      string,
      { total: number; count: number }
    >();
    for (const log of responseTimeAuditLogs) {
      const meta = log.metadata as Record<string, unknown> | null;
      if (meta && typeof meta['durationMs'] === 'number') {
        const existing = responseTimeSumMap.get(log.actorId);
        if (existing) {
          existing.total += meta['durationMs'] as number;
          existing.count += 1;
        } else {
          responseTimeSumMap.set(log.actorId, {
            total: meta['durationMs'] as number,
            count: 1,
          });
        }
      }
    }

    const responseTimeMap = new Map<string, number>(
      Array.from(responseTimeSumMap.entries()).map(
        ([actorId, { total, count }]) => [actorId, Math.round(total / count)]
      )
    );

    // Transform to health status objects
    const healthStatuses: OrchestratorHealthStatus[] = orchestrators.map(
      orchestrator => {
        const tokenUsed = tokenUsageMap.get(orchestrator.id) || 0;
        const tokenLimit = orchestrator.budgetConfig?.hourlyLimit || 100000;
        const tokenPercent = (tokenUsed / tokenLimit) * 100;
        const errorCount = errorCountMap.get(orchestrator.id) || 0;

        // Map Prisma status to health status
        let healthStatus: 'online' | 'offline' | 'error' | 'degraded';

        switch (orchestrator.status) {
          case 'ONLINE':
            // Degrade status if token budget is critical or has many errors
            if (tokenPercent > 95 || errorCount > 10) {
              healthStatus = 'error';
            } else if (tokenPercent > 80 || errorCount > 5) {
              healthStatus = 'degraded';
            } else {
              healthStatus = 'online';
            }
            break;
          case 'BUSY':
            healthStatus = errorCount > 5 ? 'degraded' : 'online';
            break;
          case 'AWAY':
            healthStatus = 'degraded';
            break;
          default: // OFFLINE
            healthStatus = 'offline';
        }

        return {
          id: orchestrator.id,
          name:
            orchestrator.user?.displayName ||
            orchestrator.user?.name ||
            orchestrator.role,
          status: healthStatus,
          sessions: orchestrator.sessionManagers.length,
          tokenBudget: {
            used: tokenUsed,
            limit: tokenLimit,
            percent: Math.round(tokenPercent * 100) / 100,
          },
          lastActivity: orchestrator.updatedAt.toISOString(),
          responseTime: responseTimeMap.get(orchestrator.id) ?? 0,
          errorCount: errorCountMap.get(orchestrator.id) || 0,
        };
      }
    );

    // Apply sorting
    if (sortBy === 'errorCount') {
      healthStatuses.sort((a, b) =>
        sortOrder === 'asc'
          ? a.errorCount - b.errorCount
          : b.errorCount - a.errorCount
      );
    } else if (sortBy === 'sessions') {
      healthStatuses.sort((a, b) =>
        sortOrder === 'asc' ? a.sessions - b.sessions : b.sessions - a.sessions
      );
    } else if (sortBy === 'tokenUsage') {
      healthStatuses.sort((a, b) =>
        sortOrder === 'asc'
          ? a.tokenBudget.percent - b.tokenBudget.percent
          : b.tokenBudget.percent - a.tokenBudget.percent
      );
    }
    // lastActivity is already sorted by updatedAt in the query

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      data: healthStatuses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/health/orchestrators] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    );
  }
}
