/**
 * Upload Types for Genesis App
 */

export type FileType = 'image' | 'document' | 'video' | 'audio' | 'archive' | 'other';

export interface FileRecord {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: FileType;
  mimeType: string;
  size: number;
  channelId: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UploadState {
  id: string;
  file: File;
  name: string;
  size: number;
  type: FileType;
  mimeType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  url?: string;
  thumbnailUrl?: string;
  abortController?: AbortController;
}

export interface UploadOptions {
  channelId?: string;
  maxSize?: number;
  maxFiles?: number;
  accept?: AcceptedFileTypes;
  onProgress?: (fileId: string, progress: number) => void;
  onComplete?: (fileId: string, url: string) => void;
  onError?: (fileId: string, error: string) => void;
}

export interface SignedUrl {
  uploadUrl: string;
  fileUrl: string;
  expiresAt: Date;
}

export interface AcceptedFileTypes {
  images?: boolean;
  documents?: boolean;
  videos?: boolean;
  audio?: boolean;
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
