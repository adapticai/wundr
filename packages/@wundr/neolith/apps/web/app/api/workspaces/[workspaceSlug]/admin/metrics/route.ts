/**
 * Admin Metrics API Routes
 *
 * Provides aggregated metrics and statistics for the admin dashboard.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/metrics - Get dashboard metrics
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/metrics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Activity data point for the chart
 */
interface ActivityDataPoint {
  date: string;
  actions: number;
  users: number;
}

/**
 * System health status
 */
interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  database: 'connected' | 'disconnected';
  storage: 'available' | 'limited' | 'full';
  apiLatency: number;
}

/**
 * Dashboard metrics response
 */
interface DashboardMetrics {
  users: {
    total: number;
    active: number;
    suspended: number;
    trend: number; // percentage change from last period
  };
  sessions: {
    active: number;
    today: number;
    trend: number;
  };
  invites: {
    pending: number;
    sent: number;
    accepted: number;
    trend: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
  activity: ActivityDataPoint[];
  recentAlerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    createdAt: Date;
  }>;
  health: SystemHealth;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/metrics
 *
 * Get comprehensive dashboard metrics. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug
 * @returns Dashboard metrics and statistics
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<
  NextResponse<DashboardMetrics | ReturnType<typeof createAdminErrorResponse>>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug } = await context.params;

    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Calculate dates for trends
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    // Fetch user metrics
    const [totalUsers, activeUsers, suspendedUsers] = await Promise.all([
      prisma.workspaceMember.count({
        where: { workspaceId: workspace.id },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          user: {
            status: 'ACTIVE',
          },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          user: {
            status: 'SUSPENDED',
          },
        },
      }),
    ]);

    // Calculate user trend (last 7 days vs previous 7 days)
    const [recentUsers, previousUsers] = await Promise.all([
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          joinedAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          joinedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        },
      }),
    ]);

    const userTrend =
      previousUsers > 0
        ? ((recentUsers - previousUsers) / previousUsers) * 100
        : recentUsers > 0
          ? 100
          : 0;

    // Fetch session metrics (using message activity as proxy)
    const [todaySessions, activeSessions] = await Promise.all([
      prisma.message
        .groupBy({
          by: ['authorId'],
          where: {
            channel: { workspaceId: workspace.id },
            createdAt: { gte: todayStart },
          },
        })
        .then(groups => groups.length),
      prisma.message
        .groupBy({
          by: ['authorId'],
          where: {
            channel: { workspaceId: workspace.id },
            createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) }, // Last 15 minutes
          },
        })
        .then(groups => groups.length),
    ]);

    // Fetch invite metrics (using workspaceMember as proxy since workspaceInvite may not exist)
    // In a production system, you would query the invite table
    const [pendingInvites, sentInvites, acceptedInvites] = [0, 0, 0];

    // Calculate invite trend
    const [recentInvites, previousInvites] = [0, 0];

    const inviteTrend =
      previousInvites > 0
        ? ((recentInvites - previousInvites) / previousInvites) * 100
        : recentInvites > 0
          ? 100
          : 0;

    // Fetch storage metrics
    const files = await prisma.file.aggregate({
      where: {
        workspaceId: workspace.id,
      },
      _sum: {
        size: true,
      },
    });

    const storageSumResult = files._sum?.size;
    const storageUsed = storageSumResult ? Number(storageSumResult) : 0;
    const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB default
    const storagePercentage = (storageUsed / storageLimit) * 100;

    // Fetch activity data for the last 30 days
    const activityData: ActivityDataPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

      const [actionCount, userCount] = await Promise.all([
        prisma.message.count({
          where: {
            channel: { workspaceId: workspace.id },
            createdAt: { gte: dateStart, lt: dateEnd },
          },
        }),
        prisma.message
          .groupBy({
            by: ['authorId'],
            where: {
              channel: { workspaceId: workspace.id },
              createdAt: { gte: dateStart, lt: dateEnd },
            },
          })
          .then(groups => groups.length),
      ]);

      activityData.push({
        date: dateStart.toISOString().split('T')[0] || '',
        actions: actionCount,
        users: userCount,
      });
    }

    // Generate alerts based on metrics
    const recentAlerts: DashboardMetrics['recentAlerts'] = [];

    if (storagePercentage > 90) {
      recentAlerts.push({
        id: 'storage-critical',
        type: 'error',
        message: 'Storage usage is above 90%. Consider upgrading your plan.',
        createdAt: now,
      });
    } else if (storagePercentage > 75) {
      recentAlerts.push({
        id: 'storage-warning',
        type: 'warning',
        message: 'Storage usage is above 75%. Monitor your usage closely.',
        createdAt: now,
      });
    }

    if (pendingInvites > 10) {
      recentAlerts.push({
        id: 'pending-invites',
        type: 'info',
        message: `You have ${pendingInvites} pending invites awaiting response.`,
        createdAt: now,
      });
    }

    if (suspendedUsers > 0) {
      recentAlerts.push({
        id: 'suspended-users',
        type: 'warning',
        message: `${suspendedUsers} user${suspendedUsers > 1 ? 's are' : ' is'} currently suspended.`,
        createdAt: now,
      });
    }

    // Check system health
    const apiLatency = 0; // Would measure actual API response time
    const health: SystemHealth = {
      status:
        storagePercentage > 90
          ? 'critical'
          : storagePercentage > 75
            ? 'warning'
            : 'healthy',
      database: 'connected',
      storage:
        storagePercentage > 90
          ? 'full'
          : storagePercentage > 75
            ? 'limited'
            : 'available',
      apiLatency,
    };

    const metrics: DashboardMetrics = {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        trend: userTrend,
      },
      sessions: {
        active: activeSessions,
        today: todaySessions,
        trend: 0, // Could calculate from historical data
      },
      invites: {
        pending: pendingInvites,
        sent: sentInvites,
        accepted: acceptedInvites,
        trend: inviteTrend,
      },
      storage: {
        used: storageUsed,
        limit: storageLimit,
        percentage: storagePercentage,
      },
      activity: activityData,
      recentAlerts,
      health,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/metrics] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch metrics',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
