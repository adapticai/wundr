/**
 * Health Dashboard - System Overview API
 *
 * GET /api/admin/health - System-wide health metrics
 *
 * Returns:
 * - Active orchestrator count
 * - Total active sessions
 * - Token usage aggregates (hourly, daily, monthly)
 * - Error rate from recent audit logs
 * - System uptime
 *
 * @module app/api/admin/health/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface TokenUsageOverview {
  hourly: number;
  daily: number;
  monthly: number;
  limit: number;
  percentUsed: number;
}

interface SystemOverview {
  activeOrchestrators: number;
  totalSessions: number;
  tokenUsage: TokenUsageOverview;
  errorRate: number;
  uptime: number;
}

const startTime = Date.now();

/**
 * GET /api/admin/health
 *
 * Returns system-wide health overview including orchestrator status,
 * session counts, token usage, and error rates.
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
        { status: 401 },
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
        { status: 403 },
      );
    }

    // Calculate time windows
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel for performance
    const [
      activeOrchestratorCount,
      activeSessionCount,
      hourlyTokens,
      dailyTokens,
      monthlyTokens,
      budgetConfigs,
      recentErrors,
      totalRecentLogs,
    ] = await Promise.all([
      // Count online orchestrators
      prisma.orchestrator.count({
        where: { status: 'ONLINE' },
      }),

      // Count active sessions
      prisma.sessionManager.count({
        where: { status: 'ACTIVE' },
      }),

      // Hourly token usage
      prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: oneHourAgo } },
        _sum: { totalTokens: true },
      }),

      // Daily token usage
      prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: oneDayAgo } },
        _sum: { totalTokens: true },
      }),

      // Monthly token usage
      prisma.tokenUsage.aggregate({
        where: { createdAt: { gte: oneMonthAgo } },
        _sum: { totalTokens: true },
      }),

      // Get budget limits
      prisma.budgetConfig.aggregate({
        _sum: {
          hourlyLimit: true,
          dailyLimit: true,
          monthlyLimit: true,
        },
      }),

      // Count error logs in last hour
      prisma.auditLog.count({
        where: {
          createdAt: { gte: oneHourAgo },
          severity: { in: ['error', 'critical'] },
        },
      }),

      // Total logs in last hour for error rate calculation
      prisma.auditLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
    ]);

    // Calculate token usage overview
    const tokenUsage: TokenUsageOverview = {
      hourly: hourlyTokens._sum.totalTokens || 0,
      daily: dailyTokens._sum.totalTokens || 0,
      monthly: monthlyTokens._sum.totalTokens || 0,
      limit: budgetConfigs._sum.monthlyLimit || 10000000,
      percentUsed: budgetConfigs._sum.monthlyLimit
        ? ((monthlyTokens._sum.totalTokens || 0) /
            budgetConfigs._sum.monthlyLimit) *
          100
        : 0,
    };

    // Calculate error rate (percentage)
    const errorRate =
      totalRecentLogs > 0 ? (recentErrors / totalRecentLogs) * 100 : 0;

    // Calculate system uptime in milliseconds
    const uptime = Date.now() - startTime;

    const overview: SystemOverview = {
      activeOrchestrators: activeOrchestratorCount,
      totalSessions: activeSessionCount,
      tokenUsage,
      errorRate: Math.round(errorRate * 100) / 100, // Round to 2 decimals
      uptime,
    };

    return NextResponse.json({ data: overview });
  } catch (error) {
    console.error('[GET /api/admin/health] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    );
  }
}
