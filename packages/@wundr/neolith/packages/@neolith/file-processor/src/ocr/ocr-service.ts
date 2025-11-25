/**
 * @genesis/file-processor - OCR Service Interface
 *
 * Defines the core interface for OCR (Optical Character Recognition) services.
 * Supports multiple backends and comprehensive text extraction capabilities.
 *
 * @packageDocumentation
 */

import { OCREngine } from '../types/ocr';

import type {
  OCROptions,
  OCRResult,
  DocumentOCRResult,
  PDFOCROptions,
  OCRProgressCallback,
  OCRServiceStats,
  SupportedLanguage,
} from '../types/ocr';

/**
 * Core OCR service interface
 *
 * Provides a unified API for text recognition across different OCR engines.
 * Supports single images, documents, batch processing, and PDF files.
 *
 * @example
 * ```typescript
 * const service = new TesseractOCRService();
 * await service.initialize();
 *
 * // Basic recognition
 * const result = await service.recognizeText(imageBuffer);
 * console.log(result.text);
 *
 * // With options
 * const resultWithOpts = await service.recognizeText(imageBuffer, {
 *   language: 'eng',
 *   pageSegmentationMode: PageSegMode.AUTO,
 *   includeWordDetails: true,
 * });
 *
 * // Batch processing
 * const results = await service.recognizeMultiple([img1, img2, img3]);
 *
 * await service.terminate();
 * ```
 */
export interface OCRService {
  /**
   * Initialize the OCR service
   *
   * Must be called before any recognition operations.
   * Initializes worker threads and loads default language data.
   *
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Terminate the OCR service and release resources
   *
   * Should be called when the service is no longer needed.
   * Releases worker threads and clears cached data.
   *
   * @returns Promise that resolves when termination is complete
   */
  terminate(): Promise<void>;

  /**
   * Check if the service is initialized and ready
   *
   * @returns true if the service is ready for recognition
   */
  isReady(): boolean;

  // ============================================
  // Basic Recognition Methods
  // ============================================

  /**
   * Recognize text from a single image
   *
   * @param image - Image data as Buffer, Blob, or base64 string
   * @param options - Optional OCR processing options
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to OCR result
   *
   * @example
   * ```typescript
   * const result = await service.recognizeText(imageBuffer, {
   *   language: 'eng',
   *   includeWordDetails: true,
   * });
   * console.log(`Text: ${result.text}`);
   * console.log(`Confidence: ${result.confidence}%`);
   * ```
   */
  recognizeText(
    image: Buffer | Blob | string,
    options?: OCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult>;

  /**
   * Recognize text with document-level analysis
   *
   * Performs additional analysis including:
   * - Document type classification
   * - Layout analysis and reading order
   * - Form field extraction
   * - Table detection
   *
   * @param image - Image data as Buffer, Blob, or base64 string
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to document OCR result
   *
   * @example
   * ```typescript
   * const result = await service.recognizeDocument(invoiceImage);
   * console.log(`Document type: ${result.documentType}`);
   * console.log(`Form fields: ${JSON.stringify(result.formFields)}`);
   * ```
   */
  recognizeDocument(
    image: Buffer | Blob | string,
    onProgress?: OCRProgressCallback
  ): Promise<DocumentOCRResult>;

  // ============================================
  // Batch Processing Methods
  // ============================================

  /**
   * Recognize text from multiple images
   *
   * Processes images in parallel for better performance.
   * Results are returned in the same order as input images.
   *
   * @param images - Array of image data
   * @param options - Optional OCR processing options (applied to all images)
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to array of OCR results
   *
   * @example
   * ```typescript
   * const results = await service.recognizeMultiple(
   *   [page1Buffer, page2Buffer, page3Buffer],
   *   { language: 'eng' },
   *   (progress) => console.log(`Progress: ${progress.progress}%`)
   * );
   * ```
   */
  recognizeMultiple(
    images: Array<Buffer | Blob | string>,
    options?: OCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult[]>;

  /**
   * Recognize text from PDF pages
   *
   * Converts PDF pages to images and performs OCR on each page.
   *
   * @param pdf - PDF file as Buffer
   * @param options - Optional PDF OCR options
   * @param onProgress - Optional progress callback
   * @returns Promise resolving to array of OCR results (one per page)
   *
   * @example
   * ```typescript
   * const results = await service.recognizePDFPages(pdfBuffer, {
   *   pageRange: { start: 1, end: 5 },
   *   language: 'eng',
   * });
   * ```
   */
  recognizePDFPages(
    pdf: Buffer,
    options?: PDFOCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult[]>;

  // ============================================
  // Configuration Methods
  // ============================================

  /**
   * Set the recognition language(s)
   *
   * Changes the default language for subsequent recognition operations.
   * Multiple languages can be specified for multilingual documents.
   *
   * @param lang - Language code or array of language codes
   *
   * @example
   * ```typescript
   * // Single language
   * service.setLanguage('eng');
   *
   * // Multiple languages
   * service.setLanguage(['eng', 'deu', 'fra']);
   * ```
   */
  setLanguage(lang: string | string[]): void;

  /**
   * Get the currently configured language(s)
   *
   * @returns Current language configuration
   */
  getLanguage(): string[];

  /**
   * Set the OCR engine to use
   *
   * @param engine - OCR engine type
   */
  setEngine(engine: OCREngine): void;

  /**
   * Get the current OCR engine
   *
   * @returns Current OCR engine type
   */
  getEngine(): OCREngine;

  /**
   * Get list of available languages
   *
   * Returns languages that are currently loaded or available for loading.
   *
   * @returns Promise resolving to array of available language codes
   */
  getAvailableLanguages(): Promise<string[]>;

  /**
   * Load language data
   *
   * Pre-loads language data for faster recognition.
   * Language data is cached after loading.
   *
   * @param lang - Language code or array of language codes to load
   * @param onProgress - Optional progress callback
   * @returns Promise that resolves when language data is loaded
   */
  loadLanguage(
    lang: string | string[],
    onProgress?: OCRProgressCallback
  ): Promise<void>;

  /**
   * Check if a language is loaded
   *
   * @param lang - Language code to check
   * @returns true if the language is loaded and ready
   */
  isLanguageLoaded(lang: string): boolean;

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Get service statistics
   *
   * Returns statistics about service usage and performance.
   *
   * @returns Service statistics
   */
  getStats(): OCRServiceStats;

  /**
   * Reset service statistics
   */
  resetStats(): void;

  /**
   * Get service information
   *
   * @returns Object containing service name, version, and capabilities
   */
  getInfo(): OCRServiceInfo;
}

/**
 * OCR service information
 */
export interface OCRServiceInfo {
  /** Service name */
  name: string;

  /** Service version */
  version: string;

  /** OCR engine being used */
  engine: OCREngine;

  /** Supported image formats */
  supportedFormats: string[];

  /** Supported languages */
  supportedLanguages: SupportedLanguage[];

  /** Maximum image size (pixels) */
  maxImageSize?: number;

  /** Maximum concurrent operations */
  maxConcurrency: number;

  /** Feature flags */
  features: {
    /** Supports document analysis */
    documentAnalysis: boolean;
    /** Supports table extraction */
    tableExtraction: boolean;
    /** Supports form field extraction */
    formFieldExtraction: boolean;
    /** Supports PDF processing */
    pdfProcessing: boolean;
    /** Supports batch processing */
    batchProcessing: boolean;
    /** Supports progress callbacks */
    progressCallbacks: boolean;
  };
}

/**
 * Factory function type for creating OCR services
 */
export type OCRServiceFactory = (config?: OCRServiceFactoryConfig) => OCRService;

/**
 * Configuration for OCR service factory
 */
export interface OCRServiceFactoryConfig {
  /** OCR engine to use */
  engine?: OCREngine;

  /** Worker pool size */
  workerPoolSize?: number;

  /** Default language(s) */
  defaultLanguages?: string[];

  /** Language data path */
  languageDataPath?: string;

  /** Enable logging */
  enableLogging?: boolean;

  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Abstract base class for OCR services
 *
 * Provides common functionality and default implementations.
 * Extend this class to implement custom OCR backends.
 */
export abstract class BaseOCRService implements OCRService {
  protected _isReady = false;
  protected _currentLanguages: string[] = ['eng'];
  protected _currentEngine: OCREngine = OCREngine.TESSERACT;
  protected _stats: OCRServiceStats = {
    totalProcessed: 0,
    totalProcessingTime: 0,
    averageConfidence: 0,
    failureCount: 0,
    activeWorkers: 0,
    queuedJobs: 0,
  };

  abstract initialize(): Promise<void>;
  abstract terminate(): Promise<void>;
  abstract recognizeText(
    image: Buffer | Blob | string,
    options?: OCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult>;
  abstract recognizeDocument(
    image: Buffer | Blob | string,
    onProgress?: OCRProgressCallback
  ): Promise<DocumentOCRResult>;
  abstract recognizeMultiple(
    images: Array<Buffer | Blob | string>,
    options?: OCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult[]>;
  abstract recognizePDFPages(
    pdf: Buffer,
    options?: PDFOCROptions,
    onProgress?: OCRProgressCallback
  ): Promise<OCRResult[]>;
  abstract getAvailableLanguages(): Promise<string[]>;
  abstract loadLanguage(
    lang: string | string[],
    onProgress?: OCRProgressCallback
  ): Promise<void>;
  abstract isLanguageLoaded(lang: string): boolean;
  abstract getInfo(): OCRServiceInfo;

  isReady(): boolean {
    return this._isReady;
  }

  setLanguage(lang: string | string[]): void {
    this._currentLanguages = Array.isArray(lang) ? lang : [lang];
  }

  getLanguage(): string[] {
    return [...this._currentLanguages];
  }

  setEngine(engine: OCREngine): void {
    this._currentEngine = engine;
  }

  getEngine(): OCREngine {
    return this._currentEngine;
  }

  getStats(): OCRServiceStats {
    return { ...this._stats };
  }

  resetStats(): void {
    this._stats = {
      totalProcessed: 0,
      totalProcessingTime: 0,
      averageConfidence: 0,
      failureCount: 0,
      activeWorkers: 0,
      queuedJobs: 0,
    };
  }

  /**
   * Update statistics after processing
   */
  protected updateStats(processingTime: number, confidence: number, success: boolean): void {
    if (success) {
      const prevTotal = this._stats.totalProcessed;
      const prevAvg = this._stats.averageConfidence;
      this._stats.totalProcessed++;
      this._stats.totalProcessingTime += processingTime;
      // Calculate running average
      this._stats.averageConfidence =
        (prevAvg * prevTotal + confidence) / this._stats.totalProcessed;
    } else {
      this._stats.failureCount++;
    }
  }
}

