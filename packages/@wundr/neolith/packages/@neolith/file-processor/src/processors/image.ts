/**
 * @genesis/file-processor - Image Processor with OCR
 *
 * Handles image processing and text extraction using OCR.
 * Supports various image formats with tesseract.js and sharp.
 */

import * as fs from 'fs';
import * as path from 'path';

import { FileType } from '../types';

import type { FileProcessorConfig } from '../config';
import type {
  ProcessorResult,
  FileMetadata,
  ProcessingOptions,
} from '../types';

/**
 * Image processing options
 */
export interface ImageProcessingOptions extends ProcessingOptions {
  /** OCR languages (e.g., 'eng', 'deu', 'fra') */
  ocrLanguages?: string[];

  /** Pre-processing options for OCR */
  preprocessing?: {
    /** Convert to grayscale */
    grayscale?: boolean;

    /** Increase contrast */
    contrast?: number;

    /** Sharpen image */
    sharpen?: boolean;

    /** Remove noise */
    denoise?: boolean;

    /** Deskew (straighten) image */
    deskew?: boolean;

    /** Resize for better OCR (DPI) */
    targetDpi?: number;
  };

  /** Output text formatting */
  textFormat?: 'raw' | 'blocks' | 'lines' | 'words';

  /** Include confidence scores */
  includeConfidence?: boolean;

  /** Include bounding boxes */
  includeBoundingBoxes?: boolean;

  /** Detect and preserve layout */
  preserveLayout?: boolean;

  /** Page segmentation mode */
  pageSegMode?: PageSegmentationMode;
}

/**
 * Page segmentation modes for Tesseract
 */
export enum PageSegmentationMode {
  OSD_ONLY = 0,
  AUTO_WITH_OSD = 1,
  AUTO_NO_OSD = 2,
  AUTO = 3,
  SINGLE_COLUMN = 4,
  SINGLE_BLOCK_VERTICAL = 5,
  SINGLE_BLOCK = 6,
  SINGLE_LINE = 7,
  SINGLE_WORD = 8,
  SINGLE_WORD_CIRCLE = 9,
  SINGLE_CHAR = 10,
  SPARSE_TEXT = 11,
  SPARSE_TEXT_OSD = 12,
  RAW_LINE = 13,
}

/**
 * OCR result with detailed information
 */
export interface OcrResult {
  /** Extracted text */
  text: string;

  /** Overall confidence score (0-100) */
  confidence: number;

  /** Text blocks with positions */
  blocks?: TextBlock[];

  /** Lines with positions */
  lines?: TextLine[];

  /** Words with positions */
  words?: TextWord[];

  /** Detected language */
  detectedLanguage?: string;

  /** Image properties */
  imageInfo: ImageInfo;
}

/**
 * Text block information
 */
export interface TextBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  lines: TextLine[];
}

/**
 * Text line information
 */
export interface TextLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: TextWord[];
}

/**
 * Text word information
 */
export interface TextWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Image information
 */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  colorSpace: string;
  dpi?: number;
  hasAlpha: boolean;
}

/**
 * Sharp module interface for image processing
 */
interface SharpInstance {
  metadata: () => Promise<SharpMetadata>;
  grayscale: () => SharpInstance;
  sharpen: () => SharpInstance;
  normalise: () => SharpInstance;
  resize: (options: {
    width?: number;
    height?: number;
    fit?: string;
  }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
  toFile: (path: string) => Promise<void>;
}

/**
 * Sharp metadata structure
 */
interface SharpMetadata {
  width?: number;
  height?: number;
  format?: string;
  space?: string;
  hasAlpha?: boolean;
  density?: number;
}

/**
 * Sharp module interface
 */
interface SharpModule {
  (input: string | Buffer): SharpInstance;
}

/**
 * Image processor class
 */
export class ImageProcessor {
  private _config: FileProcessorConfig;
  private workerPool: TesseractWorkerPool | null = null;
  private tesseract: TesseractModule | null = null;
  private sharp: SharpModule | null = null;

  constructor(config: FileProcessorConfig) {
    this._config = config;
  }

  /**
   * Lazily load tesseract module
   */
  private async getTesseract(): Promise<TesseractModule> {
    if (!this.tesseract) {
      const tesseractModule = await import('tesseract.js');
      this.tesseract = tesseractModule as unknown as TesseractModule;
    }
    return this.tesseract;
  }

  /**
   * Lazily load sharp module
   */
  private async getSharp(): Promise<SharpModule> {
    if (!this.sharp) {
      const sharpModule = await import('sharp');
      this.sharp = sharpModule.default as unknown as SharpModule;
    }
    return this.sharp;
  }

  /**
   * Initialize Tesseract worker pool
   */
  async initialize(): Promise<void> {
    const tesseract = await this.getTesseract();
    const defaultLangs = this._config.ocr?.defaultLanguages ?? ['eng'];
    this.workerPool = await tesseract.createWorker(defaultLangs);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.workerPool) {
      await this.workerPool.terminate();
      this.workerPool = null;
    }
  }

  /**
   * Process an image file and extract text
   */
  async process(
    filePath: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessorResult> {
    const startTime = Date.now();

    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Get image information
      const imageInfo = await this.getImageInfo(filePath);

      // Pre-process image if needed
      const processedImagePath = await this.preprocessImage(filePath, options);

      // Perform OCR
      const ocrResult = await this.performOcr(processedImagePath, options);

      // Cleanup temp files
      if (processedImagePath !== filePath) {
        await this.cleanupTempFile(processedImagePath);
      }

      // Build metadata
      const metadata: FileMetadata = {
        filename: path.basename(filePath),
        mimeType: this.getMimeType(imageInfo.format),
        size: stats.size,
        fileType: this.getFileType(imageInfo.format),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        dimensions: {
          width: imageInfo.width,
          height: imageInfo.height,
        },
        custom: {
          format: imageInfo.format,
          colorSpace: imageInfo.colorSpace,
          hasAlpha: imageInfo.hasAlpha,
          dpi: imageInfo.dpi,
        },
      };

      // Build structured data
      const structuredData: Record<string, unknown> = {
        imageInfo: ocrResult.imageInfo,
        detectedLanguage: ocrResult.detectedLanguage,
      };

      if (options.includeBoundingBoxes) {
        structuredData.blocks = ocrResult.blocks;
        structuredData.lines = ocrResult.lines;
        structuredData.words = ocrResult.words;
      }

      return {
        success: true,
        content: ocrResult.text,
        metadata,
        processingTime: Date.now() - startTime,
        ocrConfidence: ocrResult.confidence / 100,
        structuredData,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        content: '',
        metadata: this.createEmptyMetadata(filePath),
        processingTime: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Get image information using sharp
   *
   * @param filePath - Path to image file
   * @returns Image information
   */
  private async getImageInfo(filePath: string): Promise<ImageInfo> {
    const sharp = await this.getSharp();
    const metadata = await sharp(filePath).metadata();

    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: metadata.format ?? 'unknown',
      colorSpace: metadata.space ?? 'unknown',
      hasAlpha: metadata.hasAlpha ?? false,
      dpi: metadata.density,
    };
  }

  /**
   * Pre-process image for better OCR results
   *
   * @param filePath - Path to image file
   * @param options - Processing options
   * @returns Path to processed image (temp file if preprocessing applied)
   */
  private async preprocessImage(
    filePath: string,
    options: ImageProcessingOptions
  ): Promise<string> {
    if (!options.preprocessing) {
      return filePath;
    }

    const sharp = await this.getSharp();
    let image = sharp(filePath);

    // Convert to grayscale if requested
    if (options.preprocessing.grayscale) {
      image = image.grayscale();
    }

    // Sharpen image if requested
    if (options.preprocessing.sharpen) {
      image = image.sharpen();
    }

    // Normalize contrast
    if (options.preprocessing.contrast) {
      image = image.normalise();
    }

    // Resize for target DPI if specified
    if (options.preprocessing.targetDpi) {
      const metadata = await sharp(filePath).metadata();
      const currentDpi = metadata.density ?? 72;
      if (currentDpi < options.preprocessing.targetDpi) {
        const scale = options.preprocessing.targetDpi / currentDpi;
        image = image.resize({
          width: Math.round((metadata.width ?? 0) * scale),
          height: Math.round((metadata.height ?? 0) * scale),
          fit: 'inside',
        });
      }
    }

    // Save to temp file
    const tempDir = this._config.storage?.tempDir ?? '/tmp';
    const tempPath = path.join(tempDir, `processed_${Date.now()}.png`);
    await image.toFile(tempPath);

    return tempPath;
  }

  /**
   * Perform OCR on image
   *
   * @param filePath - Path to image file
   * @param options - Processing options
   * @returns OCR result with extracted text and metadata
   */
  private async performOcr(
    filePath: string,
    options: ImageProcessingOptions
  ): Promise<OcrResult> {
    // Ensure worker is initialized
    if (!this.workerPool) {
      await this.initialize();
    }

    if (!this.workerPool) {
      throw new Error('Failed to initialize Tesseract worker');
    }

    const ocrOptions: TesseractOptions = {};

    // Set page segmentation mode if specified
    if (options.pageSegMode !== undefined) {
      ocrOptions.tessedit_pageseg_mode = options.pageSegMode;
    }

    const result = await this.workerPool.recognize(filePath, ocrOptions);
    const imageInfo = await this.getImageInfo(filePath);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      blocks: this.extractBlocks(result.data),
      lines: this.extractLines(result.data),
      words: this.extractWords(result.data),
      imageInfo,
    };
  }

  /**
   * Extract text blocks from Tesseract result
   *
   * @param data - Tesseract recognition data
   * @returns Extracted text blocks
   */
  private extractBlocks(data: TesseractData): TextBlock[] {
    return (data.blocks ?? []).map(block => ({
      text: block.text,
      confidence: block.confidence,
      bbox: block.bbox,
      lines: (block.lines ?? []).map(line => ({
        text: line.text,
        confidence: line.confidence,
        bbox: line.bbox,
        words: (line.words ?? []).map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
        })),
      })),
    }));
  }

  /**
   * Extract text lines from Tesseract result
   *
   * @param data - Tesseract recognition data
   * @returns Extracted text lines
   */
  private extractLines(data: TesseractData): TextLine[] {
    return (data.lines ?? []).map(line => ({
      text: line.text,
      confidence: line.confidence,
      bbox: line.bbox,
      words: (line.words ?? []).map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
      })),
    }));
  }

  /**
   * Extract words from Tesseract result
   *
   * @param data - Tesseract recognition data
   * @returns Extracted words
   */
  private extractWords(data: TesseractData): TextWord[] {
    return (data.words ?? []).map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }));
  }

  /**
   * Cleanup temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Get MIME type from format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      tiff: 'image/tiff',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
    };

    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Get FileType from format
   */
  private getFileType(format: string): FileType {
    const typeMap: Record<string, FileType> = {
      png: FileType.PNG,
      jpeg: FileType.JPEG,
      jpg: FileType.JPG,
      tiff: FileType.TIFF,
    };

    return typeMap[format.toLowerCase()] || FileType.IMAGE;
  }

  /**
   * Create empty metadata for error cases
   */
  private createEmptyMetadata(filePath: string): FileMetadata {
    return {
      filename: path.basename(filePath),
      mimeType: 'image/unknown',
      size: 0,
      fileType: FileType.IMAGE,
    };
  }

  /**
   * Get processor information
   */
  getInfo(): { name: string; version: string; supportedTypes: string[] } {
    return {
      name: 'ImageProcessor',
      version: '0.1.0',
      supportedTypes: [
        'image/png',
        'image/jpeg',
        'image/tiff',
        'image/webp',
        'image/gif',
        'image/bmp',
      ],
    };
  }
}

/**
 * Tesseract worker interface
 */
interface TesseractWorker {
  recognize: (
    image: string | Buffer,
    options?: TesseractOptions
  ) => Promise<TesseractRecognizeResult>;
  terminate: () => Promise<void>;
}

/**
 * Tesseract recognition options
 */
interface TesseractOptions {
  lang?: string;
  tessedit_pageseg_mode?: number;
}

/**
 * Tesseract recognize result
 */
interface TesseractRecognizeResult {
  data: TesseractData;
}

/**
 * Tesseract data structure
 */
interface TesseractData {
  text: string;
  confidence: number;
  blocks: TesseractBlock[];
  lines: TesseractLine[];
  words: TesseractWord[];
  hocr?: string;
}

/**
 * Tesseract block structure
 */
interface TesseractBlock {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  lines: TesseractLine[];
}

/**
 * Tesseract line structure
 */
interface TesseractLine {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words: TesseractWord[];
}

/**
 * Tesseract word structure
 */
interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Tesseract module interface
 */
interface TesseractModule {
  createWorker: (langs?: string | string[]) => Promise<TesseractWorker>;
}

/**
 * Worker pool type for Tesseract
 */
type TesseractWorkerPool = TesseractWorker;

/**
 * Create image processor instance
 */
export function createImageProcessor(
  config: FileProcessorConfig
): ImageProcessor {
  return new ImageProcessor(config);
}
