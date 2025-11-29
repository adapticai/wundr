/**
 * Upload Types for Genesis App
 *
 * This module provides comprehensive type definitions for file upload functionality,
 * including file records, upload states, configuration options, and utility functions.
 *
 * @module upload
 */

/**
 * Categorized file types supported by the system
 */
export type FileType = 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other';

/**
 * Metadata associated with an uploaded file
 */
export interface FileMetadata {
  /** Image width in pixels (for images), must be positive */
  readonly width?: number;
  /** Image height in pixels (for images), must be positive */
  readonly height?: number;
  /** Duration in seconds (for audio/video), must be positive */
  readonly duration?: number;
  /** Original filename before processing */
  readonly originalName?: string;
  /** Processing status */
  readonly processed?: boolean;
  /** Extracted text content (for documents) */
  readonly extractedText?: string;
  /** Custom tags for categorization */
  readonly tags?: readonly string[];
}

/**
 * Represents a file record stored in the system
 */
export interface FileRecord {
  /** Unique identifier for the file */
  readonly id: string;
  /** Display name of the file */
  readonly name: string;
  /** URL to access the file */
  readonly url: string;
  /** URL for thumbnail preview (for images/videos) */
  readonly thumbnailUrl?: string;
  /** Categorized file type */
  readonly type: FileType;
  /** MIME type of the file */
  readonly mimeType: string;
  /** File size in bytes, must be non-negative */
  readonly size: number;
  /** Channel where the file was uploaded */
  readonly channelId: string;
  /** User ID of the uploader */
  readonly uploaderId: string;
  /** Display name of the uploader */
  readonly uploaderName: string;
  /** Upload timestamp */
  readonly createdAt: Date;
  /** Optional metadata about the file */
  readonly metadata?: FileMetadata;
}

/**
 * Upload status types representing the lifecycle of a file upload
 */
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';

/**
 * Represents the current state of a file upload in progress
 */
export interface UploadState {
  /** Unique identifier for this upload */
  readonly id: string;
  /** The File object being uploaded */
  readonly file: File;
  /** Display name of the file */
  readonly name: string;
  /** File size in bytes, must be non-negative */
  readonly size: number;
  /** Categorized file type */
  readonly type: FileType;
  /** MIME type of the file */
  readonly mimeType: string;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Current status of the upload */
  status: UploadStatus;
  /** Error message if upload failed */
  error?: string;
  /** URL of the uploaded file (when completed) */
  url?: string;
  /** Thumbnail URL (when completed, for images/videos) */
  thumbnailUrl?: string;
  /** Controller to abort the upload */
  abortController?: AbortController;
}

/**
 * Configuration options for file uploads
 */
export interface UploadOptions {
  /** Target channel for the upload */
  readonly channelId?: string;
  /** Maximum file size in bytes, must be positive */
  readonly maxSize?: number;
  /** Maximum number of files to upload at once, must be positive */
  readonly maxFiles?: number;
  /** Accepted file types configuration */
  readonly accept?: AcceptedFileTypes;
  /** Callback for upload progress updates, progress is 0-100 */
  readonly onProgress?: (fileId: string, progress: number) => void;
  /** Callback when upload completes successfully */
  readonly onComplete?: (fileId: string, url: string) => void;
  /** Callback when upload fails */
  readonly onError?: (fileId: string, error: string) => void;
}

/**
 * Signed URL for secure file upload
 */
export interface SignedUrl {
  /** Pre-signed URL for uploading the file */
  readonly uploadUrl: string;
  /** Final URL where the file will be accessible */
  readonly fileUrl: string;
  /** Expiration time for the signed URL */
  readonly expiresAt: Date;
}

/**
 * Configuration for accepted file types
 */
export interface AcceptedFileTypes {
  /** Accept image files (JPEG, PNG, GIF, WebP, SVG) */
  readonly images?: boolean;
  /** Accept document files (PDF, Word, Excel, PowerPoint, plain text, CSV) */
  readonly documents?: boolean;
  /** Accept video files (MP4, WebM, OGG) */
  readonly videos?: boolean;
  /** Accept audio files (MP3, OGG, WAV) */
  readonly audio?: boolean;
  /** Accept archive files (ZIP, RAR, GZIP) */
  readonly archives?: boolean;
}

/**
 * Map of MIME types to categorized file types
 * Used to determine the file category from its MIME type
 */
export const MIME_TYPE_MAP = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'text/markdown': 'document',
  // Videos
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
  // Audio
  'audio/mpeg': 'audio',
  'audio/ogg': 'audio',
  'audio/wav': 'audio',
  'audio/webm': 'audio',
  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/gzip': 'archive',
  'application/x-tar': 'archive',
} as const satisfies Record<string, FileType>;

/**
 * Configuration mapping file type categories to accepted MIME types
 * Used to generate the accept attribute for file inputs
 */
export const FILE_TYPE_ACCEPT = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  videos: ['video/mp4', 'video/webm', 'video/ogg'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/gzip'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Determines the file type category from a MIME type
 *
 * @param mimeType - The MIME type of the file (e.g., 'image/jpeg')
 * @returns The categorized file type
 *
 * @example
 * ```ts
 * getFileType('image/jpeg') // returns 'image'
 * getFileType('application/pdf') // returns 'document'
 * getFileType('unknown/type') // returns 'other'
 * ```
 */
export function getFileType(mimeType: string): FileType {
  return (MIME_TYPE_MAP as Record<string, FileType>)[mimeType] ?? 'other';
}

/**
 * Formats a file size in bytes to a human-readable string
 *
 * @param bytes - The file size in bytes (must be non-negative)
 * @returns A formatted string with the appropriate unit (Bytes, KB, MB, GB)
 *
 * @example
 * ```ts
 * formatFileSize(0) // returns '0 Bytes'
 * formatFileSize(1024) // returns '1 KB'
 * formatFileSize(1536) // returns '1.5 KB'
 * formatFileSize(1048576) // returns '1 MB'
 * ```
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'] as const;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Converts an AcceptedFileTypes configuration to an accept attribute string
 *
 * @param accept - Configuration object specifying which file types to accept
 * @returns A comma-separated string of MIME types for use in HTML accept attribute
 *
 * @example
 * ```ts
 * getAcceptString() // returns '*\/*'
 * getAcceptString({ images: true }) // returns 'image/jpeg,image/png,...'
 * getAcceptString({ images: true, documents: true }) // returns 'image/jpeg,...,application/pdf,...'
 * ```
 */
export function getAcceptString(accept?: AcceptedFileTypes): string {
  if (!accept) {
    return '*/*';
  }
  const mimeTypes: string[] = [];
  if (accept.images) {
    mimeTypes.push(...FILE_TYPE_ACCEPT.images);
  }
  if (accept.documents) {
    mimeTypes.push(...FILE_TYPE_ACCEPT.documents);
  }
  if (accept.videos) {
    mimeTypes.push(...FILE_TYPE_ACCEPT.videos);
  }
  if (accept.audio) {
    mimeTypes.push(...FILE_TYPE_ACCEPT.audio);
  }
  if (accept.archives) {
    mimeTypes.push(...FILE_TYPE_ACCEPT.archives);
  }
  return mimeTypes.length > 0 ? mimeTypes.join(',') : '*/*';
}

/**
 * Default maximum file size in bytes (25MB)
 */
export const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * Default maximum number of files that can be uploaded at once
 */
export const DEFAULT_MAX_FILES = 10;
