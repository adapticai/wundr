/**
 * Message Search API Routes
 *
 * Handles full-text search for messages within a workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/messages/search - Search messages
 *
 * @module app/api/workspaces/[workspaceId]/messages/search/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  messageSearchSchema,
  workspaceIdParamSchema,
  createErrorResponse,
  MESSAGE_ERROR_CODES,
} from '@/lib/validations/message';

import type { MessageSearchInput } from '@/lib/validations/message';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Helper function to check workspace membership
 */
async function checkWorkspaceMembership(workspaceId: string, userId: string) {
  const membership = await prisma.workspace_members.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
  });

  return membership;
}

/**
 * GET /api/workspaces/:workspaceId/messages/search
 *
 * Search messages within a workspace with full-text search and filters.
 * Requires authentication and workspace membership.
 * Only searches in channels the user has access to.
 *
 * @param request - Next.js request with search query parameters
 * @param context - Route context containing workspace ID
 * @returns Search results with pagination
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/messages/search?q=hello&channelId=ch_456&limit=20&offset=0
 * ```
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
        createErrorResponse('Authentication required', MESSAGE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate workspace ID parameter
    const params = await context.params;
    const paramResult = workspaceIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid workspace ID format', MESSAGE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = messageSearchSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          MESSAGE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: MessageSearchInput = parseResult.data;

    // Check workspace membership
    const membership = await checkWorkspaceMembership(params.workspaceId, session.user.id);
    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          MESSAGE_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Get channels the user has access to in this workspace
    const userChannels = await prisma.channelMember.findMany({
      where: {
        userId: session.user.id,
        channel: {
          workspaceId: params.workspaceId,
        },
      },
      select: { channelId: true },
    });

    const accessibleChannelIds = userChannels.map((c) => c.channelId);

    if (accessibleChannelIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: false,
        },
      });
    }

    // If specific channel filter provided, verify user has access
    if (filters.channelId && !accessibleChannelIds.includes(filters.channelId)) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found or access denied',
          MESSAGE_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Build where clause for search
    const where: Prisma.MessageWhereInput = {
      channelId: filters.channelId
        ? filters.channelId
        : { in: accessibleChannelIds },
      isDeleted: false,
      // Full-text search on content
      content: {
        contains: filters.q,
        mode: 'insensitive',
      },
      // Optional filters
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.from && { createdAt: { gte: filters.from } }),
      ...(filters.to && { createdAt: { lte: filters.to } }),
    };

    // Handle date range filter
    if (filters.from && filters.to) {
      where.createdAt = {
        gte: filters.from,
        lte: filters.to,
      };
    }

    // Fetch messages and total count in parallel
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where,
        skip: filters.offset,
        take: filters.limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
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
          reactions: {
            select: {
              id: true,
              emoji: true,
              userId: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    // Highlight search terms in content
    const highlightedMessages = messages.map((message) => {
      const regex = new RegExp(`(${escapeRegExp(filters.q)})`, 'gi');
      const highlightedContent = message.content.replace(
        regex,
        '<mark>$1</mark>',
      );
      return {
        ...message,
        highlightedContent,
      };
    });

    const hasMore = filters.offset + messages.length < totalCount;

    return NextResponse.json({
      data: highlightedMessages,
      query: filters.q,
      pagination: {
        total: totalCount,
        limit: filters.limit,
        offset: filters.offset,
        hasMore,
      },
    });
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/messages/search] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        MESSAGE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * Helper function to escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
