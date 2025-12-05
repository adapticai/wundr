/**
 * Invitation Validation and Acceptance API Route
 *
 * Public route for validating invitation tokens and accepting invitations.
 *
 * Routes:
 * - GET /api/invites/:inviteId/validate - Validate token and return invitation details
 * - POST /api/invites/:inviteId/validate - Accept the invitation
 *
 * Note: The inviteId parameter is the invitation token used to identify the invite.
 *
 * @module app/api/invites/[inviteId]/validate/route
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

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with inviteId parameter (used as token)
 */
interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

/**
 * Invitation details response
 */
interface InvitationDetails {
  id: string;
  email: string;
  role: string;
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string | null;
  inviterEmail: string | null;
  expiresAt: string;
  status: InviteStatus;
}

/**
 * GET /api/invites/:inviteId/validate
 *
 * Validate an invitation token and return invitation details.
 * This is a public route that doesn't require authentication.
 *
 * @param request - Next.js request
 * @param context - Route context containing inviteId (token)
 * @returns Invitation details or error
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { inviteId: token } = await context.params;

    if (!token) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Token is required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Search for the invite across all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        organizationId: true,
      },
    });

    let foundWorkspace: {
      id: string;
      name: string;
      slug: string;
      settings: Prisma.JsonValue;
      organizationId: string;
    } | null = null;
    let foundInvite: Invite | null = null;

    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];
      const invite = invites.find(i => i.token === token);
      if (invite) {
        foundWorkspace = workspace;
        foundInvite = invite;
        break;
      }
    }

    if (!foundWorkspace || !foundInvite) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invitation not found',
          ADMIN_ERROR_CODES.INVITE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if expired
    const isExpired = new Date(foundInvite.expiresAt) < new Date();
    if (isExpired && foundInvite.status === 'PENDING') {
      // Update status to expired
      const settings =
        (foundWorkspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];
      const updatedInvites = invites.map(i => {
        if (i.id === foundInvite!.id) {
          return { ...i, status: 'EXPIRED' as InviteStatus };
        }
        return i;
      });

      await prisma.workspace.update({
        where: { id: foundWorkspace.id },
        data: {
          settings: {
            ...settings,
            invites: updatedInvites,
          } as Prisma.InputJsonValue,
        },
      });

      foundInvite.status = 'EXPIRED';
    }

    // Get creator details
    const creator = await prisma.user.findUnique({
      where: { id: foundInvite.invitedBy.id },
      select: { name: true, email: true },
    });

    // Return invitation details (without sensitive token)
    const invitationDetails: InvitationDetails = {
      id: foundInvite.id,
      email: foundInvite.email,
      role: foundInvite.role,
      workspaceName: foundWorkspace.name,
      workspaceSlug: foundWorkspace.slug,
      inviterName: creator?.name ?? null,
      inviterEmail: creator?.email ?? null,
      expiresAt: foundInvite.expiresAt.toISOString(),
      status: foundInvite.status,
    };

    return NextResponse.json({ invitation: invitationDetails });
  } catch (error) {
    console.error('[GET /api/invites/:inviteId/validate] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to validate invitation',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/invites/:inviteId/validate
 *
 * Accept an invitation. Requires authentication.
 * - If user is logged in, add them to workspace
 * - If not logged in, return error (user should register/login first)
 *
 * @param request - Next.js request
 * @param context - Route context containing inviteId (token)
 * @returns Workspace membership info or error
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'You must be logged in to accept an invitation',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { inviteId: token } = await context.params;

    if (!token) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Token is required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Search for the invite across all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        organizationId: true,
      },
    });

    let foundWorkspace: {
      id: string;
      name: string;
      slug: string;
      settings: Prisma.JsonValue;
      organizationId: string;
    } | null = null;
    let foundInvite: Invite | null = null;

    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];
      const invite = invites.find(i => i.token === token);
      if (invite) {
        foundWorkspace = workspace;
        foundInvite = invite;
        break;
      }
    }

    if (!foundWorkspace || !foundInvite) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Invitation not found',
          ADMIN_ERROR_CODES.INVITE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check invite status
    if (foundInvite.status === 'ACCEPTED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'This invitation has already been accepted',
          ADMIN_ERROR_CODES.INVITE_ALREADY_ACCEPTED,
        ),
        { status: 400 },
      );
    }

    if (foundInvite.status === 'REVOKED') {
      return NextResponse.json(
        createAdminErrorResponse(
          'This invitation has been revoked',
          ADMIN_ERROR_CODES.INVITE_REVOKED,
        ),
        { status: 400 },
      );
    }

    // Check if expired
    if (new Date(foundInvite.expiresAt) < new Date()) {
      return NextResponse.json(
        createAdminErrorResponse(
          'This invitation has expired',
          ADMIN_ERROR_CODES.INVITE_EXPIRED,
        ),
        { status: 400 },
      );
    }

    // Verify email matches (optional, for extra security)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (
      user?.email &&
      foundInvite.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'This invitation was sent to a different email address',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check if already a member
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: foundWorkspace.id, userId: session.user.id },
    });

    if (existingMembership) {
      return NextResponse.json(
        createAdminErrorResponse(
          'You are already a member of this workspace',
          ADMIN_ERROR_CODES.EMAIL_ALREADY_MEMBER,
        ),
        { status: 409 },
      );
    }

    // Ensure user is a member of the organization
    const orgMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: foundWorkspace.organizationId,
        userId: session.user.id,
      },
    });

    if (!orgMembership) {
      // Add user to organization first
      await prisma.organizationMember.create({
        data: {
          organizationId: foundWorkspace.organizationId,
          userId: session.user.id,
          role: 'MEMBER',
        },
      });
    }

    // Add user to workspace
    const membership = await prisma.workspaceMember.create({
      data: {
        workspaceId: foundWorkspace.id,
        userId: session.user.id,
        role: foundInvite.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST',
      },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    // Update invite status to ACCEPTED
    const settings = (foundWorkspace.settings as Record<string, unknown>) || {};
    const invites = (settings.invites as Invite[]) || [];
    const updatedInvites = invites.map(i => {
      if (i.id === foundInvite!.id) {
        return { ...i, status: 'accepted' as InviteStatus };
      }
      return i;
    });

    await prisma.workspace.update({
      where: { id: foundWorkspace.id },
      data: {
        settings: {
          ...settings,
          invites: updatedInvites,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      message: 'Invitation accepted successfully',
      membership: {
        id: membership.id,
        role: membership.role,
        workspace: membership.workspace,
        joinedAt: membership.joinedAt,
      },
    });
  } catch (error) {
    console.error('[POST /api/invites/:inviteId/validate] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to accept invitation',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
