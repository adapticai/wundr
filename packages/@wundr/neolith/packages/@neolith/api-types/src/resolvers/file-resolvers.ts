/**
 * File GraphQL Resolvers
 *
 * Comprehensive resolvers for file upload operations including queries, mutations,
 * subscriptions, and field resolvers. Implements authorization checks (workspace membership),
 * signed URL generation, multipart uploads, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/file-resolvers
 */

import { GraphQLError } from 'graphql';

import type {
  File as PrismaFile,
  FileStatus,
  FileWhereInput,
  InputJsonValue,
  PrismaClient,
} from '@neolith/database';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * File type enum for categorizing files
 */
export const FileType = {
  Image: 'IMAGE',
  Video: 'VIDEO',
  Audio: 'AUDIO',
  Document: 'DOCUMENT',
  Archive: 'ARCHIVE',
  Other: 'OTHER',
} as const;

export type FileTypeValue = (typeof FileType)[keyof typeof FileType];

/**
 * Upload status enum
 */
export const UploadStatus = {
  Pending: 'PENDING',
  Uploading: 'UPLOADING',
  Processing: 'PROCESSING',
  Complete: 'COMPLETE',
  Failed: 'FAILED',
} as const;

export type UploadStatusValue =
  (typeof UploadStatus)[keyof typeof UploadStatus];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Storage service interface for S3 operations
 */
export interface StorageService {
  /** Generate presigned upload URL */
  getSignedUploadUrl(
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<SignedUrlResult>;
  /** Generate presigned download URL */
  getSignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  /** Delete file from storage */
  deleteFile(key: string): Promise<void>;
  /** Initiate multipart upload */
  initiateMultipartUpload(
    key: string,
    contentType: string
  ): Promise<{ uploadId: string; key: string }>;
  /** Get presigned URL for multipart part */
  getMultipartPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string>;
  /** Complete multipart upload */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: CompletedPart[]
  ): Promise<{ location: string }>;
  /** Abort multipart upload */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

/**
 * Image service interface for image processing
 */
export interface ImageService {
  /** Process uploaded image */
  processImage(key: string): Promise<ImageMetadata>;
  /** Generate image variants */
  generateVariants(key: string, sizes: ImageSize[]): Promise<ImageVariant[]>;
  /** Generate thumbnail */
  generateThumbnail(key: string): Promise<string>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Storage service for S3 operations */
  storageService?: StorageService;
  /** Image service for image processing */
  imageService?: ImageService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * File entity type for resolvers (matching Prisma schema)
 */
interface File {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  s3Key: string;
  s3Bucket: string;
  thumbnailUrl: string | null;
  status: FileStatus;
  metadata: unknown;
  workspaceId: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  // Computed fields for resolver
  type?: FileTypeValue;
  url?: string | null;
}

/**
 * Image variant type
 */
interface ImageVariant {
  size: ImageSize;
  url: string;
  width: number;
  height: number;
}

/**
 * Image size enum
 */
type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * Image metadata type
 */
interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  isAnimated: boolean;
}

/**
 * Signed URL result
 */
interface SignedUrlResult {
  url: string;
  key: string;
  fields?: Record<string, string>;
  expiresAt: Date;
}

/**
 * Completed multipart part
 */
interface CompletedPart {
  partNumber: number;
  etag: string;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for requesting upload URL
 */
interface RequestUploadInput {
  filename: string;
  contentType: string;
  size: number;
  workspaceId: string;
}

/**
 * Input for completing upload
 */
interface CompleteUploadInput {
  key: string;
  bucket: string;
  workspaceId: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for initiating multipart upload
 */
interface InitiateMultipartUploadInput {
  filename: string;
  contentType: string;
  size: number;
  workspaceId: string;
}

/**
 * File filter input
 */
interface FileFilterInput {
  mimeType?: string | null;
  status?: FileStatus | null;
  before?: Date | null;
  after?: Date | null;
}

/**
 * Pagination input
 */
interface PaginationInput {
  cursor?: string | null;
  limit?: number | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface FileQueryArgs {
  id: string;
}

interface FilesQueryArgs {
  workspaceId: string;
  mimeType?: string | null;
  pagination?: PaginationInput | null;
}

interface WorkspaceFilesQueryArgs {
  workspaceId: string;
  filter?: FileFilterInput | null;
}

interface SearchFilesArgs {
  workspaceId: string;
  query: string;
  limit?: number | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface RequestUploadArgs {
  input: RequestUploadInput;
}

interface CompleteUploadArgs {
  key: string;
  bucket: string;
  workspaceId: string;
  metadata?: Record<string, unknown> | null;
}

interface DeleteFileArgs {
  id: string;
}

interface InitiateMultipartUploadArgs {
  input: InitiateMultipartUploadInput;
}

interface GetMultipartPartUrlArgs {
  uploadId: string;
  partNumber: number;
  key: string;
}

interface CompleteMultipartUploadArgs {
  uploadId: string;
  key: string;
  bucket: string;
  workspaceId: string;
  parts: CompletedPart[];
}

interface AbortMultipartUploadArgs {
  uploadId: string;
  key: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface FileUploadedArgs {
  workspaceId: string;
}

interface UploadProgressArgs {
  uploadId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface FilePayload {
  file: File | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface UploadUrlPayload {
  url: string | null;
  key: string | null;
  bucket: string | null;
  fields: Record<string, string> | null;
  expiresAt: Date | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface MultipartInitPayload {
  uploadId: string | null;
  key: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface MultipartPartUrlPayload {
  url: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DeletePayload {
  success: boolean;
  deletedId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for file uploaded */
export const FILE_UPLOADED = 'FILE_UPLOADED';

/** Event name for upload progress */
export const UPLOAD_PROGRESS = 'UPLOAD_PROGRESS';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum file size in bytes (100MB) */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Maximum file size for non-image files (50MB) */
const MAX_NON_IMAGE_SIZE = 50 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

/** Allowed document MIME types */
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

/** Allowed video MIME types */
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/** Allowed audio MIME types */
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
];

/** All allowed MIME types */
const ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  'application/zip',
  'application/x-tar',
  'application/gzip',
];

/** Default S3 bucket */
const DEFAULT_S3_BUCKET = process.env.S3_BUCKET ?? 'genesis-files';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Type guard to check if user has admin role
 */
function isAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user can access a workspace
 */
async function canAccessWorkspace(
  context: GraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isAdmin(context)) {
    return true;
  }

  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
  });

  return membership !== null;
}

/**
 * Determine file type from MIME type
 */
function getFileType(mimeType: string): FileTypeValue {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'IMAGE';
  }
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return 'VIDEO';
  }
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) {
    return 'AUDIO';
  }
  if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return 'DOCUMENT';
  }
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  ) {
    return 'ARCHIVE';
  }
  return 'OTHER';
}

/**
 * Validate file upload input
 */
function validateUploadInput(input: RequestUploadInput): void {
  // Validate filename
  if (!input.filename || input.filename.trim().length === 0) {
    throw new GraphQLError('Filename is required', {
      extensions: { code: 'BAD_USER_INPUT', field: 'filename' },
    });
  }

  // Validate content type
  if (!ALLOWED_MIME_TYPES.includes(input.contentType)) {
    throw new GraphQLError(`File type ${input.contentType} is not allowed`, {
      extensions: { code: 'BAD_USER_INPUT', field: 'contentType' },
    });
  }

  // Validate size
  const maxSize = ALLOWED_IMAGE_TYPES.includes(input.contentType)
    ? MAX_FILE_SIZE
    : MAX_NON_IMAGE_SIZE;

  if (input.size > maxSize) {
    throw new GraphQLError(
      `File size exceeds maximum allowed (${maxSize / 1024 / 1024}MB)`,
      {
        extensions: { code: 'BAD_USER_INPUT', field: 'size' },
      }
    );
  }
}

/**
 * Generate storage key for file
 */
function generateStorageKey(
  workspaceId: string,
  userId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `workspaces/${workspaceId}/files/${userId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generate cursor from file for pagination
 */
function generateCursor(file: PrismaFile): string {
  return Buffer.from(`${file.createdAt.toISOString()}:${file.id}`).toString(
    'base64'
  );
}

/**
 * Parse cursor to get timestamp and ID
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Convert Prisma file to resolver file type
 */
function toFile(prismaFile: PrismaFile): File {
  return {
    id: prismaFile.id,
    filename: prismaFile.filename,
    originalName: prismaFile.originalName,
    mimeType: prismaFile.mimeType,
    size: prismaFile.size,
    s3Key: prismaFile.s3Key,
    s3Bucket: prismaFile.s3Bucket,
    thumbnailUrl: prismaFile.thumbnailUrl,
    status: prismaFile.status,
    metadata: prismaFile.metadata,
    workspaceId: prismaFile.workspaceId,
    uploadedById: prismaFile.uploadedById,
    createdAt: prismaFile.createdAt,
    updatedAt: prismaFile.updatedAt,
    type: getFileType(prismaFile.mimeType),
  };
}

/**
 * Create success payload
 */
function createSuccessPayload(file: File): FilePayload {
  return { file, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): FilePayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { file: null, errors };
}

// =============================================================================
// FILE QUERY RESOLVERS
// =============================================================================

/**
 * File Query resolvers
 */
export const fileQueries = {
  /**
   * Get a file by its ID
   */
  file: async (
    _parent: unknown,
    args: FileQueryArgs,
    context: GraphQLContext
  ): Promise<File | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const file = await context.prisma.file.findUnique({
      where: { id: args.id },
    });

    if (!file) {
      return null;
    }

    // Check workspace access
    const hasAccess = await canAccessWorkspace(context, file.workspaceId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this file', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return toFile(file);
  },

  /**
   * Get files in a workspace with pagination
   */
  files: async (
    _parent: unknown,
    args: FilesQueryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, mimeType, pagination } = args;
    const limit = Math.min(Math.max(pagination?.limit ?? 50, 1), 100);

    // Check workspace access
    const hasAccess = await canAccessWorkspace(context, workspaceId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: FileWhereInput = {
      workspaceId,
      status: { not: 'FAILED' },
      ...(mimeType && { mimeType }),
    };

    // Handle cursor pagination
    if (pagination?.cursor) {
      const parsed = parseCursor(pagination.cursor);
      if (parsed) {
        where.OR = [
          { createdAt: { lt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { lt: parsed.id } },
        ];
      }
    }

    // Fetch files
    const files = await context.prisma.file.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const totalCount = await context.prisma.file.count({
      where: {
        workspaceId,
        status: { not: 'FAILED' },
        ...(mimeType && { mimeType }),
      },
    });

    const hasNextPage = files.length > limit;
    const nodes = hasNextPage ? files.slice(0, -1) : files;

    const edges = nodes.map((f: PrismaFile) => {
      const fileData = toFile(f);
      return {
        node: fileData,
        cursor: generateCursor(f),
      };
    });

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!pagination?.cursor,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get files in a workspace with filters
   */
  workspaceFiles: async (
    _parent: unknown,
    args: WorkspaceFilesQueryArgs,
    context: GraphQLContext
  ): Promise<File[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, filter } = args;

    // Check workspace access
    const hasAccess = await canAccessWorkspace(context, workspaceId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Build where clause
    const where: FileWhereInput = {
      workspaceId,
    };

    if (filter?.mimeType) {
      where.mimeType = filter.mimeType;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.after) {
      where.createdAt = {
        ...((where.createdAt as object) ?? {}),
        gte: filter.after,
      };
    }
    if (filter?.before) {
      where.createdAt = {
        ...((where.createdAt as object) ?? {}),
        lte: filter.before,
      };
    }

    const files = await context.prisma.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return files.map(toFile);
  },

  /**
   * Search files across a workspace
   */
  searchFiles: async (
    _parent: unknown,
    args: SearchFilesArgs,
    context: GraphQLContext
  ): Promise<File[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { workspaceId, query } = args;
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    // Check workspace access
    const hasAccess = await canAccessWorkspace(context, workspaceId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const files = await context.prisma.file.findMany({
      where: {
        workspaceId,
        status: { not: 'FAILED' },
        OR: [
          { filename: { contains: query, mode: 'insensitive' } },
          { originalName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return files.map(toFile);
  },
};

// =============================================================================
// FILE MUTATION RESOLVERS
// =============================================================================

/**
 * File Mutation resolvers
 */
export const fileMutations = {
  /**
   * Request a signed URL for file upload
   */
  requestUpload: async (
    _parent: unknown,
    args: RequestUploadArgs,
    context: GraphQLContext
  ): Promise<UploadUrlPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate input
    try {
      validateUploadInput(input);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return {
          url: null,
          key: null,
          bucket: null,
          fields: null,
          expiresAt: null,
          errors: [
            { code: error.extensions?.code as string, message: error.message },
          ],
        };
      }
      throw error;
    }

    // Check workspace membership
    const hasAccess = await canAccessWorkspace(context, input.workspaceId);
    if (!hasAccess) {
      throw new GraphQLError(
        'You must be a member of this workspace to upload files',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    // Check storage service availability
    if (!context.storageService) {
      return {
        url: null,
        key: null,
        bucket: null,
        fields: null,
        expiresAt: null,
        errors: [
          {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Storage service unavailable',
          },
        ],
      };
    }

    // Generate storage key
    const key = generateStorageKey(
      input.workspaceId,
      context.user.id,
      input.filename
    );

    // Get signed upload URL
    const result = await context.storageService.getSignedUploadUrl(
      key,
      input.contentType,
      {
        'x-amz-meta-filename': input.filename,
        'x-amz-meta-workspaceid': input.workspaceId,
        'x-amz-meta-userid': context.user.id,
      }
    );

    return {
      url: result.url,
      key: result.key,
      bucket: DEFAULT_S3_BUCKET,
      fields: result.fields ?? null,
      expiresAt: result.expiresAt,
      errors: [],
    };
  },

  /**
   * Complete file upload and create file record
   */
  completeUpload: async (
    _parent: unknown,
    args: CompleteUploadArgs,
    context: GraphQLContext
  ): Promise<FilePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { key, bucket, workspaceId, metadata } = args;

    // Verify workspace membership
    const hasAccess = await canAccessWorkspace(context, workspaceId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this workspace', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Extract filename from key
    const keyParts = key.split('/');
    const filenameWithTimestamp = keyParts[keyParts.length - 1] ?? 'unknown';
    const filename = filenameWithTimestamp.replace(/^\d+-/, '');

    // Determine MIME type from filename
    const extension = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = getMimeTypeFromExtension(extension);

    // Create file record
    const file = await context.prisma.file.create({
      data: {
        filename,
        originalName: filename,
        mimeType,
        size: BigInt(0), // Would be fetched from S3 in real implementation
        s3Key: key,
        s3Bucket: bucket,
        status: 'READY',
        workspaceId,
        uploadedById: context.user.id,
        metadata: (metadata ?? {}) as InputJsonValue,
      },
    });

    const fileData = toFile(file);

    // Process image if applicable
    const fileType = getFileType(mimeType);
    if (fileType === 'IMAGE' && context.imageService) {
      try {
        await context.imageService.processImage(key);
        const thumbnailUrl = await context.imageService.generateThumbnail(key);

        await context.prisma.file.update({
          where: { id: file.id },
          data: {
            thumbnailUrl,
            metadata: {
              ...(file.metadata as object),
            } as InputJsonValue,
          },
        });

        fileData.thumbnailUrl = thumbnailUrl;
      } catch {
        // Image processing failed, but upload is still complete
      }
    }

    // Publish file uploaded event
    await context.pubsub.publish(`${FILE_UPLOADED}_${workspaceId}`, {
      fileUploaded: fileData,
    });

    return createSuccessPayload(fileData);
  },

  /**
   * Delete a file
   */
  deleteFile: async (
    _parent: unknown,
    args: DeleteFileArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const file = await context.prisma.file.findUnique({
      where: { id: args.id },
    });

    if (!file) {
      return {
        success: false,
        deletedId: null,
        errors: [{ code: 'NOT_FOUND', message: 'File not found' }],
      };
    }

    // Check if user owns the file or is admin
    if (file.uploadedById !== context.user.id && !isAdmin(context)) {
      throw new GraphQLError('You can only delete your own files', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Update status to indicate deletion
    await context.prisma.file.update({
      where: { id: args.id },
      data: { status: 'FAILED' }, // Using FAILED as a soft-delete status
    });

    // Delete from storage (async, don't wait)
    if (context.storageService) {
      context.storageService.deleteFile(file.s3Key).catch(() => {
        // Log error but don't fail the mutation
      });
    }

    return {
      success: true,
      deletedId: args.id,
      errors: [],
    };
  },

  /**
   * Initiate multipart upload for large files
   */
  initiateMultipartUpload: async (
    _parent: unknown,
    args: InitiateMultipartUploadArgs,
    context: GraphQLContext
  ): Promise<MultipartInitPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate input
    try {
      validateUploadInput(input);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return {
          uploadId: null,
          key: null,
          errors: [
            { code: error.extensions?.code as string, message: error.message },
          ],
        };
      }
      throw error;
    }

    // Check workspace membership
    const hasAccess = await canAccessWorkspace(context, input.workspaceId);
    if (!hasAccess) {
      throw new GraphQLError(
        'You must be a member of this workspace to upload files',
        {
          extensions: { code: 'FORBIDDEN' },
        }
      );
    }

    if (!context.storageService) {
      return {
        uploadId: null,
        key: null,
        errors: [
          {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Storage service unavailable',
          },
        ],
      };
    }

    const key = generateStorageKey(
      input.workspaceId,
      context.user.id,
      input.filename
    );
    const result = await context.storageService.initiateMultipartUpload(
      key,
      input.contentType
    );

    return {
      uploadId: result.uploadId,
      key: result.key,
      errors: [],
    };
  },

  /**
   * Get signed URL for multipart upload part
   */
  getMultipartPartUrl: async (
    _parent: unknown,
    args: GetMultipartPartUrlArgs,
    context: GraphQLContext
  ): Promise<MultipartPartUrlPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.storageService) {
      return {
        url: null,
        errors: [
          {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Storage service unavailable',
          },
        ],
      };
    }

    const url = await context.storageService.getMultipartPartUrl(
      args.key,
      args.uploadId,
      args.partNumber
    );

    return { url, errors: [] };
  },

  /**
   * Complete multipart upload
   */
  completeMultipartUpload: async (
    _parent: unknown,
    args: CompleteMultipartUploadArgs,
    context: GraphQLContext
  ): Promise<FilePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.storageService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Storage service unavailable'
      );
    }

    await context.storageService.completeMultipartUpload(
      args.key,
      args.uploadId,
      args.parts
    );

    // Complete upload using the regular completeUpload flow
    return fileMutations.completeUpload(
      _parent,
      {
        key: args.key,
        bucket: args.bucket,
        workspaceId: args.workspaceId,
        metadata: null,
      },
      context
    );
  },

  /**
   * Abort multipart upload
   */
  abortMultipartUpload: async (
    _parent: unknown,
    args: AbortMultipartUploadArgs,
    context: GraphQLContext
  ): Promise<DeletePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.storageService) {
      return {
        success: false,
        deletedId: null,
        errors: [
          {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Storage service unavailable',
          },
        ],
      };
    }

    await context.storageService.abortMultipartUpload(args.key, args.uploadId);

    return {
      success: true,
      deletedId: args.uploadId,
      errors: [],
    };
  },
};

// =============================================================================
// FILE SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * File Subscription resolvers
 */
export const fileSubscriptions = {
  /**
   * Subscribe to new files uploaded to a workspace
   */
  fileUploaded: {
    subscribe: async (
      _parent: unknown,
      args: FileUploadedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const hasAccess = await canAccessWorkspace(context, args.workspaceId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this workspace', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${FILE_UPLOADED}_${args.workspaceId}`
      );
    },
  },

  /**
   * Subscribe to upload progress updates
   */
  uploadProgress: {
    subscribe: async (
      _parent: unknown,
      args: UploadProgressArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(
        `${UPLOAD_PROGRESS}_${args.uploadId}`
      );
    },
  },
};

// =============================================================================
// FILE FIELD RESOLVERS
// =============================================================================

/**
 * File field resolvers for nested types
 */
export const FileFieldResolvers = {
  /**
   * Generate signed URL for file access
   */
  url: async (
    parent: File,
    _args: unknown,
    context: GraphQLContext
  ): Promise<string | null> => {
    if (!context.storageService) {
      return null;
    }

    try {
      return await context.storageService.getSignedDownloadUrl(parent.s3Key);
    } catch {
      return null;
    }
  },

  /**
   * Get file type from MIME type
   */
  type: (parent: File): FileTypeValue => {
    return parent.type ?? getFileType(parent.mimeType);
  },

  /**
   * Get file size as number
   */
  size: (parent: File): number => {
    return Number(parent.size);
  },

  /**
   * Resolve the uploader (author) for a file
   */
  uploader: async (parent: File, _args: unknown, context: GraphQLContext) => {
    return context.prisma.user.findUnique({
      where: { id: parent.uploadedById },
    });
  },

  /**
   * Resolve the workspace for a file
   */
  workspace: async (parent: File, _args: unknown, context: GraphQLContext) => {
    return context.prisma.workspace.findUnique({
      where: { id: parent.workspaceId },
    });
  },

  /**
   * Resolve image variants for image files
   */
  variants: async (
    parent: File,
    _args: unknown,
    context: GraphQLContext
  ): Promise<ImageVariant[] | null> => {
    const fileType = parent.type ?? getFileType(parent.mimeType);
    if (fileType !== 'IMAGE') {
      return null;
    }

    const metadata = parent.metadata as Record<string, unknown> | null;
    const variants = metadata?.variants as ImageVariant[] | undefined;

    if (!variants || !context.storageService) {
      return variants ?? null;
    }

    // Generate signed URLs for each variant
    return Promise.all(
      variants.map(async v => ({
        ...v,
        url: await context.storageService!.getSignedDownloadUrl(
          `${parent.s3Key.replace(/\.[^.]+$/, '')}_${v.size}.webp`
        ),
      }))
    );
  },
};

// =============================================================================
// HELPER FUNCTION: Get MIME type from extension
// =============================================================================

function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    csv: 'text/csv',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    zip: 'application/zip',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  };

  return mimeTypes[extension] ?? 'application/octet-stream';
}

// =============================================================================
// COMBINED FILE RESOLVERS
// =============================================================================

/**
 * Combined file resolvers object for use with graphql-tools
 */
export const fileResolvers = {
  Query: fileQueries,
  Mutation: fileMutations,
  Subscription: fileSubscriptions,
  File: FileFieldResolvers,
};

export default fileResolvers;
