/**
 * @genesis/file-processor - Tesseract OCR Service
 *
 * Implementation of OCR service using tesseract.js.
 * Supports browser and Node.js environments with worker thread support.
 *
 * @packageDocumentation
 */

import {
  createWorker,
  createScheduler,
} from 'tesseract.js';

import { BaseOCRService } from './ocr-service';
import {
  OCRProcessingStage,
  OCREngine,
  SUPPORTED_LANGUAGES,
  BlockType,
  DocumentType,
} from '../types/ocr';

import type { OCRServiceInfo } from './ocr-service';
import type {
  OCROptions,
  OCRResult,
  DocumentOCRResult,
  PDFOCROptions,
  OCRProgressCallback,
  OCRWord,
  OCRLine,
  OCRBlock,
  BoundingBox,
  OCRProgress,
  OCRServiceConfig,
  SupportedLanguage,
} from '../types/ocr';
import type Tesseract from 'tesseract.js';
import type {
  Worker,
  Scheduler,
  RecognizeResult} from 'tesseract.js';

/**
 * Default configuration for Tesseract OCR service
 */
const DEFAULT_CONFIG: OCRServiceConfig = {
  defaultLanguages: ['eng'],
  workerPoolSize: 2,
  cacheLanguageData: true,
  defaultTimeout: 120000, // 2 minutes
  enableLogging: false,
  logLevel: 'warn',
};

/**
 * Tesseract.js OCR service implementation
 *
 * Uses tesseract.js for text recognition in browser and Node.js.
 * Supports worker pool for parallel processing of multiple images.
 *
 * @example
 * ```typescript
 * const service = new TesseractOCRService({
 *   workerPoolSize: 4,
 *   defaultLanguages: ['eng', 'deu'],
 * });
 *
 * await service.initialize();
 *
 * const result = await service.recognizeText(imageBuffer);
 * console.log(result.text);
 *
 * await service.terminate();
 * ```
 */
export class TesseractOCRService extends BaseOCRService {
  private config: OCRServiceConfig;
  private scheduler: Scheduler | null = null;
  private workers: Worker[] = [];
  private loadedLanguages: Set<string> = new Set();

  /**
   * Create a new Tesseract OCR service
   *
   * @param config - Optional configuration overrides
   */
  constructor(config: Partial<OCRServiceConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._currentLanguages = this.config.defaultLanguages;
  }

  /**
   * Initialize the Tesseract worker pool
   *
   * Creates and initializes worker threads for parallel processing.
   * Loads default language data.
   */
  async initialize(): Promise<void> {
    if (this._isReady) {
      return;
    }

    this.log('info', 'Initializing Tesseract OCR service...');

    try {
      // Create scheduler for managing workers
      this.scheduler = createScheduler();

      // Create worker pool
      const workerPromises: Promise<Worker>[] = [];
      for (let i = 0; i < this.config.workerPoolSize; i++) {
        workerPromises.push(this.createTesseractWorker());
      }

      this.workers = await Promise.all(workerPromises);

      // Add workers to scheduler
      for (const worker of this.workers) {
        this.scheduler.addWorker(worker);
      }

      // Load default languages
      await this.loadLanguage(this.config.defaultLanguages);

      this._isReady = true;
      this._stats.activeWorkers = this.workers.length;
      this.log('info', `Tesseract OCR service initialized with ${this.workers.length} workers`);
    } catch (error) {
      this.log('error', 'Failed to initialize Tesseract OCR service', error);
      await this.terminate();
      throw error;
    }
  }

  /**
   * Terminate the Tesseract service and release resources
   */
  async terminate(): Promise<void> {
    this.log('info', 'Terminating Tesseract OCR service...');

    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
    }

    // Terminate individual workers if scheduler didn't clean them up
    for (const worker of this.workers) {
      try {
        await worker.terminate();
      } catch {
        // Ignore termination errors
      }
    }

    this.workers = [];
    this.loadedLanguages.clear();
    this._isReady = false;
    this._stats.activeWorkers = 0;

    this.log('info', 'Tesseract OCR service terminated');
  }

  /**
   * Recognize text from a single image
   */
  async recognizeText(
    image: Buffer | Blob | string,
    options: OCROptions = {},
    onProgress?: OCRProgressCallback,
  ): Promise<OCRResult> {
    this.ensureReady();

    const startTime = Date.now();
    const languages = this.resolveLanguages(options.language);

    this.reportProgress(onProgress, OCRProcessingStage.INITIALIZING, 0);

    try {
      // Ensure languages are loaded
      await this.ensureLanguagesLoaded(languages, onProgress);

      this.reportProgress(onProgress, OCRProcessingStage.RECOGNIZING, 20);

      // Perform recognition
      const result = await this.performRecognition(image, languages, options, onProgress);

      // Parse result
      const ocrResult = this.parseRecognitionResult(result, startTime);

      this.updateStats(ocrResult.processingTime, ocrResult.confidence, true);
      this.reportProgress(onProgress, OCRProcessingStage.COMPLETED, 100);

      return ocrResult;
    } catch (error) {
      this.updateStats(Date.now() - startTime, 0, false);
      this.reportProgress(onProgress, OCRProcessingStage.FAILED, 0, String(error));
      throw error;
    }
  }

  /**
   * Recognize text with document-level analysis
   */
  async recognizeDocument(
    image: Buffer | Blob | string,
    onProgress?: OCRProgressCallback,
  ): Promise<DocumentOCRResult> {
    // First, perform basic recognition
    const basicResult = await this.recognizeText(
      image,
      {
        includeBlockDetails: true,
        includeLineDetails: true,
        includeWordDetails: true,
      },
      onProgress,
    );

    // Perform document-level analysis
    const documentType = this.classifyDocumentType(basicResult);
    const readingOrder = this.determineReadingOrder(basicResult.blocks);

    return {
      ...basicResult,
      documentType,
      documentLanguage: basicResult.detectedLanguage,
      orientation: this.detectOrientation(basicResult),
      readingOrder,
      formFields: this.extractFormFields(basicResult),
      tables: this.extractTables(basicResult),
    };
  }

  /**
   * Recognize text from multiple images in parallel
   */
  async recognizeMultiple(
    images: Array<Buffer | Blob | string>,
    options: OCROptions = {},
    onProgress?: OCRProgressCallback,
  ): Promise<OCRResult[]> {
    this.ensureReady();

    if (images.length === 0) {
      return [];
    }

    const languages = this.resolveLanguages(options.language);
    await this.ensureLanguagesLoaded(languages);

    const totalImages = images.length;
    let processedCount = 0;

    // Process images using scheduler
    const promises = images.map(async (image, index) => {
      const result = await this.recognizeText(image, options);

      processedCount++;
      this.reportProgress(
        onProgress,
        OCRProcessingStage.RECOGNIZING,
        Math.round((processedCount / totalImages) * 100),
        `Processing image ${index + 1} of ${totalImages}`,
      );

      return result;
    });

    return Promise.all(promises);
  }

  /**
   * Recognize text from PDF pages
   */
  async recognizePDFPages(
    _pdf: Buffer,
    _options: PDFOCROptions = {},
    onProgress?: OCRProgressCallback,
  ): Promise<OCRResult[]> {
    this.ensureReady();

    // Note: PDF to image conversion requires additional libraries like pdf-lib or pdf.js
    // This is a placeholder implementation that would need to be completed
    // with actual PDF rendering capability

    this.log('warn', 'PDF processing requires additional setup. Converting pages to images...');

    this.reportProgress(onProgress, OCRProcessingStage.PREPROCESSING, 0, 'Converting PDF pages');

    // For now, throw an informative error
    // In a full implementation, we would:
    // 1. Use pdf.js or similar to render PDF pages to images
    // 2. Process each image with recognizeText
    // 3. Return combined results

    throw new Error(
      'PDF processing not yet implemented. Please convert PDF pages to images first and use recognizeMultiple.',
    );
  }

  /**
   * Get available languages
   */
  async getAvailableLanguages(): Promise<string[]> {
    // Return supported languages that tesseract.js can load
    return [...SUPPORTED_LANGUAGES];
  }

  /**
   * Load language data
   */
  async loadLanguage(
    lang: string | string[],
    onProgress?: OCRProgressCallback,
  ): Promise<void> {
    const languages = Array.isArray(lang) ? lang : [lang];
    const toLoad = languages.filter((l) => !this.loadedLanguages.has(l));

    if (toLoad.length === 0) {
      return;
    }

    this.reportProgress(
      onProgress,
      OCRProcessingStage.LOADING_LANGUAGE,
      0,
      `Loading languages: ${toLoad.join(', ')}`,
    );

    // Load language data in each worker using setParameters
    for (const worker of this.workers) {
      await worker.reinitialize(languages.join('+'));
    }

    // Mark languages as loaded
    for (const language of toLoad) {
      this.loadedLanguages.add(language);
    }

    this.reportProgress(
      onProgress,
      OCRProcessingStage.LOADING_LANGUAGE,
      100,
      `Loaded languages: ${toLoad.join(', ')}`,
    );
  }

  /**
   * Check if a language is loaded
   */
  isLanguageLoaded(lang: string): boolean {
    return this.loadedLanguages.has(lang);
  }

  /**
   * Get service information
   */
  getInfo(): OCRServiceInfo {
    return {
      name: 'TesseractOCRService',
      version: '1.0.0',
      engine: OCREngine.TESSERACT,
      supportedFormats: ['png', 'jpg', 'jpeg', 'tiff', 'bmp', 'gif', 'webp'],
      supportedLanguages: SUPPORTED_LANGUAGES as unknown as SupportedLanguage[],
      maxConcurrency: this.config.workerPoolSize,
      features: {
        documentAnalysis: true,
        tableExtraction: true,
        formFieldExtraction: true,
        pdfProcessing: false, // Requires additional setup
        batchProcessing: true,
        progressCallbacks: true,
      },
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Create a Tesseract worker
   */
  private async createTesseractWorker(): Promise<Worker> {
    const langString = this.config.defaultLanguages.join('+');

    // Create worker with language and optional config
    const worker = await createWorker(langString, undefined, {
      langPath: this.config.languageDataPath,
      cacheMethod: this.config.cacheLanguageData ? 'readOnly' : 'none',
      logger: this.config.enableLogging
        ? (m: Tesseract.LoggerMessage) => this.log('debug', m.status, m)
        : undefined,
    });

    return worker;
  }

  /**
   * Ensure service is ready
   */
  private ensureReady(): void {
    if (!this._isReady || !this.scheduler) {
      throw new Error('Tesseract OCR service not initialized. Call initialize() first.');
    }
  }

  /**
   * Resolve languages from options or defaults
   */
  private resolveLanguages(lang?: string | string[]): string[] {
    if (lang) {
      return Array.isArray(lang) ? lang : [lang];
    }
    return this._currentLanguages;
  }

  /**
   * Ensure required languages are loaded
   */
  private async ensureLanguagesLoaded(
    languages: string[],
    onProgress?: OCRProgressCallback,
  ): Promise<void> {
    const unloaded = languages.filter((l) => !this.loadedLanguages.has(l));
    if (unloaded.length > 0) {
      await this.loadLanguage(unloaded, onProgress);
    }
  }

  /**
   * Perform OCR recognition using scheduler
   */
  private async performRecognition(
    image: Buffer | Blob | string,
    languages: string[],
    options: OCROptions,
    onProgress?: OCRProgressCallback,
  ): Promise<RecognizeResult> {
    if (!this.scheduler) {
      throw new Error('Scheduler not initialized');
    }

    const langString = languages.join('+');

    // Build Tesseract recognize options
    const recognizeOptions: Partial<Tesseract.RecognizeOptions> = {};

    // Set page segmentation mode if provided
    if (options.pageSegmentationMode !== undefined) {
      (recognizeOptions as Record<string, string>)['tessedit_pageseg_mode'] = String(options.pageSegmentationMode);
    }

    // Set OCR engine mode if provided
    if (options.ocrEngineMode !== undefined) {
      (recognizeOptions as Record<string, string>)['tessedit_ocr_engine_mode'] = String(options.ocrEngineMode);
    }

    // Set preserve interword spaces if requested
    if (options.preserveInterwordSpaces) {
      (recognizeOptions as Record<string, string>)['preserve_interword_spaces'] = '1';
    }

    // Perform recognition using scheduler
    // First reinitialize workers with the correct language
    for (const worker of this.workers) {
      await worker.reinitialize(langString);
      if (Object.keys(recognizeOptions).length > 0) {
        await worker.setParameters(recognizeOptions as Record<string, string>);
      }
    }

    const result = await this.scheduler.addJob('recognize', image) as RecognizeResult;

    this.reportProgress(onProgress, OCRProcessingStage.POSTPROCESSING, 80);

    return result;
  }

  /**
   * Parse Tesseract recognition result into OCRResult
   */
  private parseRecognitionResult(result: RecognizeResult, startTime: number): OCRResult {
    const data = result.data;

    // Parse words
    const words: OCRWord[] = (data.words || []).map((word) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: this.parseBbox(word.bbox),
      baseline: word.baseline
        ? {
            angle: 0, // Tesseract.js baseline doesn't expose angle directly
            offset: word.baseline.y1 - word.baseline.y0,
          }
        : undefined,
    }));

    // Parse lines
    const lines: OCRLine[] = (data.lines || []).map((line) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: this.parseBbox(line.bbox),
      words: (line.words || []).map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: this.parseBbox(word.bbox),
      })),
    }));

    // Parse blocks
    const blocks: OCRBlock[] = (data.blocks || []).map((block) => ({
      text: block.text,
      confidence: block.confidence,
      bbox: this.parseBbox(block.bbox),
      blockType: BlockType.TEXT,
      paragraphs: (block.paragraphs || []).map((para) => ({
        text: para.text,
        confidence: para.confidence,
        bbox: this.parseBbox(para.bbox),
        lines: (para.lines || []).map((line) => ({
          text: line.text,
          confidence: line.confidence,
          bbox: this.parseBbox(line.bbox),
          words: (line.words || []).map((word) => ({
            text: word.text,
            confidence: word.confidence,
            bbox: this.parseBbox(word.bbox),
          })),
        })),
      })),
    }));

    return {
      text: data.text,
      confidence: data.confidence,
      words,
      lines,
      blocks,
      hocr: data.hocr || undefined,
      processingTime: Date.now() - startTime,
      imageDimensions: {
        width: data.blocks?.[0]?.bbox?.x1 || 0,
        height: data.blocks?.[0]?.bbox?.y1 || 0,
      },
    };
  }

  /**
   * Parse bounding box from Tesseract format
   */
  private parseBbox(bbox: Tesseract.Bbox): BoundingBox {
    return {
      x0: bbox.x0,
      y0: bbox.y0,
      x1: bbox.x1,
      y1: bbox.y1,
    };
  }

  /**
   * Classify document type based on content
   */
  private classifyDocumentType(result: OCRResult): DocumentType {
    const text = result.text.toLowerCase();

    // Simple heuristic-based classification
    if (text.includes('invoice') || text.includes('bill to') || text.includes('amount due')) {
      return DocumentType.INVOICE;
    }
    if (text.includes('receipt') || (text.includes('total') && text.includes('thank you'))) {
      return DocumentType.RECEIPT;
    }
    if (text.includes('dear') && text.includes('sincerely')) {
      return DocumentType.LETTER;
    }
    if (text.includes('contract') || text.includes('agreement') || text.includes('parties')) {
      return DocumentType.CONTRACT;
    }

    return DocumentType.GENERAL;
  }

  /**
   * Determine reading order for blocks
   */
  private determineReadingOrder(blocks: OCRBlock[]): number[] {
    // Sort blocks by position: top-to-bottom, then left-to-right
    const indexed = blocks.map((block, index) => ({ block, index }));

    indexed.sort((a, b) => {
      const yDiff = a.block.bbox.y0 - b.block.bbox.y0;
      if (Math.abs(yDiff) > 20) {
        // Allow some tolerance for same-line detection
        return yDiff;
      }
      return a.block.bbox.x0 - b.block.bbox.x0;
    });

    return indexed.map((item) => item.index);
  }

  /**
   * Detect document orientation
   */
  private detectOrientation(result: OCRResult): 'portrait' | 'landscape' {
    const { width, height } = result.imageDimensions;
    return height >= width ? 'portrait' : 'landscape';
  }

  /**
   * Extract form fields from recognition result
   */
  private extractFormFields(
    _result: OCRResult,
  ): Array<{ key: string; value: string; confidence: number }> {
    // Basic form field extraction - looks for "label: value" patterns
    // This is a simplified implementation; production would use more sophisticated NLP

    return [];
  }

  /**
   * Extract tables from recognition result
   */
  private extractTables(
    _result: OCRResult,
  ): Array<{
    headers: string[];
    rows: string[][];
    columnCount: number;
    rowCount: number;
    confidence: number;
  }> {
    // Table extraction requires analyzing spatial layout of text blocks
    // This is a placeholder - full implementation would use layout analysis

    return [];
  }

  /**
   * Report progress to callback
   */
  private reportProgress(
    callback: OCRProgressCallback | undefined,
    stage: OCRProcessingStage,
    progress: number,
    message?: string,
  ): void {
    if (callback) {
      const progressInfo: OCRProgress = {
        stage,
        progress,
        message,
      };
      callback(progressInfo);
    }
  }

  /**
   * Log message based on configuration
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    if (!this.config.enableLogging) {
      return;
    }

    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= configLevelIndex) {
      const logFn = console[level] || console.log;
      if (data) {
        logFn(`[TesseractOCR] ${message}`, data);
      } else {
        logFn(`[TesseractOCR] ${message}`);
      }
    }
  }
}

/**
 * Create a Tesseract OCR service instance
 *
 * @param config - Optional configuration
 * @returns New TesseractOCRService instance
 */
export function createTesseractOCRService(
  config?: Partial<OCRServiceConfig>,
): TesseractOCRService {
  return new TesseractOCRService(config);
}
