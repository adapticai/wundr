/**
 * Decline Invite API Route
 *
 * Allows users to decline workspace invitations.
 *
 * Routes:
 * - POST /api/user/invites/:inviteId/decline - Decline a workspace invite
 *
 * @module app/api/user/invites/[inviteId]/decline/route
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
 * POST /api/user/invites/:inviteId/decline
 *
 * Decline a workspace invite by marking it as revoked.
 * Users can only decline invites sent to their email address.
 *
 * @param request - Next.js request
 * @param context - Route context containing invite ID
 * @returns Success message
 */
export async function POST(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { inviteId } = await context.params;
    const userEmail = session.user.email;

    // Find the workspace containing this invite
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        settings: true,
      },
    });

    let targetWorkspace: (typeof workspaces)[0] | null = null;
    let targetInvite: Invite | null = null;

    const now = new Date();

    // Search for the invite across all workspaces
    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];

      const invite = invites.find(i => i.id === inviteId);
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
        { status: 404 }
      );
    }

    // Validate invite belongs to the current user
    if (targetInvite.email !== userEmail) {
      return NextResponse.json(
        {
          error: 'This invite is for a different email address',
          code: 'INVITE_EMAIL_MISMATCH',
        },
        { status: 403 }
      );
    }

    // Validate invite status
    if (targetInvite.status === 'ACCEPTED') {
      return NextResponse.json(
        {
          error: 'Invite has already been accepted',
          code: 'INVITE_ALREADY_ACCEPTED',
        },
        { status: 400 }
      );
    }

    if (targetInvite.status === 'REVOKED') {
      return NextResponse.json(
        {
          error: 'Invite has already been declined',
          code: 'INVITE_ALREADY_DECLINED',
        },
        { status: 400 }
      );
    }

    // Update invite status to REVOKED (declined)
    const settings =
      (targetWorkspace.settings as Record<string, unknown>) || {};
    const invites = (settings.invites as Invite[]) || [];
    const updatedInvites = invites.map(i => {
      if (i.id === inviteId) {
        return { ...i, status: 'REVOKED' as InviteStatus };
      }
      return i;
    });

    await prisma.workspace.update({
      where: { id: targetWorkspace.id },
      data: {
        settings: {
          ...settings,
          invites: updatedInvites,
        },
      },
    });

    return NextResponse.json({
      message: 'Invite declined successfully',
    });
  } catch (error) {
    console.error('[POST /api/user/invites/:inviteId/decline] Error:', error);
    return NextResponse.json(
      { error: 'Failed to decline invite', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
