/**
 * Search Workspace Tool
 * Full-text search across workspace content (channels, messages, files, users)
 *
 * @module @wundr.io/neolith-mcp-server/tools/workspace/search-workspace
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';
import { getDefaultApiClient } from '../../client/neolith-api';

/**
 * Search result type
 */
export type SearchType = 'channels' | 'messages' | 'files' | 'users' | 'orchestrators' | 'dms' | 'all';

/**
 * Input schema for search-workspace tool
 */
export const SearchWorkspaceInputSchema = z.object({
  workspaceSlug: z.string().min(1).describe('Workspace slug or ID'),
  query: z.string().min(1).describe('Search query string'),
  types: z.string().optional().describe('Comma-separated search types: channels,messages,files,users,orchestrators,dms,all'),
  channelId: z.string().optional().describe('Limit search to a specific channel'),
  limit: z.number().int().positive().optional().default(20).describe('Maximum results to return'),
  offset: z.number().int().nonnegative().optional().default(0).describe('Pagination offset'),
  highlight: z.boolean().optional().default(true).describe('Enable result highlighting'),
  facets: z.boolean().optional().default(false).describe('Include result facets'),
});

export type SearchWorkspaceInput = z.infer<typeof SearchWorkspaceInputSchema>;

/**
 * Search result item (simplified - actual structure is more detailed)
 */
export interface SearchResultItem {
  type: SearchType;
  id: string;
  [key: string]: unknown;
}

/**
 * Output from search-workspace
 */
export interface SearchWorkspaceOutput {
  data: SearchResultItem[];
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
 * Search Workspace Handler
 * Searches workspace content via GET /api/workspaces/[slug]/search
 */
export async function searchWorkspaceHandler(
  input: SearchWorkspaceInput,
): Promise<McpToolResult<SearchWorkspaceOutput>> {
  try {
    // Validate input
    const validationResult = SearchWorkspaceInputSchema.safeParse(input);
    if (!validationResult.success) {
      return errorResult(
        'Input validation failed',
        'VALIDATION_ERROR',
        { issues: validationResult.error.issues },
      );
    }

    const validInput = validationResult.data;
    const apiClient = getDefaultApiClient();

    // Build query parameters
    const queryParams: Record<string, string> = {
      q: validInput.query,
      limit: validInput.limit.toString(),
      offset: validInput.offset.toString(),
      highlight: validInput.highlight.toString(),
      facets: validInput.facets.toString(),
    };

    if (validInput.types) {
      queryParams.types = validInput.types;
    }

    if (validInput.channelId) {
      queryParams.channelId = validInput.channelId;
    }

    // Make API request
    const response = await apiClient.get<SearchWorkspaceOutput>(
      `/api/workspaces/${validInput.workspaceSlug}/search`,
      queryParams,
    );

    if (!response.success || !response.data) {
      return errorResult(
        response.error || 'Failed to search workspace',
        response.status === 404 ? 'WORKSPACE_NOT_FOUND' : 'API_ERROR',
        { status: response.status, workspaceSlug: validInput.workspaceSlug },
      );
    }

    const output = response.data;

    return successResult(
      output,
      `Found ${output.data.length} result(s) for query "${validInput.query}"`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorResult(
      `Failed to search workspace: ${errorMessage}`,
      'HANDLER_ERROR',
      { stack: error instanceof Error ? error.stack : undefined },
    );
  }
}

/**
 * Tool definition for MCP registration
 */
export const searchWorkspaceTool = {
  name: 'neolith_search_workspace',
  description: 'Full-text search across workspace content including channels, messages, files, users, orchestrators, and DMs. Supports filtering, pagination, and result highlighting.',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      query: {
        type: 'string',
        description: 'Search query string',
      },
      types: {
        type: 'string',
        description: 'Comma-separated search types: channels,messages,files,users,orchestrators,dms,all',
      },
      channelId: {
        type: 'string',
        description: 'Limit search to a specific channel',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 20,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset',
        default: 0,
      },
      highlight: {
        type: 'boolean',
        description: 'Enable result highlighting',
        default: true,
      },
      facets: {
        type: 'boolean',
        description: 'Include result facets (type counts, channel counts)',
        default: false,
      },
    },
    required: ['workspaceSlug', 'query'],
  },
  category: 'workspace',
  handler: searchWorkspaceHandler,
};
