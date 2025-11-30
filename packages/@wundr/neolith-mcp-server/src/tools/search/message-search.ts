/**
 * Message Search Tool
 *
 * Searches specifically for messages within a Neolith workspace with
 * message-specific filters and highlighting.
 *
 * @module @wundr/neolith-mcp-server/tools/search/message-search
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../lib/api-client';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Zod schema for message search input validation
 */
export const MessageSearchSchema = z.object({
  /** Workspace slug or ID to search within */
  workspaceSlug: z.string().min(1, 'Workspace slug is required'),

  /** Search query string */
  query: z.string().min(1, 'Search query is required'),

  /** Filter by author user ID or username */
  from: z.string().optional(),

  /** Filter by channel ID or name */
  in: z.string().optional(),

  /** Filter by content features (has:attachments, has:links, has:mentions) */
  has: z.enum(['attachments', 'links', 'mentions']).optional(),

  /** Filter by date range (ISO date string or relative like '7d', '1m') */
  during: z.string().optional(),

  /** Filter by edited status */
  isEdited: z.boolean().optional(),

  /** Filter by thread status (messages with replies) */
  hasReplies: z.boolean().optional(),

  /** Number of results per page (default: 20, max: 100) */
  limit: z.number().int().min(1).max(100).optional().default(20),

  /** Pagination offset (default: 0) */
  offset: z.number().int().min(0).optional().default(0),

  /** Enable result highlighting (default: true) */
  highlight: z.boolean().optional().default(true),
});

export type MessageSearchInput = z.infer<typeof MessageSearchSchema>;

// =============================================================================
// Response Types
// =============================================================================

/**
 * Message search result item
 */
export interface MessageResultItem {
  type: 'message';
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorIsOrchestrator: boolean;
  createdAt: string;
  isEdited: boolean;
  replyCount: number;
  highlighted?: {
    content?: string;
  };
}

/**
 * Message search response
 */
export interface MessageSearchResponse {
  data: MessageResultItem[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
}

/**
 * MCP tool result for message search
 */
export interface MessageSearchResult {
  success: boolean;
  message: string;
  data?: {
    messages: MessageResultItem[];
    totalCount: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    query: string;
    filters?: {
      from?: string;
      in?: string;
      has?: string;
      during?: string;
      isEdited?: boolean;
      hasReplies?: boolean;
    };
  };
  error?: string;
}

// =============================================================================
// Tool Handler
// =============================================================================

/**
 * Execute message-specific search within workspace
 *
 * @param input - Message search parameters with filters
 * @param apiClient - Neolith API client for making authenticated requests
 * @returns Message search results with pagination
 */
export async function messageSearchHandler(
  input: MessageSearchInput,
  apiClient: NeolithApiClient,
): Promise<MessageSearchResult> {
  try {
    const {
      workspaceSlug,
      query,
      from,
      in: inChannel,
      has,
      during,
      isEdited,
      hasReplies,
      limit,
      offset,
      highlight,
    } = MessageSearchSchema.parse(input);

    // Build query parameters
    const params: Record<string, string | number | boolean> = {
      q: query,
      type: 'messages', // Force message-only search
      limit,
      offset,
      highlight,
    };

    // Add optional filters
    if (from) params.from = from;
    if (inChannel) params.in = inChannel;
    if (has) params.has = has;
    if (during) params.during = during;
    if (isEdited !== undefined) params.isEdited = isEdited;
    if (hasReplies !== undefined) params.hasReplies = hasReplies;

    // Make API request
    const response = await apiClient.get<MessageSearchResponse>(
      `/api/workspaces/${workspaceSlug}/search`,
      params,
    );

    // Extract results and pagination
    const { data: messages, pagination } = response;

    return {
      success: true,
      message: `Found ${pagination.totalCount} message(s) matching "${query}"`,
      data: {
        messages,
        totalCount: pagination.totalCount,
        offset: pagination.offset,
        limit: pagination.limit,
        hasMore: pagination.hasMore,
        query,
        filters: {
          from,
          in: inChannel,
          has,
          during,
          isEdited,
          hasReplies,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: 'Message search failed',
      error: errorMessage,
    };
  }
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * MCP tool definition for message search
 */
export const messageSearchTool = {
  name: 'neolith_message_search',
  description: 'Search specifically for messages within a Neolith workspace with message-specific filters like author, channel, attachments, and date range',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID to search within',
      },
      query: {
        type: 'string',
        description: 'Search query string to match in message content',
      },
      from: {
        type: 'string',
        description: 'Filter by author user ID or username (e.g., "user_123" or "@john")',
      },
      in: {
        type: 'string',
        description: 'Filter by channel ID or name (e.g., "channel_456" or "#general")',
      },
      has: {
        type: 'string',
        enum: ['attachments', 'links', 'mentions'],
        description: 'Filter by content features (attachments, links, or mentions)',
      },
      during: {
        type: 'string',
        description: 'Filter by date range (ISO date or relative like "7d" for last 7 days, "1m" for last month)',
      },
      isEdited: {
        type: 'boolean',
        description: 'Filter to only edited or non-edited messages',
      },
      hasReplies: {
        type: 'boolean',
        description: 'Filter to messages with or without replies (thread starters)',
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
        description: 'Pagination offset for fetching additional pages (default: 0)',
        default: 0,
        minimum: 0,
      },
      highlight: {
        type: 'boolean',
        description: 'Enable search term highlighting in results (default: true)',
        default: true,
      },
    },
    required: ['workspaceSlug', 'query'],
  },
};
