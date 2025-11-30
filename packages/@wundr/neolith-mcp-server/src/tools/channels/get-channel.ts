/**
 * Get Channel Tool
 *
 * MCP tool for retrieving a specific channel by ID
 *
 * @module tools/channels/get-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const GetChannelInputSchema = z.object({
  channelId: z.string().describe('Channel ID'),
});

export type GetChannelInput = z.infer<typeof GetChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface ChannelDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  createdById: string;
  creator: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isOrchestrator: boolean;
  };
  memberCount: number;
  messageCount: number;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Get channel details by ID
 *
 * @param input - Get channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Channel details
 */
export async function getChannelHandler(
  input: GetChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<ChannelDetails>> {
  try {
    // Validate input
    const validated = GetChannelInputSchema.parse(input);

    // Make API request
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}`;
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
        error: responseData.error?.message || `Failed to get channel: ${response.statusText}`,
        errorDetails: {
          code: responseData.error?.code || 'API_ERROR',
          message: responseData.error?.message || response.statusText,
          context: { status: response.status },
        },
      };
    }

    return {
      success: true,
      data: responseData.data || responseData,
      message: `Retrieved channel: ${responseData.data?.name || responseData.name}`,
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

export const getChannelTool = {
  name: 'get_channel',
  description: 'Get detailed information about a specific Neolith channel',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID',
      },
    },
    required: ['channelId'],
  },
  handler: getChannelHandler,
} as const;
