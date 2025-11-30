/**
 * OrchestratorInitiate Conversation API Route
 *
 * Allows VPs to initiate conversations with users or post to channels.
 * Handles creating new conversation threads or reusing existing DMs.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/conversations/initiate
 *
 * @module app/api/workspaces/[workspaceId]/orchestrators/[orchestratorId]/conversations/initiate/route
 */

import { prisma } from '@neolith/database';
import { Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  initiateConversationSchema,
  createErrorResponse,
  ORCHESTRATOR_CONVERSATION_ERROR_CODES,
} from '@/lib/validations/orchestrator-conversation';

import type { InitiateConversationInput } from '@/lib/validations/orchestrator-conversation';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and OrchestratorID parameters
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string; orchestratorId: string }>;
}

/**
 * POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/conversations/initiate
 *
 * Orchestrator initiates a conversation with a user or posts to a channel.
 * - For user targets: Creates or reuses existing DM channel
 * - For channel targets: Posts message to specified channel
 * - Validates Orchestrator has permission to contact the target
 *
 * @param request - Next.js request with conversation data
 * @param context - Route context containing workspace and OrchestratorIDs
 * @returns Created message and conversation details
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user (Orchestrator service account)
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get params
    const resolvedParams = await context.params;
    const { workspaceSlug: workspaceId, orchestratorId } = resolvedParams;

    // Validate IDs format
    if (!workspaceId || !orchestratorId) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid parameters',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = initiateConversationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: InitiateConversationInput = parseResult.data;

    // Verify workspace exists and get organization ID
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify Orchestrator exists and belongs to this workspace/organization
    const orchestrator = await prisma.orchestrator.findFirst({
      where: {
        id: orchestratorId,
        organizationId: workspace.organizationId,
        OR: [{ workspaceId }, { workspaceId: null }],
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse(
          'Orchestrator not found or access denied',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.ORCHESTRATOR_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify the authenticated user is the Orchestrator's user account
    if (orchestrator.user.id !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Unauthorized: You can only initiate conversations as your own Orchestrator',
          ORCHESTRATOR_CONVERSATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    let channelId: string;
    let isNewConversation = false;

    if (input.targetType === 'channel') {
      // Verify channel exists and belongs to workspace
      const channel = await prisma.channel.findFirst({
        where: {
          id: input.targetId,
          workspaceId,
        },
      });

      if (!channel) {
        return NextResponse.json(
          createErrorResponse(
            'Channel not found',
            ORCHESTRATOR_CONVERSATION_ERROR_CODES.CHANNEL_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      channelId = channel.id;
    } else {
      // targetType === 'user'
      // Verify target user exists and has access to workspace
      const targetUser = await prisma.user.findUnique({
        where: { id: input.targetId },
      });

      if (!targetUser) {
        return NextResponse.json(
          createErrorResponse(
            'Target user not found',
            ORCHESTRATOR_CONVERSATION_ERROR_CODES.USER_NOT_FOUND,
          ),
          { status: 404 },
        );
      }

      // Generate a consistent DM name for the pair (alphabetically sorted user IDs)
      const sortedIds = [orchestrator.user.id, targetUser.id].sort();
      const dmIdentifier = `dm:${sortedIds[0]}:${sortedIds[1]}`;

      // Check if DM channel already exists between Orchestrator and user
      const existingDM = await prisma.channel.findFirst({
        where: {
          workspaceId,
          type: 'DM',
          name: dmIdentifier,
        },
      });

      if (existingDM) {
        channelId = existingDM.id;
      } else {
        // Create new DM channel
        const newDM = await prisma.$transaction(async (tx) => {
          const channel = await tx.channel.create({
            data: {
              name: dmIdentifier,
              slug: dmIdentifier.replace(/:/g, '-'),
              type: 'DM',
              workspaceId,
            },
          });

          // Add both users as members
          await tx.channelMember.createMany({
            data: [
              {
                channelId: channel.id,
                userId: orchestrator.user.id,
                role: 'MEMBER',
              },
              {
                channelId: channel.id,
                userId: targetUser.id,
                role: 'MEMBER',
              },
            ],
          });

          return channel;
        });

        channelId = newDM.id;
        isNewConversation = true;
      }
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: input.content,
        type: 'TEXT',
        channelId,
        authorId: orchestrator.user.id,
        parentId: input.parentId,
        metadata: (input.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    // If posting to a channel (not DM), create notification for channel members
    if (input.targetType === 'channel') {
      // Get channel members (excluding the Orchestrator)
      const channelMembers = await prisma.channelMember.findMany({
        where: {
          channelId,
          userId: {
            not: orchestrator.user.id,
          },
        },
        select: {
          userId: true,
        },
      });

      // Create notifications for members
      if (channelMembers.length > 0) {
        await prisma.notification.createMany({
          data: channelMembers.map((member) => ({
            userId: member.userId,
            type: 'MESSAGE' as const,
            title: `New message from ${orchestrator.user.name}`,
            body: input.content.substring(0, 200),
            resourceId: message.id,
            resourceType: 'message',
            metadata: {
              channelId,
              channelName: message.channel.name,
              orchestratorId,
            } as unknown as Prisma.InputJsonValue,
          })),
        });
      }
    } else if (isNewConversation) {
      // Create notification for new DM
      await prisma.notification.create({
        data: {
          userId: input.targetId,
          type: 'MESSAGE' as const,
          title: `New message from ${orchestrator.user.name}`,
          body: input.content.substring(0, 200),
          resourceId: message.id,
          resourceType: 'message',
          metadata: {
            channelId,
            isNewConversation: true,
            orchestratorId,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json(
      {
        data: {
          message,
          channelId,
          isNewConversation,
        },
        message: `Conversation ${isNewConversation ? 'initiated' : 'continued'} successfully`,
      },
      { status: isNewConversation ? 201 : 200 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/orchestrators/:orchestratorId/conversations/initiate] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORCHESTRATOR_CONVERSATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
