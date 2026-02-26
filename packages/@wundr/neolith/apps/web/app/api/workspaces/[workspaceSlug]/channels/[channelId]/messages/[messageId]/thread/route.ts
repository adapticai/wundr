/**
 * Message Thread API Routes
 *
 * Manages threaded replies to messages within workspace channels.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread
 *   - Get all replies in a thread
 * - POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread
 *   - Add a reply to the thread
 *
 * @module app/api/workspaces/[workspaceId]/channels/[channelId]/messages/[messageId]/thread/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { createErrorResponse } from '@/lib/validations/message';
import {
  createThreadReplySchema,
  threadQuerySchema,
  THREAD_ERROR_CODES,
} from '@/lib/validations/threads';

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
  userId: string
) {
  // Get workspace with organization
  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: workspaceId }, { slug: workspaceId }] },
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

  // Get parent message and ensure it belongs to the channel
  const parentMessage = await prisma.message.findUnique({
    where: { id: messageId },
  });

  if (
    !parentMessage ||
    parentMessage.channelId !== channelId ||
    parentMessage.isDeleted
  ) {
    return null;
  }

  return {
    workspace,
    channel,
    parentMessage,
    orgMembership,
    channelMembership,
  };
}

/**
 * GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread
 *
 * Get all replies in a message thread. Requires channel membership.
 *
 * @param request - Next.js request object with query params
 * @param context - Route context containing workspace, channel, and message IDs
 * @returns Thread replies with pagination
 */
export async function GET(
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
          THREAD_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get and validate parameters
    const params = await context.params;
    const { workspaceSlug: workspaceId } = params;
    const { searchParams } = new URL(request.url);
    const queryResult = threadQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      before: searchParams.get('before'),
      after: searchParams.get('after'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          THREAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: queryResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { limit: limitParam, before, after } = queryResult.data;
    const limit = limitParam ?? 50;

    // Check access
    const access = await checkAccess(
      workspaceId,
      params.channelId,
      params.messageId,
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          THREAD_ERROR_CODES.FORBIDDEN
        ),
        { status: 404 }
      );
    }

    // Build where clause for pagination
    const where: {
      parentId: string;
      isDeleted: boolean;
      createdAt?: {
        lt?: Date;
        gt?: Date;
      };
    } = {
      parentId: params.messageId,
      isDeleted: false,
    };

    if (before) {
      const beforeMessage = await prisma.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    } else if (after) {
      const afterMessage = await prisma.message.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      if (afterMessage) {
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    // Fetch thread replies
    const replies = await prisma.message.findMany({
      where,
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
                email: true,
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
        _count: {
          select: {
            replies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit + 1, // Fetch one extra to determine if there are more
    });

    // Check if there are more replies
    const hasMore = replies.length > limit;
    const data = hasMore ? replies.slice(0, limit) : replies;

    // Get total reply count
    const totalCount = await prisma.message.count({
      where: {
        parentId: params.messageId,
        isDeleted: false,
      },
    });

    return NextResponse.json({
      data,
      parentMessage: access.parentMessage,
      pagination: {
        hasMore,
        nextCursor: hasMore ? data[data.length - 1]?.id : null,
        prevCursor: data[0]?.id || null,
        totalCount,
      },
    });
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        THREAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread
 *
 * Add a reply to a message thread. Requires channel membership.
 *
 * @param request - Next.js request with reply data
 * @param context - Route context containing workspace, channel, and message IDs
 * @returns Created reply message
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
          THREAD_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
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
      session.user.id
    );

    if (!access) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied or resources not found',
          THREAD_ERROR_CODES.FORBIDDEN
        ),
        { status: 404 }
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
          THREAD_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = createThreadReplySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          THREAD_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Create reply message
    const reply = await prisma.message.create({
      data: {
        content: input.content,
        type: 'TEXT',
        metadata: input.metadata as Record<string, never>,
        channelId: params.channelId,
        authorId: session.user.id,
        parentId: params.messageId,
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
        reactions: true,
        messageAttachments: {
          include: {
            file: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: reply,
        message: 'Reply added to thread successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '[POST /api/workspaces/:workspaceId/channels/:channelId/messages/:messageId/thread] Error:',
      error
    );
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        THREAD_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
