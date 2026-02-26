/**
 * Invite Link Regeneration API Route
 *
 * Handles regenerating the workspace invite link.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/invite-link/regenerate
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/invite-link/regenerate/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

export async function POST(
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

    // Generate new invite link token
    const token = randomBytes(32).toString('hex');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/invite/accept?token=${token}`;

    // Update workspace settings with new invite link
    const wsSettings = (workspace.settings as Record<string, unknown>) || {};
    const memberSettings =
      (wsSettings.members as Record<string, unknown>) || {};

    await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        settings: {
          ...wsSettings,
          members: {
            ...memberSettings,
            inviteLink,
            inviteLinkToken: token,
            inviteLinkGeneratedAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      inviteLink,
      message: 'Invite link regenerated successfully',
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:slug/admin/invite-link/regenerate] Error:',
      error
    );
    return NextResponse.json(
      { error: 'Failed to regenerate invite link' },
      { status: 500 }
    );
  }
}
