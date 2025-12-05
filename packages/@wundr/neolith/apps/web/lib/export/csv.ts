/**
 * CSV Export - Comprehensive CSV export functionality
 */

import {
  downloadBlob,
  generateExportMetadata,
  measureExportDuration,
} from './utils';

import type { CSVExportOptions, ExportResult } from './types';

/**
 * Export data to CSV format
 */
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: CSVExportOptions = {}
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'export.csv',
      columns,
      includeHeaders = true,
      delimiter = ',',
      quote = '"',
      escape = '"',
      lineEnding = '\n',
      bom = true,
    } = options;

    if (!data || data.length === 0) {
      throw new Error('No data provided for CSV export');
    }

    const csvContent = convertToCSV(data, {
      columns,
      includeHeaders,
      delimiter,
      quote,
      escape,
      lineEnding,
    });

    // Add BOM for UTF-8 encoding (helps Excel recognize UTF-8)
    const content = bom ? '\uFEFF' + csvContent : csvContent;

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'csv',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.csv',
      format: 'csv',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Convert data to CSV string
 */
export function convertToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: {
    delimiter?: string;
    quote?: string;
    escape?: string;
    lineEnding?: string;
    includeHeaders?: boolean;
    columns?: string[];
  } = {}
): string {
  const {
    delimiter = ',',
    quote = '"',
    escape = '"',
    lineEnding = '\n',
    includeHeaders = true,
    columns,
  } = options;

  if (data.length === 0) {
    return '';
  }

  const headers = columns || Object.keys(data[0] || {});
  const csvRows: string[] = [];

  if (includeHeaders) {
    csvRows.push(
      headers
        .map(h => escapeCSVValue(String(h), delimiter, quote, escape))
        .join(delimiter)
    );
  }

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(formatValue(value), delimiter, quote, escape);
    });
    csvRows.push(values.join(delimiter));
  }

  return csvRows.join(lineEnding);
}

/**
 * Escape CSV value according to RFC 4180
 */
function escapeCSVValue(
  value: string,
  delimiter: string,
  quote: string,
  escape: string
): string {
  // Check if value needs quoting
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes(quote) ||
    value.includes('\n') ||
    value.includes('\r');

  if (needsQuoting) {
    // Escape quotes by doubling them
    const escaped = value.replace(new RegExp(quote, 'g'), escape + quote);
    return quote + escaped + quote;
  }

  return value;
}

/**
 * Format value for CSV output
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Parse CSV string to objects
 */
export function parseCSV(
  csvString: string,
  options: {
    delimiter?: string;
    quote?: string;
    hasHeaders?: boolean;
    skipEmptyLines?: boolean;
  } = {}
): Record<string, string>[] {
  const {
    delimiter = ',',
    quote = '"',
    hasHeaders = true,
    skipEmptyLines = true,
  } = options;

  const lines = csvString.split(/\r?\n/);
  const result: Record<string, string>[] = [];

  if (lines.length === 0) {
    return result;
  }

  const headers = hasHeaders
    ? parseCSVLine(lines[0], delimiter, quote)
    : Array.from(
        { length: parseCSVLine(lines[0], delimiter, quote).length },
        (_, i) => `column${i + 1}`
      );

  const startIndex = hasHeaders ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    if (skipEmptyLines && !line) {
      continue;
    }

    const values = parseCSVLine(line, delimiter, quote);
    const obj: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }

    result.push(obj);
  }

  return result;
}

/**
 * Parse a single CSV line
 */
function parseCSVLine(
  line: string,
  delimiter: string,
  quote: string
): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === quote) {
      if (inQuotes && nextChar === quote) {
        // Escaped quote
        current += quote;
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // Add the last value
  values.push(current);

  return values;
}

/**
 * Export multiple sheets to CSV (creates separate files)
 */
export async function exportMultipleSheetsToCSV(
  sheets: Record<string, Record<string, unknown>[]>,
  options: CSVExportOptions = {}
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (const [sheetName, data] of Object.entries(sheets)) {
    const filename = options.filename
      ? options.filename.replace(/\.csv$/, `_${sheetName}.csv`)
      : `${sheetName}.csv`;

    const result = await exportToCSV(data, {
      ...options,
      filename,
    });

    results.push(result);
  }

  return results;
}

/**
 * Stream large datasets to CSV
 */
export async function* streamToCSV<T extends Record<string, unknown>>(
  dataGenerator: AsyncGenerator<T[], void, unknown>,
  options: CSVExportOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    delimiter = ',',
    quote = '"',
    escape = '"',
    lineEnding = '\n',
    includeHeaders = true,
    columns,
  } = options;

  let isFirstChunk = true;
  let headers: string[] = [];

  for await (const chunk of dataGenerator) {
    if (chunk.length === 0) {
      continue;
    }

    if (isFirstChunk) {
      headers = columns || Object.keys(chunk[0] || {});

      if (includeHeaders) {
        yield headers
          .map(h => escapeCSVValue(String(h), delimiter, quote, escape))
          .join(delimiter) + lineEnding;
      }

      isFirstChunk = false;
    }

    for (const row of chunk) {
      const values = headers.map(header => {
        const value = row[header];
        return escapeCSVValue(formatValue(value), delimiter, quote, escape);
      });
      yield values.join(delimiter) + lineEnding;
    }
  }
}
