/**
 * Archive Channel Tool
 *
 * MCP tool for archiving or unarchiving a channel
 *
 * @module tools/channels/archive-channel
 */

import { z } from 'zod';
import type { McpToolResult } from '../../types/common';
import { successResult, errorResult } from '../../types/common';

// ============================================================================
// Schema
// ============================================================================

export const ArchiveChannelInputSchema = z.object({
  channelId: z.string().describe('Channel ID'),
  archive: z
    .boolean()
    .default(true)
    .describe('Archive (true) or unarchive (false) the channel'),
});

export type ArchiveChannelInput = z.infer<typeof ArchiveChannelInputSchema>;

// ============================================================================
// Types
// ============================================================================

interface ArchivedChannel {
  id: string;
  name: string;
  isArchived: boolean;
  updatedAt: string;
}

// ============================================================================
// Tool Handler
// ============================================================================

/**
 * Archive or unarchive a channel
 *
 * @param input - Archive channel input
 * @param apiBaseUrl - Neolith API base URL (default: http://localhost:3000)
 * @param authToken - Authentication token
 * @returns Updated channel archive status
 */
export async function archiveChannelHandler(
  input: ArchiveChannelInput,
  apiBaseUrl = 'http://localhost:3000',
  authToken?: string,
): Promise<McpToolResult<ArchivedChannel>> {
  try {
    // Validate input
    const validated = ArchiveChannelInputSchema.parse(input);

    // Make API request - this endpoint might be a POST to /archive or PATCH to the channel
    // Using the archive endpoint pattern
    const url = `${apiBaseUrl}/api/channels/${validated.channelId}/archive`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const body = {
      archive: validated.archive,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error:
          responseData.error?.message ||
          `Failed to ${validated.archive ? 'archive' : 'unarchive'} channel: ${response.statusText}`,
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
      message:
        responseData.message ||
        `Channel ${validated.archive ? 'archived' : 'unarchived'} successfully`,
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

export const archiveChannelTool = {
  name: 'archive_channel',
  description: 'Archive or unarchive a Neolith channel',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID',
      },
      archive: {
        type: 'boolean',
        description: 'Archive (true) or unarchive (false) the channel',
        default: true,
      },
    },
    required: ['channelId'],
  },
  handler: archiveChannelHandler,
} as const;
