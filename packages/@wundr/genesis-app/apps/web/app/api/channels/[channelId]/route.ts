/**
 * Channel Detail API Routes
 *
 * Handles single channel operations.
 *
 * Routes:
 * - GET /api/channels/:channelId - Get channel details
 * - PATCH /api/channels/:channelId - Update channel
 * - DELETE /api/channels/:channelId - Delete channel
 *
 * @module app/api/channels/[channelId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  updateChannelSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateChannelInput } from '@/lib/validations/organization';
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
 * GET /api/channels/:channelId
 *
 * Get channel details. Requires channel membership for private channels.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Channel details
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

    // Fetch channel with details
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: channel,
      membership: access.channelMembership
        ? {
            role: access.channelMembership.role,
            joinedAt: access.channelMembership.joinedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId] Error:', error);
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
 * PATCH /api/channels/:channelId
 *
 * Update channel. Requires channel ADMIN role.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing channel ID
 * @returns Updated channel
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

    // Must be channel admin or org admin/owner
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

    // Validate input
    const parseResult = updateChannelSchema.safeParse(body);
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

    const input: UpdateChannelInput = parseResult.data;

    // Update channel
    const channel = await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.topic !== undefined && { topic: input.topic }),
        ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: channel,
      message: 'Channel updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/channels/:channelId] Error:', error);
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
 * DELETE /api/channels/:channelId
 *
 * Delete channel. Requires org ADMIN/OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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

    // Only org admin/owner can delete channels
    if (!['OWNER', 'ADMIN'].includes(access.orgMembership.role)) {
      return NextResponse.json(
        createErrorResponse(
          'Only organization administrators can delete channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Delete channel (cascades to members, messages, etc.)
    await prisma.channel.delete({
      where: { id: params.channelId },
    });

    return NextResponse.json({
      message: 'Channel deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/channels/:channelId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
