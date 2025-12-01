/**
 * Channel Invites API Routes
 *
 * Handles channel invite management for admin users.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/channels/:channelId/invites - List invites
 * - POST /api/workspaces/:workspaceSlug/channels/:channelId/invites - Create invite(s)
 *
 * @module app/api/workspaces/[workspaceSlug]/channels/[channelId]/invites/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { sendChannelInvitationEmail, type EmailResponse } from '@/lib/email';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
  type Invite,
  type InviteStatus,
} from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and channel ID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; channelId: string }>;
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Check if user has channel admin access
 */
async function checkChannelAdminAccess(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          organizationId: true,
        },
      },
    },
  });

  if (!channel) {
    return null;
  }

  // Check workspace membership
  const workspaceMembership = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: channel.workspaceId,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  // Check channel membership and admin role
  const channelMembership = await prisma.channelMember.findFirst({
    where: {
      channelId,
      userId,
    },
  });

  // User must be channel admin or workspace admin/owner
  const isWorkspaceAdmin = ['ADMIN', 'OWNER', 'admin', 'owner'].includes(
    workspaceMembership.role
  );
  const isChannelAdmin = channelMembership?.role === 'ADMIN';

  if (!isWorkspaceAdmin && !isChannelAdmin) {
    return null;
  }

  return {
    channel,
    workspace: channel.workspace,
    membership: workspaceMembership,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/channels/:channelId/invites
 *
 * List channel invites. Requires channel admin role.
 *
 * @param request - Next.js request with optional status filter
 * @param context - Route context containing workspace slug and channel ID
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

    const { channelId } = await context.params;

    // Verify admin access
    const access = await checkChannelAdminAccess(channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel not found or admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    // Get invites from channel settings
    const settings = (access.channel.settings as Record<string, unknown>) || {};
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
    if (statusFilter) {
      invites = invites.filter(i => i.status === statusFilter);
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
 * POST /api/workspaces/:workspaceSlug/channels/:channelId/invites
 *
 * Create channel invites. Supports both existing workspace members and email invites.
 * Requires channel admin role.
 *
 * Request Body:
 * {
 *   emails?: string[];      // For email invites
 *   userIds?: string[];     // For existing member invites
 *   role: 'admin' | 'member';
 *   message?: string;
 * }
 *
 * @param request - Next.js request with invite data
 * @param context - Route context containing workspace slug and channel ID
 * @returns Created invites and email send results
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

    const { channelId } = await context.params;

    // Verify admin access
    const access = await checkChannelAdminAccess(channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel not found or admin access required',
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

    const requestBody = body as {
      emails?: string[];
      userIds?: string[];
      role?: 'admin' | 'member' | 'ADMIN' | 'MEMBER';
      message?: string;
    };

    const emails = requestBody.emails || [];
    const userIds = requestBody.userIds || [];
    const role = (requestBody.role?.toUpperCase() || 'MEMBER') as
      | 'ADMIN'
      | 'MEMBER';
    const message = requestBody.message;

    if (emails.length === 0 && userIds.length === 0) {
      return NextResponse.json(
        createAdminErrorResponse(
          'At least one email or userId is required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Handle existing workspace members (userIds)
    const addedMembers: any[] = [];
    if (userIds.length > 0) {
      // Verify all users are workspace members
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: access.workspace.id,
          userId: { in: userIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      const workspaceMemberIds = new Set(workspaceMembers.map(wm => wm.userId));
      const nonWorkspaceMembers = userIds.filter(
        id => !workspaceMemberIds.has(id)
      );

      if (nonWorkspaceMembers.length > 0) {
        return NextResponse.json(
          createAdminErrorResponse(
            `Users must be workspace members: ${nonWorkspaceMembers.join(', ')}`,
            ADMIN_ERROR_CODES.MEMBER_NOT_FOUND
          ),
          { status: 404 }
        );
      }

      // Check for existing channel memberships
      const existingMemberships = await prisma.channelMember.findMany({
        where: {
          channelId,
          userId: { in: userIds },
        },
      });

      const existingMemberIds = new Set(existingMemberships.map(m => m.userId));
      const newUserIds = userIds.filter(id => !existingMemberIds.has(id));

      if (newUserIds.length > 0) {
        // Add members to channel
        await prisma.channelMember.createMany({
          data: newUserIds.map(userId => ({
            channelId,
            userId,
            role,
          })),
        });

        // Fetch added members with details
        const newMembers = await prisma.channelMember.findMany({
          where: {
            channelId,
            userId: { in: newUserIds },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                displayName: true,
              },
            },
          },
        });

        addedMembers.push(...newMembers);
      }
    }

    // Handle email invites
    const emailInvites: Invite[] = [];
    const emailResults: { email: string; success: boolean; error?: string }[] =
      [];

    if (emails.length > 0) {
      // Check if any email is already a workspace member
      const existingMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: access.workspace.id,
          user: {
            email: {
              in: emails,
            },
          },
        },
        include: { user: { select: { email: true } } },
      });

      const existingEmails = new Set(existingMembers.map(m => m.user.email));
      const newEmails = emails.filter(email => !existingEmails.has(email));

      if (newEmails.length === 0 && emails.length > 0) {
        return NextResponse.json(
          createAdminErrorResponse(
            'All emails are already workspace members. Use userIds to add them to the channel.',
            ADMIN_ERROR_CODES.EMAIL_ALREADY_MEMBER
          ),
          { status: 409 }
        );
      }

      // Get current invites
      const settings =
        (access.channel.settings as Record<string, unknown>) || {};
      const currentInvites = (settings.invites as Invite[]) || [];

      // Create new email invites
      for (const email of newEmails) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invite: Invite = {
          id: `invite-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
          email,
          role,
          roleId: null,
          status: 'PENDING' as InviteStatus,
          message: message || null,
          token: generateInviteToken(),
          expiresAt,
          createdAt: new Date(),
          invitedBy: {
            id: access.membership.user.id,
            name:
              access.membership.user.displayName || access.membership.user.name,
            email: access.membership.user.email,
          },
        };

        emailInvites.push(invite);
      }

      // Save email invites to channel settings
      if (emailInvites.length > 0) {
        await prisma.channel.update({
          where: { id: channelId },
          data: {
            settings: {
              ...settings,
              invites: [...currentInvites, ...emailInvites],
            },
          },
        });

        // Send invitation emails
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const inviterName =
          access.membership.user.displayName ||
          access.membership.user.name ||
          'Team member';
        const inviterEmail = access.membership.user.email || '';

        for (const invite of emailInvites) {
          try {
            const invitationUrl = `${baseUrl}/invite/channel/accept?token=${invite.token}`;

            const emailResult: EmailResponse = await sendChannelInvitationEmail(
              {
                email: invite.email,
                inviterName,
                inviterEmail,
                workspaceName: access.workspace.name,
                channelName: access.channel.name,
                channelType: access.channel.type.toLowerCase() as
                  | 'public'
                  | 'private',
                channelDescription: access.channel.description || undefined,
                invitationUrl,
                message: invite.message || undefined,
              }
            );

            emailResults.push({
              email: invite.email,
              success: emailResult.success,
              error: emailResult.error,
            });

            if (!emailResult.success) {
              console.error(
                `[Channel Invites] Failed to send email to ${invite.email}:`,
                emailResult.error
              );
            }
          } catch (error) {
            console.error(
              `[Channel Invites] Exception sending email to ${invite.email}:`,
              error
            );
            emailResults.push({
              email: invite.email,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    }

    // Count results
    const emailSuccessCount = emailResults.filter(r => r.success).length;
    const emailFailedCount = emailResults.filter(r => !r.success).length;

    return NextResponse.json(
      {
        addedMembers: addedMembers.length,
        members: addedMembers,
        emailInvites: emailInvites.length,
        invites: emailInvites,
        emailResults: {
          total: emailResults.length,
          succeeded: emailSuccessCount,
          failed: emailFailedCount,
          details: emailResults,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceSlug/channels/:channelId/invites] Error:',
      error
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to create invites',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
