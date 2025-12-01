/**
 * File Search Tool
 *
 * Searches specifically for files within a Neolith workspace with
 * file-specific filters like MIME type, size, and channel.
 *
 * @module @wundr/neolith-mcp-server/tools/search/file-search
 */

import { z } from 'zod';
import type { NeolithApiClient } from '@/lib/api-client';

// =============================================================================
// Input Schema
// =============================================================================

/**
 * Zod schema for file search input validation
 */
export const FileSearchSchema = z.object({
  /** Workspace slug or ID to search within */
  workspaceSlug: z.string().min(1, 'Workspace slug is required'),

  /** Search query string (matches filename or original name) */
  query: z.string().min(1, 'Search query is required'),

  /** Filter by channel ID or name */
  in: z.string().optional(),

  /** Filter by uploader user ID or username */
  from: z.string().optional(),

  /** Filter by MIME type (e.g., 'image/png', 'application/pdf') */
  mimeType: z.string().optional(),

  /** Filter by file type category (image, video, document, etc.) */
  fileType: z.enum([
    'image',
    'video',
    'audio',
    'document',
    'spreadsheet',
    'presentation',
    'archive',
    'code',
    'other',
  ]).optional(),

  /** Filter by minimum file size in bytes */
  minSize: z.number().int().min(0).optional(),

  /** Filter by maximum file size in bytes */
  maxSize: z.number().int().min(0).optional(),

  /** Filter by date range (ISO date string or relative like '7d', '1m') */
  during: z.string().optional(),

  /** Number of results per page (default: 20, max: 100) */
  limit: z.number().int().min(1).max(100).optional().default(20),

  /** Pagination offset (default: 0) */
  offset: z.number().int().min(0).optional().default(0),

  /** Enable result highlighting (default: true) */
  highlight: z.boolean().optional().default(true),
});

export type FileSearchInput = z.infer<typeof FileSearchSchema>;

// =============================================================================
// Response Types
// =============================================================================

/**
 * File search result item
 */
export interface FileResultItem {
  type: 'file';
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  uploadedById: string;
  uploaderName: string | null;
  channelId?: string;
  channelName?: string;
  createdAt: string;
  highlighted?: {
    filename?: string;
    originalName?: string;
  };
}

/**
 * File search response
 */
export interface FileSearchResponse {
  data: FileResultItem[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
}

/**
 * MCP tool result for file search
 */
export interface FileSearchResult {
  success: boolean;
  message: string;
  data?: {
    files: FileResultItem[];
    totalCount: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    query: string;
    filters?: {
      in?: string;
      from?: string;
      mimeType?: string;
      fileType?: string;
      minSize?: number;
      maxSize?: number;
      during?: string;
    };
  };
  error?: string;
}

// =============================================================================
// Tool Handler
// =============================================================================

/**
 * Execute file-specific search within workspace
 *
 * @param input - File search parameters with filters
 * @param apiClient - Neolith API client for making authenticated requests
 * @returns File search results with pagination
 */
export async function fileSearchHandler(
  input: FileSearchInput,
  apiClient: NeolithApiClient,
): Promise<FileSearchResult> {
  try {
    const {
      workspaceSlug,
      query,
      in: inChannel,
      from,
      mimeType,
      fileType,
      minSize,
      maxSize,
      during,
      limit,
      offset,
      highlight,
    } = FileSearchSchema.parse(input);

    // Build query parameters
    const params: Record<string, string | number | boolean> = {
      q: query,
      type: 'files', // Force file-only search
      limit,
      offset,
      highlight,
    };

    // Add optional filters
    if (inChannel) params.in = inChannel;
    if (from) params.from = from;
    if (mimeType) params.mimeType = mimeType;
    if (fileType) params.fileType = fileType;
    if (minSize !== undefined) params.minSize = minSize;
    if (maxSize !== undefined) params.maxSize = maxSize;
    if (during) params.during = during;

    // Make API request
    const response = await apiClient.get<FileSearchResponse>(
      `/api/workspaces/${workspaceSlug}/search`,
      params,
    );

    // Extract results and pagination from response.data
    const files = response.data?.data || [];
    const pagination = response.data?.pagination || {
      offset: 0,
      limit: 20,
      totalCount: 0,
      hasMore: false,
    };

    // Format file sizes for display
    const formattedFiles = files.map((file: FileResultItem) => ({
      ...file,
      sizeFormatted: formatFileSize(file.size),
    }));

    return {
      success: true,
      message: `Found ${pagination.totalCount} file(s) matching "${query}"`,
      data: {
        files: formattedFiles,
        totalCount: pagination.totalCount,
        offset: pagination.offset,
        limit: pagination.limit,
        hasMore: pagination.hasMore,
        query,
        filters: {
          in: inChannel,
          from,
          mimeType,
          fileType,
          minSize,
          maxSize,
          during,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: 'File search failed',
      error: errorMessage,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format file size in bytes to human-readable format
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * MCP tool definition for file search
 */
export const fileSearchTool = {
  name: 'neolith_file_search',
  description: 'Search specifically for files within a Neolith workspace with file-specific filters like MIME type, size range, uploader, and channel',
  inputSchema: {
    type: 'object',
    properties: {
      workspaceSlug: {
        type: 'string',
        description: 'Workspace slug or ID to search within',
      },
      query: {
        type: 'string',
        description: 'Search query string to match in filename or original name',
      },
      in: {
        type: 'string',
        description: 'Filter by channel ID or name where file was uploaded (e.g., "channel_456" or "#general")',
      },
      from: {
        type: 'string',
        description: 'Filter by uploader user ID or username (e.g., "user_123" or "@john")',
      },
      mimeType: {
        type: 'string',
        description: 'Filter by specific MIME type (e.g., "image/png", "application/pdf")',
      },
      fileType: {
        type: 'string',
        enum: ['image', 'video', 'audio', 'document', 'spreadsheet', 'presentation', 'archive', 'code', 'other'],
        description: 'Filter by file type category',
      },
      minSize: {
        type: 'number',
        description: 'Minimum file size in bytes',
        minimum: 0,
      },
      maxSize: {
        type: 'number',
        description: 'Maximum file size in bytes',
        minimum: 0,
      },
      during: {
        type: 'string',
        description: 'Filter by date range when file was uploaded (ISO date or relative like "7d", "1m")',
      },
      limit: {
        type: 'number',
        description: 'Number of results per page (default: 20, max: 100)',
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset for fetching additional pages (default: 0)',
        default: 0,
        minimum: 0,
      },
      highlight: {
        type: 'boolean',
        description: 'Enable search term highlighting in results (default: true)',
        default: true,
      },
    },
    required: ['workspaceSlug', 'query'],
  },
};
