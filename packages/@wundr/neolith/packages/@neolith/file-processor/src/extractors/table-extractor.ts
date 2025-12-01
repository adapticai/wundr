/**
 * @genesis/file-processor - Table Extractor
 *
 * Specialized utilities for detecting and extracting tabular data
 * from text content and HTML documents.
 *
 * @packageDocumentation
 */

import type {
  ExtractedTable,
  TableStructure,
  ColumnType,
  MergedCellInfo,
  BoundingBox as _BoundingBox,
} from '../types/extraction';

// Re-export aliased type for external use
export type { _BoundingBox as BoundingBox };

// ============================================================================
// Table Extractor Interface
// ============================================================================

/**
 * Interface for table extraction operations.
 */
export interface TableExtractor {
  /**
   * Extract tables from plain text content.
   *
   * @param text - Plain text content
   * @returns Array of extracted tables
   */
  extractTables(text: string): ExtractedTable[];

  /**
   * Extract tables from HTML content.
   *
   * @param html - HTML content
   * @returns Array of extracted tables
   */
  extractFromHTML(html: string): ExtractedTable[];

  /**
   * Detect table structure from a 2D array of cells.
   *
   * @param cells - 2D array of cell values
   * @returns Detected table structure
   */
  detectTableStructure(cells: string[][]): TableStructure;

  /**
   * Detect if text contains tabular data.
   *
   * @param text - Text to analyze
   * @returns Whether text appears to contain tables
   */
  detectTables(text: string): boolean;

  /**
   * Parse CSV-formatted text into a table.
   *
   * @param csv - CSV text content
   * @param options - Parsing options
   * @returns Extracted table
   */
  parseCSV(csv: string, options?: CSVParseOptions): ExtractedTable;

  /**
   * Parse TSV-formatted text into a table.
   *
   * @param tsv - TSV text content
   * @param options - Parsing options
   * @returns Extracted table
   */
  parseTSV(tsv: string, options?: CSVParseOptions): ExtractedTable;

  /**
   * Normalize table data (ensure consistent column counts).
   *
   * @param table - Table to normalize
   * @returns Normalized table
   */
  normalizeTable(table: ExtractedTable): ExtractedTable;

  /**
   * Convert table to CSV format.
   *
   * @param table - Table to convert
   * @param options - Conversion options
   * @returns CSV string
   */
  toCSV(table: ExtractedTable, options?: CSVOptions): string;

  /**
   * Convert table to Markdown format.
   *
   * @param table - Table to convert
   * @returns Markdown table string
   */
  toMarkdown(table: ExtractedTable): string;
}

// ============================================================================
// Options and Configuration Types
// ============================================================================

/**
 * Options for CSV parsing.
 */
export interface CSVParseOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;

  /** Quote character (default: '"') */
  quote?: string;

  /** Escape character (default: '\\') */
  escape?: string;

  /** Whether first row is headers (default: true) */
  hasHeaders?: boolean;

  /** Skip empty rows */
  skipEmptyRows?: boolean;

  /** Trim whitespace from cells */
  trimCells?: boolean;
}

/**
 * Options for CSV output.
 */
export interface CSVOptions {
  /** Field delimiter (default: ',') */
  delimiter?: string;

  /** Quote character (default: '"') */
  quote?: string;

  /** Include headers in output */
  includeHeaders?: boolean;

  /** Line ending (default: '\n') */
  lineEnding?: string;
}

/**
 * Table detection configuration.
 */
export interface TableDetectionConfig {
  /** Minimum number of rows for table detection */
  minRows?: number;

  /** Minimum number of columns for table detection */
  minColumns?: number;

  /** Delimiter patterns to detect */
  delimiterPatterns?: RegExp[];

  /** Confidence threshold for detection (0-1) */
  confidenceThreshold?: number;
}

// ============================================================================
// Table Extractor Implementation
// ============================================================================

/**
 * Default table detection configuration.
 */
const DEFAULT_DETECTION_CONFIG: Required<TableDetectionConfig> = {
  minRows: 2,
  minColumns: 2,
  delimiterPatterns: [
    /\t+/, // Tab-separated
    /\s*\|\s*/, // Pipe-separated
    /\s{3,}/, // Multiple spaces
    /,(?=(?:[^"]*"[^"]*")*[^"]*$)/, // Comma (CSV-aware)
  ],
  confidenceThreshold: 0.6,
};

/**
 * Implementation of the table extractor.
 */
export class TableExtractorImpl implements TableExtractor {
  private config: Required<TableDetectionConfig>;

  /**
   * Create a new table extractor instance.
   */
  constructor(config?: TableDetectionConfig) {
    this.config = {
      ...DEFAULT_DETECTION_CONFIG,
      ...config,
    };
  }

  /**
   * Extract tables from plain text content.
   */
  extractTables(text: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const lines = text.split('\n');

    let currentTableLines: string[] = [];
    let currentDelimiter: RegExp | null = null;
    let tableStartLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const detected = this.detectDelimiter(line);

      if (detected.delimiter) {
        if (currentDelimiter === null) {
          // Start of a new potential table
          currentDelimiter = detected.delimiter;
          tableStartLine = i;
          currentTableLines = [line];
        } else if (
          this.isSameDelimiterPattern(currentDelimiter, detected.delimiter)
        ) {
          // Continue current table
          currentTableLines.push(line);
        } else {
          // Different delimiter - close current and start new
          if (currentTableLines.length >= this.config.minRows) {
            const table = this.parseTableLines(
              currentTableLines,
              currentDelimiter,
              tableStartLine
            );
            if (table) {
              tables.push(table);
            }
          }
          currentDelimiter = detected.delimiter;
          tableStartLine = i;
          currentTableLines = [line];
        }
      } else if (currentTableLines.length > 0) {
        // Check if this is a separator line (e.g., "---" or "===")
        if (this.isSeparatorLine(line)) {
          currentTableLines.push(line);
        } else if (line.trim() === '') {
          // Empty line might end the table
          if (currentTableLines.length >= this.config.minRows) {
            const table = this.parseTableLines(
              currentTableLines,
              currentDelimiter!,
              tableStartLine
            );
            if (table) {
              tables.push(table);
            }
          }
          currentTableLines = [];
          currentDelimiter = null;
          tableStartLine = -1;
        } else {
          // Non-table line - end current table
          if (currentTableLines.length >= this.config.minRows) {
            const table = this.parseTableLines(
              currentTableLines,
              currentDelimiter!,
              tableStartLine
            );
            if (table) {
              tables.push(table);
            }
          }
          currentTableLines = [];
          currentDelimiter = null;
          tableStartLine = -1;
        }
      }
    }

    // Handle remaining table at end of text
    if (currentTableLines.length >= this.config.minRows && currentDelimiter) {
      const table = this.parseTableLines(
        currentTableLines,
        currentDelimiter,
        tableStartLine
      );
      if (table) {
        tables.push(table);
      }
    }

    return tables;
  }

  /**
   * Extract tables from HTML content.
   */
  extractFromHTML(html: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

    let match;
    let _tableIndex = 0;

    while ((match = tableRegex.exec(html)) !== null) {
      const tableHtml = match[1];
      const table = this.parseHTMLTable(tableHtml);

      if (
        table &&
        table.rowCount >= this.config.minRows - 1 &&
        table.columnCount >= this.config.minColumns
      ) {
        tables.push(table);
      }
      _tableIndex++;
    }

    return tables;
  }

  /**
   * Detect table structure from a 2D array of cells.
   */
  detectTableStructure(cells: string[][]): TableStructure {
    if (cells.length === 0) {
      return {
        columnCount: 0,
        rowCount: 0,
        hasHeaders: false,
        columnTypes: [],
      };
    }

    const rowCount = cells.length;
    const columnCount = Math.max(...cells.map(row => row.length));

    // Detect if first row is headers
    const hasHeaders = this.detectHeaders(cells);

    // Detect column types
    const columnTypes = this.detectColumnTypes(cells, hasHeaders);

    // Calculate column widths (character-based)
    const columnWidths = this.calculateColumnWidths(cells);

    return {
      columnCount,
      rowCount,
      hasHeaders,
      columnTypes,
      columnWidths,
    };
  }

  /**
   * Detect if text contains tabular data.
   */
  detectTables(text: string): boolean {
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < this.config.minRows) {
      return false;
    }

    let consistentLines = 0;
    let prevDelimiter: RegExp | null = null;
    let prevColumnCount = 0;

    for (const line of lines) {
      const detected = this.detectDelimiter(line);

      if (
        detected.delimiter &&
        detected.columnCount >= this.config.minColumns
      ) {
        if (
          prevDelimiter &&
          this.isSameDelimiterPattern(prevDelimiter, detected.delimiter) &&
          Math.abs(detected.columnCount - prevColumnCount) <= 1
        ) {
          consistentLines++;
        } else {
          consistentLines = 1;
          prevDelimiter = detected.delimiter;
          prevColumnCount = detected.columnCount;
        }

        if (consistentLines >= this.config.minRows) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse CSV-formatted text into a table.
   */
  parseCSV(csv: string, options?: CSVParseOptions): ExtractedTable {
    const opts: Required<CSVParseOptions> = {
      delimiter: ',',
      quote: '"',
      escape: '\\',
      hasHeaders: true,
      skipEmptyRows: true,
      trimCells: true,
      ...options,
    };

    const rows = this.parseDelimitedText(
      csv,
      opts.delimiter,
      opts.quote,
      opts.escape
    );

    // Filter empty rows
    let filteredRows = opts.skipEmptyRows
      ? rows.filter(row => row.some(cell => cell.trim().length > 0))
      : rows;

    // Trim cells
    if (opts.trimCells) {
      filteredRows = filteredRows.map(row => row.map(cell => cell.trim()));
    }

    // Normalize column count
    const maxCols = Math.max(...filteredRows.map(row => row.length), 0);
    const normalizedRows = filteredRows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    // Extract headers and data
    const headers =
      opts.hasHeaders && normalizedRows.length > 0 ? normalizedRows[0] : [];
    const dataRows = opts.hasHeaders ? normalizedRows.slice(1) : normalizedRows;

    return {
      headers,
      rows: dataRows,
      columnCount: maxCols,
      rowCount: dataRows.length,
    };
  }

  /**
   * Parse TSV-formatted text into a table.
   */
  parseTSV(tsv: string, options?: CSVParseOptions): ExtractedTable {
    return this.parseCSV(tsv, {
      ...options,
      delimiter: '\t',
    });
  }

  /**
   * Normalize table data (ensure consistent column counts).
   */
  normalizeTable(table: ExtractedTable): ExtractedTable {
    const maxCols = Math.max(
      table.headers.length,
      ...table.rows.map(row => row.length)
    );

    const normalizedHeaders = [...table.headers];
    while (normalizedHeaders.length < maxCols) {
      normalizedHeaders.push('');
    }

    const normalizedRows = table.rows.map(row => {
      const normalized = [...row];
      while (normalized.length < maxCols) {
        normalized.push('');
      }
      return normalized;
    });

    return {
      ...table,
      headers: normalizedHeaders,
      rows: normalizedRows,
      columnCount: maxCols,
    };
  }

  /**
   * Convert table to CSV format.
   */
  toCSV(table: ExtractedTable, options?: CSVOptions): string {
    const opts: Required<CSVOptions> = {
      delimiter: ',',
      quote: '"',
      includeHeaders: true,
      lineEnding: '\n',
      ...options,
    };

    const lines: string[] = [];

    if (opts.includeHeaders && table.headers.length > 0) {
      lines.push(this.formatCSVRow(table.headers, opts.delimiter, opts.quote));
    }

    for (const row of table.rows) {
      lines.push(this.formatCSVRow(row, opts.delimiter, opts.quote));
    }

    return lines.join(opts.lineEnding);
  }

  /**
   * Convert table to Markdown format.
   */
  toMarkdown(table: ExtractedTable): string {
    const lines: string[] = [];

    // Calculate column widths
    const widths = this.calculateMarkdownWidths(table);

    // Header row
    if (table.headers.length > 0) {
      const headerCells = table.headers.map((h, i) => h.padEnd(widths[i]));
      lines.push(`| ${headerCells.join(' | ')} |`);

      // Separator row
      const separators = widths.map(w => '-'.repeat(w));
      lines.push(`| ${separators.join(' | ')} |`);
    }

    // Data rows
    for (const row of table.rows) {
      const cells = row.map((cell, i) => cell.padEnd(widths[i] || 0));
      lines.push(`| ${cells.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Detect delimiter used in a line.
   */
  private detectDelimiter(line: string): {
    delimiter: RegExp | null;
    columnCount: number;
  } {
    for (const pattern of this.config.delimiterPatterns) {
      const parts = line.split(pattern);
      if (parts.length >= this.config.minColumns) {
        return { delimiter: pattern, columnCount: parts.length };
      }
    }
    return { delimiter: null, columnCount: 0 };
  }

  /**
   * Check if two delimiter patterns are effectively the same.
   */
  private isSameDelimiterPattern(a: RegExp, b: RegExp): boolean {
    return a.source === b.source;
  }

  /**
   * Check if a line is a table separator (e.g., "---" or "===").
   */
  private isSeparatorLine(line: string): boolean {
    const trimmed = line.trim();
    return /^[-=+|]+$/.test(trimmed) && trimmed.length >= 3;
  }

  /**
   * Parse table lines into an ExtractedTable.
   */
  private parseTableLines(
    lines: string[],
    delimiter: RegExp,
    startRow: number
  ): ExtractedTable | null {
    // Filter out separator lines
    const dataLines = lines.filter(line => !this.isSeparatorLine(line));

    if (dataLines.length < this.config.minRows) {
      return null;
    }

    // Parse rows
    const rows = dataLines.map(line =>
      line.split(delimiter).map(cell => cell.trim())
    );

    // Normalize column count
    const maxCols = Math.max(...rows.map(row => row.length));

    if (maxCols < this.config.minColumns) {
      return null;
    }

    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    // Detect if first row is headers
    const hasHeaders = this.detectHeaders(normalizedRows);

    const headers = hasHeaders ? normalizedRows[0] : [];
    const dataRows = hasHeaders ? normalizedRows.slice(1) : normalizedRows;

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
   * Parse HTML table content.
   */
  private parseHTMLTable(tableHtml: string): ExtractedTable | null {
    const rows: string[][] = [];
    const mergedCells: MergedCellInfo[] = [];

    // Extract rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];

      // Extract cells (th and td)
      const cellRegex =
        /<(th|td)[^>]*(?:colspan="(\d+)")?[^>]*(?:rowspan="(\d+)")?[^>]*>([\s\S]*?)<\/\1>/gi;
      let cellMatch;
      let colIndex = 0;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const colspan = parseInt(cellMatch[2] || '1', 10);
        const rowspan = parseInt(cellMatch[3] || '1', 10);
        const cellContent = this.stripHTML(cellMatch[4]).trim();

        cells.push(cellContent);

        // Track merged cells
        if (colspan > 1 || rowspan > 1) {
          mergedCells.push({
            startRow: rowIndex,
            startColumn: colIndex,
            rowSpan: rowspan,
            colSpan: colspan,
          });

          // Add empty cells for colspan
          for (let i = 1; i < colspan; i++) {
            cells.push('');
          }
        }

        colIndex += colspan;
      }

      if (cells.length > 0) {
        rows.push(cells);
        rowIndex++;
      }
    }

    if (rows.length === 0) {
      return null;
    }

    // Normalize column count
    const maxCols = Math.max(...rows.map(row => row.length));
    const normalizedRows = rows.map(row => {
      while (row.length < maxCols) {
        row.push('');
      }
      return row;
    });

    // Detect headers (check for th tags or first row patterns)
    const hasTheader =
      /<thead/i.test(tableHtml) ||
      /<th/i.test(tableHtml.split(/<\/tr>/i)[0] || '');
    const headers =
      hasTheader && normalizedRows.length > 0 ? normalizedRows[0] : [];
    const dataRows = hasTheader ? normalizedRows.slice(1) : normalizedRows;

    return {
      headers,
      rows: dataRows,
      columnCount: maxCols,
      rowCount: dataRows.length,
      mergedCells: mergedCells.length > 0 ? mergedCells : undefined,
    };
  }

  /**
   * Strip HTML tags from content.
   */
  private stripHTML(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ');
  }

  /**
   * Detect if first row appears to be headers.
   */
  private detectHeaders(rows: string[][]): boolean {
    if (rows.length < 2) {
      return false;
    }

    const firstRow = rows[0];
    const dataRows = rows.slice(1);

    // Check if first row is all text while data rows have numbers
    let firstRowAllText = true;
    let dataRowsHaveNumbers = false;

    for (const cell of firstRow) {
      if (/^\d+([.,]\d+)?$/.test(cell.trim())) {
        firstRowAllText = false;
        break;
      }
    }

    for (const row of dataRows.slice(0, 5)) {
      for (const cell of row) {
        if (/^\d+([.,]\d+)?$/.test(cell.trim())) {
          dataRowsHaveNumbers = true;
          break;
        }
      }
      if (dataRowsHaveNumbers) {
        break;
      }
    }

    // First row is likely headers if it's all text and data rows have numbers
    if (firstRowAllText && dataRowsHaveNumbers) {
      return true;
    }

    // Check for typical header patterns
    const headerPatterns = [
      /^(id|name|date|time|type|status|value|amount|price|quantity|total|description|category|title)$/i,
      /^#$/,
      /^no\.?$/i,
    ];

    for (const cell of firstRow) {
      for (const pattern of headerPatterns) {
        if (pattern.test(cell.trim())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect column types.
   */
  private detectColumnTypes(
    rows: string[][],
    hasHeaders: boolean
  ): ColumnType[] {
    const dataRows = hasHeaders ? rows.slice(1) : rows;

    if (dataRows.length === 0 || rows[0].length === 0) {
      return [];
    }

    const columnCount = rows[0].length;
    const types: ColumnType[] = [];

    for (let col = 0; col < columnCount; col++) {
      const values = dataRows
        .map(row => row[col] || '')
        .filter(v => v.trim().length > 0);

      if (values.length === 0) {
        types.push('empty');
        continue;
      }

      // Check for each type
      const typeChecks = {
        number: (v: string) => /^-?\d+([.,]\d+)?$/.test(v.trim()),
        currency: (v: string) =>
          /^[$\u00A3\u20AC\u00A5]?\s*-?\d+([.,]\d+)?\s*[$\u00A3\u20AC\u00A5]?$/.test(
            v.trim()
          ),
        percentage: (v: string) => /^-?\d+([.,]\d+)?\s*%$/.test(v.trim()),
        boolean: (v: string) => /^(true|false|yes|no|y|n|1|0)$/i.test(v.trim()),
        date: (v: string) =>
          !isNaN(Date.parse(v)) && /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(v),
      };

      let detectedType: ColumnType = 'string';

      for (const [typeName, check] of Object.entries(typeChecks)) {
        const matches = values.filter(check).length;
        const ratio = matches / values.length;

        if (ratio >= 0.8) {
          detectedType = typeName as ColumnType;
          break;
        }
      }

      // Check for mixed types
      if (detectedType === 'string') {
        const hasNumbers = values.some(v => /\d/.test(v));
        const hasLetters = values.some(v => /[a-zA-Z]/.test(v));
        if (hasNumbers && hasLetters) {
          detectedType = 'mixed';
        }
      }

      types.push(detectedType);
    }

    return types;
  }

  /**
   * Calculate column widths based on content.
   */
  private calculateColumnWidths(rows: string[][]): number[] {
    if (rows.length === 0) {
      return [];
    }

    const columnCount = Math.max(...rows.map(row => row.length));
    const widths: number[] = new Array(columnCount).fill(0);

    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        widths[i] = Math.max(widths[i], row[i].length);
      }
    }

    return widths;
  }

  /**
   * Parse delimited text respecting quotes.
   */
  private parseDelimitedText(
    text: string,
    delimiter: string,
    quote: string,
    escape: string
  ): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }

      const row: string[] = [];
      let cell = '';
      let inQuotes = false;
      let i = 0;

      while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (!inQuotes && char === delimiter) {
          row.push(cell);
          cell = '';
        } else if (char === quote) {
          if (!inQuotes) {
            inQuotes = true;
          } else if (nextChar === quote) {
            cell += quote;
            i++;
          } else {
            inQuotes = false;
          }
        } else if (char === escape && nextChar !== undefined) {
          cell += nextChar;
          i++;
        } else {
          cell += char;
        }

        i++;
      }

      row.push(cell);
      rows.push(row);
    }

    return rows;
  }

  /**
   * Format a row for CSV output.
   */
  private formatCSVRow(
    row: string[],
    delimiter: string,
    quote: string
  ): string {
    return row
      .map(cell => {
        // Quote cells that contain delimiter, quote, or newline
        if (
          cell.includes(delimiter) ||
          cell.includes(quote) ||
          cell.includes('\n')
        ) {
          const escaped = cell.replace(new RegExp(quote, 'g'), quote + quote);
          return `${quote}${escaped}${quote}`;
        }
        return cell;
      })
      .join(delimiter);
  }

  /**
   * Calculate column widths for Markdown output.
   */
  private calculateMarkdownWidths(table: ExtractedTable): number[] {
    const allRows = [table.headers, ...table.rows];
    const columnCount = Math.max(...allRows.map(row => row.length));
    const widths: number[] = new Array(columnCount).fill(3); // Minimum width of 3 for "---"

    for (const row of allRows) {
      for (let i = 0; i < row.length; i++) {
        widths[i] = Math.max(widths[i], row[i].length);
      }
    }

    return widths;
  }

  /**
   * Get extractor information.
   */
  getInfo(): { name: string; version: string; capabilities: string[] } {
    return {
      name: 'TableExtractor',
      version: '0.1.0',
      capabilities: [
        'text-extraction',
        'html-extraction',
        'csv-parsing',
        'tsv-parsing',
        'structure-detection',
        'markdown-output',
        'csv-output',
      ],
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new table extractor instance.
 *
 * @param config - Detection configuration
 * @returns Table extractor instance
 *
 * @example
 * ```typescript
 * const extractor = createTableExtractor({
 *   minRows: 3,
 *   minColumns: 2,
 * });
 *
 * const tables = extractor.extractTables(textContent);
 * const markdown = extractor.toMarkdown(tables[0]);
 * ```
 */
export function createTableExtractor(
  config?: TableDetectionConfig
): TableExtractor {
  return new TableExtractorImpl(config);
}

// ============================================================================
// Exports
// ============================================================================
