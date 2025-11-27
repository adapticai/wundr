/**
 * Dashboard Statistics API Routes
 *
 * Handles dashboard statistics retrieval for workspace members.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/dashboard/stats - Get dashboard statistics
 *
 * @module app/api/workspaces/[workspaceId]/dashboard/stats/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Time range for statistics
 */
type TimeRange = 'today' | 'week' | 'month' | 'all';

/**
 * Dashboard statistics response
 */
interface DashboardStats {
  members: {
    total: number;
    activeToday: number;
    orchestratorCount: number;
    humanCount: number;
  };
  channels: {
    total: number;
    publicCount: number;
    privateCount: number;
  };
  messages: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  workflows: {
    total: number;
    active: number;
    draft: number;
    inactive: number;
    archived: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    completionRate: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: Date;
    userId?: string;
    userName?: string;
  }>;
  topContributors: Array<{
    userId: string;
    userName: string;
    avatarUrl: string | null;
    messageCount: number;
  }>;
}

/**
 * Helper to check workspace access
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
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

  if (!orgMembership) {
    return null;
  }

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  // User needs to be either an org member or workspace member
  if (!workspaceMembership && !['OWNER', 'ADMIN'].includes(orgMembership.role)) {
    return null;
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * Get date range for time range filter
 */
function getDateRange(timeRange: TimeRange): Date | null {
  const now = new Date();

  switch (timeRange) {
    case 'today': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today;
    }
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return monthAgo;
    }
    case 'all':
      return null;
    default:
      return null;
  }
}

/**
 * GET /api/workspaces/:workspaceId/dashboard/stats
 *
 * Get comprehensive dashboard statistics for a workspace.
 *
 * Query Parameters:
 * - timeRange: 'today' | 'week' | 'month' | 'all' (default: 'all')
 * - includeActivity: Include recent activity feed (default: true)
 * - activityLimit: Number of activity items to return (default: 10, max: 50)
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns Dashboard statistics object
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate workspace ID parameter
    const params = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(params.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = (searchParams.get('timeRange') as TimeRange) || 'all';
    const includeActivity = searchParams.get('includeActivity') !== 'false';
    const activityLimit = Math.min(
      Math.max(1, parseInt(searchParams.get('activityLimit') || '10', 10)),
      50,
    );

    // Calculate date filters
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const timeRangeDate = getDateRange(timeRange);

    // Execute all queries in parallel for performance
    const [
      membersData,
      activeMembers,
      channelsData,
      messagesData,
      messagesToday,
      messagesWeek,
      messagesMonth,
      workflowsData,
      tasksData,
      topContributors,
    ] = await Promise.all([
      // Member statistics
      prisma.workspaceMember.findMany({
        where: { workspaceId: params.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              isOrchestrator: true,
              lastActiveAt: true,
            },
          },
        },
      }),

      // Active members today (based on lastActiveAt)
      prisma.workspaceMember.count({
        where: {
          workspaceId: params.workspaceId,
          user: {
            lastActiveAt: {
              gte: today,
            },
          },
        },
      }),

      // Channel statistics
      prisma.channel.groupBy({
        by: ['type'],
        where: { workspaceId: params.workspaceId },
        _count: true,
      }),

      // Total messages
      prisma.message.count({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          deletedAt: null,
        },
      }),

      // Messages today
      prisma.message.count({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          createdAt: { gte: today },
          deletedAt: null,
        },
      }),

      // Messages this week
      prisma.message.count({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          createdAt: { gte: weekAgo },
          deletedAt: null,
        },
      }),

      // Messages this month
      prisma.message.count({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          createdAt: { gte: monthAgo },
          deletedAt: null,
        },
      }),

      // Workflow statistics
      prisma.workflow.groupBy({
        by: ['status'],
        where: { workspaceId: params.workspaceId },
        _count: true,
      }),

      // Task statistics
      prisma.task.groupBy({
        by: ['status'],
        where: { workspaceId: params.workspaceId },
        _count: true,
      }),

      // Top contributors (users with most messages)
      prisma.message.groupBy({
        by: ['authorId'],
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          createdAt: timeRangeDate ? { gte: timeRangeDate } : undefined,
          deletedAt: null,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    // Process member statistics
    const totalMembers = membersData.length;
    const orchestratorCount = membersData.filter(m => m.user.isOrchestrator).length;
    const humanCount = totalMembers - orchestratorCount;

    // Process channel statistics
    const channelStats = channelsData.reduce(
      (acc, curr) => {
        if (curr.type === 'PUBLIC') {
          acc.publicCount += curr._count;
        } else if (curr.type === 'PRIVATE') {
          acc.privateCount += curr._count;
        }
        acc.total += curr._count;
        return acc;
      },
      { total: 0, publicCount: 0, privateCount: 0 },
    );

    // Process workflow statistics
    const workflowStats = workflowsData.reduce(
      (acc, curr) => {
        if (curr.status === 'ACTIVE') {
          acc.active += curr._count;
        } else if (curr.status === 'DRAFT') {
          acc.draft += curr._count;
        } else if (curr.status === 'INACTIVE') {
          acc.inactive += curr._count;
        } else if (curr.status === 'ARCHIVED') {
          acc.archived += curr._count;
        }
        acc.total += curr._count;
        return acc;
      },
      { total: 0, active: 0, draft: 0, inactive: 0, archived: 0 },
    );

    // Process task statistics
    const taskStats = tasksData.reduce(
      (acc, curr) => {
        if (curr.status === 'DONE') {
          acc.completed += curr._count;
        } else if (curr.status === 'IN_PROGRESS') {
          acc.inProgress += curr._count;
        } else if (curr.status === 'TODO') {
          acc.todo += curr._count;
        }
        acc.total += curr._count;
        return acc;
      },
      { total: 0, completed: 0, inProgress: 0, todo: 0 },
    );

    const completionRate = taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

    // Get contributor details
    const contributorIds = topContributors.map(c => c.authorId);
    const contributorUsers = await prisma.user.findMany({
      where: { id: { in: contributorIds } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    const contributorMap = new Map(contributorUsers.map(u => [u.id, u]));
    const topContributorsData = topContributors.map(c => {
      const user = contributorMap.get(c.authorId);
      return {
        userId: c.authorId,
        userName: user?.name || 'Unknown User',
        avatarUrl: user?.avatarUrl || null,
        messageCount: c._count.id,
      };
    });

    // Fetch recent activity if requested
    let recentActivity: DashboardStats['recentActivity'] = [];

    if (includeActivity) {
      // Get recent messages as activity
      const recentMessages = await prisma.message.findMany({
        where: {
          channel: {
            workspaceId: params.workspaceId,
          },
          deletedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
            },
          },
          channel: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: activityLimit,
      });

      recentActivity = recentMessages.map(msg => ({
        id: msg.id,
        type: 'message',
        description: `${msg.author.name || 'Someone'} posted in #${msg.channel.name}`,
        timestamp: msg.createdAt,
        userId: msg.authorId,
        userName: msg.author.name || undefined,
      }));
    }

    // Build response
    const stats: DashboardStats = {
      members: {
        total: totalMembers,
        activeToday: activeMembers,
        orchestratorCount,
        humanCount,
      },
      channels: channelStats,
      messages: {
        today: messagesToday,
        week: messagesWeek,
        month: messagesMonth,
        total: messagesData,
      },
      workflows: workflowStats,
      tasks: {
        ...taskStats,
        completionRate,
      },
      recentActivity,
      topContributors: topContributorsData,
    };

    return NextResponse.json({
      data: stats,
      metadata: {
        timeRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/dashboard/stats] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred while fetching dashboard statistics',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
