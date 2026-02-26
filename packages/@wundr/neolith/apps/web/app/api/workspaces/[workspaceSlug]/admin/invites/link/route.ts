/**
 * Invite Link Generation API Route
 *
 * Handles generating shareable invite links for workspaces.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/invites/link - Generate invite link
 *
 * @module app/api/workspaces/[workspaceId]/admin/invites/link/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Invite,
  type InviteStatus,
} from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * POST /api/workspaces/:workspaceId/admin/invites/link
 *
 * Generate a shareable invite link. Requires admin role.
 * Creates a generic invite that can be used by anyone with the link.
 *
 * @param request - Next.js request with role specification
 * @param context - Route context containing workspace ID
 * @returns Invite link URL
 */
export async function POST(
  request: NextRequest,
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

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
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

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invalid JSON body',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { role = 'MEMBER', expiresInDays = 7 } = body as {
      role?: string;
      expiresInDays?: number;
    };

    // Get current invites
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const currentInvites = (settings.invites as Invite[]) || [];

    // Create new invite link (with no specific email)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const linkInvite: Invite = {
      id: `invite-link-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
      email: '', // Generic link, no specific email
      role: role as string,
      roleId: null,
      status: 'PENDING' as InviteStatus,
      message: null,
      token: generateInviteToken(),
      expiresAt,
      createdAt: new Date(),
      invitedBy: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
      },
    };

    // Save invite link
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          invites: [...currentInvites, linkInvite],
        },
      },
    });

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'invite.created', ${session.user.id}, ${JSON.stringify({ type: 'link', role: role })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    // Generate the invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = `${baseUrl}/invite/accept?token=${linkInvite.token}`;

    return NextResponse.json({
      link: inviteLink,
      invite: linkInvite,
      expiresAt: linkInvite.expiresAt,
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/admin/invites/link] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to generate invite link',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
