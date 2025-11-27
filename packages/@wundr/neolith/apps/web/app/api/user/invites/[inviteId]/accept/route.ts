/**
 * Accept Invite API Route
 *
 * Allows users to accept workspace invitations.
 *
 * Routes:
 * - POST /api/user/invites/:inviteId/accept - Accept a workspace invite
 *
 * @module app/api/user/invites/[inviteId]/accept/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import type { Invite, InviteStatus } from '@/lib/validations/admin';

/**
 * Route context with invite ID parameter
 */
interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

/**
 * POST /api/user/invites/:inviteId/accept
 *
 * Accept a workspace invite and add the user as a workspace member.
 *
 * @param request - Next.js request
 * @param context - Route context containing invite ID
 * @returns Success message with workspace details
 */
export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const { inviteId } = await context.params;
    const userEmail = session.user.email;
    const userId = session.user.id;

    // Find the workspace containing this invite
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
        organizationId: true,
      },
    });

    let targetWorkspace: typeof workspaces[0] | null = null;
    let targetInvite: Invite | null = null;

    const now = new Date();

    // Search for the invite across all workspaces
    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];

      const invite = invites.find((i) => i.id === inviteId);
      if (invite) {
        // Update status if expired
        if (invite.status === 'PENDING' && new Date(invite.expiresAt) < now) {
          invite.status = 'EXPIRED' as InviteStatus;
        }

        targetWorkspace = workspace;
        targetInvite = invite;
        break;
      }
    }

    // Validate invite exists
    if (!targetWorkspace || !targetInvite) {
      return NextResponse.json(
        { error: 'Invite not found', code: 'INVITE_NOT_FOUND' },
        { status: 404 },
      );
    }

    // Validate invite belongs to the current user
    if (targetInvite.email !== userEmail) {
      return NextResponse.json(
        { error: 'This invite is for a different email address', code: 'INVITE_EMAIL_MISMATCH' },
        { status: 403 },
      );
    }

    // Validate invite status
    if (targetInvite.status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Invite has already been accepted', code: 'INVITE_ALREADY_ACCEPTED' },
        { status: 400 },
      );
    }

    if (targetInvite.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'Invite has been revoked', code: 'INVITE_REVOKED' },
        { status: 400 },
      );
    }

    if (targetInvite.status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'Invite has expired', code: 'INVITE_EXPIRED' },
        { status: 400 },
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: targetWorkspace.id,
        userId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this workspace', code: 'ALREADY_MEMBER' },
        { status: 400 },
      );
    }

    // Add user to workspace and update invite status in a transaction
    await prisma.$transaction(async (tx) => {
      // Add workspace member
      await tx.workspaceMember.create({
        data: {
          workspaceId: targetWorkspace!.id,
          userId,
          role: targetInvite!.role as 'ADMIN' | 'MEMBER' | 'GUEST' | 'OWNER',
          joinedAt: new Date(),
        },
      });

      // Add to organization if not already a member
      const existingOrgMember = await tx.organizationMember.findFirst({
        where: {
          organizationId: targetWorkspace!.organizationId,
          userId,
        },
      });

      if (!existingOrgMember) {
        await tx.organizationMember.create({
          data: {
            organizationId: targetWorkspace!.organizationId,
            userId,
            role: targetInvite!.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
            joinedAt: new Date(),
          },
        });
      }

      // Update invite status to ACCEPTED
      const settings = (targetWorkspace!.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];
      const updatedInvites = invites.map((i) => {
        if (i.id === inviteId) {
          return { ...i, status: 'ACCEPTED' as InviteStatus };
        }
        return i;
      });

      await tx.workspace.update({
        where: { id: targetWorkspace!.id },
        data: {
          settings: {
            ...settings,
            invites: updatedInvites,
          },
        },
      });
    });

    return NextResponse.json({
      message: 'Invite accepted successfully',
      workspace: {
        id: targetWorkspace.id,
        name: targetWorkspace.name,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/invites/:inviteId/accept] Error:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
