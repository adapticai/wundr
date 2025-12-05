/**
 * Channel Analytics API Routes
 *
 * Provides comprehensive analytics for channel activity including:
 * - Message volume over time
 * - Active users per channel
 * - Peak activity hours
 * - Message type distribution
 * - User engagement metrics
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/channels/:channelId/analytics
 *
 * @module app/api/workspaces/[workspaceSlug]/channels/[channelId]/analytics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  workspaceIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and channel ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    channelId: string;
  }>;
}

/**
 * Analytics query parameters schema
 */
interface AnalyticsQueryParams {
  startDate?: Date;
  endDate?: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
  timezone?: string;
  export?: 'json' | 'csv';
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams: URLSearchParams): AnalyticsQueryParams {
  const now = new Date();
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const params: AnalyticsQueryParams = {
    startDate: searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : defaultStartDate,
    endDate: searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : now,
    granularity: (searchParams.get('granularity') as
      | 'hour'
      | 'day'
      | 'week'
      | 'month') || 'day',
    timezone: searchParams.get('timezone') || 'UTC',
    export: (searchParams.get('export') as 'json' | 'csv') || undefined,
  };

  // Validate dates
  if (params.startDate && params.endDate && params.startDate > params.endDate) {
    throw new Error('startDate must be before endDate');
  }

  return params;
}

/**
 * Helper to check workspace and channel access
 */
async function checkChannelAccess(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  // Get workspace with organization
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: true,
    },
  });

  if (!workspace) {
    return null;
  }

  // Check organization membership
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

  // Get channel and ensure it belongs to the workspace
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.workspaceId !== workspaceId) {
    return null;
  }

  // Check channel membership for private channels
  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  if (channel.type === 'PRIVATE' && !channelMembership) {
    return null;
  }

  return {
    workspace,
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * Get date truncation SQL based on granularity
 */
function getDateTruncExpression(
  granularity: 'hour' | 'day' | 'week' | 'month',
): string {
  switch (granularity) {
    case 'hour':
      return 'DATE_TRUNC(\'hour\', "created_at")';
    case 'day':
      return 'DATE_TRUNC(\'day\', "created_at")';
    case 'week':
      return 'DATE_TRUNC(\'week\', "created_at")';
    case 'month':
      return 'DATE_TRUNC(\'month\', "created_at")';
    default:
      return 'DATE_TRUNC(\'day\', "created_at")';
  }
}

/**
 * Get message volume over time with granularity
 */
async function getMessageVolume(
  channelId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month',
) {
  const dateTrunc = getDateTruncExpression(granularity);

  // Using raw query for better performance with date truncation
  const volumeData = await prisma.$queryRaw<
    Array<{ period: Date; count: bigint }>
  >`
    SELECT
      ${prisma.$queryRawUnsafe(dateTrunc)} as period,
      COUNT(*)::bigint as count
    FROM messages
    WHERE
      channel_id = ${channelId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND is_deleted = false
    GROUP BY period
    ORDER BY period ASC
  `;

  return volumeData.map(row => ({
    period: row.period.toISOString(),
    count: Number(row.count),
  }));
}

/**
 * Get active users per time period
 */
async function getActiveUsers(
  channelId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month',
) {
  const dateTrunc = getDateTruncExpression(granularity);

  const activeUsersData = await prisma.$queryRaw<
    Array<{ period: Date; uniqueUsers: bigint }>
  >`
    SELECT
      ${prisma.$queryRawUnsafe(dateTrunc)} as period,
      COUNT(DISTINCT author_id)::bigint as "uniqueUsers"
    FROM messages
    WHERE
      channel_id = ${channelId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND is_deleted = false
    GROUP BY period
    ORDER BY period ASC
  `;

  return activeUsersData.map(row => ({
    period: row.period.toISOString(),
    uniqueUsers: Number(row.uniqueUsers),
  }));
}

/**
 * Get peak activity hours (0-23)
 */
async function getPeakActivityHours(
  channelId: string,
  startDate: Date,
  endDate: Date,
) {
  const hourlyData = await prisma.$queryRaw<
    Array<{ hour: number; count: bigint }>
  >`
    SELECT
      EXTRACT(HOUR FROM created_at)::integer as hour,
      COUNT(*)::bigint as count
    FROM messages
    WHERE
      channel_id = ${channelId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      AND is_deleted = false
    GROUP BY hour
    ORDER BY count DESC
  `;

  return hourlyData.map(row => ({
    hour: row.hour,
    count: Number(row.count),
  }));
}

/**
 * Get message type distribution
 */
async function getMessageTypeDistribution(
  channelId: string,
  startDate: Date,
  endDate: Date,
) {
  const typeData = await prisma.message.groupBy({
    by: ['type'],
    where: {
      channelId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
    },
    _count: {
      type: true,
    },
  });

  return typeData.map(row => ({
    type: row.type,
    count: row._count.type,
  }));
}

/**
 * Get top contributors
 */
async function getTopContributors(
  channelId: string,
  startDate: Date,
  endDate: Date,
  limit: number = 10,
) {
  const contributors = await prisma.message.groupBy({
    by: ['authorId'],
    where: {
      channelId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
    },
    _count: {
      authorId: true,
    },
    orderBy: {
      _count: {
        authorId: 'desc',
      },
    },
    take: limit,
  });

  // Get user details
  const userIds = contributors.map(c => c.authorId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      avatarUrl: true,
    },
  });

  const userMap = new Map(users.map(u => [u.id, u]));

  return contributors.map(c => ({
    user: userMap.get(c.authorId),
    messageCount: c._count.authorId,
  }));
}

/**
 * Get engagement metrics (replies, reactions)
 */
async function getEngagementMetrics(
  channelId: string,
  startDate: Date,
  endDate: Date,
) {
  // Get messages with replies count
  const messagesWithReplies = await prisma.message.count({
    where: {
      channelId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
      replies: {
        some: {},
      },
    },
  });

  // Get total replies
  const totalReplies = await prisma.message.count({
    where: {
      channelId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
      parentId: {
        not: null,
      },
    },
  });

  // Get total reactions
  const totalReactions = await prisma.reaction.count({
    where: {
      message: {
        channelId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
  });

  // Get total messages for ratios
  const totalMessages = await prisma.message.count({
    where: {
      channelId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      isDeleted: false,
      parentId: null, // Only count top-level messages
    },
  });

  return {
    totalMessages,
    messagesWithReplies,
    totalReplies,
    totalReactions,
    avgRepliesPerMessage: totalMessages > 0 ? totalReplies / totalMessages : 0,
    avgReactionsPerMessage:
      totalMessages > 0 ? totalReactions / totalMessages : 0,
    replyRate: totalMessages > 0 ? messagesWithReplies / totalMessages : 0,
  };
}

/**
 * Get member growth over time
 */
async function getMemberGrowth(
  channelId: string,
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month',
) {
  const dateTrunc = getDateTruncExpression(granularity);

  const growthData = await prisma.$queryRaw<
    Array<{ period: Date; newMembers: bigint; totalMembers: bigint }>
  >`
    WITH member_periods AS (
      SELECT
        ${prisma.$queryRawUnsafe(dateTrunc)} as period,
        COUNT(*)::bigint as "newMembers"
      FROM channel_members
      WHERE
        channel_id = ${channelId}
        AND joined_at >= ${startDate}
        AND joined_at <= ${endDate}
      GROUP BY period
    ),
    cumulative_members AS (
      SELECT
        period,
        "newMembers",
        SUM("newMembers") OVER (ORDER BY period)::bigint as "totalMembers"
      FROM member_periods
    )
    SELECT * FROM cumulative_members
    ORDER BY period ASC
  `;

  return growthData.map(row => ({
    period: row.period.toISOString(),
    newMembers: Number(row.newMembers),
    totalMembers: Number(row.totalMembers),
  }));
}

/**
 * Convert analytics data to CSV format
 */
function convertToCSV(data: Record<string, unknown>): string {
  const sections: string[] = [];

  // Message Volume
  if (data.messageVolume && Array.isArray(data.messageVolume)) {
    sections.push('Message Volume Over Time');
    sections.push('Period,Count');
    (data.messageVolume as Array<{ period: string; count: number }>).forEach(
      row => {
        sections.push(`${row.period},${row.count}`);
      },
    );
    sections.push('');
  }

  // Active Users
  if (data.activeUsers && Array.isArray(data.activeUsers)) {
    sections.push('Active Users Over Time');
    sections.push('Period,Unique Users');
    (
      data.activeUsers as Array<{ period: string; uniqueUsers: number }>
    ).forEach(row => {
      sections.push(`${row.period},${row.uniqueUsers}`);
    });
    sections.push('');
  }

  // Peak Hours
  if (data.peakHours && Array.isArray(data.peakHours)) {
    sections.push('Peak Activity Hours');
    sections.push('Hour,Message Count');
    (data.peakHours as Array<{ hour: number; count: number }>).forEach(row => {
      sections.push(`${row.hour}:00,${row.count}`);
    });
    sections.push('');
  }

  // Message Types
  if (data.messageTypes && Array.isArray(data.messageTypes)) {
    sections.push('Message Type Distribution');
    sections.push('Type,Count');
    (data.messageTypes as Array<{ type: string; count: number }>).forEach(
      row => {
        sections.push(`${row.type},${row.count}`);
      },
    );
    sections.push('');
  }

  // Top Contributors
  if (data.topContributors && Array.isArray(data.topContributors)) {
    sections.push('Top Contributors');
    sections.push('User,Message Count');
    (
      data.topContributors as Array<{
        user?: { name?: string; email: string };
        messageCount: number;
      }>
    ).forEach(row => {
      const userName = row.user?.name || row.user?.email || 'Unknown';
      sections.push(`"${userName}",${row.messageCount}`);
    });
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * GET /api/workspaces/:workspaceSlug/channels/:channelId/analytics
 *
 * Get comprehensive analytics for a channel.
 *
 * Query Parameters:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - granularity: 'hour' | 'day' | 'week' | 'month' (default: 'day')
 * - timezone: Timezone string (default: 'UTC')
 * - export: 'json' | 'csv' (optional, for exporting data)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and channel IDs
 * @returns Channel analytics data
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
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceResult = workspaceIdParamSchema.safeParse({
      workspaceId,
    });
    const channelResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceResult.success || !channelResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace or channel ID',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkChannelAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    let queryParams: AnalyticsQueryParams;

    try {
      queryParams = parseQueryParams(searchParams);
    } catch (error) {
      return NextResponse.json(
        createErrorResponse(
          error instanceof Error ? error.message : 'Invalid query parameters',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const { startDate, endDate, granularity } = queryParams;

    // Fetch all analytics data in parallel
    const [
      messageVolume,
      activeUsers,
      peakHours,
      messageTypes,
      topContributors,
      engagementMetrics,
      memberGrowth,
    ] = await Promise.all([
      getMessageVolume(
        params.channelId,
        startDate!,
        endDate!,
        granularity!,
      ),
      getActiveUsers(params.channelId, startDate!, endDate!, granularity!),
      getPeakActivityHours(params.channelId, startDate!, endDate!),
      getMessageTypeDistribution(params.channelId, startDate!, endDate!),
      getTopContributors(params.channelId, startDate!, endDate!),
      getEngagementMetrics(params.channelId, startDate!, endDate!),
      getMemberGrowth(params.channelId, startDate!, endDate!, granularity!),
    ]);

    // Build response data
    const analyticsData = {
      channel: {
        id: access.channel.id,
        name: access.channel.name,
        type: access.channel.type,
      },
      period: {
        startDate: startDate!.toISOString(),
        endDate: endDate!.toISOString(),
        granularity,
      },
      messageVolume,
      activeUsers,
      peakHours,
      messageTypes,
      topContributors,
      engagement: engagementMetrics,
      memberGrowth,
      summary: {
        totalMessages: engagementMetrics.totalMessages,
        totalReplies: engagementMetrics.totalReplies,
        totalReactions: engagementMetrics.totalReactions,
        uniqueActiveUsers: activeUsers.reduce(
          (max, u) => Math.max(max, u.uniqueUsers),
          0,
        ),
        avgMessagesPerDay:
          messageVolume.reduce((sum, v) => sum + v.count, 0) /
          (messageVolume.length || 1),
        peakActivityHour:
          peakHours.length > 0 ? peakHours[0].hour : null,
      },
    };

    // Handle export formats
    if (queryParams.export === 'csv') {
      const csv = convertToCSV(analyticsData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="channel-${access.channel.slug}-analytics-${new Date().toISOString()}.csv"`,
        },
      });
    }

    // Default JSON response
    return NextResponse.json({
      data: analyticsData,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId/analytics] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
