/**
 * Workspace Direct Messages API Routes
 *
 * Handles listing and creating DM channels within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/dm - List all DM channels for current user
 * - POST /api/workspaces/:workspaceId/dm - Create or get existing DM channel
 *
 * @module app/api/workspaces/[workspaceId]/dm/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  workspaceIdParamSchema,
  createDMSchema,
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { CreateDMInput } from '@/lib/validations/organization';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access by slug
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  // Support both workspace ID and slug for lookup
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
  });

  if (!workspace) {
    return null;
  }

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

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId,
      },
    },
  });

  if (!workspaceMembership) {
    return null;
  }

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * Calculate unread count for a DM channel
 */
async function getUnreadCount(
  channelId: string,
  userId: string
): Promise<number> {
  try {
    // Get user's last read timestamp for this channel
    const channelMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      select: {
        lastReadAt: true,
      },
    });

    // If no lastReadAt, count all messages
    if (!channelMember?.lastReadAt) {
      return await prisma.message.count({
        where: {
          channelId,
          authorId: { not: userId },
          isDeleted: false,
        },
      });
    }

    // Count messages created after lastReadAt
    return await prisma.message.count({
      where: {
        channelId,
        authorId: { not: userId },
        createdAt: { gt: channelMember.lastReadAt },
        isDeleted: false,
      },
    });
  } catch (error) {
    console.error('[getUnreadCount] Error:', error);
    return 0;
  }
}

/**
 * GET /api/workspaces/:workspaceId/dm
 *
 * List all DM channels for the current user within a workspace.
 * Includes unread counts and last message preview.
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace ID
 * @returns List of DM channels with metadata
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/dm
 * Authorization: Bearer <token>
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Get all DM channels where user is a member
    const dmChannels = await prisma.channel.findMany({
      where: {
        workspaceId: actualWorkspaceId,
        type: 'DM',
        channelMembers: {
          some: {
            userId: session.user.id,
          },
        },
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
                isOrchestrator: true,
              },
            },
          },
        },
        messages: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Format response with unread counts
    const formattedChannels = await Promise.all(
      dmChannels.map(async channel => {
        // Get the other participant (not the current user)
        // For self-DM (notes to self), the participant is the current user
        const otherParticipant =
          channel.channelMembers.find(m => m.userId !== session.user.id) ||
          channel.channelMembers.find(m => m.userId === session.user.id);

        if (!otherParticipant) {
          return null;
        }

        const isSelfDM =
          (channel.channelMembers.length === 2 &&
            channel.channelMembers.every(m => m.userId === session.user.id)) ||
          (channel.channelMembers.length === 1 &&
            channel.channelMembers[0].userId === session.user.id);

        // Check if this is a group DM (3+ total participants)
        const isGroupDM = channel.channelMembers.length >= 3;

        // Get unread count
        const unreadCount = await getUnreadCount(channel.id, session.user.id);

        // Get last message
        const lastMessage = channel.messages[0]
          ? {
              content: channel.messages[0].content,
              createdAt: channel.messages[0].createdAt,
              author: {
                id: channel.messages[0].author.id,
                name:
                  channel.messages[0].author.displayName ||
                  channel.messages[0].author.name ||
                  'Unknown',
                avatarUrl: channel.messages[0].author.avatarUrl,
              },
            }
          : undefined;

        return {
          id: channel.id,
          type: channel.type,
          workspaceId: channel.workspaceId,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
          unreadCount,
          lastMessage,
          isSelfDM,
          isGroupDM,
          participants: channel.channelMembers.map(m => ({
            id: m.user.id,
            name: m.user.displayName || m.user.name || 'Unknown',
            avatarUrl: m.user.avatarUrl,
            status: m.user.status,
            isOrchestrator: m.user.isOrchestrator,
          })),
          participant: {
            id: otherParticipant.user.id,
            name: isSelfDM
              ? (otherParticipant.user.displayName ||
                  otherParticipant.user.name ||
                  'You') + ' (you)'
              : otherParticipant.user.displayName ||
                otherParticipant.user.name ||
                'Unknown',
            avatarUrl: otherParticipant.user.avatarUrl,
            status: otherParticipant.user.status,
            isOrchestrator: otherParticipant.user.isOrchestrator,
          },
        };
      })
    );

    // Filter out any null entries
    const validChannels = formattedChannels.filter(ch => ch !== null);

    return NextResponse.json({
      data: validChannels,
      count: validChannels.length,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/dm] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/dm
 *
 * Create a new DM channel or return existing one between current user and target user.
 * If a DM channel already exists, returns the existing channel instead of creating a new one.
 *
 * @param request - Next.js request with DM data
 * @param context - Route context containing workspace ID
 * @returns DM channel object with metadata
 *
 * @example
 * ```
 * POST /api/workspaces/ws_123/dm
 * Content-Type: application/json
 *
 * {
 *   "userId": "user_456"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate workspace ID parameter
    const { workspaceSlug: workspaceId } = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse({ id: workspaceId });
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid workspace ID format',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check access
    const access = await checkWorkspaceAccess(workspaceId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Use the actual workspace ID from the access check
    const actualWorkspaceId = access.workspace.id;

    // Parse request body
    let body: unknown;
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

    // Validate input - add workspaceId from params
    const inputWithWorkspace = {
      ...(typeof body === 'object' && body !== null ? body : {}),
      workspaceId: actualWorkspaceId,
    };

    const parseResult = createDMSchema.safeParse(inputWithWorkspace);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: CreateDMInput = parseResult.data;

    // Self-DM is allowed (like Slack)
    // This allows users to send notes to themselves

    // Check if target user is a workspace member
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: actualWorkspaceId,
          userId: input.userId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            isOrchestrator: true,
          },
        },
      },
    });

    if (!targetMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Target user is not a member of this workspace',
          ORG_ERROR_CODES.USER_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Generate a consistent DM name for the pair (alphabetically sorted user IDs)
    const sortedIds = [session.user.id, input.userId].sort();
    const dmIdentifier = `dm:${sortedIds[0]}:${sortedIds[1]}`;

    // Check if DM channel already exists
    const existingDM = await prisma.channel.findFirst({
      where: {
        workspaceId: actualWorkspaceId,
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
                isOrchestrator: true,
              },
            },
          },
        },
        messages: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (existingDM) {
      // Get unread count
      const unreadCount = await getUnreadCount(existingDM.id, session.user.id);

      // Get the other participant
      const otherParticipant = existingDM.channelMembers.find(
        m => m.userId !== session.user.id
      );

      // Get last message
      const lastMessage = existingDM.messages[0]
        ? {
            content: existingDM.messages[0].content,
            createdAt: existingDM.messages[0].createdAt,
            author: {
              id: existingDM.messages[0].author.id,
              name:
                existingDM.messages[0].author.displayName ||
                existingDM.messages[0].author.name ||
                'Unknown',
              avatarUrl: existingDM.messages[0].author.avatarUrl,
            },
          }
        : undefined;

      return NextResponse.json({
        data: {
          id: existingDM.id,
          type: existingDM.type,
          workspaceId: existingDM.workspaceId,
          createdAt: existingDM.createdAt,
          updatedAt: existingDM.updatedAt,
          unreadCount,
          lastMessage,
          participant: {
            id: otherParticipant?.user.id,
            name:
              otherParticipant?.user.displayName ||
              otherParticipant?.user.name ||
              'Unknown',
            avatarUrl: otherParticipant?.user.avatarUrl,
            status: otherParticipant?.user.status,
            isOrchestrator: otherParticipant?.user.isOrchestrator,
          },
        },
        isNew: false,
        message: 'Existing DM channel returned',
      });
    }

    // Create new DM channel
    const dmChannel = await prisma.$transaction(async tx => {
      // Create the DM channel
      const newChannel = await tx.channel.create({
        data: {
          name: dmIdentifier,
          slug: dmIdentifier.replace(/:/g, '-'), // Convert dm:id1:id2 to dm-id1-id2
          type: 'DM',
          workspaceId: actualWorkspaceId,
        },
      });

      // Add both users as members
      await tx.channelMember.createMany({
        data: [
          {
            channelId: newChannel.id,
            userId: session.user.id,
            role: 'MEMBER',
          },
          {
            channelId: newChannel.id,
            userId: input.userId,
            role: 'MEMBER',
          },
        ],
      });

      // Return channel with members
      return tx.channel.findUnique({
        where: { id: newChannel.id },
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
                  isOrchestrator: true,
                },
              },
            },
          },
        },
      });
    });

    if (!dmChannel) {
      return NextResponse.json(
        createErrorResponse(
          'Failed to create DM channel',
          ORG_ERROR_CODES.INTERNAL_ERROR
        ),
        { status: 500 }
      );
    }

    // Get the other participant
    const otherParticipant = dmChannel.channelMembers.find(
      m => m.userId !== session.user.id
    );

    return NextResponse.json(
      {
        data: {
          id: dmChannel.id,
          type: dmChannel.type,
          workspaceId: dmChannel.workspaceId,
          createdAt: dmChannel.createdAt,
          updatedAt: dmChannel.updatedAt,
          unreadCount: 0,
          lastMessage: undefined,
          participant: {
            id: otherParticipant?.user.id,
            name:
              otherParticipant?.user.displayName ||
              otherParticipant?.user.name ||
              'Unknown',
            avatarUrl: otherParticipant?.user.avatarUrl,
            status: otherParticipant?.user.status,
            isOrchestrator: otherParticipant?.user.isOrchestrator,
          },
        },
        isNew: true,
        message: 'DM channel created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/workspaces/:workspaceId/dm] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
