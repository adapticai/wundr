/**
 * Admin Channel Individual API Routes
 *
 * Handles individual channel operations for admin users.
 *
 * Routes:
 * - PATCH /api/workspaces/:workspaceSlug/admin/channels/:channelId - Update channel
 * - DELETE /api/workspaces/:workspaceSlug/admin/channels/:channelId - Delete channel
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/channels/[channelId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

/**
 * Route context with workspace slug and channel ID
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; channelId: string }>;
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/channels/:channelId
 *
 * Update channel settings, visibility, or archive status.
 *
 * @param request - Next.js request with update data
 * @param context - Route context
 * @returns Updated channel
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId, channelId } = await context.params;


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
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify channel belongs to workspace
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel not found',
          ADMIN_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      topic,
      type,
      isArchived,
      settings,
      createdById,
    } = body;

    // Build update data
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      topic?: string | null;
      type?: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
      isArchived?: boolean;
      settings?: object;
      createdById?: string | null;
    } = {};

    if (name !== undefined) {
      updateData.name = name;
      // Update slug if name changes
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if new slug already exists (excluding current channel)
      const existingChannel = await prisma.channel.findFirst({
        where: {
          workspaceId,
          slug: updateData.slug,
          id: { not: channelId },
        },
      });

      if (existingChannel) {
        return NextResponse.json(
          createAdminErrorResponse(
            'Channel with this name already exists',
            ADMIN_ERROR_CODES.VALIDATION_ERROR,
          ),
          { status: 400 },
        );
      }
    }

    if (description !== undefined) {
updateData.description = description;
}
    if (topic !== undefined) {
updateData.topic = topic;
}
    if (type !== undefined) {
updateData.type = type;
}
    if (isArchived !== undefined) {
updateData.isArchived = isArchived;
}
    if (settings !== undefined) {
updateData.settings = settings;
}
    if (createdById !== undefined) {
updateData.createdById = createdById;
}

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: channelId },
      data: updateData,
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
    });

    return NextResponse.json({
      ...updatedChannel,
      memberCount: updatedChannel._count.channelMembers,
      totalMessages: updatedChannel._count.messages,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to update channel',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceSlug/admin/channels/:channelId
 *
 * Delete a channel permanently.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns Success response
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug: workspaceId, channelId } = await context.params;


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
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify channel belongs to workspace
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel not found',
          ADMIN_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Delete channel (cascade will remove members, messages, etc.)
    await prisma.channel.delete({
      where: { id: channelId },
    });

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to delete channel',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
