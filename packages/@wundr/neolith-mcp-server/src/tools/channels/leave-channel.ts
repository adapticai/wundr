/**
 * Leave Channel Tool
 *
 * MCP tool for leaving a channel
 *
 * @module tools/channels/leave-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const LeaveChannelInputSchema = z.object({
  channelId: z.string().describe('Channel ID to leave'),
});

export type LeaveChannelInput = z.infer<typeof LeaveChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface LeaveChannelOutput {
  channelId: string;
  userId: string;
  leftAt: string;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Leave a channel
 *
 * @param input - Leave channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Confirmation of leaving the channel
 */
export async function leaveChannelHandler(
  input: LeaveChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<LeaveChannelOutput>> {
  try {
    // Validate input
    const validated = LeaveChannelInputSchema.parse(input);

    // Make API request
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}/leave`;
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
        error: responseData.error?.message || `Failed to leave channel: ${response.statusText}`,
        errorDetails: {
          code: responseData.error?.code || 'API_ERROR',
          message: responseData.error?.message || response.statusText,
          context: { status: response.status },
        },
      };
    }

    return {
      success: true,
      data: responseData.data || {
        channelId: validated.channelId,
        userId: 'current-user',
        leftAt: new Date().toISOString(),
      },
      message: responseData.message || 'Successfully left channel',
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

export const leaveChannelTool = {
  name: 'leave_channel',
  description: 'Leave a Neolith channel',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID to leave',
      },
    },
    required: ['channelId'],
  },
  handler: leaveChannelHandler,
} as const;
