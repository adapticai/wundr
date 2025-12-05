/**
 * Upload Validation Schemas
 * @module lib/validations/upload
 */

import { z } from 'zod';

export const UPLOAD_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  FILE_NOT_IN_STORAGE: 'FILE_NOT_IN_STORAGE',
  FILE_NOT_READY: 'FILE_NOT_READY',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  INVALID_PART: 'INVALID_PART',
  PART_MISSING: 'PART_MISSING',
  UPLOAD_EXPIRED: 'UPLOAD_EXPIRED',
} as const;

export type UploadErrorCode =
  (typeof UPLOAD_ERROR_CODES)[keyof typeof UPLOAD_ERROR_CODES];

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MULTIPART_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB
export const MAX_PARTS = 10000; // Maximum number of parts for multipart upload

export const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
];

export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  archive: [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
  ],
} as const;

export type FileCategory = keyof typeof ALLOWED_FILE_TYPES;

export const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().max(MAX_FILE_SIZE),
});

export type UploadInput = z.infer<typeof uploadSchema>;

// Multipart upload schemas
export const multipartInitSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string(),
  size: z.number().max(MAX_FILE_SIZE),
  workspaceId: z.string().min(1),
  parts: z.number().min(1).max(MAX_PARTS),
});

export type MultipartInitInput = z.infer<typeof multipartInitSchema>;

export const uploadInitSchemaRefined = uploadSchema
  .extend({
    workspaceId: z.string().min(1),
    channelId: z.string().optional(),
    filename: z.string().min(1).max(255),
    contentType: z.string(),
    size: z.number().positive(),
  })
  .refine(
    data => allowedMimeTypes.includes(data.mimeType || data.contentType),
    {
      message: 'Invalid file type',
      path: ['mimeType'],
    },
  );

export type UploadInitInput = z.infer<typeof uploadInitSchemaRefined>;

export const partUrlSchema = z.object({
  partNumber: z.number().min(1).max(MAX_PARTS),
});

export type PartUrlInput = z.infer<typeof partUrlSchema>;

export const multipartCompleteSchema = z.object({
  workspaceId: z.string().min(1),
  parts: z.array(
    z.object({
      partNumber: z.number().min(1).max(MAX_PARTS),
      eTag: z.string(),
    }),
  ),
  metadata: z.record(z.unknown()).optional(),
});

export type MultipartCompleteInput = z.infer<typeof multipartCompleteSchema>;

export const uploadCompleteSchema = z.object({
  s3Key: z.string(),
  workspaceId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;

// Image processing schema
export const imageProcessSchema = z.object({
  fileId: z.string(),
  width: z.number().min(1).max(4096).optional(),
  height: z.number().min(1).max(4096).optional(),
  quality: z.number().min(1).max(100).optional(),
  format: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
  operations: z.array(z.unknown()).optional(),
  outputFormat: z.enum(['jpeg', 'png', 'webp', 'avif']).optional(),
});

export type ImageProcessInput = z.infer<typeof imageProcessSchema>;

export interface ImageOperation {
  type: string;
  [key: string]: unknown;
}

// Param schemas
export const uploadIdParamSchema = z.object({
  uploadId: z.string(),
});

export const fileIdParamSchema = z.object({
  fileId: z.string(),
});

export const imageIdParamSchema = z.object({
  imageId: z.string(),
});

// List schemas
export const workspaceFilesSchema = z.object({
  workspaceId: z.string(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  category: z
    .enum(['image', 'video', 'audio', 'document', 'archive'])
    .optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'archive']).optional(),
  cursor: z.string().optional(),
  channelId: z.string().uuid().optional(),
});

export type WorkspaceFilesInput = z.infer<typeof workspaceFilesSchema>;

export const fileListSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  workspaceId: z.string().optional(),
  type: z.enum(['image', 'video', 'audio', 'document', 'archive']).optional(),
  cursor: z.string().optional(),
  sortBy: z
    .enum(['createdAt', 'size', 'filename'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type FileListInput = z.infer<typeof fileListSchema>;

// Response types
export interface UploadInitResponse {
  uploadUrl: string;
  s3Key: string;
  s3Bucket: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface MultipartInitResponse {
  uploadId: string;
  s3Key: string;
  s3Bucket: string;
  expiresAt: Date;
}

export interface PartUrlResponse {
  uploadUrl: string;
  partNumber: number;
  expiresAt: Date;
}

export interface ImageVariant {
  id: string;
  name?: string;
  width: number;
  height: number;
  format: string;
  size?: number;
  url: string;
}

export function createUploadErrorResponse(
  code: UploadErrorCode,
  message: string,
  status: number = 400,
): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Generic error response creator
 * Can be called as:
 * - createErrorResponse(message, status) - where status is a number
 * - createErrorResponse(message, code) - where code is an error code string
 * - createErrorResponse(message, code, details) - with additional error details
 */
export function createErrorResponse(
  message: string,
  codeOrStatus: UploadErrorCode | number = 400,
  details?: Record<string, unknown>,
):
  | { error: string; message: string; details?: Record<string, unknown> }
  | { error: string } {
  if (typeof codeOrStatus === 'number') {
    return { error: message };
  }
  return { error: codeOrStatus, message, ...(details ? { details } : {}) };
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
  return allowedMimeTypes.includes(mimeType);
}

/**
 * Get file category from mime type
 */
export function getFileCategory(mimeType: string): FileCategory | null {
  for (const [category, types] of Object.entries(ALLOWED_FILE_TYPES)) {
    if ((types as readonly string[]).includes(mimeType)) {
      return category as FileCategory;
    }
  }
  return null;
}

/**
 * Get maximum file size for a given category or mime type
 */
export function getMaxFileSize(
  categoryOrMimeType?: FileCategory | string,
): number {
  // If it's a mime type, convert to category first
  let category: FileCategory | null = null;
  if (typeof categoryOrMimeType === 'string') {
    // Check if it's already a category
    if (
      categoryOrMimeType === 'image' ||
      categoryOrMimeType === 'video' ||
      categoryOrMimeType === 'audio' ||
      categoryOrMimeType === 'document' ||
      categoryOrMimeType === 'archive'
    ) {
      category = categoryOrMimeType;
    } else {
      // Assume it's a mime type
      category = getFileCategory(categoryOrMimeType);
    }
  } else {
    category = categoryOrMimeType ?? null;
  }

  // Different categories can have different limits
  switch (category) {
    case 'image':
      return 10 * 1024 * 1024; // 10MB
    case 'video':
      return 100 * 1024 * 1024; // 100MB
    case 'audio':
      return 50 * 1024 * 1024; // 50MB
    case 'document':
      return 25 * 1024 * 1024; // 25MB
    case 'archive':
      return 50 * 1024 * 1024; // 50MB
    default:
      return MAX_FILE_SIZE;
  }
}

/**
 * Generate a file URL from storage key
 */
export function generateFileUrl(
  storageKey: string,
  options?: { expires?: number; download?: boolean } | string,
): string {
  const baseUrl = process.env.FILE_STORAGE_URL ?? '/api/files';
  const params = new URLSearchParams();

  // Handle string parameter (legacy support)
  if (typeof options === 'string') {
    // If a string is passed, treat it as part of the storage key or ignore
    // This maintains backward compatibility
    return `${baseUrl}/${storageKey}`;
  }

  // Handle options object
  if (options?.expires) {
    params.set('expires', String(options.expires));
  }
  if (options?.download) {
    params.set('download', 'true');
  }
  const queryString = params.toString();
  return `${baseUrl}/${storageKey}${queryString ? `?${queryString}` : ''}`;
}
