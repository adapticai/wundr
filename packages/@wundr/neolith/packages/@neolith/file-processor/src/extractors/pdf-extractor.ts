/**
 * @genesis/file-processor - PDF Extractor
 *
 * Specialized extractor for PDF documents using pdf-parse library.
 * Supports text extraction, metadata parsing, outline extraction,
 * and OCR fallback for scanned documents.
 *
 * @packageDocumentation
 */

import { ExtractionError, PDFExtractionError } from '../types/extraction';

import type { FileProcessorConfig } from '../config';
import type {
  PDFOptions,
  PDFExtractionResult,
  PDFPage,
  PDFOutline,
  PDFAnnotation,
  PDFFormField,
  PDFMetadata,
  DocumentMetadata,
  ExtractedTable,
  ExtractedImage,
  PageDimensions as _PageDimensions,
  TextBlock as _TextBlock,
  BoundingBox as _BoundingBox,
} from '../types/extraction';

// Re-export aliased types for external use
export type {
  _PageDimensions as PageDimensions,
  _TextBlock as TextBlock,
  _BoundingBox as BoundingBox,
};

// ============================================================================
// PDF Extractor Interface
// ============================================================================

/**
 * Interface for PDF extraction operations.
 */
export interface PDFExtractor {
  /**
   * Extract content from a PDF buffer.
   *
   * @param buffer - PDF file buffer
   * @param options - Extraction options
   * @returns PDF extraction result
   */
  extract(buffer: Buffer, options?: PDFOptions): Promise<PDFExtractionResult>;

  /**
   * Extract text from a specific page range.
   *
   * @param buffer - PDF file buffer
   * @param startPage - Starting page (1-indexed)
   * @param endPage - Ending page (inclusive)
   * @param options - Extraction options
   * @returns Extracted pages
   */
  extractPages(
    buffer: Buffer,
    startPage: number,
    endPage: number,
    options?: PDFOptions
  ): Promise<PDFPage[]>;

  /**
   * Get PDF metadata without extracting content.
   *
   * @param buffer - PDF file buffer
   * @returns PDF metadata
   */
  getMetadata(buffer: Buffer): Promise<PDFMetadata>;

  /**
   * Check if PDF is encrypted.
   *
   * @param buffer - PDF file buffer
   * @returns Whether PDF is encrypted
   */
  isEncrypted(buffer: Buffer): Promise<boolean>;

  /**
   * Get total page count.
   *
   * @param buffer - PDF file buffer
   * @returns Number of pages
   */
  getPageCount(buffer: Buffer): Promise<number>;
}

// ============================================================================
// PDF Parse Types
// ============================================================================

/**
 * PDF parse library result type.
 */
interface PDFParseResult {
  numpages: number;
  numrender: number;
  info: PDFInfo;
  metadata: PDFParsedMetadata | null;
  text: string;
  version: string;
}

/**
 * PDF info object from pdf-parse.
 */
interface PDFInfo {
  PDFFormatVersion?: string;
  IsAcroFormPresent?: boolean;
  IsXFAPresent?: boolean;
  Title?: string;
  Author?: string;
  Subject?: string;
  Keywords?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  Trapped?: string;
  [key: string]: unknown;
}

/**
 * PDF metadata object from pdf-parse.
 */
interface PDFParsedMetadata {
  _metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Page render callback context.
 */
interface _PageRenderContext {
  pageIndex: number;
  pageInfo: {
    num: number;
    width: number;
    height: number;
    rotate?: number;
  };
}

// ============================================================================
// PDF Extractor Implementation
// ============================================================================

/**
 * PDF extractor configuration.
 */
export interface PDFExtractorConfig {
  /** Maximum pages to process */
  maxPages?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** Custom pdf-parse options */
  pdfParseOptions?: Record<string, unknown>;

  /** File processor configuration */
  fileProcessorConfig?: FileProcessorConfig;
}

/**
 * Implementation of the PDF extractor.
 */
/**
 * Type for pdf-parse function.
 */
type PDFParseFunction = (
  dataBuffer: Buffer,
  options?: Record<string, unknown>
) => Promise<PDFParseResult>;

/**
 * Type for pdf-parse module.
 */
interface PDFParseModule {
  default?: PDFParseFunction;
  (
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PDFParseResult>;
}

export class PDFExtractorImpl implements PDFExtractor {
  private config: PDFExtractorConfig;
  private pdfParse: PDFParseFunction | null = null;

  /**
   * Create a new PDF extractor instance.
   */
  constructor(config?: PDFExtractorConfig) {
    this.config = {
      maxPages: 500,
      verbose: false,
      ...config,
    };
  }

  /**
   * Lazily load pdf-parse module.
   */
  private async getPdfParse(): Promise<PDFParseFunction> {
    if (!this.pdfParse) {
      try {
        const module = (await import('pdf-parse')) as PDFParseModule;
        // Handle both ESM and CommonJS exports
        this.pdfParse =
          typeof module.default === 'function'
            ? module.default
            : (module as unknown as PDFParseFunction);
      } catch (error) {
        throw new ExtractionError(
          'pdf-parse library not available. Please install: npm install pdf-parse',
          'EXTRACTION_FAILED',
          error instanceof Error ? error : undefined
        );
      }
    }
    return this.pdfParse;
  }

  /**
   * Extract content from a PDF buffer.
   */
  async extract(
    buffer: Buffer,
    options?: PDFOptions
  ): Promise<PDFExtractionResult> {
    const startTime = Date.now();
    const pages: PDFPage[] = [];
    const warnings: string[] = [];

    try {
      // Validate buffer
      if (!this.isPDFBuffer(buffer)) {
        throw new PDFExtractionError(
          'Invalid PDF: Buffer does not start with PDF signature',
          'INVALID_FILE'
        );
      }

      const pdfParse = await this.getPdfParse();

      // Prepare options for pdf-parse
      const maxPages = options?.maxPages ?? this.config.maxPages ?? 500;
      let currentPageText: string[] = [];
      let _currentPageIndex = 0;

      // Custom page render function to capture per-page content
      const pageRender = (pageData: {
        getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
      }) => {
        return pageData.getTextContent().then(textContent => {
          const pageText = textContent.items.map(item => item.str).join(' ');
          currentPageText.push(pageText);
          _currentPageIndex++;
          return pageText;
        });
      };

      // Parse PDF
      const parseOptions: Record<string, unknown> = {
        max: maxPages,
        pagerender: pageRender,
        ...this.config.pdfParseOptions,
      };

      // Handle password-protected PDFs
      if (options?.password) {
        parseOptions.password = options.password;
      }

      let pdfData: PDFParseResult;
      try {
        pdfData = await pdfParse(buffer, parseOptions);
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown error';

        // Check for password-related errors
        if (
          errorMessage.includes('password') ||
          errorMessage.includes('encrypted')
        ) {
          throw new PDFExtractionError(
            'PDF is password protected. Please provide the password.',
            'PASSWORD_REQUIRED'
          );
        }

        throw new PDFExtractionError(
          `Failed to parse PDF: ${errorMessage}`,
          'EXTRACTION_FAILED',
          undefined,
          parseError instanceof Error ? parseError : undefined
        );
      }

      // Build page content array
      const pageCount = pdfData.numpages;
      const processedPageCount = Math.min(pageCount, maxPages);

      // If page render didn't capture individual pages, split by common patterns
      if (currentPageText.length === 0) {
        currentPageText = this.splitTextIntoPages(
          pdfData.text,
          processedPageCount
        );
      }

      for (let i = 0; i < processedPageCount; i++) {
        const pageText = currentPageText[i] ?? '';
        const page: PDFPage = {
          pageNumber: i + 1,
          text: pageText.trim(),
          tables: options?.extractTables
            ? this.extractTablesFromText(pageText)
            : undefined,
        };

        pages.push(page);
      }

      // Check if OCR fallback is needed
      const totalText = pages.map(p => p.text).join(' ');
      let ocrProcessed = false;

      if (
        this.isTextScanLike(totalText) &&
        (options?.ocrFallback ?? options?.enableOcr)
      ) {
        warnings.push(
          'Document appears to be scanned. OCR processing recommended.'
        );
        ocrProcessed = true;
        // Note: Actual OCR would require additional implementation with tesseract.js
      }

      // Extract metadata
      const metadata = this.buildMetadata(pdfData, totalText);
      const pdfMetadata = this.buildPDFMetadata(pdfData);

      // Extract outlines if requested
      let outlines: PDFOutline[] | undefined;
      if (options?.extractOutlines) {
        outlines = await this.extractOutlines(buffer);
      }

      // Extract annotations if requested
      let annotations: PDFAnnotation[] | undefined;
      if (options?.extractAnnotations) {
        annotations = await this.extractAnnotations(buffer);
        if (annotations.length === 0) {
          annotations = undefined;
        }
      }

      // Extract form fields if requested
      let formFields: PDFFormField[] | undefined;
      if (options?.extractFormFields && pdfData.info.IsAcroFormPresent) {
        formFields = await this.extractFormFields(buffer);
        if (formFields.length === 0) {
          formFields = undefined;
        }
      }

      // Build extraction result
      const result: PDFExtractionResult = {
        text: totalText,
        pages,
        metadata,
        pdfMetadata,
        tables: options?.extractTables
          ? this.aggregateTables(pages)
          : undefined,
        images: options?.extractImages
          ? await this.extractImages(buffer, options)
          : undefined,
        outlines,
        annotations,
        formFields,
        success: true,
        processingTime: Date.now() - startTime,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      // Mark pages as OCR processed if applicable
      if (ocrProcessed) {
        for (const page of result.pages) {
          page.ocrProcessed = true;
        }
      }

      return result;
    } catch (error) {
      if (
        error instanceof PDFExtractionError ||
        error instanceof ExtractionError
      ) {
        throw error;
      }

      throw new PDFExtractionError(
        `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXTRACTION_FAILED',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract text from a specific page range.
   */
  async extractPages(
    buffer: Buffer,
    startPage: number,
    endPage: number,
    options?: PDFOptions
  ): Promise<PDFPage[]> {
    const result = await this.extract(buffer, {
      ...options,
      pageRange: { start: startPage, end: endPage },
    });

    return result.pages.filter(
      page => page.pageNumber >= startPage && page.pageNumber <= endPage
    );
  }

  /**
   * Get PDF metadata without extracting content.
   */
  async getMetadata(buffer: Buffer): Promise<PDFMetadata> {
    const pdfParse = await this.getPdfParse();

    const pdfData = await pdfParse(buffer, { max: 1 });
    return this.buildPDFMetadata(pdfData);
  }

  /**
   * Check if PDF is encrypted.
   */
  async isEncrypted(buffer: Buffer): Promise<boolean> {
    try {
      const pdfParse = await this.getPdfParse();
      await pdfParse(buffer, { max: 1 });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      return (
        errorMessage.includes('password') || errorMessage.includes('encrypted')
      );
    }
  }

  /**
   * Get total page count.
   */
  async getPageCount(buffer: Buffer): Promise<number> {
    const pdfParse = await this.getPdfParse();
    const pdfData = await pdfParse(buffer, { max: 1 });
    return pdfData.numpages;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check if buffer starts with PDF signature.
   */
  private isPDFBuffer(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.slice(0, 4).toString() === '%PDF';
  }

  /**
   * Check if text appears to be from a scanned document.
   */
  private isTextScanLike(text: string): boolean {
    const trimmed = text.replace(/\s+/g, '');

    // Very little text suggests scanned document
    if (trimmed.length < 50) {
      return true;
    }

    // High ratio of non-alphanumeric characters suggests poor OCR or scanned
    const alphanumeric = trimmed.replace(/[^a-zA-Z0-9]/g, '');
    if (alphanumeric.length / trimmed.length < 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Split text into pages using heuristics.
   */
  private splitTextIntoPages(text: string, pageCount: number): string[] {
    if (pageCount <= 1) {
      return [text];
    }

    // Try to split by form feed characters
    const ffPages = text.split('\f');
    if (ffPages.length >= pageCount) {
      return ffPages.slice(0, pageCount);
    }

    // Split by approximate length
    const avgLength = Math.ceil(text.length / pageCount);
    const pages: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const start = i * avgLength;
      const end = Math.min((i + 1) * avgLength, text.length);

      // Try to split at paragraph boundaries
      let splitEnd = end;
      if (end < text.length) {
        const nextNewline = text.indexOf('\n', end);
        if (nextNewline !== -1 && nextNewline - end < 200) {
          splitEnd = nextNewline + 1;
        }
      }

      pages.push(text.slice(start, splitEnd));
    }

    return pages;
  }

  /**
   * Extract tables from text content.
   */
  private extractTablesFromText(text: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];

    // Simple table detection: look for lines with consistent delimiters
    const lines = text.split('\n');
    let tableStart = -1;
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hasDelimiters =
        (line.match(/\t/g)?.length ?? 0) >= 2 ||
        (line.match(/\|/g)?.length ?? 0) >= 2 ||
        (line.match(/\s{3,}/g)?.length ?? 0) >= 2;

      if (hasDelimiters) {
        if (tableStart === -1) {
          tableStart = i;
        }
        tableLines.push(line);
      } else if (tableStart !== -1 && tableLines.length >= 2) {
        // End of table
        const table = this.parseTableLines(tableLines, tableStart);
        if (table) {
          tables.push(table);
        }
        tableStart = -1;
        tableLines = [];
      } else {
        tableStart = -1;
        tableLines = [];
      }
    }

    // Check for remaining table
    if (tableLines.length >= 2) {
      const table = this.parseTableLines(tableLines, tableStart);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Parse table lines into ExtractedTable.
   */
  private parseTableLines(
    lines: string[],
    startRow: number
  ): ExtractedTable | null {
    if (lines.length < 2) {
      return null;
    }

    // Detect delimiter
    const firstLine = lines[0];
    let delimiter: RegExp;

    if (firstLine.includes('\t')) {
      delimiter = /\t+/;
    } else if (firstLine.includes('|')) {
      delimiter = /\s*\|\s*/;
    } else {
      delimiter = /\s{3,}/;
    }

    const rows = lines.map(line =>
      line
        .split(delimiter)
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0)
    );

    // Ensure consistent column count
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    // First row as headers
    const headers = normalizedRows[0];
    const dataRows = normalizedRows.slice(1);

    return {
      headers,
      rows: dataRows,
      startRow,
      endRow: startRow + lines.length - 1,
      columnCount: maxCols,
      rowCount: dataRows.length,
    };
  }

  /**
   * Aggregate tables from all pages.
   */
  private aggregateTables(pages: PDFPage[]): ExtractedTable[] {
    const tables: ExtractedTable[] = [];

    for (const page of pages) {
      if (page.tables) {
        for (const table of page.tables) {
          tables.push({
            ...table,
            pageNumber: page.pageNumber,
          });
        }
      }
    }

    return tables;
  }

  /**
   * Build document metadata from PDF data.
   */
  private buildMetadata(
    pdfData: PDFParseResult,
    text: string
  ): DocumentMetadata {
    const info = pdfData.info;

    return {
      title: info.Title ?? undefined,
      author: info.Author ?? undefined,
      subject: info.Subject ?? undefined,
      keywords: info.Keywords
        ? info.Keywords.split(/[,;]/).map(k => k.trim())
        : undefined,
      creator: info.Creator ?? undefined,
      producer: info.Producer ?? undefined,
      createdAt: info.CreationDate
        ? this.parsePDFDate(info.CreationDate)
        : undefined,
      modifiedAt: info.ModDate ? this.parsePDFDate(info.ModDate) : undefined,
      pageCount: pdfData.numpages,
      wordCount: this.countWords(text),
      characterCount: text.length,
      pdfVersion: info.PDFFormatVersion ?? pdfData.version,
    };
  }

  /**
   * Build PDF-specific metadata.
   */
  private buildPDFMetadata(pdfData: PDFParseResult): PDFMetadata {
    const info = pdfData.info;

    return {
      pdfVersion: info.PDFFormatVersion ?? pdfData.version ?? '1.0',
      title: info.Title ?? undefined,
      author: info.Author ?? undefined,
      subject: info.Subject ?? undefined,
      keywords: info.Keywords
        ? info.Keywords.split(/[,;]/).map(k => k.trim())
        : undefined,
      creator: info.Creator ?? undefined,
      producer: info.Producer ?? undefined,
      createdAt: info.CreationDate
        ? this.parsePDFDate(info.CreationDate)
        : undefined,
      modifiedAt: info.ModDate ? this.parsePDFDate(info.ModDate) : undefined,
      pageCount: pdfData.numpages,
      hasJavaScript: false, // Would need deeper analysis
      hasEmbeddedFiles: false, // Would need deeper analysis
    };
  }

  /**
   * Parse PDF date string.
   */
  private parsePDFDate(dateStr: string): Date | undefined {
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
      if (dateStr.startsWith('D:')) {
        dateStr = dateStr.slice(2);
      }

      const year = parseInt(dateStr.slice(0, 4), 10);
      const month = parseInt(dateStr.slice(4, 6) || '01', 10) - 1;
      const day = parseInt(dateStr.slice(6, 8) || '01', 10);
      const hour = parseInt(dateStr.slice(8, 10) || '00', 10);
      const minute = parseInt(dateStr.slice(10, 12) || '00', 10);
      const second = parseInt(dateStr.slice(12, 14) || '00', 10);

      return new Date(year, month, day, hour, minute, second);
    } catch {
      return undefined;
    }
  }

  /**
   * Count words in text.
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  /**
   * Extract PDF outlines/bookmarks.
   * Note: This is a placeholder - full implementation would require pdfjs-dist.
   */
  private async extractOutlines(_buffer: Buffer): Promise<PDFOutline[]> {
    // TODO: Implement with pdfjs-dist for full outline extraction
    return [];
  }

  /**
   * Extract PDF annotations.
   * Note: This is a placeholder - full implementation would require pdfjs-dist.
   */
  private async extractAnnotations(_buffer: Buffer): Promise<PDFAnnotation[]> {
    // TODO: Implement with pdfjs-dist for full annotation extraction
    return [];
  }

  /**
   * Extract PDF form fields.
   * Note: This is a placeholder - full implementation would require pdfjs-dist.
   */
  private async extractFormFields(_buffer: Buffer): Promise<PDFFormField[]> {
    // TODO: Implement with pdfjs-dist for full form field extraction
    return [];
  }

  /**
   * Extract images from PDF.
   * Note: This is a placeholder - full implementation would require pdfjs-dist.
   */
  private async extractImages(
    _buffer: Buffer,
    _options?: PDFOptions
  ): Promise<ExtractedImage[]> {
    // TODO: Implement with pdfjs-dist for full image extraction
    return [];
  }

  /**
   * Get extractor information.
   */
  getInfo(): { name: string; version: string; supportedTypes: string[] } {
    return {
      name: 'PDFExtractor',
      version: '0.1.0',
      supportedTypes: ['application/pdf'],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new PDF extractor instance.
 *
 * @param config - File processor configuration
 * @returns PDF extractor instance
 *
 * @example
 * ```typescript
 * const extractor = createPDFExtractor();
 *
 * const result = await extractor.extract(pdfBuffer, {
 *   extractTables: true,
 *   extractOutlines: true,
 * });
 * ```
 */
export function createPDFExtractor(config?: FileProcessorConfig): PDFExtractor {
  return new PDFExtractorImpl({ fileProcessorConfig: config });
}

// ============================================================================
// Exports
// ============================================================================
