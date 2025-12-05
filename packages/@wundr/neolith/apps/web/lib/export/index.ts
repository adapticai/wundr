/**
 * Export System - Main entry point for all export functionality
 */

// Export types
// Main export orchestrator
import { exportChartToImage } from './chart';
import { exportToCSV } from './csv';
import { exportToPDF } from './pdf';
import { exportToXLSX } from './xlsx';

import type { ChartExportOptions } from './types';

import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  BulkExportOptions,
  CSVExportOptions,
  PDFExportOptions,
  XLSXExportOptions,
} from './types';

export * from './types';

// Export CSV functionality
export {
  exportToCSV,
  convertToCSV,
  parseCSV,
  exportMultipleSheetsToCSV,
  streamToCSV,
} from './csv';

// Export PDF functionality
export { exportToPDF, exportReportToPDF, exportWithTemplate } from './pdf';

// Export XLSX functionality
export {
  exportToXLSX,
  exportMultipleSheetsToXLSX,
  exportToXLSXWithFormulas,
  parseXLSX,
} from './xlsx';

// Export chart/image functionality
export {
  exportChartToImage,
  exportChartToDataURL,
  exportMultipleCharts,
  exportChartWithDimensions,
  exportElementToImage,
  exportCompositeImage,
  getChartPreview,
} from './chart';

// Export templates
export {
  createTableReportTemplate,
  createDashboardReportTemplate,
  createFinancialReportTemplate,
  createCustomReportTemplate,
  getTemplateLibrary,
  saveTemplate,
  loadTemplates,
  deleteTemplate,
  getTemplate,
  listTemplates,
  cloneTemplate,
  updateTemplate,
} from './templates';

// Export utilities
export {
  downloadBlob,
  generateExportFilename,
  getExportContentType,
  shouldUseAsyncExport,
  flattenData,
  transformData,
  sanitizeFilename,
  estimateExportSize,
  validateExportOptions,
  createProgressTracker,
  formatFileSize,
  formatDateForExport,
  batchProcess,
  retryExport,
} from './utils';

/**
 * Generic export function that routes to the appropriate handler
 */
export async function exportData<T extends Record<string, unknown>>(
  data: T[],
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<ExportResult> {
  switch (format) {
    case 'csv':
      return exportToCSV(data, options as CSVExportOptions);
    case 'pdf':
      return exportToPDF(data, options as PDFExportOptions);
    case 'xlsx':
      return exportToXLSX(data, options as XLSXExportOptions);
    case 'json':
      return exportToJSON(data, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export to JSON format
 */
async function exportToJSON<T>(
  data: T,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const { filename = 'export.json' } = options;

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const size = blob.size;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);

    const duration = Date.now() - startTime;

    return {
      success: true,
      filename,
      format: 'json',
      size,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      filename: options.filename || 'export.json',
      format: 'json',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Export data in multiple formats
 */
export async function bulkExport<T extends Record<string, unknown>>(
  data: T[],
  options: BulkExportOptions
): Promise<Record<ExportFormat, ExportResult>> {
  const { formats, baseFilename, parallel = true, onProgress } = options;

  const results: Record<string, ExportResult> = {};

  if (parallel) {
    // Export all formats in parallel
    const promises = formats.map(async format => {
      onProgress?.(format, { status: 'processing', progress: 0 });

      const filename = `${baseFilename}.${format}`;
      const result = await exportData(data, format, { filename });

      onProgress?.(format, {
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        error: result.error,
      });

      return { format, result };
    });

    const settled = await Promise.all(promises);
    settled.forEach(({ format, result }) => {
      results[format] = result;
    });
  } else {
    // Export sequentially
    for (const format of formats) {
      onProgress?.(format, { status: 'processing', progress: 0 });

      const filename = `${baseFilename}.${format}`;
      const result = await exportData(data, format, { filename });

      results[format] = result;

      onProgress?.(format, {
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        error: result.error,
      });
    }
  }

  return results as Record<ExportFormat, ExportResult>;
}

/**
 * Export with retry logic
 */
export async function exportWithRetry<T extends Record<string, unknown>>(
  data: T[],
  format: ExportFormat,
  options: ExportOptions & { maxRetries?: number; retryDelay?: number } = {}
): Promise<ExportResult> {
  const { maxRetries = 3, retryDelay = 1000, ...exportOptions } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await exportData(data, format, exportOptions);

      if (result.success) {
        return result;
      }

      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < maxRetries - 1) {
      await new Promise(resolve =>
        setTimeout(resolve, retryDelay * (attempt + 1))
      );
    }
  }

  return {
    success: false,
    filename: options.filename || `export.${format}`,
    format,
    size: 0,
    error: lastError || new Error('Export failed after all retries'),
    duration: 0,
  };
}

/**
 * Create export manager for handling multiple exports
 */
export class ExportManager {
  private queue: Array<() => Promise<ExportResult>> = [];
  private running = false;
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add export to queue
   */
  add<T extends Record<string, unknown>>(
    data: T[],
    format: ExportFormat,
    options: ExportOptions = {}
  ): Promise<ExportResult> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await exportData(data, format, options);
          resolve(result);
          return result;
        } catch (error) {
          reject(error);
          throw error;
        }
      });

      if (!this.running) {
        this.process();
      }
    });
  }

  /**
   * Process export queue
   */
  private async process(): Promise<void> {
    this.running = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent);
      await Promise.allSettled(batch.map(fn => fn()));
    }

    this.running = false;
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}
