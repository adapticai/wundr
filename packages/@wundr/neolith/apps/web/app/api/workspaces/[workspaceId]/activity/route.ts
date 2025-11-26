/**
 * Workspace Activity Log API Routes
 *
 * Provides activity/audit log access for workspace members.
 * Unlike /admin/activity which requires admin role, this endpoint
 * is accessible to all workspace members but returns filtered results.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/activity - Get workspace activity log
 *
 * @module app/api/workspaces/[workspaceId]/activity/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Activity type enumeration - extends admin action types with member-visible events
 */
const activityTypeEnum = z.enum([
  // Workspace events
  'workspace.created',
  'workspace.updated',
  'workspace.settings_changed',

  // Channel events
  'channel.created',
  'channel.updated',
  'channel.archived',
  'channel.deleted',

  // Member events
  'member.joined',
  'member.left',
  'member.role_changed',
  'member.invited',

  // Message events (high-level only)
  'message.pinned',
  'message.unpinned',

  // File events
  'file.uploaded',
  'file.deleted',

  // Task events
  'task.created',
  'task.updated',
  'task.completed',
  'task.deleted',

  // Workflow events
  'workflow.created',
  'workflow.updated',
  'workflow.executed',
  'workflow.deleted',

  // Integration events
  'integration.connected',
  'integration.disconnected',

  // VP events
  'vp.created',
  'vp.updated',
  'vp.status_changed',
]);

export type ActivityType = z.infer<typeof activityTypeEnum>;

/**
 * Activity log filters schema
 */
const activityLogFiltersSchema = z.object({
  type: activityTypeEnum.optional(),
  userId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ActivityLogFilters = z.infer<typeof activityLogFiltersSchema>;

/**
 * Activity entry interface
 */
interface ActivityEntry {
  id: string;
  type: ActivityType;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isVP: boolean;
  };
  resourceType?: string | null;
  resourceId?: string | null;
  resourceName?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * GET /api/workspaces/:workspaceId/activity
 *
 * Get workspace activity log with filters. Accessible to all workspace members.
 * Returns activity events related to workspace operations.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace ID
 * @returns Paginated list of activity entries
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { workspaceId } = await context.params;

    // Verify workspace membership (any role)
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: {
        workspace: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      type: searchParams.get('type') || undefined,
      userId: searchParams.get('userId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || '0',
    };

    // Validate filters
    const parseResult = activityLogFiltersSchema.safeParse(filters);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { type, userId, dateFrom, dateTo, limit, offset } = parseResult.data;

    // Build activity log from various sources
    // Since there's no dedicated activity_logs table, we aggregate from multiple sources
    const activities: ActivityEntry[] = [];

    // 1. Workspace member activities
    const memberActivities = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        ...(userId && { userId }),
        ...(dateFrom && { joinedAt: { gte: new Date(dateFrom) } }),
        ...(dateTo && { joinedAt: { lte: new Date(dateTo) } }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    activities.push(
      ...memberActivities.map(m => ({
        id: `member-${m.id}`,
        type: 'member.joined' as ActivityType,
        userId: m.userId,
        user: m.user,
        resourceType: 'workspace',
        resourceId: workspaceId,
        resourceName: membership.workspace.name,
        metadata: {
          role: m.role,
        },
        createdAt: m.joinedAt,
      })),
    );

    // 2. Channel activities
    if (!type || type.startsWith('channel.')) {
      const channelActivities = await prisma.channel.findMany({
        where: {
          workspaceId,
          ...(userId && { createdById: userId }),
          ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
          ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isVP: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      activities.push(
        ...channelActivities
          .filter(c => c.createdBy)
          .map(c => ({
            id: `channel-${c.id}`,
            type: 'channel.created' as ActivityType,
            userId: c.createdById!,
            user: c.createdBy!,
            resourceType: 'channel',
            resourceId: c.id,
            resourceName: c.name,
            metadata: {
              type: c.type,
              isArchived: c.isArchived,
            },
            createdAt: c.createdAt,
          })),
      );
    }

    // 3. File activities
    if (!type || type.startsWith('file.')) {
      const fileActivities = await prisma.file.findMany({
        where: {
          workspaceId,
          ...(userId && { uploadedById: userId }),
          ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
          ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isVP: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      activities.push(
        ...fileActivities.map(f => ({
          id: `file-${f.id}`,
          type: 'file.uploaded' as ActivityType,
          userId: f.uploadedById,
          user: f.uploadedBy,
          resourceType: 'file',
          resourceId: f.id,
          resourceName: f.originalName,
          metadata: {
            mimeType: f.mimeType,
            size: f.size.toString(),
            status: f.status,
          },
          createdAt: f.createdAt,
        })),
      );
    }

    // 4. Task activities
    if (!type || type.startsWith('task.')) {
      const taskActivities = await prisma.task.findMany({
        where: {
          workspaceId,
          ...(userId && { createdById: userId }),
          ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
          ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isVP: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      activities.push(
        ...taskActivities.map(t => ({
          id: `task-${t.id}`,
          type: (t.completedAt ? 'task.completed' : 'task.created') as ActivityType,
          userId: t.createdById,
          user: t.createdBy,
          resourceType: 'task',
          resourceId: t.id,
          resourceName: t.title,
          metadata: {
            priority: t.priority,
            status: t.status,
            dueDate: t.dueDate?.toISOString(),
          },
          createdAt: t.completedAt || t.createdAt,
        })),
      );
    }

    // 5. Workflow activities
    if (!type || type.startsWith('workflow.')) {
      const workflowActivities = await prisma.workflow.findMany({
        where: {
          workspaceId,
          ...(userId && { createdBy: userId }),
          ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
          ...(dateTo && { createdAt: { lte: new Date(dateTo) } }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Fetch creators for workflows
      const creatorIds = Array.from(new Set(workflowActivities.map(w => w.createdBy)));
      const creators = await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          isVP: true,
        },
      });
      const creatorMap = new Map(creators.map(c => [c.id, c]));

      activities.push(
        ...workflowActivities
          .filter(w => creatorMap.has(w.createdBy))
          .map(w => ({
            id: `workflow-${w.id}`,
            type: 'workflow.created' as ActivityType,
            userId: w.createdBy,
            user: creatorMap.get(w.createdBy)!,
            resourceType: 'workflow',
            resourceId: w.id,
            resourceName: w.name,
            metadata: {
              status: w.status,
              executionCount: w.executionCount,
            },
            createdAt: w.createdAt,
          })),
      );
    }

    // Sort all activities by date (descending) and apply type filter if specified
    let sortedActivities = activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (type) {
      sortedActivities = sortedActivities.filter(a => a.type === type);
    }

    // Apply pagination
    const total = sortedActivities.length;
    const paginatedActivities = sortedActivities.slice(0, limit);

    return NextResponse.json({
      activities: paginatedActivities,
      total,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        organization: membership.workspace.organization,
      },
      pagination: {
        limit,
        offset,
        hasMore: total > limit,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/activity] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 },
    );
  }
}
