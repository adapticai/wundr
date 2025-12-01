/**
 * Conversations API Route
 *
 * Handles creating DM/Group DM conversations with optional initial message.
 *
 * Routes:
 * - POST /api/conversations - Create a new DM or group DM conversation
 *
 * @module app/api/conversations/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

interface CreateConversationInput {
  workspaceSlug: string;
  recipientIds: string[];
  emailInvites?: string[];
  initialMessage?: string;
  mentions?: string[];
}

/**
 * POST /api/conversations
 *
 * Create a new DM or group DM conversation with optional initial message.
 * For single recipient, creates a 1:1 DM. For multiple recipients, creates a group DM.
 *
 * @param request - Next.js request with conversation data
 * @returns Created channel object with conversation ID
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: CreateConversationInput;
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

    const { workspaceSlug, recipientIds, initialMessage } = body;

    // Validate required fields
    if (!workspaceSlug) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace slug is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    if (!recipientIds || recipientIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'At least one recipient is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

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

    // Check if requester is a workspace member
    const requesterMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: session.user.id,
        },
      },
    });

    if (!requesterMembership) {
      return NextResponse.json(
        createErrorResponse(
          'You are not a member of this workspace',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Check if all recipients are workspace members
    const recipientMemberships = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: workspace.id,
        userId: { in: recipientIds },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const foundRecipientIds = new Set(
      recipientMemberships.map(rm => rm.userId)
    );
    const missingRecipients = recipientIds.filter(
      id => !foundRecipientIds.has(id)
    );

    if (missingRecipients.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Some recipients are not workspace members: ${missingRecipients.join(', ')}`,
          ORG_ERROR_CODES.USER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // For 1:1 DM, check if conversation already exists
    if (recipientIds.length === 1) {
      const sortedIds = [session.user.id, recipientIds[0]].sort();
      const dmIdentifier = `dm:${sortedIds[0]}:${sortedIds[1]}`;

      const existingDM = await prisma.channel.findFirst({
        where: {
          workspaceId: workspace.id,
          type: 'DM',
          name: dmIdentifier,
        },
        include: {
          channelMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (existingDM) {
        // If initial message provided, create it
        if (initialMessage) {
          await prisma.message.create({
            data: {
              channelId: existingDM.id,
              authorId: session.user.id,
              content: initialMessage,
              type: 'TEXT',
            },
          });
        }

        return NextResponse.json({
          id: existingDM.id,
          channelId: existingDM.id,
          data: existingDM,
          isNew: false,
        });
      }
    }

    // Create new DM/Group DM channel
    const allParticipantIds = [session.user.id, ...recipientIds];
    const isGroupDM = allParticipantIds.length > 2;

    // Generate channel name
    let channelName: string;
    if (isGroupDM) {
      // For group DMs, use a timestamp-based identifier
      channelName = `group-dm:${Date.now()}`;
    } else {
      // For 1:1 DMs, use sorted user IDs
      const sortedIds = [session.user.id, recipientIds[0]].sort();
      channelName = `dm:${sortedIds[0]}:${sortedIds[1]}`;
    }

    const newChannel = await prisma.$transaction(async tx => {
      // Create the channel
      const channel = await tx.channel.create({
        data: {
          name: channelName,
          slug: channelName.replace(/:/g, '-'),
          type: 'DM',
          workspaceId: workspace.id,
        },
      });

      // Add all participants as members
      await tx.channelMember.createMany({
        data: allParticipantIds.map(userId => ({
          channelId: channel.id,
          userId,
          role: 'MEMBER',
        })),
      });

      // Create initial message if provided
      if (initialMessage) {
        await tx.message.create({
          data: {
            channelId: channel.id,
            authorId: session.user.id,
            content: initialMessage,
            type: 'TEXT',
          },
        });
      }

      // Return channel with members
      return tx.channel.findUnique({
        where: { id: channel.id },
        include: {
          channelMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  avatarUrl: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    return NextResponse.json(
      {
        id: newChannel?.id,
        channelId: newChannel?.id,
        data: newChannel,
        isNew: true,
        message: 'Conversation created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/conversations] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
