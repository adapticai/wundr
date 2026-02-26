/**
 * Admin Members Settings API
 *
 * Handles workspace member configuration settings.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/settings/members
 * - PATCH /api/workspaces/:workspaceSlug/admin/settings/members
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/settings/members/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

export async function GET(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;

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

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get member count
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId: workspace.id },
    });

    // Get settings from workspace settings JSON
    const wsSettings = (workspace.settings as Record<string, unknown>) || {};
    const memberSettings =
      (wsSettings.members as Record<string, unknown>) || {};

    return NextResponse.json({
      invitationsEnabled:
        (memberSettings.invitationsEnabled as boolean) ?? true,
      whoCanInvite: (memberSettings.whoCanInvite as string) || 'admins',
      invitationLinkEnabled:
        (memberSettings.invitationLinkEnabled as boolean) ?? false,
      inviteLink: (memberSettings.inviteLink as string) || undefined,
      allowDomainJoin: (memberSettings.allowDomainJoin as boolean) ?? false,
      requireApproval: (memberSettings.requireApproval as boolean) ?? true,
      autoAssignRoleId: (memberSettings.autoAssignRoleId as string) || '',
      allowedDomains: (memberSettings.allowedDomains as string[]) || [],
      guestAccessEnabled:
        (memberSettings.guestAccessEnabled as boolean) ?? false,
      guestChannelAccess:
        (memberSettings.guestChannelAccess as string) || 'specific',
      guestAccountExpiration:
        (memberSettings.guestAccountExpiration as number) || 30,
      memberLimit: (memberSettings.memberLimit as number) || undefined,
      currentMemberCount: memberCount,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:slug/admin/settings/members] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to fetch member settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug } = await context.params;
    const body = await request.json();

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

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const wsSettings = (workspace.settings as Record<string, unknown>) || {};
    const currentMemberSettings =
      (wsSettings.members as Record<string, unknown>) || {};

    const updatedMemberSettings = {
      ...currentMemberSettings,
      ...body,
    };

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: {
          ...wsSettings,
          members: updatedMemberSettings,
        },
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedMemberSettings,
    });
  } catch (error) {
    console.error(
      '[PATCH /api/workspaces/:slug/admin/settings/members] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to update member settings' },
      { status: 500 }
    );
  }
}
