/**
 * Upload Types for Genesis App
 */

export type FileType = 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other';

/**
 * Metadata associated with an uploaded file
 */
export interface FileMetadata {
  /** Image width in pixels (for images) */
  width?: number;
  /** Image height in pixels (for images) */
  height?: number;
  /** Duration in seconds (for audio/video) */
  duration?: number;
  /** Original filename before processing */
  originalName?: string;
  /** Processing status */
  processed?: boolean;
  /** Extracted text content (for documents) */
  extractedText?: string;
  /** Custom tags */
  tags?: string[];
}

/**
 * Represents a file record stored in the system
 */
export interface FileRecord {
  /** Unique identifier for the file */
  id: string;
  /** Display name of the file */
  name: string;
  /** URL to access the file */
  url: string;
  /** URL for thumbnail preview (for images/videos) */
  thumbnailUrl?: string;
  /** Categorized file type */
  type: FileType;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Channel where the file was uploaded */
  channelId: string;
  /** User ID of the uploader */
  uploaderId: string;
  /** Display name of the uploader */
  uploaderName: string;
  /** Upload timestamp */
  createdAt: Date;
  /** Optional metadata about the file */
  metadata?: FileMetadata;
}

/**
 * Upload status types
 */
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';

/**
 * Represents the current state of a file upload in progress
 */
export interface UploadState {
  /** Unique identifier for this upload */
  id: string;
  /** The File object being uploaded */
  file: File;
  /** Display name of the file */
  name: string;
  /** File size in bytes */
  size: number;
  /** Categorized file type */
  type: FileType;
  /** MIME type of the file */
  mimeType: string;
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
  channelId?: string;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Maximum number of files to upload at once */
  maxFiles?: number;
  /** Accepted file types configuration */
  accept?: AcceptedFileTypes;
  /** Callback for upload progress updates */
  onProgress?: (fileId: string, progress: number) => void;
  /** Callback when upload completes successfully */
  onComplete?: (fileId: string, url: string) => void;
  /** Callback when upload fails */
  onError?: (fileId: string, error: string) => void;
}

/**
 * Signed URL for secure file upload
 */
export interface SignedUrl {
  /** Pre-signed URL for uploading the file */
  uploadUrl: string;
  /** Final URL where the file will be accessible */
  fileUrl: string;
  /** Expiration time for the signed URL */
  expiresAt: Date;
}

/**
 * Configuration for accepted file types
 */
export interface AcceptedFileTypes {
  /** Accept image files */
  images?: boolean;
  /** Accept document files (PDF, Word, etc.) */
  documents?: boolean;
  /** Accept video files */
  videos?: boolean;
  /** Accept audio files */
  audio?: boolean;
  /** Accept archive files (ZIP, RAR, etc.) */
  archives?: boolean;
}

export const MIME_TYPE_MAP: Record<string, FileType> = {
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
};

export const FILE_TYPE_ACCEPT: Record<string, string[]> = {
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
};

export function getFileType(mimeType: string): FileType {
  return MIME_TYPE_MAP[mimeType] || 'other';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getAcceptString(accept?: AcceptedFileTypes): string {
  if (!accept) return '*/*';
  const mimeTypes: string[] = [];
  if (accept.images) mimeTypes.push(...FILE_TYPE_ACCEPT.images);
  if (accept.documents) mimeTypes.push(...FILE_TYPE_ACCEPT.documents);
  if (accept.videos) mimeTypes.push(...FILE_TYPE_ACCEPT.videos);
  if (accept.audio) mimeTypes.push(...FILE_TYPE_ACCEPT.audio);
  if (accept.archives) mimeTypes.push(...FILE_TYPE_ACCEPT.archives);
  return mimeTypes.length > 0 ? mimeTypes.join(',') : '*/*';
}

export const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const DEFAULT_MAX_FILES = 10;
