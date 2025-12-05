/**
 * Channel Permissions API Route
 *
 * Returns the current user's permissions for a specific channel.
 *
 * Routes:
 * - GET /api/channels/:channelId/permissions - Get user permissions
 *
 * @module app/api/channels/[channelId]/permissions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
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
 * GET /api/channels/:channelId/permissions
 *
 * Get current user's permissions for a channel.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns User permissions object
 */
export async function GET(
  _request: NextRequest,
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

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Fetch channel with workspace info
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        workspace: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get organization membership
    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: channel.workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this organization',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get channel membership
    const channelMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    // For private channels, user must be a member
    if (channel.type === 'PRIVATE' && !channelMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to private channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Calculate permissions based on roles and channel type
    const isOrgOwner = orgMembership.role === 'OWNER';
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(orgMembership.role);
    const isChannelOwner = channelMembership?.role === 'OWNER';
    const isChannelAdmin = channelMembership?.role === 'ADMIN';
    const isMember = !!channelMembership;
    const isPublicChannel = channel.type === 'PUBLIC';

    // Comprehensive permission set based on requirements
    const permissions = {
      // Post and interaction permissions
      canPost: isMember || isPublicChannel,
      canRead: isMember || isPublicChannel,

      // Member management permissions
      canInvite:
        isOrgAdmin ||
        isChannelOwner ||
        isChannelAdmin ||
        (isPublicChannel && isMember),
      canKick: isOrgAdmin || isChannelOwner || isChannelAdmin,
      canRemoveMembers: isOrgAdmin || isChannelOwner || isChannelAdmin, // Alias for canKick

      // Channel management permissions
      canEditChannel: isOrgAdmin || isChannelOwner || isChannelAdmin,
      canEdit: isOrgAdmin || isChannelOwner || isChannelAdmin, // Alias for canEditChannel
      canDelete: isOrgOwner, // Only org owners can delete channels
      canArchive: isOrgAdmin || isChannelOwner || isChannelAdmin,

      // Message management permissions
      canDeleteMessages: isOrgAdmin || isChannelOwner || isChannelAdmin,
      canPin: isOrgAdmin || isChannelOwner || isChannelAdmin,

      // Role management permissions
      canChangeRoles: isOrgAdmin || isChannelOwner,

      // Role indicators
      isOwner: isChannelOwner,
      isAdmin: isChannelAdmin,
      isMember,

      // Current role in channel
      role: channelMembership?.role || null,
    };

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('[GET /api/channels/:channelId/permissions] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
