/**
 * @genesis/core - Image Type Definitions
 *
 * Type definitions for image processing operations including
 * resizing, optimization, format conversion, and metadata extraction.
 *
 * @packageDocumentation
 */

// =============================================================================
// Image Format Types
// =============================================================================

/**
 * Supported image output formats.
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

/**
 * Predefined thumbnail size identifiers.
 */
export type ThumbnailSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Image resize fit modes.
 * - cover: Crop to cover dimensions
 * - contain: Fit within dimensions, preserving aspect ratio
 * - fill: Stretch to fill exact dimensions
 * - inside: Preserve aspect ratio, largest dimension fits inside
 * - outside: Preserve aspect ratio, smallest dimension fits outside
 */
export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

/**
 * Gravity positions for cropping and resizing.
 */
export type ImagePosition =
  | 'center'
  | 'centre'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'entropy'
  | 'attention';

// =============================================================================
// Image Options
// =============================================================================

/**
 * Options for resizing an image.
 */
export interface ResizeOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Resize fit mode */
  fit?: ResizeFit;
  /** Position/gravity for cropping */
  position?: ImagePosition;
  /** Background color (hex, rgb, or named color) for 'contain' mode */
  background?: string;
  /** Whether to allow upscaling smaller images */
  withoutEnlargement?: boolean;
  /** Whether to allow reduction of larger images */
  withoutReduction?: boolean;
}

/**
 * Options for optimizing an image.
 */
export interface OptimizeOptions {
  /** Quality level 1-100 (higher = better quality, larger file) */
  quality?: number;
  /** Target format for conversion */
  format?: ImageFormat;
  /** Enable progressive/interlaced encoding */
  progressive?: boolean;
  /** Strip all metadata from output */
  stripMetadata?: boolean;
  /** Enable lossless compression (where supported) */
  lossless?: boolean;
  /** Effort level for encoding (0-10, format dependent) */
  effort?: number;
}

/**
 * Options for cropping an image.
 */
export interface CropOptions {
  /** Left edge position in pixels */
  left: number;
  /** Top edge position in pixels */
  top: number;
  /** Width of crop region in pixels */
  width: number;
  /** Height of crop region in pixels */
  height: number;
}

/**
 * Configuration for generating image variants.
 */
export interface VariantConfig {
  /** Unique identifier for this variant */
  name: string;
  /** Target width in pixels */
  width: number;
  /** Target height in pixels */
  height: number;
  /** Output format (defaults to original format) */
  format?: ImageFormat;
  /** Quality level 1-100 */
  quality?: number;
  /** Resize fit mode */
  fit?: ResizeFit;
  /** Whether this is a thumbnail (uses square crop) */
  isThumbnail?: boolean;
}

// =============================================================================
// Image Input/Output Types
// =============================================================================

/**
 * Input for image processing operations.
 */
export interface ImageInput {
  /** Image data buffer */
  buffer: Buffer;
  /** Original filename (for extension detection) */
  filename?: string;
  /** MIME type (optional, auto-detected if not provided) */
  mimeType?: string;
}

/**
 * Represents a processed image variant.
 */
export interface ImageVariant {
  /** Processed image data */
  buffer: Buffer;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** File size in bytes */
  size: number;
  /** Output format */
  format: ImageFormat;
  /** S3 object key (populated after upload) */
  key?: string;
  /** Public URL (populated after upload) */
  url?: string;
  /** Variant name identifier */
  name?: string;
}

/**
 * Result of complete image processing pipeline.
 */
export interface ProcessedImage {
  /** Original image (optimized) */
  original: ImageVariant;
  /** Primary thumbnail */
  thumbnail: ImageVariant;
  /** Additional size variants */
  variants: ImageVariant[];
  /** Extracted metadata */
  metadata: ImageMetadata;
}

// =============================================================================
// Image Metadata Types
// =============================================================================

/**
 * Image metadata extracted from file.
 */
export interface ImageMetadata {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Detected format */
  format: string;
  /** Color space (sRGB, Adobe RGB, etc.) */
  space: string;
  /** Number of color channels */
  channels: number;
  /** Bit depth per channel */
  depth: string;
  /** Pixel density (DPI) if available */
  density?: number;
  /** Whether image has alpha channel */
  hasAlpha: boolean;
  /** Whether image is animated (GIF, APNG, etc.) */
  isAnimated: boolean;
  /** Original file size in bytes */
  size?: number;
  /** Orientation from EXIF (1-8) */
  orientation?: number;
}

/**
 * EXIF data extracted from image.
 */
export interface ExifData {
  /** Camera make */
  make?: string;
  /** Camera model */
  model?: string;
  /** Date/time original taken */
  dateTimeOriginal?: Date;
  /** Exposure time in seconds */
  exposureTime?: number;
  /** F-number/aperture */
  fNumber?: number;
  /** ISO sensitivity */
  iso?: number;
  /** Focal length in mm */
  focalLength?: number;
  /** GPS latitude */
  latitude?: number;
  /** GPS longitude */
  longitude?: number;
  /** GPS altitude in meters */
  altitude?: number;
  /** Image orientation (1-8) */
  orientation?: number;
  /** Software used */
  software?: string;
  /** Image description */
  description?: string;
  /** Copyright information */
  copyright?: string;
  /** Artist/author */
  artist?: string;
  /** Raw EXIF object for custom access */
  raw?: Record<string, unknown>;
}

// =============================================================================
// Upload Pipeline Types
// =============================================================================

/**
 * Input for image upload pipeline.
 */
export interface ImageUploadInput {
  /** Image data buffer */
  buffer: Buffer;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** User/VP ID who uploaded */
  uploaderId: string;
  /** Organization ID */
  organizationId: string;
  /** Optional workspace ID */
  workspaceId?: string;
  /** Optional channel ID */
  channelId?: string;
  /** Optional message ID for attachments */
  messageId?: string;
  /** Whether to strip EXIF data */
  stripExif?: boolean;
  /** Custom variant configurations */
  variants?: VariantConfig[];
  /** Custom metadata to attach */
  customMetadata?: Record<string, unknown>;
}

/**
 * Result of image upload pipeline.
 */
export interface ImageUploadResult {
  /** Unique file ID */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Original image URL */
  url: string;
  /** Thumbnail URL */
  thumbnailUrl: string;
  /** All variant URLs by name */
  variants: Record<string, string>;
  /** Image metadata */
  metadata: ImageMetadata;
  /** File size in bytes */
  size: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Upload timestamp */
  createdAt: Date;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Image validation result.
 */
export interface ImageValidationResult {
  /** Whether the image is valid */
  valid: boolean;
  /** Validation error messages */
  errors: string[];
  /** Warnings (non-blocking issues) */
  warnings: string[];
  /** Detected format */
  detectedFormat?: ImageFormat;
  /** Detected dimensions */
  dimensions?: { width: number; height: number };
}

/**
 * Image validation options.
 */
export interface ImageValidationOptions {
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Maximum width in pixels */
  maxWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Maximum height in pixels */
  maxHeight?: number;
  /** Allowed formats */
  allowedFormats?: ImageFormat[];
  /** Allow animated images */
  allowAnimated?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Predefined thumbnail size dimensions.
 */
export const THUMBNAIL_SIZES: Record<ThumbnailSize, { width: number; height: number }> = {
  xs: { width: 40, height: 40 },
  sm: { width: 80, height: 80 },
  md: { width: 200, height: 200 },
  lg: { width: 400, height: 400 },
  xl: { width: 800, height: 800 },
} as const;

/**
 * Default quality settings per format.
 */
export const DEFAULT_QUALITY: Record<ImageFormat, number> = {
  jpeg: 80,
  png: 100,
  webp: 85,
  avif: 80,
  gif: 100,
} as const;

/**
 * MIME type mappings for image formats.
 */
export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
} as const;

/**
 * Reverse lookup: MIME type to format.
 */
export const MIME_TO_FORMAT: Record<string, ImageFormat> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
} as const;

/**
 * Default validation options.
 */
export const DEFAULT_VALIDATION_OPTIONS: ImageValidationOptions = {
  maxSize: 50 * 1024 * 1024, // 50MB
  minWidth: 1,
  maxWidth: 20000,
  minHeight: 1,
  maxHeight: 20000,
  allowedFormats: ['jpeg', 'png', 'webp', 'avif', 'gif'],
  allowAnimated: true,
} as const;

/**
 * Default optimization options.
 */
export const DEFAULT_OPTIMIZE_OPTIONS: OptimizeOptions = {
  quality: 80,
  progressive: true,
  stripMetadata: false,
} as const;

/**
 * Default variant configurations for standard processing.
 */
export const DEFAULT_VARIANTS: VariantConfig[] = [
  { name: 'thumb_xs', width: 40, height: 40, fit: 'cover', isThumbnail: true },
  { name: 'thumb_sm', width: 80, height: 80, fit: 'cover', isThumbnail: true },
  { name: 'thumb_md', width: 200, height: 200, fit: 'cover', isThumbnail: true },
  { name: 'thumb_lg', width: 400, height: 400, fit: 'cover', isThumbnail: true },
  { name: 'small', width: 640, height: 480, fit: 'inside' },
  { name: 'medium', width: 1280, height: 960, fit: 'inside' },
  { name: 'large', width: 1920, height: 1440, fit: 'inside' },
] as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Checks if a string is a valid ImageFormat.
 */
export function isImageFormat(value: unknown): value is ImageFormat {
  return (
    typeof value === 'string' && ['jpeg', 'png', 'webp', 'avif', 'gif'].includes(value)
  );
}

/**
 * Checks if a string is a valid ThumbnailSize.
 */
export function isThumbnailSize(value: unknown): value is ThumbnailSize {
  return typeof value === 'string' && ['xs', 'sm', 'md', 'lg', 'xl'].includes(value);
}

/**
 * Checks if a value is valid ResizeOptions.
 */
export function isResizeOptions(value: unknown): value is ResizeOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (obj['width'] !== undefined && typeof obj['width'] !== 'number') {
return false;
}
  if (obj['height'] !== undefined && typeof obj['height'] !== 'number') {
return false;
}
  if (
    obj['fit'] !== undefined &&
    !['cover', 'contain', 'fill', 'inside', 'outside'].includes(obj['fit'] as string)
  ) {
    return false;
  }
  return true;
}

/**
 * Checks if a value is valid OptimizeOptions.
 */
export function isOptimizeOptions(value: unknown): value is OptimizeOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (obj['quality'] !== undefined) {
    if (typeof obj['quality'] !== 'number') {
return false;
}
    if (obj['quality'] < 1 || obj['quality'] > 100) {
return false;
}
  }
  if (obj['format'] !== undefined && !isImageFormat(obj['format'])) {
return false;
}
  if (obj['progressive'] !== undefined && typeof obj['progressive'] !== 'boolean') {
return false;
}
  if (obj['stripMetadata'] !== undefined && typeof obj['stripMetadata'] !== 'boolean') {
    return false;
  }
  return true;
}

/**
 * Checks if a value is valid CropOptions.
 */
export function isCropOptions(value: unknown): value is CropOptions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['left'] === 'number' &&
    typeof obj['top'] === 'number' &&
    typeof obj['width'] === 'number' &&
    typeof obj['height'] === 'number' &&
    obj['left'] >= 0 &&
    obj['top'] >= 0 &&
    obj['width'] > 0 &&
    obj['height'] > 0
  );
}

/**
 * Checks if a value is valid ImageMetadata.
 */
export function isImageMetadata(value: unknown): value is ImageMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['width'] === 'number' &&
    typeof obj['height'] === 'number' &&
    typeof obj['format'] === 'string' &&
    typeof obj['space'] === 'string' &&
    typeof obj['channels'] === 'number' &&
    typeof obj['depth'] === 'string' &&
    typeof obj['hasAlpha'] === 'boolean' &&
    typeof obj['isAnimated'] === 'boolean'
  );
}

/**
 * Checks if a value is valid VariantConfig.
 */
export function isVariantConfig(value: unknown): value is VariantConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['name'] === 'string' &&
    typeof obj['width'] === 'number' &&
    typeof obj['height'] === 'number' &&
    obj['width'] > 0 &&
    obj['height'] > 0
  );
}
