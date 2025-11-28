/**
 * Workspace Channels API Routes
 *
 * Handles listing and creating channels within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels - List workspace channels
 * - POST /api/workspaces/:workspaceId/channels - Create new channel
 *
 * @module app/api/workspaces/[workspaceId]/channels/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  createChannelSchema,
  channelTypeEnum,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';
import type { Prisma } from '@prisma/client';

import type { CreateChannelInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access by slug
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: { slug: workspaceSlug },
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
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * Generate channel slug from name
 */
function generateChannelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * GET /api/workspaces/:workspaceId/channels
 *
 * List all channels in a workspace. Requires workspace membership.
 * Supports filtering by type and pagination.
 *
 * Query Parameters:
 * - type: Filter by channel type (PUBLIC, PRIVATE, DM, HUDDLE)
 * - limit: Number of items to return (default: 50, max: 100)
 * - offset: Number of items to skip (default: 0)
 * - includeArchived: Include archived channels (default: false)
 *
 * Response includes:
 * - Member count for each channel
 * - Last message preview (if available)
 * - User's membership status in each channel
 *
 * @param request - Next.js request object with query parameters
 * @param context - Route context containing workspace ID
 * @returns List of channels with pagination metadata
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
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10)),
      100,
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Parse and validate type filter
    const typeParam = searchParams.get('type');
    let typeFilter: string | undefined;
    if (typeParam) {
      const typeResult = channelTypeEnum.safeParse(typeParam);
      if (!typeResult.success) {
        return NextResponse.json(
          createErrorResponse(
            'Invalid channel type. Must be PUBLIC, PRIVATE, DM, or HUDDLE',
            ORG_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }
      typeFilter = typeResult.data;
    }

    // Build where clause
    const where: Prisma.channelWhereInput = {
      workspaceId: actualWorkspaceId,
      ...(!includeArchived && { isArchived: false }),
      ...(typeFilter && { type: typeFilter as 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE' }),
    };

    // For PRIVATE, DM, and HUDDLE channels, only show channels the user is a member of
    // For PUBLIC channels, show all (unless user preference requires membership)
    const isRestrictedView = typeFilter && ['PRIVATE', 'DM', 'HUDDLE'].includes(typeFilter);

    let channelIds: string[] | undefined;
    if (isRestrictedView || typeFilter === undefined) {
      // Get channels the user is a member of
      const userChannelMemberships = await prisma.channelMember.findMany({
        where: {
          userId: session.user.id,
          channel: {
            workspaceId: actualWorkspaceId,
          },
          leftAt: null, // Only active memberships
        },
        select: {
          channelId: true,
        },
      });

      const memberChannelIds = userChannelMemberships.map(m => m.channelId);

      // If filtering by PUBLIC, show all PUBLIC channels
      // Otherwise, only show channels user is a member of
      if (typeFilter === 'PUBLIC') {
        // Show all public channels
      } else {
        // Restrict to channels user is a member of
        if (memberChannelIds.length === 0) {
          // User is not a member of any channels
          return NextResponse.json({
            data: [],
            pagination: {
              limit,
              offset,
              totalCount: 0,
              hasMore: false,
            },
          });
        }
        channelIds = memberChannelIds;
        where.id = { in: channelIds };
      }
    }

    // Get total count for pagination metadata
    const totalCount = await prisma.channel.count({ where });

    // Fetch paginated channels with related data
    const channels = await prisma.channel.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        _count: {
          select: {
            channelMembers: {
              where: {
                leftAt: null, // Only count active members
              },
            },
            messages: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
        messages: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                isOrchestrator: true,
              },
            },
          },
        },
        channelMembers: {
          where: {
            userId: session.user.id,
            leftAt: null,
          },
          select: {
            role: true,
            joinedAt: true,
            lastReadAt: true,
          },
        },
      },
      orderBy: [
        { type: 'asc' }, // PUBLIC first, then PRIVATE, DM, HUDDLE
        { name: 'asc' },
      ],
      skip: offset,
      take: limit,
    });

    // Get unread counts for all channels the user is a member of
    const channelIdsForUnread = channels
      .filter(c => c.channelMembers[0])
      .map(c => c.id);

    // Get unread counts per channel
    const unreadCountsMap = new Map<string, number>();
    if (channelIdsForUnread.length > 0) {
      // Fetch message counts after lastReadAt for each channel
      const unreadCounts = await Promise.all(
        channels.map(async (channel) => {
          const membership = channel.channelMembers[0];
          if (!membership) return { channelId: channel.id, count: 0 };

          const lastReadAt = membership.lastReadAt;
          const count = await prisma.message.count({
            where: {
              channelId: channel.id,
              isDeleted: false,
              ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            },
          });

          return { channelId: channel.id, count };
        })
      );

      unreadCounts.forEach(({ channelId, count }) => {
        unreadCountsMap.set(channelId, count);
      });
    }

    // Get starred status for user's channel memberships
    const memberChannelIds = channels
      .filter(c => c.channelMembers[0])
      .map(c => c.id);

    const starredMemberships = memberChannelIds.length > 0
      ? await prisma.channelMember.findMany({
          where: {
            channelId: { in: memberChannelIds },
            userId: session.user.id,
            isStarred: true,
          },
          select: { channelId: true },
        })
      : [];

    const starredChannelIds = new Set(starredMemberships.map(m => m.channelId));

    // Transform response to include computed fields
    const transformedChannels = channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      description: channel.description,
      topic: channel.topic,
      type: channel.type,
      isArchived: channel.isArchived,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      creator: channel.createdBy,
      memberCount: channel._count.channelMembers,
      messageCount: channel._count.messages,
      unreadCount: unreadCountsMap.get(channel.id) || 0,
      isStarred: starredChannelIds.has(channel.id),
      lastMessage: channel.messages[0] ? {
        id: channel.messages[0].id,
        content: channel.messages[0].content,
        type: channel.messages[0].type,
        createdAt: channel.messages[0].createdAt,
        author: channel.messages[0].author,
      } : null,
      userMembership: channel.channelMembers[0] ? {
        role: channel.channelMembers[0].role,
        joinedAt: channel.channelMembers[0].joinedAt,
        lastReadAt: channel.channelMembers[0].lastReadAt,
        hasUnread: (unreadCountsMap.get(channel.id) || 0) > 0,
      } : null,
    }));

    return NextResponse.json({
      data: transformedChannels,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/channels] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/channels
 *
 * Create a new channel in the workspace. Requires workspace membership.
 *
 * Request Body:
 * - name: Channel name (required, max 80 characters)
 * - description: Channel description (optional, max 500 characters)
 * - type: Channel type (PUBLIC, PRIVATE, DM, HUDDLE) - default: PUBLIC
 * - topic: Channel topic (optional, max 250 characters)
 * - memberIds: Array of user IDs to add to the channel (required for PRIVATE channels)
 *
 * Behavior:
 * - PUBLIC: Creator is added as ADMIN, visible to all workspace members
 * - PRIVATE: Creator is added as ADMIN, only specified members can see/join
 * - DM: Two-person private channel, both members added as MEMBER
 * - HUDDLE: Temporary group channel, creator added as ADMIN
 *
 * @param request - Next.js request with channel data
 * @param context - Route context containing workspace ID
 * @returns Created channel object
 */
export async function POST(
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
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Must be a workspace member to create channels
    if (!access.workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a workspace member to create channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = createChannelSchema.safeParse({
      ...(body as object),
      workspaceId: actualWorkspaceId,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: CreateChannelInput = parseResult.data;

    // Special validation for DM channels
    if (input.type === 'DM') {
      if (!input.memberIds || input.memberIds.length !== 1) {
        return NextResponse.json(
          createErrorResponse(
            'DM channels must have exactly one other member',
            ORG_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }

      // Cannot create DM with self
      if (input.memberIds[0] === session.user.id) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot create DM channel with yourself',
            ORG_ERROR_CODES.DM_SELF_NOT_ALLOWED,
          ),
          { status: 400 },
        );
      }

      // Check if DM already exists
      const existingDM = await prisma.channel.findFirst({
        where: {
          workspaceId: actualWorkspaceId,
          type: 'DM',
          channelMembers: {
            every: {
              userId: {
                in: [session.user.id, input.memberIds[0]],
              },
            },
          },
        },
        include: {
          channelMembers: true,
        },
      });

      if (existingDM && existingDM.channelMembers.length === 2) {
        // Return existing DM channel
        return NextResponse.json(
          createErrorResponse(
            'DM channel already exists',
            ORG_ERROR_CODES.ALREADY_MEMBER,
          ),
          { status: 409 },
        );
      }
    }

    // Validate that PRIVATE channels have at least one member
    if (input.type === 'PRIVATE' && (!input.memberIds || input.memberIds.length === 0)) {
      return NextResponse.json(
        createErrorResponse(
          'Private channels must have at least one member',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate all member IDs are workspace members
    if (input.memberIds && input.memberIds.length > 0) {
      const memberIds = Array.from(new Set(input.memberIds)); // Remove duplicates

      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: actualWorkspaceId,
          userId: {
            in: memberIds,
          },
        },
      });

      if (workspaceMembers.length !== memberIds.length) {
        return NextResponse.json(
          createErrorResponse(
            'All members must be workspace members',
            ORG_ERROR_CODES.USER_NOT_FOUND,
          ),
          { status: 400 },
        );
      }
    }

    // Generate slug
    const slug = generateChannelSlug(input.name);

    // Check for slug uniqueness within workspace
    const existingChannel = await prisma.channel.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: actualWorkspaceId,
          slug,
        },
      },
    });

    if (existingChannel) {
      return NextResponse.json(
        createErrorResponse(
          `A channel with similar name already exists: ${existingChannel.name}`,
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 409 },
      );
    }

    // Create channel with members in a transaction
    const channel = await prisma.$transaction(async (tx) => {
      // Create the channel
      const newChannel = await tx.channel.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          topic: input.topic,
          type: input.type,
          workspaceId: actualWorkspaceId,
          createdById: session.user.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
              isOrchestrator: true,
            },
          },
        },
      });

      // Add creator as member
      const creatorRole = input.type === 'DM' ? 'MEMBER' : 'ADMIN';
      await tx.channelMember.create({
        data: {
          channelId: newChannel.id,
          userId: session.user.id,
          role: creatorRole,
        },
      });

      // Add additional members
      if (input.memberIds && input.memberIds.length > 0) {
        const uniqueMemberIds = Array.from(new Set(input.memberIds)).filter(
          id => id !== session.user.id, // Don't duplicate creator
        );

        if (uniqueMemberIds.length > 0) {
          await tx.channelMember.createMany({
            data: uniqueMemberIds.map(userId => ({
              channelId: newChannel.id,
              userId,
              role: 'MEMBER',
            })),
          });
        }
      }

      return newChannel;
    });

    // Fetch complete channel data with counts
    const completeChannel = await prisma.channel.findUnique({
      where: { id: channel.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
          },
        },
        _count: {
          select: {
            channelMembers: {
              where: {
                leftAt: null,
              },
            },
            messages: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: completeChannel,
        message: 'Channel created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/channels] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
