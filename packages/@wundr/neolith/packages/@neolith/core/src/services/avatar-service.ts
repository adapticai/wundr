/**
 * @neolith/core - Avatar Service
 *
 * Service for managing user avatars with S3 storage, image processing,
 * and OAuth provider integration.
 *
 * @packageDocumentation
 */

import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '@neolith/database';
import type { User } from '@neolith/database';

import { GenesisError } from '../errors';
import {
  StorageServiceImpl,
  type StorageService,
} from './storage-service';

// =============================================================================
// Types
// =============================================================================

/**
 * Avatar size variants to generate
 */
export const AVATAR_SIZES = {
  SMALL: 32,
  MEDIUM: 64,
  LARGE: 128,
  XLARGE: 256,
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

/**
 * Avatar upload result with all variant URLs
 */
export interface AvatarUploadResult {
  /** Original avatar URL (largest size) */
  url: string;
  /** Variant URLs for different sizes */
  variants: Record<AvatarSize, string>;
  /** S3 key for the original avatar */
  key: string;
  /** S3 keys for all variants */
  variantKeys: Record<AvatarSize, string>;
}

/**
 * Avatar upload options
 */
export interface AvatarUploadOptions {
  /** User ID */
  userId: string;
  /** Source (buffer, URL, or base64) */
  source: Buffer | string;
  /** Original filename (optional) */
  filename?: string;
  /** Content type (auto-detected if not provided) */
  contentType?: string;
}

/**
 * OAuth provider avatar download options
 */
export interface OAuthAvatarDownloadOptions {
  /** User ID */
  userId: string;
  /** OAuth provider avatar URL */
  providerAvatarUrl: string;
  /** OAuth provider name */
  provider: 'google' | 'github';
}

/**
 * Fallback avatar generation options
 */
export interface GenerateFallbackAvatarOptions {
  /** User's display name or email */
  name: string;
  /** User ID for consistent color generation */
  userId: string;
}

// =============================================================================
// Errors
// =============================================================================

export class AvatarServiceError extends GenesisError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    metadata?: Record<string, unknown>,
  ) {
    super(message, code, statusCode, metadata);
    this.name = 'AvatarServiceError';
  }
}

export class InvalidAvatarError extends AvatarServiceError {
  constructor(message: string) {
    super(message, 'INVALID_AVATAR', 400);
    this.name = 'InvalidAvatarError';
  }
}

export class AvatarProcessingError extends AvatarServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, 'AVATAR_PROCESSING_ERROR', 500, { cause });
    this.name = 'AvatarProcessingError';
  }
}

export class AvatarDownloadError extends AvatarServiceError {
  constructor(url: string, cause?: unknown) {
    super(`Failed to download avatar from ${url}`, 'AVATAR_DOWNLOAD_ERROR', 502, {
      url,
      cause,
    });
    this.name = 'AvatarDownloadError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

export interface AvatarService {
  /**
   * Uploads an avatar and generates all size variants
   */
  uploadAvatar(options: AvatarUploadOptions): Promise<AvatarUploadResult>;

  /**
   * Downloads and uploads an avatar from OAuth provider
   */
  uploadOAuthAvatar(options: OAuthAvatarDownloadOptions): Promise<AvatarUploadResult>;

  /**
   * Generates a fallback avatar with initials
   */
  generateFallbackAvatar(options: GenerateFallbackAvatarOptions): Promise<AvatarUploadResult>;

  /**
   * Deletes all avatar variants for a user
   */
  deleteAvatar(userId: string): Promise<void>;

  /**
   * Gets avatar URL with optional size
   */
  getAvatarUrl(userId: string, size?: AvatarSize): Promise<string | null>;
}

// =============================================================================
// Service Implementation
// =============================================================================

export class AvatarServiceImpl implements AvatarService {
  private readonly storage: StorageService;

  constructor(storage?: StorageService) {
    // Use provided storage or create from environment
    this.storage = storage ?? createAvatarStorageService();
  }

  /**
   * Uploads an avatar and generates all size variants
   */
  async uploadAvatar(options: AvatarUploadOptions): Promise<AvatarUploadResult> {
    try {
      // Download or decode source
      const buffer = await this.sourceToBuffer(options.source);

      // Validate it's an image
      await this.validateImage(buffer);

      // Process and upload all variants
      const result = await this.processAndUploadVariants(options.userId, buffer);

      // Update user record
      await this.updateUserAvatar(options.userId, result.url);

      return result;
    } catch (error) {
      if (error instanceof AvatarServiceError) {
        throw error;
      }
      throw new AvatarProcessingError(
        `Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Downloads and uploads an avatar from OAuth provider
   */
  async uploadOAuthAvatar(options: OAuthAvatarDownloadOptions): Promise<AvatarUploadResult> {
    try {
      // Download from provider
      const buffer = await this.downloadProviderAvatar(options.providerAvatarUrl);

      // Upload as regular avatar
      return await this.uploadAvatar({
        userId: options.userId,
        source: buffer,
        filename: `${options.provider}-avatar.jpg`,
      });
    } catch (error) {
      if (error instanceof AvatarServiceError) {
        throw error;
      }
      throw new AvatarDownloadError(options.providerAvatarUrl, error);
    }
  }

  /**
   * Generates a fallback avatar with initials
   */
  async generateFallbackAvatar(
    options: GenerateFallbackAvatarOptions,
  ): Promise<AvatarUploadResult> {
    try {
      // Generate initials-based avatar for each size
      const variants: Record<AvatarSize, string> = {} as Record<AvatarSize, string>;
      const variantKeys: Record<AvatarSize, string> = {} as Record<AvatarSize, string>;

      for (const [sizeName, sizeValue] of Object.entries(AVATAR_SIZES)) {
        const buffer = await this.generateInitialsAvatar(options.name, options.userId, sizeValue);
        const key = this.generateAvatarKey(
          options.userId,
          sizeName.toLowerCase() as Lowercase<AvatarSize>,
          'fallback',
        );

        // Upload to S3
        const uploadResult = await this.storage.uploadBuffer(buffer, {
          key,
          contentType: 'image/png',
          filename: `avatar-${sizeName.toLowerCase()}.png`,
        });

        variants[sizeName as AvatarSize] = uploadResult.url;
        variantKeys[sizeName as AvatarSize] = uploadResult.key;
      }

      // Use XLARGE as primary URL
      const result: AvatarUploadResult = {
        url: variants.XLARGE,
        variants,
        key: variantKeys.XLARGE,
        variantKeys,
      };

      // Update user record
      await this.updateUserAvatar(options.userId, result.url);

      return result;
    } catch (error) {
      throw new AvatarProcessingError(
        `Failed to generate fallback avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error,
      );
    }
  }

  /**
   * Deletes all avatar variants for a user
   */
  async deleteAvatar(userId: string): Promise<void> {
    try {
      // List all avatars for this user
      const prefix = `avatars/${userId}/`;
      const files = await this.storage.listFiles(prefix);

      // Delete all found files
      if (files.files.length > 0) {
        const keys = files.files.map((f) => f.key);
        await this.storage.deleteFiles(keys);
      }

      // Clear user's avatarUrl
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });
    } catch (error) {
      throw new AvatarServiceError(
        `Failed to delete avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AVATAR_DELETE_ERROR',
        500,
        { userId },
      );
    }
  }

  /**
   * Gets avatar URL with optional size
   */
  async getAvatarUrl(userId: string, size: AvatarSize = 'LARGE'): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });

      if (!user?.avatarUrl) {
        return null;
      }

      // If requesting a specific size, try to get that variant
      if (size !== 'XLARGE') {
        const sizeKey = this.generateAvatarKey(userId, size.toLowerCase() as Lowercase<AvatarSize>);
        const exists = await this.storage.fileExists(sizeKey);
        if (exists) {
          return await this.storage.getFileUrl(sizeKey);
        }
      }

      // Fall back to original/xlarge
      return user.avatarUrl;
    } catch (error) {
      // Return null on error rather than throwing
      console.error('Failed to get avatar URL:', error);
      return null;
    }
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Converts source (URL, base64, or buffer) to Buffer
   */
  private async sourceToBuffer(source: Buffer | string): Promise<Buffer> {
    if (Buffer.isBuffer(source)) {
      return source;
    }

    // Check if it's a base64 data URL
    if (source.startsWith('data:')) {
      const base64Data = source.split(',')[1];
      if (!base64Data) {
        throw new InvalidAvatarError('Invalid base64 data URL');
      }
      return Buffer.from(base64Data, 'base64');
    }

    // Assume it's a URL
    return await this.downloadProviderAvatar(source);
  }

  /**
   * Downloads avatar from provider URL
   */
  private async downloadProviderAvatar(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Neolith-Avatar-Service/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new AvatarDownloadError(url, error);
    }
  }

  /**
   * Validates that buffer is a valid image
   */
  private async validateImage(buffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.format) {
        throw new InvalidAvatarError('Unable to detect image format');
      }

      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
      if (!allowedFormats.includes(metadata.format)) {
        throw new InvalidAvatarError(
          `Unsupported image format: ${metadata.format}. Allowed: ${allowedFormats.join(', ')}`,
        );
      }

      // Check size limits (10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        throw new InvalidAvatarError('Image size exceeds 10MB limit');
      }
    } catch (error) {
      if (error instanceof InvalidAvatarError) {
        throw error;
      }
      throw new InvalidAvatarError('Invalid or corrupted image file');
    }
  }

  /**
   * Processes image and uploads all size variants
   */
  private async processAndUploadVariants(
    userId: string,
    buffer: Buffer,
  ): Promise<AvatarUploadResult> {
    const variants: Record<AvatarSize, string> = {} as Record<AvatarSize, string>;
    const variantKeys: Record<AvatarSize, string> = {} as Record<AvatarSize, string>;

    for (const [sizeName, sizeValue] of Object.entries(AVATAR_SIZES)) {
      // Resize and optimize
      const processedBuffer = await sharp(buffer)
        .resize(sizeValue, sizeValue, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      // Generate key
      const key = this.generateAvatarKey(userId, sizeName.toLowerCase() as Lowercase<AvatarSize>);

      // Upload to S3
      const uploadResult = await this.storage.uploadBuffer(processedBuffer, {
        key,
        contentType: 'image/jpeg',
        filename: `avatar-${sizeName.toLowerCase()}.jpg`,
        metadata: {
          userId,
          size: sizeName,
          dimension: String(sizeValue),
        },
      });

      variants[sizeName as AvatarSize] = uploadResult.url;
      variantKeys[sizeName as AvatarSize] = uploadResult.key;
    }

    return {
      url: variants.XLARGE,
      variants,
      key: variantKeys.XLARGE,
      variantKeys,
    };
  }

  /**
   * Generates initials-based avatar image
   */
  private async generateInitialsAvatar(
    name: string,
    userId: string,
    size: number,
  ): Promise<Buffer> {
    // Extract initials
    const initials = this.extractInitials(name);

    // Generate consistent color from userId
    const bgColor = this.generateColorFromString(userId);
    const textColor = this.getContrastColor(bgColor);

    // Calculate font size (40% of image size)
    const fontSize = Math.floor(size * 0.4);

    // Create SVG
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="${bgColor}"/>
        <text
          x="50%"
          y="50%"
          font-family="Arial, sans-serif"
          font-size="${fontSize}"
          font-weight="600"
          fill="${textColor}"
          text-anchor="middle"
          dominant-baseline="central"
        >${initials}</text>
      </svg>
    `;

    // Convert SVG to PNG
    return await sharp(Buffer.from(svg)).png().toBuffer();
  }

  /**
   * Extracts initials from name (max 2 characters)
   */
  private extractInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts[parts.length - 1];
      if (first && last) {
        const firstInitial = first[0] || '';
        const lastInitial = last[0] || '';
        return `${firstInitial}${lastInitial}`.toUpperCase();
      }
    }
    return name.slice(0, 2).toUpperCase();
  }

  /**
   * Generates a consistent color from a string
   */
  private generateColorFromString(str: string): string {
    // Use hash to generate consistent color
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Generate vibrant colors by using higher saturation and lightness
    const hue = Math.abs(hash % 360);
    const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
    const lightness = 45 + (Math.abs(hash >> 8) % 15); // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  /**
   * Gets contrasting text color (white or black) for a background color
   */
  private getContrastColor(hslColor: string): string {
    // Extract lightness from HSL
    const match = hslColor.match(/hsl\(\d+,\s*\d+%,\s*(\d+)%\)/);
    if (!match || !match[1]) {
      return '#FFFFFF'; // Default to white
    }

    const lightness = parseInt(match[1], 10);
    return lightness > 50 ? '#000000' : '#FFFFFF';
  }

  /**
   * Generates S3 key for avatar
   */
  private generateAvatarKey(
    userId: string,
    size: Lowercase<AvatarSize> | 'fallback' = 'xlarge',
    type: 'avatar' | 'fallback' = 'avatar',
  ): string {
    const timestamp = Date.now();
    const id = createId();
    return `avatars/${userId}/${type}-${size}-${timestamp}-${id}.jpg`;
  }

  /**
   * Updates user's avatarUrl in database
   */
  private async updateUserAvatar(userId: string, url: string): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a dedicated storage service for avatars
 */
function createAvatarStorageService(): StorageServiceImpl {
  const bucket = process.env.AVATAR_STORAGE_BUCKET || process.env.STORAGE_BUCKET;
  const region = process.env.AVATAR_STORAGE_REGION || process.env.STORAGE_REGION || 'us-east-1';
  const accessKeyId =
    process.env.AVATAR_STORAGE_ACCESS_KEY_ID ||
    process.env.STORAGE_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AVATAR_STORAGE_SECRET_ACCESS_KEY ||
    process.env.STORAGE_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AVATAR_STORAGE_ENDPOINT || process.env.STORAGE_ENDPOINT;
  const publicUrlBase =
    process.env.AVATAR_STORAGE_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL;
  const provider = (process.env.AVATAR_STORAGE_PROVIDER ||
    process.env.STORAGE_PROVIDER ||
    's3') as 's3' | 'r2' | 'minio';

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new AvatarServiceError(
      'Missing required avatar storage environment variables',
      'AVATAR_STORAGE_CONFIG_ERROR',
      500,
    );
  }

  return new StorageServiceImpl({
    provider,
    bucket,
    region,
    endpoint,
    publicUrlBase,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Avatar-specific settings
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    defaultACL: 'public-read',
  });
}

/**
 * Creates avatar service instance
 */
export function createAvatarService(storage?: StorageService): AvatarServiceImpl {
  return new AvatarServiceImpl(storage);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let avatarServiceInstance: AvatarServiceImpl | null = null;

/**
 * Gets or creates the default avatar service instance
 */
export function getAvatarService(): AvatarServiceImpl {
  if (!avatarServiceInstance) {
    avatarServiceInstance = createAvatarService();
  }
  return avatarServiceInstance;
}

/**
 * Default avatar service instance (lazy-loaded)
 */
export const avatarService = new Proxy({} as AvatarService, {
  get(_target, prop: string | symbol) {
    const service = getAvatarService();
    const key = prop as keyof AvatarServiceImpl;
    const member = service[key];
    if (typeof member === 'function') {
      return (member as (...args: unknown[]) => unknown).bind(service);
    }
    return member;
  },
});
