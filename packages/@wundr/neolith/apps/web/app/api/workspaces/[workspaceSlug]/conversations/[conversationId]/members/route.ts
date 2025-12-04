/**
 * Conversation Members API Route
 *
 * Handles managing members in DM conversations (both 1:1 and group DMs).
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/conversations/:conversationId/members - List conversation members
 * - POST /api/workspaces/:workspaceSlug/conversations/:conversationId/members - Add members to conversation
 *
 * @module app/api/workspaces/[workspaceSlug]/conversations/[conversationId]/members/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { sendInvitationEmail, type EmailResponse } from '@/lib/email';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug and conversation ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    conversationId: string;
  }>;
}

/**
 * Request body for adding members to a conversation
 */
interface AddMembersInput {
  userIds?: string[];
  emails?: string[];
  message?: string;
}

/**
 * Workspace invite structure (stored in workspace.settings.invites)
 */
interface WorkspaceInvite {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  message: string | null;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
  conversationId?: string; // Add conversation context to invite
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * GET /api/workspaces/:workspaceSlug/conversations/:conversationId/members
 *
 * List all members of a conversation.
 * Requires user to be a member of both the workspace and the conversation.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug and conversation ID
 * @returns List of conversation members
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { workspaceSlug, conversationId } = await context.params;

    // Get workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify user is a workspace member
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get conversation and verify it's a DM
    const conversation = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: {
          where: {
            leftAt: null, // Only include active members
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (conversation.type !== 'DM') {
      return NextResponse.json(
        createErrorResponse(
          'This endpoint is only for DM conversations',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    if (conversation.workspaceId !== workspace.id) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation does not belong to this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify user is a member of the conversation
    const isMember = conversation.channelMembers.some(
      m => m.userId === session.user.id
    );
    if (!isMember) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this conversation',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Format response
    const members = conversation.channelMembers.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      lastReadAt: m.lastReadAt,
      isStarred: m.isStarred,
      notificationPreference: m.notificationPreference,
      user: m.user,
    }));

    return NextResponse.json({
      conversationId: conversation.id,
      members,
      total: members.length,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/[workspaceSlug]/conversations/[conversationId]/members] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'Failed to fetch conversation members',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceSlug/conversations/:conversationId/members
 *
 * Add members to a conversation (converts 1:1 DM to group DM if needed).
 * Supports:
 * - Adding existing workspace members by userId
 * - Inviting new users by email (creates workspace invite + adds to conversation on acceptance)
 *
 * @param request - Next.js request with member data
 * @param context - Route context containing workspace slug and conversation ID
 * @returns Updated conversation with new members
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { workspaceSlug, conversationId } = await context.params;

    // Parse request body
    let body: AddMembersInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { userIds = [], emails = [], message } = body;

    // Validate at least one member is being added
    if (userIds.length === 0 && emails.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one userId or email is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get workspace by slug
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify user is a workspace member and get their details
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get conversation and verify it's a DM
    const conversation = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: {
          where: {
            leftAt: null,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (conversation.type !== 'DM') {
      return NextResponse.json(
        createErrorResponse(
          'This endpoint is only for DM conversations',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    if (conversation.workspaceId !== workspace.id) {
      return NextResponse.json(
        createErrorResponse(
          'Conversation does not belong to this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Verify user is a member of the conversation
    const isMember = conversation.channelMembers.some(
      m => m.userId === session.user.id
    );
    if (!isMember) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this conversation',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Process userIds - verify they're workspace members
    const newMembers: string[] = [];
    if (userIds.length > 0) {
      const validMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          userId: { in: userIds },
        },
      });

      const validUserIds = new Set(validMembers.map(m => m.userId));
      const invalidUserIds = userIds.filter(id => !validUserIds.has(id));

      if (invalidUserIds.length > 0) {
        return NextResponse.json(
          createErrorResponse(
            `Some users are not workspace members: ${invalidUserIds.join(', ')}`,
            ORG_ERROR_CODES.USER_NOT_FOUND
          ),
          { status: 404 }
        );
      }

      // Filter out users who are already members
      const existingMemberIds = new Set(
        conversation.channelMembers.map(m => m.userId)
      );
      const usersToAdd = userIds.filter(id => !existingMemberIds.has(id));
      newMembers.push(...usersToAdd);
    }

    // Process email invites
    const emailInvites: WorkspaceInvite[] = [];
    const emailResults: { email: string; success: boolean; error?: string }[] =
      [];

    if (emails.length > 0) {
      // Check if any email is already a workspace member
      const existingMembers = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspace.id,
          user: {
            email: { in: emails },
          },
        },
        include: {
          user: {
            select: { email: true, id: true },
          },
        },
      });

      const existingEmailSet = new Set(existingMembers.map(m => m.user.email));
      const newEmails = emails.filter(e => !existingEmailSet.has(e));

      // For existing members, add them to the conversation if not already in it
      const existingMemberIds = new Set(
        conversation.channelMembers.map(m => m.userId)
      );
      for (const member of existingMembers) {
        if (!existingMemberIds.has(member.userId)) {
          newMembers.push(member.userId);
        }
      }

      // Create invites for new emails
      if (newEmails.length > 0) {
        const settings = (workspace.settings as Record<string, unknown>) || {};
        const currentInvites = (settings.invites as WorkspaceInvite[]) || [];

        for (const email of newEmails) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

          const invite: WorkspaceInvite = {
            id: `invite-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
            email,
            role: 'MEMBER',
            roleId: null,
            status: 'PENDING',
            message: message || null,
            token: generateInviteToken(),
            expiresAt,
            createdAt: new Date(),
            invitedBy: {
              id: workspaceMembership.user.id,
              name: workspaceMembership.user.name,
              email: workspaceMembership.user.email,
            },
            conversationId: conversation.id, // Link invite to conversation
          };

          emailInvites.push(invite);
        }

        // Save invites to workspace settings
        await prisma.workspace.update({
          where: { id: workspace.id },
          data: {
            settings: {
              ...settings,
              invites: [...currentInvites, ...emailInvites] as any,
            },
          },
        });

        // Send invitation emails
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const workspaceName = workspace.name || 'Neolith Workspace';

        for (const invite of emailInvites) {
          try {
            const invitationUrl = `${baseUrl}/invite/accept?token=${invite.token}`;

            const emailResult: EmailResponse = await sendInvitationEmail({
              email: invite.email,
              inviterName:
                workspaceMembership.user.name ||
                workspaceMembership.user.email ||
                'Team member',
              workspaceName,
              invitationUrl,
              role: invite.role,
              message:
                invite.message || "You've been invited to join a conversation",
            });

            emailResults.push({
              email: invite.email,
              success: emailResult.success,
              error: emailResult.error,
            });

            if (!emailResult.success) {
              console.error(
                `[Conversation Members] Failed to send email to ${invite.email}:`,
                emailResult.error
              );
            }
          } catch (error) {
            console.error(
              `[Conversation Members] Exception sending email to ${invite.email}:`,
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

    // Add new members to conversation
    let addedMembers: any[] = [];
    if (newMembers.length > 0) {
      await prisma.channelMember.createMany({
        data: newMembers.map(userId => ({
          channelId: conversation.id,
          userId,
          role: 'MEMBER',
        })),
        skipDuplicates: true,
      });

      // Fetch the newly added members with user details
      addedMembers = await prisma.channelMember.findMany({
        where: {
          channelId: conversation.id,
          userId: { in: newMembers },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              status: true,
            },
          },
        },
      });
    }

    // Get updated conversation with all members
    const updatedConversation = await prisma.channel.findUnique({
      where: { id: conversationId },
      include: {
        channelMembers: {
          where: {
            leftAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const responseData: any = {
      conversation: updatedConversation,
      addedMembers: addedMembers.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      message: 'Members added successfully',
    };

    // Include email invite results if any were sent
    if (emailResults.length > 0) {
      const successCount = emailResults.filter(r => r.success).length;
      const failedCount = emailResults.filter(r => !r.success).length;

      responseData.emailInvites = {
        total: emailResults.length,
        succeeded: successCount,
        failed: failedCount,
        details: emailResults,
      };
    }

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error(
      '[POST /api/workspaces/[workspaceSlug]/conversations/[conversationId]/members] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'Failed to add members to conversation',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
