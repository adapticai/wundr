/**
 * Download File Tool
 *
 * MCP tool for generating download URLs for files in Neolith.
 *
 * @module neolith-mcp-server/tools/files/download-file
 */

import { z } from 'zod';
import { writeFile } from 'fs/promises';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, DownloadUrlResponse } from './types';

/**
 * Input schema for download file tool
 */
export const DownloadFileInputSchema = z.object({
  fileId: z.string().describe('File ID to download'),
  expiresIn: z.number().int().min(1).max(86400).optional().default(3600)
    .describe('URL expiration time in seconds (default: 3600, max: 86400)'),
  download: z.boolean().optional().default(true)
    .describe('Force download vs inline viewing'),
  savePath: z.string().optional()
    .describe('Optional local path to save downloaded file'),
});

export type DownloadFileInput = z.infer<typeof DownloadFileInputSchema>;

/**
 * Download File Handler
 *
 * Generates a presigned download URL for a file.
 * Optionally downloads the file to local filesystem.
 *
 * @param input - Download file parameters
 * @param client - Neolith API client instance
 * @returns Download URL and file metadata
 */
export async function downloadFileHandler(
  input: DownloadFileInput,
  client: NeolithApiClient,
): Promise<McpToolResult<DownloadUrlResponse & { savedTo?: string }>> {
  try {
    // Validate input
    const validationResult = DownloadFileInputSchema.safeParse(input);
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
    const query: Record<string, string | number | boolean> = {
      expiresIn: validInput.expiresIn,
      download: validInput.download,
    };

    // Get download URL from API
    const response = await client.get<DownloadUrlResponse>(
      `/api/files/${validInput.fileId}/download`,
      { query },
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
        error: 'No download URL returned',
        errorDetails: {
          code: 'MISSING_DATA',
          message: 'API response missing data',
        },
      };
    }

    // If savePath provided, download the file
    let savedTo: string | undefined;
    if (validInput.savePath && response.data.url) {
      try {
        const fileResponse = await fetch(response.data.url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download file: ${fileResponse.statusText}`);
        }

        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(validInput.savePath, buffer);
        savedTo = validInput.savePath;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to save file: ${errorMessage}`,
          errorDetails: {
            code: 'FILE_SAVE_ERROR',
            message: errorMessage,
            context: { savePath: validInput.savePath },
          },
        };
      }
    }

    // Return successful result
    return {
      success: true,
      data: {
        ...response.data,
        savedTo,
      },
      message: savedTo
        ? `File download URL generated and saved to ${savedTo}`
        : 'File download URL generated successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Download file failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * MCP Tool definition for download file
 */
export const downloadFileTool = {
  name: 'neolith_download_file',
  description: 'Generate a presigned download URL for a Neolith file. Optionally download the file to local filesystem.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      fileId: {
        type: 'string',
        description: 'File ID to download',
      },
      expiresIn: {
        type: 'number',
        description: 'URL expiration time in seconds (default: 3600, max: 86400)',
        default: 3600,
      },
      download: {
        type: 'boolean',
        description: 'Force download vs inline viewing',
        default: true,
      },
      savePath: {
        type: 'string',
        description: 'Optional local path to save downloaded file',
      },
    },
    required: ['fileId'],
  },
  category: 'files',
};
