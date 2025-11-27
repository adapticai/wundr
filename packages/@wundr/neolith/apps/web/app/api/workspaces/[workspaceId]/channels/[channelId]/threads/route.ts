/**
 * Channel Threads API Routes
 *
 * Lists all active threads in a channel with metadata.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId/threads
 *   - List all threads in channel with reply counts and last activity
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/threads/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { listThreadsSchema, THREAD_ERROR_CODES } from '@/lib/validations/threads';
import { createErrorResponse } from '@/lib/validations/message';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace and channel ID parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceId: string;
    channelId: string;
  }>;
}

/**
 * Helper to check workspace and channel access
 */
async function checkAccess(workspaceId: string, channelId: string, userId: string) {
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

  return {
    workspace,
    channel,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/threads
 *
 * Get all threads in a channel. Threads are parent messages that have at least one reply.
 * Returns threads ordered by last activity (most recent reply).
 *
 * @param request - Next.js request object with query params
 * @param context - Route context containing workspace and channel IDs
 * @returns List of threads with metadata
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
        createErrorResponse('Authentication required', THREAD_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Get and validate parameters
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const queryResult = listThreadsSchema.safeParse({
      limit: searchParams.get('limit'),
      cursor: searchParams.get('cursor'),
      activeOnly: searchParams.get('activeOnly'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          THREAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { limit, cursor } = queryResult.data;

    // Check access
    const access = await checkAccess(params.workspaceId, params.channelId, session.user.id);

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          THREAD_ERROR_CODES.FORBIDDEN,
        ),
        { status: 404 },
      );
    }

    // Build cursor condition
    let cursorCondition = {};
    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({
        where: { id: cursor },
        select: {
          id: true,
          replies: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      if (cursorMessage && cursorMessage.replies.length > 0) {
        cursorCondition = {
          replies: {
            some: {
              createdAt: {
                lt: cursorMessage.replies[0].createdAt,
              },
            },
          },
        };
      }
    }

    // Fetch parent messages that have replies (threads)
    const threads = await prisma.message.findMany({
      where: {
        channelId: params.channelId,
        isDeleted: false,
        parentId: null, // Only parent messages
        replies: {
          some: {
            isDeleted: false,
          },
        },
        ...cursorCondition,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            status: true,
            isOrchestrator: true,
          },
        },
        reactions: {
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
        },
        messageAttachments: {
          include: {
            file: true,
          },
        },
        replies: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 3, // Get last 3 replies as preview
          include: {
            author: {
              select: {
                id: true,
                name: true,
                displayName: true,
                avatarUrl: true,
                isOrchestrator: true,
              },
            },
          },
        },
        _count: {
          select: {
            replies: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
      orderBy: {
        // Order by most recent reply
        replies: {
          _count: 'desc',
        },
      },
      take: limit + 1, // Fetch one extra to determine if there are more
    });

    // For each thread, get the last reply timestamp
    const threadsWithLastReply = await Promise.all(
      threads.map(async (thread) => {
        const lastReply = await prisma.message.findFirst({
          where: {
            parentId: thread.id,
            isDeleted: false,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

        return {
          ...thread,
          lastReplyAt: lastReply?.createdAt || thread.createdAt,
        };
      }),
    );

    // Sort by last reply timestamp
    threadsWithLastReply.sort((a, b) =>
      new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime()
    );

    // Check if there are more threads
    const hasMore = threadsWithLastReply.length > limit;
    const data = hasMore ? threadsWithLastReply.slice(0, limit) : threadsWithLastReply;

    // Get total thread count
    const totalCount = await prisma.message.count({
      where: {
        channelId: params.channelId,
        isDeleted: false,
        parentId: null,
        replies: {
          some: {
            isDeleted: false,
          },
        },
      },
    });

    return NextResponse.json({
      data,
      pagination: {
        hasMore,
        nextCursor: hasMore ? data[data.length - 1]?.id : null,
        totalCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/channels/:channelId/threads] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', THREAD_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
