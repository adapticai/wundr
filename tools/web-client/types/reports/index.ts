export interface Report {
  id: string;
  name: string;
  type: ReportType;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdBy: string;
  description?: string;
  tags: string[];
  size?: number;
  duration?: number;
  metadata: ReportMetadata;
  schedule?: ReportSchedule;
}

export type ReportType = 
  | 'migration-analysis'
  | 'dependency-analysis'
  | 'code-quality'
  | 'performance-analysis'
  | 'security-audit'
  | 'compliance-report'
  | 'custom';

export type ReportStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled';

export interface ReportMetadata {
  parameters: Record<string, any>;
  includedModules?: string[];
  excludedPaths?: string[];
  filters?: ReportFilters;
  outputFormat: ExportFormat[];
}

export interface ReportFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  severity?: ('low' | 'medium' | 'high' | 'critical')[];
  categories?: string[];
  authors?: string[];
  fileTypes?: string[];
}

export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html';

export interface ReportSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string; // HH:MM format
  timezone: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  recipients: string[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  category: 'standard' | 'custom' | 'enterprise';
  parameters: ReportParameter[];
  defaultFilters?: ReportFilters;
  requiredPermissions?: string[];
  estimatedDuration?: number;
  sampleOutputs?: string[];
}

export interface ReportParameter {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'daterange';
  required: boolean;
  defaultValue?: any;
  options?: Array<{ value: any; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  description?: string;
}

export interface GenerateReportRequest {
  templateId: string;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  filters?: ReportFilters;
  outputFormats: ExportFormat[];
  schedule?: Omit<ReportSchedule, 'id' | 'lastRun' | 'nextRun'>;
  tags?: string[];
}

export interface ReportExportOptions {
  format: ExportFormat;
  includeCharts: boolean;
  includeRawData: boolean;
  compression?: 'none' | 'zip' | 'gzip';
  password?: string;
}

export interface HistoricalReport {
  report: Report;
  versions: Array<{
    version: number;
    createdAt: Date;
    changes: string[];
    size: number;
    downloadUrl: string;
  }>;
}

export interface ReportDashboardStats {
  totalReports: number;
  runningReports: number;
  scheduledReports: number;
  recentActivity: Array<{
    id: string;
    action: 'created' | 'completed' | 'failed' | 'scheduled';
    reportName: string;
    timestamp: Date;
    user: string;
  }>;
  popularTemplates: Array<{
    template: ReportTemplate;
    usageCount: number;
  }>;
}