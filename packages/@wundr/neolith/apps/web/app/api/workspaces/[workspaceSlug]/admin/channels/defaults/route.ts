/**
 * Admin Channel Default Settings API
 *
 * Manages default channel settings for the workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/channels/defaults - Get default settings
 * - PATCH /api/workspaces/:workspaceSlug/admin/channels/defaults - Update default settings
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/channels/defaults/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

/**
 * Route context with workspace slug
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Default channel settings interface
 */
interface ChannelDefaults {
  autoJoinPublic: boolean;
  defaultType: 'PUBLIC' | 'PRIVATE';
  allowMemberCreation: boolean;
  requireApproval: boolean;
  maxChannelsPerUser: number;
  notificationDefaults: {
    muteByDefault: boolean;
    desktopNotifications: boolean;
    emailNotifications: boolean;
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/channels/defaults
 *
 * Get default channel settings for the workspace.
 *
 * @param request - Next.js request
 * @param context - Route context
 * @returns Default channel settings
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

    // Get workspace settings
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

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

    // Extract channel defaults from workspace settings
    const settings = workspace.settings as Record<string, unknown>;
    const channelDefaults = (settings.channelDefaults as ChannelDefaults) || {
      autoJoinPublic: true,
      defaultType: 'PUBLIC',
      allowMemberCreation: true,
      requireApproval: false,
      maxChannelsPerUser: 50,
      notificationDefaults: {
        muteByDefault: false,
        desktopNotifications: true,
        emailNotifications: false,
      },
    };

    return NextResponse.json({ defaults: channelDefaults });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch default settings',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceSlug/admin/channels/defaults
 *
 * Update default channel settings for the workspace.
 *
 * @param request - Next.js request with updated settings
 * @param context - Route context
 * @returns Updated default settings
 */
export async function PATCH(
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

    // Get workspace settings
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

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
    const updates = body.defaults;

    if (!updates) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Updates are required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Merge with existing settings
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const currentDefaults =
      (currentSettings.channelDefaults as ChannelDefaults) || {};

    const newDefaults = {
      ...currentDefaults,
      ...updates,
      notificationDefaults: {
        ...currentDefaults.notificationDefaults,
        ...updates.notificationDefaults,
      },
    };

    // Update workspace settings
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...currentSettings,
          channelDefaults: newDefaults,
        },
      },
      select: { settings: true },
    });

    const updatedSettings = updatedWorkspace.settings as Record<
      string,
      unknown
    >;

    return NextResponse.json({
      defaults: updatedSettings.channelDefaults as ChannelDefaults,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to update default settings',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
