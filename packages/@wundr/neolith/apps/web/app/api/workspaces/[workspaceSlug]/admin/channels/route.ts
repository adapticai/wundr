/**
 * Admin Channels API Routes
 *
 * Handles workspace channel management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/channels - List channels with analytics
 * - POST /api/workspaces/:workspaceSlug/admin/channels - Create a new channel
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/channels/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/channels
 *
 * List workspace channels with analytics data. Requires admin role.
 *
 * @param request - Next.js request with query parameters
 * @param context - Route context containing workspace slug
 * @returns List of channels with member count and activity
 */
export async function GET(
  request: Request,
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

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const isArchived = searchParams.get('archived');
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 100;
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!)
      : 0;

    // Build where clause
    const where: Prisma.channelWhereInput = { workspaceId };

    if (type && ['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'].includes(type)) {
      where.type = type as 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
    }

    if (isArchived !== null) {
      where.isArchived = isArchived === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch channels with analytics
    const [channels, total] = await Promise.all([
      prisma.channel.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              channelMembers: true,
              messages: true,
            },
          },
        },
        orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
        skip: offset,
        take: limit,
      }),
      prisma.channel.count({ where }),
    ]);

    // Calculate activity metrics for each channel (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const channelsWithAnalytics = await Promise.all(
      channels.map(async channel => {
        // Get active members count (members who have read messages recently)
        const activeMembers = await prisma.channelMember.count({
          where: {
            channelId: channel.id,
            lastReadAt: { gte: thirtyDaysAgo },
            leftAt: null,
          },
        });

        // Get recent message count
        const recentMessages = await prisma.message.count({
          where: {
            channelId: channel.id,
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        return {
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          description: channel.description,
          topic: channel.topic,
          type: channel.type,
          isArchived: channel.isArchived,
          settings: channel.settings,
          createdBy: channel.createdBy,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
          memberCount: channel._count.channelMembers,
          totalMessages: channel._count.messages,
          activeMembers,
          recentMessages,
        };
      })
    );

    return NextResponse.json({
      channels: channelsWithAnalytics,
      total,
      limit,
      offset,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch channels',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/channels
 *
 * Create a new channel. Requires admin role.
 *
 * @param request - Next.js request with channel data
 * @param context - Route context containing workspace slug
 * @returns Created channel
 */
export async function POST(
  request: Request,
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

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
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

    const body = await request.json();
    const { name, description, type = 'PUBLIC', settings = {} } = body;

    if (!name) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel name is required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if slug already exists
    const existingChannel = await prisma.channel.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
    });

    if (existingChannel) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel with this name already exists',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Create channel
    const channel = await prisma.channel.create({
      data: {
        name,
        slug,
        description,
        type,
        settings,
        workspaceId,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Add creator as channel owner
    await prisma.channelMember.create({
      data: {
        channelId: channel.id,
        userId: session.user.id,
        role: 'OWNER',
      },
    });

    return NextResponse.json(channel, { status: 201 });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to create channel',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
