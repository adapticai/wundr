/**
 * @genesis/file-processor - XLSX Processor
 *
 * Handles extraction of data from Excel spreadsheets.
 * Uses exceljs library for workbook processing.
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
} from '../types';

/**
 * XLSX processing options
 */
export interface XlsxProcessingOptions extends ProcessingOptions {
  /** Specific sheets to process (by name or index) */
  sheets?: (string | number)[];

  /** Include hidden sheets */
  includeHidden?: boolean;

  /** Treat first row as headers */
  firstRowAsHeaders?: boolean;

  /** Skip empty rows */
  skipEmptyRows?: boolean;

  /** Skip empty columns */
  skipEmptyColumns?: boolean;

  /** Date format for date cells */
  dateFormat?: string;

  /** Number format for numeric cells */
  numberFormat?: string;

  /** Maximum rows per sheet */
  maxRowsPerSheet?: number;

  /** Output format */
  outputFormat?: 'json' | 'csv' | 'text';
}

/**
 * Sheet data structure
 */
export interface SheetData {
  /** Sheet name */
  name: string;

  /** Sheet index */
  index: number;

  /** Whether sheet is hidden */
  hidden: boolean;

  /** Number of rows */
  rowCount: number;

  /** Number of columns */
  columnCount: number;

  /** Headers (if firstRowAsHeaders is true) */
  headers: string[];

  /** Data rows */
  rows: CellValue[][];

  /** Merged cells */
  mergedCells: MergedCell[];

  /** Named ranges in this sheet */
  namedRanges: NamedRange[];
}

/**
 * Cell value type
 */
export type CellValue = string | number | boolean | Date | null;

/**
 * Merged cell information
 */
export interface MergedCell {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

/**
 * Named range information
 */
export interface NamedRange {
  name: string;
  range: string;
  sheet: string;
}

/**
 * ExcelJS module interface
 */
interface ExcelJSModule {
  Workbook: new () => ExcelWorkbook;
}

/**
 * ExcelJS Workbook interface
 */
interface ExcelWorkbook {
  xlsx: {
    readFile: (path: string) => Promise<void>;
  };
  eachSheet: (
    callback: (worksheet: ExcelWorksheet, sheetId: number) => void
  ) => void;
  creator?: string;
  lastModifiedBy?: string;
  created?: Date;
  modified?: Date;
  title?: string;
  subject?: string;
  keywords?: string;
  description?: string;
}

/**
 * ExcelJS Worksheet interface
 */
interface ExcelWorksheet {
  name: string;
  state: 'visible' | 'hidden' | 'veryHidden';
  rowCount: number;
  columnCount: number;
  actualRowCount: number;
  actualColumnCount: number;
  getRow: (rowNumber: number) => ExcelRow;
  eachRow: (callback: (row: ExcelRow, rowNumber: number) => void) => void;
  model: {
    merges?: string[];
  };
}

/**
 * ExcelJS Row interface
 */
interface ExcelRow {
  values: ExcelCellValue[];
  eachCell: (callback: (cell: ExcelCell, colNumber: number) => void) => void;
}

/**
 * ExcelJS Cell interface
 */
interface ExcelCell {
  value: ExcelCellValue;
  text: string;
  type: number;
  isMerged?: boolean;
}

/**
 * ExcelJS cell value type
 */
type ExcelCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { text?: string; result?: string | number };

/**
 * XLSX processor class
 */
export class XlsxProcessor {
  private _config: FileProcessorConfig;
  private exceljs: ExcelJSModule | null = null;

  constructor(config: FileProcessorConfig) {
    this._config = config;
  }

  /**
   * Lazily load exceljs module
   */
  private async getExcelJS(): Promise<ExcelJSModule> {
    if (!this.exceljs) {
      const excelModule = await import('exceljs');
      this.exceljs = excelModule as unknown as ExcelJSModule;
    }
    return this.exceljs;
  }

  /**
   * Process an XLSX file and extract content
   */
  async process(
    filePath: string,
    options: XlsxProcessingOptions = {}
  ): Promise<ProcessorResult> {
    const startTime = Date.now();

    try {
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Parse XLSX
      const xlsxData = await this.parseXlsx(filePath, options);

      // Build metadata
      const metadata: FileMetadata = {
        filename: path.basename(filePath),
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: stats.size,
        fileType: FileType.XLSX,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        title: xlsxData.properties?.title,
        author: xlsxData.properties?.creator,
        custom: {
          sheetCount: xlsxData.sheets.length,
          totalRows: xlsxData.sheets.reduce((sum, s) => sum + s.rowCount, 0),
          totalColumns: Math.max(...xlsxData.sheets.map(s => s.columnCount), 0),
        },
      };

      // Convert to text content
      const content = this.sheetsToText(xlsxData.sheets, options);

      // Build structured data
      const structuredData: Record<string, unknown> = {
        sheets: xlsxData.sheets,
        properties: xlsxData.properties,
        namedRanges: xlsxData.namedRanges,
        tables: this.extractTables(xlsxData.sheets),
      };

      return {
        success: true,
        content,
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
   * Parse XLSX file and extract content
   *
   * @param filePath - Path to XLSX file
   * @param options - Processing options
   * @returns Parsed workbook content and metadata
   */
  private async parseXlsx(
    filePath: string,
    options: XlsxProcessingOptions
  ): Promise<{
    sheets: SheetData[];
    properties?: WorkbookProperties;
    namedRanges: NamedRange[];
  }> {
    const ExcelJS = await this.getExcelJS();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets: SheetData[] = [];

    workbook.eachSheet((worksheet, sheetId) => {
      // Skip hidden sheets unless explicitly included
      if (!options.includeHidden && worksheet.state === 'hidden') {
        return;
      }

      // Skip if specific sheets are requested and this one isn't in the list
      if (options.sheets && options.sheets.length > 0) {
        const matchesIndex = options.sheets.includes(sheetId);
        const matchesName = options.sheets.includes(worksheet.name);
        if (!matchesIndex && !matchesName) {
          return;
        }
      }

      sheets.push(this.processSheet(worksheet, sheetId, options));
    });

    // Extract workbook properties
    const properties: WorkbookProperties = {
      title: workbook.title,
      subject: workbook.subject,
      creator: workbook.creator,
      lastModifiedBy: workbook.lastModifiedBy,
      created: workbook.created,
      modified: workbook.modified,
      keywords: workbook.keywords,
      description: workbook.description,
    };

    return {
      sheets,
      properties,
      namedRanges: [], // Named ranges extraction would need additional implementation
    };
  }

  /**
   * Process a single worksheet
   *
   * @param worksheet - ExcelJS worksheet
   * @param sheetId - Sheet index
   * @param options - Processing options
   * @returns Processed sheet data
   */
  private processSheet(
    worksheet: ExcelWorksheet,
    sheetId: number,
    options: XlsxProcessingOptions
  ): SheetData {
    const rows: CellValue[][] = [];
    let headers: string[] = [];
    const maxRows = options.maxRowsPerSheet ?? Infinity;
    let rowIndex = 0;

    worksheet.eachRow((row, rowNumber) => {
      if (rowIndex >= maxRows) {
        return;
      }

      // Extract cell values from row
      const cellValues: CellValue[] = [];
      row.eachCell((cell, _colNumber) => {
        cellValues.push(this.extractCellValue(cell));
      });

      // Skip empty rows if configured
      if (
        options.skipEmptyRows &&
        cellValues.every(v => v === null || v === '')
      ) {
        return;
      }

      // First row as headers
      if (rowNumber === 1 && options.firstRowAsHeaders !== false) {
        headers = cellValues.map(v => String(v ?? ''));
      } else {
        rows.push(cellValues);
      }

      rowIndex++;
    });

    // Extract merged cells
    const mergedCells: MergedCell[] = (worksheet.model.merges ?? []).map(
      merge => {
        // Parse merge range like "A1:B2"
        const match = merge.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) {
          return { startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 };
        }
        return {
          startRow: parseInt(match[2] ?? '0', 10),
          startColumn: this.columnLetterToNumber(match[1] ?? 'A'),
          endRow: parseInt(match[4] ?? '0', 10),
          endColumn: this.columnLetterToNumber(match[3] ?? 'A'),
        };
      }
    );

    return {
      name: worksheet.name,
      index: sheetId,
      hidden: worksheet.state !== 'visible',
      rowCount: worksheet.actualRowCount,
      columnCount: worksheet.actualColumnCount,
      headers,
      rows,
      mergedCells,
      namedRanges: [],
    };
  }

  /**
   * Extract cell value from ExcelJS cell
   */
  private extractCellValue(cell: ExcelCell): CellValue {
    const value = cell.value;

    if (value === null || value === undefined) {
      return null;
    }

    // Handle formula results
    if (typeof value === 'object' && 'result' in value) {
      return value.result ?? null;
    }

    // Handle rich text
    if (typeof value === 'object' && 'text' in value) {
      return value.text ?? null;
    }

    return value as CellValue;
  }

  /**
   * Convert column letter to number (A=1, B=2, etc.)
   */
  private columnLetterToNumber(letters: string): number {
    let result = 0;
    for (let i = 0; i < letters.length; i++) {
      result = result * 26 + (letters.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return result;
  }

  /**
   * Convert sheets to text representation
   */
  private sheetsToText(
    sheets: SheetData[],
    _options: XlsxProcessingOptions
  ): string {
    const lines: string[] = [];

    for (const sheet of sheets) {
      lines.push(`=== Sheet: ${sheet.name} ===`);
      lines.push('');

      // Add headers
      if (sheet.headers.length > 0) {
        lines.push(sheet.headers.join('\t'));
        lines.push('-'.repeat(50));
      }

      // Add rows
      for (const row of sheet.rows) {
        lines.push(row.map(cell => this.formatCell(cell)).join('\t'));
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format cell value for text output
   */
  private formatCell(value: CellValue): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value);
  }

  /**
   * Extract tables from sheets
   */
  private extractTables(sheets: SheetData[]): TableData[] {
    const tables: TableData[] = [];

    for (const sheet of sheets) {
      if (sheet.headers.length > 0 && sheet.rows.length > 0) {
        tables.push({
          headers: sheet.headers,
          rows: sheet.rows.map(row => row.map(cell => this.formatCell(cell))),
        });
      }
    }

    return tables;
  }

  /**
   * Create empty metadata for error cases
   */
  private createEmptyMetadata(filePath: string): FileMetadata {
    return {
      filename: path.basename(filePath),
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 0,
      fileType: FileType.XLSX,
    };
  }

  /**
   * Get processor information
   */
  getInfo(): { name: string; version: string; supportedTypes: string[] } {
    return {
      name: 'XlsxProcessor',
      version: '0.1.0',
      supportedTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
    };
  }
}

/**
 * Workbook properties
 */
interface WorkbookProperties {
  title?: string;
  subject?: string;
  creator?: string;
  lastModifiedBy?: string;
  created?: Date;
  modified?: Date;
  keywords?: string;
  description?: string;
}

/**
 * Create XLSX processor instance
 */
export function createXlsxProcessor(
  config: FileProcessorConfig
): XlsxProcessor {
  return new XlsxProcessor(config);
}
