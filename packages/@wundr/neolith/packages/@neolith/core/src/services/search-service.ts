/**
 * @fileoverview Enterprise search service with full-text search
 *
 * Provides comprehensive full-text search capabilities across messages, files,
 * channels, users, and VPs using PostgreSQL's built-in tsvector/tsquery.
 *
 * Features:
 * - Full-text search with ranking
 * - Highlighted search results
 * - Faceted search
 * - Recent search history
 * - Search suggestions
 * - Result caching with Redis
 *
 * @module @genesis/core/services/search-service
 */

import type {
  SearchFacets,
  SearchFilters,
  SearchIndexDocument,
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchResultType,
  SearchSort,
  SearchSuggestion,
} from '../types/search';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Configuration for SearchService
 */
export interface SearchServiceConfig {
  /** Prisma client instance */
  prisma: PrismaClient;
  /** Redis client instance */
  redis: Redis;
  /** Default number of results per page */
  defaultLimit?: number;
  /** Maximum allowed results per page */
  maxLimit?: number;
  /** Redis key prefix for search cache */
  cachePrefix?: string;
  /** Cache TTL in seconds */
  cacheTtl?: number;
}

/**
 * Search service interface
 */
export interface SearchService {
  search(query: SearchQuery): Promise<SearchResponse>;
  getSuggestions(
    prefix: string,
    workspaceId: string,
    userId: string,
    limit?: number
  ): Promise<SearchSuggestion[]>;
  saveRecentSearch(userId: string, query: string): Promise<void>;
  clearCache(workspaceId?: string): Promise<void>;
  indexDocument(doc: SearchIndexDocument): Promise<void>;
  removeDocument(type: SearchResultType, id: string): Promise<void>;
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Base error class for search operations
 */
export class SearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchError';
  }
}

/**
 * Error thrown when search query is invalid
 */
export class SearchValidationError extends SearchError {
  constructor(message: string) {
    super(message);
    this.name = 'SearchValidationError';
  }
}

/**
 * Error thrown when search times out
 */
export class SearchTimeoutError extends SearchError {
  constructor(message: string) {
    super(message);
    this.name = 'SearchTimeoutError';
  }
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Enterprise search service implementation
 *
 * @example
 * ```typescript
 * const searchService = new SearchServiceImpl({
 *   prisma,
 *   redis,
 *   defaultLimit: 20,
 *   maxLimit: 100,
 * });
 *
 * const results = await searchService.search({
 *   query: 'quarterly report',
 *   filters: { workspaceId: 'ws-123', types: ['message', 'file'] },
 *   pagination: { limit: 10, offset: 0 },
 *   highlight: true,
 * });
 * ```
 */
export class SearchServiceImpl implements SearchService {
  private prisma: PrismaClient;
  private redis: Redis;
  private defaultLimit: number;
  private maxLimit: number;
  private cachePrefix: string;
  private cacheTtl: number;

  constructor(config: SearchServiceConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.defaultLimit = config.defaultLimit ?? 20;
    this.maxLimit = config.maxLimit ?? 100;
    this.cachePrefix = config.cachePrefix ?? 'search:';
    this.cacheTtl = config.cacheTtl ?? 300; // 5 minutes
  }

  /**
   * Perform full-text search across all indexed content
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    // Validate query
    if (!query.query || query.query.trim().length === 0) {
      throw new SearchValidationError('Search query cannot be empty');
    }

    if (query.query.length > 500) {
      throw new SearchValidationError(
        'Search query too long (max 500 characters)'
      );
    }

    const cacheKey = this.buildCacheKey(query);

    // Check cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const response = JSON.parse(cached) as SearchResponse;
      response.took = Date.now() - startTime;
      return response;
    }

    const limit = Math.min(
      query.pagination?.limit ?? this.defaultLimit,
      this.maxLimit
    );
    const offset = query.pagination?.offset ?? 0;

    // Build search query for each type
    const types = query.filters?.types ?? [
      'message',
      'file',
      'channel',
      'user',
      'vp',
    ];

    const searchPromises = types.map(type =>
      this.searchByType(type, query, limit, offset)
    );

    const typeResults = await Promise.all(searchPromises);

    // Merge and sort results by score
    let allResults = typeResults.flat();

    // Apply global sorting
    if (query.sort) {
      allResults = this.sortResults(allResults, query.sort);
    } else {
      // Default sort by relevance (score)
      allResults.sort((a, b) => b.score - a.score);
    }

    // Apply pagination to merged results
    const paginatedResults = allResults.slice(0, limit);
    const total = allResults.length;

    // Build facets if requested
    let facets: SearchFacets | undefined;
    if (query.facets && query.facets.length > 0) {
      facets = await this.buildFacets(query, types);
    }

    const response: SearchResponse = {
      results: paginatedResults,
      total,
      took: Date.now() - startTime,
      facets,
      pagination: {
        hasMore: total > limit + offset,
        nextCursor: total > limit + offset ? String(offset + limit) : undefined,
      },
    };

    // Cache the response
    await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(response));

    return response;
  }

  /**
   * Search by specific type
   */
  private async searchByType(
    type: SearchResultType,
    query: SearchQuery,
    limit: number,
    offset: number
  ): Promise<SearchResult[]> {
    const tsQuery = this.buildTsQuery(query.query);

    switch (type) {
      case 'message':
        return this.searchMessages(
          tsQuery,
          query.filters,
          limit,
          offset,
          query.highlight
        );
      case 'file':
        return this.searchFiles(
          tsQuery,
          query.filters,
          limit,
          offset,
          query.highlight
        );
      case 'channel':
        return this.searchChannels(
          tsQuery,
          query.filters,
          limit,
          offset,
          query.highlight
        );
      case 'user':
        return this.searchUsers(
          tsQuery,
          query.filters,
          limit,
          offset,
          query.highlight
        );
      case 'vp':
        return this.searchVPs(
          tsQuery,
          query.filters,
          limit,
          offset,
          query.highlight
        );
      default:
        return [];
    }
  }

  /**
   * Search messages using PostgreSQL full-text search.
   *
   * @param tsQuery - PostgreSQL tsquery string for full-text search
   * @param filters - Optional filters to narrow search scope
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Result offset for pagination (default: 0)
   * @param highlight - Include highlighted snippets in results (default: false)
   * @returns Array of message search results with scores
   */
  private async searchMessages(
    tsQuery: string,
    filters?: SearchFilters,
    limit = 20,
    offset = 0,
    highlight = false
  ): Promise<SearchResult[]> {
    // Build WHERE conditions dynamically
    const conditions: string[] = [
      "to_tsvector('english', m.content) @@ to_tsquery('english', $1)",
    ];
    // SQL parameter types: string, string[], Date, or number
    type SqlParam = string | string[] | Date | number;
    const params: SqlParam[] = [tsQuery];
    let paramIndex = 2;

    if (filters?.workspaceId) {
      conditions.push(`c."workspaceId" = $${paramIndex}`);
      params.push(filters.workspaceId);
      paramIndex++;
    }

    if (filters?.channelIds?.length) {
      conditions.push(`m."channelId" = ANY($${paramIndex})`);
      params.push(filters.channelIds);
      paramIndex++;
    }

    if (filters?.userIds?.length) {
      conditions.push(`m."senderId" = ANY($${paramIndex})`);
      params.push(filters.userIds);
      paramIndex++;
    }

    if (filters?.dateRange) {
      conditions.push(
        `m."createdAt" BETWEEN $${paramIndex} AND $${paramIndex + 1}`
      );
      params.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    if (filters?.isThreadReply !== undefined) {
      conditions.push(
        filters.isThreadReply
          ? 'm."threadId" IS NOT NULL'
          : 'm."threadId" IS NULL'
      );
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const highlightSelect = highlight
      ? ", ts_headline('english', m.content, to_tsquery('english', $1)) as headline"
      : ', NULL as headline';

    const sqlQuery = `
      SELECT
        m.id,
        m.content,
        m."channelId",
        c.name as "channelName",
        m."senderId",
        u.name as "senderName",
        m."createdAt" as "sentAt",
        m."threadId",
        EXISTS(SELECT 1 FROM "Attachment" a WHERE a."messageId" = m.id) as "hasAttachments",
        ts_rank(to_tsvector('english', m.content), to_tsquery('english', $1)) as rank
        ${highlightSelect}
      FROM "Message" m
      JOIN "Channel" c ON m."channelId" = c.id
      JOIN "User" u ON m."senderId" = u.id
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        channelId: string;
        channelName: string;
        senderId: string;
        senderName: string;
        sentAt: Date;
        threadId: string | null;
        hasAttachments: boolean;
        rank: number;
        headline: string | null;
      }>
    >(sqlQuery, ...params);

    return results.map(
      (row: {
        id: string;
        content: string;
        channelId: string;
        channelName: string;
        senderId: string;
        senderName: string;
        sentAt: Date;
        threadId: string | null;
        hasAttachments: boolean;
        rank: number;
        headline: string | null;
      }) => ({
        id: row.id,
        type: 'message' as const,
        score: row.rank,
        highlight:
          highlight && row.headline ? { content: [row.headline] } : undefined,
        data: {
          type: 'message' as const,
          messageId: row.id,
          content: row.content,
          channelId: row.channelId,
          channelName: row.channelName,
          senderId: row.senderId,
          senderName: row.senderName,
          sentAt: row.sentAt,
          threadId: row.threadId ?? undefined,
          hasAttachments: row.hasAttachments,
        },
      })
    );
  }

  /**
   * Search files in storage using PostgreSQL full-text search.
   *
   * @param tsQuery - PostgreSQL tsquery string for full-text search
   * @param filters - Optional filters to narrow search scope
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Result offset for pagination (default: 0)
   * @param highlight - Include highlighted snippets in results (default: false)
   * @returns Array of file search results with scores
   */
  private async searchFiles(
    tsQuery: string,
    filters?: SearchFilters,
    limit = 20,
    offset = 0,
    highlight = false
  ): Promise<SearchResult[]> {
    const conditions: string[] = [
      "to_tsvector('english', COALESCE(a.\"fileName\", '') || ' ' || COALESCE(a.\"extractedText\", '')) @@ to_tsquery('english', $1)",
    ];
    // SQL parameter types: string, string[], Date, or number
    type SqlParam = string | string[] | Date | number;
    const params: SqlParam[] = [tsQuery];
    let paramIndex = 2;

    if (filters?.workspaceId) {
      conditions.push(`c."workspaceId" = $${paramIndex}`);
      params.push(filters.workspaceId);
      paramIndex++;
    }

    if (filters?.channelIds?.length) {
      conditions.push(`m."channelId" = ANY($${paramIndex})`);
      params.push(filters.channelIds);
      paramIndex++;
    }

    if (filters?.dateRange) {
      conditions.push(
        `a."createdAt" BETWEEN $${paramIndex} AND $${paramIndex + 1}`
      );
      params.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const highlightSelect = highlight
      ? ', ts_headline(\'english\', COALESCE(a."extractedText", a."fileName"), to_tsquery(\'english\', $1)) as headline'
      : ', NULL as headline';

    const sqlQuery = `
      SELECT
        a.id,
        a."fileName",
        a."fileType",
        a."fileSize",
        m."channelId",
        c.name as "channelName",
        m."senderId" as "uploaderId",
        u.name as "uploaderName",
        a."createdAt" as "uploadedAt",
        a."extractedText",
        ts_rank(to_tsvector('english', COALESCE(a."fileName", '') || ' ' || COALESCE(a."extractedText", '')), to_tsquery('english', $1)) as rank
        ${highlightSelect}
      FROM "Attachment" a
      JOIN "Message" m ON a."messageId" = m.id
      JOIN "Channel" c ON m."channelId" = c.id
      JOIN "User" u ON m."senderId" = u.id
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        fileName: string;
        fileType: string;
        fileSize: number;
        channelId: string;
        channelName: string;
        uploaderId: string;
        uploaderName: string;
        uploadedAt: Date;
        extractedText: string | null;
        rank: number;
        headline: string | null;
      }>
    >(sqlQuery, ...params);

    return results.map(
      (row: {
        id: string;
        fileName: string;
        fileType: string;
        fileSize: number;
        channelId: string;
        channelName: string;
        uploaderId: string;
        uploaderName: string;
        uploadedAt: Date;
        extractedText: string | null;
        rank: number;
        headline: string | null;
      }) => ({
        id: row.id,
        type: 'file' as const,
        score: row.rank,
        highlight:
          highlight && row.headline ? { fileName: [row.headline] } : undefined,
        data: {
          type: 'file' as const,
          fileId: row.id,
          fileName: row.fileName,
          fileType: row.fileType,
          fileSize: row.fileSize,
          channelId: row.channelId,
          channelName: row.channelName,
          uploaderId: row.uploaderId,
          uploaderName: row.uploaderName,
          uploadedAt: row.uploadedAt,
          extractedText: row.extractedText ?? undefined,
        },
      })
    );
  }

  /**
   * Search channels by name and description using PostgreSQL full-text search.
   *
   * @param tsQuery - PostgreSQL tsquery string for full-text search
   * @param filters - Optional filters to narrow search scope
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Result offset for pagination (default: 0)
   * @param highlight - Include highlighted snippets in results (default: false)
   * @returns Array of channel search results with scores
   */
  private async searchChannels(
    tsQuery: string,
    filters?: SearchFilters,
    limit = 20,
    offset = 0,
    highlight = false
  ): Promise<SearchResult[]> {
    const conditions: string[] = [
      "to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')) @@ to_tsquery('english', $1)",
    ];
    // SQL parameter types: string, string[], Date, or number
    type SqlParam = string | string[] | Date | number;
    const params: SqlParam[] = [tsQuery];
    let paramIndex = 2;

    if (filters?.workspaceId) {
      conditions.push(`c."workspaceId" = $${paramIndex}`);
      params.push(filters.workspaceId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const highlightSelect = highlight
      ? ", ts_headline('english', c.name || ' ' || COALESCE(c.description, ''), to_tsquery('english', $1)) as headline"
      : ', NULL as headline';

    const sqlQuery = `
      SELECT
        c.id,
        c.name,
        c.description,
        (SELECT COUNT(*) FROM "ChannelMember" cm WHERE cm."channelId" = c.id) as "memberCount",
        c."isPrivate",
        c."createdAt",
        ts_rank(to_tsvector('english', c.name || ' ' || COALESCE(c.description, '')), to_tsquery('english', $1)) as rank
        ${highlightSelect}
      FROM "Channel" c
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        memberCount: bigint;
        isPrivate: boolean;
        createdAt: Date;
        rank: number;
        headline: string | null;
      }>
    >(sqlQuery, ...params);

    return results.map(
      (row: {
        id: string;
        name: string;
        description: string | null;
        memberCount: bigint;
        isPrivate: boolean;
        createdAt: Date;
        rank: number;
        headline: string | null;
      }) => ({
        id: row.id,
        type: 'channel' as const,
        score: row.rank,
        highlight:
          highlight && row.headline ? { title: [row.headline] } : undefined,
        data: {
          type: 'channel' as const,
          channelId: row.id,
          name: row.name,
          description: row.description ?? undefined,
          memberCount: Number(row.memberCount),
          isPrivate: row.isPrivate,
          createdAt: row.createdAt,
        },
      })
    );
  }

  /**
   * Search users by name, email, and discipline using PostgreSQL full-text search.
   *
   * @param tsQuery - PostgreSQL tsquery string for full-text search
   * @param filters - Optional filters to narrow search scope
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Result offset for pagination (default: 0)
   * @param highlight - Include highlighted snippets in results (default: false)
   * @returns Array of user search results with scores
   */
  private async searchUsers(
    tsQuery: string,
    filters?: SearchFilters,
    limit = 20,
    offset = 0,
    highlight = false
  ): Promise<SearchResult[]> {
    const conditions: string[] = [
      "to_tsvector('english', u.name || ' ' || u.email || ' ' || COALESCE(u.discipline, '')) @@ to_tsquery('english', $1)",
    ];
    // SQL parameter types: string, string[], Date, or number
    type SqlParam = string | string[] | Date | number;
    const params: SqlParam[] = [tsQuery];
    let paramIndex = 2;

    if (filters?.workspaceId) {
      conditions.push(`wm."workspaceId" = $${paramIndex}`);
      params.push(filters.workspaceId);
      paramIndex++;
    }

    if (filters?.disciplines?.length) {
      conditions.push(`u.discipline = ANY($${paramIndex})`);
      params.push(filters.disciplines);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const highlightSelect = highlight
      ? ", ts_headline('english', u.name || ' ' || u.email, to_tsquery('english', $1)) as headline"
      : ', NULL as headline';

    const sqlQuery = `
      SELECT
        u.id,
        u.name,
        u.email,
        wm.role,
        u.discipline,
        u.image as "avatarUrl",
        ts_rank(to_tsvector('english', u.name || ' ' || u.email || ' ' || COALESCE(u.discipline, '')), to_tsquery('english', $1)) as rank
        ${highlightSelect}
      FROM "User" u
      JOIN "WorkspaceMember" wm ON u.id = wm."userId"
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        discipline: string | null;
        avatarUrl: string | null;
        rank: number;
        headline: string | null;
      }>
    >(sqlQuery, ...params);

    return results.map(
      (row: {
        id: string;
        name: string;
        email: string;
        role: string;
        discipline: string | null;
        avatarUrl: string | null;
        rank: number;
        headline: string | null;
      }) => ({
        id: row.id,
        type: 'user' as const,
        score: row.rank,
        highlight:
          highlight && row.headline ? { title: [row.headline] } : undefined,
        data: {
          type: 'user' as const,
          userId: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          discipline: row.discipline ?? undefined,
          avatarUrl: row.avatarUrl ?? undefined,
        },
      })
    );
  }

  /**
   * Search VPs (Virtual Professionals) by name, discipline, and capabilities.
   *
   * @param tsQuery - PostgreSQL tsquery string for full-text search
   * @param filters - Optional filters to narrow search scope
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Result offset for pagination (default: 0)
   * @param highlight - Include highlighted snippets in results (default: false)
   * @returns Array of Orchestrator search results with scores
   */
  private async searchVPs(
    tsQuery: string,
    filters?: SearchFilters,
    limit = 20,
    offset = 0,
    highlight = false
  ): Promise<SearchResult[]> {
    const conditions: string[] = [
      "to_tsvector('english', vp.name || ' ' || vp.discipline || ' ' || array_to_string(vp.capabilities, ' ')) @@ to_tsquery('english', $1)",
    ];
    // SQL parameter types: string, string[], Date, or number
    type SqlParam = string | string[] | Date | number;
    const params: SqlParam[] = [tsQuery];
    let paramIndex = 2;

    if (filters?.workspaceId) {
      conditions.push(`vp."workspaceId" = $${paramIndex}`);
      params.push(filters.workspaceId);
      paramIndex++;
    }

    if (filters?.disciplines?.length) {
      conditions.push(`vp.discipline = ANY($${paramIndex})`);
      params.push(filters.disciplines);
      paramIndex++;
    }

    if (filters?.orchestratorIds?.length) {
      conditions.push(`vp.id = ANY($${paramIndex})`);
      params.push(filters.orchestratorIds);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    params.push(limit, offset);

    const highlightSelect = highlight
      ? ", ts_headline('english', vp.name || ' ' || vp.discipline, to_tsquery('english', $1)) as headline"
      : ', NULL as headline';

    const sqlQuery = `
      SELECT
        vp.id,
        vp.name,
        vp.discipline,
        vp.status,
        vp.capabilities,
        ts_rank(to_tsvector('english', vp.name || ' ' || vp.discipline || ' ' || array_to_string(vp.capabilities, ' ')), to_tsquery('english', $1)) as rank
        ${highlightSelect}
      FROM "VP" vp
      WHERE ${whereClause}
      ORDER BY rank DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const results = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        discipline: string;
        status: string;
        capabilities: string[];
        rank: number;
        headline: string | null;
      }>
    >(sqlQuery, ...params);

    return results.map(
      (row: {
        id: string;
        name: string;
        discipline: string;
        status: string;
        capabilities: string[];
        rank: number;
        headline: string | null;
      }) => ({
        id: row.id,
        type: 'vp' as const,
        score: row.rank,
        highlight:
          highlight && row.headline ? { title: [row.headline] } : undefined,
        data: {
          type: 'vp' as const,
          vpId: row.id,
          name: row.name,
          discipline: row.discipline,
          status: row.status,
          capabilities: row.capabilities,
        },
      })
    );
  }

  /**
   * Build PostgreSQL tsquery from search string
   */
  private buildTsQuery(query: string): string {
    // Escape special characters and convert to tsquery format
    const terms = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `${term}:*`);

    return terms.join(' & ');
  }

  /**
   * Sort results by specified criteria
   */
  private sortResults(
    results: SearchResult[],
    sort: SearchSort
  ): SearchResult[] {
    const multiplier = sort.direction === 'asc' ? 1 : -1;

    return results.sort((a, b) => {
      switch (sort.field) {
        case 'date': {
          const dateA = this.getResultDate(a);
          const dateB = this.getResultDate(b);
          return multiplier * (dateA.getTime() - dateB.getTime());
        }
        case 'relevance':
        default:
          return multiplier * (a.score - b.score);
      }
    });
  }

  /**
   * Get date from search result based on the result type.
   *
   * Extracts the relevant timestamp field from different result types:
   * - Messages: sentAt
   * - Files: uploadedAt
   * - Channels: createdAt
   * - Users/VPs: current time (no primary timestamp)
   *
   * @param result - The search result to extract date from
   * @returns Date object representing when the result was created/sent
   */
  private getResultDate(result: SearchResult): Date {
    const data = result.data;

    // Type-safe date extraction using discriminated union
    switch (data.type) {
      case 'message':
        return new Date(data.sentAt);
      case 'file':
        return new Date(data.uploadedAt);
      case 'channel':
        return new Date(data.createdAt);
      case 'user':
      case 'vp':
        // Users and VPs don't have a primary date field
        return new Date();
      default:
        return new Date();
    }
  }

  /**
   * Build facets for search results
   */
  private async buildFacets(
    query: SearchQuery,
    types: SearchResultType[]
  ): Promise<SearchFacets> {
    const facets: SearchFacets = {};

    if (query.facets?.includes('types')) {
      facets.types = types.map(type => ({
        key: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        count: 0, // Would need separate count queries in production
      }));
    }

    return facets;
  }

  /**
   * Build cache key for search query
   */
  private buildCacheKey(query: SearchQuery): string {
    const hash = JSON.stringify({
      q: query.query,
      f: query.filters,
      p: query.pagination,
      s: query.sort,
    });
    return `${this.cachePrefix}${Buffer.from(hash).toString('base64').slice(0, 32)}`;
  }

  /**
   * Get search suggestions based on query prefix
   */
  async getSuggestions(
    prefix: string,
    _workspaceId: string,
    userId: string,
    limit = 5
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];

    // Get recent searches from Redis
    const recentKey = `${this.cachePrefix}recent:${userId}`;
    const recentSearches = await this.redis.lrange(recentKey, 0, limit - 1);

    for (const search of recentSearches) {
      if (search.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.push({
          text: search,
          type: 'recent',
        });
      }
    }

    // Could add filter suggestions here based on prefix
    // e.g., "in:" for channels, "from:" for users
    // _workspaceId is reserved for future workspace-scoped suggestions

    return suggestions.slice(0, limit);
  }

  /**
   * Save a search to recent history
   */
  async saveRecentSearch(userId: string, query: string): Promise<void> {
    const key = `${this.cachePrefix}recent:${userId}`;
    await this.redis.lpush(key, query);
    await this.redis.ltrim(key, 0, 49); // Keep last 50 searches
    await this.redis.expire(key, 86400 * 30); // 30 days
  }

  /**
   * Clear search cache for workspace
   */
  async clearCache(workspaceId?: string): Promise<void> {
    const pattern = workspaceId
      ? `${this.cachePrefix}*${workspaceId}*`
      : `${this.cachePrefix}*`;

    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Index a document for search (for future Elasticsearch migration)
   */
  async indexDocument(doc: SearchIndexDocument): Promise<void> {
    // Currently using PostgreSQL full-text search
    // This method is a placeholder for future Elasticsearch integration
    const key = `${this.cachePrefix}index:${doc.type}:${doc.id}`;
    await this.redis.setex(key, 3600, JSON.stringify(doc));
  }

  /**
   * Remove document from search index
   */
  async removeDocument(type: SearchResultType, id: string): Promise<void> {
    const key = `${this.cachePrefix}index:${type}:${id}`;
    await this.redis.del(key);
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a new SearchService instance
 */
export function createSearchService(
  config: SearchServiceConfig
): SearchService {
  return new SearchServiceImpl(config);
}

// Singleton instance (lazily initialized)
let searchServiceInstance: SearchService | null = null;

/**
 * Get the singleton SearchService instance
 */
export function getSearchService(config?: SearchServiceConfig): SearchService {
  if (!searchServiceInstance && config) {
    searchServiceInstance = createSearchService(config);
  }
  if (!searchServiceInstance) {
    throw new Error(
      'SearchService not initialized. Call getSearchService with config first.'
    );
  }
  return searchServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSearchService(): void {
  searchServiceInstance = null;
}
