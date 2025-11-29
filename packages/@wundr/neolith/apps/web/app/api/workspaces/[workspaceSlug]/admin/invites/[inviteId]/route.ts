/**
 * Invite Detail API Routes
 *
 * Handles revoking workspace invites.
 *
 * Routes:
 * - DELETE /api/workspaces/:workspaceId/admin/invites/:inviteId - Revoke invite
 *
 * @module app/api/workspaces/[workspaceId]/admin/invites/[inviteId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Invite,
  type InviteStatus,
} from '@/lib/validations/admin';

/**
 * Route context with workspace ID and invite ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; inviteId: string }>;
}

/**
 * DELETE /api/workspaces/:workspaceId/admin/invites/:inviteId
 *
 * Revoke an invite. Requires admin role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and invite ID
 * @returns Success message
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse('Unauthorized', ADMIN_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { workspaceSlug, inviteId } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse('Workspace not found', ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND),
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (!membership || !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)) {
      return NextResponse.json(
        createAdminErrorResponse('Admin access required', ADMIN_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const invites = (settings.invites as Invite[]) || [];

    // Find the invite
    const inviteIndex = invites.findIndex(i => i.id === inviteId);
    if (inviteIndex === -1) {
      return NextResponse.json(
        createAdminErrorResponse('Invite not found', ADMIN_ERROR_CODES.INVITE_NOT_FOUND),
        { status: 404 },
      );
    }

    const invite = invites[inviteIndex];

    // Cannot revoke already accepted or revoked invites
    if (invite.status === 'ACCEPTED') {
      return NextResponse.json(
        createAdminErrorResponse('Invite has already been accepted', ADMIN_ERROR_CODES.INVITE_ALREADY_ACCEPTED),
        { status: 400 },
      );
    }

    if (invite.status === 'REVOKED') {
      return NextResponse.json(
        createAdminErrorResponse('Invite has already been revoked', ADMIN_ERROR_CODES.INVITE_REVOKED),
        { status: 400 },
      );
    }

    // Update invite status to REVOKED
    const updatedInvites = invites.map(i => {
      if (i.id === inviteId) {
        return { ...i, status: 'REVOKED' as InviteStatus };
      }
      return i;
    });

    // Build the updated settings object for Prisma JSON field
    const updatedSettings = {
      ...settings,
      invites: updatedInvites,
    };

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: updatedSettings,
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'invite.revoked', ${session.user.id}, 'invite', ${inviteId}, ${JSON.stringify({ email: invite.email })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({ message: 'Invite revoked successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[DELETE /api/workspaces/:workspaceId/admin/invites/:inviteId] Error:', errorMessage);
    console.error('Stack:', errorStack);
    return NextResponse.json(
      createAdminErrorResponse(`Failed to revoke invite: ${errorMessage}`, ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
