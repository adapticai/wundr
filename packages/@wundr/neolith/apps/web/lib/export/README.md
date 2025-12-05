# Export System

Comprehensive export functionality for CSV, PDF, Excel, chart images, and custom reports.

## Features

- **CSV Export**: RFC 4180 compliant with custom delimiters, quotes, and BOM support
- **PDF Export**: jsPDF-based with tables, charts, custom templates, and page numbers
- **Excel Export**: xlsx with multiple sheets, styling, formulas, and auto-width columns
- **Chart Export**: html2canvas for PNG/JPEG chart images with custom dimensions
- **Report Templates**: Pre-built and custom templates with multiple sections
- **Utilities**: File management, data transformation, progress tracking, and retry logic

## Installation

Required packages are already installed:
- `jspdf` - PDF generation
- `jspdf-autotable` - PDF tables
- `xlsx` - Excel generation
- `html2canvas` - Chart/element to image
- `date-fns` - Date formatting

## Quick Start

### CSV Export

```typescript
import { exportToCSV } from '@/lib/export';

const data = [
  { name: 'John', age: 30, email: 'john@example.com' },
  { name: 'Jane', age: 25, email: 'jane@example.com' },
];

await exportToCSV(data, {
  filename: 'users.csv',
  includeHeaders: true,
  delimiter: ',',
  bom: true, // UTF-8 BOM for Excel
});
```

### PDF Export

```typescript
import { exportToPDF } from '@/lib/export';

await exportToPDF(data, {
  filename: 'report.pdf',
  title: 'User Report',
  orientation: 'portrait',
  pageSize: 'A4',
  includePageNumbers: true,
  includeTimestamp: true,
});
```

### Excel Export

```typescript
import { exportToXLSX } from '@/lib/export';

await exportToXLSX(data, {
  filename: 'users.xlsx',
  sheetName: 'Users',
  autoWidth: true,
  freezeFirstRow: true,
  headerStyle: {
    bold: true,
    fontSize: 12,
    backgroundColor: '#428bca',
    fontColor: '#ffffff',
  },
});
```

### Chart Export

```typescript
import { exportChartToImage } from '@/lib/export';

// Export by element ID
await exportChartToImage('my-chart-id', {
  filename: 'chart.png',
  format: 'png',
  scale: 2,
  quality: 1.0,
});

// Export by element reference
const chartElement = document.getElementById('my-chart');
await exportChartToImage(chartElement, {
  filename: 'chart.jpeg',
  format: 'jpeg',
  quality: 0.9,
});
```

## Advanced Usage

### Multiple Sheets (Excel)

```typescript
import { exportMultipleSheetsToXLSX } from '@/lib/export';

const sheets = {
  Users: userData,
  Products: productData,
  Orders: orderData,
};

await exportMultipleSheetsToXLSX(sheets, {
  filename: 'complete_export.xlsx',
  autoWidth: true,
});
```

### Report Templates

```typescript
import {
  exportReportToPDF,
  createDashboardReportTemplate,
  getTemplate
} from '@/lib/export';

// Use pre-built template
const template = createDashboardReportTemplate(
  'Monthly Report',
  ['revenue-chart', 'users-chart'],
  { includeDataTables: true }
);

// Export with template
const sections = template.sections.map(section => {
  if (section.type === 'table') {
    return { ...section, content: data };
  }
  return section;
});

await exportReportToPDF(sections, {
  filename: 'monthly_report.pdf',
  title: 'Monthly Dashboard',
});
```

### Bulk Export (Multiple Formats)

```typescript
import { bulkExport } from '@/lib/export';

const results = await bulkExport(data, {
  formats: ['csv', 'xlsx', 'pdf'],
  baseFilename: 'export',
  parallel: true,
  onProgress: (format, progress) => {
    console.log(`${format}: ${progress.progress}%`);
  },
});
```

### Export Manager (Queue)

```typescript
import { ExportManager } from '@/lib/export';

const manager = new ExportManager(3); // max 3 concurrent exports

// Add exports to queue
manager.add(data1, 'csv', { filename: 'export1.csv' });
manager.add(data2, 'xlsx', { filename: 'export2.xlsx' });
manager.add(data3, 'pdf', { filename: 'export3.pdf' });

// Exports are processed automatically
```

### Data Transformation

```typescript
import { transformData, flattenData } from '@/lib/export';

// Flatten nested objects
const flattened = flattenData(data, { maxDepth: 3, separator: '.' });

// Transform with custom formatting
const transformed = transformData(data, {
  flatten: true,
  dateFormat: 'yyyy-MM-dd',
  booleanFormat: 'yes/no',
  numberFormat: 'currency',
  nullValue: 'N/A',
});
```

### Chart Composite Export

```typescript
import { exportCompositeImage } from '@/lib/export';

await exportCompositeImage(
  [
    { element: 'chart1', x: 0, y: 0, width: 400, height: 300 },
    { element: 'chart2', x: 420, y: 0, width: 400, height: 300 },
    { element: 'chart3', x: 0, y: 320, width: 400, height: 300 },
    { element: 'chart4', x: 420, y: 320, width: 400, height: 300 },
  ],
  { width: 840, height: 640 },
  {
    filename: 'dashboard.png',
    format: 'png',
    backgroundColor: '#f5f5f5',
  }
);
```

### Streaming Large Datasets

```typescript
import { streamToCSV } from '@/lib/export';

async function* dataGenerator() {
  for (let i = 0; i < 10; i++) {
    yield await fetchDataBatch(i);
  }
}

const chunks: string[] = [];
for await (const chunk of streamToCSV(dataGenerator())) {
  chunks.push(chunk);
}

const csvContent = chunks.join('');
```

## Templates

### Available Templates

```typescript
import { getTemplateLibrary, listTemplates } from '@/lib/export';

const library = getTemplateLibrary();
// Returns: { basic, dashboard, financial, executive }

const allTemplates = listTemplates();
// Returns library + custom saved templates
```

### Custom Template

```typescript
import { createCustomReportTemplate, saveTemplate } from '@/lib/export';

const template = createCustomReportTemplate(
  'Custom Report',
  [
    { type: 'text', title: 'Introduction', content: 'Report intro...' },
    { type: 'divider' },
    { type: 'table', title: 'Data Table' },
    { type: 'pageBreak' },
    { type: 'chart', title: 'Chart Visualization' },
  ],
  {
    orientation: 'landscape',
    includePageNumbers: true,
  }
);

// Save for reuse
saveTemplate(template);
```

## Utilities

### File Size Estimation

```typescript
import { estimateExportSize, formatFileSize } from '@/lib/export';

const estimatedBytes = estimateExportSize(data, 'xlsx');
const readable = formatFileSize(estimatedBytes); // "1.23 MB"
```

### Progress Tracking

```typescript
import { createProgressTracker } from '@/lib/export';

const tracker = createProgressTracker(100, (progress) => {
  console.log(`Progress: ${progress}%`);
});

for (let i = 0; i < 100; i++) {
  // Do work
  tracker.increment();
}
```

### Retry Logic

```typescript
import { exportWithRetry } from '@/lib/export';

const result = await exportWithRetry(data, 'pdf', {
  filename: 'report.pdf',
  maxRetries: 3,
  retryDelay: 1000,
});
```

## Type Definitions

All types are exported from the main module:

```typescript
import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  CSVExportOptions,
  PDFExportOptions,
  XLSXExportOptions,
  ChartExportOptions,
  ImageExportOptions,
  ReportTemplate,
  ReportSection,
  ExportProgress,
  BulkExportOptions,
} from '@/lib/export';
```

## Error Handling

All export functions return an `ExportResult` object:

```typescript
const result = await exportToCSV(data, options);

if (result.success) {
  console.log(`Exported ${result.filename} (${result.size} bytes)`);
} else {
  console.error(`Export failed: ${result.error?.message}`);
}
```

## Best Practices

1. **Large Datasets**: Use streaming or batch processing for >10,000 rows
2. **File Names**: Use `generateExportFilename()` for consistent naming
3. **Data Transformation**: Flatten nested objects before export
4. **Error Handling**: Always check `result.success` before assuming export worked
5. **Progress Tracking**: Use progress callbacks for large exports
6. **Memory Management**: Clear data after export to free memory

## Browser Compatibility

- All exports work in modern browsers (Chrome, Firefox, Safari, Edge)
- CSV/JSON: Full support
- PDF: Requires jsPDF (supported in all modern browsers)
- Excel: Requires xlsx (supported in all modern browsers)
- Charts: Requires html2canvas (may have limitations with complex CSS)

## Performance

- CSV: ~10,000 rows/second
- Excel: ~5,000 rows/second (with styling)
- PDF: ~1,000 rows/second (with tables)
- Chart Images: Depends on chart complexity (typically 100-500ms per chart)

## License

Part of the Wundr Neolith platform.
