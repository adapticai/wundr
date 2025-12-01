/**
 * GraphQL Resolvers for Enterprise Search
 *
 * Provides comprehensive search functionality across workspace content
 * including messages, files, channels, users, and VPs.
 *
 * @module @genesis/api-types/resolvers/search-resolvers
 */

/**
 * SearchService interface for search resolver operations
 * Defined locally to avoid coupling to internal @genesis/core exports
 */
export interface SearchService {
  search(params: {
    query: string;
    filters: {
      workspaceId: string;
      types?: string[] | undefined;
      channelIds?: string[] | undefined;
      userIds?: string[] | undefined;
      dateRange?: { start: Date; end: Date } | undefined;
    };
    pagination: { limit: number; offset: number };
    highlight?: boolean | undefined;
    facets?: string[] | undefined;
    sort?:
      | { field: 'relevance' | 'date'; direction: 'asc' | 'desc' }
      | undefined;
  }): Promise<{
    results: Array<{
      id: string;
      type: string;
      score: number;
      highlight?:
        | {
            content?: string[] | undefined;
            title?: string[] | undefined;
            fileName?: string[] | undefined;
          }
        | undefined;
      data: Record<string, unknown>;
    }>;
    total: number;
    took: number;
    facets?:
      | {
          types?:
            | Array<{ key: string; label: string; count: number }>
            | undefined;
          channels?:
            | Array<{ key: string; label: string; count: number }>
            | undefined;
          users?:
            | Array<{ key: string; label: string; count: number }>
            | undefined;
          dates?:
            | Array<{ key: string; label: string; count: number }>
            | undefined;
        }
      | undefined;
    pagination: { hasMore: boolean; nextCursor?: string | undefined };
  }>;
  saveRecentSearch(userId: string, query: string): Promise<void>;
  getSuggestions(
    query: string,
    workspaceId: string,
    userId: string,
    limit: number
  ): Promise<
    Array<{
      text: string;
      type: string;
      metadata?: Record<string, unknown> | undefined;
    }>
  >;
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * GraphQL context for search resolvers
 */
export interface SearchGraphQLContext {
  services: {
    search: SearchService;
  };
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

/**
 * Search result type enum values
 */
export const SearchResultType = {
  MESSAGE: 'message',
  FILE: 'file',
  CHANNEL: 'channel',
  USER: 'user',
  VP: 'vp',
} as const;

export type SearchResultTypeValue =
  (typeof SearchResultType)[keyof typeof SearchResultType];

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * GraphQL type definitions for search
 */
export const searchTypeDefs = `#graphql
  type SearchResult {
    id: ID!
    type: SearchResultType!
    score: Float!
    highlight: SearchHighlight
    data: JSON!
  }

  type SearchHighlight {
    content: [String!]
    title: [String!]
    fileName: [String!]
  }

  enum SearchResultType {
    message
    file
    channel
    user
    vp
  }

  type SearchResponse {
    results: [SearchResult!]!
    total: Int!
    took: Int!
    facets: SearchFacets
    pagination: SearchPagination!
  }

  type SearchFacets {
    types: [FacetBucket!]
    channels: [FacetBucket!]
    users: [FacetBucket!]
    dates: [FacetBucket!]
  }

  type FacetBucket {
    key: String!
    label: String!
    count: Int!
  }

  type SearchPagination {
    hasMore: Boolean!
    nextCursor: String
  }

  type SearchSuggestion {
    text: String!
    type: String!
    metadata: JSON
  }

  input SearchInput {
    query: String!
    workspaceId: ID!
    types: [SearchResultType!]
    channelIds: [ID!]
    userIds: [ID!]
    dateFrom: DateTime
    dateTo: DateTime
    limit: Int
    offset: Int
    highlight: Boolean
    facets: [String!]
  }

  input SearchSortInput {
    field: SearchSortField!
    direction: SortDirection!
  }

  enum SearchSortField {
    relevance
    date
  }

  enum SortDirection {
    asc
    desc
  }

  extend type Query {
    """
    Search workspace content
    """
    search(input: SearchInput!, sort: SearchSortInput): SearchResponse!

    """
    Get search suggestions for autocomplete
    """
    searchSuggestions(workspaceId: ID!, query: String!, limit: Int): [SearchSuggestion!]!
  }
`;

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Search query resolvers
 */
export const searchQueries = {
  /**
   * Search workspace content
   */
  search: async (
    _parent: unknown,
    {
      input,
      sort,
    }: {
      input: {
        query: string;
        workspaceId: string;
        types?: string[];
        channelIds?: string[];
        userIds?: string[];
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
        offset?: number;
        highlight?: boolean;
        facets?: string[];
      };
      sort?: {
        field: 'relevance' | 'date';
        direction: 'asc' | 'desc';
      };
    },
    context: SearchGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    const result = await context.services.search.search({
      query: input.query,
      filters: {
        workspaceId: input.workspaceId,
        types: input.types as SearchResultTypeValue[],
        channelIds: input.channelIds,
        userIds: input.userIds,
        dateRange:
          input.dateFrom && input.dateTo
            ? {
                start: input.dateFrom,
                end: input.dateTo,
              }
            : undefined,
      },
      pagination: {
        limit: input.limit ?? 20,
        offset: input.offset ?? 0,
      },
      highlight: input.highlight ?? true,
      facets: input.facets,
      sort: sort,
    });

    // Save to recent searches
    await context.services.search.saveRecentSearch(
      context.user.id,
      input.query
    );

    return result;
  },

  /**
   * Get search suggestions for autocomplete
   */
  searchSuggestions: async (
    _parent: unknown,
    {
      workspaceId,
      query,
      limit,
    }: {
      workspaceId: string;
      query: string;
      limit?: number;
    },
    context: SearchGraphQLContext
  ) => {
    if (!context.user?.id) {
      throw new Error('Authentication required');
    }

    return context.services.search.getSuggestions(
      query,
      workspaceId,
      context.user.id,
      limit ?? 5
    );
  },
};

// =============================================================================
// FIELD RESOLVERS
// =============================================================================

/**
 * Field resolvers for SearchResult type
 */
export const SearchResultFieldResolvers = {
  /**
   * Resolve type for union type discrimination
   */
  __resolveType: (obj: { type: string }) => {
    switch (obj.type) {
      case 'message':
        return 'MessageSearchResult';
      case 'file':
        return 'FileSearchResult';
      case 'channel':
        return 'ChannelSearchResult';
      case 'user':
        return 'UserSearchResult';
      case 'vp':
        return 'VPSearchResult';
      default:
        return null;
    }
  },
};

// =============================================================================
// COMBINED RESOLVERS
// =============================================================================

/**
 * Combined search resolvers for schema stitching
 */
export const searchResolvers = {
  Query: searchQueries,
  SearchResult: SearchResultFieldResolvers,
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default searchResolvers;
