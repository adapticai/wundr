/**
 * Get File Info Tool
 *
 * MCP tool for retrieving detailed file metadata from Neolith.
 *
 * @module neolith-mcp-server/tools/files/get-file-info
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, FileMetadata } from './types';

/**
 * Input schema for get file info tool
 */
export const GetFileInfoInputSchema = z.object({
  fileId: z.string().describe('File ID to retrieve'),
});

export type GetFileInfoInput = z.infer<typeof GetFileInfoInputSchema>;

/**
 * Get File Info Handler
 *
 * Retrieves detailed metadata for a specific file.
 * Requires authentication and access to the file's workspace.
 *
 * @param input - Get file info parameters
 * @param client - Neolith API client instance
 * @returns File metadata
 */
export async function getFileInfoHandler(
  input: GetFileInfoInput,
  client: NeolithApiClient,
): Promise<McpToolResult<FileMetadata>> {
  try {
    // Validate input
    const validationResult = GetFileInfoInputSchema.safeParse(input);
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

    // Get file info from API
    const response = await client.get<FileMetadata>(
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
        error: 'No file data returned',
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
      message: 'File information retrieved successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Get file info failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * MCP Tool definition for get file info
 */
export const getFileInfoTool = {
  name: 'neolith_get_file_info',
  description: 'Get detailed metadata for a specific Neolith file including size, type, uploader, workspace, and URLs.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      fileId: {
        type: 'string',
        description: 'File ID to retrieve',
      },
    },
    required: ['fileId'],
  },
  category: 'files',
};
