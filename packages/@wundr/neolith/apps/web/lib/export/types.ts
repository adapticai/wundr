/**
 * Export Types - Type definitions for export functionality
 */

export type ExportFormat = 'csv' | 'pdf' | 'json' | 'xlsx' | 'png' | 'jpeg';

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportOptions {
  filename?: string;
  columns?: string[];
  includeHeaders?: boolean;
  dateFormat?: string;
}

export interface CSVExportOptions extends ExportOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  lineEnding?: '\n' | '\r\n';
  bom?: boolean;
}

export interface PDFExportOptions extends ExportOptions {
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'letter' | 'legal' | 'tabloid';
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize?: number;
  fontFamily?: string;
  includePageNumbers?: boolean;
  includeTimestamp?: boolean;
  headerText?: string;
  footerText?: string;
}

export interface XLSXExportOptions extends ExportOptions {
  sheetName?: string;
  sheetNames?: string[];
  autoWidth?: boolean;
  freezeFirstRow?: boolean;
  freezeFirstColumn?: boolean;
  cellStyles?: boolean;
  headerStyle?: {
    bold?: boolean;
    fontSize?: number;
    backgroundColor?: string;
    fontColor?: string;
  };
}

export interface ImageExportOptions {
  filename?: string;
  format?: 'png' | 'jpeg';
  quality?: number; // 0-1 for JPEG
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
}

export interface ChartExportOptions extends ImageExportOptions {
  chartId?: string;
  chartElement?: HTMLElement;
  includeTitle?: boolean;
  includeLegend?: boolean;
  includeDataLabels?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  format: ExportFormat;
  sections: ReportSection[];
  options: ExportOptions;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  type: 'text' | 'table' | 'chart' | 'image' | 'divider' | 'pageBreak';
  title?: string;
  content?: unknown;
  order: number;
  options?: Record<string, unknown>;
}

export interface ExportProgress {
  status: ExportStatus;
  progress: number; // 0-100
  message?: string;
  error?: Error;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  format: ExportFormat;
  size: number;
  url?: string;
  error?: Error;
  duration: number;
}

export interface BulkExportOptions {
  formats: ExportFormat[];
  baseFilename: string;
  parallel?: boolean;
  onProgress?: (format: ExportFormat, progress: ExportProgress) => void;
}

export interface DataTransformOptions {
  flatten?: boolean;
  maxDepth?: number;
  dateFormat?: string;
  numberFormat?: string;
  booleanFormat?: 'true/false' | 'yes/no' | '1/0';
  nullValue?: string;
  undefinedValue?: string;
}

export type ExportHook =
  | 'beforeExport'
  | 'afterExport'
  | 'onProgress'
  | 'onError';

export interface ExportHooks {
  beforeExport?: (
    data: unknown,
    options: ExportOptions
  ) => Promise<void> | void;
  afterExport?: (result: ExportResult) => Promise<void> | void;
  onProgress?: (progress: ExportProgress) => void;
  onError?: (error: Error) => void;
}

export interface ExportMetadata {
  exportId: string;
  timestamp: Date;
  userId?: string;
  workspaceId?: string;
  dataSource?: string;
  rowCount?: number;
  columnCount?: number;
  format: ExportFormat;
  options: ExportOptions;
}
