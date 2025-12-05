/**
 * Workspace Channel Detail API Routes
 *
 * Handles workspace-scoped channel operations.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId - Get channel details with members
 * - PATCH /api/workspaces/:workspaceId/channels/:channelId - Update channel
 * - DELETE /api/workspaces/:workspaceId/channels/:channelId - Archive/delete channel
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  channelIdParamSchema,
  workspaceIdParamSchema,
  updateChannelSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { UpdateChannelInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and channel ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    channelId: string;
  }>;
}

/**
 * Helper to check workspace and channel access
 */
async function checkWorkspaceChannelAccess(
  workspaceId: string,
  channelId: string,
  userId: string,
) {
  // Get workspace with organization
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: true,
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

  // Get channel and ensure it belongs to the workspace
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.workspaceId !== workspaceId) {
    return null;
  }

  // Check channel membership
  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  return {
    workspace,
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId
 *
 * Get channel details with members list. Requires channel membership for private channels.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and channel IDs
 * @returns Channel details with members
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

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceResult.success || !channelResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace or channel ID',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkWorkspaceChannelAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace or channel not found, or access denied',
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

    // Fetch channel with full details including members
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
          },
        },
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                status: true,
                isOrchestrator: true,
              },
            },
          },
          orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
        },
        _count: {
          select: {
            channelMembers: true,
            messages: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        ...channel,
        // Transform members for cleaner response
        members: channel?.channelMembers.map(m => ({
          userId: m.user.id,
          role: m.role,
          joinedAt: m.joinedAt,
          lastReadAt: m.lastReadAt,
          user: m.user,
        })),
      },
      membership: access.channelMembership
        ? {
            role: access.channelMembership.role,
            joinedAt: access.channelMembership.joinedAt,
            lastReadAt: access.channelMembership.lastReadAt,
          }
        : null,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId] Error:',
      error,
    );
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
 * PATCH /api/workspaces/:workspaceId/channels/:channelId
 *
 * Update channel. Requires channel ADMIN role or organization ADMIN/OWNER.
 *
 * @param request - Next.js request with update data
 * @param context - Route context containing workspace and channel IDs
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
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceResult.success || !channelResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace or channel ID',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceChannelAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace or channel not found, or access denied',
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
          'Insufficient permissions. Channel Admin or Organization Admin required.',
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
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
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
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.topic !== undefined && { topic: input.topic }),
        ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
          },
        },
        _count: {
          select: {
            channelMembers: true,
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
    console.error(
      '[PATCH /api/workspaces/:workspaceId/channels/:channelId] Error:',
      error,
    );
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
 * DELETE /api/workspaces/:workspaceId/channels/:channelId
 *
 * Delete/archive channel. Requires organization ADMIN/OWNER role.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace and channel IDs
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
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const workspaceResult = workspaceIdParamSchema.safeParse({
      id: workspaceId,
    });
    const channelResult = channelIdParamSchema.safeParse({
      channelId: params.channelId,
    });

    if (!workspaceResult.success || !channelResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace or channel ID',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkWorkspaceChannelAccess(
      workspaceId,
      params.channelId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace or channel not found, or access denied',
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
    console.error(
      '[DELETE /api/workspaces/:workspaceId/channels/:channelId] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
