/**
 * User Activity Analytics API Routes
 *
 * Provides comprehensive user activity analytics including:
 * - Activity timeline with messages, tasks, reactions, and file uploads
 * - Message metrics (sent/received counts, threads, reactions)
 * - Task completion rates and performance
 * - Session duration tracking and activity patterns
 * - Date range filtering for historical analysis
 *
 * Routes:
 * - GET /api/workspaces/[workspaceSlug]/users/[userId]/analytics - Get user activity analytics
 *
 * @module app/api/workspaces/[workspaceSlug]/users/[userId]/analytics/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and user ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; userId: string }>;
}

/**
 * Query parameters for analytics filtering
 */
interface AnalyticsQueryParams {
  from?: string; // ISO date string
  to?: string; // ISO date string
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Helper function to check workspace membership
 */
async function checkWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * Helper function to validate user exists and get basic info
 */
async function getUser(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      status: true,
      lastActiveAt: true,
      createdAt: true,
    },
  });
}

/**
 * Calculate session duration from activity timeline
 */
function calculateSessionMetrics(activities: Array<{ timestamp: Date }>) {
  if (activities.length === 0) {
    return {
      totalSessions: 0,
      avgSessionDuration: 0,
      totalActiveTime: 0,
    };
  }

  // Sort activities by timestamp
  const sorted = [...activities].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  // Group activities into sessions (gap > 30 minutes = new session)
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const sessions: Array<{ start: Date; end: Date; duration: number }> = [];
  let currentSession = { start: sorted[0].timestamp, end: sorted[0].timestamp };

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp.getTime() - currentSession.end.getTime();

    if (gap > SESSION_TIMEOUT_MS) {
      // New session
      sessions.push({
        ...currentSession,
        duration: currentSession.end.getTime() - currentSession.start.getTime(),
      });
      currentSession = { start: sorted[i].timestamp, end: sorted[i].timestamp };
    } else {
      // Continue current session
      currentSession.end = sorted[i].timestamp;
    }
  }

  // Add final session
  sessions.push({
    ...currentSession,
    duration: currentSession.end.getTime() - currentSession.start.getTime(),
  });

  const totalActiveTime = sessions.reduce(
    (sum, session) => sum + session.duration,
    0,
  );
  const avgSessionDuration =
    sessions.length > 0 ? totalActiveTime / sessions.length : 0;

  return {
    totalSessions: sessions.length,
    avgSessionDuration: Math.round(avgSessionDuration / 1000 / 60), // Convert to minutes
    totalActiveTime: Math.round(totalActiveTime / 1000 / 60), // Convert to minutes
  };
}

/**
 * GET /api/workspaces/[workspaceSlug]/users/[userId]/analytics
 *
 * Get comprehensive activity analytics for a user within a workspace.
 * Includes timeline, metrics, task completion, and session tracking.
 *
 * Query parameters:
 * - from: Start date (ISO string, optional)
 * - to: End date (ISO string, optional)
 * - granularity: Time bucket size for timeline (hour/day/week/month, default: day)
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace slug and user ID
 * @returns Comprehensive user activity analytics
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/users/user_456/analytics?from=2025-01-01&to=2025-12-31
 * ```
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
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Parse parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId, userId } = params;

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Invalid parameters: workspaceId and userId required' },
        { status: 400 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const queryParams: AnalyticsQueryParams = {
      from: searchParams.from,
      to: searchParams.to,
      granularity: (searchParams.granularity as any) || 'day',
    };

    // Validate dates
    const fromDate = queryParams.from
      ? new Date(queryParams.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const toDate = queryParams.to ? new Date(queryParams.to) : new Date();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 },
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 },
      );
    }

    // Check workspace membership for requesting user
    const requestingUserMembership = await checkWorkspaceMembership(
      workspaceId,
      session.user.id,
    );

    if (!requestingUserMembership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Check if target user exists and is a member of the workspace
    const targetUser = await getUser(userId);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUserMembership = await checkWorkspaceMembership(
      workspaceId,
      userId,
    );
    if (!targetUserMembership) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 404 },
      );
    }

    // Get user's accessible channels in workspace
    const userChannels = await prisma.channelMember.findMany({
      where: {
        userId,
        channel: {
          workspaceId,
        },
      },
      select: { channelId: true },
    });

    const accessibleChannelIds = userChannels.map(c => c.channelId);

    // Common date filter
    const dateFilter = {
      gte: fromDate,
      lte: toDate,
    };

    // Fetch all metrics in parallel for efficiency
    const [
      messagesSent,
      messagesReceived,
      threadReplies,
      reactionsGiven,
      reactionsReceived,
      filesUploaded,
      tasksCreated,
      tasksAssigned,
      tasksCompleted,
      channelMemberships,
      savedItems,
    ] = await Promise.all([
      // Messages sent by user
      prisma.message.findMany({
        where: {
          authorId: userId,
          channelId: { in: accessibleChannelIds },
          createdAt: dateFilter,
          isDeleted: false,
        },
        select: {
          id: true,
          type: true,
          createdAt: true,
          channelId: true,
          parentId: true,
        },
        orderBy: { createdAt: 'desc' },
      }),

      // Messages received (in channels user is in, excluding user's own messages)
      prisma.message.count({
        where: {
          authorId: { not: userId },
          channelId: { in: accessibleChannelIds },
          createdAt: dateFilter,
          isDeleted: false,
        },
      }),

      // Thread replies to user's messages
      prisma.message.count({
        where: {
          parent: {
            authorId: userId,
          },
          authorId: { not: userId },
          createdAt: dateFilter,
          isDeleted: false,
        },
      }),

      // Reactions given by user
      prisma.reaction.findMany({
        where: {
          userId,
          createdAt: dateFilter,
          message: {
            channelId: { in: accessibleChannelIds },
          },
        },
        select: {
          id: true,
          emoji: true,
          createdAt: true,
          messageId: true,
        },
      }),

      // Reactions received on user's messages
      prisma.reaction.count({
        where: {
          userId: { not: userId },
          message: {
            authorId: userId,
            channelId: { in: accessibleChannelIds },
          },
          createdAt: dateFilter,
        },
      }),

      // Files uploaded by user
      prisma.file.findMany({
        where: {
          uploadedById: userId,
          workspaceId,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      }),

      // Tasks created by user
      prisma.task.findMany({
        where: {
          createdById: userId,
          workspaceId,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          completedAt: true,
        },
      }),

      // Tasks assigned to user
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          workspaceId,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          completedAt: true,
          dueDate: true,
        },
      }),

      // Tasks completed by user (in date range)
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          workspaceId,
          status: 'DONE',
          completedAt: dateFilter,
        },
        select: {
          id: true,
          title: true,
          priority: true,
          createdAt: true,
          completedAt: true,
          dueDate: true,
        },
      }),

      // Channel memberships
      prisma.channelMember.findMany({
        where: {
          userId,
          channel: {
            workspaceId,
          },
        },
        select: {
          channelId: true,
          joinedAt: true,
          lastReadAt: true,
          isStarred: true,
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      }),

      // Saved items
      prisma.savedItem.findMany({
        where: {
          userId,
          workspaceId,
          createdAt: dateFilter,
        },
        select: {
          id: true,
          itemType: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate message metrics
    const messagesByType = messagesSent.reduce(
      (acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const directMessages = messagesSent.filter(msg =>
      channelMemberships.find(
        cm => cm.channelId === msg.channelId && cm.channel.type === 'DM',
      ),
    );

    const threadMessages = messagesSent.filter(msg => msg.parentId !== null);

    // Calculate task metrics
    const taskCompletionRate =
      tasksAssigned.length > 0
        ? (tasksCompleted.length / tasksAssigned.length) * 100
        : 0;

    const tasksByStatus = tasksAssigned.reduce(
      (acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const tasksByPriority = tasksAssigned.reduce(
      (acc, task) => {
        acc[task.priority] = (acc[task.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate average task completion time
    const completedWithTimes = tasksCompleted.filter(
      t => t.completedAt && t.createdAt,
    );
    const avgCompletionTime =
      completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, task) => {
            const duration =
              new Date(task.completedAt!).getTime() -
              new Date(task.createdAt).getTime();
            return sum + duration;
          }, 0) / completedWithTimes.length
        : 0;

    // Calculate on-time delivery rate
    const tasksWithDueDate = tasksCompleted.filter(t => t.dueDate);
    const onTimeDeliveries = tasksWithDueDate.filter(
      t =>
        t.completedAt &&
        t.dueDate &&
        new Date(t.completedAt) <= new Date(t.dueDate),
    );
    const onTimeRate =
      tasksWithDueDate.length > 0
        ? (onTimeDeliveries.length / tasksWithDueDate.length) * 100
        : 0;

    // Build activity timeline (all activity events)
    const activityTimeline = [
      ...messagesSent.map(m => ({
        type: 'message' as const,
        timestamp: m.createdAt,
        data: { id: m.id, messageType: m.type, channelId: m.channelId },
      })),
      ...reactionsGiven.map(r => ({
        type: 'reaction' as const,
        timestamp: r.createdAt,
        data: { id: r.id, emoji: r.emoji, messageId: r.messageId },
      })),
      ...filesUploaded.map(f => ({
        type: 'file' as const,
        timestamp: f.createdAt,
        data: {
          id: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          size: Number(f.size),
        },
      })),
      ...tasksCreated.map(t => ({
        type: 'task_created' as const,
        timestamp: t.createdAt,
        data: { id: t.id, title: t.title, status: t.status },
      })),
      ...tasksCompleted.map(t => ({
        type: 'task_completed' as const,
        timestamp: t.completedAt!,
        data: { id: t.id, title: t.title },
      })),
      ...savedItems.map(s => ({
        type: 'saved_item' as const,
        timestamp: s.createdAt,
        data: { id: s.id, itemType: s.itemType },
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Calculate session metrics from activity timeline
    const sessionMetrics = calculateSessionMetrics(activityTimeline);

    // Group activity by time bucket for visualization
    const activityByPeriod: Record<
      string,
      {
        messages: number;
        reactions: number;
        tasks: number;
        files: number;
      }
    > = {};

    activityTimeline.forEach(activity => {
      let periodKey: string;
      const date = new Date(activity.timestamp);

      switch (queryParams.granularity) {
        case 'hour':
          periodKey = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD
          break;
        }
        case 'month':
          periodKey = date.toISOString().slice(0, 7); // YYYY-MM
          break;
        case 'day':
        default:
          periodKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
          break;
      }

      if (!activityByPeriod[periodKey]) {
        activityByPeriod[periodKey] = {
          messages: 0,
          reactions: 0,
          tasks: 0,
          files: 0,
        };
      }

      if (activity.type === 'message') {
activityByPeriod[periodKey].messages++;
}
      if (activity.type === 'reaction') {
activityByPeriod[periodKey].reactions++;
}
      if (activity.type === 'task_created' || activity.type === 'task_completed') {
activityByPeriod[periodKey].tasks++;
}
      if (activity.type === 'file') {
activityByPeriod[periodKey].files++;
}
    });

    // Calculate peak activity hours
    const activityByHour = new Array(24).fill(0);
    activityTimeline.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours();
      activityByHour[hour]++;
    });
    const peakHour = activityByHour.indexOf(Math.max(...activityByHour));

    // Calculate most active channels
    const channelActivity = messagesSent.reduce(
      (acc, msg) => {
        acc[msg.channelId] = (acc[msg.channelId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const mostActiveChannels = Object.entries(channelActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([channelId, count]) => {
        const channel = channelMemberships.find(
          cm => cm.channelId === channelId,
        );
        return {
          channelId,
          channelName: channel?.channel.name || 'Unknown',
          messageCount: count,
        };
      });

    // Build response
    const response = {
      user: {
        id: targetUser.id,
        name: targetUser.name,
        displayName: targetUser.displayName,
        email: targetUser.email,
        avatarUrl: targetUser.avatarUrl,
        status: targetUser.status,
        lastActiveAt: targetUser.lastActiveAt,
      },
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        granularity: queryParams.granularity,
      },
      overview: {
        totalActivity: activityTimeline.length,
        activeChannels: channelMemberships.length,
        starredChannels: channelMemberships.filter(cm => cm.isStarred).length,
      },
      messages: {
        sent: messagesSent.length,
        received: messagesReceived,
        threads: threadMessages.length,
        threadRepliesReceived: threadReplies,
        directMessages: directMessages.length,
        byType: messagesByType,
        avgPerDay:
          Math.round(
            (messagesSent.length /
              Math.max(
                1,
                (toDate.getTime() - fromDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              )) *
              10,
          ) / 10,
      },
      reactions: {
        given: reactionsGiven.length,
        received: reactionsReceived,
        topEmojis: Object.entries(
          reactionsGiven.reduce(
            (acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        )
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([emoji, count]) => ({ emoji, count })),
      },
      tasks: {
        created: tasksCreated.length,
        assigned: tasksAssigned.length,
        completed: tasksCompleted.length,
        completionRate: Math.round(taskCompletionRate * 10) / 10,
        onTimeDeliveryRate: Math.round(onTimeRate * 10) / 10,
        avgCompletionTimeHours:
          Math.round((avgCompletionTime / (1000 * 60 * 60)) * 10) / 10,
        byStatus: tasksByStatus,
        byPriority: tasksByPriority,
      },
      files: {
        uploaded: filesUploaded.length,
        totalSizeBytes: filesUploaded.reduce(
          (sum, f) => sum + Number(f.size),
          0,
        ),
        byType: filesUploaded.reduce(
          (acc, f) => {
            const type = f.mimeType.split('/')[0] || 'other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      sessions: {
        ...sessionMetrics,
        peakActivityHour: peakHour,
        activityDistribution: activityByHour.map((count, hour) => ({
          hour,
          count,
        })),
      },
      engagement: {
        savedItems: savedItems.length,
        mostActiveChannels,
        channelMemberships: channelMemberships.length,
      },
      timeline: activityTimeline.slice(0, 100), // Limit to most recent 100 events
      activityByPeriod: Object.entries(activityByPeriod)
        .map(([period, counts]) => ({
          period,
          ...counts,
          total:
            counts.messages + counts.reactions + counts.tasks + counts.files,
        }))
        .sort((a, b) => b.period.localeCompare(a.period)),
    };

    return NextResponse.json({
      data: response,
      metadata: {
        generatedAt: new Date().toISOString(),
        requestedBy: session.user.id,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/users/[userId]/analytics] Error:',
      error,
    );
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
