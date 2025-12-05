import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Fetch actual workspace data from database
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        avatarUrl: true,
        visibility: true,
        settings: true,
        updatedAt: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Parse settings JSON if it exists
    const workspaceSettings =
      (workspace.settings as Record<string, unknown>) || {};

    // Return combined workspace data and settings
    return NextResponse.json({
      settings: {
        id: 'settings_' + workspace.id,
        workspaceId: workspace.id,
        // Core workspace fields
        name: workspace.name,
        slug: workspace.slug,
        description: workspace.description || '',
        icon: workspace.avatarUrl, // Map avatarUrl to icon for frontend
        visibility: workspace.visibility?.toLowerCase() || 'private',
        // Settings from JSON field
        allowGuestAccess: workspaceSettings.allowGuestAccess ?? false,
        defaultRole: workspaceSettings.defaultRole,
        messageRetention: workspaceSettings.messageRetention,
        fileRetention: workspaceSettings.fileRetention,
        twoFactorRequired: workspaceSettings.twoFactorRequired ?? false,
        ssoEnabled: workspaceSettings.ssoEnabled ?? false,
        notificationDefaults: workspaceSettings.notificationDefaults ?? {
          email: true,
          push: true,
          desktop: true,
        },
        general: {
          displayName: workspace.name,
          timezone: workspaceSettings.timezone ?? 'UTC',
          locale: workspaceSettings.locale ?? 'en-US',
          allowGuestAccess: workspaceSettings.allowGuestAccess ?? false,
          requireApprovalToJoin:
            workspaceSettings.requireApprovalToJoin ?? true,
        },
        security: {
          sessionTimeout: workspaceSettings.sessionTimeout ?? 480,
          mfaRequired: workspaceSettings.twoFactorRequired ?? false,
          ssoEnabled: workspaceSettings.ssoEnabled ?? false,
        },
        messaging: {
          allowEditing: workspaceSettings.allowEditing ?? true,
          editWindowMinutes: workspaceSettings.editWindowMinutes ?? 15,
          allowDeleting: workspaceSettings.allowDeleting ?? true,
          maxMessageLength: workspaceSettings.maxMessageLength ?? 10000,
          enableThreads: workspaceSettings.enableThreads ?? true,
          enableReactions: workspaceSettings.enableReactions ?? true,
        },
        updatedAt: workspace.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const updates = await request.json();

    // Find the workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Prepare updates for workspace table
    const workspaceUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      workspaceUpdates.name = updates.name;
    }
    if (updates.description !== undefined) {
      workspaceUpdates.description = updates.description;
    }

    // Prepare settings JSON updates
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};
    const settingsUpdates = { ...currentSettings };

    // Copy settings-specific fields to settings JSON
    const settingsFields = [
      'allowGuestAccess',
      'defaultRole',
      'messageRetention',
      'fileRetention',
      'twoFactorRequired',
      'ssoEnabled',
      'notificationDefaults',
      'timezone',
      'locale',
      'requireApprovalToJoin',
      'sessionTimeout',
      'allowEditing',
      'editWindowMinutes',
      'allowDeleting',
      'maxMessageLength',
      'enableThreads',
      'enableReactions',
      'dataRetentionDays',
      'exportEnabled',
      'apiRateLimit',
      'notifyOnNewMember',
      'notifyOnSecurityEvent',
      'weeklyDigest',
      'requireTwoFactor',
      'allowedDomains',
      'defaultChannelId',
      'defaultTimezone',
      'defaultLanguage',
      'allowDiscovery',
      'messageRetentionDays',
      'fileRetentionDays',
    ];

    for (const field of settingsFields) {
      if (updates[field] !== undefined) {
        settingsUpdates[field] = updates[field];
      }
    }

    // Update workspace with both direct fields and settings JSON
    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        ...workspaceUpdates,
        settings: settingsUpdates as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        avatarUrl: true,
        visibility: true,
        settings: true,
        updatedAt: true,
      },
    });

    const finalSettings =
      (updatedWorkspace.settings as Record<string, unknown>) || {};

    return NextResponse.json({
      settings: {
        id: 'settings_' + updatedWorkspace.id,
        workspaceId: updatedWorkspace.id,
        name: updatedWorkspace.name,
        slug: updatedWorkspace.slug,
        description: updatedWorkspace.description || '',
        icon: updatedWorkspace.avatarUrl,
        visibility: updatedWorkspace.visibility?.toLowerCase() || 'private',
        ...finalSettings,
        updatedAt: updatedWorkspace.updatedAt.toISOString(),
        updatedBy: session.user.id,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
