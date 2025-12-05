/**
 * Reporting Types
 * Core TypeScript types and interfaces for the reporting system
 */

export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'ytd' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface ReportFilter {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'text' | 'number';
  options?: FilterOption[];
  value?: unknown;
  required?: boolean;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesDataPoint {
  date: string;
  [key: string]: string | number;
}

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'composed';

export interface ChartConfig {
  title: string;
  description?: string;
  type: ChartType;
  data: ChartDataPoint[] | TimeSeriesDataPoint[];
  dataKeys: string[];
  xAxisKey?: string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  stacked?: boolean;
}

export type ReportFormat = 'pdf' | 'csv' | 'xlsx' | 'json';

export interface ReportMetadata {
  title: string;
  description?: string;
  generatedAt: Date;
  generatedBy?: string;
  dateRange?: DateRange;
  filters?: Record<string, unknown>;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'text' | 'metrics';
  content: unknown;
}

export interface Report {
  metadata: ReportMetadata;
  sections: ReportSection[];
}

export interface MetricCardData {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
}

export interface TableColumn {
  header: string;
  accessorKey: string;
  cell?: (value: unknown) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface TableData {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface ExportOptions {
  format: ReportFormat;
  filename?: string;
  includeMetadata?: boolean;
  orientation?: 'portrait' | 'landscape';
}
