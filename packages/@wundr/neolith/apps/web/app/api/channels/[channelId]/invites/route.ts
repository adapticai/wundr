/**
 * Channel Email Invites API Routes
 *
 * Handles sending email invitations to join a channel.
 *
 * Routes:
 * - POST /api/channels/:channelId/invites - Send email invitations
 *
 * @module app/api/channels/[channelId]/invites/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { NotificationService } from '@/lib/services/notification-service';
import {
  channelIdParamSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Request body for email invites
 */
interface InviteEmailBody {
  emails: string[];
  role?: 'ADMIN' | 'MEMBER';
}

/**
 * Helper to check channel access and permissions
 */
async function checkChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel) {
    return null;
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: channel.workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  return {
    channel,
    orgMembership,
    channelMembership,
  };
}

/**
 * POST /api/channels/:channelId/invites
 *
 * Send email invitations to join the channel. Requires channel ADMIN role.
 * Creates pending invitations and sends notification emails.
 *
 * @param request - Next.js request with email list and role
 * @param context - Route context containing channel ID
 * @returns Success response with invitation details
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid channel ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access and permission
    const access = await checkChannelAccess(params.channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(access.orgMembership.role);
    const isChannelAdmin = access.channelMembership?.role === 'ADMIN';

    if (!isOrgAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions. Channel Admin required.',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Parse request body
    let body: InviteEmailBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate emails
    if (
      !body.emails ||
      !Array.isArray(body.emails) ||
      body.emails.length === 0
    ) {
      return NextResponse.json(
        createErrorResponse(
          'At least one email is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = body.emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid email format: ${invalidEmails.join(', ')}`,
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const role = body.role || 'MEMBER';

    // Check if any emails already belong to workspace members
    const existingUsers = await prisma.user.findMany({
      where: {
        email: { in: body.emails },
      },
      include: {
        workspaceMembers: {
          where: {
            workspaceId: access.channel.workspaceId,
          },
        },
        channelMembers: {
          where: {
            channelId: params.channelId,
          },
        },
      },
    });

    const existingMemberEmails = existingUsers
      .filter(u => u.channelMembers.length > 0)
      .map(u => u.email);

    const workspaceMemberEmails = existingUsers
      .filter(
        u => u.workspaceMembers.length > 0 && u.channelMembers.length === 0,
      )
      .map(u => u.email);

    // Filter emails that are completely new (not workspace members)
    const newEmails = body.emails.filter(
      email =>
        !existingMemberEmails.includes(email) &&
        !workspaceMemberEmails.includes(email),
    );

    // Get current user info for notification
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, displayName: true, email: true },
    });
    const inviterName =
      currentUser?.displayName || currentUser?.name || 'Someone';

    const results = {
      invited: [] as string[],
      alreadyMembers: existingMemberEmails,
      workspaceMembers: workspaceMemberEmails,
      failed: [] as string[],
    };

    // For workspace members who aren't in the channel, add them directly
    if (workspaceMemberEmails.length > 0) {
      const workspaceUsers = existingUsers.filter(
        u => u.workspaceMembers.length > 0 && u.channelMembers.length === 0,
      );

      await prisma.channelMember.createMany({
        data: workspaceUsers.map(user => ({
          channelId: params.channelId,
          userId: user.id,
          role,
        })),
      });

      // Send notifications to workspace members
      for (const user of workspaceUsers) {
        NotificationService.notifyChannelInvite({
          userId: user.id,
          channelId: params.channelId,
          inviterId: session.user.id,
        }).catch((err: unknown) => {
          console.error(
            '[POST /api/channels/:channelId/invites] Failed to send notification:',
            err,
          );
        });
      }

      results.invited.push(...workspaceMemberEmails);
    }

    // For completely new emails, create channel invitations
    if (newEmails.length > 0) {
      // TODO: Implement email invitation system
      // This would typically involve:
      // 1. Creating invitation records in the database
      // 2. Generating invitation tokens
      // 3. Sending invitation emails via email service
      // 4. Creating a public invitation acceptance page

      // For now, we'll just log that this feature is pending
      console.log(
        '[POST /api/channels/:channelId/invites] Email invitations not yet implemented for:',
        newEmails,
      );

      // Return them as failed for now
      results.failed.push(
        ...newEmails.map(email => `${email} (email invitations coming soon)`),
      );
    }

    return NextResponse.json(
      {
        data: results,
        message: `Invited ${results.invited.length} user(s) successfully`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/invites] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
