/**
 * @genesis/core - Storage Service
 *
 * S3-compatible storage service supporting AWS S3, Cloudflare R2, and MinIO.
 * Provides file upload, download, and management operations.
 *
 * @packageDocumentation
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type S3ClientConfig,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createId } from '@paralleldrive/cuid2';

import { GenesisError } from '../errors';
import {
  DEFAULT_STORAGE_CONFIG,
  getMaxFileSizeForType,
  getMimeTypeFromExtension,
  type StorageConfig,
  type UploadInput,
  type UploadResult,
  type UploadOptions,
  type BufferUploadOptions,
  type FileStream,
  type UrlOptions,
  type SignedUrlOptions,
  type SignedUploadUrl,
  type FileMetadata,
  type ListOptions,
  type FileListResult,
  type KeyGenerationOptions,
} from '../types/storage';

import type { Readable } from 'stream';

// =============================================================================
// S3 Error Types (for type-safe error handling)
// =============================================================================

/**
 * Type-safe interface for S3 SDK error metadata.
 * Used for inspecting HTTP status codes and request details.
 */
interface S3ErrorMetadata {
  /** HTTP status code returned by S3 */
  httpStatusCode?: number;
  /** Request ID for debugging */
  requestId?: string;
  /** Extended request ID */
  extendedRequestId?: string;
}

/**
 * Type-safe interface for S3 SDK errors.
 * AWS SDK errors contain these properties when operations fail.
 */
interface S3ErrorLike {
  /** Error name (e.g., 'NotFound', 'NoSuchKey', 'AccessDenied') */
  name?: string;
  /** Error message */
  message?: string;
  /** S3 SDK metadata with HTTP status */
  $metadata?: S3ErrorMetadata;
}

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Base error class for storage operations.
 */
export class StorageError extends GenesisError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>
  ) {
    super(message, code, statusCode, metadata);
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when a file is not found in storage.
 */
export class FileNotFoundError extends StorageError {
  constructor(key: string, bucket?: string) {
    super(`File not found: ${key}`, 'STORAGE_FILE_NOT_FOUND', 404, {
      key,
      bucket,
    });
    this.name = 'FileNotFoundError';
  }
}

/**
 * Error thrown when file validation fails.
 */
export class FileValidationError extends StorageError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'STORAGE_VALIDATION_ERROR', 400, { errors });
    this.name = 'FileValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when file size exceeds limits.
 */
export class FileSizeError extends StorageError {
  constructor(size: number, maxSize: number) {
    super(
      `File size ${formatBytes(size)} exceeds maximum allowed size ${formatBytes(maxSize)}`,
      'STORAGE_FILE_TOO_LARGE',
      413,
      { size, maxSize }
    );
    this.name = 'FileSizeError';
  }
}

/**
 * Error thrown when MIME type is not allowed.
 */
export class MimeTypeError extends StorageError {
  constructor(mimeType: string, allowedTypes: string[]) {
    super(
      `MIME type '${mimeType}' is not allowed`,
      'STORAGE_INVALID_MIME_TYPE',
      415,
      { mimeType, allowedTypes }
    );
    this.name = 'MimeTypeError';
  }
}

/**
 * Error thrown when storage configuration is invalid.
 */
export class StorageConfigError extends StorageError {
  constructor(message: string) {
    super(message, 'STORAGE_CONFIG_ERROR', 500);
    this.name = 'StorageConfigError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for S3-compatible storage operations.
 */
export interface StorageService {
  // Upload operations

  /**
   * Uploads a file to storage.
   *
   * @param input - Upload input containing file data and metadata
   * @returns Upload result with URL and metadata
   * @throws {FileValidationError} If validation fails
   * @throws {FileSizeError} If file exceeds size limit
   * @throws {MimeTypeError} If MIME type is not allowed
   */
  uploadFile(input: UploadInput): Promise<UploadResult>;

  /**
   * Uploads a file from a URL.
   *
   * @param url - Source URL to fetch file from
   * @param options - Upload options
   * @returns Upload result with URL and metadata
   */
  uploadFromUrl(url: string, options?: UploadOptions): Promise<UploadResult>;

  /**
   * Uploads a buffer to storage.
   *
   * @param buffer - File content as Buffer
   * @param options - Buffer upload options
   * @returns Upload result with URL and metadata
   */
  uploadBuffer(
    buffer: Buffer,
    options: BufferUploadOptions
  ): Promise<UploadResult>;

  // Download operations

  /**
   * Gets a file stream for downloading.
   *
   * @param key - S3 object key
   * @returns File stream with metadata
   * @throws {FileNotFoundError} If file doesn't exist
   */
  getFile(key: string): Promise<FileStream>;

  /**
   * Gets a URL to access a file.
   *
   * @param key - S3 object key
   * @param options - URL generation options
   * @returns Public or presigned URL
   */
  getFileUrl(key: string, options?: UrlOptions): Promise<string>;

  /**
   * Generates a presigned URL for direct upload.
   *
   * @param key - Target S3 object key
   * @param options - Signed URL options
   * @returns Signed upload URL with metadata
   */
  getSignedUploadUrl(
    key: string,
    options?: SignedUrlOptions
  ): Promise<SignedUploadUrl>;

  // Management operations

  /**
   * Deletes a file from storage.
   *
   * @param key - S3 object key
   * @throws {FileNotFoundError} If file doesn't exist
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Deletes multiple files from storage.
   *
   * @param keys - Array of S3 object keys
   */
  deleteFiles(keys: string[]): Promise<void>;

  /**
   * Copies a file to a new location.
   *
   * @param sourceKey - Source S3 object key
   * @param destKey - Destination S3 object key
   * @throws {FileNotFoundError} If source file doesn't exist
   */
  copyFile(sourceKey: string, destKey: string): Promise<void>;

  /**
   * Moves a file to a new location.
   *
   * @param sourceKey - Source S3 object key
   * @param destKey - Destination S3 object key
   * @throws {FileNotFoundError} If source file doesn't exist
   */
  moveFile(sourceKey: string, destKey: string): Promise<void>;

  // Metadata operations

  /**
   * Gets file metadata without downloading content.
   *
   * @param key - S3 object key
   * @returns File metadata
   * @throws {FileNotFoundError} If file doesn't exist
   */
  getFileMetadata(key: string): Promise<FileMetadata>;

  /**
   * Lists files with a given prefix.
   *
   * @param prefix - Key prefix to filter by
   * @param options - List options
   * @returns Paginated file list
   */
  listFiles(prefix: string, options?: ListOptions): Promise<FileListResult>;

  /**
   * Checks if a file exists.
   *
   * @param key - S3 object key
   * @returns True if file exists
   */
  fileExists(key: string): Promise<boolean>;

  // Utility methods

  /**
   * Generates an S3 key for a file.
   *
   * @param options - Key generation options
   * @returns Generated S3 key
   */
  generateKey(options: KeyGenerationOptions): string;

  /**
   * Gets the current storage configuration.
   *
   * @returns Storage configuration (credentials redacted)
   */
  getConfig(): Omit<StorageConfig, 'credentials'>;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * S3-compatible storage service implementation.
 */
export class StorageServiceImpl implements StorageService {
  private readonly client: S3Client;
  private readonly config: StorageConfig;

  /**
   * Creates a new StorageServiceImpl instance.
   *
   * @param config - Storage configuration
   */
  constructor(config: StorageConfig) {
    this.validateConfig(config);
    this.config = {
      ...config,
      maxFileSize: config.maxFileSize ?? DEFAULT_STORAGE_CONFIG.maxFileSize,
      signedUrlExpiration:
        config.signedUrlExpiration ??
        DEFAULT_STORAGE_CONFIG.signedUrlExpiration,
      defaultACL: config.defaultACL ?? DEFAULT_STORAGE_CONFIG.defaultACL,
      allowedMimeTypes:
        config.allowedMimeTypes ?? DEFAULT_STORAGE_CONFIG.allowedMimeTypes,
    };

    // Build S3 client configuration
    const clientConfig: S3ClientConfig = {
      region: config.region,
      credentials: {
        accessKeyId: config.credentials.accessKeyId,
        secretAccessKey: config.credentials.secretAccessKey,
        sessionToken: config.credentials.sessionToken,
      },
    };

    // Add endpoint for R2/MinIO
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    // Force path style for MinIO
    if (config.forcePathStyle || config.provider === 'minio') {
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
  }

  // ===========================================================================
  // Upload Operations
  // ===========================================================================

  /**
   * Uploads a file to storage.
   */
  async uploadFile(input: UploadInput): Promise<UploadResult> {
    // Validate input
    this.validateUploadInput(input);

    // Determine file size
    const size = Buffer.isBuffer(input.file)
      ? input.file.length
      : await this.getStreamSize(input.file);

    // Validate size
    this.validateFileSize(size, input.contentType);

    // Validate MIME type
    this.validateMimeType(input.contentType);

    // Build upload command
    const commandInput: PutObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: input.key,
      Body: input.file,
      ContentType: input.contentType,
      Metadata: input.metadata,
    };

    // Add ACL if not using R2 (R2 doesn't support ACL)
    // Use input.acl if provided, otherwise fall back to config.defaultACL
    const acl = input.acl ?? this.config.defaultACL;
    if (this.config.provider !== 'r2' && acl) {
      commandInput.ACL = acl;
    }

    // Add cache control
    if (input.cacheControl) {
      commandInput.CacheControl = input.cacheControl;
    }

    // Add content disposition
    if (input.contentDisposition) {
      commandInput.ContentDisposition = input.contentDisposition;
    }

    try {
      const command = new PutObjectCommand(commandInput);
      const response = await this.client.send(command);

      // Build result URL
      const url = await this.getFileUrl(input.key);

      return {
        key: input.key,
        url,
        size,
        contentType: input.contentType,
        etag: response.ETag?.replace(/"/g, '') ?? '',
        bucket: this.config.bucket,
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.handleS3Error(error, 'uploadFile', input.key);
    }
  }

  /**
   * Uploads a file from a URL.
   */
  async uploadFromUrl(
    url: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Fetch the file
      const response = await fetch(url);

      if (!response.ok) {
        throw new StorageError(
          `Failed to fetch file from URL: ${response.status} ${response.statusText}`,
          'STORAGE_FETCH_ERROR',
          502,
          { url, status: response.status }
        );
      }

      // Get content type from response or options
      const contentType =
        options?.contentType ??
        response.headers.get('content-type') ??
        'application/octet-stream';

      // Generate key if not provided
      const key = options?.key ?? this.generateKeyFromUrl(url);

      // Get file content as buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      return this.uploadFile({
        file: buffer,
        key,
        contentType,
        metadata: options?.metadata,
        acl: options?.acl,
      });
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(
        `Failed to upload from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STORAGE_URL_UPLOAD_ERROR',
        500,
        { url }
      );
    }
  }

  /**
   * Uploads a buffer to storage.
   */
  async uploadBuffer(
    buffer: Buffer,
    options: BufferUploadOptions
  ): Promise<UploadResult> {
    return this.uploadFile({
      file: buffer,
      key: options.key,
      contentType: options.contentType,
      metadata: {
        ...options.metadata,
        ...(options.filename && { originalFilename: options.filename }),
      },
      acl: options.acl,
    });
  }

  // ===========================================================================
  // Download Operations
  // ===========================================================================

  /**
   * Gets a file stream for downloading.
   */
  async getFile(key: string): Promise<FileStream> {
    const commandInput: GetObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: key,
    };

    try {
      const command = new GetObjectCommand(commandInput);
      const response = await this.client.send(command);

      if (!response.Body) {
        throw new FileNotFoundError(key, this.config.bucket);
      }

      return {
        stream: response.Body as Readable,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        lastModified: response.LastModified ?? new Date(),
        etag: response.ETag?.replace(/"/g, '') ?? '',
        metadata: response.Metadata,
      };
    } catch (error) {
      throw this.handleS3Error(error, 'getFile', key);
    }
  }

  /**
   * Gets a URL to access a file.
   */
  async getFileUrl(key: string, options?: UrlOptions): Promise<string> {
    // If public URL base is configured and no custom options, return public URL
    if (this.config.publicUrlBase && !options?.expiresIn) {
      return `${this.config.publicUrlBase.replace(/\/$/, '')}/${key}`;
    }

    // Generate presigned URL
    const commandInput: GetObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: key,
    };

    if (options?.responseContentType) {
      commandInput.ResponseContentType = options.responseContentType;
    }

    if (options?.responseContentDisposition) {
      commandInput.ResponseContentDisposition =
        options.responseContentDisposition;
    }

    try {
      const command = new GetObjectCommand(commandInput);
      const url = await getSignedUrl(this.client, command, {
        expiresIn: options?.expiresIn ?? this.config.signedUrlExpiration,
      });

      return url;
    } catch (error) {
      throw this.handleS3Error(error, 'getFileUrl', key);
    }
  }

  /**
   * Generates a presigned URL for direct upload.
   */
  async getSignedUploadUrl(
    key: string,
    options?: SignedUrlOptions
  ): Promise<SignedUploadUrl> {
    const expiresIn =
      options?.expiresIn ?? this.config.signedUrlExpiration ?? 3600;

    const commandInput: PutObjectCommandInput = {
      Bucket: this.config.bucket,
      Key: key,
    };

    if (options?.contentType) {
      commandInput.ContentType = options.contentType;
    }

    if (options?.metadata) {
      commandInput.Metadata = options.metadata;
    }

    // Add ACL if supported
    if (this.config.provider !== 'r2' && options?.acl) {
      commandInput.ACL = options.acl;
    }

    try {
      const command = new PutObjectCommand(commandInput);
      const url = await getSignedUrl(this.client, command, { expiresIn });

      // Calculate expiration timestamp
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Build headers for PUT request
      const headers: Record<string, string> = {};
      if (options?.contentType) {
        headers['Content-Type'] = options.contentType;
      }
      if (options?.maxContentLength) {
        headers['Content-Length'] = String(options.maxContentLength);
      }

      return {
        url,
        key,
        expiresAt,
        method: 'PUT',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    } catch (error) {
      throw this.handleS3Error(error, 'getSignedUploadUrl', key);
    }
  }

  // ===========================================================================
  // Management Operations
  // ===========================================================================

  /**
   * Deletes a file from storage.
   */
  async deleteFile(key: string): Promise<void> {
    // First check if file exists
    const exists = await this.fileExists(key);
    if (!exists) {
      throw new FileNotFoundError(key, this.config.bucket);
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      throw this.handleS3Error(error, 'deleteFile', key);
    }
  }

  /**
   * Deletes multiple files from storage.
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    // S3 DeleteObjects has a limit of 1000 keys per request
    const chunks = this.chunkArray(keys, 1000);

    try {
      for (const chunk of chunks) {
        const command = new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: {
            Objects: chunk.map(Key => ({ Key })),
            Quiet: true,
          },
        });

        await this.client.send(command);
      }
    } catch (error) {
      throw this.handleS3Error(error, 'deleteFiles', keys.join(', '));
    }
  }

  /**
   * Copies a file to a new location.
   */
  async copyFile(sourceKey: string, destKey: string): Promise<void> {
    // Check source exists
    const exists = await this.fileExists(sourceKey);
    if (!exists) {
      throw new FileNotFoundError(sourceKey, this.config.bucket);
    }

    try {
      const command = new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey}`,
        Key: destKey,
      });

      await this.client.send(command);
    } catch (error) {
      throw this.handleS3Error(error, 'copyFile', sourceKey);
    }
  }

  /**
   * Moves a file to a new location.
   */
  async moveFile(sourceKey: string, destKey: string): Promise<void> {
    // Copy first, then delete
    await this.copyFile(sourceKey, destKey);

    try {
      await this.deleteFile(sourceKey);
    } catch {
      // Try to clean up the copy if delete fails
      try {
        await this.deleteFile(destKey);
      } catch {
        // Ignore cleanup errors
      }
      throw new StorageError(
        'Failed to move file: could not delete source after copy',
        'STORAGE_MOVE_ERROR',
        500,
        { sourceKey, destKey }
      );
    }
  }

  // ===========================================================================
  // Metadata Operations
  // ===========================================================================

  /**
   * Gets file metadata without downloading content.
   */
  async getFileMetadata(key: string): Promise<FileMetadata> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        size: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        lastModified: response.LastModified ?? new Date(),
        etag: response.ETag?.replace(/"/g, '') ?? '',
        metadata: response.Metadata,
        storageClass: response.StorageClass,
        versionId: response.VersionId,
      };
    } catch (error) {
      throw this.handleS3Error(error, 'getFileMetadata', key);
    }
  }

  /**
   * Lists files with a given prefix.
   */
  async listFiles(
    prefix: string,
    options?: ListOptions
  ): Promise<FileListResult> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: options?.maxKeys ?? 1000,
        ContinuationToken: options?.continuationToken,
        Delimiter: options?.delimiter,
        StartAfter: options?.startAfter,
      });

      const response = await this.client.send(command);

      const files: FileMetadata[] = (response.Contents ?? []).map(item => ({
        key: item.Key ?? '',
        size: item.Size ?? 0,
        contentType: 'application/octet-stream', // Not available in list response
        lastModified: item.LastModified ?? new Date(),
        etag: item.ETag?.replace(/"/g, '') ?? '',
        storageClass: item.StorageClass,
      }));

      return {
        files,
        prefixes: (response.CommonPrefixes ?? []).map(p => p.Prefix ?? ''),
        nextContinuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated ?? false,
        keyCount: response.KeyCount ?? 0,
      };
    } catch (error) {
      throw this.handleS3Error(error, 'listFiles', prefix);
    }
  }

  /**
   * Checks if a file exists.
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw this.handleS3Error(error, 'fileExists', key);
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Generates an S3 key for a file.
   *
   * Key format: {workspaceId}/{channelId?}/{year}/{month}/{uuid}/{filename}
   */
  generateKey(options: KeyGenerationOptions): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = createId();

    // Sanitize filename
    const sanitizedFilename = this.sanitizeFilename(options.filename);

    // Build path parts
    const parts: string[] = [];

    if (options.prefix) {
      parts.push(options.prefix);
    }

    parts.push(options.workspaceId);

    if (options.channelId) {
      parts.push(options.channelId);
    }

    parts.push(String(year), month, uuid, sanitizedFilename);

    return parts.join('/');
  }

  /**
   * Gets the current storage configuration (credentials redacted).
   */
  getConfig(): Omit<StorageConfig, 'credentials'> {
    const { credentials: _, ...safeConfig } = this.config;
    return safeConfig;
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Validates storage configuration.
   */
  private validateConfig(config: StorageConfig): void {
    const errors: string[] = [];

    if (!config.bucket) {
      errors.push('Bucket name is required');
    }

    if (!config.region) {
      errors.push('Region is required');
    }

    if (!config.credentials?.accessKeyId) {
      errors.push('Access key ID is required');
    }

    if (!config.credentials?.secretAccessKey) {
      errors.push('Secret access key is required');
    }

    if (!['s3', 'r2', 'minio'].includes(config.provider)) {
      errors.push('Invalid provider. Must be s3, r2, or minio');
    }

    if (
      (config.provider === 'r2' || config.provider === 'minio') &&
      !config.endpoint
    ) {
      errors.push(`Endpoint is required for ${config.provider} provider`);
    }

    if (errors.length > 0) {
      throw new StorageConfigError(
        `Invalid storage configuration: ${errors.join(', ')}`
      );
    }
  }

  /**
   * Validates upload input.
   */
  private validateUploadInput(input: UploadInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.file) {
      errors.file = ['File content is required'];
    }

    if (!input.key || input.key.trim().length === 0) {
      errors.key = ['Object key is required'];
    }

    if (!input.contentType || input.contentType.trim().length === 0) {
      errors.contentType = ['Content type is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new FileValidationError('Upload validation failed', errors);
    }
  }

  /**
   * Validates file size against limits.
   */
  private validateFileSize(size: number, contentType: string): void {
    const maxSize =
      this.config.maxFileSize ?? getMaxFileSizeForType(contentType);

    if (size > maxSize) {
      throw new FileSizeError(size, maxSize);
    }
  }

  /**
   * Validates MIME type against allowed types.
   */
  private validateMimeType(mimeType: string): void {
    const allowedTypes = this.config.allowedMimeTypes ?? [];

    if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
      throw new MimeTypeError(mimeType, allowedTypes);
    }
  }

  /**
   * Gets the size of a readable stream.
   */
  private async getStreamSize(stream: Readable): Promise<number> {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        chunks.push(chunk);
      });

      stream.on('end', () => resolve(size));
      stream.on('error', reject);
    });
  }

  /**
   * Generates a key from a URL.
   */
  private generateKeyFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const filename = pathname.split('/').pop() || 'file';
      const extension = filename.split('.').pop() || '';
      const uuid = createId();

      return `downloads/${uuid}/${filename}${extension ? '' : `.${extension}`}`;
    } catch {
      const uuid = createId();
      return `downloads/${uuid}/file`;
    }
  }

  /**
   * Sanitizes a filename for use in S3 keys.
   */
  private sanitizeFilename(filename: string): string {
    // Remove path separators and special characters
    let sanitized = filename
      .replace(/[/\\]/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Ensure filename is not empty
    if (!sanitized) {
      const extension = getMimeTypeFromExtension(filename) || 'bin';
      sanitized = `file.${extension}`;
    }

    // Limit length
    if (sanitized.length > 255) {
      const extension = sanitized.split('.').pop() || '';
      const base = sanitized.slice(0, 255 - extension.length - 1);
      sanitized = extension ? `${base}.${extension}` : base;
    }

    return sanitized;
  }

  /**
   * Chunks an array into smaller arrays.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Checks if an error is a "not found" error from S3.
   *
   * S3 returns NotFound or NoSuchKey errors when a file doesn't exist.
   * Also checks the HTTP status code in the metadata.
   *
   * @param error - The error to check
   * @returns True if this is a "not found" error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as S3ErrorLike;
      return (
        err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
      );
    }
    return false;
  }

  /**
   * Handles S3 errors and converts them to StorageError.
   */
  private handleS3Error(error: unknown, operation: string, key: string): never {
    if (error instanceof StorageError) {
      throw error;
    }

    if (this.isNotFoundError(error)) {
      throw new FileNotFoundError(key, this.config.bucket);
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    throw new StorageError(
      `Storage operation '${operation}' failed: ${errorMessage}`,
      `STORAGE_${errorName.toUpperCase()}`,
      500,
      { operation, key, originalError: errorMessage }
    );
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a storage service from environment variables.
 *
 * Required environment variables:
 * - STORAGE_PROVIDER: 's3' | 'r2' | 'minio'
 * - STORAGE_BUCKET: S3 bucket name
 * - STORAGE_REGION: AWS region
 * - MY_AWS_ACCESS_KEY_ID or STORAGE_ACCESS_KEY_ID
 * - MY_AWS_SECRET_ACCESS_KEY or STORAGE_SECRET_ACCESS_KEY
 *
 * Optional environment variables:
 * - STORAGE_ENDPOINT: Custom endpoint for R2/MinIO
 * - STORAGE_PUBLIC_URL: Base URL for public file access
 * - STORAGE_MAX_FILE_SIZE: Maximum file size in bytes
 *
 * @returns Storage service instance
 * @throws {StorageConfigError} If required environment variables are missing
 */
export function createStorageServiceFromEnv(): StorageServiceImpl {
  const provider = (process.env.STORAGE_PROVIDER ||
    's3') as StorageConfig['provider'];
  const bucket = process.env.STORAGE_BUCKET;
  const region =
    process.env.STORAGE_REGION || process.env.MY_AWS_REGION || 'us-east-1';
  const accessKeyId =
    process.env.STORAGE_ACCESS_KEY_ID || process.env.MY_AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.STORAGE_SECRET_ACCESS_KEY ||
    process.env.MY_AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const publicUrlBase = process.env.STORAGE_PUBLIC_URL;
  const maxFileSize = process.env.STORAGE_MAX_FILE_SIZE
    ? parseInt(process.env.STORAGE_MAX_FILE_SIZE, 10)
    : undefined;
  // Default to 'public-read' for user-facing files (avatars, icons, etc.)
  const defaultACL = (process.env.STORAGE_DEFAULT_ACL || 'public-read') as
    | 'private'
    | 'public-read';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new StorageConfigError(
      'Missing required storage environment variables: STORAGE_BUCKET, access key, and secret key'
    );
  }

  return new StorageServiceImpl({
    provider,
    bucket,
    region,
    endpoint,
    publicUrlBase,
    maxFileSize,
    defaultACL,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Creates a storage service instance with the given configuration.
 *
 * @param config - Storage configuration
 * @returns Storage service instance
 *
 * @example
 * ```typescript
 * const storage = createStorageService({
 *   provider: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   credentials: {
 *     accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
 *     secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
 *   },
 * });
 *
 * // Upload a file
 * const result = await storage.uploadFile({
 *   file: Buffer.from('Hello, World!'),
 *   key: 'hello.txt',
 *   contentType: 'text/plain',
 * });
 *
 * console.log('File uploaded:', result.url);
 * ```
 */
export function createStorageService(
  config: StorageConfig
): StorageServiceImpl {
  return new StorageServiceImpl(config);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Formats bytes into human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// =============================================================================
// Singleton (lazy initialization)
// =============================================================================

let storageServiceInstance: StorageServiceImpl | null = null;

/**
 * Gets or creates the default storage service instance.
 * Initializes from environment variables on first call.
 *
 * @returns Storage service instance
 * @throws {StorageConfigError} If environment is not configured
 */
export function getStorageService(): StorageServiceImpl {
  if (!storageServiceInstance) {
    storageServiceInstance = createStorageServiceFromEnv();
  }
  return storageServiceInstance;
}

/**
 * Default storage service instance (lazy-loaded from environment).
 * Use `getStorageService()` for explicit initialization.
 *
 * This proxy delays initialization until first method call, allowing
 * environment variables to be set after module import.
 */
export const storageService: StorageService = new Proxy({} as StorageService, {
  get(_target, prop: string | symbol) {
    const service = getStorageService();
    const key = prop as keyof StorageServiceImpl;
    const member = service[key];
    if (typeof member === 'function') {
      // Bind the method to the service instance
      // Using Function.prototype.bind which returns a bound function
      return (member as (...args: unknown[]) => unknown).bind(service);
    }
    return member;
  },
});
