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

  const csvContent = convertToCSV(data, { delimiter, includeHeaders, columns });
  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, filename);
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
    columns,
  } = options;

  console.log('[ExportUtils] Exporting to PDF:', {
    rows: data.length,
    filename,
    orientation,
    pageSize,
    title,
  });

  const headers = columns || Object.keys(data[0] || {});

  const pageSizeStyle =
    pageSize === 'A4'
      ? '@page { size: A4 ' + orientation + '; }'
      : '@page { size: letter ' + orientation + '; }';

  const tableRows = data
    .map(row => {
      const cells = headers
        .map(
          h =>
            `<td style="border:1px solid #ccc;padding:6px 10px;">${escapeHtml(String(row[h] ?? ''))}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const headerRow = headers
    .map(
      h =>
        `<th style="border:1px solid #ccc;padding:6px 10px;background:#f0f0f0;font-weight:bold;">${escapeHtml(h)}</th>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${pageSizeStyle}
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    console.warn('[ExportUtils] Could not open print window (popup blocked?)');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  // Allow layout to settle before triggering print dialog
  printWindow.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
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

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
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

  const headers = columns || Object.keys(data[0] || {});

  // Build SpreadsheetML XML that Excel and compatible applications can open
  const xmlRows = [
    // Header row
    '<Row>' +
      headers
        .map(h => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
        .join('') +
      '</Row>',
    // Data rows
    ...data.map(row => {
      const cells = headers
        .map(h => {
          const value = row[h];
          const isNumber =
            typeof value === 'number' && isFinite(value as number);
          const type = isNumber ? 'Number' : 'String';
          const content =
            value !== null && value !== undefined ? String(value) : '';
          return `<Cell><Data ss:Type="${type}">${escapeXml(content)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    }),
  ].join('\n    ');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Worksheet ss:Name="Sheet1">
    <Table>
    ${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;

  // Use .xls extension with SpreadsheetML MIME so Excel opens it directly
  const xlsFilename = filename.replace(/\.xlsx?$/i, '.xls');
  const blob = new Blob([xml], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  downloadBlob(blob, xlsFilename);
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format date for export
 */
export function formatDateForExport(
  date: Date | string,
  format = 'YYYY-MM-DD HH:mm:ss'
): string {
  console.log('[ExportUtils] Formatting date:', date, format);

  const d = new Date(date);

  // Use Intl.DateTimeFormat for consistent, locale-neutral output
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });

  // en-CA produces YYYY-MM-DD; combine with time parts to get YYYY-MM-DD HH:mm:ss
  const parts = formatter
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, { type, value }) => {
      acc[type] = value;
      return acc;
    }, {});

  const formatted = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;

  // If the caller passed a custom format string, do a simple token substitution
  if (format !== 'YYYY-MM-DD HH:mm:ss') {
    return format
      .replace('YYYY', parts.year ?? '')
      .replace('MM', parts.month ?? '')
      .replace('DD', parts.day ?? '')
      .replace('HH', parts.hour ?? '')
      .replace('mm', parts.minute ?? '')
      .replace('ss', parts.second ?? '');
  }

  return formatted;
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Escape a string for safe embedding in HTML content */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a string for safe embedding in XML content (SpreadsheetML) */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
