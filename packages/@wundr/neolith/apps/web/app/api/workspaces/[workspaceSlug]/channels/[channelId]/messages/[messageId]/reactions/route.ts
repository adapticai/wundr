/**
 * Message Reactions API Routes
 *
 * Manages emoji reactions on messages within workspace channels.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *   - Get all reactions for a message
 * - POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *   - Add a reaction to a message
 * - DELETE /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *   - Remove a reaction from a message
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/messages/[messageId]/reactions/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse } from '@/lib/validations/message';
import {
  addReactionSchema,
  reactionListSchema,
  REACTION_ERROR_CODES,
} from '@/lib/validations/reactions';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace, channel, and message ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    channelId: string;
    messageId: string;
  }>;
}

/**
 * Helper to check workspace and channel access
 */
async function checkAccess(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
) {
  // Get workspace with organization
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      organization: true,
    },
  });

  if (!workspace) {
    return null;
  }

  // Check organization membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  // Get channel and ensure it belongs to the workspace
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel || channel.workspaceId !== workspaceId) {
    return null;
  }

  // Check channel membership
  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  if (!channelMembership) {
    return null;
  }

  // Get message and ensure it belongs to the channel
  const message = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.channelId !== channelId || message.isDeleted) {
    return null;
  }

  return {
    workspace,
    channel,
    message,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *
 * Get all reactions for a message. Requires channel membership.
 *
 * @param request - Next.js request object with query params
 * @param context - Route context containing workspace, channel, and message IDs
 * @returns List of reactions, optionally grouped by emoji
 */
export async function GET(
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
          REACTION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get and validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const { searchParams } = new URL(request.url);
    const queryResult = reactionListSchema.safeParse({
      grouped: searchParams.get('grouped'),
      includeUsers: searchParams.get('includeUsers'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          REACTION_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { grouped, includeUsers } = queryResult.data;

    // Check access
    const access = await checkAccess(
      workspaceId,
      params.channelId,
      params.messageId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          REACTION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Fetch reactions
    const reactions = await prisma.reaction.findMany({
      where: {
        messageId: params.messageId,
      },
      include: includeUsers
        ? {
            user: {
              select: {
                id: true,
                name: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            },
          }
        : undefined,
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group reactions by emoji if requested
    if (grouped) {
      const groupedReactions = reactions.reduce(
        (acc, reaction) => {
          if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = {
              emoji: reaction.emoji,
              count: 0,
              users: [],
              hasReacted: false,
            };
          }

          acc[reaction.emoji].count++;
          if (includeUsers && 'user' in reaction && reaction.user) {
            acc[reaction.emoji].users.push(reaction.user);
          }
          if (reaction.userId === session.user.id) {
            acc[reaction.emoji].hasReacted = true;
          }

          return acc;
        },
        {} as Record<
          string,
          {
            emoji: string;
            count: number;
            users: unknown[];
            hasReacted: boolean;
          }
        >,
      );

      return NextResponse.json({
        data: Object.values(groupedReactions),
        grouped: true,
      });
    }

    // Return ungrouped reactions
    return NextResponse.json({
      data: reactions,
      grouped: false,
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        REACTION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *
 * Add a reaction to a message. Requires channel membership.
 *
 * @param request - Next.js request with reaction data
 * @param context - Route context containing workspace, channel, and message IDs
 * @returns Created reaction
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
          REACTION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;

    // Check access
    const access = await checkAccess(
      workspaceId,
      params.channelId,
      params.messageId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          REACTION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
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
          REACTION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = addReactionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          REACTION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { emoji } = parseResult.data;

    // Check if reaction already exists (user can only have one of each emoji)
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: params.messageId,
          userId: session.user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      return NextResponse.json(
        createErrorResponse(
          'You have already reacted with this emoji',
          REACTION_ERROR_CODES.ALREADY_REACTED,
        ),
        { status: 409 },
      );
    }

    // Create reaction
    const reaction = await prisma.reaction.create({
      data: {
        emoji,
        messageId: params.messageId,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: reaction,
        message: 'Reaction added successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        REACTION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions
 *
 * Remove a reaction from a message. Requires channel membership.
 * User can only remove their own reactions.
 *
 * @param request - Next.js request with emoji query param
 * @param context - Route context containing workspace, channel, and message IDs
 * @returns Success message
 */
export async function DELETE(
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
          REACTION_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const { searchParams } = new URL(request.url);
    const emoji = searchParams.get('emoji');

    if (!emoji) {
      return NextResponse.json(
        createErrorResponse(
          'Emoji parameter is required',
          REACTION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Check access
    const access = await checkAccess(
      workspaceId,
      params.channelId,
      params.messageId,
      session.user.id,
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          REACTION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Delete reaction (only the user's own reaction)
    const deleted = await prisma.reaction.deleteMany({
      where: {
        messageId: params.messageId,
        userId: session.user.id,
        emoji,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Reaction not found',
          REACTION_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: 'Reaction removed successfully',
    });
  } catch (error) {
    console.error(
      '[DELETE /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions] Error:',
      error,
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        REACTION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
