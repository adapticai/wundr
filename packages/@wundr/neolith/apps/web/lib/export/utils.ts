/**
 * Export Utils - Utility functions for export operations
 */

import { format } from 'date-fns';

import type { ExportFormat, ExportMetadata, DataTransformOptions } from './types';

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Measure export duration
 */
export function measureExportDuration(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Generate export metadata
 */
export function generateExportMetadata(
  format: ExportFormat,
  options: {
    userId?: string;
    workspaceId?: string;
    dataSource?: string;
    rowCount?: number;
    columnCount?: number;
  } = {},
): ExportMetadata {
  return {
    exportId: generateExportId(),
    timestamp: new Date(),
    format,
    options: {},
    ...options,
  };
}

/**
 * Generate unique export ID
 */
export function generateExportId(): string {
  return `export_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format date for export
 */
export function formatDateForExport(
  date: Date | string,
  dateFormat = 'yyyy-MM-dd HH:mm:ss',
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return String(date);
  }

  return format(dateObj, dateFormat);
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  base: string,
  exportFormat: ExportFormat,
  options: { includeTimestamp?: boolean; suffix?: string } = {},
): string {
  const { includeTimestamp = true, suffix } = options;

  const parts = [base];

  if (suffix) {
    parts.push(suffix);
  }

  if (includeTimestamp) {
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    parts.push(timestamp);
  }

  return `${parts.join('_')}.${exportFormat}`;
}

/**
 * Get content type for export format
 */
export function getExportContentType(format: ExportFormat): string {
  const contentTypes: Record<ExportFormat, string> = {
    csv: 'text/csv;charset=utf-8;',
    json: 'application/json',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png',
    jpeg: 'image/jpeg',
  };

  return contentTypes[format] || 'application/octet-stream';
}

/**
 * Determine if async export should be used based on data size
 */
export function shouldUseAsyncExport(
  dataSize: number,
  options: { threshold?: number } = {},
): boolean {
  const { threshold = 1000 } = options;
  return dataSize > threshold;
}

/**
 * Flatten nested object data
 */
export function flattenData<T extends Record<string, unknown>>(
  data: T[],
  options: { maxDepth?: number; separator?: string } = {},
): Record<string, unknown>[] {
  const { maxDepth = 3, separator = '.' } = options;

  function flatten(
    obj: unknown,
    prefix = '',
    depth = 0,
  ): Record<string, unknown> {
    if (depth >= maxDepth || obj === null || typeof obj !== 'object') {
      return prefix ? { [prefix]: obj } : (obj as Record<string, unknown>);
    }

    const flattened: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(flattened, flatten(value, newKey, depth + 1));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  return data.map(item => flatten(item));
}

/**
 * Transform data according to options
 */
export function transformData<T extends Record<string, unknown>>(
  data: T[],
  options: DataTransformOptions = {},
): Record<string, unknown>[] {
  const {
    flatten: shouldFlatten = false,
    maxDepth = 3,
    dateFormat: dateFormatStr,
    numberFormat,
    booleanFormat = 'true/false',
    nullValue = '',
    undefinedValue = '',
  } = options;

  const processedData = shouldFlatten ? flattenData(data, { maxDepth }) : data;

  return processedData.map(row => {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === null) {
        transformed[key] = nullValue;
      } else if (value === undefined) {
        transformed[key] = undefinedValue;
      } else if (value instanceof Date) {
        transformed[key] = dateFormatStr
          ? formatDateForExport(value, dateFormatStr)
          : value.toISOString();
      } else if (typeof value === 'boolean') {
        switch (booleanFormat) {
          case 'yes/no':
            transformed[key] = value ? 'Yes' : 'No';
            break;
          case '1/0':
            transformed[key] = value ? 1 : 0;
            break;
          default:
            transformed[key] = value ? 'true' : 'false';
        }
      } else if (typeof value === 'number' && numberFormat) {
        transformed[key] = formatNumber(value, numberFormat);
      } else {
        transformed[key] = value;
      }
    }

    return transformed;
  });
}

/**
 * Format number according to format string
 */
function formatNumber(value: number, formatStr: string): string {
  // Simple number formatting
  if (formatStr === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  if (formatStr === 'percent') {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
    }).format(value);
  }

  if (formatStr.startsWith('decimal:')) {
    const decimals = parseInt(formatStr.split(':')[1] || '2', 10);
    return value.toFixed(decimals);
  }

  return value.toString();
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Calculate estimated export size
 */
export function estimateExportSize(
  data: unknown[],
  format: ExportFormat,
): number {
  const jsonSize = JSON.stringify(data).length;

  // Rough estimates based on format
  const multipliers: Record<ExportFormat, number> = {
    json: 1,
    csv: 0.7,
    xlsx: 0.5,
    pdf: 2,
    png: 10,
    jpeg: 8,
  };

  return Math.round(jsonSize * (multipliers[format] || 1));
}

/**
 * Validate export options
 */
export function validateExportOptions(
  format: ExportFormat,
  options: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Common validations
  if (options.filename && typeof options.filename !== 'string') {
    errors.push('Filename must be a string');
  }

  if (options.columns && !Array.isArray(options.columns)) {
    errors.push('Columns must be an array');
  }

  // Format-specific validations
  switch (format) {
    case 'pdf':
      if (
        options.orientation &&
        !['portrait', 'landscape'].includes(options.orientation as string)
      ) {
        errors.push('PDF orientation must be "portrait" or "landscape"');
      }
      break;

    case 'png':
    case 'jpeg':
      if (options.quality && (typeof options.quality !== 'number' || options.quality < 0 || options.quality > 1)) {
        errors.push('Image quality must be a number between 0 and 1');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create progress tracker
 */
export function createProgressTracker(
  total: number,
  onProgress?: (progress: number) => void,
) {
  let current = 0;

  return {
    increment: (amount = 1) => {
      current += amount;
      const progress = Math.min(Math.round((current / total) * 100), 100);
      onProgress?.(progress);
    },
    complete: () => {
      current = total;
      onProgress?.(100);
    },
    reset: () => {
      current = 0;
      onProgress?.(0);
    },
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Batch process large datasets
 */
export async function* batchProcess<T, R>(
  data: T[],
  processor: (batch: T[]) => Promise<R>,
  batchSize: number = 100,
): AsyncGenerator<R, void, unknown> {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    yield await processor(batch);
  }
}

/**
 * Retry export operation
 */
export async function retryExport<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError || new Error('Export failed after retries');
}
