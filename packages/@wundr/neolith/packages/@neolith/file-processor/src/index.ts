/**
 * @genesis/file-processor
 *
 * File processing service for Genesis-App.
 * Supports PDF, DOCX, XLSX, and image files with OCR capabilities.
 *
 * @packageDocumentation
 */

import * as path from 'path';

// Main file processor class
import { createConfig, validateConfig } from './config';
import { createDocxProcessor } from './processors/docx';
import { createImageProcessor } from './processors/image';
import { createPdfProcessor } from './processors/pdf';
import { createXlsxProcessor } from './processors/xlsx';
import { createFileProcessingQueue } from './queue';
import { FileType } from './types';

import type { DocxProcessor } from './processors/docx';
import type { ImageProcessor } from './processors/image';
import type { PdfProcessor } from './processors/pdf';
import type { XlsxProcessor } from './processors/xlsx';
import type { FileProcessingQueue } from './queue';
import type {
  FileProcessorConfig,
  ProcessingOptions,
  FileProcessingJob,
  ProcessorResult,
} from './types-internal';

// Configuration exports
export {
  FileProcessorConfig,
  RedisConfig,
  QueueConfig,
  StorageConfig,
  OcrConfig,
  defaultConfig,
  createConfig,
  validateConfig,
} from './config';

// Type exports
export {
  FileType,
  FileMetadata,
  ProcessorResult,
  PageContent,
  TableData,
  ImageData,
  FileProcessingJob,
  ProcessingOptions,
  JobStatus,
  JobProgress,
} from './types';

// Processor exports
export {
  PdfProcessor,
  PdfProcessingOptions,
  createPdfProcessor,
} from './processors/pdf';

export {
  DocxProcessor,
  DocxProcessingOptions,
  createDocxProcessor,
} from './processors/docx';

export {
  XlsxProcessor,
  XlsxProcessingOptions,
  SheetData,
  CellValue,
  MergedCell,
  NamedRange,
  createXlsxProcessor,
} from './processors/xlsx';

export {
  ImageProcessor,
  ImageProcessingOptions,
  PageSegmentationMode,
  OcrResult,
  TextBlock,
  TextLine,
  TextWord,
  BoundingBox,
  ImageInfo,
  createImageProcessor,
} from './processors/image';

// Legacy Queue exports (backwards compatibility)
export {
  FileProcessingQueue,
  QueueEvent as LegacyQueueEvent,
  QueueStats as LegacyQueueStats,
  JobResult,
  QueueEventListener,
  createFileProcessingQueue,
} from './queue';

// New Queue Module exports
export {
  // Types
  ProcessingType,
  JobPriority,
  JobStatus as QueueJobStatus,
  QueueEvent,

  // Job interfaces
  ProcessingJob,
  JobInfo,
  ProcessingResult as QueueProcessingResult,
  ProcessingMetrics,

  // Event interfaces
  EventHandler,
  JobAddedEvent,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobRetryEvent,
  QueueErrorEvent,

  // Processor interfaces
  JobProcessor,
  ProcessorRegistry,

  // Configuration interfaces
  QueueOptions,
  RedisConnectionOptions,
  DeadLetterQueueOptions,
  RedisQueueConfig,
  MemoryQueueConfig,

  // Statistics
  QueueStats,

  // Processing Queue Interface
  ProcessingQueue,
  BaseProcessingQueue,

  // Redis Queue Implementation
  RedisProcessingQueue,
  createRedisProcessingQueue,

  // Memory Queue Implementation
  MemoryProcessingQueue,
  createMemoryProcessingQueue,

  // Job Worker
  JobWorker,
  JobWorkerConfig,
  Logger,
  SimpleProcessorRegistry,
  createJobWorker,
  createProcessorRegistry,

  // Processing Coordinator
  ProcessingCoordinator,
  StorageService,
  StoredFile,
  FileRecordService,
  FileRecord,
  UploadedFile,
  CoordinatorConfig,
  BatchProcessOptions,
  createProcessingCoordinator,

  // Factory functions
  QueueType,
  QueueFactoryOptions,
  createQueue,
  createQueueFromEnv,
} from './queue/index';

// Extractors Module exports
export {
  // Text Extraction Service
  TextExtractionService,
  TextExtractor,
  TextExtractorConfig,
  createTextExtractor,

  // PDF Extractor
  PDFExtractor,
  PDFExtractorImpl,
  PDFExtractorConfig,
  createPDFExtractor,

  // Office Document Extractor
  OfficeExtractor,
  OfficeExtractorImpl,
  OfficeExtractorConfig,
  createOfficeExtractor,

  // Table Extractor
  TableExtractor,
  TableExtractorImpl,
  TableDetectionConfig,
  CSVParseOptions,
  CSVOptions,
  createTableExtractor,

  // Extraction Types
  ExtractionInput,
  ExtractionOptions,
  ExtractionResult,
  DocumentMetadata,
  ExtractedTable,
  ExtractedImage,
  FileTypeResult,
  FileCategory,

  // PDF Extraction Types
  PDFOptions,
  PDFExtractionResult,
  PDFPage,
  PDFOutline,
  PDFAnnotation,
  PDFAnnotationType,
  PDFFormField,
  PDFFormFieldType,
  PDFMetadata,

  // DOCX Extraction Types
  DocxOptions,
  DocxExtractionResult,
  DocxHeading,
  DocxComment,
  DocxTrackChange,
  DocxStyle,

  // XLSX Extraction Types
  XlsxOptions,
  XlsxExtractionResult,
  XlsxSheet,
  XlsxNamedRange,
  XlsxWorkbookProperties,
  XlsxCellValue,
  XlsxRichText,

  // Common Extraction Types
  PageContent as ExtractorPageContent,
  PageDimensions,
  TextBlock as ExtractorTextBlock,
  BoundingBox as ExtractorBoundingBox,
  FontInfo,
  TableStructure,
  ColumnType,
  MergedCellInfo,
  PageRange,
  ImageDimensions,

  // Error Types
  ExtractionError,
  ExtractionErrorCode,
  PDFExtractionError,
  DocxExtractionError,
  XlsxExtractionError,
} from './extractors';

// OCR Service exports
export {
  // Service Interface & Base
  OCRService,
  OCRServiceInfo,
  OCRServiceFactory,
  OCRServiceFactoryConfig,
  BaseOCRService,

  // Tesseract Implementation
  TesseractOCRService,
  createTesseractOCRService,

  // Image Preprocessing
  ImagePreprocessor,
  createImagePreprocessor,
  PreprocessOptions,
  DEFAULT_PREPROCESS_OPTIONS,
  ImageAnalysis,

  // Layout Analysis
  LayoutAnalyzer,
  createLayoutAnalyzer,
  LayoutAnalyzerOptions,
  LayoutResult,
  Region,
  TextRegion,
  TableRegion,
  ImageRegion,
  RegionType,

  // OCR Types & Enums
  OCREngine,
  PageSegMode,
  OCREngineMode,
  BlockType,
  DocumentType,
  OCRProcessingStage,
  OCRErrorType,
  SUPPORTED_LANGUAGES,

  // OCR Core Types
  SupportedLanguage,
  BoundingBox as OCRBoundingBox,
  ExtendedBoundingBox,
  OCROptions,
  PDFOCROptions,
  OCRWord,
  OCRLine,
  OCRParagraph,
  OCRBlock,
  OCRResult,
  DocumentOCRResult,

  // OCR Table Types
  TableResult,
  TableCell,
  FormField,

  // OCR Progress & Stats
  OCRProgress,
  OCRProgressCallback,
  OCRServiceStats,
  OCRServiceConfig,
  OCRError,

  // Pipeline Utilities
  createOCRPipeline,
  quickOCR,
} from './ocr';

/**
 * Main file processor service
 */
export class FileProcessor {
  private config: FileProcessorConfig;
  private pdfProcessor: PdfProcessor;
  private docxProcessor: DocxProcessor;
  private xlsxProcessor: XlsxProcessor;
  private imageProcessor: ImageProcessor;
  private queue: FileProcessingQueue;
  private initialized = false;

  constructor(config?: Partial<FileProcessorConfig>) {
    this.config = createConfig(config);

    // Validate configuration
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Initialize processors
    this.pdfProcessor = createPdfProcessor(this.config);
    this.docxProcessor = createDocxProcessor(this.config);
    this.xlsxProcessor = createXlsxProcessor(this.config);
    this.imageProcessor = createImageProcessor(this.config);

    // Initialize queue
    this.queue = createFileProcessingQueue(this.config);
  }

  /**
   * Initialize the file processor service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.queue.initialize();
    await this.imageProcessor.initialize();
    this.initialized = true;
  }

  /**
   * Shutdown the file processor service
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.queue.close();
    await this.imageProcessor.cleanup();
    this.initialized = false;
  }

  /**
   * Process a file synchronously
   */
  async processFile(
    filePath: string,
    options?: ProcessingOptions,
  ): Promise<ProcessorResult> {
    const fileType = this.detectFileType(filePath);
    const mergedOptions = {
      ...this.config.defaultProcessingOptions,
      ...options,
    };

    switch (fileType) {
      case FileType.PDF:
        return this.pdfProcessor.process(filePath, mergedOptions);

      case FileType.DOCX:
        return this.docxProcessor.process(filePath, mergedOptions);

      case FileType.XLSX:
        return this.xlsxProcessor.process(filePath, mergedOptions);

      case FileType.PNG:
      case FileType.JPG:
      case FileType.JPEG:
      case FileType.TIFF:
      case FileType.IMAGE:
        return this.imageProcessor.process(filePath, mergedOptions);

      default:
        return {
          success: false,
          content: '',
          metadata: {
            filename: path.basename(filePath),
            mimeType: 'application/octet-stream',
            size: 0,
            fileType: FileType.UNKNOWN,
          },
          processingTime: 0,
          error: `Unsupported file type: ${fileType}`,
        };
    }
  }

  /**
   * Add a file to the processing queue
   */
  async queueFile(job: FileProcessingJob): Promise<string> {
    if (!this.initialized) {
      throw new Error('File processor not initialized');
    }

    return this.queue.addJob(job);
  }

  /**
   * Add multiple files to the processing queue
   */
  async queueFiles(jobs: FileProcessingJob[]): Promise<string[]> {
    if (!this.initialized) {
      throw new Error('File processor not initialized');
    }

    return this.queue.addBulkJobs(jobs);
  }

  /**
   * Get the processing queue
   */
  getQueue(): FileProcessingQueue {
    return this.queue;
  }

  /**
   * Get individual processors
   */
  getProcessors() {
    return {
      pdf: this.pdfProcessor,
      docx: this.docxProcessor,
      xlsx: this.xlsxProcessor,
      image: this.imageProcessor,
    };
  }

  /**
   * Detect file type from file path
   */
  private detectFileType(filePath: string): FileType {
    const ext = path.extname(filePath).toLowerCase().slice(1);

    const typeMap: Record<string, FileType> = {
      pdf: FileType.PDF,
      docx: FileType.DOCX,
      xlsx: FileType.XLSX,
      xls: FileType.XLSX,
      png: FileType.PNG,
      jpg: FileType.JPG,
      jpeg: FileType.JPEG,
      tiff: FileType.TIFF,
      tif: FileType.TIFF,
      webp: FileType.IMAGE,
      gif: FileType.IMAGE,
      bmp: FileType.IMAGE,
    };

    return typeMap[ext] || FileType.UNKNOWN;
  }

  /**
   * Get service information
   */
  getInfo() {
    return {
      name: '@genesis/file-processor',
      version: '0.1.0',
      initialized: this.initialized,
      processors: {
        pdf: this.pdfProcessor.getInfo(),
        docx: this.docxProcessor.getInfo(),
        xlsx: this.xlsxProcessor.getInfo(),
        image: this.imageProcessor.getInfo(),
      },
    };
  }
}

/**
 * Create file processor instance
 */
export function createFileProcessor(
  config?: Partial<FileProcessorConfig>,
): FileProcessor {
  return new FileProcessor(config);
}

// Default export
export default FileProcessor;
