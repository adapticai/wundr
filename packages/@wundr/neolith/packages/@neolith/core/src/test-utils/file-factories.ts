/**
 * File Test Factories
 *
 * Factory functions for creating mock file-related data in tests.
 *
 * @module @genesis/core/test-utils/file-factories
 */

import { vi } from 'vitest';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * File type enum
 */
export type FileType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'ARCHIVE' | 'OTHER';

/**
 * Upload status enum
 */
export type UploadStatus = 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

/**
 * Image size enum
 */
export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * File record type matching database schema
 */
export interface FileRecord {
  id: string;
  name: string;
  key: string;
  type: FileType;
  mimeType: string;
  size: number;
  url: string | null;
  thumbnailUrl: string | null;
  channelId: string;
  userId: string;
  messageId: string | null;
  metadata: Record<string, unknown>;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Upload result from storage service
 */
export interface UploadResult {
  key: string;
  etag: string;
  url: string;
  size: number;
}

/**
 * Signed URL result
 */
export interface SignedUrlResult {
  url: string;
  key: string;
  fields?: Record<string, string>;
  expiresAt: Date;
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  isAnimated: boolean;
  size?: number;
  density?: number;
}

/**
 * Image variant
 */
export interface ImageVariant {
  size: ImageSize;
  url: string;
  width: number;
  height: number;
}

/**
 * Multipart upload initiation result
 */
export interface MultipartUploadInit {
  uploadId: string;
  key: string;
}

/**
 * Completed multipart part for file uploads
 */
export interface FileCompletedPart {
  partNumber: number;
  etag: string;
}

/**
 * File author type
 */
export interface FileAuthor {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

// =============================================================================
// ID GENERATION
// =============================================================================

let fileIdCounter = 0;
let uploadIdCounter = 0;

/**
 * Reset ID counters (call in beforeEach)
 */
export function resetFileIdCounters(): void {
  fileIdCounter = 0;
  uploadIdCounter = 0;
}

/**
 * Generate unique file ID
 */
export function generateFileId(): string {
  fileIdCounter++;
  return `file_${fileIdCounter.toString().padStart(6, '0')}`;
}

/**
 * Generate unique upload ID
 */
export function generateUploadId(): string {
  uploadIdCounter++;
  return `upload_${uploadIdCounter.toString().padStart(6, '0')}`;
}

/**
 * Generate mock ETag
 */
export function generateETag(): string {
  const chars = '0123456789abcdef';
  let etag = '';
  for (let i = 0; i < 32; i++) {
    etag += chars[Math.floor(Math.random() * chars.length)];
  }
  return `"${etag}"`;
}

/**
 * Generate storage key for file
 */
export function generateStorageKey(
  channelId: string,
  userId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `channels/${channelId}/files/${userId}/${timestamp}-${sanitizedFilename}`;
}

// =============================================================================
// FILE RECORD FACTORIES
// =============================================================================

/**
 * Creates a mock file record
 *
 * @param overrides - Properties to override
 * @returns Mock file record
 *
 * @example
 * ```typescript
 * const file = createMockFileRecord({ type: 'IMAGE' });
 * expect(file.type).toBe('IMAGE');
 * ```
 */
export function createMockFileRecord(
  overrides: Partial<FileRecord> = {},
): FileRecord {
  const id = overrides.id ?? generateFileId();
  const channelId = overrides.channelId ?? 'ch_default';
  const userId = overrides.userId ?? 'user_default';
  const name = overrides.name ?? 'test-file.pdf';
  const now = new Date();

  return {
    id,
    name,
    key: overrides.key ?? `channels/${channelId}/files/${userId}/${Date.now()}-${name}`,
    type: overrides.type ?? 'DOCUMENT',
    mimeType: overrides.mimeType ?? 'application/pdf',
    size: overrides.size ?? 1024000,
    url: overrides.url ?? `https://cdn.example.com/files/${id}`,
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    channelId,
    userId,
    messageId: overrides.messageId ?? null,
    metadata: overrides.metadata ?? {},
    isDeleted: overrides.isDeleted ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

/**
 * Creates a mock image file record
 *
 * @param overrides - Properties to override
 * @returns Mock image file record
 */
export function createMockImageFile(
  overrides: Partial<FileRecord> = {},
): FileRecord {
  const id = overrides.id ?? generateFileId();
  const name = overrides.name ?? 'photo.jpg';

  return createMockFileRecord({
    ...overrides,
    id,
    name,
    type: 'IMAGE',
    mimeType: overrides.mimeType ?? 'image/jpeg',
    thumbnailUrl: `https://cdn.example.com/thumbnails/${id}_thumb.webp`,
    metadata: {
      width: 1920,
      height: 1080,
      format: 'jpeg',
      hasAlpha: false,
      isAnimated: false,
      ...overrides.metadata,
    },
  });
}

/**
 * Creates a mock video file record
 *
 * @param overrides - Properties to override
 * @returns Mock video file record
 */
export function createMockVideoFile(
  overrides: Partial<FileRecord> = {},
): FileRecord {
  const name = overrides.name ?? 'video.mp4';

  return createMockFileRecord({
    ...overrides,
    name,
    type: 'VIDEO',
    mimeType: overrides.mimeType ?? 'video/mp4',
    size: overrides.size ?? 50000000, // 50MB
    metadata: {
      duration: 120,
      width: 1920,
      height: 1080,
      codec: 'h264',
      ...overrides.metadata,
    },
  });
}

/**
 * Creates a list of mock file records
 *
 * @param count - Number of files to create
 * @param overrides - Common properties for all files
 * @returns Array of mock file records
 */
export function createMockFileList(
  count: number,
  overrides: Partial<FileRecord> = {},
): FileRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFileRecord({
      ...overrides,
      name: `file-${i + 1}.pdf`,
    }),
  );
}

/**
 * Creates a mock file record with author
 *
 * @param overrides - Properties to override
 * @returns Mock file record with author relation
 */
export function createMockFileWithAuthor(
  overrides: Partial<FileRecord> = {},
): FileRecord & { author: FileAuthor } {
  const file = createMockFileRecord(overrides);

  return {
    ...file,
    author: {
      id: file.userId,
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: null,
    },
  };
}

// =============================================================================
// UPLOAD RESULT FACTORIES
// =============================================================================

/**
 * Creates a mock upload result
 *
 * @param overrides - Properties to override
 * @returns Mock upload result
 */
export function createMockUploadResult(
  overrides: Partial<UploadResult> = {},
): UploadResult {
  const key = overrides.key ?? `uploads/${Date.now()}/file.pdf`;

  return {
    key,
    etag: overrides.etag ?? generateETag(),
    url: overrides.url ?? `https://cdn.example.com/${key}`,
    size: overrides.size ?? 1024,
  };
}

/**
 * Creates a mock signed URL result
 *
 * @param overrides - Properties to override
 * @returns Mock signed URL result
 */
export function createMockSignedUrl(
  overrides: Partial<SignedUrlResult> = {},
): SignedUrlResult {
  const key = overrides.key ?? `uploads/${Date.now()}/file.pdf`;
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 3600000);

  return {
    url: overrides.url ?? `https://bucket.s3.amazonaws.com/${key}?X-Amz-Signature=mock`,
    key,
    fields: overrides.fields ?? {
      key,
      'Content-Type': 'application/pdf',
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': 'mock',
      'X-Amz-Date': new Date().toISOString().replace(/[:-]/g, '').split('.')[0] + 'Z',
      'X-Amz-Signature': 'mock_signature',
      Policy: 'mock_policy',
    },
    expiresAt,
  };
}

/**
 * Creates a mock multipart upload init result
 *
 * @param overrides - Properties to override
 * @returns Mock multipart upload init result
 */
export function createMockMultipartUploadInit(
  overrides: Partial<MultipartUploadInit> = {},
): MultipartUploadInit {
  return {
    uploadId: overrides.uploadId ?? generateUploadId(),
    key: overrides.key ?? `uploads/${Date.now()}/large-file.mp4`,
  };
}

/**
 * Creates mock completed parts for multipart upload
 *
 * @param count - Number of parts
 * @returns Array of completed parts
 */
export function createMockCompletedParts(count: number): FileCompletedPart[] {
  return Array.from({ length: count }, (_, i) => ({
    partNumber: i + 1,
    etag: generateETag(),
  }));
}

// =============================================================================
// IMAGE METADATA FACTORIES
// =============================================================================

/**
 * Creates mock image metadata
 *
 * @param overrides - Properties to override
 * @returns Mock image metadata
 */
export function createMockImageMetadata(
  overrides: Partial<ImageMetadata> = {},
): ImageMetadata {
  return {
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    format: overrides.format ?? 'jpeg',
    hasAlpha: overrides.hasAlpha ?? false,
    isAnimated: overrides.isAnimated ?? false,
    size: overrides.size ?? 500000,
    density: overrides.density ?? 72,
  };
}

/**
 * Creates a mock image variant
 *
 * @param size - Variant size
 * @param key - Original file key
 * @returns Mock image variant
 */
export function createMockImageVariant(
  size: ImageSize,
  key: string,
): ImageVariant {
  const dimensions: Record<ImageSize, { width: number; height: number }> = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 320, height: 180 },
    medium: { width: 640, height: 360 },
    large: { width: 1280, height: 720 },
    original: { width: 1920, height: 1080 },
  };

  const dim = dimensions[size];
  const variantKey = key.replace(/\.[^.]+$/, `_${size}.webp`);

  return {
    size,
    url: `https://cdn.example.com/${variantKey}`,
    width: dim.width,
    height: dim.height,
  };
}

/**
 * Creates all image variants for a file
 *
 * @param key - Original file key
 * @returns Array of all image variants
 */
export function createMockImageVariants(key: string): ImageVariant[] {
  const sizes: ImageSize[] = ['thumbnail', 'small', 'medium', 'large', 'original'];
  return sizes.map((size) => createMockImageVariant(size, key));
}

// =============================================================================
// MOCK S3 CLIENT FACTORY
// =============================================================================

/**
 * Creates a simple mock S3 client for testing (use mock-s3.ts for full implementation)
 *
 * @returns Simple mock S3 client
 */
export function createSimpleMockS3Client() {
  return {
    putObject: vi.fn().mockResolvedValue({ ETag: generateETag() }),
    getObject: vi.fn().mockResolvedValue({
      Body: Buffer.from('mock content'),
      ContentType: 'application/octet-stream',
    }),
    deleteObject: vi.fn().mockResolvedValue({}),
    headObject: vi.fn().mockResolvedValue({
      ContentLength: 1024,
      ContentType: 'application/octet-stream',
    }),
    listObjects: vi.fn().mockResolvedValue({ Contents: [] }),
    createMultipartUpload: vi.fn().mockResolvedValue({
      UploadId: generateUploadId(),
    }),
    uploadPart: vi.fn().mockResolvedValue({ ETag: generateETag() }),
    completeMultipartUpload: vi.fn().mockResolvedValue({
      Location: 'https://bucket.s3.amazonaws.com/key',
    }),
    abortMultipartUpload: vi.fn().mockResolvedValue({}),
  };
}

// =============================================================================
// MOCK PRISMA FILE MODEL
// =============================================================================

/**
 * Creates a mock Prisma file model
 *
 * @returns Mock Prisma file model with common methods
 */
export function createMockPrismaFileModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  };
}

// =============================================================================
// MOCK STORAGE SERVICE FACTORY
// =============================================================================

/**
 * Creates a mock storage service for testing
 *
 * @returns Mock storage service
 */
export function createMockStorageService() {
  return {
    getSignedUploadUrl: vi.fn().mockImplementation(async (key: string) =>
      createMockSignedUrl({ key }),
    ),
    getSignedDownloadUrl: vi.fn().mockImplementation(async (key: string) =>
      `https://cdn.example.com/${key}?signature=mock`,
    ),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    initiateMultipartUpload: vi.fn().mockImplementation(async (key: string) =>
      createMockMultipartUploadInit({ key }),
    ),
    getMultipartPartUrl: vi.fn().mockImplementation(
      async (key: string, uploadId: string, partNumber: number) =>
        `https://bucket.s3.amazonaws.com/${key}?uploadId=${uploadId}&partNumber=${partNumber}`,
    ),
    completeMultipartUpload: vi.fn().mockImplementation(async (key: string) => ({
      location: `https://cdn.example.com/${key}`,
    })),
    abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================================
// MOCK IMAGE SERVICE FACTORY
// =============================================================================

/**
 * Creates a mock image service for testing
 *
 * @returns Mock image service
 */
export function createMockImageService() {
  return {
    processImage: vi.fn().mockImplementation(async () =>
      createMockImageMetadata(),
    ),
    generateVariants: vi.fn().mockImplementation(
      async (key: string, sizes: ImageSize[]) =>
        sizes.map((size) => createMockImageVariant(size, key)),
    ),
    generateThumbnail: vi.fn().mockImplementation(async (key: string) => {
      const thumbnailKey = key.replace(/\.[^.]+$/, '_thumb.webp');
      return `https://cdn.example.com/${thumbnailKey}`;
    }),
    resizeImage: vi.fn().mockImplementation(
      async (_input: string, output: string, options: { width?: number; height?: number }) => ({
        key: output,
        width: options.width ?? 800,
        height: options.height ?? 600,
      }),
    ),
    optimizeImage: vi.fn().mockImplementation(async (key: string) => ({
      key: key.replace(/\.[^.]+$/, '_optimized.webp'),
      originalSize: 500000,
      optimizedSize: 300000,
    })),
  };
}

// =============================================================================
// FILE VALIDATION HELPERS
// =============================================================================

/**
 * Allowed MIME types for file uploads
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/zip',
  'application/x-tar',
  'application/gzip',
];

/**
 * Maximum file sizes by type (in bytes)
 */
export const MAX_FILE_SIZES: Record<FileType, number> = {
  IMAGE: 100 * 1024 * 1024, // 100MB
  VIDEO: 500 * 1024 * 1024, // 500MB
  AUDIO: 100 * 1024 * 1024, // 100MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
  ARCHIVE: 200 * 1024 * 1024, // 200MB
  OTHER: 50 * 1024 * 1024, // 50MB
};

/**
 * Creates mock validation error
 *
 * @param code - Error code
 * @param message - Error message
 * @param field - Field that failed validation
 * @returns Mock validation error
 */
export function createMockValidationError(
  code: string,
  message: string,
  field?: string,
): { code: string; message: string; path?: string[] } {
  return {
    code,
    message,
    ...(field && { path: [field] }),
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  createMockFileRecord,
  createMockImageFile,
  createMockVideoFile,
  createMockFileList,
  createMockFileWithAuthor,
  createMockUploadResult,
  createMockSignedUrl,
  createMockMultipartUploadInit,
  createMockCompletedParts,
  createMockImageMetadata,
  createMockImageVariant,
  createMockImageVariants,
  createSimpleMockS3Client,
  createMockPrismaFileModel,
  createMockStorageService,
  createMockImageService,
  generateFileId,
  generateUploadId,
  generateETag,
  generateStorageKey,
  resetFileIdCounters,
};
