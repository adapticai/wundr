/**
 * Join Channel Tool
 *
 * MCP tool for joining a public channel
 *
 * @module tools/channels/join-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const JoinChannelInputSchema = z.object({
  channelId: z.string().describe('Channel ID to join'),
});

export type JoinChannelInput = z.infer<typeof JoinChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface ChannelMembership {
  id: string;
  channelId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Join a public channel
 *
 * @param input - Join channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Channel membership details
 */
export async function joinChannelHandler(
  input: JoinChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<ChannelMembership>> {
  try {
    // Validate input
    const validated = JoinChannelInputSchema.parse(input);

    // Make API request
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}/join`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || `Failed to join channel: ${response.statusText}`,
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
      message: responseData.message || 'Successfully joined channel',
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

export const joinChannelTool = {
  name: 'join_channel',
  description: 'Join a public Neolith channel',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID to join',
      },
    },
    required: ['channelId'],
  },
  handler: joinChannelHandler,
} as const;
