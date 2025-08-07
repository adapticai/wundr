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
  analysisEngine?: string;
  processingTime?: number;
  dataSource?: string;
  version?: string;
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

export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html' | 'markdown';

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
  sections?: Array<{ id: string; title: string; enabled: boolean; order: number }>;
  styling?: {
    theme: string;
    colors: {
      primary: string;
      secondary: string;
      success: string;
      warning: string;
      error: string;
    };
    fonts: {
      heading: string;
      body: string;
      code: string;
    };
  };
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
    metadata?: {
      processingTime?: number;
      dataChecksum?: string;
      generatedBy?: string;
    };
  }>;
  analytics: {
    totalDownloads: number;
    lastAccessed?: Date;
    retentionPolicy?: string;
  };
}

export interface ReportDashboardStats {
  totalReports: number;
  runningReports: number;
  scheduledReports: number;
  failedReports: number;
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
  storageUsage: {
    total: number;
    used: number;
    available: number;
  };
  performanceMetrics: {
    averageGenerationTime: number;
    successRate: number;
    errorRate: number;
  };
}

// Analysis Data Interfaces
export interface AnalysisEntity {
  id: string;
  name: string;
  path: string;
  type: 'class' | 'function' | 'module' | 'component' | 'interface' | 'enum' | 'type';
  dependencies: string[];
  dependents: string[];
  complexity: {
    cyclomatic: number;
    cognitive: number;
    halstead?: {
      volume: number;
      difficulty: number;
      effort: number;
    };
  };
  metrics: {
    linesOfCode: number;
    maintainabilityIndex: number;
    testCoverage?: number;
  };
  issues: Array<{
    id: string;
    type: 'code-smell' | 'bug' | 'vulnerability' | 'maintainability' | 'performance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    rule?: string;
    startLine?: number;
    endLine?: number;
    suggestions?: string[];
  }>;
  tags: string[];
  lastModified: Date;
}

export interface AnalysisDuplicate {
  id: string;
  type: 'structural' | 'exact' | 'similar' | 'semantic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  similarity: number; // 0-100 percentage
  occurrences: Array<{
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    context?: string;
  }>;
  linesCount: number;
  tokensCount: number;
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface AnalysisCircularDependency {
  id: string;
  severity: 'warning' | 'error';
  cycle: Array<{
    from: string;
    to: string;
    type: 'import' | 'require' | 'dynamic' | 'inheritance';
    line?: number;
  }>;
  depth: number;
  recommendation: string;
  breakpoints: Array<{
    from: string;
    to: string;
    reason: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

export interface AnalysisSecurityIssue {
  id: string;
  type: 'vulnerability' | 'exposed-secret' | 'insecure-dependency' | 'code-injection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  cve?: string;
  cvss?: number;
  path: string;
  line?: number;
  description: string;
  recommendation: string;
  references: string[];
  fixable: boolean;
  fixCommand?: string;
}

export interface AnalysisMetrics {
  overview: {
    totalFiles: number;
    totalLines: number;
    totalEntities: number;
    analysisTime: number;
    timestamp: Date;
  };
  quality: {
    maintainabilityIndex: number;
    technicalDebt: {
      minutes: number;
      rating: 'A' | 'B' | 'C' | 'D' | 'E';
    };
    duplicateLines: number;
    duplicateRatio: number;
    testCoverage?: {
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    };
  };
  complexity: {
    average: number;
    highest: number;
    distribution: {
      low: number;     // 1-5
      medium: number;  // 6-10
      high: number;    // 11-20
      veryHigh: number; // 21+
    };
  };
  issues: {
    total: number;
    byType: Record<string, number>;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  dependencies: {
    total: number;
    circular: number;
    unused: number;
    outdated: number;
    vulnerable: number;
  };
}

export interface AnalysisRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'maintainability' | 'performance' | 'security' | 'best-practices' | 'architecture';
  priority: 'low' | 'medium' | 'high' | 'critical';
  effort: {
    level: 'low' | 'medium' | 'high';
    hours?: number;
    description: string;
  };
  impact: {
    level: 'low' | 'medium' | 'high';
    metrics: string[];
    description: string;
  };
  affectedFiles: string[];
  implementation: {
    steps: string[];
    codeExamples?: Array<{
      before: string;
      after: string;
      language: string;
    }>;
    automatable: boolean;
    tools?: string[];
  };
  references: string[];
  tags: string[];
}

export interface CompleteAnalysisData {
  metadata: {
    version: string;
    generator: string;
    timestamp: Date;
    configuration: Record<string, any>;
    projectInfo: {
      name: string;
      path: string;
      language: string;
      framework?: string;
      packageManager?: string;
    };
  };
  entities: AnalysisEntity[];
  duplicates: AnalysisDuplicate[];
  circularDependencies: AnalysisCircularDependency[];
  securityIssues: AnalysisSecurityIssue[];
  metrics: AnalysisMetrics;
  recommendations: AnalysisRecommendation[];
  rawData?: {
    dependencies: Record<string, string[]>;
    fileTree: any;
    packageInfo?: any;
  };
}

// Report Content Interfaces
export interface ReportContent {
  summary: ReportSummary;
  sections: ReportSection[];
  appendices?: ReportAppendix[];
}

export interface ReportSummary {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: {
    label: string;
    value: number | string;
    change?: number;
    trend?: 'up' | 'down' | 'stable';
  }[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation: string[];
  };
}

export interface ReportSection {
  id: string;
  title: string;
  description?: string;
  content: ReportSectionContent[];
  charts?: ReportChart[];
  tables?: ReportTable[];
  order: number;
}

export interface ReportSectionContent {
  type: 'text' | 'list' | 'code' | 'markdown' | 'callout' | 'metrics-grid';
  content: string | string[] | Record<string, any>;
  language?: string; // for code blocks
  level?: 'info' | 'warning' | 'error' | 'success'; // for callouts
}

export interface ReportChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
      tension?: number;
    }>;
  };
  options?: Record<string, any>;
}

export interface ReportTable {
  id: string;
  title: string;
  columns: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'badge' | 'progress' | 'link' | 'code';
    sortable?: boolean;
    filterable?: boolean;
  }>;
  rows: Record<string, any>[];
  pagination?: {
    pageSize: number;
    currentPage: number;
    totalPages: number;
  };
}

export interface ReportAppendix {
  id: string;
  title: string;
  content: string;
  type: 'raw-data' | 'methodology' | 'glossary' | 'references';
}