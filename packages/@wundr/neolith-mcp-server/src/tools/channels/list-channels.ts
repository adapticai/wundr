/**
 * List Channels Tool
 *
 * MCP tool for listing channels in a Neolith workspace
 *
 * @module tools/channels/list-channels
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const ListChannelsInputSchema = z.object({
  workspaceSlug: z.string().describe('Workspace slug or ID'),
  type: z
    .enum(['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'])
    .optional()
    .describe('Filter by channel type'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Number of channels to return (default: 50, max: 100)'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of channels to skip (default: 0)'),
  includeArchived: z
    .boolean()
    .default(false)
    .describe('Include archived channels (default: false)'),
});

export type ListChannelsInput = z.infer<typeof ListChannelsInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
  memberCount: number;
  messageCount: number;
  unreadCount: number;
  isStarred: boolean;
  lastMessage: {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    author: {
      id: string;
      name: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      isOrchestrator: boolean;
    };
  } | null;
  userMembership: {
    role: string;
    joinedAt: string;
    lastReadAt: string | null;
    hasUnread: boolean;
  } | null;
}

interface ListChannelsOutput {
  channels: Channel[];
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * List channels in a workspace
 *
 * @param input - List channels input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns List of channels with pagination
 */
export async function listChannelsHandler(
  input: ListChannelsInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<ListChannelsOutput>> {
  try {
    // Validate input
    const validated = ListChannelsInputSchema.parse(input);

    // Build query parameters
    const params = new URLSearchParams();
    if (validated.type) params.append('type', validated.type);
    params.append('limit', validated.limit.toString());
    params.append('offset', validated.offset.toString());
    params.append('includeArchived', validated.includeArchived.toString());

    // Make API request
    const url = `${apiBaseUrl}/api/workspaces/${validated.workspaceSlug}/channels?${params.toString()}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || `Failed to list channels: ${response.statusText}`,
        errorDetails: {
          code: responseData.error?.code || 'API_ERROR',
          message: responseData.error?.message || response.statusText,
          context: { status: response.status },
        },
      };
    }

    return {
      success: true,
      data: {
        channels: responseData.data,
        pagination: responseData.pagination,
      },
      message: `Found ${responseData.pagination.totalCount} channel(s)`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

export const listChannelsTool = {
  name: 'list_channels',
  description: 'List channels in a Neolith workspace with filtering and pagination',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID',
      },
      type: {
        type: 'string',
        enum: ['PUBLIC', 'PRIVATE', 'DM', 'HUDDLE'],
        description: 'Filter by channel type',
      },
      limit: {
        type: 'number',
        description: 'Number of channels to return (default: 50, max: 100)',
        default: 50,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Number of channels to skip (default: 0)',
        default: 0,
        minimum: 0,
      },
      includeArchived: {
        type: 'boolean',
        description: 'Include archived channels (default: false)',
        default: false,
      },
    },
    required: ['workspaceSlug'],
  },
  handler: listChannelsHandler,
} as const;
