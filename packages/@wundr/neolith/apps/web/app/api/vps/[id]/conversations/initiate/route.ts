/**
 * VP Conversation Initiation API Route
 *
 * Allows Virtual Persons (VPs) to initiate conversations by sending messages to channels or users.
 *
 * Routes:
 * - POST /api/vps/:id/conversations/initiate - Initiate a conversation
 *
 * @module app/api/vps/[id]/conversations/initiate/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  initiateConversationSchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { InitiateConversationInput } from '@/lib/validations/vp';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/conversations/initiate
 *
 * Initiate a conversation from a VP by sending a message to a channel or user.
 * Requires authentication as the VP or admin/owner in the VP's organization.
 *
 * @param request - Next.js request with conversation data
 * @param context - Route context containing VP ID
 * @returns Created message and channel information
 *
 * @example
 * ```
 * POST /api/vps/vp_123/conversations/initiate
 * Content-Type: application/json
 *
 * {
 *   "targetId": "channel_456",
 *   "targetType": "channel",
 *   "content": "Hello team, I've completed the analysis.",
 *   "parentId": "msg_789"  // optional, for threading
 * }
 * ```
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
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = initiateConversationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: InitiateConversationInput = parseResult.data;

    // Get VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if authenticated user is the VP or has admin/owner role
    const isVPUser = session.user.id === vp.user.id;
    let hasAdminAccess = false;

    if (!isVPUser) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: vp.organizationId,
            userId: session.user.id,
          },
        },
      });

      hasAdminAccess = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    }

    if (!isVPUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to initiate conversation for this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Determine target channel based on targetType
    let channelId: string;

    if (input.targetType === 'channel') {
      // Verify channel exists and VP has access
      const channel = await prisma.channel.findUnique({
        where: { id: input.targetId },
        include: {
          workspace: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (!channel) {
        return NextResponse.json(
          createErrorResponse('Channel not found', VP_ERROR_CODES.CHANNEL_NOT_FOUND),
          { status: 404 },
        );
      }

      // Verify channel belongs to VP's organization
      if (channel.workspace.organizationId !== vp.organizationId) {
        return NextResponse.json(
          createErrorResponse('Channel not accessible', VP_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }

      channelId = channel.id;
    } else {
      // targetType === 'user' - create or find DM channel
      const targetUser = await prisma.user.findUnique({
        where: { id: input.targetId },
      });

      if (!targetUser) {
        return NextResponse.json(
          createErrorResponse('Target user not found', VP_ERROR_CODES.USER_NOT_FOUND),
          { status: 404 },
        );
      }

      // Find existing DM channel between VP and target user, or create one
      // For simplicity, we'll find the first workspace in the organization
      const workspace = await prisma.workspace.findFirst({
        where: { organizationId: vp.organizationId },
      });

      if (!workspace) {
        return NextResponse.json(
          createErrorResponse(
            'No workspace found for organization',
            VP_ERROR_CODES.INTERNAL_ERROR,
          ),
          { status: 500 },
        );
      }

      // Find or create DM channel
      const dmChannels = await prisma.channel.findMany({
        where: {
          workspaceId: workspace.id,
          type: 'DM',
          channelMembers: {
            every: {
              userId: {
                in: [vp.user.id, targetUser.id],
              },
            },
          },
        },
        include: {
          channelMembers: true,
        },
      });

      // Find DM channel with exactly these two users
      let dmChannel = dmChannels.find(
        (ch) =>
          ch.channelMembers.length === 2 &&
          ch.channelMembers.some((m) => m.userId === vp.user.id) &&
          ch.channelMembers.some((m) => m.userId === targetUser.id),
      );

      if (!dmChannel) {
        // Create new DM channel
        dmChannel = await prisma.channel.create({
          data: {
            name: `DM: ${vp.user.name} & ${targetUser.name}`,
            slug: `dm-${vp.user.id}-${targetUser.id}-${Date.now()}`,
            type: 'DM',
            workspaceId: workspace.id,
            createdById: vp.user.id,
            channelMembers: {
              create: [
                { userId: vp.user.id, role: 'MEMBER' },
                { userId: targetUser.id, role: 'MEMBER' },
              ],
            },
          },
          include: {
            channelMembers: true,
          },
        });
      }

      if (!dmChannel) {
        return NextResponse.json(
          createErrorResponse(
            'Failed to create DM channel',
            VP_ERROR_CODES.INTERNAL_ERROR,
          ),
          { status: 500 },
        );
      }

      channelId = dmChannel.id;
    }

    // Verify parent message if provided
    if (input.parentId) {
      const parentMessage = await prisma.message.findUnique({
        where: { id: input.parentId },
      });

      if (!parentMessage || parentMessage.channelId !== channelId) {
        return NextResponse.json(
          createErrorResponse('Invalid parent message', VP_ERROR_CODES.VALIDATION_ERROR),
          { status: 400 },
        );
      }
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: input.content,
        type: 'TEXT',
        channelId,
        authorId: vp.user.id,
        parentId: input.parentId,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
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

    return NextResponse.json({
      data: {
        message,
        conversationId: channelId,
      },
      message: 'Conversation initiated successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/conversations/initiate] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
