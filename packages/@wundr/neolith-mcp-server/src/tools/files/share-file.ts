/**
 * Share File Tool
 *
 * MCP tool for sharing files to Neolith channels.
 *
 * @module neolith-mcp-server/tools/files/share-file
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, FileShareResponse } from './types';

/**
 * Input schema for share file tool
 */
export const ShareFileInputSchema = z.object({
  fileId: z.string().describe('File ID to share'),
  channelId: z.string().describe('Channel ID to share file to'),
  message: z.string().optional().describe('Optional message to accompany the file'),
});

export type ShareFileInput = z.infer<typeof ShareFileInputSchema>;

/**
 * Share File Handler
 *
 * Shares a file to a Neolith channel by creating a message with the file attached.
 *
 * @param input - Share file parameters
 * @param client - Neolith API client instance
 * @returns Share confirmation with message ID
 */
export async function shareFileHandler(
  input: ShareFileInput,
  client: NeolithApiClient,
): Promise<McpToolResult<FileShareResponse>> {
  try {
    // Validate input
    const validationResult = ShareFileInputSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: 'Input validation failed',
        errorDetails: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          context: { issues: validationResult.error.issues },
        },
      };
    }

    const validInput = validationResult.data;

    // Create a message in the channel with the file attached
    // This uses the messages API endpoint
    const messageBody = {
      content: validInput.message || '',
      fileIds: [validInput.fileId],
    };

    const response = await client.post<{ id: string }>(
      `/api/channels/${validInput.channelId}/messages`,
      messageBody,
    );

    // Check for errors
    if (response.error) {
      return {
        success: false,
        error: response.error,
        errorDetails: response.errorDetails || {
          code: 'API_ERROR',
          message: response.error,
        },
      };
    }

    // Return successful result
    return {
      success: true,
      data: {
        success: true,
        channelId: validInput.channelId,
        messageId: response.data?.id,
      },
      message: `File shared to channel successfully`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Share file failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * MCP Tool definition for share file
 */
export const shareFileTool = {
  name: 'neolith_share_file',
  description: 'Share a file to a Neolith channel by creating a message with the file attached.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      fileId: {
        type: 'string',
        description: 'File ID to share',
      },
      channelId: {
        type: 'string',
        description: 'Channel ID to share file to',
      },
      message: {
        type: 'string',
        description: 'Optional message to accompany the file',
      },
    },
    required: ['fileId', 'channelId'],
  },
  category: 'files',
};
