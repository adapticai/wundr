/**
 * Report Builder Types
 * Enhanced types for drag-and-drop report builder
 */

export type WidgetType =
  | 'line-chart'
  | 'bar-chart'
  | 'area-chart'
  | 'pie-chart'
  | 'table'
  | 'metric-card'
  | 'text'
  | 'divider';

export type DataSourceType =
  | 'analytics'
  | 'tasks'
  | 'workflows'
  | 'agents'
  | 'custom-query'
  | 'api-endpoint';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  endpoint?: string;
  query?: string;
  parameters?: Record<string, unknown>;
}

export interface DataTransform {
  type: 'filter' | 'aggregate' | 'sort' | 'join';
  config: Record<string, unknown>;
}

export interface FilterConfig {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'gt'
    | 'lt'
    | 'between'
    | 'in';
  value: unknown;
}

export interface ReportWidget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: WidgetConfig;
  dataSource?: DataSource;
  filters?: FilterConfig[];
  transforms?: DataTransform[];
}

export interface WidgetConfig {
  title?: string;
  description?: string;
  // Chart-specific
  dataKeys?: string[];
  xAxisKey?: string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
  curved?: boolean;
  // Table-specific
  columns?: Array<{
    header: string;
    accessorKey: string;
    sortable?: boolean;
  }>;
  // Metric card-specific
  value?: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  // Text-specific
  content?: string;
  fontSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  align?: 'left' | 'center' | 'right';
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  time?: string; // HH:mm format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  cronExpression?: string; // For custom schedules
  recipients: string[]; // Email addresses
  format: 'pdf' | 'csv' | 'xlsx';
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  widgets: ReportWidget[];
  filters: FilterConfig[];
  schedule?: ReportSchedule;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  isPublic?: boolean;
  tags?: string[];
}

export interface WidgetPalette {
  category: string;
  items: Array<{
    type: WidgetType;
    label: string;
    icon: string;
    description: string;
    defaultSize: { width: number; height: number };
  }>;
}
