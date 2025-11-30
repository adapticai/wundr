/**
 * List Files Tool
 *
 * MCP tool for listing files in a Neolith workspace with filtering and pagination.
 *
 * @module neolith-mcp-server/tools/files/list-files
 */

import { z } from 'zod';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, FileListResponse } from './types';

/**
 * Input schema for list files tool
 */
export const ListFilesInputSchema = z.object({
  workspaceId: z.string().optional().describe('Filter files by workspace ID'),
  type: z.enum(['image', 'document', 'audio', 'video', 'archive']).optional()
    .describe('Filter by file type category'),
  limit: z.number().int().positive().max(100).optional().default(20)
    .describe('Maximum number of files to return (max 100)'),
  cursor: z.string().optional().describe('Pagination cursor for next page'),
  sortBy: z.enum(['createdAt', 'size', 'filename']).optional().default('createdAt')
    .describe('Field to sort by'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
    .describe('Sort order'),
});

export type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

/**
 * List Files Handler
 *
 * Lists files accessible to the authenticated user with filtering and pagination.
 *
 * @param input - List files parameters
 * @param client - Neolith API client instance
 * @returns List of files with pagination info
 */
export async function listFilesHandler(
  input: ListFilesInput,
  client: NeolithApiClient,
): Promise<McpToolResult<FileListResponse>> {
  try {
    // Validate input
    const validationResult = ListFilesInputSchema.safeParse(input);
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

    // Build query parameters
    const query: Record<string, string | number | boolean | undefined> = {
      workspaceId: validInput.workspaceId,
      type: validInput.type,
      limit: validInput.limit,
      cursor: validInput.cursor,
      sortBy: validInput.sortBy,
      sortOrder: validInput.sortOrder,
    };

    // Make API request
    const response = await client.get<FileListResponse>('/api/files', { query });

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
      data: response.data,
      message: `Retrieved ${response.data?.data.length || 0} files`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `List files failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * MCP Tool definition for list files
 */
export const listFilesTool = {
  name: 'neolith_list_files',
  description: 'List files in Neolith workspace with filtering and pagination. Returns files accessible to the authenticated user.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      workspaceId: {
        type: 'string',
        description: 'Filter files by workspace ID (optional)',
      },
      type: {
        type: 'string',
        enum: ['image', 'document', 'audio', 'video', 'archive'],
        description: 'Filter by file type category',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of files to return (default: 20, max: 100)',
        default: 20,
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor for next page',
      },
      sortBy: {
        type: 'string',
        enum: ['createdAt', 'size', 'filename'],
        description: 'Field to sort by (default: createdAt)',
        default: 'createdAt',
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order (default: desc)',
        default: 'desc',
      },
    },
  },
  category: 'files',
};
