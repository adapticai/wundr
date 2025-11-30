/**
 * Get Channel Members Tool
 *
 * MCP tool for listing members of a channel
 *
 * @module tools/channels/get-channel-members
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const GetChannelMembersInputSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe('Number of members to return (default: 50, max: 100)'),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of members to skip (default: 0)'),
});

export type GetChannelMembersInput = z.infer<typeof GetChannelMembersInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface ChannelMember {
  id: string;
  channelId: string;
  userId: string;
  role: string;
  joinedAt: string;
  lastReadAt: string | null;
  isStarred: boolean;
  notificationPreference: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    isOrchestrator: boolean;
    status: string;
  };
}

interface GetChannelMembersOutput {
  members: ChannelMember[];
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
 * Get channel members with pagination
 *
 * @param input - Get channel members input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns List of channel members
 */
export async function getChannelMembersHandler(
  input: GetChannelMembersInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<GetChannelMembersOutput>> {
  try {
    // Validate input
    const validated = GetChannelMembersInputSchema.parse(input);

    // Build query parameters
    const params = new URLSearchParams();
    params.append('limit', validated.limit.toString());
    params.append('offset', validated.offset.toString());

    // Make API request
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}/members?${params.toString()}`;
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
        error:
          responseData.error?.message || `Failed to get channel members: ${response.statusText}`,
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
        members: responseData.data || responseData.members || [],
        pagination: responseData.pagination || {
          limit: validated.limit,
          offset: validated.offset,
          totalCount: responseData.data?.length || 0,
          hasMore: false,
        },
      },
      message: `Found ${responseData.pagination?.totalCount || responseData.data?.length || 0} member(s)`,
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

export const getChannelMembersTool = {
  name: 'get_channel_members',
  description: 'List members of a Neolith channel with pagination',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID',
      },
      limit: {
        type: 'number',
        description: 'Number of members to return (default: 50, max: 100)',
        default: 50,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Number of members to skip (default: 0)',
        default: 0,
        minimum: 0,
      },
    },
    required: ['channelId'],
  },
  handler: getChannelMembersHandler,
} as const;
