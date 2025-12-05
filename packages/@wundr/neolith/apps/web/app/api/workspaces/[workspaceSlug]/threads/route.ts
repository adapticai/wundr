/**
 * Dashboard Threads API Route
 *
 * Handles fetching threads for the dashboard threads widget.
 * A thread is a message that has replies (parent message with child messages).
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/threads - Get threads where user is a participant
 *
 * @module app/api/workspaces/[workspaceSlug]/threads/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Helper to check workspace access via organization membership
 */
async function checkWorkspaceAccess(workspaceSlug: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
    },
    include: {
      organization: true,
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

  return {
    workspace,
    orgMembership,
    workspaceMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceSlug/threads
 *
 * Get threads where user is a participant.
 * Returns threads (parent messages with replies) sorted by most recent activity.
 *
 * Query Parameters:
 * - limit: Number of threads to return (default: 10, max: 50)
 *
 * @param request - Next.js request object
 * @param context - Route context containing workspace slug
 * @returns Threads list with unread counts
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
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get workspace slug parameter
    const { workspaceSlug } = await context.params;

    // Check access
    const access = await checkWorkspaceAccess(workspaceSlug, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const workspaceId = access.workspace.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10)),
      50,
    );

    // Get channels where user is a member
    const userChannels = await prisma.channelMember.findMany({
      where: {
        userId: session.user.id,
        leftAt: null,
        channel: {
          workspaceId,
        },
      },
      select: {
        channelId: true,
        lastReadAt: true,
      },
    });

    const channelIds = userChannels.map(m => m.channelId);

    if (channelIds.length === 0) {
      return NextResponse.json({
        threads: [],
        unreadCount: 0,
      });
    }

    // Find threads where user is involved (authored a message or is in a channel with threads)
    // A thread is a parent message that has replies
    const threads = await prisma.message.findMany({
      where: {
        channelId: { in: channelIds },
        isDeleted: false,
        parentId: null, // Only parent messages
        replies: {
          some: {
            isDeleted: false,
          },
        },
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        replies: {
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
                avatarUrl: true,
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
        updatedAt: 'desc', // Most recently updated threads first
      },
      take: limit,
    });

    // Calculate unread counts for each thread
    const channelLastReadMap = new Map(
      userChannels.map(m => [m.channelId, m.lastReadAt]),
    );

    const threadsWithUnread = await Promise.all(
      threads.map(async thread => {
        const lastReadAt = channelLastReadMap.get(thread.channelId);

        // Count unread replies
        const unreadCount = await prisma.message.count({
          where: {
            parentId: thread.id,
            isDeleted: false,
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });

        // Get all unique participants in the thread
        const participantMessages = await prisma.message.findMany({
          where: {
            OR: [{ id: thread.id }, { parentId: thread.id }],
            isDeleted: false,
          },
          distinct: ['authorId'],
          select: {
            author: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          take: 5, // Limit to 5 participants for performance
        });

        const participants = participantMessages.map(m => ({
          id: m.author.id,
          name: m.author.name || 'Unknown',
          avatar: m.author.avatarUrl || undefined,
        }));

        // Determine if it's a DM
        const isDm = thread.channel.type === 'DM';

        // For DMs, get the other user's name
        let otherUserName: string | undefined;
        if (isDm) {
          const otherParticipant = participants.find(
            p => p.id !== session.user.id,
          );
          otherUserName = otherParticipant?.name;
        }

        // Get the last reply timestamp
        const lastReply = thread.replies[0];
        const lastReplyAt = lastReply?.createdAt || thread.createdAt;

        // Create preview from the parent message content
        const preview = thread.content.substring(0, 100);

        return {
          id: thread.id,
          channelId: thread.channelId,
          channelName: thread.channel.name,
          isDm,
          otherUserName,
          preview,
          timestamp: lastReplyAt.toISOString(),
          isUnread: unreadCount > 0,
        };
      }),
    );

    // Calculate total unread count across all threads
    const totalUnreadCount = threadsWithUnread.filter(t => t.isUnread).length;

    return NextResponse.json({
      threads: threadsWithUnread,
      unreadCount: totalUnreadCount,
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceSlug/threads] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
