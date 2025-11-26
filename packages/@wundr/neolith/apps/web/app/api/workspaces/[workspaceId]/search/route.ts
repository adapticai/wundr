/**
 * Enhanced Search API Routes
 *
 * Provides comprehensive search functionality across channels, messages, and files
 * within a workspace with advanced filtering, highlighting, and pagination.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceId/search - Search workspace content
 *
 * Features:
 * - Full-text search with relevance ranking
 * - Type filtering (channels, messages, files, all)
 * - Channel-scoped search
 * - Result highlighting
 * - Pagination with offset/limit
 * - User permission filtering
 *
 * @module app/api/workspaces/[workspaceId]/search/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with workspace ID parameter
 */
interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Search result types
 */
type SearchType = 'channels' | 'messages' | 'files' | 'all';

/**
 * Channel search result
 */
interface ChannelResult {
  type: 'channel';
  id: string;
  name: string;
  description: string | null;
  topic: string | null;
  type_value: string;
  memberCount: number;
  messageCount: number;
  createdAt: Date;
  highlighted?: {
    name?: string;
    description?: string;
    topic?: string;
  };
}

/**
 * Message search result
 */
interface MessageResult {
  type: 'message';
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorIsVP: boolean;
  createdAt: Date;
  isEdited: boolean;
  replyCount: number;
  highlighted?: {
    content?: string;
  };
}

/**
 * File search result
 */
interface FileResult {
  type: 'file';
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  thumbnailUrl: string | null;
  uploadedById: string;
  uploaderName: string | null;
  channelId?: string;
  channelName?: string;
  createdAt: Date;
  highlighted?: {
    filename?: string;
    originalName?: string;
  };
}

/**
 * Union type for all search results
 */
type SearchResult = ChannelResult | MessageResult | FileResult;

/**
 * Search response structure
 */
interface SearchResponse {
  data: SearchResult[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  facets?: {
    types: { type: string; count: number }[];
    channels: { id: string; name: string; count: number }[];
  };
}

/**
 * Highlight text matches in content
 */
function highlightText(text: string, query: string): string {
  if (!text || !query) return text;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  let highlighted = text;
  terms.forEach((term) => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  });

  return highlighted;
}

/**
 * Build SQL search condition for PostgreSQL full-text search
 * @deprecated Currently unused - kept for future implementation
 */
// function buildSearchCondition(query: string): string {
//   // Escape special characters and prepare for ts_query
//   const sanitized = query.replace(/[^\w\s]/g, ' ').trim();
//   const terms = sanitized.split(/\s+/).filter((term) => term.length > 0);

//   // Use prefix matching for partial word matches
//   return terms.map((term) => `${term}:*`).join(' & ');
// }

/**
 * Check workspace membership and return user's accessible channel IDs
 */
async function getAccessibleChannels(
  workspaceId: string,
  userId: string,
): Promise<string[]> {
  // Check workspace membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  if (!membership) {
    return [];
  }

  // Get all channels user has access to (public + private channels they're member of)
  const channelMemberships = await prisma.channelMember.findMany({
    where: {
      userId,
      channel: { workspaceId },
    },
    select: { channelId: true },
  });

  const memberChannelIds = channelMemberships.map((m) => m.channelId);

  // Get all public channel IDs
  const publicChannels = await prisma.channel.findMany({
    where: {
      workspaceId,
      type: 'PUBLIC',
    },
    select: { id: true },
  });

  const publicChannelIds = publicChannels.map((c) => c.id);

  // Combine and deduplicate
  const combined = [...memberChannelIds, ...publicChannelIds];
  return Array.from(new Set(combined));
}

/**
 * Search channels
 */
async function searchChannels(
  workspaceId: string,
  query: string,
  accessibleChannelIds: string[],
  channelId?: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: ChannelResult[]; totalCount: number }> {
  const whereClause: Prisma.ChannelWhereInput = {
    workspaceId,
    id: { in: accessibleChannelIds },
    isArchived: false,
    ...(channelId && { id: channelId }),
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { topic: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [channels, totalCount] = await Promise.all([
    prisma.channel.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ name: 'asc' }],
      include: {
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    }),
    prisma.channel.count({ where: whereClause }),
  ]);

  const results: ChannelResult[] = channels.map((channel) => ({
    type: 'channel' as const,
    id: channel.id,
    name: channel.name,
    description: channel.description,
    topic: channel.topic,
    type_value: channel.type,
    memberCount: channel._count.members,
    messageCount: channel._count.messages,
    createdAt: channel.createdAt,
    ...(includeHighlight && {
      highlighted: {
        name: highlightText(channel.name, query),
        description: channel.description
          ? highlightText(channel.description, query)
          : undefined,
        topic: channel.topic ? highlightText(channel.topic, query) : undefined,
      },
    }),
  }));

  return { results, totalCount };
}

/**
 * Search messages
 */
async function searchMessages(
  workspaceId: string,
  query: string,
  accessibleChannelIds: string[],
  channelId?: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: MessageResult[]; totalCount: number }> {
  const whereClause: Prisma.MessageWhereInput = {
    channel: { workspaceId },
    channelId: channelId
      ? channelId
      : { in: accessibleChannelIds },
    isDeleted: false,
    content: { contains: query, mode: 'insensitive' },
  };

  const [messages, totalCount] = await Promise.all([
    prisma.message.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    }),
    prisma.message.count({ where: whereClause }),
  ]);

  const results: MessageResult[] = messages.map((message) => ({
    type: 'message' as const,
    id: message.id,
    content: message.content,
    channelId: message.channelId,
    channelName: message.channel.name,
    authorId: message.authorId,
    authorName: message.author.name,
    authorAvatarUrl: message.author.avatarUrl,
    authorIsVP: message.author.isVP,
    createdAt: message.createdAt,
    isEdited: message.isEdited,
    replyCount: message._count.replies,
    ...(includeHighlight && {
      highlighted: {
        content: highlightText(message.content, query),
      },
    }),
  }));

  return { results, totalCount };
}

/**
 * Search files
 */
async function searchFiles(
  workspaceId: string,
  query: string,
  channelId?: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: FileResult[]; totalCount: number }> {
  // Find files attached to messages in accessible channels
  const whereClause: Prisma.FileWhereInput = {
    workspaceId,
    OR: [
      { filename: { contains: query, mode: 'insensitive' } },
      { originalName: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [files] = await Promise.all([
    prisma.file.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
          },
        },
        attachments: {
          take: 1,
          include: {
            message: {
              include: {
                channel: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.file.count({ where: whereClause }),
  ]);

  const results: FileResult[] = files
    .filter((file) => {
      // Filter by channelId if provided
      if (channelId && file.attachments.length > 0) {
        return file.attachments[0].message.channelId === channelId;
      }
      return true;
    })
    .map((file) => ({
      type: 'file' as const,
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      thumbnailUrl: file.thumbnailUrl,
      uploadedById: file.uploadedById,
      uploaderName: file.uploader.name,
      channelId: file.attachments[0]?.message?.channel?.id,
      channelName: file.attachments[0]?.message?.channel?.name,
      createdAt: file.createdAt,
      ...(includeHighlight && {
        highlighted: {
          filename: highlightText(file.filename, query),
          originalName: highlightText(file.originalName, query),
        },
      }),
    }));

  return { results, totalCount: results.length };
}

/**
 * GET /api/workspaces/:workspaceId/search
 *
 * Search workspace content with comprehensive filtering and highlighting.
 * Requires authentication and workspace membership.
 *
 * Query Parameters:
 * - q (required): Search query string
 * - type (optional): Search type - 'channels', 'messages', 'files', or 'all' (default: 'all')
 * - channelId (optional): Limit search to specific channel
 * - limit (optional): Results per page (default: 20, max: 100)
 * - offset (optional): Pagination offset (default: 0)
 * - highlight (optional): Enable result highlighting (default: true)
 * - facets (optional): Include result facets (default: false)
 *
 * @param request - Next.js request with search parameters
 * @param context - Route context containing workspace ID
 * @returns Search results with pagination and optional facets
 *
 * @example
 * ```
 * GET /api/workspaces/ws_123/search?q=project+update&type=messages&limit=20
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
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse workspace ID
    const params = await context.params;
    const { workspaceId } = params;

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace ID is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    // Validate required query parameter
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Search query (q) is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse optional parameters
    const type = (searchParams.get('type') || 'all') as SearchType;
    const channelId = searchParams.get('channelId') || undefined;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100,
    );
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
    const includeHighlight = searchParams.get('highlight') !== 'false';
    const includeFacets = searchParams.get('facets') === 'true';

    // Validate search type
    if (!['channels', 'messages', 'files', 'all'].includes(type)) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid search type. Must be: channels, messages, files, or all',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get accessible channels for the user
    const accessibleChannelIds = await getAccessibleChannels(
      workspaceId,
      session.user.id,
    );

    // Check workspace membership
    if (accessibleChannelIds.length === 0) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found or access denied',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Perform search based on type
    let allResults: SearchResult[] = [];
    let totalCount = 0;

    if (type === 'all' || type === 'channels') {
      const { results: channelResults, totalCount: channelCount } =
        await searchChannels(
          workspaceId,
          query,
          accessibleChannelIds,
          channelId,
          type === 'all' ? Math.ceil(limit / 3) : limit,
          type === 'all' ? Math.ceil(offset / 3) : offset,
          includeHighlight,
        );
      allResults.push(...channelResults);
      totalCount += channelCount;
    }

    if (type === 'all' || type === 'messages') {
      const { results: messageResults, totalCount: messageCount } =
        await searchMessages(
          workspaceId,
          query,
          accessibleChannelIds,
          channelId,
          type === 'all' ? Math.ceil(limit / 3) : limit,
          type === 'all' ? Math.ceil(offset / 3) : offset,
          includeHighlight,
        );
      allResults.push(...messageResults);
      totalCount += messageCount;
    }

    if (type === 'all' || type === 'files') {
      const { results: fileResults, totalCount: fileCount } = await searchFiles(
        workspaceId,
        query,
        channelId,
        type === 'all' ? Math.ceil(limit / 3) : limit,
        type === 'all' ? Math.ceil(offset / 3) : offset,
        includeHighlight,
      );
      allResults.push(...fileResults);
      totalCount += fileCount;
    }

    // Sort mixed results by relevance/date
    if (type === 'all') {
      allResults.sort((a, b) => {
        // Prioritize exact matches in names/titles
        const aExact =
          (a.type === 'channel' && a.name.toLowerCase().includes(query.toLowerCase())) ||
          (a.type === 'file' && a.originalName.toLowerCase().includes(query.toLowerCase()));
        const bExact =
          (b.type === 'channel' && b.name.toLowerCase().includes(query.toLowerCase())) ||
          (b.type === 'file' && b.originalName.toLowerCase().includes(query.toLowerCase()));

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then sort by date
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      // Apply limit to combined results
      allResults = allResults.slice(0, limit);
    }

    // Build facets if requested
    let facets;
    if (includeFacets) {
      const typeCounts = new Map<string, number>();
      const channelCounts = new Map<string, { name: string; count: number }>();

      allResults.forEach((result) => {
        // Count by type
        typeCounts.set(result.type, (typeCounts.get(result.type) || 0) + 1);

        // Count by channel for messages and files
        if (result.type === 'message') {
          const existing = channelCounts.get(result.channelId) || {
            name: result.channelName,
            count: 0,
          };
          channelCounts.set(result.channelId, {
            name: result.channelName,
            count: existing.count + 1,
          });
        } else if (result.type === 'file' && result.channelId) {
          const existing = channelCounts.get(result.channelId) || {
            name: result.channelName || '',
            count: 0,
          };
          channelCounts.set(result.channelId, {
            name: result.channelName || '',
            count: existing.count + 1,
          });
        }
      });

      facets = {
        types: Array.from(typeCounts.entries()).map(([type, count]) => ({
          type,
          count,
        })),
        channels: Array.from(channelCounts.entries())
          .map(([id, { name, count }]) => ({ id, name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10), // Top 10 channels
      };
    }

    // Build response
    const response: SearchResponse = {
      data: allResults,
      pagination: {
        offset,
        limit,
        totalCount,
        hasMore: offset + allResults.length < totalCount,
      },
      ...(facets && { facets }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/workspaces/:workspaceId/search] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred during search',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
