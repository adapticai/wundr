/**
 * @genesis/core - Image Service
 *
 * Service for image processing operations including resizing, optimization,
 * format conversion, thumbnail generation, and metadata extraction.
 *
 * Uses sharp for high-performance image processing.
 * Sharp is loaded dynamically to avoid issues with Next.js Turbopack bundling.
 *
 * @packageDocumentation
 */

// Sharp types - we use 'any' for the dynamic import since sharp types are complex
// and the module is loaded dynamically at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {
  THUMBNAIL_SIZES,
  DEFAULT_QUALITY,
  MIME_TO_FORMAT,
  DEFAULT_VALIDATION_OPTIONS,
  DEFAULT_OPTIMIZE_OPTIONS,
  DEFAULT_VARIANTS,
} from '../types/image';

import type {
  ImageFormat,
  ThumbnailSize,
  ResizeOptions,
  OptimizeOptions,
  CropOptions,
  VariantConfig,
  ImageInput,
  ImageVariant,
  ProcessedImage,
  ImageMetadata,
  ExifData,
  ImageValidationResult,
  ImageValidationOptions,
  ImagePosition,
} from '../types/image';

type SharpFunction = (input?: Buffer | string, options?: object) => any;

// Lazy-loaded sharp module to avoid Turbopack bundling issues with native modules
let _sharp: SharpFunction | null = null;

/**
 * Dynamically loads the sharp module.
 * This is necessary because sharp is a native module that cannot be bundled by Turbopack.
 * @throws Error if sharp cannot be loaded (e.g., not installed or wrong platform)
 */
async function getSharp(): Promise<SharpFunction> {
  if (_sharp) {
    return _sharp;
  }

  try {
    // Dynamic import to avoid static analysis by bundlers
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharpModule = await import('sharp');
    _sharp = sharpModule.default || sharpModule;
    return _sharp;
  } catch (error) {
    throw new Error(
      'Failed to load sharp module. Ensure sharp is installed with the correct platform binaries. ' +
        'Try: npm install --include=optional sharp\n' +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// =============================================================================
// Image Service Interface
// =============================================================================

/**
 * Interface for image processing operations.
 */
export interface ImageService {
  /**
   * Processes an image with full pipeline (optimize, generate thumbnails, variants).
   *
   * @param input - Image input data
   * @returns Processed image with all variants and metadata
   */
  processImage(input: ImageInput): Promise<ProcessedImage>;

  /**
   * Resizes an image to specified dimensions.
   *
   * @param input - Image buffer
   * @param options - Resize options
   * @returns Resized image buffer
   */
  resizeImage(input: Buffer, options: ResizeOptions): Promise<Buffer>;

  /**
   * Generates a thumbnail at a predefined size.
   *
   * @param input - Image buffer
   * @param size - Thumbnail size preset
   * @returns Thumbnail buffer
   */
  generateThumbnail(input: Buffer, size: ThumbnailSize): Promise<Buffer>;

  /**
   * Optimizes an image for web delivery.
   *
   * @param input - Image buffer
   * @param options - Optimization options
   * @returns Optimized image buffer
   */
  optimizeImage(input: Buffer, options?: OptimizeOptions): Promise<Buffer>;

  /**
   * Crops an image to specified region.
   *
   * @param input - Image buffer
   * @param crop - Crop region options
   * @returns Cropped image buffer
   */
  cropImage(input: Buffer, crop: CropOptions): Promise<Buffer>;

  /**
   * Rotates an image by specified degrees.
   *
   * @param input - Image buffer
   * @param degrees - Rotation angle (0-360)
   * @returns Rotated image buffer
   */
  rotateImage(input: Buffer, degrees: number): Promise<Buffer>;

  /**
   * Converts an image to a different format.
   *
   * @param input - Image buffer
   * @param format - Target format
   * @returns Converted image buffer
   */
  convertFormat(input: Buffer, format: ImageFormat): Promise<Buffer>;

  /**
   * Extracts metadata from an image.
   *
   * @param input - Image buffer
   * @returns Image metadata
   */
  getImageMetadata(input: Buffer): Promise<ImageMetadata>;

  /**
   * Extracts EXIF data from an image.
   *
   * @param input - Image buffer
   * @returns EXIF data
   */
  extractExif(input: Buffer): Promise<ExifData>;

  /**
   * Strips EXIF metadata from an image.
   *
   * @param input - Image buffer
   * @returns Image buffer without EXIF
   */
  stripExif(input: Buffer): Promise<Buffer>;

  /**
   * Generates multiple size variants of an image.
   *
   * @param input - Image buffer
   * @param sizes - Variant configurations
   * @returns Array of image variants
   */
  generateVariants(
    input: Buffer,
    sizes: VariantConfig[]
  ): Promise<ImageVariant[]>;

  /**
   * Validates an image against specified criteria.
   *
   * @param input - Image buffer
   * @param options - Validation options
   * @returns Validation result
   */
  validateImage(
    input: Buffer,
    options?: ImageValidationOptions
  ): Promise<ImageValidationResult>;
}

// =============================================================================
// Image Processing Errors
// =============================================================================

/**
 * Base error for image processing operations.
 */
export class ImageProcessingError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Error thrown when image format is not supported.
 */
export class UnsupportedFormatError extends ImageProcessingError {
  constructor(format: string) {
    super(`Unsupported image format: ${format}`, 'UNSUPPORTED_FORMAT');
    this.name = 'UnsupportedFormatError';
  }
}

/**
 * Error thrown when image validation fails.
 */
export class ImageValidationError extends ImageProcessingError {
  constructor(
    message: string,
    public readonly errors: string[]
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ImageValidationError';
  }
}

/**
 * Error thrown when image processing operation fails.
 */
export class ImageOperationError extends ImageProcessingError {
  constructor(operation: string, cause?: Error) {
    super(
      `Image operation failed: ${operation}${cause ? ` - ${cause.message}` : ''}`,
      'OPERATION_ERROR',
      cause
    );
    this.name = 'ImageOperationError';
  }
}

// =============================================================================
// Image Service Implementation
// =============================================================================

/**
 * Implementation of the ImageService interface using sharp.
 */
export class ImageServiceImpl implements ImageService {
  /**
   * Processes an image with full pipeline.
   */
  async processImage(input: ImageInput): Promise<ProcessedImage> {
    // Detect format from buffer or mime type
    const metadata = await this.getImageMetadata(input.buffer);
    const format = this.detectFormat(input.mimeType, metadata.format);

    // Auto-orient based on EXIF
    const oriented = await this.autoOrient(input.buffer);

    // Optimize original
    const optimizedBuffer = await this.optimizeImage(oriented, {
      ...DEFAULT_OPTIMIZE_OPTIONS,
      format,
    });

    // Generate primary thumbnail (medium)
    const thumbnailBuffer = await this.generateThumbnail(oriented, 'md');
    const sharpInstance = await getSharp();
    const thumbnailMeta = await sharpInstance(thumbnailBuffer).metadata();

    // Generate all default variants
    const variants = await this.generateVariants(oriented, DEFAULT_VARIANTS);

    // Build original variant info
    const optimizedMeta = await sharpInstance(optimizedBuffer).metadata();
    const original: ImageVariant = {
      buffer: optimizedBuffer,
      width: optimizedMeta.width ?? metadata.width,
      height: optimizedMeta.height ?? metadata.height,
      size: optimizedBuffer.length,
      format,
      name: 'original',
    };

    // Build thumbnail variant info
    const thumbnail: ImageVariant = {
      buffer: thumbnailBuffer,
      width: thumbnailMeta.width ?? THUMBNAIL_SIZES.md.width,
      height: thumbnailMeta.height ?? THUMBNAIL_SIZES.md.height,
      size: thumbnailBuffer.length,
      format,
      name: 'thumbnail',
    };

    return {
      original,
      thumbnail,
      variants,
      metadata,
    };
  }

  /**
   * Resizes an image to specified dimensions.
   */
  async resizeImage(input: Buffer, options: ResizeOptions): Promise<Buffer> {
    try {
      const sharp = await getSharp();
      let pipeline = sharp(input).rotate(); // Auto-orient

      const resizeOptions: Record<string, unknown> = {
        width: options.width,
        height: options.height,
        fit: this.mapFit(options.fit),
        position: this.mapPosition(options.position),
        withoutEnlargement: options.withoutEnlargement ?? true,
        withoutReduction: options.withoutReduction ?? false,
      };

      if (options.background) {
        resizeOptions.background = options.background;
      }

      pipeline = pipeline.resize(resizeOptions);

      return await pipeline.toBuffer();
    } catch (error) {
      throw new ImageOperationError(
        'resize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates a thumbnail at a predefined size.
   */
  async generateThumbnail(input: Buffer, size: ThumbnailSize): Promise<Buffer> {
    const dimensions = THUMBNAIL_SIZES[size];
    const sharp = await getSharp();
    const metadata = await sharp(input).metadata();

    try {
      let pipeline = sharp(input).rotate(); // Auto-orient

      // Handle animated GIFs - use first frame for thumbnail
      if (metadata.pages && metadata.pages > 1) {
        pipeline = sharp(input, { page: 0 }).rotate();
      }

      return await pipeline
        .resize({
          width: dimensions.width,
          height: dimensions.height,
          fit: 'cover',
          position: 'attention', // Smart cropping
        })
        .toBuffer();
    } catch (error) {
      throw new ImageOperationError(
        `generate thumbnail (${size})`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Optimizes an image for web delivery.
   */
  async optimizeImage(
    input: Buffer,
    options?: OptimizeOptions
  ): Promise<Buffer> {
    const opts = { ...DEFAULT_OPTIMIZE_OPTIONS, ...options };
    const sharp = await getSharp();
    const metadata = await sharp(input).metadata();
    const format = opts.format ?? this.mapSharpFormat(metadata.format);

    try {
      let pipeline = sharp(input);

      // Strip metadata if requested
      if (opts.stripMetadata) {
        pipeline = pipeline.rotate(); // Auto-orient before stripping
      } else {
        pipeline = pipeline.withMetadata().rotate();
      }

      // Apply format-specific optimizations
      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({
            quality: opts.quality ?? DEFAULT_QUALITY.jpeg,
            progressive: opts.progressive ?? true,
            mozjpeg: true,
          });
          break;

        case 'png':
          pipeline = pipeline.png({
            compressionLevel: Math.min(
              9,
              Math.round((100 - (opts.quality ?? 100)) / 10)
            ),
            progressive: opts.progressive ?? false,
          });
          break;

        case 'webp':
          pipeline = pipeline.webp({
            quality: opts.quality ?? DEFAULT_QUALITY.webp,
            lossless: opts.lossless ?? false,
            effort: opts.effort ?? 4,
          });
          break;

        case 'avif':
          pipeline = pipeline.avif({
            quality: opts.quality ?? DEFAULT_QUALITY.avif,
            lossless: opts.lossless ?? false,
            effort: opts.effort ?? 4,
          });
          break;

        case 'gif':
          pipeline = pipeline.gif({
            effort: opts.effort ?? 7,
          });
          break;

        default:
          // Keep original format with basic optimization
          break;
      }

      return await pipeline.toBuffer();
    } catch (error) {
      throw new ImageOperationError(
        'optimize',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Crops an image to specified region.
   */
  async cropImage(input: Buffer, crop: CropOptions): Promise<Buffer> {
    try {
      const sharp = await getSharp();
      const metadata = await sharp(input).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      // Validate crop region
      if (crop.left + crop.width > width || crop.top + crop.height > height) {
        throw new ImageValidationError('Crop region exceeds image dimensions', [
          `Image size: ${width}x${height}`,
          `Crop region: left=${crop.left}, top=${crop.top}, width=${crop.width}, height=${crop.height}`,
        ]);
      }

      return await sharp(input)
        .rotate() // Auto-orient first
        .extract({
          left: crop.left,
          top: crop.top,
          width: crop.width,
          height: crop.height,
        })
        .toBuffer();
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error;
      }
      throw new ImageOperationError(
        'crop',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Rotates an image by specified degrees.
   */
  async rotateImage(input: Buffer, degrees: number): Promise<Buffer> {
    try {
      const sharp = await getSharp();
      // Normalize degrees to 0-360
      const normalizedDegrees = ((degrees % 360) + 360) % 360;

      return await sharp(input)
        .rotate(normalizedDegrees, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer();
    } catch (error) {
      throw new ImageOperationError(
        'rotate',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Converts an image to a different format.
   */
  async convertFormat(input: Buffer, format: ImageFormat): Promise<Buffer> {
    try {
      const sharp = await getSharp();
      let pipeline = sharp(input).rotate(); // Auto-orient

      const quality = DEFAULT_QUALITY[format];

      switch (format) {
        case 'jpeg':
          pipeline = pipeline.jpeg({
            quality,
            progressive: true,
            mozjpeg: true,
          });
          break;
        case 'png':
          pipeline = pipeline.png({ compressionLevel: 6 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'avif':
          pipeline = pipeline.avif({ quality });
          break;
        case 'gif':
          pipeline = pipeline.gif();
          break;
        default:
          throw new UnsupportedFormatError(format);
      }

      return await pipeline.toBuffer();
    } catch (error) {
      if (error instanceof ImageProcessingError) {
        throw error;
      }
      throw new ImageOperationError(
        `convert to ${format}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extracts metadata from an image.
   */
  async getImageMetadata(input: Buffer): Promise<ImageMetadata> {
    try {
      const sharp = await getSharp();
      const metadata = await sharp(input).metadata();

      return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? 'unknown',
        space: metadata.space ?? 'unknown',
        channels: metadata.channels ?? 0,
        depth: metadata.depth ?? 'unknown',
        density: metadata.density,
        hasAlpha: metadata.hasAlpha ?? false,
        isAnimated: (metadata.pages ?? 1) > 1,
        size: metadata.size ?? input.length,
        orientation: metadata.orientation,
      };
    } catch (error) {
      throw new ImageOperationError(
        'extract metadata',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extracts EXIF data from an image.
   */
  async extractExif(input: Buffer): Promise<ExifData> {
    try {
      const sharp = await getSharp();
      const metadata = await sharp(input).metadata();
      const exif = metadata.exif;

      // If no EXIF data, return empty object
      if (!exif) {
        return {
          orientation: metadata.orientation,
        };
      }

      // Parse EXIF buffer (basic extraction)
      // For full EXIF parsing, consider using a dedicated library like exif-parser
      return {
        orientation: metadata.orientation,
        raw: {
          exifBuffer: exif.toString('base64'),
        },
      };
    } catch (error) {
      throw new ImageOperationError(
        'extract EXIF',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Strips EXIF metadata from an image.
   */
  async stripExif(input: Buffer): Promise<Buffer> {
    try {
      const sharp = await getSharp();
      // Rotate auto-orients based on EXIF, then we don't preserve metadata
      return await sharp(input).rotate().toBuffer();
    } catch (error) {
      throw new ImageOperationError(
        'strip EXIF',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generates multiple size variants of an image.
   */
  async generateVariants(
    input: Buffer,
    sizes: VariantConfig[]
  ): Promise<ImageVariant[]> {
    const sharp = await getSharp();
    const metadata = await sharp(input).metadata();
    const isAnimated = (metadata.pages ?? 1) > 1;

    // Process variants in parallel for performance
    const variantPromises = sizes.map(async (config): Promise<ImageVariant> => {
      try {
        // For animated images, use first frame for non-animated variants
        const sourceBuffer =
          isAnimated && config.isThumbnail
            ? await sharp(input, { page: 0 }).toBuffer()
            : input;

        let pipeline = sharp(sourceBuffer).rotate(); // Auto-orient

        // Apply resize
        pipeline = pipeline.resize({
          width: config.width,
          height: config.height,
          fit: this.mapFit(config.fit),
          position: config.isThumbnail ? 'attention' : 'centre',
          withoutEnlargement: true,
        });

        // Apply format conversion if specified
        const format = config.format ?? this.mapSharpFormat(metadata.format);
        const quality = config.quality ?? DEFAULT_QUALITY[format];

        switch (format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({
              quality,
              progressive: true,
              mozjpeg: true,
            });
            break;
          case 'png':
            pipeline = pipeline.png({ compressionLevel: 6 });
            break;
          case 'webp':
            pipeline = pipeline.webp({ quality });
            break;
          case 'avif':
            pipeline = pipeline.avif({ quality });
            break;
          case 'gif':
            pipeline = pipeline.gif();
            break;
        }

        const buffer = await pipeline.toBuffer();
        const variantMeta = await sharp(buffer).metadata(); // sharp is already loaded from outer scope

        return {
          buffer,
          width: variantMeta.width ?? config.width,
          height: variantMeta.height ?? config.height,
          size: buffer.length,
          format,
          name: config.name,
        };
      } catch (error) {
        throw new ImageOperationError(
          `generate variant ${config.name}`,
          error instanceof Error ? error : undefined
        );
      }
    });

    return Promise.all(variantPromises);
  }

  /**
   * Validates an image against specified criteria.
   */
  async validateImage(
    input: Buffer,
    options?: ImageValidationOptions
  ): Promise<ImageValidationResult> {
    const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const sharp = await getSharp();
      const metadata = await sharp(input).metadata();
      const format = this.mapSharpFormat(metadata.format);
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      const size = input.length;
      const isAnimated = (metadata.pages ?? 1) > 1;

      // Check file size
      if (opts.maxSize && size > opts.maxSize) {
        errors.push(
          `File size (${this.formatBytes(size)}) exceeds maximum (${this.formatBytes(opts.maxSize)})`
        );
      }

      // Check dimensions
      if (opts.minWidth && width < opts.minWidth) {
        errors.push(`Width (${width}px) is below minimum (${opts.minWidth}px)`);
      }
      if (opts.maxWidth && width > opts.maxWidth) {
        errors.push(`Width (${width}px) exceeds maximum (${opts.maxWidth}px)`);
      }
      if (opts.minHeight && height < opts.minHeight) {
        errors.push(
          `Height (${height}px) is below minimum (${opts.minHeight}px)`
        );
      }
      if (opts.maxHeight && height > opts.maxHeight) {
        errors.push(
          `Height (${height}px) exceeds maximum (${opts.maxHeight}px)`
        );
      }

      // Check format
      if (opts.allowedFormats && !opts.allowedFormats.includes(format)) {
        errors.push(
          `Format '${format}' is not allowed. Allowed: ${opts.allowedFormats.join(', ')}`
        );
      }

      // Check animation
      if (!opts.allowAnimated && isAnimated) {
        errors.push('Animated images are not allowed');
      }

      // Add warnings for edge cases
      if (isAnimated && (metadata.pages ?? 1) > 100) {
        warnings.push(
          `Image has ${metadata.pages} frames which may impact processing performance`
        );
      }
      if (size > 10 * 1024 * 1024) {
        warnings.push('Large file size may impact upload and processing time');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        detectedFormat: format,
        dimensions: { width, height },
      };
    } catch (_error) {
      return {
        valid: false,
        errors: ['Failed to read image: file may be corrupted or invalid'],
        warnings: [],
      };
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Auto-orients image based on EXIF data.
   */
  private async autoOrient(input: Buffer): Promise<Buffer> {
    const sharp = await getSharp();
    return sharp(input).rotate().toBuffer();
  }

  /**
   * Detects format from mime type or sharp format string.
   */
  private detectFormat(mimeType?: string, sharpFormat?: string): ImageFormat {
    // Try mime type first
    if (mimeType && MIME_TO_FORMAT[mimeType]) {
      return MIME_TO_FORMAT[mimeType] as ImageFormat;
    }

    // Map sharp format
    return this.mapSharpFormat(sharpFormat);
  }

  /**
   * Maps sharp format string to ImageFormat.
   */
  private mapSharpFormat(format?: string): ImageFormat {
    switch (format) {
      case 'jpeg':
      case 'jpg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'webp':
        return 'webp';
      case 'avif':
        return 'avif';
      case 'gif':
        return 'gif';
      default:
        return 'jpeg'; // Default fallback
    }
  }

  /**
   * Maps ResizeFit to sharp fit option.
   */
  private mapFit(
    fit?: string
  ): 'cover' | 'contain' | 'fill' | 'inside' | 'outside' {
    switch (fit) {
      case 'cover':
        return 'cover';
      case 'contain':
        return 'contain';
      case 'fill':
        return 'fill';
      case 'inside':
        return 'inside';
      case 'outside':
        return 'outside';
      default:
        return 'inside';
    }
  }

  /**
   * Maps ImagePosition to sharp position.
   */
  private mapPosition(position?: ImagePosition): string {
    return position ?? 'centre';
  }

  /**
   * Formats bytes to human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// =============================================================================
// Factory Function and Singleton
// =============================================================================

/**
 * Creates a new ImageService instance.
 *
 * @returns ImageService instance
 */
export function createImageService(): ImageService {
  return new ImageServiceImpl();
}

/**
 * Default singleton instance of the ImageService.
 */
export const imageService: ImageService = createImageService();
