import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * GET /api/workspaces/:workspaceSlug/customization
 * Fetch workspace customization settings
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Parse customization settings from workspace.settings JSON
    const settings = (workspace.settings as Record<string, unknown>) || {};
    const customization = settings.customization as Record<string, unknown> || {};

    return NextResponse.json({
      customization: {
        // Branding
        logo: customization.logo || '',
        logoText: customization.logoText || '',
        favicon: customization.favicon || '',
        primaryColor: customization.primaryColor || '#3b82f6',
        secondaryColor: customization.secondaryColor || '#8b5cf6',
        accentColor: customization.accentColor || '#10b981',

        // Custom Domain
        customDomain: customization.customDomain || '',
        domainVerified: customization.domainVerified || false,
        sslEnabled: customization.sslEnabled !== false,

        // Email Templates
        emailFromName: customization.emailFromName || '',
        emailReplyTo: customization.emailReplyTo || '',
        emailFooter: customization.emailFooter || '',
        welcomeEmailEnabled: customization.welcomeEmailEnabled !== false,
        welcomeEmailSubject:
          customization.welcomeEmailSubject || 'Welcome to {{workspace}}!',
        welcomeEmailBody:
          customization.welcomeEmailBody ||
          "Hi {{name}},\n\nWelcome to {{workspace}}! We're excited to have you on board.\n\nBest regards,\nThe Team",

        // Notification Templates
        notificationBrandingEnabled:
          customization.notificationBrandingEnabled !== false,
        notificationIcon: customization.notificationIcon || '',
        notificationSound: customization.notificationSound || 'default',

        // Custom CSS
        customCss: customization.customCss || '',
        customCssEnabled: customization.customCssEnabled || false,

        // Sidebar
        sidebarPosition: customization.sidebarPosition || 'left',
        sidebarCollapsible: customization.sidebarCollapsible !== false,
        sidebarDefaultCollapsed: customization.sidebarDefaultCollapsed || false,
        sidebarItems: customization.sidebarItems || [
          {
            id: '1',
            label: 'Dashboard',
            icon: 'Home',
            url: '/dashboard',
            enabled: true,
          },
          {
            id: '2',
            label: 'Messages',
            icon: 'MessageSquare',
            url: '/messages',
            enabled: true,
          },
          {
            id: '3',
            label: 'Channels',
            icon: 'Hash',
            url: '/channels',
            enabled: true,
          },
          {
            id: '4',
            label: 'Files',
            icon: 'Folder',
            url: '/files',
            enabled: true,
          },
        ],

        // Feature Toggles
        features: customization.features || {
          fileSharing: true,
          videoChat: true,
          screenSharing: true,
          messageReactions: true,
          messageThreads: true,
          messageEditing: true,
          userStatus: true,
          richTextEditor: true,
          codeSnippets: true,
          polls: false,
          workflowAutomation: false,
          apiAccess: true,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching customization settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/workspaces/:workspaceSlug/customization
 * Update workspace customization settings
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const updates = await request.json();

    // Find workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
        workspaceMembers: {
          where: { userId: session.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    // Check if user is admin or owner
    const member = workspace.workspaceMembers[0];
    if (!member || (member.role !== 'ADMIN' && member.role !== 'OWNER')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Get current settings
    const currentSettings =
      (workspace.settings as Record<string, unknown>) || {};

    // Update customization settings
    const updatedSettings = {
      ...currentSettings,
      customization: {
        ...(currentSettings.customization as Record<string, unknown> || {}),
        ...updates,
      },
    };

    // Save to database
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: updatedSettings as Prisma.InputJsonValue,
      },
    });

    // Log the customization change
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorType: 'user',
        action: 'workspace.customization.updated',
        resourceType: 'workspace',
        resourceId: workspace.id,
        metadata: {
          changes: Object.keys(updates),
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      customization: updatedSettings.customization,
    });
  } catch (error) {
    console.error('Error updating customization settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
