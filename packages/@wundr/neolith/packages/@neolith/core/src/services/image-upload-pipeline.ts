/**
 * @genesis/core - Image Upload Pipeline
 *
 * End-to-end pipeline for image upload processing including validation,
 * optimization, thumbnail generation, S3 upload, and database record creation.
 *
 * @packageDocumentation
 */

import { prisma } from '@genesis/database';

import {
  ImageValidationError,
  createImageService,
  type ImageService,
} from './image-service';
import {
  DEFAULT_VARIANTS,
  DEFAULT_VALIDATION_OPTIONS,
  IMAGE_MIME_TYPES,
} from '../types/image';
import { generateCUID } from '../utils';

import type {
  ImageUploadInput,
  ImageUploadResult,
  ImageVariant,
  ImageMetadata,
  ImageValidationOptions,
  VariantConfig,
  ImageFormat,
} from '../types/image';
import type { PrismaClient } from '@genesis/database';

// =============================================================================
// S3 Client Interface (to be implemented by consumer)
// =============================================================================

/**
 * Interface for S3 upload operations.
 * This interface should be implemented by the consuming application
 * to integrate with their S3 configuration.
 */
export interface S3Client {
  /**
   * Uploads a buffer to S3.
   *
   * @param key - S3 object key
   * @param buffer - File buffer
   * @param contentType - MIME type
   * @returns Public URL of uploaded object
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;

  /**
   * Deletes an object from S3.
   *
   * @param key - S3 object key
   */
  delete(key: string): Promise<void>;

  /**
   * Gets a signed URL for private access.
   *
   * @param key - S3 object key
   * @param expiresIn - Expiration time in seconds
   * @returns Signed URL
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Gets the bucket name.
   */
  getBucketName(): string;
}

// =============================================================================
// Pipeline Configuration
// =============================================================================

/**
 * Configuration for the image upload pipeline.
 */
export interface ImageUploadPipelineConfig {
  /** S3 client instance */
  s3Client: S3Client;
  /** Prisma client instance (optional, uses default) */
  prismaClient?: PrismaClient;
  /** Image service instance (optional, uses default) */
  imageService?: ImageService;
  /** S3 bucket prefix for organization */
  bucketPrefix?: string;
  /** Default variant configurations */
  defaultVariants?: VariantConfig[];
  /** Validation options */
  validationOptions?: ImageValidationOptions;
  /** Whether to strip EXIF by default */
  stripExifByDefault?: boolean;
  /** Preferred output format (null = keep original) */
  preferredFormat?: ImageFormat | null;
}

/**
 * Default pipeline configuration.
 */
const DEFAULT_CONFIG: Partial<ImageUploadPipelineConfig> = {
  bucketPrefix: 'uploads',
  defaultVariants: DEFAULT_VARIANTS,
  validationOptions: DEFAULT_VALIDATION_OPTIONS,
  stripExifByDefault: true,
  preferredFormat: null,
};

// =============================================================================
// Pipeline Errors
// =============================================================================

/**
 * Error thrown when upload pipeline fails.
 */
export class ImageUploadError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'ImageUploadError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error thrown when S3 upload fails.
 */
export class S3UploadError extends ImageUploadError {
  constructor(key: string, cause?: Error) {
    super(`Failed to upload to S3: ${key}`, 'S3_UPLOAD_ERROR', cause);
    this.name = 'S3UploadError';
  }
}

/**
 * Error thrown when database operation fails.
 */
export class DatabaseRecordError extends ImageUploadError {
  constructor(operation: string, cause?: Error) {
    super(`Database operation failed: ${operation}`, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseRecordError';
  }
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Variant metadata stored in file record.
 * Contains the S3 key and public URL for each generated variant.
 */
interface VariantMetadata {
  /** S3 object key for the variant */
  key: string;
  /** Public URL of the variant */
  url: string;
}

/**
 * File record metadata structure.
 * Contains image-specific metadata and variant information.
 */
interface FileRecordMetadata {
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** Image format (jpeg, png, webp, etc.) */
  format: string;
  /** Whether image has alpha channel */
  hasAlpha: boolean;
  /** Whether image is animated (GIF, APNG) */
  isAnimated: boolean;
  /** Organization ID the file belongs to */
  organizationId: string;
  /** Optional channel ID if uploaded to a channel */
  channelId?: string;
  /** Optional message ID if attached to a message */
  messageId?: string;
  /** Generated variants with their S3 keys and URLs */
  variants: Record<string, VariantMetadata>;
  /** Additional custom metadata provided during upload */
  [key: string]: unknown;
}

/**
 * Internal representation of file record from database.
 */
interface FileRecord {
  /** Unique file identifier */
  id: string;
  /** Sanitized filename with extension */
  filename: string;
  /** Original filename as uploaded */
  originalName: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  size: bigint;
  /** S3 object key for the original file */
  s3Key: string;
  /** S3 bucket name */
  s3Bucket: string;
  /** URL of the thumbnail variant */
  thumbnailUrl: string | null;
  /** Creation timestamp */
  createdAt: Date;
  /** File metadata including variants */
  metadata: FileRecordMetadata;
}

/**
 * Uploaded variants result structure.
 */
interface UploadedVariants {
  original: { key: string; url: string };
  thumbnail: { key: string; url: string };
  variants: Record<string, { key: string; url: string }>;
}

// =============================================================================
// Image Upload Pipeline Implementation
// =============================================================================

/**
 * End-to-end image upload processing pipeline.
 *
 * @example
 * ```typescript
 * const pipeline = new ImageUploadPipeline({
 *   s3Client: myS3Client,
 * });
 *
 * const result = await pipeline.process({
 *   buffer: imageBuffer,
 *   filename: 'photo.jpg',
 *   mimeType: 'image/jpeg',
 *   uploaderId: 'user_123',
 *   organizationId: 'org_456',
 *   workspaceId: 'ws_789',
 * });
 *
 * console.log('Uploaded:', result.url);
 * console.log('Thumbnail:', result.thumbnailUrl);
 * ```
 */
export class ImageUploadPipeline {
  private readonly s3Client: S3Client;
  private readonly prisma: PrismaClient;
  private readonly imageService: ImageService;
  private readonly config: Required<
    Pick<
      ImageUploadPipelineConfig,
      | 'bucketPrefix'
      | 'defaultVariants'
      | 'validationOptions'
      | 'stripExifByDefault'
      | 'preferredFormat'
    >
  >;

  /**
   * Creates a new ImageUploadPipeline instance.
   *
   * @param config - Pipeline configuration
   */
  constructor(config: ImageUploadPipelineConfig) {
    this.s3Client = config.s3Client;
    this.prisma = config.prismaClient ?? prisma;
    this.imageService = config.imageService ?? createImageService();
    this.config = {
      bucketPrefix: config.bucketPrefix ?? DEFAULT_CONFIG.bucketPrefix!,
      defaultVariants: config.defaultVariants ?? DEFAULT_CONFIG.defaultVariants!,
      validationOptions: config.validationOptions ?? DEFAULT_CONFIG.validationOptions!,
      stripExifByDefault: config.stripExifByDefault ?? DEFAULT_CONFIG.stripExifByDefault!,
      preferredFormat: config.preferredFormat ?? DEFAULT_CONFIG.preferredFormat!,
    };
  }

  /**
   * Processes an image upload through the complete pipeline.
   *
   * Steps:
   * 1. Validate image type and size
   * 2. Extract metadata
   * 3. Strip EXIF if configured
   * 4. Generate variants (thumbnails, optimized)
   * 5. Upload all variants to S3
   * 6. Create file records in database
   * 7. Return URLs and metadata
   *
   * @param input - Upload input data
   * @returns Upload result with URLs and metadata
   */
  async process(input: ImageUploadInput): Promise<ImageUploadResult> {
    // 1. Validate image
    const validationResult = await this.imageService.validateImage(
      input.buffer,
      this.config.validationOptions,
    );

    if (!validationResult.valid) {
      throw new ImageValidationError(
        'Image validation failed',
        validationResult.errors,
      );
    }

    // 2. Extract metadata
    const metadata = await this.imageService.getImageMetadata(input.buffer);

    // 3. Strip EXIF if configured
    const shouldStripExif = input.stripExif ?? this.config.stripExifByDefault;
    const processedBuffer = shouldStripExif
      ? await this.imageService.stripExif(input.buffer)
      : input.buffer;

    // 4. Generate variants
    const variantConfigs = input.variants ?? this.config.defaultVariants;
    const variants = await this.imageService.generateVariants(
      processedBuffer,
      variantConfigs,
    );

    // Also optimize the original
    const originalVariant = await this.createOriginalVariant(
      processedBuffer,
      metadata,
      validationResult.detectedFormat ?? 'jpeg',
    );

    // 5. Generate file ID and paths
    const fileId = generateCUID();
    const timestamp = Date.now();
    const basePath = this.generateBasePath(input, fileId, timestamp);

    // 6. Upload all variants to S3
    const uploadedVariants = await this.uploadVariants(
      basePath,
      originalVariant,
      variants,
      input.filename,
    );

    // 7. Create database record
    const fileRecord = await this.createFileRecord(
      fileId,
      input,
      uploadedVariants,
      metadata,
    );

    // 8. Build and return result
    return this.buildResult(fileRecord, uploadedVariants, metadata);
  }

  /**
   * Deletes an uploaded image and all its variants.
   *
   * @param fileId - The file ID to delete
   */
  async delete(fileId: string): Promise<void> {
    // Get file record
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return; // File doesn't exist, nothing to delete
    }

    // Parse variants from metadata
    const variantKeys = this.extractVariantKeys(file.metadata as FileRecordMetadata);

    // Delete from S3
    const deletePromises: Promise<void>[] = [];

    // Delete original
    deletePromises.push(this.s3Client.delete(file.s3Key));

    // Delete variants
    for (const key of variantKeys) {
      deletePromises.push(this.s3Client.delete(key));
    }

    await Promise.all(deletePromises);

    // Delete database record
    await this.prisma.file.delete({
      where: { id: fileId },
    });
  }

  /**
   * Gets signed URLs for a file and its variants.
   *
   * @param fileId - The file ID
   * @param expiresIn - URL expiration in seconds (default: 3600)
   * @returns Object with signed URLs
   */
  async getSignedUrls(
    fileId: string,
    expiresIn = 3600,
  ): Promise<{ original: string; variants: Record<string, string> }> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new ImageUploadError(`File not found: ${fileId}`, 'FILE_NOT_FOUND');
    }

    const variantKeys = this.extractVariantKeys(file.metadata as FileRecordMetadata);

    const [originalUrl, ...variantUrls] = await Promise.all([
      this.s3Client.getSignedUrl(file.s3Key, expiresIn),
      ...variantKeys.map((key) => this.s3Client.getSignedUrl(key, expiresIn)),
    ]);

    const variants: Record<string, string> = {};
    const variantNames = this.extractVariantNames(file.metadata as FileRecordMetadata);
    variantUrls.forEach((url, index) => {
      const name = variantNames[index];
      if (name) {
        variants[name] = url;
      }
    });

    return {
      original: originalUrl,
      variants,
    };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Creates an optimized original variant.
   */
  private async createOriginalVariant(
    buffer: Buffer,
    metadata: ImageMetadata,
    format: ImageFormat,
  ): Promise<ImageVariant> {
    const optimizedBuffer = await this.imageService.optimizeImage(buffer, {
      format: this.config.preferredFormat ?? format,
      progressive: true,
    });

    return {
      buffer: optimizedBuffer,
      width: metadata.width,
      height: metadata.height,
      size: optimizedBuffer.length,
      format: this.config.preferredFormat ?? format,
      name: 'original',
    };
  }

  /**
   * Generates the base S3 path for uploads.
   */
  private generateBasePath(
    input: ImageUploadInput,
    fileId: string,
    timestamp: number,
  ): string {
    const parts = [this.config.bucketPrefix, input.organizationId];

    if (input.workspaceId) {
      parts.push(input.workspaceId);
    }

    if (input.channelId) {
      parts.push(input.channelId);
    }

    // Add date-based partitioning
    const date = new Date(timestamp);
    parts.push(
      date.getUTCFullYear().toString(),
      (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      date.getUTCDate().toString().padStart(2, '0'),
    );

    parts.push(fileId);

    return parts.join('/');
  }

  /**
   * Uploads all variants to S3.
   */
  private async uploadVariants(
    basePath: string,
    original: ImageVariant,
    variants: ImageVariant[],
    originalFilename: string,
  ): Promise<UploadedVariants> {
    const extension = this.getExtension(original.format);
    const baseFilename = this.sanitizeFilename(originalFilename);

    // Upload original
    const originalKey = `${basePath}/${baseFilename}.${extension}`;
    const originalUrl = await this.uploadToS3(
      originalKey,
      original.buffer,
      IMAGE_MIME_TYPES[original.format],
    );

    // Upload variants
    const variantResults: Record<string, { key: string; url: string }> = {};
    let thumbnailResult: { key: string; url: string } | null = null;

    await Promise.all(
      variants.map(async (variant) => {
        const variantKey = `${basePath}/${baseFilename}_${variant.name}.${this.getExtension(variant.format)}`;
        const url = await this.uploadToS3(
          variantKey,
          variant.buffer,
          IMAGE_MIME_TYPES[variant.format],
        );

        variantResults[variant.name ?? 'unknown'] = { key: variantKey, url };

        // Use thumb_md as primary thumbnail
        if (variant.name === 'thumb_md') {
          thumbnailResult = { key: variantKey, url };
        }
      }),
    );

    // Fallback if no thumb_md
    if (!thumbnailResult) {
      thumbnailResult = variantResults['thumb_sm'] ??
                        variantResults['thumb_lg'] ??
                        { key: originalKey, url: originalUrl };
    }

    return {
      original: { key: originalKey, url: originalUrl },
      thumbnail: thumbnailResult,
      variants: variantResults,
    };
  }

  /**
   * Uploads a single buffer to S3.
   */
  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      return await this.s3Client.upload(key, buffer, contentType);
    } catch (error) {
      throw new S3UploadError(key, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Creates a file record in the database.
   * Uses the actual Prisma File schema fields.
   */
  private async createFileRecord(
    fileId: string,
    input: ImageUploadInput,
    uploadedVariants: UploadedVariants,
    metadata: ImageMetadata,
  ): Promise<FileRecord> {
    try {
      const sanitizedFilename = this.sanitizeFilename(input.filename);
      const extension = this.getExtension(metadata.format as ImageFormat);

      const record = await this.prisma.file.create({
        data: {
          id: fileId,
          filename: `${sanitizedFilename}.${extension}`,
          originalName: input.filename,
          mimeType: input.mimeType,
          size: BigInt(input.buffer.length),
          s3Key: uploadedVariants.original.key,
          s3Bucket: this.s3Client.getBucketName(),
          thumbnailUrl: uploadedVariants.thumbnail.url,
          status: 'READY',
          workspaceId: input.workspaceId ?? '',
          uploadedById: input.uploaderId,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            hasAlpha: metadata.hasAlpha,
            isAnimated: metadata.isAnimated,
            organizationId: input.organizationId,
            channelId: input.channelId,
            messageId: input.messageId,
            variants: uploadedVariants.variants,
            ...input.customMetadata,
          },
        },
      });

      // Cast through unknown to handle Prisma's JsonValue type for metadata
      return record as unknown as FileRecord;
    } catch (error) {
      throw new DatabaseRecordError(
        'create file record',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Builds the final upload result.
   */
  private buildResult(
    fileRecord: FileRecord,
    uploadedVariants: UploadedVariants,
    metadata: ImageMetadata,
  ): ImageUploadResult {
    const variants: Record<string, string> = {};
    for (const [name, data] of Object.entries(uploadedVariants.variants)) {
      variants[name] = data.url;
    }

    return {
      id: fileRecord.id,
      filename: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      url: uploadedVariants.original.url,
      thumbnailUrl: uploadedVariants.thumbnail.url,
      variants,
      metadata,
      size: Number(fileRecord.size),
      width: metadata.width,
      height: metadata.height,
      createdAt: fileRecord.createdAt,
    };
  }

  /**
   * Gets file extension for a format.
   */
  private getExtension(format: ImageFormat): string {
    switch (format) {
      case 'jpeg':
        return 'jpg';
      default:
        return format;
    }
  }

  /**
   * Sanitizes a filename for S3.
   */
  private sanitizeFilename(filename: string): string {
    // Remove extension
    const name = filename.replace(/\.[^/.]+$/, '');
    // Replace unsafe characters
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100) || 'image';
  }

  /**
   * Extracts variant S3 keys from file metadata.
   *
   * @param metadata - File record metadata containing variants
   * @returns Array of S3 keys for all variants
   */
  private extractVariantKeys(metadata: FileRecordMetadata): string[] {
    const variants = metadata.variants;
    if (!variants) {
      return [];
    }
    return Object.values(variants).map((v) => v.key);
  }

  /**
   * Extracts variant names from file metadata.
   *
   * @param metadata - File record metadata containing variants
   * @returns Array of variant names
   */
  private extractVariantNames(metadata: FileRecordMetadata): string[] {
    const variants = metadata.variants;
    if (!variants) {
      return [];
    }
    return Object.keys(variants);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new ImageUploadPipeline instance.
 *
 * @param config - Pipeline configuration
 * @returns ImageUploadPipeline instance
 */
export function createImageUploadPipeline(
  config: ImageUploadPipelineConfig,
): ImageUploadPipeline {
  return new ImageUploadPipeline(config);
}
