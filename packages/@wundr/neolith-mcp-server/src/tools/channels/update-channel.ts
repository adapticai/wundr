/**
 * Update Channel Tool
 *
 * MCP tool for updating channel settings
 *
 * @module tools/channels/update-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const UpdateChannelInputSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  name: z
    .string()
    .min(1)
    .max(80)
    .optional()
    .describe('New channel name (max 80 characters)'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('New channel description (max 500 characters)'),
  topic: z
    .string()
    .max(250)
    .optional()
    .describe('New channel topic (max 250 characters)'),
  isArchived: z
    .boolean()
    .optional()
    .describe('Archive or unarchive the channel'),
});

export type UpdateChannelInput = z.infer<typeof UpdateChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface UpdatedChannel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  type: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Update channel settings
 *
 * @param input - Update channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Updated channel details
 */
export async function updateChannelHandler(
  input: UpdateChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<UpdatedChannel>> {
  try {
    // Validate input
    const validated = UpdateChannelInputSchema.parse(input);

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {};
    if (validated.name !== undefined) updates.name = validated.name;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.topic !== undefined) updates.topic = validated.topic;
    if (validated.isArchived !== undefined) updates.isArchived = validated.isArchived;

    // Make API request
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.error?.message || `Failed to update channel: ${response.statusText}`,
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
      message: responseData.message || 'Channel updated successfully',
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

export const updateChannelTool = {
  name: 'update_channel',
  description: 'Update channel settings including name, description, topic, and archive status',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID',
      },
      name: {
        type: 'string',
        description: 'New channel name (max 80 characters)',
        minLength: 1,
        maxLength: 80,
      },
      description: {
        type: 'string',
        description: 'New channel description (max 500 characters)',
        maxLength: 500,
      },
      topic: {
        type: 'string',
        description: 'New channel topic (max 250 characters)',
        maxLength: 250,
      },
      isArchived: {
        type: 'boolean',
        description: 'Archive or unarchive the channel',
      },
    },
    required: ['channelId'],
  },
  handler: updateChannelHandler,
} as const;
