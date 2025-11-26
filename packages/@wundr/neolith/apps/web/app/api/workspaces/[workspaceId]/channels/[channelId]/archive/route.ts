/**
 * Channel Archive/Unarchive API Routes
 *
 * Handles archiving and unarchiving channels within a workspace.
 * Only workspace admins (ADMIN or OWNER role) can archive/unarchive channels.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/channels/:channelId/archive - Archive channel
 * - DELETE /api/workspaces/:workspaceId/channels/:channelId/archive - Unarchive channel
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/archive/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  channelIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID and channel ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceId: string; channelId: string }>;
}

/**
 * Helper to check admin access for workspace
 */
async function checkAdminAccess(workspaceId: string, userId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    return null;
  }

  const workspaceMembership = await prisma.workspace_members.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  // Check if user has admin privileges (ADMIN or OWNER role)
  const isAdmin = ['ADMIN', 'OWNER'].includes(workspaceMembership.role);

  return {
    workspace,
    workspaceMembership,
    isAdmin,
  };
}

/**
 * POST /api/workspaces/:workspaceId/channels/:channelId/archive
 *
 * Archive a channel. Only workspace admins can archive channels.
 * Archiving a channel:
 * - Sets isArchived flag to true
 * - Preserves all messages and members
 * - Channel becomes read-only in UI (enforced client-side)
 * - Can be unarchived later
 *
 * Restrictions:
 * - Cannot archive DM channels
 * - Must be workspace ADMIN or OWNER
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID and channel ID
 * @returns Success message with archived channel data
 */
export async function POST(
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

    // Validate parameters
    const params = await context.params;
    const workspaceIdResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    const channelIdResult = channelIdParamSchema.safeParse({ channelId: params.channelId });

    if (!workspaceIdResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    if (!channelIdResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check admin access
    const access = await checkAdminAccess(params.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only workspace admins can archive channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Fetch channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: params.channelId,
        workspaceId: params.workspaceId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Channel not found', ORG_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Cannot archive DM channels
    if (channel.type === 'DM') {
      return NextResponse.json(
        createErrorResponse(
          'DM channels cannot be archived',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check if already archived
    if (channel.isArchived) {
      return NextResponse.json(
        createErrorResponse('Channel is already archived', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Archive the channel
    const updatedChannel = await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        isArchived: true,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
            messages: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updatedChannel.id,
        name: updatedChannel.name,
        slug: updatedChannel.slug,
        description: updatedChannel.description,
        topic: updatedChannel.topic,
        type: updatedChannel.type,
        isArchived: updatedChannel.isArchived,
        createdAt: updatedChannel.createdAt,
        updatedAt: updatedChannel.updatedAt,
        creator: updatedChannel.creator,
        memberCount: updatedChannel._count.members,
        messageCount: updatedChannel._count.messages,
      },
      message: 'Channel archived successfully',
    });
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/channels/:channelId/archive] Error:', error);
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
 * DELETE /api/workspaces/:workspaceId/channels/:channelId/archive
 *
 * Unarchive a channel. Only workspace admins can unarchive channels.
 * Unarchiving a channel:
 * - Sets isArchived flag to false
 * - Makes channel active again
 * - Restores full functionality
 *
 * Restrictions:
 * - Must be workspace ADMIN or OWNER
 * - Channel must be currently archived
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID and channel ID
 * @returns Success message with unarchived channel data
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

    // Validate parameters
    const params = await context.params;
    const workspaceIdResult = workspaceIdParamSchema.safeParse({ id: params.workspaceId });
    const channelIdResult = channelIdParamSchema.safeParse({ channelId: params.channelId });

    if (!workspaceIdResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    if (!channelIdResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check admin access
    const access = await checkAdminAccess(params.workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    if (!access.isAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only workspace admins can unarchive channels',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Fetch channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: params.channelId,
        workspaceId: params.workspaceId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Channel not found', ORG_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if channel is archived
    if (!channel.isArchived) {
      return NextResponse.json(
        createErrorResponse('Channel is not archived', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Unarchive the channel
    const updatedChannel = await prisma.channel.update({
      where: { id: params.channelId },
      data: {
        isArchived: false,
        updatedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        _count: {
          select: {
            members: {
              where: {
                leftAt: null,
              },
            },
            messages: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        id: updatedChannel.id,
        name: updatedChannel.name,
        slug: updatedChannel.slug,
        description: updatedChannel.description,
        topic: updatedChannel.topic,
        type: updatedChannel.type,
        isArchived: updatedChannel.isArchived,
        createdAt: updatedChannel.createdAt,
        updatedAt: updatedChannel.updatedAt,
        creator: updatedChannel.creator,
        memberCount: updatedChannel._count.members,
        messageCount: updatedChannel._count.messages,
      },
      message: 'Channel unarchived successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/workspaces/:workspaceId/channels/:channelId/archive] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
