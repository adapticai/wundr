/**
 * Delete File Tool
 *
 * MCP tool for deleting files from Neolith workspace.
 *
 * @module neolith-mcp-server/tools/files/delete-file
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, FileDeletionResponse } from './types';

/**
 * Input schema for delete file tool
 */
export const DeleteFileInputSchema = z.object({
  fileId: z.string().describe('File ID to delete'),
});

export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;

/**
 * Delete File Handler
 *
 * Deletes a file from Neolith.
 * Only the file uploader or workspace admins can delete files.
 * Deletes associated saved items and soft-deletes messages containing the file.
 *
 * @param input - Delete file parameters
 * @param client - Neolith API client instance
 * @returns Deletion confirmation
 */
export async function deleteFileHandler(
  input: DeleteFileInput,
  client: NeolithApiClient,
): Promise<McpToolResult<FileDeletionResponse>> {
  try {
    // Validate input
    const validationResult = DeleteFileInputSchema.safeParse(input);
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

    // Delete file via API
    const response = await client.delete<FileDeletionResponse>(
      `/api/files/${validInput.fileId}`,
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

    if (!response.data) {
      return {
        success: false,
        error: 'No deletion confirmation returned',
        errorDetails: {
          code: 'MISSING_DATA',
          message: 'API response missing data',
        },
      };
    }

    // Return successful result
    return {
      success: true,
      data: response.data,
      message: response.data.message || 'File deleted successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Delete file failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * MCP Tool definition for delete file
 */
export const deleteFileTool = {
  name: 'neolith_delete_file',
  description: 'Delete a file from Neolith workspace. Only the uploader or workspace admins can delete files. Deletes associated saved items and soft-deletes messages containing the file.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      fileId: {
        type: 'string',
        description: 'File ID to delete',
      },
    },
    required: ['fileId'],
  },
  category: 'files',
};
