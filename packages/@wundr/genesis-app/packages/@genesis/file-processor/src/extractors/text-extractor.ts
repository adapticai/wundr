/**
 * @genesis/file-processor - Text Extraction Service
 *
 * Unified text extraction service that provides a consistent interface
 * for extracting text content from various document formats including
 * PDF, DOCX, XLSX, and images.
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

import type { FileProcessorConfig } from '../config';
import type {
  ExtractionInput,
  ExtractionResult,
  ExtractionOptions,
  DocumentMetadata,
  FileTypeResult,
  FileCategory,
  PDFOptions,
  PDFExtractionResult,
  DocxOptions,
  DocxExtractionResult,
  XlsxOptions,
  XlsxExtractionResult,
  ExtractedTable,
  ExtractedImage,
  PageContent,
} from '../types/extraction';
import { ExtractionError } from '../types/extraction';

import { createPDFExtractor, PDFExtractor } from './pdf-extractor';
import { createOfficeExtractor, OfficeExtractor } from './office-extractor';
import { createTableExtractor, TableExtractor } from './table-extractor';

// ============================================================================
// File Signatures for Type Detection
// ============================================================================

/**
 * Magic byte signatures for common file formats.
 */
const FILE_SIGNATURES: Array<{
  signature: number[];
  offset: number;
  mimeType: string;
  extension: string;
  category: FileCategory;
}> = [
  // PDF
  { signature: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf', extension: 'pdf', category: 'document' },

  // Office Open XML (ZIP-based)
  { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0, mimeType: 'application/zip', extension: 'zip', category: 'archive' },

  // Old Office formats (OLE2)
  { signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], offset: 0, mimeType: 'application/x-ole-storage', extension: 'ole', category: 'document' },

  // Images
  { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, mimeType: 'image/png', extension: 'png', category: 'image' },
  { signature: [0xff, 0xd8, 0xff], offset: 0, mimeType: 'image/jpeg', extension: 'jpg', category: 'image' },
  { signature: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: 'image/gif', extension: 'gif', category: 'image' },
  { signature: [0x42, 0x4d], offset: 0, mimeType: 'image/bmp', extension: 'bmp', category: 'image' },
  { signature: [0x49, 0x49, 0x2a, 0x00], offset: 0, mimeType: 'image/tiff', extension: 'tiff', category: 'image' },
  { signature: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, mimeType: 'image/tiff', extension: 'tiff', category: 'image' },
  { signature: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: 'image/webp', extension: 'webp', category: 'image' },
];

/**
 * Office Open XML content type patterns.
 */
const OOXML_CONTENT_TYPES: Record<string, { mimeType: string; extension: string; category: FileCategory }> = {
  'word/document.xml': {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: 'docx',
    category: 'document',
  },
  'xl/workbook.xml': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    category: 'spreadsheet',
  },
  'ppt/presentation.xml': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: 'pptx',
    category: 'presentation',
  },
};

// ============================================================================
// Text Extraction Service Interface
// ============================================================================

/**
 * Interface for the text extraction service.
 */
export interface TextExtractionService {
  /**
   * Extract text from a document using automatic type detection.
   *
   * @param input - Extraction input containing buffer and options
   * @returns Extraction result with text and metadata
   */
  extractText(input: ExtractionInput): Promise<ExtractionResult>;

  /**
   * Extract text and content from a PDF document.
   *
   * @param buffer - PDF file buffer
   * @param options - PDF-specific extraction options
   * @returns PDF extraction result
   */
  extractFromPDF(buffer: Buffer, options?: PDFOptions): Promise<PDFExtractionResult>;

  /**
   * Extract text and content from a DOCX document.
   *
   * @param buffer - DOCX file buffer
   * @param options - DOCX-specific extraction options
   * @returns DOCX extraction result
   */
  extractFromDocx(buffer: Buffer, options?: DocxOptions): Promise<DocxExtractionResult>;

  /**
   * Extract text and content from an XLSX spreadsheet.
   *
   * @param buffer - XLSX file buffer
   * @param options - XLSX-specific extraction options
   * @returns XLSX extraction result
   */
  extractFromXlsx(buffer: Buffer, options?: XlsxOptions): Promise<XlsxExtractionResult>;

  /**
   * Detect the file type from a buffer.
   *
   * @param buffer - File buffer to analyze
   * @returns File type detection result
   */
  detectFileType(buffer: Buffer): Promise<FileTypeResult>;

  /**
   * Extract text from a file path.
   *
   * @param filePath - Path to the file
   * @param options - Extraction options
   * @returns Extraction result
   */
  extractFromFile(filePath: string, options?: ExtractionOptions): Promise<ExtractionResult>;

  /**
   * Extract text from a readable stream.
   *
   * @param stream - Readable stream containing file data
   * @param options - Extraction options
   * @returns Extraction result
   */
  extractFromStream(stream: Readable, options?: ExtractionOptions): Promise<ExtractionResult>;
}

// ============================================================================
// Text Extraction Service Implementation
// ============================================================================

/**
 * Configuration for the text extraction service.
 */
export interface TextExtractorConfig {
  /** Maximum file size to process (in bytes) */
  maxFileSize?: number;

  /** Default timeout for extraction operations (in milliseconds) */
  defaultTimeout?: number;

  /** Enable OCR by default for image-based documents */
  enableOcrByDefault?: boolean;

  /** OCR languages to use by default */
  defaultOcrLanguages?: string[];

  /** Temporary directory for intermediate files */
  tempDirectory?: string;

  /** Maximum number of pages to process by default */
  defaultMaxPages?: number;

  /** File processor configuration */
  fileProcessorConfig?: FileProcessorConfig;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<TextExtractorConfig, 'fileProcessorConfig'>> = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  defaultTimeout: 60000, // 1 minute
  enableOcrByDefault: false,
  defaultOcrLanguages: ['eng'],
  tempDirectory: '/tmp/genesis-extractor',
  defaultMaxPages: 500,
};

/**
 * Implementation of the text extraction service.
 */
export class TextExtractor implements TextExtractionService {
  private config: Required<Omit<TextExtractorConfig, 'fileProcessorConfig'>> & { fileProcessorConfig?: FileProcessorConfig };
  private pdfExtractor: PDFExtractor;
  private officeExtractor: OfficeExtractor;
  private tableExtractor: TableExtractor;

  /**
   * Create a new TextExtractor instance.
   *
   * @param config - Configuration options
   */
  constructor(config?: TextExtractorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Initialize sub-extractors
    this.pdfExtractor = createPDFExtractor(this.config.fileProcessorConfig);
    this.officeExtractor = createOfficeExtractor(this.config.fileProcessorConfig);
    this.tableExtractor = createTableExtractor();
  }

  /**
   * Extract text from a document using automatic type detection.
   */
  async extractText(input: ExtractionInput): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateInput(input);

      // Detect file type
      const fileType = await this.detectFileType(input.buffer);

      if (!fileType.supported) {
        throw new ExtractionError(
          `Unsupported file format: ${fileType.mimeType}`,
          'UNSUPPORTED_FORMAT'
        );
      }

      // Route to appropriate extractor
      const options = input.options ?? {};
      let result: ExtractionResult;

      switch (fileType.extension) {
        case 'pdf':
          result = await this.extractFromPDF(input.buffer, options as PDFOptions);
          break;

        case 'docx':
          result = await this.extractFromDocx(input.buffer, options as DocxOptions);
          break;

        case 'xlsx':
          result = await this.extractFromXlsx(input.buffer, options as XlsxOptions);
          break;

        default:
          throw new ExtractionError(
            `No extractor available for format: ${fileType.extension}`,
            'UNSUPPORTED_FORMAT'
          );
      }

      return {
        ...result,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return this.createErrorResult(error, startTime);
    }
  }

  /**
   * Extract text and content from a PDF document.
   */
  async extractFromPDF(buffer: Buffer, options?: PDFOptions): Promise<PDFExtractionResult> {
    const startTime = Date.now();

    try {
      this.validateBuffer(buffer);

      const mergedOptions: PDFOptions = {
        maxPages: this.config.defaultMaxPages,
        enableOcr: this.config.enableOcrByDefault,
        ocrLanguages: this.config.defaultOcrLanguages,
        timeout: this.config.defaultTimeout,
        ...options,
      };

      return await this.pdfExtractor.extract(buffer, mergedOptions);
    } catch (error) {
      return {
        ...this.createErrorResult(error, startTime),
        pages: [],
        documentType: 'pdf',
      } as PDFExtractionResult;
    }
  }

  /**
   * Extract text and content from a DOCX document.
   */
  async extractFromDocx(buffer: Buffer, options?: DocxOptions): Promise<DocxExtractionResult> {
    const startTime = Date.now();

    try {
      this.validateBuffer(buffer);

      const mergedOptions: DocxOptions = {
        timeout: this.config.defaultTimeout,
        ...options,
      };

      return await this.officeExtractor.extractDocx(buffer, mergedOptions);
    } catch (error) {
      return {
        ...this.createErrorResult(error, startTime),
        documentType: 'docx',
      } as DocxExtractionResult;
    }
  }

  /**
   * Extract text and content from an XLSX spreadsheet.
   */
  async extractFromXlsx(buffer: Buffer, options?: XlsxOptions): Promise<XlsxExtractionResult> {
    const startTime = Date.now();

    try {
      this.validateBuffer(buffer);

      const mergedOptions: XlsxOptions = {
        timeout: this.config.defaultTimeout,
        ...options,
      };

      return await this.officeExtractor.extractXlsx(buffer, mergedOptions);
    } catch (error) {
      return {
        ...this.createErrorResult(error, startTime),
        documentType: 'xlsx',
        sheets: [],
      } as XlsxExtractionResult;
    }
  }

  /**
   * Detect the file type from a buffer.
   */
  async detectFileType(buffer: Buffer): Promise<FileTypeResult> {
    // Check magic bytes
    for (const sig of FILE_SIGNATURES) {
      if (this.matchSignature(buffer, sig.signature, sig.offset)) {
        // Special handling for ZIP-based formats (Office Open XML)
        if (sig.mimeType === 'application/zip') {
          const ooxmlType = await this.detectOOXMLType(buffer);
          if (ooxmlType) {
            return {
              ...ooxmlType,
              confidence: 0.95,
              signature: 'PK',
              supported: true,
            };
          }
        }

        return {
          mimeType: sig.mimeType,
          extension: sig.extension,
          category: sig.category,
          confidence: 0.9,
          signature: sig.signature.map(b => b.toString(16).padStart(2, '0')).join(' '),
          supported: this.isSupported(sig.extension),
        };
      }
    }

    // Unknown file type
    return {
      mimeType: 'application/octet-stream',
      extension: 'bin',
      category: 'unknown',
      confidence: 0,
      supported: false,
    };
  }

  /**
   * Extract text from a file path.
   */
  async extractFromFile(filePath: string, options?: ExtractionOptions): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        throw new ExtractionError(
          `File not found: ${filePath}`,
          'FILE_NOT_FOUND'
        );
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size > this.config.maxFileSize) {
        throw new ExtractionError(
          `File size exceeds maximum allowed: ${stats.size} > ${this.config.maxFileSize}`,
          'OUT_OF_MEMORY'
        );
      }

      // Read file buffer
      const buffer = fs.readFileSync(filePath);

      // Extract with filename hint
      return await this.extractText({
        buffer,
        filename: path.basename(filePath),
        options,
      });
    } catch (error) {
      return this.createErrorResult(error, startTime);
    }
  }

  /**
   * Extract text from a readable stream.
   */
  async extractFromStream(stream: Readable, options?: ExtractionOptions): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Collect stream into buffer
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of stream) {
        totalSize += chunk.length;
        if (totalSize > this.config.maxFileSize) {
          throw new ExtractionError(
            `Stream size exceeds maximum allowed: ${totalSize} > ${this.config.maxFileSize}`,
            'OUT_OF_MEMORY'
          );
        }
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      return await this.extractText({
        buffer,
        options,
      });
    } catch (error) {
      return this.createErrorResult(error, startTime);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate extraction input.
   */
  private validateInput(input: ExtractionInput): void {
    if (!input.buffer || !Buffer.isBuffer(input.buffer)) {
      throw new ExtractionError('Invalid input: buffer is required', 'INVALID_FILE');
    }

    if (input.buffer.length === 0) {
      throw new ExtractionError('Invalid input: buffer is empty', 'INVALID_FILE');
    }

    if (input.buffer.length > this.config.maxFileSize) {
      throw new ExtractionError(
        `File size exceeds maximum allowed: ${input.buffer.length} > ${this.config.maxFileSize}`,
        'OUT_OF_MEMORY'
      );
    }
  }

  /**
   * Validate a buffer.
   */
  private validateBuffer(buffer: Buffer): void {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ExtractionError('Invalid buffer', 'INVALID_FILE');
    }

    if (buffer.length === 0) {
      throw new ExtractionError('Buffer is empty', 'INVALID_FILE');
    }

    if (buffer.length > this.config.maxFileSize) {
      throw new ExtractionError(
        `Buffer size exceeds maximum allowed: ${buffer.length} > ${this.config.maxFileSize}`,
        'OUT_OF_MEMORY'
      );
    }
  }

  /**
   * Check if a signature matches the buffer.
   */
  private matchSignature(buffer: Buffer, signature: number[], offset: number): boolean {
    if (buffer.length < offset + signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect Office Open XML document type by inspecting ZIP contents.
   */
  private async detectOOXMLType(buffer: Buffer): Promise<{
    mimeType: string;
    extension: string;
    category: FileCategory;
  } | null> {
    try {
      // Simple check: look for content type markers in the buffer
      const content = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));

      for (const [marker, type] of Object.entries(OOXML_CONTENT_TYPES)) {
        if (content.includes(marker) || content.includes('[Content_Types].xml')) {
          // Try to determine specific type
          if (content.includes('word/') || content.includes('wordprocessingml')) {
            return OOXML_CONTENT_TYPES['word/document.xml'];
          }
          if (content.includes('xl/') || content.includes('spreadsheetml')) {
            return OOXML_CONTENT_TYPES['xl/workbook.xml'];
          }
          if (content.includes('ppt/') || content.includes('presentationml')) {
            return OOXML_CONTENT_TYPES['ppt/presentation.xml'];
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file extension is supported.
   */
  private isSupported(extension: string): boolean {
    const supportedExtensions = ['pdf', 'docx', 'xlsx'];
    return supportedExtensions.includes(extension.toLowerCase());
  }

  /**
   * Create an error result.
   */
  private createErrorResult(error: unknown, startTime: number): ExtractionResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof ExtractionError ? error.code : 'EXTRACTION_FAILED';

    return {
      text: '',
      success: false,
      error: `[${errorCode}] ${errorMessage}`,
      metadata: {
        wordCount: 0,
        characterCount: 0,
      },
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Get service information.
   */
  getInfo(): {
    name: string;
    version: string;
    supportedFormats: string[];
    config: TextExtractorConfig;
  } {
    return {
      name: 'TextExtractionService',
      version: '0.1.0',
      supportedFormats: ['pdf', 'docx', 'xlsx'],
      config: this.config,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new text extraction service instance.
 *
 * @param config - Configuration options
 * @returns TextExtractionService instance
 *
 * @example
 * ```typescript
 * const extractor = createTextExtractor({
 *   maxFileSize: 50 * 1024 * 1024, // 50MB
 *   enableOcrByDefault: true,
 * });
 *
 * const result = await extractor.extractText({
 *   buffer: fileBuffer,
 *   filename: 'document.pdf',
 * });
 * ```
 */
export function createTextExtractor(config?: TextExtractorConfig): TextExtractionService {
  return new TextExtractor(config);
}

// ============================================================================
// Exports
// ============================================================================
