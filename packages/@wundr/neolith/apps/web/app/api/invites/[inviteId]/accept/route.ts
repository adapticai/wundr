/**
 * Accept Invite API Route
 *
 * Public route for accepting workspace invites.
 *
 * Routes:
 * - POST /api/invites/:inviteId/accept - Accept invite with token
 *
 * @module app/api/invites/[inviteId]/accept/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  acceptInviteSchema,
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Invite,
  type InviteStatus,
} from '@/lib/validations/admin';

import type { Prisma } from '@prisma/client';
import type { NextRequest} from 'next/server';

/**
 * Route context with invite ID parameter
 */
interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

/**
 * POST /api/invites/:inviteId/accept
 *
 * Accept an invite. Requires authentication and valid token.
 *
 * @param request - Next.js request with invite token
 * @param context - Route context containing invite ID
 * @returns Workspace membership info
 */
export async function POST(
  request: NextRequest,
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

    const { inviteId } = await context.params;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAdminErrorResponse('Invalid JSON body', ADMIN_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = acceptInviteSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { token } = parseResult.data;

    // Search for the invite across all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, settings: true, organizationId: true },
    });

    let foundWorkspace: { id: string; settings: Prisma.JsonValue; organizationId: string } | null = null;
    let foundInvite: Invite | null = null;

    for (const workspace of workspaces) {
      const settings = (workspace.settings as Record<string, unknown>) || {};
      const invites = (settings.invites as Invite[]) || [];
      const invite = invites.find(i => i.id === inviteId);
      if (invite) {
        foundWorkspace = workspace;
        foundInvite = invite;
        break;
      }
    }

    if (!foundWorkspace || !foundInvite) {
      return NextResponse.json(
        createAdminErrorResponse('Invite not found', ADMIN_ERROR_CODES.INVITE_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify token
    if (foundInvite.token !== token) {
      return NextResponse.json(
        createAdminErrorResponse('Invalid invite token', ADMIN_ERROR_CODES.INVALID_INVITE_TOKEN),
        { status: 400 },
      );
    }

    // Check invite status
    if (foundInvite.status === 'ACCEPTED') {
      return NextResponse.json(
        createAdminErrorResponse('Invite has already been accepted', ADMIN_ERROR_CODES.INVITE_ALREADY_ACCEPTED),
        { status: 400 },
      );
    }

    if (foundInvite.status === 'REVOKED') {
      return NextResponse.json(
        createAdminErrorResponse('Invite has been revoked', ADMIN_ERROR_CODES.INVITE_REVOKED),
        { status: 400 },
      );
    }

    // Check if expired
    if (new Date(foundInvite.expiresAt) < new Date()) {
      return NextResponse.json(
        createAdminErrorResponse('Invite has expired', ADMIN_ERROR_CODES.INVITE_EXPIRED),
        { status: 400 },
      );
    }

    // Verify email matches (optional, for extra security)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (user?.email && foundInvite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        createAdminErrorResponse(
          'This invite was sent to a different email address',
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
        createAdminErrorResponse('You are already a member of this workspace', ADMIN_ERROR_CODES.EMAIL_ALREADY_MEMBER),
        { status: 409 },
      );
    }

    // Ensure user is a member of the organization
    const orgMembership = await prisma.organizationMember.findFirst({
      where: { organizationId: foundWorkspace.organizationId, userId: session.user.id },
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
      if (i.id === inviteId) {
        return { ...i, status: 'ACCEPTED' as InviteStatus };
      }
      return i;
    });

    await prisma.workspace.update({
      where: { id: foundWorkspace.id },
      data: {
        settings: {
          ...settings,
          invites: updatedInvites,
        },
      },
    });

    return NextResponse.json({
      message: 'Invite accepted successfully',
      membership: {
        id: membership.id,
        role: membership.role,
        workspace: membership.workspace,
        joinedAt: membership.joinedAt,
      },
    });
  } catch (error) {
    console.error('[POST /api/invites/:inviteId/accept] Error:', error);
    return NextResponse.json(
      createAdminErrorResponse('Failed to accept invite', ADMIN_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
