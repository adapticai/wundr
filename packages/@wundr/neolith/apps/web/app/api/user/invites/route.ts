/**
 * User Invites API Routes
 *
 * Handles workspace invites for the current user.
 *
 * Routes:
 * - GET /api/user/invites - List pending workspace invites for current user
 *
 * @module app/api/user/invites/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Invite, InviteStatus } from '@/lib/validations/admin';

/**
 * GET /api/user/invites
 *
 * List all pending workspace invites for the current user's email.
 * Returns invites across all workspaces where the user has been invited.
 *
 * @returns List of pending invites with workspace information
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // Fetch all workspaces and their settings
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        avatarUrl: true,
        settings: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Extract invites for the current user across all workspaces
    const userInvites: Array<
      Invite & {
        workspaceId: string;
        workspaceName: string;
        workspaceSlug: string;
        organizationName: string;
      }
    > = [];

    const now = new Date();

    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      let invites = (settings.invites as Invite[]) || [];

      // Update expired invites
      invites = invites.map(invite => {
        if (invite.status === 'PENDING' && new Date(invite.expiresAt) < now) {
          return { ...invite, status: 'EXPIRED' as InviteStatus };
        }
        return invite;
      });

      // Filter invites for this user that are still pending
      const pendingInvites = invites.filter(
        invite => invite.email === userEmail && invite.status === 'PENDING'
      );

      // Add workspace context to each invite
      for (const invite of pendingInvites) {
        userInvites.push({
          ...invite,
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
          organizationName: workspace.organization.name,
        });
      }
    }

    // Sort by creation date (newest first)
    userInvites.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ invites: userInvites });
  } catch (error) {
    console.error('[GET /api/user/invites] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
