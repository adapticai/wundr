/**
 * Admin Invites API Routes
 *
 * Handles workspace invite management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/admin/invites - List invites
 * - POST /api/workspaces/:workspaceId/admin/invites - Create invite(s)
 *
 * @module app/api/workspaces/[workspaceId]/admin/invites/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { sendInvitationEmail, type EmailResponse } from '@/lib/email';
import {
  inviteFiltersSchema,
  batchCreateInvitesSchema,
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
 * GET /api/workspaces/:workspaceId/admin/invites
 *
 * List workspace invites. Requires admin role.
 *
 * @param request - Next.js request with optional status filter
 * @param context - Route context containing workspace ID
 * @returns List of invites
 */
export async function GET(
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

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const workspaceId = workspace.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      status: searchParams.get('status') || undefined,
    };

    // Validate filters
    const parseResult = inviteFiltersSchema.safeParse(filters);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Get invites from workspace settings (in production, this would be a separate table)
    const workspaceData = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspaceData?.settings as Record<string, unknown>) || {};
    let invites = (settings.invites as Invite[]) || [];

    // Update expired invites
    const now = new Date();
    invites = invites.map(invite => {
      if (invite.status === 'PENDING' && new Date(invite.expiresAt) < now) {
        return { ...invite, status: 'EXPIRED' as InviteStatus };
      }
      return invite;
    });

    // Filter by status if specified
    if (parseResult.data.status) {
      invites = invites.filter(i => i.status === parseResult.data.status);
    }

    return NextResponse.json({ invites });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to fetch invites',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/admin/invites
 *
 * Create one or more invites. Requires admin role.
 *
 * @param request - Next.js request with invite data
 * @param context - Route context containing workspace ID
 * @returns Created invites
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

    const { workspaceSlug } = await context.params;

    // Resolve workspace by slug or ID
    const workspaceRecord = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
    });

    if (!workspaceRecord) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const workspaceId = workspaceRecord.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        workspace: { select: { organizationId: true } },
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

    // Validate input
    const parseResult = batchCreateInvitesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Validation failed',
          ADMIN_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Check if any email is already a member
    const existingMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        user: {
          email: {
            in: parseResult.data.invites.map(i => i.email),
          },
        },
      },
      include: { user: { select: { email: true } } },
    });

    if (existingMembers.length > 0) {
      const existingEmails = existingMembers.map(m => m.user.email);
      return NextResponse.json(
        createAdminErrorResponse(
          'Some emails are already members',
          ADMIN_ERROR_CODES.EMAIL_ALREADY_MEMBER,
          { existingEmails }
        ),
        { status: 409 }
      );
    }

    // Get current invites
    const workspaceWithSettings = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings =
      (workspaceWithSettings?.settings as Record<string, unknown>) || {};
    const currentInvites = (settings.invites as Invite[]) || [];

    // Create new invites
    const newInvites: Invite[] = parseResult.data.invites.map(inviteInput => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (inviteInput.expiresInDays || 7));

      return {
        id: `invite-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
        email: inviteInput.email,
        role: inviteInput.role || 'MEMBER',
        roleId: inviteInput.roleId || null,
        status: 'PENDING' as InviteStatus,
        message: inviteInput.message || null,
        token: generateInviteToken(),
        expiresAt,
        createdAt: new Date(),
        invitedBy: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
        },
      };
    });

    // Save invites
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...settings,
          invites: [...currentInvites, ...newInvites],
        },
      },
    });

    // Get workspace details for email
    const workspaceDetails = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        slug: true,
      },
    });

    const workspaceName = workspaceDetails?.name || 'Neolith Workspace';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Send invitation emails
    const emailResults: { email: string; success: boolean; error?: string }[] =
      [];

    for (const invite of newInvites) {
      try {
        const invitationUrl = `${baseUrl}/invite/accept?token=${invite.token}`;

        const emailResult: EmailResponse = await sendInvitationEmail({
          email: invite.email,
          inviterName:
            membership.user.name || membership.user.email || 'Team member',
          workspaceName,
          invitationUrl,
          role: invite.role,
          message: invite.message || undefined,
        });

        emailResults.push({
          email: invite.email,
          success: emailResult.success,
          error: emailResult.error?.message,
        });

        if (!emailResult.success) {
          console.error(
            `[Admin Invites] Failed to send email to ${invite.email}:`,
            emailResult.error
          );
        }
      } catch (error) {
        console.error(
          `[Admin Invites] Exception sending email to ${invite.email}:`,
          error
        );
        emailResults.push({
          email: invite.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log admin action
    await prisma.$executeRaw`
      INSERT INTO admin_actions (id, workspace_id, action, actor_id, metadata, created_at)
      VALUES (gen_random_uuid(), ${workspaceId}, 'invite.created', ${session.user.id}, ${JSON.stringify({ count: newInvites.length, emails: newInvites.map(i => i.email) })}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {
      // Admin actions table may not exist yet, ignore
    });

    // Count successful and failed emails
    const successCount = emailResults.filter(r => r.success).length;
    const failedCount = emailResults.filter(r => !r.success).length;

    return NextResponse.json(
      {
        invites: newInvites,
        emailResults: {
          total: emailResults.length,
          succeeded: successCount,
          failed: failedCount,
          details: emailResults,
        },
      },
      { status: 201 }
    );
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to create invites',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
