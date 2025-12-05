/**
 * Resend Invite API Route
 *
 * Handles resending workspace invites.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/admin/invites/:inviteId/resend - Resend invite
 *
 * @module app/api/workspaces/[workspaceId]/admin/invites/[inviteId]/resend/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { sendInvitationEmail, type EmailResponse } from '@/lib/email';
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
 * POST /api/workspaces/:workspaceId/admin/invites/:inviteId/resend
 *
 * Resend an invitation email. Requires admin role.
 * Extends expiration by 7 days if the invite was expired.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace ID and invite ID
 * @returns Success message with email status
 */
export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug, inviteId } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: {
        id: true,
        settings: true,
        name: true,
        slug: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

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
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const invites = (settings.invites as Invite[]) || [];

    // Find the invite
    const inviteIndex = invites.findIndex(i => i.id === inviteId);
    if (inviteIndex === -1) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invite not found',
          ADMIN_ERROR_CODES.INVITE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const invite = invites[inviteIndex];

    // Cannot resend accepted or revoked invites
    if (invite.status === 'ACCEPTED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invite has already been accepted',
          ADMIN_ERROR_CODES.INVITE_ALREADY_ACCEPTED,
        ),
        { status: 400 },
      );
    }

    if (invite.status === 'REVOKED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invite has been revoked',
          ADMIN_ERROR_CODES.INVITE_REVOKED,
        ),
        { status: 400 },
      );
    }

    // Update invite if it was expired - extend expiration by 7 days
    let updatedInvite = invite;
    if (invite.status === 'EXPIRED') {
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      updatedInvite = {
        ...invite,
        status: 'PENDING' as InviteStatus,
        expiresAt: newExpiresAt,
      };

      const updatedInvites = invites.map(i =>
        i.id === inviteId ? updatedInvite : i,
      );

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          settings: {
            ...settings,
            invites: updatedInvites,
          },
        },
      });
    }

    // Send invitation email
    const workspaceName = workspace?.name || 'Neolith Workspace';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/accept?token=${updatedInvite.token}`;

    let emailResult: EmailResponse;
    try {
      emailResult = await sendInvitationEmail({
        email: updatedInvite.email,
        inviterName:
          membership.user.name || membership.user.email || 'Team member',
        workspaceName,
        invitationUrl,
        role: updatedInvite.role,
        message: updatedInvite.message || undefined,
      });

      if (!emailResult.success) {
        console.error(
          `[Resend Invite] Failed to send email to ${updatedInvite.email}:`,
          emailResult.error,
        );
        return NextResponse.json(
          createAdminErrorResponse(
            'Failed to send invitation email',
            ADMIN_ERROR_CODES.INTERNAL_ERROR,
            { emailError: emailResult.error },
          ),
          { status: 500 },
        );
      }
    } catch (error) {
      console.error(
        `[Resend Invite] Exception sending email to ${updatedInvite.email}:`,
        error,
      );
      return NextResponse.json(
        createAdminErrorResponse(
          'Failed to send invitation email',
          ADMIN_ERROR_CODES.INTERNAL_ERROR,
          { error: error instanceof Error ? error.message : 'Unknown error' },
        ),
        { status: 500 },
      );
    }

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, target_type, target_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'invite.created', ${session.user.id}, 'invite', ${inviteId}, ${JSON.stringify({ email: updatedInvite.email, action: 'resend' })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    return NextResponse.json({
      message: 'Invitation email sent successfully',
      invite: updatedInvite,
      emailSent: true,
    });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/admin/invites/:inviteId/resend] Error:',
      error,
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to resend invite',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
