/**
 * @genesis/file-processor - Image Preprocessor
 *
 * Image preprocessing utilities to optimize images for OCR accuracy.
 * Uses sharp for high-performance image manipulation.
 *
 * @packageDocumentation
 */

import sharp from 'sharp';

import type { Metadata } from 'sharp';

/**
 * Preprocessing options
 */
export interface PreprocessOptions {
  /** Convert to grayscale */
  grayscale?: boolean;

  /** Apply binarization with specified threshold (0-255) */
  binarize?: boolean;
  binarizeThreshold?: number;

  /** Remove noise using median filter */
  removeNoise?: boolean;
  noiseFilterSize?: number;

  /** Enhance contrast */
  enhanceContrast?: boolean;
  contrastFactor?: number;

  /** Deskew the image */
  deskew?: boolean;

  /** Target DPI for resizing */
  targetDpi?: number;

  /** Sharpen the image */
  sharpen?: boolean;
  sharpenSigma?: number;

  /** Normalize brightness/contrast */
  normalize?: boolean;

  /** Invert colors (for dark backgrounds) */
  invert?: boolean;

  /** Auto-rotate based on EXIF */
  autoRotate?: boolean;

  /** Remove borders/margins */
  trimBorders?: boolean;
  trimThreshold?: number;

  /** Output format */
  outputFormat?: 'png' | 'jpeg' | 'tiff';

  /** Quality for lossy formats (1-100) */
  quality?: number;
}

/**
 * Default preprocessing options for OCR
 */
export const DEFAULT_PREPROCESS_OPTIONS: PreprocessOptions = {
  grayscale: true,
  removeNoise: true,
  noiseFilterSize: 3,
  enhanceContrast: true,
  contrastFactor: 1.2,
  sharpen: true,
  sharpenSigma: 1,
  normalize: true,
  autoRotate: true,
  outputFormat: 'png',
};

/**
 * Image information returned by analyze
 */
export interface ImageAnalysis {
  /** Image width in pixels */
  width: number;

  /** Image height in pixels */
  height: number;

  /** Image format */
  format: string;

  /** Color space */
  colorSpace: string;

  /** Number of channels */
  channels: number;

  /** Has alpha channel */
  hasAlpha: boolean;

  /** Estimated DPI if available */
  dpi?: number;

  /** EXIF orientation */
  orientation?: number;

  /** Estimated text density (0-1) */
  estimatedTextDensity?: number;

  /** Estimated quality (0-100) */
  estimatedQuality?: number;

  /** Is likely scanned document */
  isScannedDocument?: boolean;
}

/**
 * Image preprocessor for OCR optimization
 *
 * Provides various image processing operations to improve OCR accuracy:
 * - Grayscale conversion
 * - Noise removal
 * - Contrast enhancement
 * - Deskewing
 * - Binarization
 * - Resolution adjustment
 *
 * @example
 * ```typescript
 * const preprocessor = new ImagePreprocessor();
 *
 * // Quick preprocessing with defaults
 * const processed = await preprocessor.prepareForOCR(imageBuffer);
 *
 * // Custom preprocessing
 * const custom = await preprocessor.prepareForOCR(imageBuffer, {
 *   grayscale: true,
 *   enhanceContrast: true,
 *   targetDpi: 300,
 * });
 *
 * // Individual operations
 * const denoised = await preprocessor.removeNoise(imageBuffer);
 * const deskewed = await preprocessor.deskew(imageBuffer);
 * ```
 */
export class ImagePreprocessor {
  /**
   * Analyze image and return metadata
   *
   * @param image - Input image buffer
   * @returns Image analysis information
   */
  async analyze(image: Buffer): Promise<ImageAnalysis> {
    const metadata = await sharp(image).metadata();

    const analysis: ImageAnalysis = {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      colorSpace: metadata.space || 'unknown',
      channels: metadata.channels || 0,
      hasAlpha: metadata.hasAlpha || false,
      dpi: metadata.density,
      orientation: metadata.orientation,
    };

    // Estimate if this is a scanned document
    analysis.isScannedDocument = this.estimateIsScannedDocument(metadata);

    return analysis;
  }

  /**
   * Prepare image for OCR with combined preprocessing
   *
   * Applies a series of preprocessing steps optimized for OCR accuracy.
   *
   * @param image - Input image buffer
   * @param options - Preprocessing options
   * @returns Preprocessed image buffer
   */
  async prepareForOCR(
    image: Buffer,
    options: PreprocessOptions = DEFAULT_PREPROCESS_OPTIONS
  ): Promise<Buffer> {
    let pipeline = sharp(image);

    // Auto-rotate based on EXIF
    if (options.autoRotate) {
      pipeline = pipeline.rotate();
    }

    // Convert to grayscale
    if (options.grayscale) {
      pipeline = pipeline.grayscale();
    }

    // Normalize brightness/contrast
    if (options.normalize) {
      pipeline = pipeline.normalize();
    }

    // Enhance contrast
    if (options.enhanceContrast && options.contrastFactor) {
      pipeline = pipeline.linear(options.contrastFactor, 0);
    }

    // Remove noise using median filter
    if (options.removeNoise) {
      pipeline = pipeline.median(options.noiseFilterSize || 3);
    }

    // Sharpen
    if (options.sharpen) {
      pipeline = pipeline.sharpen({
        sigma: options.sharpenSigma || 1,
      });
    }

    // Resize to target DPI
    if (options.targetDpi) {
      const metadata = await sharp(image).metadata();
      const currentDpi = metadata.density || 72;

      if (currentDpi < options.targetDpi) {
        const scale = options.targetDpi / currentDpi;
        pipeline = pipeline.resize({
          width: Math.round((metadata.width || 0) * scale),
          height: Math.round((metadata.height || 0) * scale),
          fit: 'inside',
          withoutEnlargement: false,
        });
      }
    }

    // Trim borders
    if (options.trimBorders) {
      pipeline = pipeline.trim({
        threshold: options.trimThreshold || 10,
      });
    }

    // Invert if needed
    if (options.invert) {
      pipeline = pipeline.negate();
    }

    // Binarize (convert to pure black and white)
    if (options.binarize) {
      pipeline = pipeline.threshold(options.binarizeThreshold || 128);
    }

    // Set output format
    switch (options.outputFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality: options.quality || 95 });
        break;
      case 'tiff':
        pipeline = pipeline.tiff({ quality: options.quality || 95 });
        break;
      case 'png':
      default:
        pipeline = pipeline.png();
        break;
    }

    return pipeline.toBuffer();
  }

  /**
   * Deskew (straighten) a tilted image
   *
   * Detects rotation angle and corrects it.
   * Note: This is a simplified implementation.
   * For production, consider using specialized libraries or Tesseract's built-in deskew.
   *
   * @param image - Input image buffer
   * @returns Deskewed image buffer
   */
  async deskew(image: Buffer): Promise<Buffer> {
    // Sharp doesn't have built-in deskew
    // This would require edge detection and Hough transform
    // For now, we rely on Tesseract's auto-rotation or return unchanged

    // Simple approach: use auto-rotate which handles EXIF orientation
    return sharp(image).rotate().toBuffer();
  }

  /**
   * Remove noise from image using median filter
   *
   * @param image - Input image buffer
   * @param filterSize - Size of the median filter (default 3)
   * @returns Denoised image buffer
   */
  async removeNoise(image: Buffer, filterSize = 3): Promise<Buffer> {
    return sharp(image).median(filterSize).toBuffer();
  }

  /**
   * Binarize image (convert to black and white)
   *
   * @param image - Input image buffer
   * @param threshold - Threshold value (0-255, default 128)
   * @returns Binarized image buffer
   */
  async binarize(image: Buffer, threshold = 128): Promise<Buffer> {
    return sharp(image).grayscale().threshold(threshold).toBuffer();
  }

  /**
   * Enhance image contrast
   *
   * @param image - Input image buffer
   * @param factor - Contrast factor (1.0 = no change, >1 = more contrast)
   * @returns Contrast-enhanced image buffer
   */
  async enhanceContrast(image: Buffer, factor = 1.2): Promise<Buffer> {
    return sharp(image).normalize().linear(factor, 0).toBuffer();
  }

  /**
   * Resize image to target DPI
   *
   * @param image - Input image buffer
   * @param targetDpi - Target DPI (default 300)
   * @returns Resized image buffer
   */
  async resize(image: Buffer, targetDpi = 300): Promise<Buffer> {
    const metadata = await sharp(image).metadata();
    const currentDpi = metadata.density || 72;

    if (currentDpi >= targetDpi) {
      // Already at or above target DPI
      return image;
    }

    const scale = targetDpi / currentDpi;

    return sharp(image)
      .resize({
        width: Math.round((metadata.width || 0) * scale),
        height: Math.round((metadata.height || 0) * scale),
        fit: 'inside',
        withoutEnlargement: false,
        kernel: 'lanczos3', // High-quality scaling
      })
      .withMetadata({ density: targetDpi })
      .toBuffer();
  }

  /**
   * Sharpen image
   *
   * @param image - Input image buffer
   * @param sigma - Sharpening sigma (default 1)
   * @returns Sharpened image buffer
   */
  async sharpen(image: Buffer, sigma = 1): Promise<Buffer> {
    return sharp(image).sharpen({ sigma }).toBuffer();
  }

  /**
   * Convert image to grayscale
   *
   * @param image - Input image buffer
   * @returns Grayscale image buffer
   */
  async toGrayscale(image: Buffer): Promise<Buffer> {
    return sharp(image).grayscale().toBuffer();
  }

  /**
   * Invert image colors
   *
   * Useful for dark background images.
   *
   * @param image - Input image buffer
   * @returns Inverted image buffer
   */
  async invert(image: Buffer): Promise<Buffer> {
    return sharp(image).negate().toBuffer();
  }

  /**
   * Trim borders/margins from image
   *
   * @param image - Input image buffer
   * @param threshold - Color similarity threshold (default 10)
   * @returns Trimmed image buffer
   */
  async trimBorders(image: Buffer, threshold = 10): Promise<Buffer> {
    return sharp(image).trim({ threshold }).toBuffer();
  }

  /**
   * Apply adaptive thresholding for binarization
   *
   * Better than simple thresholding for uneven lighting.
   * Note: Sharp doesn't have built-in adaptive threshold,
   * this is a workaround using contrast enhancement + threshold.
   *
   * @param image - Input image buffer
   * @returns Adaptively thresholded image buffer
   */
  async adaptiveThreshold(image: Buffer): Promise<Buffer> {
    return sharp(image)
      .grayscale()
      .normalize()
      .linear(1.5, -0.25) // Increase contrast
      .threshold(128)
      .toBuffer();
  }

  /**
   * Process multiple images in batch
   *
   * @param images - Array of image buffers
   * @param options - Preprocessing options
   * @param onProgress - Progress callback
   * @returns Array of processed image buffers
   */
  async batchProcess(
    images: Buffer[],
    options: PreprocessOptions = DEFAULT_PREPROCESS_OPTIONS,
    onProgress?: (current: number, total: number) => void
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];

    for (let i = 0; i < images.length; i++) {
      const processed = await this.prepareForOCR(images[i], options);
      results.push(processed);

      if (onProgress) {
        onProgress(i + 1, images.length);
      }
    }

    return results;
  }

  /**
   * Get optimal preprocessing options based on image analysis
   *
   * @param image - Input image buffer
   * @returns Recommended preprocessing options
   */
  async getRecommendedOptions(image: Buffer): Promise<PreprocessOptions> {
    const analysis = await this.analyze(image);
    const options: PreprocessOptions = { ...DEFAULT_PREPROCESS_OPTIONS };

    // Adjust based on analysis
    if (analysis.dpi && analysis.dpi < 200) {
      options.targetDpi = 300;
    }

    if (analysis.isScannedDocument) {
      options.removeNoise = true;
      options.enhanceContrast = true;
    }

    // If already grayscale, skip conversion
    if (analysis.colorSpace === 'gray' || analysis.channels === 1) {
      options.grayscale = false;
    }

    return options;
  }

  /**
   * Estimate if image is a scanned document
   */
  private estimateIsScannedDocument(metadata: Metadata): boolean {
    // Heuristics for scanned document detection
    const { width, height, density } = metadata;

    // Common scan resolutions
    const scanDpis = [150, 200, 300, 400, 600];
    const isDpiMatch = density !== undefined && scanDpis.includes(density);

    // Common document sizes at various DPIs (approximate)
    const isDocumentSize =
      width !== undefined &&
      height !== undefined &&
      width > 1000 &&
      height > 1000 &&
      Math.abs(width / height - 8.5 / 11) < 0.1; // Letter size ratio

    return isDpiMatch || isDocumentSize;
  }
}

/**
 * Create an image preprocessor instance
 *
 * @returns New ImagePreprocessor instance
 */
export function createImagePreprocessor(): ImagePreprocessor {
  return new ImagePreprocessor();
}
