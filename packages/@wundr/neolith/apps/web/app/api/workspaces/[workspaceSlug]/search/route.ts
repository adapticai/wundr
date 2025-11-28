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
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Search result types
 */
type SearchType = 'channels' | 'messages' | 'files' | 'users' | 'orchestrators' | 'dms' | 'all';

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
  authorIsOrchestrator: boolean;
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
 * User search result
 */
interface UserResult {
  type: 'user';
  id: string;
  name: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  isOrchestrator: boolean;
  highlighted?: {
    name?: string;
    email?: string;
    displayName?: string;
  };
}

/**
 * Orchestrator search result
 */
interface OrchestratorResult {
  type: 'orchestrator';
  id: string;
  name: string | null;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  discipline: string | null;
  role: string | null;
  highlighted?: {
    name?: string;
    displayName?: string;
    discipline?: string;
    role?: string;
  };
}

/**
 * DM conversation search result
 */
interface DMResult {
  type: 'dm';
  id: string;
  name: string;
  participants: Array<{
    id: string;
    name: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  }>;
  lastMessageAt: Date | null;
  highlighted?: {
    name?: string;
  };
}

/**
 * Union type for all search results
 */
type SearchResult = ChannelResult | MessageResult | FileResult | UserResult | OrchestratorResult | DMResult;

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
  if (!text || !query) {
    return text;
  }

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
  const whereClause: Prisma.channelWhereInput = {
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
            channelMembers: true,
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
    memberCount: channel._count.channelMembers,
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
  const whereClause: Prisma.messageWhereInput = {
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
            isOrchestrator: true,
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
    authorIsOrchestrator: message.author.isOrchestrator,
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
  const whereClause: Prisma.fileWhereInput = {
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
        uploadedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        messageAttachments: {
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
      if (channelId && file.messageAttachments.length > 0) {
        return file.messageAttachments[0].message.channelId === channelId;
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
      uploaderName: file.uploadedBy.name,
      channelId: file.messageAttachments[0]?.message?.channel?.id,
      channelName: file.messageAttachments[0]?.message?.channel?.name,
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
 * Search workspace users (non-orchestrators)
 */
async function searchUsers(
  workspaceId: string,
  query: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: UserResult[]; totalCount: number }> {
  // Get workspace to find organization
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });

  if (!workspace) {
    return { results: [], totalCount: 0 };
  }

  const whereClause: Prisma.userWhereInput = {
    isOrchestrator: false,
    organizationMembers: {
      some: {
        organizationId: workspace.organizationId,
      },
    },
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
      { displayName: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        isOrchestrator: true,
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  const results: UserResult[] = users.map((user) => ({
    type: 'user' as const,
    id: user.id,
    name: user.name,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    isOrchestrator: user.isOrchestrator,
    ...(includeHighlight && {
      highlighted: {
        name: user.name ? highlightText(user.name, query) : undefined,
        email: highlightText(user.email, query),
        displayName: user.displayName ? highlightText(user.displayName, query) : undefined,
      },
    }),
  }));

  return { results, totalCount };
}

/**
 * Search orchestrators
 */
async function searchOrchestrators(
  workspaceId: string,
  query: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: OrchestratorResult[]; totalCount: number }> {
  // Get workspace to find organization
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });

  if (!workspace) {
    return { results: [], totalCount: 0 };
  }

  const whereClause: Prisma.userWhereInput = {
    isOrchestrator: true,
    organizationMembers: {
      some: {
        organizationId: workspace.organizationId,
      },
    },
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { displayName: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [orchestrators, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        isOrchestrator: true,
        orchestrator: {
          select: {
            discipline: true,
            role: true,
          },
        },
      },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  const results: OrchestratorResult[] = orchestrators.map((user) => ({
    type: 'orchestrator' as const,
    id: user.id,
    name: user.name,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    status: user.status,
    discipline: user.orchestrator?.discipline ?? null,
    role: user.orchestrator?.role ?? null,
    ...(includeHighlight && {
      highlighted: {
        name: user.name ? highlightText(user.name, query) : undefined,
        displayName: user.displayName ? highlightText(user.displayName, query) : undefined,
        discipline: user.orchestrator?.discipline ? highlightText(user.orchestrator.discipline, query) : undefined,
        role: user.orchestrator?.role ? highlightText(user.orchestrator.role, query) : undefined,
      },
    }),
  }));

  return { results, totalCount };
}

/**
 * Search DM conversations
 */
async function searchDMs(
  workspaceId: string,
  userId: string,
  query: string,
  limit?: number,
  offset?: number,
  includeHighlight: boolean = true,
): Promise<{ results: DMResult[]; totalCount: number }> {
  // Find DM channels where user is a member and name matches query
  const whereClause: Prisma.channelWhereInput = {
    workspaceId,
    type: 'DM',
    channelMembers: {
      some: {
        userId,
      },
    },
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
    ],
  };

  const [dms, totalCount] = await Promise.all([
    prisma.channel.findMany({
      where: whereClause,
      take: limit,
      skip: offset,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        channelMembers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                isOrchestrator: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        },
      },
    }),
    prisma.channel.count({ where: whereClause }),
  ]);

  const results: DMResult[] = dms.map((dm) => ({
    type: 'dm' as const,
    id: dm.id,
    name: dm.name,
    participants: dm.channelMembers.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      isOrchestrator: member.user.isOrchestrator,
    })),
    lastMessageAt: dm.messages[0]?.createdAt ?? null,
    ...(includeHighlight && {
      highlighted: {
        name: highlightText(dm.name, query),
      },
    }),
  }));

  return { results, totalCount };
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

    // Parse workspace slug
    const params = await context.params;
    const { workspaceSlug } = params;

    // Validate workspace slug
    if (!workspaceSlug) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace slug is required',
          ORG_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Lookup workspace by slug to get ID
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          ORG_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

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

    // Parse types parameter (can be comma-separated list like "users,orchestrators")
    const typesParam = searchParams.get('types');
    const requestedTypes = typesParam ? typesParam.split(',').map(t => t.trim()) : [type];

    // Validate search types
    const validTypes = ['channels', 'messages', 'files', 'users', 'orchestrators', 'dms', 'all'];
    const invalidTypes = requestedTypes.filter(t => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          `Invalid search type(s): ${invalidTypes.join(', ')}. Must be: ${validTypes.join(', ')}`,
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

    // Perform search based on requested types
    let allResults: SearchResult[] = [];
    let totalCount = 0;
    const isAllTypes = requestedTypes.includes('all');
    const typeCount = isAllTypes ? 6 : requestedTypes.length; // Number of types to divide limit by
    const limitPerType = Math.ceil(limit / typeCount);
    const offsetPerType = Math.ceil(offset / typeCount);

    if (isAllTypes || requestedTypes.includes('channels')) {
      const { results: channelResults, totalCount: channelCount } =
        await searchChannels(
          workspaceId,
          query,
          accessibleChannelIds,
          channelId,
          isAllTypes ? limitPerType : limit,
          isAllTypes ? offsetPerType : offset,
          includeHighlight,
        );
      allResults.push(...channelResults);
      totalCount += channelCount;
    }

    if (isAllTypes || requestedTypes.includes('messages')) {
      const { results: messageResults, totalCount: messageCount } =
        await searchMessages(
          workspaceId,
          query,
          accessibleChannelIds,
          channelId,
          isAllTypes ? limitPerType : limit,
          isAllTypes ? offsetPerType : offset,
          includeHighlight,
        );
      allResults.push(...messageResults);
      totalCount += messageCount;
    }

    if (isAllTypes || requestedTypes.includes('files')) {
      const { results: fileResults, totalCount: fileCount } = await searchFiles(
        workspaceId,
        query,
        channelId,
        isAllTypes ? limitPerType : limit,
        isAllTypes ? offsetPerType : offset,
        includeHighlight,
      );
      allResults.push(...fileResults);
      totalCount += fileCount;
    }

    if (isAllTypes || requestedTypes.includes('users')) {
      const { results: userResults, totalCount: userCount } = await searchUsers(
        workspaceId,
        query,
        isAllTypes ? limitPerType : limit,
        isAllTypes ? offsetPerType : offset,
        includeHighlight,
      );
      allResults.push(...userResults);
      totalCount += userCount;
    }

    if (isAllTypes || requestedTypes.includes('orchestrators')) {
      const { results: orchestratorResults, totalCount: orchestratorCount } = await searchOrchestrators(
        workspaceId,
        query,
        isAllTypes ? limitPerType : limit,
        isAllTypes ? offsetPerType : offset,
        includeHighlight,
      );
      allResults.push(...orchestratorResults);
      totalCount += orchestratorCount;
    }

    if (isAllTypes || requestedTypes.includes('dms')) {
      const { results: dmResults, totalCount: dmCount } = await searchDMs(
        workspaceId,
        session.user.id,
        query,
        isAllTypes ? limitPerType : limit,
        isAllTypes ? offsetPerType : offset,
        includeHighlight,
      );
      allResults.push(...dmResults);
      totalCount += dmCount;
    }

    // Sort mixed results by relevance/date
    if (isAllTypes || requestedTypes.length > 1) {
      allResults.sort((a, b) => {
        // Helper to get name for any result type
        const getName = (result: SearchResult): string | null => {
          if (result.type === 'channel') return result.name;
          if (result.type === 'file') return result.originalName;
          if (result.type === 'user') return result.name ?? result.displayName;
          if (result.type === 'orchestrator') return result.name ?? result.displayName;
          if (result.type === 'dm') return result.name;
          return null;
        };

        // Prioritize exact matches in names/titles
        const aName = getName(a);
        const bName = getName(b);
        const aExact = aName?.toLowerCase().includes(query.toLowerCase()) ?? false;
        const bExact = bName?.toLowerCase().includes(query.toLowerCase()) ?? false;

        if (aExact && !bExact) {
          return -1;
        }
        if (!aExact && bExact) {
          return 1;
        }

        // Helper to get date for any result type
        const getDate = (result: SearchResult): Date | null => {
          if ('createdAt' in result) return result.createdAt;
          if ('lastMessageAt' in result) return result.lastMessageAt;
          return null;
        };

        // Then sort by date (newest first)
        const aDate = getDate(a);
        const bDate = getDate(b);
        if (aDate && bDate) {
          return bDate.getTime() - aDate.getTime();
        }
        return 0;
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
