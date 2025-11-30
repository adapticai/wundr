/**
 * Upload File Tool
 *
 * MCP tool for uploading files to Neolith workspace.
 *
 * @module neolith-mcp-server/tools/files/upload-file
 */

import { z } from 'zod';
import { readFile } from 'fs/promises';
import type { NeolithApiClient } from '../../client/neolith-api-client';
import type { McpToolResult, FileUploadResponse } from './types';

/**
 * Input schema for upload file tool
 */
export const UploadFileInputSchema = z.object({
  filePath: z.string().describe('Local file path to upload'),
  workspaceId: z.string().describe('Workspace ID to upload file to'),
  channelId: z.string().optional().describe('Optional channel ID to associate with upload'),
});

export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

/**
 * Upload File Handler
 *
 * Uploads a file from local filesystem to Neolith workspace.
 * Uses multipart/form-data for file upload.
 *
 * @param input - Upload file parameters
 * @param client - Neolith API client instance
 * @returns Uploaded file metadata
 */
export async function uploadFileHandler(
  input: UploadFileInput,
  client: NeolithApiClient,
): Promise<McpToolResult<FileUploadResponse>> {
  try {
    // Validate input
    const validationResult = UploadFileInputSchema.safeParse(input);
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

    // Read file from filesystem
    let fileBuffer: Buffer;
    let filename: string;
    try {
      fileBuffer = await readFile(validInput.filePath);
      filename = validInput.filePath.split('/').pop() || 'unnamed';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to read file: ${errorMessage}`,
        errorDetails: {
          code: 'FILE_READ_ERROR',
          message: errorMessage,
          context: { filePath: validInput.filePath },
        },
      };
    }

    // Detect MIME type (simplified version, you may want to use a library like 'file-type')
    const mimeType = detectMimeType(filename);

    // Create FormData
    const formData = new FormData();
    // Create Blob from ArrayBuffer for browser/Node.js compatibility
    // Use explicit ArrayBuffer cast to handle SharedArrayBuffer case
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('workspaceId', validInput.workspaceId);
    if (validInput.channelId) {
      formData.append('channelId', validInput.channelId);
    }

    // Upload file
    const response = await client.uploadFile<FileUploadResponse>('/api/files', formData);

    // Check for errors
    if (response.error) {
      return {
        success: false,
        error: response.error,
        errorDetails: response.errorDetails || {
          code: 'UPLOAD_ERROR',
          message: response.error,
        },
      };
    }

    // Return successful result
    return {
      success: true,
      data: response.data,
      message: response.message || 'File uploaded successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Upload file failed: ${errorMessage}`,
      errorDetails: {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      },
    };
  }
}

/**
 * Detect MIME type from filename extension
 */
function detectMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    // Archives
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * MCP Tool definition for upload file
 */
export const uploadFileTool = {
  name: 'neolith_upload_file',
  description: 'Upload a file from local filesystem to Neolith workspace. Supports images, documents, audio, video, and archives up to 5MB for direct upload.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      filePath: {
        type: 'string',
        description: 'Local file path to upload',
      },
      workspaceId: {
        type: 'string',
        description: 'Workspace ID to upload file to',
      },
      channelId: {
        type: 'string',
        description: 'Optional channel ID to associate with upload',
      },
    },
    required: ['filePath', 'workspaceId'],
  },
  category: 'files',
};
