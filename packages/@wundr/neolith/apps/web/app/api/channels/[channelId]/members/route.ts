/**
 * Channel Members API Routes
 *
 * Handles listing and adding members to a channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/members - List channel members
 * - POST /api/channels/:channelId/members - Add member to channel
 *
 * @module app/api/channels/[channelId]/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';
import {
  channelIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Helper to check channel access
 */
async function checkChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel) {
return null;
}

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: channel.workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
return null;
}

  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  return {
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * GET /api/channels/:channelId/members
 *
 * List all members of a channel. Requires channel membership for private channels.
 * Supports search parameter for @mentions - when search is provided, searches all
 * workspace members (including orchestrators) for mention suggestions.
 *
 * Query Parameters:
 * - search: Optional search query for filtering members by name/email (for @mentions)
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns List of channel members (or workspace members when searching)
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

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkChannelAccess(params.channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // For private channels, user must be a member
    if (access.channel.type === 'PRIVATE' && !access.channelMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to private channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse search parameter for @mentions
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // If search is provided, return workspace members (for mention suggestions)
    // This includes all workspace members (humans and orchestrators)
    if (search !== null) {
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: access.channel.workspaceId,
          user: {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isOrchestrator: true,
              status: true,
            },
          },
        },
        orderBy: [
          { user: { isOrchestrator: 'desc' } }, // Orchestrators first for visibility
          { user: { name: 'asc' } },
        ],
        take: 10, // Limit results for performance
      });

      // Transform to match expected format
      const members = workspaceMembers.map((wm) => ({
        id: wm.user.id,
        name: wm.user.displayName || wm.user.name || 'Unknown',
        email: wm.user.email,
        image: wm.user.avatarUrl,
        isOrchestrator: wm.user.isOrchestrator,
        status: wm.user.status,
      }));

      return NextResponse.json({
        members,
        count: members.length,
      });
    }

    // Fetch all channel members (no search)
    const members = await prisma.channelMember.findMany({
      where: { channelId: params.channelId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isOrchestrator: true,
            status: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({
      data: members,
      count: members.length,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/members] Error:', error);
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
 * POST /api/channels/:channelId/members
 *
 * Add a member to the channel. Requires channel ADMIN role.
 * User must be a workspace member.
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing channel ID
 * @returns Created membership object
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

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkChannelAccess(params.channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Channel Admin required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

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

    // Support both single userId and array of userIds
    const bodyWithUserIds = body as { userId?: string; userIds?: string[]; role?: string; includeHistory?: boolean };

    // Convert to array format for unified processing
    const userIds = bodyWithUserIds.userIds || (bodyWithUserIds.userId ? [bodyWithUserIds.userId] : []);
    const role = bodyWithUserIds.role || 'MEMBER';

    if (userIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one userId is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate all user IDs are strings
    if (!userIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
      return NextResponse.json(
        createErrorResponse(
          'All user IDs must be non-empty strings',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get all workspace memberships for the users
    const workspaceMemberships = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: access.channel.workspaceId,
        userId: { in: userIds },
      },
      include: {
        user: true,
      },
    });

    const workspaceMemberIds = new Set(workspaceMemberships.map(wm => wm.userId));
    const nonWorkspaceMembers = userIds.filter((id: string) => !workspaceMemberIds.has(id));

    if (nonWorkspaceMembers.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Users must be workspace members to join the channel: ${nonWorkspaceMembers.join(', ')}`,
          ORG_ERROR_CODES.USER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check for existing channel memberships
    const existingMemberships = await prisma.channelMember.findMany({
      where: {
        channelId: params.channelId,
        userId: { in: userIds },
      },
    });

    const existingMemberIds = new Set(existingMemberships.map(m => m.userId));
    const newUserIds = userIds.filter((id: string) => !existingMemberIds.has(id));

    if (newUserIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'All users are already members of this channel',
          ORG_ERROR_CODES.ALREADY_MEMBER,
        ),
        { status: 409 },
      );
    }

    // Add all new members in a transaction
    const newMemberships = await prisma.$transaction(async (tx) => {
      await tx.channelMember.createMany({
        data: newUserIds.map((userId: string) => ({
          channelId: params.channelId,
          userId,
          role: role as 'ADMIN' | 'MEMBER',
        })),
      });

      // Fetch the created memberships with user details
      return tx.channelMember.findMany({
        where: {
          channelId: params.channelId,
          userId: { in: newUserIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
              avatarUrl: true,
              isOrchestrator: true,
              status: true,
            },
          },
        },
      });
    });

    // Send notifications to all added users (fire and forget)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, displayName: true },
    });
    const inviterName = currentUser?.displayName || currentUser?.name || 'Someone';

    for (const membership of newMemberships) {
      NotificationService.notifyChannelInvite(
        membership.userId,
        params.channelId,
        access.channel.name,
        inviterName,
      ).catch(err => {
        console.error('[POST /api/channels/:channelId/members] Failed to send channel invite notification:', err);
      });
    }

    return NextResponse.json(
      {
        data: newMemberships,
        message: `${newMemberships.length} member(s) added to channel successfully`,
        skipped: existingMemberIds.size,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/members] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
