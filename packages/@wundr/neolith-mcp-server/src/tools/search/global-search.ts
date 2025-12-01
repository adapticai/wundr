/**
 * Global Search Tool
 *
 * Searches across all content types (messages, files, users, channels, etc.)
 * within a Neolith workspace using the global search API endpoint.
 *
 * @module @wundr/neolith-mcp-server/tools/search/global-search
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Zod schema for global search input validation
 */
export const GlobalSearchSchema = z.object({
  /** Workspace slug or ID to search within */
  workspaceSlug: z.string().min(1, 'Workspace slug is required'),

  /** Search query string */
  query: z.string().min(1, 'Search query is required'),

  /** Content types to search (optional, defaults to 'all') */
  types: z.array(z.enum([
    'channels',
    'messages',
    'files',
    'users',
    'orchestrators',
    'dms',
    'all'
  ])).optional().default(['all']),

  /** Filter by user (from:user_id or from:@username) */
  from: z.string().optional(),

  /** Filter by channel (in:channel_id or in:#channel-name) */
  in: z.string().optional(),

  /** Filter by attachment type (has:attachments, has:links, has:mentions) */
  has: z.enum(['attachments', 'links', 'mentions']).optional(),

  /** Filter by date range (ISO date string or relative like '7d', '1m') */
  during: z.string().optional(),

  /** Number of results per page (default: 20, max: 100) */
  limit: z.number().int().min(1).max(100).optional().default(20),

  /** Pagination offset (default: 0) */
  offset: z.number().int().min(0).optional().default(0),

  /** Enable result highlighting (default: true) */
  highlight: z.boolean().optional().default(true),

  /** Include search facets/aggregations (default: false) */
  facets: z.boolean().optional().default(false),
});

export type GlobalSearchInput = z.infer<typeof GlobalSearchSchema>;

// =============================================================================
// Response Types
// =============================================================================

/**
 * Search result item (union of all possible types)
 */
export interface SearchResultItem {
  type: 'channel' | 'message' | 'file' | 'user' | 'orchestrator' | 'dm';
  id: string;
  [key: string]: unknown;
}

/**
 * Global search response
 */
export interface GlobalSearchResponse {
  data: SearchResultItem[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  facets?: {
    types: Array<{ type: string; count: number }>;
    channels: Array<{ id: string; name: string; count: number }>;
  };
}

/**
 * MCP tool result for global search
 */
export interface GlobalSearchResult {
  success: boolean;
  message: string;
  data?: {
    results: SearchResultItem[];
    totalCount: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    facets?: GlobalSearchResponse['facets'];
    query: string;
    filters?: {
      from?: string;
      in?: string;
      has?: string;
      during?: string;
    };
  };
  error?: string;
}

// =============================================================================
// Tool Handler
// =============================================================================

/**
 * Execute global search across workspace content
 *
 * @param input - Search parameters including query, filters, and pagination
 * @param apiClient - Neolith API client for making authenticated requests
 * @returns Search results with pagination and optional facets
 */
export async function globalSearchHandler(
  input: GlobalSearchInput,
  apiClient: NeolithApiClient,
): Promise<GlobalSearchResult> {
  try {
    const {
      workspaceSlug,
      query,
      types,
      from,
      in: inChannel,
      has,
      during,
      limit,
      offset,
      highlight,
      facets,
    } = GlobalSearchSchema.parse(input);

    // Build query parameters
    const params: Record<string, string | number | boolean> = {
      q: query,
      limit,
      offset,
      highlight,
      facets,
    };

    // Add type filters (comma-separated for multiple types)
    if (types && types.length > 0 && !types.includes('all')) {
      params.types = types.join(',');
    }

    // Add optional filters
    if (from) params.from = from;
    if (inChannel) params.in = inChannel;
    if (has) params.has = has;
    if (during) params.during = during;

    // Make API request
    const response = await apiClient.get<GlobalSearchResponse>(
      `/api/workspaces/${workspaceSlug}/search`,
      params,
    );

    // Check for API errors
    if (response.error || !response.data) {
      throw new Error(response.error || 'No data returned from API');
    }

    // Extract results and pagination from response.data
    const { data: results, pagination, facets: responseFacets } = response.data;

    return {
      success: true,
      message: `Found ${pagination.totalCount} result(s) for query "${query}"`,
      data: {
        results,
        totalCount: pagination.totalCount,
        offset: pagination.offset,
        limit: pagination.limit,
        hasMore: pagination.hasMore,
        facets: responseFacets,
        query,
        filters: {
          from,
          in: inChannel,
          has,
          during,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: 'Global search failed',
      error: errorMessage,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * MCP tool definition for global search
 */
export const globalSearchTool = {
  name: 'neolith_global_search',
  description: 'Search across all content types (messages, files, users, channels, etc.) within a Neolith workspace with advanced filtering options',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID to search within',
      },
      query: {
        type: 'string',
        description: 'Search query string',
      },
      types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['channels', 'messages', 'files', 'users', 'orchestrators', 'dms', 'all'],
        },
        description: 'Content types to search (default: all)',
        default: ['all'],
      },
      from: {
        type: 'string',
        description: 'Filter by user (from:user_id or from:@username)',
      },
      in: {
        type: 'string',
        description: 'Filter by channel (in:channel_id or in:#channel-name)',
      },
      has: {
        type: 'string',
        enum: ['attachments', 'links', 'mentions'],
        description: 'Filter by attachment type',
      },
      during: {
        type: 'string',
        description: 'Filter by date range (ISO date or relative like "7d", "1m")',
      },
      limit: {
        type: 'number',
        description: 'Number of results per page (default: 20, max: 100)',
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default: 0)',
        default: 0,
        minimum: 0,
      },
      highlight: {
        type: 'boolean',
        description: 'Enable result highlighting (default: true)',
        default: true,
      },
      facets: {
        type: 'boolean',
        description: 'Include search facets/aggregations (default: false)',
        default: false,
      },
    },
    required: ['workspaceSlug', 'query'],
  },
};
