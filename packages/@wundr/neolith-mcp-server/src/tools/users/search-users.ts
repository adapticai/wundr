/**
 * Search Users Tool
 *
 * Search for users within a workspace by name, email, or display name.
 * Maps to: GET /api/workspaces/[slug]/search?types=users&q=...
 *
 * @module @wundr/neolith-mcp-server/tools/users/search-users
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';
interface McpToolResult<T = unknown> { success: boolean; data?: T; message?: string; error?: string; }

/**
 * Input schema for search-users tool
 */
export const SearchUsersInputSchema = z.object({
  workspaceSlug: z.string().describe('Workspace ID or slug to search within'),
  query: z.string().describe('Search query string'),
  limit: z.number().min(1).max(100).optional().describe('Maximum number of results (default: 20)'),
  offset: z.number().min(0).optional().describe('Pagination offset (default: 0)'),
});

export type SearchUsersInput = z.infer<typeof SearchUsersInputSchema>;

/**
 * User search result
 */
export interface UserSearchResult {
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
 * Search response with pagination
 */
export interface SearchUsersResponse {
  results: UserSearchResult[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
}

/**
 * Search for users in a workspace
 *
 * @param apiClient - Neolith API client instance
 * @param input - Search parameters
 * @returns Search results with pagination
 *
 * @example
 * ```typescript
 * const result = await searchUsers(apiClient, {
 *   workspaceSlug: 'my-workspace',
 *   query: 'john',
 *   limit: 10
 * });
 * console.log(result.data.results);
 * ```
 */
export async function searchUsers(
  apiClient: NeolithApiClient,
  input: SearchUsersInput,
): Promise<McpToolResult<SearchUsersResponse>> {
  try {
    const { workspaceSlug, query, limit = 20, offset = 0 } = input;

    if (!workspaceSlug || !query) {
      return {
        success: false,
        error: 'Workspace slug and query are required',
        message: 'Invalid input',
      };
    }

    const params: Record<string, string | number> = {
      q: query,
      types: 'users',
      limit,
      offset,
    };

    const response = await apiClient.get<{
      data: UserSearchResult[];
      pagination: {
        offset: number;
        limit: number;
        totalCount: number;
        hasMore: boolean;
      };
    }>(`/api/workspaces/${workspaceSlug}/search`, params);

    // Check for API errors
    if (response.error || !response.data) {
      return {
        success: false,
        error: response.error || 'No data returned from API',
        message: 'Failed to search users',
      };
    }

    const { data: results, pagination } = response.data;

    return {
      success: true,
      message: `Found ${results.length} users matching "${query}"`,
      data: {
        results,
        pagination,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to search users',
    };
  }
}

/**
 * Tool definition for MCP registration
 */
export const searchUsersTool = {
  name: 'neolith_search_users',
  description: 'Search for users within a workspace by name, email, or display name',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace ID or slug to search within',
      },
      query: {
        type: 'string',
        description: 'Search query string',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20, max: 100)',
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default: 0)',
        minimum: 0,
      },
    },
    required: ['workspaceSlug', 'query'],
  },
};
