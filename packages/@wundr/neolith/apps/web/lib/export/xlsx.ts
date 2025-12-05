/**
 * XLSX Export - Comprehensive Excel export functionality using xlsx
 */

import * as XLSX from 'xlsx';

import { downloadBlob, measureExportDuration } from './utils';

import type { XLSXExportOptions, ExportResult } from './types';

/**
 * Export data to Excel format
 */
export async function exportToXLSX<T extends Record<string, unknown>>(
  data: T[],
  options: XLSXExportOptions = {}
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'export.xlsx',
      sheetName = 'Sheet1',
      columns,
      autoWidth = true,
      freezeFirstRow = true,
      freezeFirstColumn = false,
      cellStyles = true,
      headerStyle = {
        bold: true,
        fontSize: 12,
        backgroundColor: '#428bca',
        fontColor: '#ffffff',
      },
    } = options;

    if (!data || data.length === 0) {
      throw new Error('No data provided for XLSX export');
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Prepare data with selected columns
    const headers = columns || Object.keys(data[0] || {});
    const processedData = data.map(row => {
      const processedRow: Record<string, unknown> = {};
      headers.forEach(header => {
        processedRow[header] = formatValueForExcel(row[header]);
      });
      return processedRow;
    });

    // Create worksheet from data
    const worksheet = XLSX.utils.json_to_sheet(processedData, {
      header: headers,
    });

    // Apply auto width
    if (autoWidth) {
      const colWidths = calculateColumnWidths(processedData, headers);
      worksheet['!cols'] = colWidths;
    }

    // Apply freeze panes
    if (freezeFirstRow || freezeFirstColumn) {
      worksheet['!freeze'] = {
        xSplit: freezeFirstColumn ? 1 : 0,
        ySplit: freezeFirstRow ? 1 : 0,
        topLeftCell:
          freezeFirstColumn && freezeFirstRow
            ? 'B2'
            : freezeFirstRow
              ? 'A2'
              : 'B1',
        activePane: 'bottomRight',
        state: 'frozen',
      };
    }

    // Apply header styles
    if (cellStyles && headerStyle) {
      applyHeaderStyles(worksheet, headers, headerStyle);
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: cellStyles,
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'xlsx',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.xlsx',
      format: 'xlsx',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Format value for Excel cell
 */
function formatValueForExcel(value: unknown): unknown {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Calculate optimal column widths
 */
function calculateColumnWidths(
  data: Record<string, unknown>[],
  headers: string[]
): Array<{ wch: number }> {
  return headers.map(header => {
    const maxLength = Math.max(
      header.length,
      ...data.map(row => {
        const value = String(row[header] || '');
        return value.length;
      })
    );
    return { wch: Math.min(maxLength + 2, 50) }; // Cap at 50 characters
  });
}

/**
 * Apply header styles to worksheet
 */
function applyHeaderStyles(
  worksheet: XLSX.WorkSheet,
  headers: string[],
  style: {
    bold?: boolean;
    fontSize?: number;
    backgroundColor?: string;
    fontColor?: string;
  }
): void {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];

    if (cell) {
      cell.s = {
        font: {
          bold: style.bold,
          sz: style.fontSize,
          color: { rgb: style.fontColor?.replace('#', '') },
        },
        fill: {
          fgColor: { rgb: style.backgroundColor?.replace('#', '') },
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
        },
      };
    }
  }
}

/**
 * Export multiple sheets to a single Excel file
 */
export async function exportMultipleSheetsToXLSX(
  sheets: Record<string, Record<string, unknown>[]>,
  options: XLSXExportOptions = {}
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'export.xlsx',
      autoWidth = true,
      freezeFirstRow = true,
      cellStyles = true,
      headerStyle = {
        bold: true,
        fontSize: 12,
        backgroundColor: '#428bca',
        fontColor: '#ffffff',
      },
    } = options;

    const workbook = XLSX.utils.book_new();

    for (const [sheetName, data] of Object.entries(sheets)) {
      if (!data || data.length === 0) {
        continue;
      }

      const headers = Object.keys(data[0] || {});
      const processedData = data.map(row => {
        const processedRow: Record<string, unknown> = {};
        headers.forEach(header => {
          processedRow[header] = formatValueForExcel(row[header]);
        });
        return processedRow;
      });

      const worksheet = XLSX.utils.json_to_sheet(processedData, {
        header: headers,
      });

      if (autoWidth) {
        worksheet['!cols'] = calculateColumnWidths(processedData, headers);
      }

      if (freezeFirstRow) {
        worksheet['!freeze'] = {
          xSplit: 0,
          ySplit: 1,
          topLeftCell: 'A2',
          activePane: 'bottomRight',
          state: 'frozen',
        };
      }

      if (cellStyles && headerStyle) {
        applyHeaderStyles(worksheet, headers, headerStyle);
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: cellStyles,
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'xlsx',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.xlsx',
      format: 'xlsx',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Export with formulas and advanced features
 */
export async function exportToXLSXWithFormulas(
  data: Record<string, unknown>[],
  formulas: Record<string, string>,
  options: XLSXExportOptions = {}
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const { filename = 'export.xlsx', sheetName = 'Sheet1' } = options;

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add formulas
    for (const [cell, formula] of Object.entries(formulas)) {
      worksheet[cell] = { f: formula };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'xlsx',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.xlsx',
      format: 'xlsx',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Parse Excel file to JSON
 */
export function parseXLSX(
  file: File
): Promise<Record<string, Record<string, unknown>[]>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const result: Record<string, Record<string, unknown>[]> = {};

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          result[sheetName] = jsonData as Record<string, unknown>[];
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
}
