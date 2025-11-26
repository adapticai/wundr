/**
 * VP Channel Activity API Routes
 *
 * Tracks and retrieves VP activity metrics per channel including
 * messages sent, tasks from channel, and last active timestamps.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/vps/:vpId/channel-activity
 * - POST /api/workspaces/:workspaceId/vps/:vpId/channel-activity
 *
 * @module app/api/workspaces/[workspaceId]/vps/[vpId]/channel-activity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { trackChannelActivity } from '@/lib/services/channel-intelligence-service';
import {
  activityMetricsFiltersSchema,
  trackChannelActivitySchema,
  createChannelIntelligenceError,
  CHANNEL_INTELLIGENCE_ERROR_CODES,
} from '@/lib/validations/channel-intelligence';
import { VP_ERROR_CODES, createErrorResponse } from '@/lib/validations/vp';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and VP ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; vpId: string }>;
}

/**
 * Helper function to verify VP workspace access
 */
async function getVPWithWorkspaceAccess(
  workspaceId: string,
  vpId: string,
  userId: string,
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
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
    select: { role: true },
  });

  if (!orgMembership) {
    return null;
  }

  const vp = await prisma.vP.findFirst({
    where: {
      id: vpId,
      organizationId: workspace.organizationId,
      OR: [{ workspaceId }, { workspaceId: null }],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!vp) {
    return null;
  }

  return { vp, role: orgMembership.role, workspace };
}

/**
 * GET /api/workspaces/:workspaceId/vps/:vpId/channel-activity
 *
 * Get VP's activity metrics per channel including:
 * - Messages sent
 * - Tasks created from channel
 * - Last active timestamp
 * - Channel membership details
 *
 * Query Parameters:
 * - startDate: ISO 8601 datetime
 * - endDate: ISO 8601 datetime
 * - includeLeftChannels: boolean (default: false)
 * - minMessageCount: number (default: 0)
 * - sortBy: messageCount | taskCount | lastActive | relevance
 * - sortOrder: asc | desc (default: desc)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * @param request - Next.js request object
 * @param context - Route context with workspace and VP IDs
 * @returns List of channels with activity metrics
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    if (!workspaceId || !vpId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'VP not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const filters = activityMetricsFiltersSchema.parse(searchParams);

    // Build date range filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (filters.startDate) {
      dateFilter.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      dateFilter.lte = new Date(filters.endDate);
    }

    // Get channel memberships with activity data
    const memberships = await prisma.channelMember.findMany({
      where: {
        userId: result.vp.user.id,
        channel: { workspaceId },
        ...(filters.includeLeftChannels ? {} : { leftAt: null }),
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            isArchived: true,
          },
        },
      },
    });

    // For each channel, calculate activity metrics
    const activityMetrics = await Promise.all(
      memberships.map(async (membership) => {
        const messageWhere = {
          channelId: membership.channelId,
          authorId: result.vp.user.id,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        };

        const [messageCount, tasks] = await Promise.all([
          prisma.message.count({ where: messageWhere }),
          prisma.task.findMany({
            where: {
              vpId,
              // Assuming tasks have a channelId or similar reference
              // Adjust based on your schema
            },
            select: { id: true },
          }),
        ]);

        // Get last message timestamp
        const lastMessage = await prisma.message.findFirst({
          where: { channelId: membership.channelId, authorId: result.vp.user.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          channelId: membership.channel.id,
          channelName: membership.channel.name,
          channelSlug: membership.channel.slug,
          channelType: membership.channel.type,
          isArchived: membership.channel.isArchived,
          messagesSent: messageCount,
          tasksFromChannel: tasks.length, // This is a simplified calculation
          lastActiveAt: lastMessage?.createdAt.toISOString() ?? null,
          joinedAt: membership.joinedAt.toISOString(),
          leftAt: membership.leftAt?.toISOString() ?? null,
        };
      }),
    );

    // Filter by minimum message count
    const filteredMetrics = activityMetrics.filter(
      (m) => m.messagesSent >= filters.minMessageCount,
    );

    // Sort
    filteredMetrics.sort((a, b) => {
      let aValue: number | string | null;
      let bValue: number | string | null;

      switch (filters.sortBy) {
        case 'messageCount':
          aValue = a.messagesSent;
          bValue = b.messagesSent;
          break;
        case 'taskCount':
          aValue = a.tasksFromChannel;
          bValue = b.tasksFromChannel;
          break;
        case 'lastActive':
          aValue = a.lastActiveAt ?? '';
          bValue = b.lastActiveAt ?? '';
          break;
        default:
          aValue = a.lastActiveAt ?? '';
          bValue = b.lastActiveAt ?? '';
      }

      if (aValue === null || aValue === '') {
return 1;
}
      if (bValue === null || bValue === '') {
return -1;
}

      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    // Paginate
    const total = filteredMetrics.length;
    const start = (filters.page - 1) * filters.limit;
    const paginatedMetrics = filteredMetrics.slice(start, start + filters.limit);

    return NextResponse.json({
      data: paginatedMetrics,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
        startDate: filters.startDate,
        endDate: filters.endDate,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/vps/:vpId/channel-activity] Error:',
      error,
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'An internal error occurred',
        CHANNEL_INTELLIGENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/vps/:vpId/channel-activity
 *
 * Track a VP channel activity event.
 *
 * Query Parameters:
 * - channelId: string (required)
 *
 * Request Body:
 * - eventType: message_sent | task_created | task_completed | joined_channel | left_channel | mentioned | reacted
 * - metadata: object (optional)
 * - timestamp: ISO 8601 datetime (optional, defaults to now)
 *
 * @param request - Next.js request with activity event data
 * @param context - Route context with workspace and VP IDs
 * @returns Success confirmation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const params = await context.params;
    const { workspaceId, vpId } = params;

    const channelId = request.nextUrl.searchParams.get('channelId');

    if (!workspaceId || !vpId || !channelId) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid parameters',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify access
    const result = await getVPWithWorkspaceAccess(workspaceId, vpId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'VP not found or access denied',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VP_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify channel exists and is in workspace
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        workspaceId,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Channel not found in workspace',
          CHANNEL_INTELLIGENCE_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createChannelIntelligenceError(
          'Invalid JSON body',
          CHANNEL_INTELLIGENCE_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const activityData = trackChannelActivitySchema.parse(body);

    // Track the activity
    await trackChannelActivity({
      vpId,
      channelId,
      eventType: activityData.eventType,
      metadata: activityData.metadata,
      timestamp: activityData.timestamp ? new Date(activityData.timestamp) : undefined,
    });

    return NextResponse.json({
      message: 'Activity tracked successfully',
      data: {
        vpId,
        channelId,
        channelName: channel.name,
        eventType: activityData.eventType,
        timestamp: activityData.timestamp ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/vps/:vpId/channel-activity] Error:',
      error,
    );
    return NextResponse.json(
      createChannelIntelligenceError(
        'An internal error occurred',
        CHANNEL_INTELLIGENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
