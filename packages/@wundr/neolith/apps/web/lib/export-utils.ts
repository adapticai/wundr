/**
 * Export Utilities - Functions for exporting data to various formats
 */

export type ExportFormat = 'csv' | 'pdf' | 'json' | 'xlsx';

export type ExportOptions = {
  filename?: string;
  columns?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
};

export type CSVExportOptions = ExportOptions & {
  delimiter?: string;
  quote?: string;
};

export type PDFExportOptions = ExportOptions & {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'letter';
  title?: string;
};

/**
 * Export data to CSV format
 */
export async function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: CSVExportOptions = {}
): Promise<void> {
  const {
    filename = 'export.csv',
    columns,
    includeHeaders = true,
    delimiter = ',',
  } = options;

  console.log('[ExportUtils] Exporting to CSV:', {
    rows: data.length,
    filename,
    columns,
    includeHeaders,
  });

  // TODO: Implement CSV export
  // const headers = columns || Object.keys(data[0] || {});
  // const csvContent = includeHeaders ? headers.join(delimiter) + '\n' : '';
  // const rows = data.map(row =>
  //   headers.map(h => JSON.stringify(row[h] ?? '')).join(delimiter)
  // ).join('\n');
  // const blob = new Blob([csvContent + rows], { type: 'text/csv' });
  // downloadBlob(blob, filename);
}

/**
 * Export data to PDF format
 */
export async function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    filename = 'export.pdf',
    orientation = 'portrait',
    pageSize = 'A4',
    title = 'Export',
  } = options;

  console.log('[ExportUtils] Exporting to PDF:', {
    rows: data.length,
    filename,
    orientation,
    pageSize,
    title,
  });

  // TODO: Implement PDF export using jsPDF or similar
  // const doc = new jsPDF({ orientation, format: pageSize });
  // doc.text(title, 10, 10);
  // doc.autoTable({ head: [headers], body: rows });
  // doc.save(filename);
}

/**
 * Export data to JSON format
 */
export async function exportToJSON<T>(
  data: T,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'export.json' } = options;

  console.log('[ExportUtils] Exporting to JSON:', {
    filename,
  });

  // TODO: Implement JSON export
  // const json = JSON.stringify(data, null, 2);
  // const blob = new Blob([json], { type: 'application/json' });
  // downloadBlob(blob, filename);
}

/**
 * Export data to Excel format
 */
export async function exportToXLSX<T extends Record<string, unknown>>(
  data: T[],
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'export.xlsx', columns } = options;

  console.log('[ExportUtils] Exporting to XLSX:', {
    rows: data.length,
    filename,
    columns,
  });

  // TODO: Implement XLSX export using xlsx library
  // const ws = XLSX.utils.json_to_sheet(data);
  // const wb = XLSX.utils.book_new();
  // XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  // XLSX.writeFile(wb, filename);
}

/**
 * Generic export function that routes to appropriate format handler
 */
export async function exportData<T extends Record<string, unknown>>(
  data: T[],
  format: ExportFormat,
  options: ExportOptions = {}
): Promise<void> {
  console.log('[ExportUtils] Exporting data:', { format, rows: data.length });

  switch (format) {
    case 'csv':
      return exportToCSV(data, options);
    case 'pdf':
      return exportToPDF(data, options);
    case 'json':
      return exportToJSON(data, options);
    case 'xlsx':
      return exportToXLSX(data, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Download blob as file
 */
function downloadBlob(blob: Blob, filename: string): void {
  console.log('[ExportUtils] Downloading blob:', filename);
  // TODO: Implement blob download
  // const url = URL.createObjectURL(blob);
  // const link = document.createElement('a');
  // link.href = url;
  // link.download = filename;
  // document.body.appendChild(link);
  // link.click();
  // document.body.removeChild(link);
  // URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(
  date: Date | string,
  format = 'YYYY-MM-DD HH:mm:ss'
): string {
  console.log('[ExportUtils] Formatting date:', date, format);
  // TODO: Implement date formatting
  return new Date(date).toISOString();
}

/**
 * Convert data to CSV string
 */
export function convertToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: {
    delimiter?: string;
    includeHeaders?: boolean;
    columns?: string[];
  } = {}
): string {
  const { delimiter = ',', includeHeaders = true, columns } = options;

  console.log('[ExportUtils] Converting to CSV:', {
    rows: data.length,
    includeHeaders,
  });

  if (data.length === 0) {
    return '';
  }

  const headers = columns || Object.keys(data[0] || {});
  const csvRows: string[] = [];

  if (includeHeaders) {
    csvRows.push(headers.join(delimiter));
  }

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      const stringValue =
        value !== null && value !== undefined ? String(value) : '';
      // Escape quotes and wrap in quotes if contains delimiter or quotes
      if (
        stringValue.includes(delimiter) ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(delimiter));
  }

  return csvRows.join('\n');
}

/**
 * Flatten nested object data
 */
export function flattenData<T extends Record<string, unknown>>(
  data: T[],
  options: { maxDepth?: number; separator?: string } = {}
): Record<string, unknown>[] {
  const { maxDepth = 3, separator = '.' } = options;

  console.log('[ExportUtils] Flattening data:', {
    rows: data.length,
    maxDepth,
  });

  function flatten(
    obj: unknown,
    prefix = '',
    depth = 0
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
        !Array.isArray(value)
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
 * Generate filename for export
 */
export function generateExportFilename(
  workspaceId: string,
  type: string,
  format: ExportFormat,
  options: { includeTimestamp?: boolean } = {}
): string {
  const { includeTimestamp = true } = options;

  const parts = [workspaceId, type];

  if (includeTimestamp) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    parts.push(timestamp);
  }

  const filename = `${parts.join('_')}.${format}`;

  console.log('[ExportUtils] Generated filename:', filename);

  return filename;
}

/**
 * Get content type for export format
 */
export function getExportContentType(format: ExportFormat): string {
  const contentTypes: Record<ExportFormat, string> = {
    csv: 'text/csv',
    json: 'application/json',
    pdf: 'application/pdf',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  return contentTypes[format] || 'application/octet-stream';
}

/**
 * Determine if async export should be used based on data size
 */
export function shouldUseAsyncExport(
  dataSize: number,
  options: { threshold?: number } = {}
): boolean {
  const { threshold = 1000 } = options;

  const shouldAsync = dataSize > threshold;

  console.log('[ExportUtils] Should use async export:', {
    dataSize,
    threshold,
    shouldAsync,
  });

  return shouldAsync;
}
