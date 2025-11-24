/**
 * @genesis/file-processor - OCR Module
 *
 * Optical Character Recognition (OCR) services for text extraction from images.
 * Supports multiple OCR engines, batch processing, and document analysis.
 *
 * @packageDocumentation
 */

// ============================================
// OCR Service Interface & Base
// ============================================

export {
  OCRService,
  OCRServiceInfo,
  OCRServiceFactory,
  OCRServiceFactoryConfig,
  BaseOCRService,
} from './ocr-service';

// ============================================
// Tesseract Implementation
// ============================================

export {
  TesseractOCRService,
  createTesseractOCRService,
} from './tesseract-ocr';

// ============================================
// Image Preprocessing
// ============================================

export {
  ImagePreprocessor,
  createImagePreprocessor,
  PreprocessOptions,
  DEFAULT_PREPROCESS_OPTIONS,
  ImageAnalysis,
} from './image-preprocessor';

// ============================================
// Layout Analysis
// ============================================

export {
  LayoutAnalyzer,
  createLayoutAnalyzer,
  LayoutAnalyzerOptions,
  LayoutResult,
  Region,
  TextRegion,
  TableRegion,
  ImageRegion,
  RegionType,
} from './layout-analyzer';

// ============================================
// Types
// ============================================

export {
  // Enums
  OCREngine,
  PageSegMode,
  OCREngineMode,
  BlockType,
  DocumentType,
  OCRProcessingStage,
  OCRErrorType,

  // Constants
  SUPPORTED_LANGUAGES,

  // Core Types
  SupportedLanguage,
  BoundingBox,
  ExtendedBoundingBox,
  OCROptions,
  PDFOCROptions,
  OCRWord,
  OCRLine,
  OCRParagraph,
  OCRBlock,
  OCRResult,
  DocumentOCRResult,

  // Table Types
  TableResult,
  TableCell,
  FormField,

  // Progress & Stats
  OCRProgress,
  OCRProgressCallback,
  OCRServiceStats,
  OCRServiceConfig,

  // Error Types
  OCRError,
} from '../types/ocr';

// ============================================
// Factory Functions
// ============================================

import { TesseractOCRService } from './tesseract-ocr';
import { ImagePreprocessor } from './image-preprocessor';
import { LayoutAnalyzer } from './layout-analyzer';
import type { OCRServiceConfig } from '../types/ocr';

/**
 * Create and configure an OCR service with preprocessing and layout analysis
 *
 * @param config - Optional OCR service configuration
 * @returns Object containing configured OCR service, preprocessor, and layout analyzer
 *
 * @example
 * ```typescript
 * const { service, preprocessor, layoutAnalyzer } = createOCRPipeline({
 *   workerPoolSize: 4,
 *   defaultLanguages: ['eng', 'deu'],
 * });
 *
 * await service.initialize();
 *
 * // Preprocess image
 * const processed = await preprocessor.prepareForOCR(imageBuffer);
 *
 * // Recognize text
 * const result = await service.recognizeText(processed);
 *
 * // Analyze layout
 * const layout = await layoutAnalyzer.analyzeLayout(result.blocks, {
 *   width: result.imageDimensions.width,
 *   height: result.imageDimensions.height,
 * });
 *
 * await service.terminate();
 * ```
 */
export function createOCRPipeline(config?: Partial<OCRServiceConfig>): {
  service: TesseractOCRService;
  preprocessor: ImagePreprocessor;
  layoutAnalyzer: LayoutAnalyzer;
} {
  return {
    service: new TesseractOCRService(config),
    preprocessor: new ImagePreprocessor(),
    layoutAnalyzer: new LayoutAnalyzer(),
  };
}

/**
 * Quick OCR function for simple use cases
 *
 * Creates a temporary OCR service, processes the image, and cleans up.
 * For batch processing, use createOCRPipeline() instead.
 *
 * @param image - Image buffer to process
 * @param language - Language code (default 'eng')
 * @returns OCR result
 *
 * @example
 * ```typescript
 * const result = await quickOCR(imageBuffer, 'eng');
 * console.log(result.text);
 * ```
 */
export async function quickOCR(
  image: Buffer,
  language = 'eng'
): Promise<{
  text: string;
  confidence: number;
}> {
  const service = new TesseractOCRService({
    workerPoolSize: 1,
    defaultLanguages: [language],
  });

  try {
    await service.initialize();
    const result = await service.recognizeText(image, { language });
    return {
      text: result.text,
      confidence: result.confidence,
    };
  } finally {
    await service.terminate();
  }
}
