/**
 * Admin Dashboard Statistics API Routes
 *
 * Provides comprehensive statistics for the admin dashboard.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/stats - Get dashboard statistics
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/stats/route
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
 * Member statistics
 */
interface MemberStats {
  total: number;
  active: number;
  suspended: number;
  pending: number;
  growth: {
    thisWeek: number;
    lastWeek: number;
    percentageChange: number;
  };
  byRole: Record<string, number>;
}

/**
 * Channel statistics
 */
interface ChannelStats {
  total: number;
  public: number;
  private: number;
  archived: number;
  growth: {
    thisMonth: number;
    lastMonth: number;
    percentageChange: number;
  };
}

/**
 * Message statistics
 */
interface MessageStats {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  averagePerDay: number;
  growth: {
    thisWeek: number;
    lastWeek: number;
    percentageChange: number;
  };
  topContributors: Array<{
    userId: string;
    userName: string | null;
    messageCount: number;
  }>;
}

/**
 * Orchestrator statistics
 */
interface OrchestratorStats {
  total: number;
  online: number;
  busy: number;
  offline: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
}

/**
 * Storage statistics
 */
interface StorageStats {
  totalFiles: number;
  totalSize: number;
  sizeLimit: number;
  percentageUsed: number;
  byType: Record<string, { count: number; size: number }>;
  growth: {
    thisMonth: number;
    lastMonth: number;
    percentageChange: number;
  };
}

/**
 * Dashboard statistics response
 */
interface DashboardStats {
  members: MemberStats;
  channels: ChannelStats;
  messages: MessageStats;
  orchestrators: OrchestratorStats;
  storage: StorageStats;
  generatedAt: Date;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/stats
 *
 * Get comprehensive dashboard statistics. Requires admin or owner role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug
 * @returns Dashboard statistics
 *
 * @example
 * ```
 * GET /api/workspaces/my-workspace/admin/stats
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (!membership || !['ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Calculate time ranges
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch member statistics
    const [
      totalMembers,
      activeMembers,
      suspendedMembers,
      pendingMembers,
      membersThisWeek,
      membersLastWeek,
      membersByRole,
    ] = await Promise.all([
      prisma.workspaceMember.count({
        where: { workspaceId: workspace.id },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          user: { status: 'ACTIVE' },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          user: { status: 'SUSPENDED' },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          user: { status: 'PENDING' },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          joinedAt: { gte: weekStart },
        },
      }),
      prisma.workspaceMember.count({
        where: {
          workspaceId: workspace.id,
          joinedAt: { gte: lastWeekStart, lt: weekStart },
        },
      }),
      prisma.workspaceMember.groupBy({
        by: ['role'],
        where: { workspaceId: workspace.id },
        _count: true,
      }),
    ]);

    const memberGrowthPercentage =
      membersLastWeek > 0
        ? ((membersThisWeek - membersLastWeek) / membersLastWeek) * 100
        : membersThisWeek > 0
          ? 100
          : 0;

    const memberStats: MemberStats = {
      total: totalMembers,
      active: activeMembers,
      suspended: suspendedMembers,
      pending: pendingMembers,
      growth: {
        thisWeek: membersThisWeek,
        lastWeek: membersLastWeek,
        percentageChange: Math.round(memberGrowthPercentage * 100) / 100,
      },
      byRole: Object.fromEntries(membersByRole.map(m => [m.role, m._count])),
    };

    // Fetch channel statistics
    const [
      totalChannels,
      publicChannels,
      privateChannels,
      archivedChannels,
      channelsThisMonth,
      channelsLastMonth,
    ] = await Promise.all([
      prisma.channel.count({
        where: { workspaceId: workspace.id },
      }),
      prisma.channel.count({
        where: { workspaceId: workspace.id, type: 'PUBLIC' },
      }),
      prisma.channel.count({
        where: { workspaceId: workspace.id, type: 'PRIVATE' },
      }),
      prisma.channel.count({
        where: { workspaceId: workspace.id, isArchived: true },
      }),
      prisma.channel.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: monthStart },
        },
      }),
      prisma.channel.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
        },
      }),
    ]);

    const channelGrowthPercentage =
      channelsLastMonth > 0
        ? ((channelsThisMonth - channelsLastMonth) / channelsLastMonth) * 100
        : channelsThisMonth > 0
          ? 100
          : 0;

    const channelStats: ChannelStats = {
      total: totalChannels,
      public: publicChannels,
      private: privateChannels,
      archived: archivedChannels,
      growth: {
        thisMonth: channelsThisMonth,
        lastMonth: channelsLastMonth,
        percentageChange: Math.round(channelGrowthPercentage * 100) / 100,
      },
    };

    // Fetch message statistics
    const [
      totalMessages,
      messagesToday,
      messagesThisWeek,
      messagesThisMonth,
      messagesLastWeek,
      topContributorsRaw,
    ] = await Promise.all([
      prisma.message.count({
        where: { channel: { workspaceId: workspace.id } },
      }),
      prisma.message.count({
        where: {
          channel: { workspaceId: workspace.id },
          createdAt: { gte: todayStart },
        },
      }),
      prisma.message.count({
        where: {
          channel: { workspaceId: workspace.id },
          createdAt: { gte: weekStart },
        },
      }),
      prisma.message.count({
        where: {
          channel: { workspaceId: workspace.id },
          createdAt: { gte: monthStart },
        },
      }),
      prisma.message.count({
        where: {
          channel: { workspaceId: workspace.id },
          createdAt: { gte: lastWeekStart, lt: weekStart },
        },
      }),
      prisma.message.groupBy({
        by: ['authorId'],
        where: {
          channel: { workspaceId: workspace.id },
          createdAt: { gte: monthStart },
        },
        _count: true,
        orderBy: { _count: { authorId: 'desc' } },
        take: 10,
      }),
    ]);

    // Fetch top contributor names
    const topContributorIds = topContributorsRaw.map(c => c.authorId);
    const topContributorUsers = await prisma.user.findMany({
      where: { id: { in: topContributorIds } },
      select: { id: true, name: true },
    });

    const userMap = new Map(topContributorUsers.map(u => [u.id, u.name]));
    const topContributors = topContributorsRaw.map(c => ({
      userId: c.authorId,
      userName: userMap.get(c.authorId) || null,
      messageCount: c._count,
    }));

    const messageGrowthPercentage =
      messagesLastWeek > 0
        ? ((messagesThisWeek - messagesLastWeek) / messagesLastWeek) * 100
        : messagesThisWeek > 0
          ? 100
          : 0;

    const averagePerDay = Math.round(messagesThisMonth / now.getDate());

    const messageStats: MessageStats = {
      total: totalMessages,
      today: messagesToday,
      thisWeek: messagesThisWeek,
      thisMonth: messagesThisMonth,
      averagePerDay,
      growth: {
        thisWeek: messagesThisWeek,
        lastWeek: messagesLastWeek,
        percentageChange: Math.round(messageGrowthPercentage * 100) / 100,
      },
      topContributors,
    };

    // Fetch orchestrator statistics
    const [
      totalOrchestrators,
      onlineOrchestrators,
      busyOrchestrators,
      offlineOrchestrators,
    ] = await Promise.all([
      prisma.orchestrator.count({
        where: { workspaceId: workspace.id },
      }),
      prisma.orchestrator.count({
        where: { workspaceId: workspace.id, status: 'ONLINE' },
      }),
      prisma.orchestrator.count({
        where: { workspaceId: workspace.id, status: 'BUSY' },
      }),
      prisma.orchestrator.count({
        where: { workspaceId: workspace.id, status: 'OFFLINE' },
      }),
    ]);

    // Fetch task statistics (from workflow executions)
    const [totalTasks, completedTasks, failedTasks] = await Promise.all([
      prisma.workflowExecution.count({
        where: { workflow: { workspaceId: workspace.id } },
      }),
      prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId: workspace.id },
          status: 'COMPLETED',
        },
      }),
      prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId: workspace.id },
          status: 'FAILED',
        },
      }),
    ]);

    const orchestratorStats: OrchestratorStats = {
      total: totalOrchestrators,
      online: onlineOrchestrators,
      busy: busyOrchestrators,
      offline: offlineOrchestrators,
      totalTasks,
      completedTasks,
      failedTasks,
      averageResponseTime: 0, // Would require performance metrics
    };

    // Fetch storage statistics
    const [
      totalFiles,
      storageAggregate,
      filesThisMonth,
      filesLastMonth,
      filesByType,
    ] = await Promise.all([
      prisma.file.count({
        where: { workspaceId: workspace.id },
      }),
      prisma.file.aggregate({
        where: { workspaceId: workspace.id },
        _sum: { size: true },
      }),
      prisma.file.aggregate({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: monthStart },
        },
        _sum: { size: true },
      }),
      prisma.file.aggregate({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: lastMonthStart, lt: lastMonthEnd },
        },
        _sum: { size: true },
      }),
      prisma.file.groupBy({
        by: ['mimeType'],
        where: { workspaceId: workspace.id },
        _count: true,
        _sum: { size: true },
      }),
    ]);

    const totalSize = Number(storageAggregate._sum.size || 0);
    const sizeLimit = 10 * 1024 * 1024 * 1024; // 10GB default
    const percentageUsed = (totalSize / sizeLimit) * 100;

    const thisMonthSize = Number(filesThisMonth._sum.size || 0);
    const lastMonthSize = Number(filesLastMonth._sum.size || 0);
    const storageGrowthPercentage =
      lastMonthSize > 0
        ? ((thisMonthSize - lastMonthSize) / lastMonthSize) * 100
        : thisMonthSize > 0
          ? 100
          : 0;

    const byType: Record<string, { count: number; size: number }> = {};
    filesByType.forEach(f => {
      const type = f.mimeType || 'unknown';
      byType[type] = {
        count: f._count,
        size: Number(f._sum.size || 0),
      };
    });

    const storageStats: StorageStats = {
      totalFiles,
      totalSize,
      sizeLimit,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      byType,
      growth: {
        thisMonth: thisMonthSize,
        lastMonth: lastMonthSize,
        percentageChange: Math.round(storageGrowthPercentage * 100) / 100,
      },
    };

    const stats: DashboardStats = {
      members: memberStats,
      channels: channelStats,
      messages: messageStats,
      orchestrators: orchestratorStats,
      storage: storageStats,
      generatedAt: now,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/stats] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch dashboard statistics',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
