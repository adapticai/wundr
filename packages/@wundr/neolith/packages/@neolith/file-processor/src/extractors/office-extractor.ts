/**
 * @genesis/file-processor - Office Document Extractor
 *
 * Specialized extractor for Microsoft Office documents (DOCX, XLSX, PPTX).
 * Uses mammoth for DOCX and xlsx for spreadsheet parsing.
 *
 * @packageDocumentation
 */

import {
  ExtractionError,
  DocxExtractionError,
  XlsxExtractionError,
} from '../types/extraction';

import type { FileProcessorConfig } from '../config';
import type {
  DocxOptions,
  DocxExtractionResult,
  DocxHeading,
  DocxComment as _DocxComment,
  DocxTrackChange as _DocxTrackChange,
  DocxStyle as _DocxStyle,
  XlsxOptions,
  XlsxExtractionResult,
  XlsxSheet,
  XlsxNamedRange,
  XlsxWorkbookProperties,
  XlsxCellValue,
  XlsxRichText as _XlsxRichText,
  MergedCellInfo,
  DocumentMetadata,
  ExtractedTable,
  ExtractedImage as _ExtractedImage,
} from '../types/extraction';

// ============================================================================
// Office Extractor Interface
// ============================================================================

/**
 * Interface for Office document extraction operations.
 */
export interface OfficeExtractor {
  /**
   * Extract content from a DOCX document.
   *
   * @param buffer - DOCX file buffer
   * @param options - Extraction options
   * @returns DOCX extraction result
   */
  extractDocx(
    buffer: Buffer,
    options?: DocxOptions
  ): Promise<DocxExtractionResult>;

  /**
   * Extract content from an XLSX spreadsheet.
   *
   * @param buffer - XLSX file buffer
   * @param options - Extraction options
   * @returns XLSX extraction result
   */
  extractXlsx(
    buffer: Buffer,
    options?: XlsxOptions
  ): Promise<XlsxExtractionResult>;

  /**
   * Check if buffer is a valid DOCX file.
   *
   * @param buffer - File buffer
   * @returns Whether buffer is a valid DOCX
   */
  isDocx(buffer: Buffer): boolean;

  /**
   * Check if buffer is a valid XLSX file.
   *
   * @param buffer - File buffer
   * @returns Whether buffer is a valid XLSX
   */
  isXlsx(buffer: Buffer): boolean;
}

// ============================================================================
// Office Extractor Implementation
// ============================================================================

/**
 * Office extractor configuration.
 */
export interface OfficeExtractorConfig {
  /** Maximum sheets to process for XLSX */
  maxSheets?: number;

  /** Maximum rows per sheet for XLSX */
  maxRowsPerSheet?: number;

  /** Enable verbose logging */
  verbose?: boolean;

  /** File processor configuration */
  fileProcessorConfig?: FileProcessorConfig;
}

/**
 * Mammoth result type.
 */
interface MammothResult {
  value: string;
  messages: Array<{ type: string; message: string }>;
}

/**
 * XLSX library types - using strict typing for xlsx library compatibility.
 * These types are compatible with the xlsx library and provide full type safety.
 */

/**
 * XLSX merged cell range type
 */
interface XLSXMerge {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

/**
 * XLSX workbook structure
 */
interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: Record<string, XLSXSheet>;
  Props?: XLSXProperties;
  Workbook?: {
    Names?: Array<{ Name: string; Ref: string; Sheet?: number }>;
  };
}

/**
 * XLSX worksheet structure
 */
interface XLSXSheet {
  '!ref'?: string;
  '!merges'?: XLSXMerge[];
  [cell: string]: XLSXCell | string | XLSXMerge[] | undefined;
}

/**
 * XLSX cell structure
 */
interface XLSXCell {
  t?: string; // type: s=string, n=number, b=boolean, d=date
  v?: string | number | boolean | Date; // value
  w?: string; // formatted text
  r?: XLSXRichText; // rich text
  f?: string; // formula
  s?: Record<string, unknown>; // style object
}

/**
 * XLSX rich text structure
 */
interface XLSXRichText {
  r: Array<{ t: string }>;
}

/**
 * XLSX document properties
 */
interface XLSXProperties {
  Title?: string;
  Subject?: string;
  Author?: string;
  Creator?: string;
  LastAuthor?: string;
  CreatedDate?: Date;
  ModifiedDate?: Date;
  Keywords?: string;
  Description?: string;
  Category?: string;
  Company?: string;
  Manager?: string;
}

/**
 * Type for xlsx module to avoid import errors.
 */
interface XLSXModule {
  read: (data: Buffer, options?: Record<string, unknown>) => XLSXWorkbook;
  utils: {
    decode_range: (range: string) => {
      s: { r: number; c: number };
      e: { r: number; c: number };
    };
    encode_cell: (cell: { r: number; c: number }) => string;
  };
}

/**
 * Mammoth module interface for document conversion.
 */
interface MammothModule {
  convertToHtml: (
    input: { buffer: Buffer },
    options?: Record<string, unknown>
  ) => Promise<MammothResult>;
  extractRawText: (input: { buffer: Buffer }) => Promise<MammothResult>;
}

/**
 * Implementation of the Office document extractor.
 */
export class OfficeExtractorImpl implements OfficeExtractor {
  private config: OfficeExtractorConfig;
  private mammoth: MammothModule | null = null;
  private xlsx: XLSXModule | null = null;

  /**
   * Create a new Office extractor instance.
   */
  constructor(config?: OfficeExtractorConfig) {
    this.config = {
      maxSheets: 50,
      maxRowsPerSheet: 10000,
      verbose: false,
      ...config,
    };
  }

  /**
   * Lazily load mammoth module.
   *
   * @returns Mammoth module for document conversion
   * @throws ExtractionError if mammoth is not installed
   */
  private async getMammoth(): Promise<MammothModule> {
    if (!this.mammoth) {
      try {
        const mammothModule = await import('mammoth');
        this.mammoth = mammothModule as unknown as MammothModule;
      } catch (error) {
        throw new ExtractionError(
          'mammoth library not available. Please install: npm install mammoth',
          'EXTRACTION_FAILED',
          error instanceof Error ? error : undefined
        );
      }
    }
    return this.mammoth;
  }

  /**
   * Lazily load xlsx module.
   */
  private async getXlsx(): Promise<XLSXModule> {
    if (!this.xlsx) {
      try {
        const xlsxModule = await import('xlsx');
        this.xlsx = xlsxModule as unknown as XLSXModule;
      } catch (error) {
        throw new ExtractionError(
          'xlsx library not available. Please install: npm install xlsx',
          'EXTRACTION_FAILED',
          error instanceof Error ? error : undefined
        );
      }
    }
    return this.xlsx;
  }

  /**
   * Extract content from a DOCX document.
   */
  async extractDocx(
    buffer: Buffer,
    options?: DocxOptions
  ): Promise<DocxExtractionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Validate buffer
      if (!this.isDocx(buffer)) {
        throw new DocxExtractionError(
          'Invalid DOCX: Buffer does not appear to be a valid DOCX file',
          'INVALID_FILE'
        );
      }

      const mammoth = await this.getMammoth();

      // Prepare mammoth options
      const mammothOptions: Record<string, unknown> = {};

      if (options?.styleMap) {
        mammothOptions.styleMap = options.styleMap;
      }

      // Extract HTML content
      let htmlResult: MammothResult;
      try {
        htmlResult = await mammoth.convertToHtml({ buffer }, mammothOptions);
      } catch (error) {
        throw new DocxExtractionError(
          `Failed to convert DOCX to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'EXTRACTION_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      // Extract raw text
      let textResult: MammothResult;
      try {
        textResult = await mammoth.extractRawText({ buffer });
      } catch (error) {
        throw new DocxExtractionError(
          `Failed to extract DOCX text: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'EXTRACTION_FAILED',
          error instanceof Error ? error : undefined
        );
      }

      // Collect warnings
      for (const msg of [...htmlResult.messages, ...textResult.messages]) {
        if (msg.type === 'warning') {
          warnings.push(msg.message);
        }
      }

      const text = textResult.value;
      const html = htmlResult.value;

      // Extract headings from HTML
      const headings = this.extractHeadingsFromHtml(html);

      // Extract tables from HTML
      const tables = options?.extractTables
        ? this.extractTablesFromHtml(html)
        : undefined;

      // Build metadata
      const metadata = this.buildDocxMetadata(text);

      // Build result
      const result: DocxExtractionResult = {
        text,
        documentType: 'docx',
        html:
          options?.outputFormat === 'html' || options?.preserveFormatting
            ? html
            : undefined,
        markdown:
          options?.outputFormat === 'markdown'
            ? this.htmlToMarkdown(html)
            : undefined,
        headings,
        tables,
        metadata,
        success: true,
        processingTime: Date.now() - startTime,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      return result;
    } catch (error) {
      if (
        error instanceof DocxExtractionError ||
        error instanceof ExtractionError
      ) {
        throw error;
      }

      throw new DocxExtractionError(
        `DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXTRACTION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Extract content from an XLSX spreadsheet.
   */
  async extractXlsx(
    buffer: Buffer,
    options?: XlsxOptions
  ): Promise<XlsxExtractionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Validate buffer
      if (!this.isXlsx(buffer)) {
        throw new XlsxExtractionError(
          'Invalid XLSX: Buffer does not appear to be a valid XLSX file',
          'INVALID_FILE'
        );
      }

      const XLSX = await this.getXlsx();

      // Parse workbook
      let workbook: XLSXWorkbook;
      try {
        workbook = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellStyles: options?.extractStyles,
          cellFormula: options?.extractFormulas,
        });
      } catch (error) {
        throw new XlsxExtractionError(
          `Failed to parse XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'EXTRACTION_FAILED',
          undefined,
          error instanceof Error ? error : undefined
        );
      }

      // Process sheets
      const sheets: XlsxSheet[] = [];
      const sheetNames = workbook.SheetNames;
      const maxSheets = options?.sheets?.length ?? this.config.maxSheets ?? 50;

      let processedSheets = 0;
      for (
        let i = 0;
        i < sheetNames.length && processedSheets < maxSheets;
        i++
      ) {
        const sheetName = sheetNames[i];

        // Check if we should process this sheet
        if (
          options?.sheets &&
          !this.shouldProcessSheet(sheetName, i, options.sheets)
        ) {
          continue;
        }

        const worksheet = workbook.Sheets[sheetName];
        const sheetData = this.processSheet(
          worksheet,
          sheetName,
          i,
          options,
          XLSX
        );

        // Skip hidden sheets if requested
        if (!options?.includeHidden && sheetData.hidden) {
          continue;
        }

        sheets.push(sheetData);
        processedSheets++;
      }

      // Build text content
      const text = this.sheetsToText(sheets);

      // Extract named ranges
      const namedRanges = this.extractNamedRanges(workbook);

      // Extract workbook properties
      const workbookProperties = this.extractWorkbookProperties(workbook);

      // Build metadata
      const metadata = this.buildXlsxMetadata(sheets, workbookProperties);

      // Build tables from sheets
      const tables = sheets.map(sheet => this.sheetToTable(sheet));

      // Build result
      const result: XlsxExtractionResult = {
        text,
        documentType: 'xlsx',
        sheets,
        namedRanges: namedRanges.length > 0 ? namedRanges : undefined,
        workbookProperties,
        tables,
        metadata,
        success: true,
        processingTime: Date.now() - startTime,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      return result;
    } catch (error) {
      if (
        error instanceof XlsxExtractionError ||
        error instanceof ExtractionError
      ) {
        throw error;
      }

      throw new XlsxExtractionError(
        `XLSX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXTRACTION_FAILED',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if buffer is a valid DOCX file.
   */
  isDocx(buffer: Buffer): boolean {
    // Check for ZIP signature (PK) and look for word/ content
    if (buffer.length < 4) {
      return false;
    }
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return false;
    }

    // Check for word processor content markers
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 2000));
    return content.includes('word/') || content.includes('wordprocessingml');
  }

  /**
   * Check if buffer is a valid XLSX file.
   */
  isXlsx(buffer: Buffer): boolean {
    // Check for ZIP signature (PK) and look for xl/ content
    if (buffer.length < 4) {
      return false;
    }
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return false;
    }

    // Check for spreadsheet content markers
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 2000));
    return content.includes('xl/') || content.includes('spreadsheetml');
  }

  // ============================================================================
  // DOCX Helper Methods
  // ============================================================================

  /**
   * Extract headings from HTML content.
   */
  private extractHeadingsFromHtml(html: string): DocxHeading[] {
    const headings: DocxHeading[] = [];
    const headingRegex = /<h([1-6])(?:\s+id="([^"]*)")?[^>]*>(.*?)<\/h\1>/gi;

    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1], 10);
      const id = match[2];
      const text = this.stripHtml(match[3]);

      if (text.trim()) {
        headings.push({
          level,
          text: text.trim(),
          id,
        });
      }
    }

    return headings;
  }

  /**
   * Extract tables from HTML content.
   */
  private extractTablesFromHtml(html: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

    let match;
    while ((match = tableRegex.exec(html)) !== null) {
      const tableHtml = match[1];
      const table = this.parseHtmlTable(tableHtml);
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Parse an HTML table.
   */
  private parseHtmlTable(tableHtml: string): ExtractedTable | null {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];

      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(this.stripHtml(cellMatch[1]).trim());
      }

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length < 1) {
      return null;
    }

    // Normalize column count
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    return {
      headers: normalizedRows[0],
      rows: normalizedRows.slice(1),
      columnCount: maxCols,
      rowCount: normalizedRows.length - 1,
    };
  }

  /**
   * Strip HTML tags from text.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Convert HTML to basic Markdown.
   */
  private htmlToMarkdown(html: string): string {
    let md = html;

    // Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
    md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
    md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

    // Bold and italic
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // Links
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Paragraphs and line breaks
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Lists
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

    // Clean up remaining tags
    md = this.stripHtml(md);

    // Clean up whitespace
    md = md.replace(/\n{3,}/g, '\n\n');

    return md.trim();
  }

  /**
   * Build DOCX metadata.
   */
  private buildDocxMetadata(text: string): DocumentMetadata {
    return {
      wordCount: this.countWords(text),
      characterCount: text.length,
    };
  }

  // ============================================================================
  // XLSX Helper Methods
  // ============================================================================

  /**
   * Check if a sheet should be processed based on filter.
   */
  private shouldProcessSheet(
    name: string,
    index: number,
    filter: (string | number)[]
  ): boolean {
    for (const item of filter) {
      if (typeof item === 'string' && item === name) {
        return true;
      }
      if (typeof item === 'number' && item === index) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process a single worksheet.
   */
  private processSheet(
    worksheet: XLSXSheet,
    name: string,
    index: number,
    options: XlsxOptions | undefined,
    XLSX: XLSXModule
  ): XlsxSheet {
    const range = worksheet['!ref'];
    if (!range) {
      return {
        name,
        index,
        hidden: false,
        rowCount: 0,
        columnCount: 0,
        headers: [],
        rows: [],
        mergedCells: [],
      };
    }

    // Parse range
    const decoded = XLSX.utils.decode_range(range);
    const rowCount = decoded.e.r - decoded.s.r + 1;
    const columnCount = decoded.e.c - decoded.s.c + 1;

    // Extract data
    const rows: XlsxCellValue[][] = [];
    const maxRows = Math.min(
      rowCount,
      options?.maxRowsPerSheet ?? this.config.maxRowsPerSheet ?? 10000
    );

    for (let r = decoded.s.r; r <= decoded.s.r + maxRows - 1; r++) {
      const row: XlsxCellValue[] = [];

      for (let c = decoded.s.c; c <= decoded.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress] as XLSXCell | undefined;

        if (cell) {
          row.push(this.parseCellValue(cell));
        } else {
          row.push(null);
        }
      }

      // Skip empty rows if requested
      if (options?.skipEmptyRows && row.every(v => v === null || v === '')) {
        continue;
      }

      rows.push(row);
    }

    // Skip empty columns if requested
    let headers: string[] = [];
    let dataRows: XlsxCellValue[][] = rows;

    if (options?.firstRowAsHeaders && rows.length > 0) {
      headers = rows[0].map(v => this.cellToString(v));
      dataRows = rows.slice(1);
    }

    // Extract merged cells
    const mergedCells: MergedCellInfo[] = [];
    if (worksheet['!merges']) {
      for (const merge of worksheet['!merges']) {
        mergedCells.push({
          startRow: merge.s.r,
          startColumn: merge.s.c,
          rowSpan: merge.e.r - merge.s.r + 1,
          colSpan: merge.e.c - merge.s.c + 1,
        });
      }
    }

    return {
      name,
      index,
      hidden: false, // Would need workbook state info
      rowCount: dataRows.length,
      columnCount,
      headers,
      rows: dataRows,
      mergedCells,
    };
  }

  /**
   * Parse cell value from XLSX cell.
   */
  private parseCellValue(cell: XLSXCell): XlsxCellValue {
    if (cell.t === 's' && cell.r) {
      // Rich text
      const segments = cell.r.r?.map((s: { t: string }) => s.t) ?? [];
      return {
        segments: segments.map((t: string) => ({ text: t })),
        plainText: segments.join(''),
      };
    }

    if (cell.t === 'd' && cell.v instanceof Date) {
      return cell.v;
    }

    if (cell.t === 'n' && typeof cell.v === 'number') {
      return cell.v;
    }

    if (cell.t === 'b' && typeof cell.v === 'boolean') {
      return cell.v;
    }

    // Use formatted value if available, otherwise raw value
    return cell.w ?? (cell.v as string | number | null) ?? null;
  }

  /**
   * Convert cell value to string.
   */
  private cellToString(value: XlsxCellValue): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object' && 'plainText' in value) {
      return value.plainText;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value);
  }

  /**
   * Convert sheets to text representation.
   */
  private sheetsToText(sheets: XlsxSheet[]): string {
    const lines: string[] = [];

    for (const sheet of sheets) {
      lines.push(`=== Sheet: ${sheet.name} ===`);
      lines.push('');

      if (sheet.headers.length > 0) {
        lines.push(sheet.headers.join('\t'));
        lines.push('-'.repeat(50));
      }

      for (const row of sheet.rows) {
        lines.push(row.map(v => this.cellToString(v)).join('\t'));
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert sheet to table format.
   */
  private sheetToTable(sheet: XlsxSheet): ExtractedTable {
    return {
      headers: sheet.headers,
      rows: sheet.rows.map(row => row.map(v => this.cellToString(v))),
      columnCount: sheet.columnCount,
      rowCount: sheet.rowCount,
    };
  }

  /**
   * Extract named ranges from workbook.
   */
  private extractNamedRanges(workbook: XLSXWorkbook): XlsxNamedRange[] {
    const ranges: XlsxNamedRange[] = [];

    if (workbook.Workbook?.Names) {
      for (const name of workbook.Workbook.Names) {
        ranges.push({
          name: name.Name,
          range: name.Ref,
          sheet:
            name.Sheet !== undefined
              ? workbook.SheetNames[name.Sheet]
              : undefined,
        });
      }
    }

    return ranges;
  }

  /**
   * Extract workbook properties.
   */
  private extractWorkbookProperties(
    workbook: XLSXWorkbook
  ): XlsxWorkbookProperties | undefined {
    const props = workbook.Props;
    if (!props) {
      return undefined;
    }

    return {
      title: props.Title,
      subject: props.Subject,
      creator: props.Author ?? props.Creator,
      lastModifiedBy: props.LastAuthor,
      created: props.CreatedDate,
      modified: props.ModifiedDate,
      keywords: props.Keywords,
      description: props.Description,
      category: props.Category,
      company: props.Company,
      manager: props.Manager,
    };
  }

  /**
   * Build XLSX metadata.
   */
  private buildXlsxMetadata(
    sheets: XlsxSheet[],
    props?: XlsxWorkbookProperties
  ): DocumentMetadata {
    const totalRows = sheets.reduce((sum, s) => sum + s.rowCount, 0);
    const totalCells = sheets.reduce(
      (sum, s) => sum + s.rowCount * s.columnCount,
      0
    );

    return {
      title: props?.title,
      author: props?.creator,
      createdAt: props?.created,
      modifiedAt: props?.modified,
      pageCount: sheets.length,
      custom: {
        sheetCount: sheets.length,
        totalRows,
        totalCells,
      },
    };
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
   * Get extractor information.
   */
  getInfo(): { name: string; version: string; supportedTypes: string[] } {
    return {
      name: 'OfficeExtractor',
      version: '0.1.0',
      supportedTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Office document extractor instance.
 *
 * @param config - File processor configuration
 * @returns Office extractor instance
 *
 * @example
 * ```typescript
 * const extractor = createOfficeExtractor();
 *
 * const docxResult = await extractor.extractDocx(docxBuffer, {
 *   outputFormat: 'markdown',
 *   extractTables: true,
 * });
 *
 * const xlsxResult = await extractor.extractXlsx(xlsxBuffer, {
 *   firstRowAsHeaders: true,
 *   sheets: ['Sheet1', 'Data'],
 * });
 * ```
 */
export function createOfficeExtractor(
  config?: FileProcessorConfig
): OfficeExtractor {
  return new OfficeExtractorImpl({ fileProcessorConfig: config });
}

// ============================================================================
// Exports
// ============================================================================
