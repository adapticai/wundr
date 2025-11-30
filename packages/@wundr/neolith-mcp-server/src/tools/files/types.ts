/**
 * File Tools Type Definitions
 *
 * Type definitions for Neolith file management MCP tools.
 *
 * @module neolith-mcp-server/tools/files/types
 */

/**
 * File metadata from Neolith API
 */
export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR';
  metadata: Record<string, unknown>;
  uploadedById: string;
  workspaceId: string;
  createdAt: string;
  updatedAt?: string;
  url?: string;
  uploadedBy?: {
    id: string;
    name: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  workspace?: {
    id: string;
    name: string;
  };
}

/**
 * File list response
 */
export interface FileListResponse {
  data: FileMetadata[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}

/**
 * Upload initiation response
 */
export interface UploadInitResponse {
  uploadUrl: string;
  s3Key: string;
  s3Bucket: string;
  fields: Record<string, string>;
  expiresAt: Date | string;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  file: FileMetadata;
}

/**
 * Download URL response
 */
export interface DownloadUrlResponse {
  url: string;
  expiresAt: string | null;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * File share response
 */
export interface FileShareResponse {
  success: boolean;
  channelId: string;
  messageId?: string;
}

/**
 * File deletion response
 */
export interface FileDeletionResponse {
  message: string;
  deletedMessageCount: number;
}

/**
 * MCP Tool Result wrapper
 */
export interface McpToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errorDetails?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}
