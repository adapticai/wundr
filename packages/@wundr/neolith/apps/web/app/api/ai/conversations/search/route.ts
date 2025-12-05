/**
 * AI Conversations Search API Route
 *
 * Handles searching conversations and messages.
 *
 * Routes:
 * - GET /api/ai/conversations/search - Search conversations
 *
 * @module app/api/ai/conversations/search/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type {
  AIConversation,
  AIConversationMetadata,
} from '@/types/ai-conversation';
import type { NextRequest } from 'next/server';

/**
 * Transform channel to AI conversation
 */
function transformToAIConversation(
  channel: any,
  userId: string
): AIConversation {
  const settings = (channel.settings as Record<string, unknown>) || {};
  const metadata = (settings.aiMetadata as AIConversationMetadata) || {};

  return {
    id: channel.id,
    title: metadata.title || 'New Conversation',
    workspaceId: channel.workspaceId,
    createdById: channel.createdById || userId,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    metadata,
    isPinned: metadata.isPinned || false,
    isArchived: metadata.isArchived || false,
    hasAccess: true,
  };
}

/**
 * GET /api/ai/conversations/search
 *
 * Search AI conversations and their messages.
 * Supports full-text search across titles, tags, and message content.
 *
 * @param request - Next.js request object with query parameters
 * @returns Search results
 *
 * @example
 * ```
 * GET /api/ai/conversations/search?workspaceId=ws_123&q=typescript&limit=10
 * GET /api/ai/conversations/search?workspaceId=ws_123&q=api&tags=programming,help
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const query = searchParams.get('q') || '';
    const tags = searchParams.get('tags')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    // Validate required fields
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'workspaceId is required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    if (!query && tags.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Search query or tags are required',
          ORG_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Check workspace access
    const workspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!workspaceMembership) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Search in two phases:
    // 1. Search conversation metadata (titles, tags)
    // 2. Search message content

    const skip = (page - 1) * limit;

    // Get all AI conversation channels user has access to
    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        type: 'DM',
        name: { startsWith: 'ai-chat' },
        channelMembers: {
          some: { userId: session.user.id },
        },
        isArchived: false,
      },
      include: {
        messages: {
          where: {
            isDeleted: false,
            ...(query && {
              content: {
                contains: query,
                mode: 'insensitive',
              },
            }),
          },
          take: 3, // Preview of matching messages
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Filter and rank results
    const queryLower = query.toLowerCase();
    const results = channels
      .map(channel => {
        const conversation = transformToAIConversation(
          channel,
          session.user.id
        );

        // Calculate relevance score
        let score = 0;

        // Title match (highest weight)
        if (conversation.title.toLowerCase().includes(queryLower)) {
          score += 10;
        }

        // Tag match
        if (conversation.metadata.tags) {
          const matchingTags = conversation.metadata.tags.filter(
            tag =>
              tag.toLowerCase().includes(queryLower) ||
              tags.includes(tag.toLowerCase())
          );
          score += matchingTags.length * 5;
        }

        // Message content match
        if (channel.messages && channel.messages.length > 0) {
          score += channel.messages.length * 2;
        }

        // Last message preview match
        if (
          conversation.metadata.lastMessagePreview &&
          conversation.metadata.lastMessagePreview
            .toLowerCase()
            .includes(queryLower)
        ) {
          score += 3;
        }

        return {
          conversation,
          score,
          matchingMessages: channel.messages?.length || 0,
        };
      })
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);

    // Apply pagination
    const totalResults = results.length;
    const paginatedResults = results.slice(skip, skip + limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalResults / limit);

    return NextResponse.json({
      data: paginatedResults.map(r => ({
        ...r.conversation,
        searchScore: r.score,
        matchingMessages: r.matchingMessages,
      })),
      pagination: {
        page,
        limit,
        totalCount: totalResults,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      query: {
        text: query,
        tags,
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/conversations/search] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
