/**
 * @genesis/core - Storage Types
 *
 * Type definitions for S3-compatible storage operations.
 * Supports AWS S3, Cloudflare R2, and MinIO.
 *
 * @packageDocumentation
 */

import type { Readable } from 'stream';

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported S3-compatible storage providers.
 */
export type StorageProvider = 's3' | 'r2' | 'minio';

/**
 * Access control list options for uploaded files.
 */
export type StorageACL = 'private' | 'public-read';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Storage service configuration.
 */
export interface StorageConfig {
  /** Storage provider type */
  provider: StorageProvider;

  /** S3 bucket name */
  bucket: string;

  /** AWS region (e.g., 'us-east-1') */
  region: string;

  /** Custom endpoint URL for R2/MinIO */
  endpoint?: string;

  /** AWS credentials */
  credentials: StorageCredentials;

  /** Base URL for public file access */
  publicUrlBase?: string;

  /** Force path-style URLs (required for MinIO) */
  forcePathStyle?: boolean;

  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number;

  /** Allowed MIME types (empty array allows all) */
  allowedMimeTypes?: string[];

  /** Default ACL for uploaded files */
  defaultACL?: StorageACL;

  /** Presigned URL expiration in seconds (default: 3600) */
  signedUrlExpiration?: number;
}

/**
 * AWS/S3 credentials.
 */
export interface StorageCredentials {
  /** AWS access key ID */
  accessKeyId: string;

  /** AWS secret access key */
  secretAccessKey: string;

  /** Optional session token for temporary credentials */
  sessionToken?: string;
}

// =============================================================================
// Upload Types
// =============================================================================

/**
 * Input for file upload operations.
 */
export interface UploadInput {
  /** File content as Buffer or ReadableStream */
  file: Buffer | Readable;

  /** S3 object key (path in bucket) */
  key: string;

  /** MIME content type */
  contentType: string;

  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;

  /** Access control level */
  acl?: StorageACL;

  /** Cache-Control header value */
  cacheControl?: string;

  /** Content-Disposition header value */
  contentDisposition?: string;
}

/**
 * Options for URL-based uploads.
 */
export interface UploadOptions {
  /** Target S3 object key */
  key?: string;

  /** Override content type */
  contentType?: string;

  /** Custom metadata */
  metadata?: Record<string, string>;

  /** Access control level */
  acl?: StorageACL;
}

/**
 * Options for buffer uploads.
 */
export interface BufferUploadOptions {
  /** S3 object key */
  key: string;

  /** MIME content type */
  contentType: string;

  /** Original filename (for metadata) */
  filename?: string;

  /** Custom metadata */
  metadata?: Record<string, string>;

  /** Access control level */
  acl?: StorageACL;
}

/**
 * Result of a successful upload operation.
 */
export interface UploadResult {
  /** S3 object key */
  key: string;

  /** Public or presigned URL to access the file */
  url: string;

  /** File size in bytes */
  size: number;

  /** MIME content type */
  contentType: string;

  /** S3 ETag (typically MD5 hash) */
  etag: string;

  /** S3 bucket name */
  bucket: string;

  /** S3 version ID (if versioning enabled) */
  versionId?: string;
}

// =============================================================================
// Download Types
// =============================================================================

/**
 * File stream with metadata for downloads.
 */
export interface FileStream {
  /** Readable stream of file content */
  stream: Readable;

  /** File size in bytes */
  size: number;

  /** MIME content type */
  contentType: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** S3 ETag */
  etag: string;

  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Options for generating file URLs.
 */
export interface UrlOptions {
  /** URL expiration in seconds (for presigned URLs) */
  expiresIn?: number;

  /** Response content type override */
  responseContentType?: string;

  /** Response content disposition override */
  responseContentDisposition?: string;
}

/**
 * Options for generating signed upload URLs.
 */
export interface SignedUrlOptions {
  /** URL expiration in seconds (default: 3600) */
  expiresIn?: number;

  /** Expected content type */
  contentType?: string;

  /** Maximum content length in bytes */
  maxContentLength?: number;

  /** Custom metadata to associate */
  metadata?: Record<string, string>;

  /** Access control level */
  acl?: StorageACL;
}

/**
 * Result of generating a signed upload URL.
 */
export interface SignedUploadUrl {
  /** Presigned URL for upload */
  url: string;

  /** S3 object key */
  key: string;

  /** URL expiration timestamp */
  expiresAt: Date;

  /** HTTP method to use (PUT or POST) */
  method: 'PUT' | 'POST';

  /** Form fields for POST uploads */
  fields?: Record<string, string>;

  /** Required headers for PUT uploads */
  headers?: Record<string, string>;
}

// =============================================================================
// Metadata Types
// =============================================================================

/**
 * File metadata from S3.
 */
export interface FileMetadata {
  /** S3 object key */
  key: string;

  /** File size in bytes */
  size: number;

  /** MIME content type */
  contentType: string;

  /** Last modified timestamp */
  lastModified: Date;

  /** S3 ETag */
  etag: string;

  /** Custom metadata */
  metadata?: Record<string, string>;

  /** Storage class (STANDARD, REDUCED_REDUNDANCY, etc.) */
  storageClass?: string;

  /** Version ID (if versioning enabled) */
  versionId?: string;
}

// =============================================================================
// List Types
// =============================================================================

/**
 * Options for listing files.
 */
export interface ListOptions {
  /** Maximum number of results */
  maxKeys?: number;

  /** Pagination token */
  continuationToken?: string;

  /** Delimiter for folder-like grouping */
  delimiter?: string;

  /** Start listing after this key */
  startAfter?: string;
}

/**
 * Result of listing files.
 */
export interface FileListResult {
  /** List of file metadata */
  files: FileMetadata[];

  /** Common prefixes (folders) when using delimiter */
  prefixes: string[];

  /** Token for next page of results */
  nextContinuationToken?: string;

  /** Whether more results are available */
  isTruncated: boolean;

  /** Number of keys returned */
  keyCount: number;
}

// =============================================================================
// File Record Types (Database)
// =============================================================================

/**
 * Input for creating a file record in the database.
 */
export interface CreateFileRecordInput {
  /** Original filename */
  filename: string;

  /** Original filename as uploaded */
  originalName: string;

  /** MIME content type */
  mimeType: string;

  /** File size in bytes */
  size: bigint;

  /** S3 object key */
  s3Key: string;

  /** S3 bucket name */
  s3Bucket: string;

  /** Workspace ID */
  workspaceId: string;

  /** User ID who uploaded the file */
  uploadedById: string;

  /** Optional thumbnail URL */
  thumbnailUrl?: string;

  /** Optional metadata JSON */
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating a file record.
 */
export interface UpdateFileRecordInput {
  /** Updated filename */
  filename?: string;

  /** Updated thumbnail URL */
  thumbnailUrl?: string;

  /** Updated file status */
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

  /** Updated metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File record from database with relations.
 */
export interface FileRecordWithRelations {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  metadata: Record<string, unknown>;
  workspaceId: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  uploader?: {
    id: string;
    name: string | null;
    email: string;
  };
}

/**
 * Options for listing file records.
 */
export interface FileRecordListOptions {
  /** Filter by file status */
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

  /** Filter by MIME type pattern */
  mimeType?: string;

  /** Pagination offset */
  skip?: number;

  /** Pagination limit */
  take?: number;

  /** Order by field */
  orderBy?: 'createdAt' | 'filename' | 'size';

  /** Order direction */
  orderDirection?: 'asc' | 'desc';

  /** Include workspace relation */
  includeWorkspace?: boolean;

  /** Include uploader relation */
  includeUploader?: boolean;
}

/**
 * Paginated file record result.
 */
export interface PaginatedFileRecordResult {
  /** File records */
  files: FileRecordWithRelations[];

  /** Total count */
  total: number;

  /** Whether more results exist */
  hasMore: boolean;
}

// =============================================================================
// Key Generation Types
// =============================================================================

/**
 * Options for generating S3 keys.
 */
export interface KeyGenerationOptions {
  /** Workspace ID for namespacing */
  workspaceId: string;

  /** Channel ID (optional) */
  channelId?: string;

  /** Original filename */
  filename: string;

  /** Custom prefix */
  prefix?: string;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default storage configuration values.
 */
export const DEFAULT_STORAGE_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  signedUrlExpiration: 3600, // 1 hour
  defaultACL: 'private' as StorageACL,
  allowedMimeTypes: [] as string[], // Empty = allow all
} as const;

/**
 * Maximum file size limits by type.
 */
export const FILE_SIZE_LIMITS = {
  /** Maximum size for images (10MB) */
  image: 10 * 1024 * 1024,

  /** Maximum size for videos (500MB) */
  video: 500 * 1024 * 1024,

  /** Maximum size for documents (50MB) */
  document: 50 * 1024 * 1024,

  /** Maximum size for other files (100MB) */
  default: 100 * 1024 * 1024,
} as const;

/**
 * Common MIME type categories.
 */
export const MIME_TYPE_CATEGORIES = {
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
  ],
  videos: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
  ],
  audio: [
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/aac',
    'audio/flac',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
  ],
  archives: [
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',
    'application/x-tar',
  ],
} as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid StorageProvider.
 */
export function isStorageProvider(value: unknown): value is StorageProvider {
  return value === 's3' || value === 'r2' || value === 'minio';
}

/**
 * Type guard to check if a value is a valid StorageACL.
 */
export function isStorageACL(value: unknown): value is StorageACL {
  return value === 'private' || value === 'public-read';
}

/**
 * Type guard to check if a value is a valid StorageConfig.
 */
export function isStorageConfig(value: unknown): value is StorageConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  return (
    isStorageProvider(config.provider) &&
    typeof config.bucket === 'string' &&
    typeof config.region === 'string' &&
    typeof config.credentials === 'object' &&
    config.credentials !== null &&
    typeof (config.credentials as Record<string, unknown>).accessKeyId ===
      'string' &&
    typeof (config.credentials as Record<string, unknown>).secretAccessKey ===
      'string'
  );
}

/**
 * Type guard to check if a value is a valid UploadInput.
 */
export function isUploadInput(value: unknown): value is UploadInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    (Buffer.isBuffer(input.file) || isReadableStream(input.file)) &&
    typeof input.key === 'string' &&
    typeof input.contentType === 'string'
  );
}

/**
 * Type guard to check if a value is a Readable stream.
 */
function isReadableStream(value: unknown): value is Readable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).pipe === 'function' &&
    typeof (value as Record<string, unknown>).read === 'function'
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Gets the file category based on MIME type.
 *
 * @param mimeType - MIME type string
 * @returns File category or 'other'
 */
export function getFileCategory(
  mimeType: string
): 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other' {
  if (
    MIME_TYPE_CATEGORIES.images.includes(
      mimeType as (typeof MIME_TYPE_CATEGORIES.images)[number]
    )
  ) {
    return 'image';
  }
  if (
    MIME_TYPE_CATEGORIES.videos.includes(
      mimeType as (typeof MIME_TYPE_CATEGORIES.videos)[number]
    )
  ) {
    return 'video';
  }
  if (
    MIME_TYPE_CATEGORIES.audio.includes(
      mimeType as (typeof MIME_TYPE_CATEGORIES.audio)[number]
    )
  ) {
    return 'audio';
  }
  if (
    MIME_TYPE_CATEGORIES.documents.includes(
      mimeType as (typeof MIME_TYPE_CATEGORIES.documents)[number]
    )
  ) {
    return 'document';
  }
  if (
    MIME_TYPE_CATEGORIES.archives.includes(
      mimeType as (typeof MIME_TYPE_CATEGORIES.archives)[number]
    )
  ) {
    return 'archive';
  }
  return 'other';
}

/**
 * Gets the maximum file size for a MIME type.
 *
 * @param mimeType - MIME type string
 * @returns Maximum file size in bytes
 */
export function getMaxFileSizeForType(mimeType: string): number {
  const category = getFileCategory(mimeType);
  switch (category) {
    case 'image':
      return FILE_SIZE_LIMITS.image;
    case 'video':
      return FILE_SIZE_LIMITS.video;
    case 'document':
      return FILE_SIZE_LIMITS.document;
    default:
      return FILE_SIZE_LIMITS.default;
  }
}

/**
 * Gets file extension from MIME type.
 *
 * @param mimeType - MIME type string
 * @returns File extension (without dot) or empty string
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/webm': 'weba',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'text/markdown': 'md',
    'application/zip': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',
    'application/json': 'json',
    'application/xml': 'xml',
    'text/html': 'html',
    'text/css': 'css',
    'application/javascript': 'js',
    'application/typescript': 'ts',
  };

  return mimeToExt[mimeType] || '';
}

/**
 * Gets MIME type from file extension.
 *
 * @param extension - File extension (with or without dot)
 * @returns MIME type or 'application/octet-stream'
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '');

  const extToMime: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    weba: 'audio/webm',
    aac: 'audio/aac',
    flac: 'audio/flac',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    md: 'text/markdown',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    gz: 'application/gzip',
    tar: 'application/x-tar',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'application/typescript',
  };

  return extToMime[ext] || 'application/octet-stream';
}
