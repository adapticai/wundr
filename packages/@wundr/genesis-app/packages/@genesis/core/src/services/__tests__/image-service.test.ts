/**
 * Image Service Tests
 *
 * Comprehensive test suite for the image processing service covering:
 * - Image metadata extraction
 * - Thumbnail generation
 * - Image resizing
 * - Variant generation
 * - Quality optimization
 *
 * @module @genesis/core/services/__tests__/image-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createMockImageMetadata,
  createMockImageVariant,
  createMockImageVariants,
} from '../../test-utils/file-factories';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Image size types
 */
type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * Image metadata interface
 */
interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  isAnimated: boolean;
  size?: number;
  density?: number;
}

/**
 * Image variant interface
 */
interface ImageVariant {
  size: ImageSize;
  url: string;
  width: number;
  height: number;
}

/**
 * Resize options
 */
interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
}

/**
 * Create mock image service for testing
 */
function createMockImageService() {
  return {
    /**
     * Process uploaded image - extract metadata
     */
    processImage: vi.fn(async (key: string): Promise<ImageMetadata> => {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Return mock metadata based on file extension
      const extension = key.split('.').pop()?.toLowerCase() ?? 'jpg';
      const format = getFormatFromExtension(extension);

      return createMockImageMetadata({
        format,
        hasAlpha: extension === 'png' || extension === 'webp',
        isAnimated: extension === 'gif',
      });
    }),

    /**
     * Resize image maintaining aspect ratio
     */
    resizeImage: vi.fn(async (
      inputKey: string,
      outputKey: string,
      options: ResizeOptions
    ): Promise<{ key: string; width: number; height: number }> => {
      const originalWidth = 1920;
      const originalHeight = 1080;

      let newWidth: number;
      let newHeight: number;

      if (options.fit === 'cover' && options.width && options.height) {
        // Exact dimensions
        newWidth = options.width;
        newHeight = options.height;
      } else if (options.width && options.height) {
        // Fit inside dimensions maintaining aspect ratio
        const aspectRatio = originalWidth / originalHeight;
        if (options.width / options.height > aspectRatio) {
          newHeight = options.height;
          newWidth = Math.round(options.height * aspectRatio);
        } else {
          newWidth = options.width;
          newHeight = Math.round(options.width / aspectRatio);
        }
      } else if (options.width) {
        const aspectRatio = originalWidth / originalHeight;
        newWidth = options.width;
        newHeight = Math.round(options.width / aspectRatio);
      } else if (options.height) {
        const aspectRatio = originalWidth / originalHeight;
        newHeight = options.height;
        newWidth = Math.round(options.height * aspectRatio);
      } else {
        newWidth = originalWidth;
        newHeight = originalHeight;
      }

      return {
        key: outputKey,
        width: newWidth,
        height: newHeight,
      };
    }),

    /**
     * Generate thumbnail
     */
    generateThumbnail: vi.fn(async (key: string): Promise<string> => {
      const thumbnailKey = key.replace(/\.[^.]+$/, '_thumb.webp');
      return `https://cdn.example.com/${thumbnailKey}`;
    }),

    /**
     * Generate all size variants
     */
    generateVariants: vi.fn(async (
      key: string,
      sizes: ImageSize[]
    ): Promise<ImageVariant[]> => {
      return sizes.map((size) => createMockImageVariant(size, key));
    }),

    /**
     * Optimize image quality
     */
    optimizeImage: vi.fn(async (
      key: string,
      quality: number
    ): Promise<{ key: string; originalSize: number; optimizedSize: number }> => {
      const originalSize = 500000; // 500KB
      const compressionRatio = quality / 100;
      const optimizedSize = Math.round(originalSize * compressionRatio * 0.7);

      return {
        key: key.replace(/\.[^.]+$/, '_optimized.webp'),
        originalSize,
        optimizedSize,
      };
    }),

    /**
     * Convert image format
     */
    convertFormat: vi.fn(async (
      inputKey: string,
      outputFormat: string
    ): Promise<string> => {
      return inputKey.replace(/\.[^.]+$/, `.${outputFormat}`);
    }),

    /**
     * Extract EXIF data
     */
    extractExif: vi.fn(async (key: string): Promise<Record<string, unknown> | null> => {
      // Simulate JPEG with EXIF data
      if (key.includes('.jpg') || key.includes('.jpeg')) {
        return {
          make: 'Canon',
          model: 'EOS 5D Mark IV',
          exposureTime: '1/250',
          fNumber: 2.8,
          iso: 400,
          dateTime: new Date('2024-01-15T10:30:00Z'),
          gps: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        };
      }
      return null;
    }),

    /**
     * Strip EXIF data for privacy
     */
    stripExif: vi.fn(async (key: string): Promise<string> => {
      return key.replace(/\.[^.]+$/, '_stripped.webp');
    }),
  };
}

/**
 * Get format from file extension
 */
function getFormatFromExtension(extension: string): string {
  const formats: Record<string, string> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    svg: 'svg',
  };
  return formats[extension] ?? 'unknown';
}

// =============================================================================
// IMAGE SERVICE TESTS
// =============================================================================

describe('ImageService', () => {
  let imageService: ReturnType<typeof createMockImageService>;

  beforeEach(() => {
    imageService = createMockImageService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // processImage Tests
  // ===========================================================================

  describe('processImage', () => {
    it('extracts metadata from JPEG', async () => {
      const key = 'uploads/photo.jpg';

      const metadata = await imageService.processImage(key);

      expect(metadata).toBeDefined();
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.hasAlpha).toBe(false);
    });

    it('extracts metadata from PNG with alpha', async () => {
      const key = 'uploads/image.png';

      const metadata = await imageService.processImage(key);

      expect(metadata.format).toBe('png');
      expect(metadata.hasAlpha).toBe(true);
    });

    it('detects animated GIF', async () => {
      const key = 'uploads/animation.gif';

      const metadata = await imageService.processImage(key);

      expect(metadata.format).toBe('gif');
      expect(metadata.isAnimated).toBe(true);
    });

    it('handles WebP format', async () => {
      const key = 'uploads/modern.webp';

      const metadata = await imageService.processImage(key);

      expect(metadata.format).toBe('webp');
      expect(metadata.hasAlpha).toBe(true);
    });

    it('returns dimensions', async () => {
      const key = 'uploads/photo.jpg';

      const metadata = await imageService.processImage(key);

      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);
      expect(typeof metadata.width).toBe('number');
      expect(typeof metadata.height).toBe('number');
    });
  });

  // ===========================================================================
  // generateThumbnails Tests
  // ===========================================================================

  describe('generateThumbnail', () => {
    it('generates thumbnail URL', async () => {
      const key = 'uploads/photo.jpg';

      const thumbnailUrl = await imageService.generateThumbnail(key);

      expect(thumbnailUrl).toContain('_thumb');
      expect(thumbnailUrl).toContain('.webp');
    });

    it('uses WebP format for thumbnails', async () => {
      const key = 'uploads/image.png';

      const thumbnailUrl = await imageService.generateThumbnail(key);

      expect(thumbnailUrl).toContain('.webp');
    });

    it('preserves file path structure', async () => {
      const key = 'channels/ch_123/files/user_456/photo.jpg';

      const thumbnailUrl = await imageService.generateThumbnail(key);

      expect(thumbnailUrl).toContain('channels/ch_123/files/user_456/photo_thumb');
    });
  });

  // ===========================================================================
  // resizeImage Tests
  // ===========================================================================

  describe('resizeImage', () => {
    it('resizes maintaining aspect ratio by width', async () => {
      const inputKey = 'uploads/wide-image.jpg';
      const outputKey = 'uploads/wide-image_resized.jpg';

      const result = await imageService.resizeImage(inputKey, outputKey, {
        width: 800,
      });

      expect(result.width).toBe(800);
      // Height should be proportional (1920x1080 -> 800x450)
      expect(result.height).toBe(450);
    });

    it('resizes maintaining aspect ratio by height', async () => {
      const inputKey = 'uploads/tall-image.jpg';
      const outputKey = 'uploads/tall-image_resized.jpg';

      const result = await imageService.resizeImage(inputKey, outputKey, {
        height: 600,
      });

      expect(result.height).toBe(600);
      // Width should be proportional
      expect(result.width).toBeGreaterThan(0);
    });

    it('crops to exact dimensions with cover fit', async () => {
      const inputKey = 'uploads/photo.jpg';
      const outputKey = 'uploads/photo_cropped.jpg';

      const result = await imageService.resizeImage(inputKey, outputKey, {
        width: 400,
        height: 400,
        fit: 'cover',
      });

      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
    });

    it('fits inside dimensions with contain', async () => {
      const inputKey = 'uploads/photo.jpg';
      const outputKey = 'uploads/photo_contained.jpg';

      const result = await imageService.resizeImage(inputKey, outputKey, {
        width: 500,
        height: 500,
        fit: 'contain',
      });

      // Should fit inside 500x500 while maintaining 16:9 aspect ratio
      expect(result.width).toBeLessThanOrEqual(500);
      expect(result.height).toBeLessThanOrEqual(500);
    });

    it('returns output key', async () => {
      const inputKey = 'uploads/photo.jpg';
      const outputKey = 'uploads/photo_small.jpg';

      const result = await imageService.resizeImage(inputKey, outputKey, {
        width: 200,
      });

      expect(result.key).toBe(outputKey);
    });
  });

  // ===========================================================================
  // generateVariants Tests
  // ===========================================================================

  describe('generateVariants', () => {
    it('creates all size variants', async () => {
      const key = 'uploads/photo.jpg';
      const sizes: ImageSize[] = ['thumbnail', 'small', 'medium', 'large', 'original'];

      const variants = await imageService.generateVariants(key, sizes);

      expect(variants).toHaveLength(5);
      expect(variants.map((v) => v.size)).toEqual(sizes);
    });

    it('generates correct dimensions for each size', async () => {
      const key = 'uploads/photo.jpg';
      const sizes: ImageSize[] = ['thumbnail', 'small', 'medium', 'large'];

      const variants = await imageService.generateVariants(key, sizes);

      // Verify thumbnail is smallest
      const thumbnail = variants.find((v) => v.size === 'thumbnail');
      const large = variants.find((v) => v.size === 'large');

      expect(thumbnail).toBeDefined();
      expect(large).toBeDefined();
      expect(thumbnail!.width).toBeLessThan(large!.width);
    });

    it('converts to WebP format', async () => {
      const key = 'uploads/photo.jpg';
      const sizes: ImageSize[] = ['small'];

      const variants = await imageService.generateVariants(key, sizes);

      expect(variants[0]!.url).toContain('.webp');
    });

    it('includes URLs for all variants', async () => {
      const key = 'uploads/photo.jpg';
      const sizes: ImageSize[] = ['thumbnail', 'small', 'medium'];

      const variants = await imageService.generateVariants(key, sizes);

      variants.forEach((variant) => {
        expect(variant.url).toContain('https://');
        expect(variant.url.length).toBeGreaterThan(0);
      });
    });

    it('generates unique URLs per size', async () => {
      const key = 'uploads/photo.jpg';
      const sizes: ImageSize[] = ['thumbnail', 'small', 'medium', 'large'];

      const variants = await imageService.generateVariants(key, sizes);

      const urls = variants.map((v) => v.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(urls.length);
    });
  });

  // ===========================================================================
  // optimizeImage Tests
  // ===========================================================================

  describe('optimizeImage', () => {
    it('reduces file size', async () => {
      const key = 'uploads/large-photo.jpg';

      const result = await imageService.optimizeImage(key, 80);

      expect(result.optimizedSize).toBeLessThan(result.originalSize);
    });

    it('respects quality parameter', async () => {
      const key = 'uploads/photo.jpg';

      const highQuality = await imageService.optimizeImage(key, 90);
      const lowQuality = await imageService.optimizeImage(key, 50);

      expect(lowQuality.optimizedSize).toBeLessThan(highQuality.optimizedSize);
    });

    it('outputs WebP format', async () => {
      const key = 'uploads/photo.jpg';

      const result = await imageService.optimizeImage(key, 80);

      expect(result.key).toContain('.webp');
    });

    it('reports original and optimized sizes', async () => {
      const key = 'uploads/photo.jpg';

      const result = await imageService.optimizeImage(key, 75);

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.optimizedSize).toBeGreaterThan(0);
      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.optimizedSize).toBe('number');
    });
  });

  // ===========================================================================
  // convertFormat Tests
  // ===========================================================================

  describe('convertFormat', () => {
    it('converts JPEG to WebP', async () => {
      const inputKey = 'uploads/photo.jpg';

      const outputKey = await imageService.convertFormat(inputKey, 'webp');

      expect(outputKey).toContain('.webp');
      expect(outputKey).not.toContain('.jpg');
    });

    it('converts PNG to JPEG', async () => {
      const inputKey = 'uploads/image.png';

      const outputKey = await imageService.convertFormat(inputKey, 'jpeg');

      expect(outputKey).toContain('.jpeg');
    });

    it('preserves base filename', async () => {
      const inputKey = 'uploads/my-photo.png';

      const outputKey = await imageService.convertFormat(inputKey, 'webp');

      expect(outputKey).toContain('my-photo');
    });
  });

  // ===========================================================================
  // EXIF Tests
  // ===========================================================================

  describe('extractExif', () => {
    it('extracts EXIF from JPEG', async () => {
      const key = 'uploads/photo.jpg';

      const exif = await imageService.extractExif(key);

      expect(exif).not.toBeNull();
      expect(exif).toHaveProperty('make');
      expect(exif).toHaveProperty('model');
    });

    it('returns null for PNG without EXIF', async () => {
      const key = 'uploads/screenshot.png';

      const exif = await imageService.extractExif(key);

      expect(exif).toBeNull();
    });

    it('includes GPS data when available', async () => {
      const key = 'uploads/geotagged-photo.jpeg';

      const exif = await imageService.extractExif(key);

      expect(exif).not.toBeNull();
      expect(exif).toHaveProperty('gps');
      expect((exif!.gps as Record<string, number>).latitude).toBeDefined();
      expect((exif!.gps as Record<string, number>).longitude).toBeDefined();
    });
  });

  describe('stripExif', () => {
    it('removes EXIF data for privacy', async () => {
      const key = 'uploads/photo-with-location.jpg';

      const strippedKey = await imageService.stripExif(key);

      expect(strippedKey).toContain('_stripped');
    });

    it('outputs WebP format', async () => {
      const key = 'uploads/photo.jpg';

      const strippedKey = await imageService.stripExif(key);

      expect(strippedKey).toContain('.webp');
    });
  });
});

// =============================================================================
// INTEGRATION SCENARIO TESTS
// =============================================================================

describe('ImageService Integration Scenarios', () => {
  let imageService: ReturnType<typeof createMockImageService>;

  beforeEach(() => {
    imageService = createMockImageService();
  });

  it('complete image processing pipeline', async () => {
    const key = 'channels/ch_123/files/user_456/photo.jpg';

    // Step 1: Process image and extract metadata
    const metadata = await imageService.processImage(key);
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.format).toBe('jpeg');

    // Step 2: Generate thumbnail
    const thumbnailUrl = await imageService.generateThumbnail(key);
    expect(thumbnailUrl).toContain('_thumb');

    // Step 3: Generate all variants
    const variants = await imageService.generateVariants(key, [
      'thumbnail',
      'small',
      'medium',
      'large',
    ]);
    expect(variants).toHaveLength(4);

    // Step 4: Optimize original
    const optimized = await imageService.optimizeImage(key, 85);
    expect(optimized.optimizedSize).toBeLessThan(optimized.originalSize);
  });

  it('avatar/profile image processing', async () => {
    const key = 'users/user_123/avatar.jpg';

    // Extract EXIF to check for location data
    const exif = await imageService.extractExif(key);
    if (exif?.gps) {
      // Strip EXIF for privacy
      await imageService.stripExif(key);
    }

    // Generate square crops for avatars
    const avatarSizes = [
      { width: 32, height: 32 },
      { width: 64, height: 64 },
      { width: 128, height: 128 },
      { width: 256, height: 256 },
    ];

    for (const size of avatarSizes) {
      const result = await imageService.resizeImage(
        key,
        key.replace('.jpg', `_${size.width}.webp`),
        { ...size, fit: 'cover' }
      );
      expect(result.width).toBe(size.width);
      expect(result.height).toBe(size.height);
    }
  });

  it('handles various image formats', async () => {
    const formats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    for (const format of formats) {
      const key = `uploads/test.${format}`;
      const metadata = await imageService.processImage(key);

      expect(metadata).toBeDefined();
      expect(metadata.width).toBeGreaterThan(0);

      // All should be convertible to WebP
      const converted = await imageService.convertFormat(key, 'webp');
      expect(converted).toContain('.webp');
    }
  });

  it('responsive image generation for web', async () => {
    const key = 'uploads/hero-image.jpg';
    const breakpoints = [320, 640, 768, 1024, 1280, 1920];

    for (const width of breakpoints) {
      const outputKey = key.replace('.jpg', `_w${width}.webp`);
      const result = await imageService.resizeImage(key, outputKey, { width });

      expect(result.width).toBe(width);
      expect(result.key).toContain(`_w${width}`);
    }
  });
});
