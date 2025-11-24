/**
 * Channel Member Detail API Routes
 *
 * Handles single member operations within a channel.
 *
 * Routes:
 * - PATCH /api/channels/:channelId/members/:userId - Update member role
 * - DELETE /api/channels/:channelId/members/:userId - Remove member
 *
 * @module app/api/channels/[channelId]/members/[userId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  userIdParamSchema,
  updateChannelMemberRoleSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateChannelMemberRoleInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel and user ID parameters
 */
interface RouteContext {
  params: Promise<{ channelId: string; userId: string }>;
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
 * PATCH /api/channels/:channelId/members/:userId
 *
 * Update a member's role. Requires channel ADMIN role.
 *
 * @param request - Next.js request with role data
 * @param context - Route context containing channel and user IDs
 * @returns Updated membership object
 */
export async function PATCH(
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

    // Validate parameters
    const params = await context.params;
    const channelParamResult = channelIdParamSchema.safeParse({ channelId: params.channelId });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!channelParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's access and permission
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

    // Get target member
    const targetMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: params.userId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this channel',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
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
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateChannelMemberRoleSchema.safeParse(body);
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

    const input: UpdateChannelMemberRoleInput = parseResult.data;

    // Update member role
    const updatedMembership = await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: params.userId,
        },
      },
      data: { role: input.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedMembership,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/channels/:channelId/members/:userId] Error:', error);
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
 * DELETE /api/channels/:channelId/members/:userId
 *
 * Remove a member from the channel. Requires channel ADMIN role.
 * Users can remove themselves (leave).
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel and user IDs
 * @returns Success message
 */
export async function DELETE(
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

    // Validate parameters
    const params = await context.params;
    const channelParamResult = channelIdParamSchema.safeParse({ channelId: params.channelId });
    const userParamResult = userIdParamSchema.safeParse({ userId: params.userId });

    if (!channelParamResult.success || !userParamResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid parameter format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check requester's access
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

    // Users can remove themselves, or admins can remove others
    const isSelf = session.user.id === params.userId;
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isSelf && !isOrgAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get target member
    const targetMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: params.userId,
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Member not found in this channel',
          ORG_ERROR_CODES.MEMBER_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if this is the last admin
    if (targetMembership.role === 'ADMIN') {
      const adminCount = await prisma.channelMember.count({
        where: {
          channelId: params.channelId,
          role: 'ADMIN',
        },
      });

      if (adminCount === 1) {
        return NextResponse.json(
          createErrorResponse(
            'Cannot remove the last channel admin. Promote another member first.',
            ORG_ERROR_CODES.CANNOT_LEAVE_LAST_ADMIN,
          ),
          { status: 400 },
        );
      }
    }

    // Remove member
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: params.userId,
        },
      },
    });

    return NextResponse.json({
      message: 'Member removed from channel successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/channels/:channelId/members/:userId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
