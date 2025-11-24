/**
 * @genesis/file-processor - DOCX Processor
 *
 * Handles extraction of text, formatting, and structure from DOCX files.
 * Uses mammoth library for document conversion.
 */

import * as fs from 'fs';
import * as path from 'path';

import { FileType } from '../types';

import type { FileProcessorConfig } from '../config';
import type {
  ProcessorResult,
  FileMetadata,
  ProcessingOptions,
  TableData,
  ImageData,
} from '../types';

/**
 * DOCX processing options
 */
export interface DocxProcessingOptions extends ProcessingOptions {
  /** Output format */
  outputFormat?: 'text' | 'html' | 'markdown';

  /** Preserve formatting in output */
  preserveFormatting?: boolean;

  /** Extract embedded images */
  extractEmbeddedImages?: boolean;

  /** Convert images to base64 */
  inlineImages?: boolean;

  /** Style map for custom element handling */
  styleMap?: string[];
}

/**
 * Mammoth module interface for document conversion
 */
interface MammothModule {
  convertToHtml: (input: { path?: string; buffer?: Buffer }, options?: MammothOptions) => Promise<MammothResult>;
  extractRawText: (input: { path?: string; buffer?: Buffer }) => Promise<MammothResult>;
}

/**
 * Mammoth conversion options
 */
interface MammothOptions {
  styleMap?: string[];
  convertImage?: MammothImageConverter;
}

/**
 * Mammoth image converter interface
 */
interface MammothImageConverter {
  (element: MammothImageElement): Promise<{ src: string } | undefined>;
}

/**
 * Mammoth image element
 */
interface MammothImageElement {
  contentType: string;
  read: () => Promise<Buffer>;
}

/**
 * Mammoth conversion result
 */
interface MammothResult {
  value: string;
  messages: Array<{ type: string; message: string }>;
}

/**
 * DOCX processor class
 */
export class DocxProcessor {
  private _config: FileProcessorConfig;
  private mammoth: MammothModule | null = null;

  constructor(config: FileProcessorConfig) {
    this._config = config;
  }

  /**
   * Lazily load mammoth module
   */
  private async getMammoth(): Promise<MammothModule> {
    if (!this.mammoth) {
      const mammothModule = await import('mammoth');
      this.mammoth = mammothModule as unknown as MammothModule;
    }
    return this.mammoth;
  }

  /**
   * Process a DOCX file and extract content
   */
  async process(
    filePath: string,
    options: DocxProcessingOptions = {},
  ): Promise<ProcessorResult> {
    const startTime = Date.now();

    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Parse DOCX
      const docxData = await this.parseDocx(filePath, options);

      // Build metadata
      const metadata: FileMetadata = {
        filename: path.basename(filePath),
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: stats.size,
        fileType: FileType.DOCX,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        title: docxData.metadata?.title,
        author: docxData.metadata?.author,
        custom: {
          wordCount: this.countWords(docxData.text),
          paragraphCount: docxData.paragraphCount,
        },
      };

      // Build structured data
      const structuredData: Record<string, unknown> = {
        html: options.outputFormat === 'html' ? docxData.html : undefined,
        tables: options.extractTables ? docxData.tables : undefined,
        images: options.extractImages ? docxData.images : undefined,
        headings: docxData.headings,
        warnings: docxData.warnings,
      };

      return {
        success: true,
        content: docxData.text,
        metadata,
        processingTime: Date.now() - startTime,
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
   * Parse DOCX file and extract content
   *
   * @param filePath - Path to DOCX file
   * @param options - Processing options
   * @returns Parsed document content and structure
   */
  private async parseDocx(
    filePath: string,
    options: DocxProcessingOptions,
  ): Promise<{
    text: string;
    html: string;
    tables: TableData[];
    images: ImageData[];
    headings: HeadingData[];
    paragraphCount: number;
    warnings: string[];
    metadata?: { title?: string; author?: string };
  }> {
    const mammoth = await this.getMammoth();
    const images: ImageData[] = [];

    // Configure mammoth options
    const mammothOptions: MammothOptions = {
      styleMap: options.styleMap,
    };

    // Handle image extraction if enabled
    if (options.extractEmbeddedImages) {
      let imageIndex = 0;
      mammothOptions.convertImage = async (element: MammothImageElement) => {
        const imageResult = await this.handleImage(element);
        if (imageResult.src) {
          images.push({
            id: `img-${imageIndex++}`,
            format: element.contentType.split('/')[1] ?? 'unknown',
            data: imageResult.src,
            // Dimensions are not available from mammoth; would require image parsing
            dimensions: { width: 0, height: 0 },
          });
        }
        return options.inlineImages ? imageResult : undefined;
      };
    }

    // Convert to HTML and extract text
    const [htmlResult, textResult] = await Promise.all([
      mammoth.convertToHtml({ path: filePath }, mammothOptions),
      mammoth.extractRawText({ path: filePath }),
    ]);

    // Extract headings and tables from HTML
    const headings = this.extractHeadings(htmlResult.value);
    const tables = options.extractTables
      ? await this.extractTables(htmlResult.value)
      : [];

    // Count paragraphs
    const paragraphCount = (textResult.value.match(/\n\n+/g) ?? []).length + 1;

    // Collect warnings
    const warnings = [
      ...htmlResult.messages.map(m => `${m.type}: ${m.message}`),
      ...textResult.messages.map(m => `${m.type}: ${m.message}`),
    ];

    return {
      text: textResult.value,
      html: htmlResult.value,
      tables,
      images,
      headings,
      paragraphCount,
      warnings,
      metadata: undefined, // DOCX metadata extraction requires additional library
    };
  }

  /**
   * Extract tables from DOCX HTML content
   *
   * @param html - HTML content from mammoth conversion
   * @returns Extracted table data
   */
  private async extractTables(html: string): Promise<TableData[]> {
    const tables: TableData[] = [];

    // Simple regex-based table extraction from HTML
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;

    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableContent = tableMatch[1];
      if (!tableContent) {
        continue;
      }

      const rows: string[][] = [];
      let headers: string[] = [];
      let isFirstRow = true;

      let rowMatch: RegExpExecArray | null;
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const rowContent = rowMatch[1];
        if (!rowContent) {
          continue;
        }

        const cells: string[] = [];
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
          // Strip HTML tags and decode entities
          const cellText = (cellMatch[1] ?? '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          cells.push(cellText);
        }

        if (isFirstRow && rowContent.includes('<th')) {
          headers = cells;
        } else if (cells.length > 0) {
          rows.push(cells);
        }
        isFirstRow = false;
      }

      if (rows.length > 0 || headers.length > 0) {
        tables.push({ headers, rows });
      }
    }

    return tables;
  }

  /**
   * Handle embedded image conversion
   *
   * @param image - Image element from mammoth
   * @returns Image source (base64 data URL)
   */
  private async handleImage(image: MammothImageElement): Promise<{ src: string }> {
    try {
      const buffer = await image.read();
      const base64 = buffer.toString('base64');
      return { src: `data:${image.contentType};base64,${base64}` };
    } catch {
      return { src: '' };
    }
  }

  /**
   * Extract headings from HTML content
   *
   * @param html - HTML content from mammoth conversion
   * @returns Extracted heading structure
   */
  private extractHeadings(html: string): HeadingData[] {
    const headings: HeadingData[] = [];

    // Match h1-h6 tags
    const headingRegex = /<h([1-6])[^>]*(?:\s+id="([^"]*)")?[^>]*>([\s\S]*?)<\/h\1>/gi;

    let match: RegExpExecArray | null;
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1] ?? '1', 10);
      const id = match[2];
      const text = (match[3] ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

      if (text) {
        headings.push({
          level,
          text,
          id: id ?? undefined,
        });
      }
    }

    return headings;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0).length;
  }

  /**
   * Create empty metadata for error cases
   */
  private createEmptyMetadata(filePath: string): FileMetadata {
    return {
      filename: path.basename(filePath),
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 0,
      fileType: FileType.DOCX,
    };
  }

  /**
   * Get processor information
   */
  getInfo(): { name: string; version: string; supportedTypes: string[] } {
    return {
      name: 'DocxProcessor',
      version: '0.1.0',
      supportedTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    };
  }
}

/**
 * Heading data structure
 */
interface HeadingData {
  level: number;
  text: string;
  id?: string;
}

/**
 * Create DOCX processor instance
 */
export function createDocxProcessor(
  config: FileProcessorConfig,
): DocxProcessor {
  return new DocxProcessor(config);
}
