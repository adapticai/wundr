/**
 * Dashboard Activity Feed API Route
 *
 * Provides a unified activity feed for the workspace dashboard with cursor-based pagination.
 * Includes messages, tasks, workflows, and member activities with actor information.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/dashboard/activity - Get dashboard activity feed
 *
 * @module app/api/workspaces/[workspaceId]/dashboard/activity/route
 */

import { prisma } from '@neolith/database';
import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Activity type filter options
 */
const activityTypeEnum = z.enum([
  'message',
  'task',
  'workflow',
  'member',
  'file',
  'channel',
  'all',
]);

export type ActivityType = z.infer<typeof activityTypeEnum>;

/**
 * Query parameters schema for activity feed
 */
const activityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  type: activityTypeEnum.default('all'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  channelId: z.string().optional(),
  userId: z.string().optional(),
});

export type ActivityQueryParams = z.infer<typeof activityQuerySchema>;

/**
 * Actor information (user or Orchestrator)
 */
interface Actor {
  id: string;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOrchestrator: boolean;
  email?: string | null;
}

/**
 * Target/resource information
 */
interface ActivityTarget {
  type: 'channel' | 'task' | 'workflow' | 'workspace' | 'file' | 'user';
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Unified activity entry
 */
interface ActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  actor: Actor;
  target?: ActivityTarget;
  content?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Helper function to check workspace access
 * Allows access if user is a workspace member OR an org owner/admin
 */
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      organizationId: true,
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

  // Check workspace membership
  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  // User needs to be either an org owner/admin or workspace member
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
 * Fetch message activities
 */
async function fetchMessageActivities(
  workspaceId: string,
  channelId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  userId: string | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  const where: Prisma.messageWhereInput = {
    channel: {
      workspaceId,
      ...(channelId && { id: channelId }),
    },
    isDeleted: false,
    parentId: null, // Only top-level messages
    ...(userId && { authorId: userId }),
    ...(dateFrom && { createdAt: { gte: dateFrom } }),
    ...(dateTo && { createdAt: { lte: dateTo } }),
  };

  const messages = await prisma.message.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
          email: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      _count: {
        select: {
          replies: true,
          reactions: true,
        },
      },
    },
  });

  return messages.map((msg) => ({
    id: `msg_${msg.id}`,
    type: 'message' as ActivityType,
    action: 'posted',
    actor: {
      id: msg.author.id,
      name: msg.author.name,
      displayName: msg.author.displayName,
      avatarUrl: msg.author.avatarUrl,
      isOrchestrator: msg.author.isOrchestrator,
      email: msg.author.email,
    },
    target: {
      type: 'channel' as const,
      id: msg.channel.id,
      name: msg.channel.name,
      metadata: {
        channelType: msg.channel.type,
      },
    },
    content: msg.content.substring(0, 200), // Truncate for feed
    metadata: {
      messageType: msg.type,
      replyCount: msg._count.replies,
      reactionCount: msg._count.reactions,
      isEdited: msg.isEdited,
    },
    timestamp: msg.createdAt,
  }));
}

/**
 * Fetch task activities
 */
async function fetchTaskActivities(
  workspaceId: string,
  userId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  const where: Prisma.taskWhereInput = {
    workspaceId,
    ...(userId && {
      OR: [
        { createdById: userId },
        { assignedToId: userId },
      ],
    }),
    ...(dateFrom && { createdAt: { gte: dateFrom } }),
    ...(dateTo && { createdAt: { lte: dateTo } }),
  };

  const tasks = await prisma.task.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
          email: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
        },
      },
      orchestrator: {
        select: {
          id: true,
          role: true,
          discipline: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return tasks.map((task) => {
    let action = 'created';
    let actorId = task.createdAt;

    // Determine the most recent action
    if (task.completedAt && task.completedAt > task.createdAt) {
      action = 'completed';
      actorId = task.completedAt;
    } else if (task.updatedAt > task.createdAt) {
      action = 'updated';
      actorId = task.updatedAt;
    }

    return {
      id: `task_${task.id}`,
      type: 'task' as ActivityType,
      action,
      actor: {
        id: task.createdBy.id,
        name: task.createdBy.name,
        displayName: task.createdBy.displayName,
        avatarUrl: task.createdBy.avatarUrl,
        isOrchestrator: task.createdBy.isOrchestrator,
        email: task.createdBy.email,
      },
      target: {
        type: 'task' as const,
        id: task.id,
        name: task.title,
        metadata: {
          channelId: task.channel?.id,
          channelName: task.channel?.name,
        },
      },
      content: task.description?.substring(0, 200),
      metadata: {
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate?.toISOString(),
        assignedTo: task.assignedTo ? {
          id: task.assignedTo.id,
          name: task.assignedTo.name || task.assignedTo.displayName,
          isOrchestrator: task.assignedTo.isOrchestrator,
        } : null,
        orchestrator: task.orchestrator ? {
          id: task.orchestrator.id,
          role: task.orchestrator.role,
          discipline: task.orchestrator.discipline,
        } : null,
      },
      timestamp: actorId,
    };
  });
}

/**
 * Fetch workflow activities
 */
async function fetchWorkflowActivities(
  workspaceId: string,
  userId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  // Get recent workflow executions
  const executions = await prisma.workflowExecution.findMany({
    where: {
      workspaceId,
      ...(userId && { triggeredBy: userId }),
      ...(dateFrom && { startedAt: { gte: dateFrom } }),
      ...(dateTo && { startedAt: { lte: dateTo } }),
    },
    take: limit,
    orderBy: { startedAt: 'desc' },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  // Get user info for triggered by
  const userIds = Array.from(new Set(executions.map((e) => e.triggeredBy)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      isOrchestrator: true,
      email: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return executions
    .filter((exec) => userMap.has(exec.triggeredBy))
    .map((exec) => {
      const user = userMap.get(exec.triggeredBy)!;

      return {
        id: `workflow_${exec.id}`,
        type: 'workflow' as ActivityType,
        action: exec.status === 'COMPLETED' ? 'executed' : exec.status.toLowerCase(),
        actor: {
          id: user.id,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isOrchestrator: user.isOrchestrator,
          email: user.email,
        },
        target: {
          type: 'workflow' as const,
          id: exec.workflow.id,
          name: exec.workflow.name,
        },
        metadata: {
          status: exec.status,
          triggerType: exec.triggerType,
          durationMs: exec.durationMs,
          error: exec.error,
          isSimulation: exec.isSimulation,
          completedAt: exec.completedAt?.toISOString(),
        },
        timestamp: exec.startedAt,
      };
    });
}

/**
 * Fetch member activities
 */
async function fetchMemberActivities(
  workspaceId: string,
  userId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  const where: Prisma.workspaceMemberWhereInput = {
    workspaceId,
    ...(userId && { userId }),
    ...(dateFrom && { joinedAt: { gte: dateFrom } }),
    ...(dateTo && { joinedAt: { lte: dateTo } }),
  };

  const members = await prisma.workspaceMember.findMany({
    where,
    take: limit,
    orderBy: { joinedAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
          email: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return members.map((member) => ({
    id: `member_${member.id}`,
    type: 'member' as ActivityType,
    action: 'joined',
    actor: {
      id: member.user.id,
      name: member.user.name,
      displayName: member.user.displayName,
      avatarUrl: member.user.avatarUrl,
      isOrchestrator: member.user.isOrchestrator,
      email: member.user.email,
    },
    target: {
      type: 'workspace' as const,
      id: member.workspace.id,
      name: member.workspace.name,
    },
    metadata: {
      role: member.role,
    },
    timestamp: member.joinedAt,
  }));
}

/**
 * Fetch file activities
 */
async function fetchFileActivities(
  workspaceId: string,
  userId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  const where: Prisma.fileWhereInput = {
    workspaceId,
    ...(userId && { uploadedById: userId }),
    ...(dateFrom && { createdAt: { gte: dateFrom } }),
    ...(dateTo && { createdAt: { lte: dateTo } }),
  };

  const files = await prisma.file.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
          email: true,
        },
      },
    },
  });

  return files.map((file) => ({
    id: `file_${file.id}`,
    type: 'file' as ActivityType,
    action: 'uploaded',
    actor: {
      id: file.uploadedBy.id,
      name: file.uploadedBy.name,
      displayName: file.uploadedBy.displayName,
      avatarUrl: file.uploadedBy.avatarUrl,
      isOrchestrator: file.uploadedBy.isOrchestrator,
      email: file.uploadedBy.email,
    },
    target: {
      type: 'file' as const,
      id: file.id,
      name: file.originalName,
      metadata: {
        mimeType: file.mimeType,
        size: file.size.toString(),
      },
    },
    metadata: {
      status: file.status,
      thumbnailUrl: file.thumbnailUrl,
    },
    timestamp: file.createdAt,
  }));
}

/**
 * Fetch channel activities
 */
async function fetchChannelActivities(
  workspaceId: string,
  userId: string | undefined,
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  limit: number,
): Promise<ActivityEntry[]> {
  const where: Prisma.channelWhereInput = {
    workspaceId,
    ...(userId && { createdById: userId }),
    ...(dateFrom && { createdAt: { gte: dateFrom } }),
    ...(dateTo && { createdAt: { lte: dateTo } }),
  };

  const channels = await prisma.channel.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          isOrchestrator: true,
          email: true,
        },
      },
    },
  });

  return channels
    .filter((ch) => ch.createdBy)
    .map((channel) => ({
      id: `channel_${channel.id}`,
      type: 'channel' as ActivityType,
      action: channel.isArchived ? 'archived' : 'created',
      actor: {
        id: channel.createdBy!.id,
        name: channel.createdBy!.name,
        displayName: channel.createdBy!.displayName,
        avatarUrl: channel.createdBy!.avatarUrl,
        isOrchestrator: channel.createdBy!.isOrchestrator,
        email: channel.createdBy!.email,
      },
      target: {
        type: 'channel' as const,
        id: channel.id,
        name: channel.name,
        metadata: {
          channelType: channel.type,
        },
      },
      metadata: {
        type: channel.type,
        isArchived: channel.isArchived,
        description: channel.description,
      },
      timestamp: channel.createdAt,
    }));
}

/**
 * GET /api/workspaces/:workspaceId/dashboard/activity
 *
 * Get unified activity feed for the workspace dashboard.
 * Supports cursor-based pagination, type filtering, and date range filtering.
 *
 * Query Parameters:
 * - limit: Items per page (default 20, max 100)
 * - cursor: Cursor for pagination (ISO timestamp)
 * - type: Activity type filter (message, task, workflow, member, file, channel, all)
 * - dateFrom: Start date filter (ISO 8601 datetime)
 * - dateTo: End date filter (ISO 8601 datetime)
 * - channelId: Filter by specific channel (messages only)
 * - userId: Filter by specific user/actor
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace ID
 * @returns Unified activity feed with cursor pagination
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/dashboard/activity?limit=20&type=message&channelId=ch_456
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
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Get workspace ID from params
    const { workspaceSlug: workspaceId } = await context.params;

    // Verify workspace access (membership or org owner/admin)
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = activityQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { limit, cursor, type, dateFrom, dateTo, channelId, userId } = parseResult.data;

    // Parse date filters
    const dateFromFilter = dateFrom ? new Date(dateFrom) : undefined;
    const dateToFilter = dateTo ? new Date(dateTo) : undefined;
    const cursorDate = cursor ? new Date(cursor) : undefined;

    // Apply cursor as additional date filter
    const effectiveDateTo = cursorDate && (!dateToFilter || cursorDate < dateToFilter)
      ? cursorDate
      : dateToFilter;

    // Fetch activities based on type filter
    let activities: ActivityEntry[] = [];

    if (type === 'all') {
      // Fetch from all sources in parallel
      const [messages, tasks, workflows, members, files, channels] = await Promise.all([
        fetchMessageActivities(workspaceId, channelId, dateFromFilter, effectiveDateTo, userId, limit),
        fetchTaskActivities(workspaceId, userId, dateFromFilter, effectiveDateTo, limit),
        fetchWorkflowActivities(workspaceId, userId, dateFromFilter, effectiveDateTo, limit),
        fetchMemberActivities(workspaceId, userId, dateFromFilter, effectiveDateTo, limit),
        fetchFileActivities(workspaceId, userId, dateFromFilter, effectiveDateTo, limit),
        fetchChannelActivities(workspaceId, userId, dateFromFilter, effectiveDateTo, limit),
      ]);

      activities = [
        ...messages,
        ...tasks,
        ...workflows,
        ...members,
        ...files,
        ...channels,
      ];
    } else {
      // Fetch specific activity type
      switch (type) {
        case 'message':
          activities = await fetchMessageActivities(
            workspaceId,
            channelId,
            dateFromFilter,
            effectiveDateTo,
            userId,
            limit,
          );
          break;
        case 'task':
          activities = await fetchTaskActivities(
            workspaceId,
            userId,
            dateFromFilter,
            effectiveDateTo,
            limit,
          );
          break;
        case 'workflow':
          activities = await fetchWorkflowActivities(
            workspaceId,
            userId,
            dateFromFilter,
            effectiveDateTo,
            limit,
          );
          break;
        case 'member':
          activities = await fetchMemberActivities(
            workspaceId,
            userId,
            dateFromFilter,
            effectiveDateTo,
            limit,
          );
          break;
        case 'file':
          activities = await fetchFileActivities(
            workspaceId,
            userId,
            dateFromFilter,
            effectiveDateTo,
            limit,
          );
          break;
        case 'channel':
          activities = await fetchChannelActivities(
            workspaceId,
            userId,
            dateFromFilter,
            effectiveDateTo,
            limit,
          );
          break;
      }
    }

    // Sort all activities by timestamp (descending)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit and determine next cursor
    const hasMore = activities.length > limit;
    const resultActivities = activities.slice(0, limit);
    const nextCursor = hasMore && resultActivities.length > 0
      ? resultActivities[resultActivities.length - 1].timestamp.toISOString()
      : null;

    return NextResponse.json({
      data: resultActivities,
      pagination: {
        limit,
        cursor,
        nextCursor,
        hasMore,
      },
      workspace: {
        id: access.workspace.id,
        name: access.workspace.name,
        organizationId: access.workspace.organizationId,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/dashboard/activity] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard activity' },
      { status: 500 },
    );
  }
}
