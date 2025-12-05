/**
 * Reporting Components Index
 * Main export file for the reporting system
 */

// Chart Components
export { AreaChart } from './charts/area-chart';
export { BarChart } from './charts/bar-chart';
export { LineChart } from './charts/line-chart';
export { PieChart } from './charts/pie-chart';

// Filter Components
export { DateRangePicker } from './filters/date-range-picker';
export { ReportFilters } from './filters/report-filters';

// Export Utilities
export {
  convertChartDataToCSV,
  exportMultipleCSVs,
  exportToCSV,
} from './export/csv-export';
export { exportElementToPDF, exportToPDF } from './export/pdf-export';

// Templates
export { AnalyticsReport } from './templates/analytics-report';
export { PerformanceReport } from './templates/performance-report';

// Main Components
export { ReportBuilder } from './report-builder';

// Types
export type {
  ChartConfig,
  ChartDataPoint,
  ChartType,
  DateRange,
  DateRangePreset,
  ExportOptions,
  FilterOption,
  MetricCardData,
  Report,
  ReportFilter,
  ReportFormat,
  ReportMetadata,
  ReportSection,
  TableColumn,
  TableData,
  TimeSeriesDataPoint,
} from './types';
