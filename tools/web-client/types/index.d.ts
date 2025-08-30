/**
 * Comprehensive Type Definitions for Web Client Application
 * 
 * This file provides centralized type definitions for the entire application,
 * including file system operations, analysis data structures, report interfaces,
 * configuration types, component props, and API response types.
 * 
 * @version 2.0.0
 * @author Wundr Development Team
 * @since 2024
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode, ReactElement } from 'react';

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Generic API response wrapper for consistent response formatting
 */
export interface ApiResponse<T = any> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data payload */
  data: T;
  /** Error message if success is false */
  error?: string;
  /** Response timestamp */
  timestamp: string;
  /** Optional metadata */
  meta?: {
    /** Total count for paginated responses */
    total?: number;
    /** Current page for paginated responses */
    page?: number;
    /** Items per page */
    limit?: number;
    /** Processing duration in milliseconds */
    duration?: number;
  };
}

/**
 * Generic error state interface
 */
export interface ErrorState {
  /** Human-readable error message */
  message: string;
  /** Optional error code */
  code?: string;
  /** Error timestamp */
  timestamp: string;
  /** Optional retry function */
  retry?: () => void;
  /** Stack trace for debugging (dev only) */
  stack?: string;
}

/**
 * Generic loading state interface
 */
export interface LoadingState {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Whether data is being refreshed */
  isRefreshing: boolean;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Optional loading message */
  message?: string;
}

/**
 * Generic cache entry interface
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Cache creation timestamp */
  timestamp: number;
  /** Cache expiration timestamp */
  expires: number;
  /** Optional cache key */
  key?: string;
}

/**
 * Time range selection options
 */
export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | '1y';

/**
 * Common severity levels
 */
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Common priority levels
 */
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Common status types
 */
export type StatusType = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

// =============================================================================
// FILE SYSTEM TYPES
// =============================================================================

/**
 * File system item information
 */
export interface FileInfo {
  /** Unique identifier */
  id: string;
  /** Full file path */
  path: string;
  /** File or directory name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Item type */
  type: 'file' | 'directory';
  /** Last modified date */
  modifiedAt: Date;
  /** File extension (for files only) */
  extension?: string;
  /** Child items (for directories) */
  children?: FileInfo[];
  /** MIME type */
  mimeType?: string;
  /** Whether item is hidden */
  isHidden?: boolean;
  /** File permissions */
  permissions?: {
    read: boolean;
    write: boolean;
    execute: boolean;
  };
}

/**
 * File system operations interface
 */
export interface FileOperations {
  /** Read file content */
  readFile: (path: string) => Promise<string>;
  /** Write file content */
  writeFile: (path: string, content: string) => Promise<void>;
  /** List directory contents */
  listDirectory: (path: string) => Promise<FileInfo[]>;
  /** Create directory */
  createDirectory: (path: string) => Promise<void>;
  /** Delete file or directory */
  delete: (path: string) => Promise<void>;
  /** Move/rename file or directory */
  move: (from: string, to: string) => Promise<void>;
  /** Copy file or directory */
  copy: (from: string, to: string) => Promise<void>;
}

/**
 * File upload information
 */
export interface FileUpload {
  /** File object */
  file: File;
  /** Upload progress (0-100) */
  progress: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Upload start time */
  startTime?: Date;
  /** Upload completion time */
  completionTime?: Date;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

/**
 * Analysis entity representation
 */
export interface AnalysisEntity {
  /** Unique identifier */
  id: string;
  /** Entity name */
  name: string;
  /** Full file path */
  path: string;
  /** Entity type */
  type: 'class' | 'function' | 'module' | 'component' | 'interface' | 'enum' | 'type' | 'variable' | 'constant';
  /** Dependencies array */
  dependencies: string[];
  /** Dependents array */
  dependents?: string[];
  /** Complexity metrics */
  complexity: {
    /** Cyclomatic complexity */
    cyclomatic: number;
    /** Cognitive complexity */
    cognitive: number;
    /** Halstead metrics */
    halstead?: {
      volume: number;
      difficulty: number;
      effort: number;
    };
  };
  /** Code metrics */
  metrics: {
    /** Lines of code */
    linesOfCode: number;
    /** Maintainability index (0-100) */
    maintainabilityIndex: number;
    /** Test coverage percentage */
    testCoverage?: number;
    /** Code duplication percentage */
    duplication?: number;
  };
  /** Associated issues */
  issues: AnalysisIssue[];
  /** Entity tags */
  tags: string[];
  /** Last modified date */
  lastModified: Date;
  /** Source code snippet */
  sourceSnippet?: string;
  /** Documentation */
  documentation?: string;
}

/**
 * Analysis issue representation
 */
export interface AnalysisIssue {
  /** Unique identifier */
  id: string;
  /** Issue type */
  type: 'bug' | 'vulnerability' | 'code_smell' | 'duplication' | 'complexity' | 'maintainability' | 'performance' | 'security';
  /** Severity level */
  severity: SeverityLevel;
  /** Human-readable message */
  message: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column?: number;
  /** End line number */
  endLine?: number;
  /** End column number */
  endColumn?: number;
  /** Issue category */
  category: string;
  /** Effort required to fix */
  effort: 'low' | 'medium' | 'high';
  /** Impact level */
  impact: 'low' | 'medium' | 'high';
  /** Issue tags */
  tags: string[];
  /** Rule that detected the issue */
  rule?: string;
  /** Suggested fixes */
  suggestions?: string[];
  /** External references */
  references?: string[];
}

/**
 * Code duplication representation
 */
export interface AnalysisDuplicate {
  /** Unique identifier */
  id: string;
  /** Duplication type */
  type: 'structural' | 'exact' | 'similar' | 'semantic';
  /** Severity level */
  severity: SeverityLevel;
  /** Similarity percentage (0-100) */
  similarity: number;
  /** Duplicate occurrences */
  occurrences: Array<{
    path: string;
    startLine: number;
    endLine: number;
    content: string;
    context?: string;
  }>;
  /** Total lines count */
  linesCount: number;
  /** Tokens count */
  tokensCount: number;
  /** Refactoring recommendation */
  recommendation: string;
  /** Effort to fix */
  effort: 'low' | 'medium' | 'high';
  /** Impact of fixing */
  impact: 'low' | 'medium' | 'high';
}

/**
 * Circular dependency representation
 */
export interface CircularDependency {
  /** Unique identifier */
  id: string;
  /** Dependency cycle */
  cycle: string[];
  /** Severity level */
  severity: SeverityLevel;
  /** Human-readable description */
  description: string;
  /** Impact assessment */
  impact: string;
  /** Recommendation to resolve */
  recommendation: string;
  /** Cycle depth */
  depth?: number;
  /** Suggested breakpoints */
  breakpoints?: Array<{
    from: string;
    to: string;
    reason: string;
    effort: 'low' | 'medium' | 'high';
  }>;
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  /** Graph nodes */
  nodes: DependencyNode[];
  /** Graph edges */
  edges: DependencyEdge[];
  /** Detected cycles */
  cycles: string[][];
  /** Orphaned nodes */
  orphans: string[];
  /** Graph statistics */
  stats?: {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    averageDegree: number;
  };
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  /** Node identifier */
  id: string;
  /** Display name */
  name: string;
  /** Dependency type */
  type: 'internal' | 'external' | 'system' | 'dev' | 'peer';
  /** Node size (for visualization) */
  size: number;
  /** Complexity metric */
  complexity: number;
  /** Import count */
  imports: number;
  /** Export count */
  exports: number;
  /** Node metadata */
  metadata?: Record<string, any>;
}

/**
 * Dependency graph edge
 */
export interface DependencyEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Dependency type */
  type: 'import' | 'require' | 'dynamic' | 'inheritance' | 'composition';
  /** Edge weight */
  weight: number;
  /** Edge metadata */
  metadata?: Record<string, any>;
}

/**
 * Analysis recommendation
 */
export interface AnalysisRecommendation {
  /** Unique identifier */
  id: string;
  /** Recommendation title */
  title: string;
  /** Detailed description */
  description: string;
  /** Recommendation type */
  type: string;
  /** Priority level */
  priority: PriorityLevel;
  /** Category */
  category: 'Security' | 'Performance' | 'Maintainability' | 'Reliability' | 'Architecture' | 'Testing';
  /** Impact assessment */
  impact: string;
  /** Estimated effort */
  estimatedEffort: string;
  /** Implementation suggestion */
  suggestion?: string;
  /** Affected entities */
  entities: string[];
  /** Current status */
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  /** Assigned person */
  assignedTo?: string;
  /** Due date */
  dueDate?: string;
  /** Dependencies */
  dependencies: string[];
  /** Auto-fix availability */
  autoFixAvailable: boolean;
  /** Quick fix options */
  quickFix?: {
    available: boolean;
    action: string;
    description: string;
    estimatedTime: string;
  };
}

/**
 * Complete analysis data structure
 */
export interface AnalysisData {
  /** Analysis identifier */
  id: string;
  /** Analysis timestamp */
  timestamp: string;
  /** Analysis version */
  version: string;
  /** Analysis summary */
  summary: DashboardSummary;
  /** Analyzed entities */
  entities: AnalysisEntity[];
  /** Detected duplicates */
  duplicates: AnalysisDuplicate[];
  /** Analysis recommendations */
  recommendations: AnalysisRecommendation[];
  /** Dependency graph */
  dependencies: DependencyGraph;
  /** Project metrics */
  metrics: ProjectMetrics;
  /** All issues */
  issues: AnalysisIssue[];
  /** Circular dependencies */
  circularDependencies?: CircularDependency[];
  /** Analysis metadata */
  metadata?: {
    version: string;
    generator: string;
    configuration: Record<string, unknown>;
    projectInfo: {
      name: string;
      path: string;
      language: string;
      framework?: string;
      packageManager?: string;
    };
  };
}

/**
 * Dashboard summary statistics
 */
export interface DashboardSummary {
  /** Total files analyzed */
  totalFiles: number;
  /** Total entities found */
  totalEntities: number;
  /** Total lines of code */
  totalLines: number;
  /** Duplicate clusters count */
  duplicateClusters: number;
  /** Circular dependencies count */
  circularDependencies: number;
  /** Unused exports count */
  unusedExports: number;
  /** Code smells count */
  codeSmells: number;
  /** Bugs count */
  bugs: number;
  /** Vulnerabilities count */
  vulnerabilities: number;
  /** Technical debt in hours */
  technicalDebtHours: number;
  /** Maintainability index (0-100) */
  maintainabilityIndex: number;
  /** Test coverage percentage */
  testCoverage: number;
  /** Last analysis timestamp */
  lastAnalysis: string;
}

/**
 * Project metrics collection
 */
export interface ProjectMetrics {
  /** Complexity metrics */
  complexity: {
    average: number;
    median: number;
    max: number;
    distribution: Record<string, number>;
  };
  /** Size metrics */
  size: {
    totalLines: number;
    codeLines: number;
    commentLines: number;
    blankLines: number;
  };
  /** Quality metrics */
  quality: {
    maintainabilityIndex: number;
    testability: number;
    reusability: number;
    reliability: number;
  };
  /** Technical debt metrics */
  debt: {
    totalHours: number;
    breakdown: Record<string, number>;
    trend: 'improving' | 'stable' | 'worsening';
  };
}

// =============================================================================
// PERFORMANCE TYPES
// =============================================================================

/**
 * Performance metrics data
 */
export interface PerformanceMetrics {
  /** Metric timestamp */
  timestamp: string;
  /** Build time in milliseconds */
  buildTime: number;
  /** Bundle size in bytes */
  bundleSize: number;
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Load time in milliseconds */
  loadTime: number;
  /** Test duration in milliseconds */
  testDuration?: number;
  /** Cache hit rate percentage */
  cacheHitRate?: number;
  /** Error rate percentage */
  errorRate: number;
  /** Throughput (requests/sec) */
  throughput?: number;
  /** Response time percentiles */
  responseTime?: {
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * Quality metrics data
 */
export interface QualityMetrics {
  /** Metric timestamp */
  timestamp: string;
  /** Code complexity score */
  codeComplexity: number;
  /** Test coverage percentage */
  testCoverage: number;
  /** Duplicate lines count */
  duplicateLines: number;
  /** Maintainability index */
  maintainabilityIndex: number;
  /** Technical debt hours */
  technicalDebt: number;
  /** Code smells count */
  codeSmells: number;
  /** Bugs count */
  bugs: number;
  /** Vulnerabilities count */
  vulnerabilities: number;
  /** Lines of code */
  linesOfCode: number;
}

/**
 * Git activity metrics
 */
export interface GitActivity {
  /** Activity timestamp */
  timestamp: string;
  /** Commits count */
  commits: number;
  /** Lines added */
  additions: number;
  /** Lines deleted */
  deletions: number;
  /** Files changed */
  files: number;
  /** Contributors count */
  contributors: number;
  /** Branches count */
  branches: number;
  /** Pull requests count */
  pullRequests: number;
  /** Issues count */
  issues: number;
}

// =============================================================================
// REPORT TYPES
// =============================================================================

/**
 * Report definition
 */
export interface Report {
  /** Report identifier */
  id: string;
  /** Report name */
  name: string;
  /** Report type */
  type: ReportType;
  /** Current status */
  status: ReportStatus;
  /** Creation date */
  createdAt: Date;
  /** Last update date */
  updatedAt: Date;
  /** Completion date */
  completedAt?: Date;
  /** Creator identifier */
  createdBy: string;
  /** Report description */
  description?: string;
  /** Report tags */
  tags: string[];
  /** Report size in bytes */
  size?: number;
  /** Generation duration in milliseconds */
  duration?: number;
  /** Report metadata */
  metadata: ReportMetadata;
  /** Scheduling configuration */
  schedule?: ReportSchedule;
}

/**
 * Report types enumeration
 */
export type ReportType = 
  | 'migration-analysis'
  | 'dependency-analysis'
  | 'code-quality'
  | 'performance-analysis'
  | 'security-audit'
  | 'compliance-report'
  | 'custom'
  | 'technical-debt'
  | 'test-coverage'
  | 'architecture-review';

/**
 * Report status enumeration
 */
export type ReportStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled'
  | 'expired';

/**
 * Report metadata
 */
export interface ReportMetadata {
  /** Report parameters */
  parameters: Record<string, any>;
  /** Included modules */
  includedModules?: string[];
  /** Excluded paths */
  excludedPaths?: string[];
  /** Applied filters */
  filters?: ReportFilters;
  /** Output formats */
  outputFormat: ExportFormat[];
  /** Analysis engine used */
  analysisEngine?: string;
  /** Processing time in milliseconds */
  processingTime?: number;
  /** Data source */
  dataSource?: string;
  /** Report version */
  version?: string;
}

/**
 * Report filters configuration
 */
export interface ReportFilters {
  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Severity levels filter */
  severity?: SeverityLevel[];
  /** Categories filter */
  categories?: string[];
  /** Authors filter */
  authors?: string[];
  /** File types filter */
  fileTypes?: string[];
  /** Tags filter */
  tags?: string[];
}

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html' | 'markdown' | 'docx' | 'xml';

/**
 * Report template definition
 */
export interface ReportTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Report type */
  type: ReportType;
  /** Template category */
  category: 'standard' | 'custom' | 'enterprise';
  /** Template parameters */
  parameters: ReportParameter[];
  /** Report sections */
  sections?: ReportSection[];
  /** Styling configuration */
  styling?: ReportStyling;
  /** Default filters */
  defaultFilters?: ReportFilters;
  /** Required permissions */
  requiredPermissions?: string[];
  /** Estimated duration */
  estimatedDuration?: number;
  /** Sample outputs */
  sampleOutputs?: string[];
}

/**
 * Report parameter definition
 */
export interface ReportParameter {
  /** Parameter key */
  key: string;
  /** Display label */
  label: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'date' | 'daterange' | 'file' | 'color';
  /** Whether required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Options for select types */
  options?: Array<{ value: any; label: string }>;
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => boolean | string;
  };
  /** Parameter description */
  description?: string;
  /** Help text */
  helpText?: string;
}

/**
 * Report section definition
 */
export interface ReportSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Section content */
  content: ReportSectionContent[];
  /** Section charts */
  charts?: ReportChart[];
  /** Section tables */
  tables?: ReportTable[];
  /** Display order */
  order: number;
  /** Whether enabled */
  enabled?: boolean;
}

/**
 * Report section content
 */
export interface ReportSectionContent {
  /** Content type */
  type: 'text' | 'list' | 'code' | 'markdown' | 'callout' | 'metrics-grid' | 'image' | 'table';
  /** Content data */
  content: string | string[] | Record<string, any>;
  /** Programming language for code blocks */
  language?: string;
  /** Callout level */
  level?: 'info' | 'warning' | 'error' | 'success';
  /** Additional styling */
  style?: Record<string, any>;
}

/**
 * Report chart configuration
 */
export interface ReportChart {
  /** Chart identifier */
  id: string;
  /** Chart title */
  title: string;
  /** Chart type */
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area' | 'treemap' | 'sankey';
  /** Chart data */
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
  /** Chart options */
  options?: Record<string, any>;
}

/**
 * Report table configuration
 */
export interface ReportTable {
  /** Table identifier */
  id: string;
  /** Table title */
  title: string;
  /** Table columns */
  columns: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'badge' | 'progress' | 'link' | 'code' | 'date' | 'boolean';
    sortable?: boolean;
    filterable?: boolean;
    width?: string;
  }>;
  /** Table rows */
  rows: Record<string, any>[];
  /** Pagination settings */
  pagination?: {
    pageSize: number;
    currentPage: number;
    totalPages: number;
  };
}

/**
 * Report styling configuration
 */
export interface ReportStyling {
  /** Theme name */
  theme: string;
  /** Color scheme */
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    text: string;
  };
  /** Font configuration */
  fonts: {
    heading: string;
    body: string;
    code: string;
  };
  /** Layout settings */
  layout?: {
    margins: string;
    spacing: string;
    borderRadius: string;
  };
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * General application settings
 */
export interface GeneralSettings {
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Language preference */
  language: string;
  /** Auto-save enabled */
  autoSave: boolean;
  /** Notifications enabled */
  notifications: boolean;
  /** Compact mode enabled */
  compactMode: boolean;
  /** Sidebar collapsed */
  sidebarCollapsed: boolean;
  /** Default time zone */
  timezone?: string;
  /** Date format preference */
  dateFormat?: string;
  /** Number format preference */
  numberFormat?: string;
}

/**
 * Analysis configuration settings
 */
export interface AnalysisSettings {
  /** Patterns to ignore during analysis */
  patternsToIgnore: string[];
  /** Duplicate detection threshold */
  duplicateThreshold: number;
  /** Complexity threshold */
  complexityThreshold: number;
  /** Minimum file size to analyze */
  minFileSize: number;
  /** Directories to exclude */
  excludeDirectories: string[];
  /** File types to include */
  includeFileTypes: string[];
  /** Smart analysis enabled */
  enableSmartAnalysis: boolean;
  /** Analysis depth level */
  analysisDepth: 'shallow' | 'medium' | 'deep';
  /** Maximum analysis time */
  maxAnalysisTime?: number;
  /** Enable parallel processing */
  enableParallelProcessing?: boolean;
  /** Custom rules */
  customRules?: Array<{
    id: string;
    name: string;
    pattern: string;
    severity: SeverityLevel;
  }>;
}

/**
 * Integration settings
 */
export interface IntegrationSettings {
  /** Webhook URLs */
  webhookUrls: {
    onAnalysisComplete: string;
    onReportGenerated: string;
    onError: string;
  };
  /** API keys */
  apiKeys: {
    github: string;
    slack: string;
    jira: string;
    sonarqube?: string;
  };
  /** Automation settings */
  automations: {
    autoUpload: boolean;
    scheduleAnalysis: boolean;
    notifyOnCompletion: boolean;
    autoGenerateReports?: boolean;
  };
  /** External tool configurations */
  externalTools?: Record<string, any>;
}

/**
 * Export settings
 */
export interface ExportSettings {
  /** Default export formats */
  defaultFormats: ExportFormat[];
  /** Default export path */
  defaultPath: string;
  /** Include metadata in exports */
  includeMetadata: boolean;
  /** Enable compression */
  compressionEnabled: boolean;
  /** Add timestamp to filenames */
  timestampFiles: boolean;
  /** Maximum file size for exports */
  maxFileSize: number;
  /** Encryption settings */
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keySize: number;
  };
}

/**
 * Complete configuration state
 */
export interface ConfigurationState {
  /** General settings */
  general: GeneralSettings;
  /** Analysis settings */
  analysis: AnalysisSettings;
  /** Integration settings */
  integration: IntegrationSettings;
  /** Export settings */
  export: ExportSettings;
}

/**
 * Configuration template
 */
export interface ConfigTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Partial configuration */
  config: Partial<ConfigurationState>;
  /** Template tags */
  tags: string[];
  /** Template version */
  version?: string;
  /** Template author */
  author?: string;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

/**
 * Base component props
 */
export interface BaseComponentProps {
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Children elements */
  children?: ReactNode;
  /** Test ID for testing */
  testId?: string;
  /** Whether component is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
}

/**
 * Summary card component props
 */
export interface SummaryCardProps extends BaseComponentProps {
  /** Card title */
  title: string;
  /** Card value */
  value: string | number;
  /** Card icon */
  icon: LucideIcon;
  /** Optional description */
  description?: string;
  /** Card variant */
  variant?: 'default' | 'critical' | 'warning' | 'info' | 'success';
  /** Click handler */
  onClick?: () => void;
  /** Trend indicator */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    label?: string;
  };
}

/**
 * Chart component props
 */
export interface ChartProps extends BaseComponentProps {
  /** Chart data */
  data: any;
  /** Chart type */
  type?: string;
  /** Chart options */
  options?: Record<string, any>;
  /** Chart width */
  width?: number;
  /** Chart height */
  height?: number;
  /** Error handler */
  onError?: (error: Error) => void;
}

/**
 * Table component props
 */
export interface TableProps<T = any> extends BaseComponentProps {
  /** Table data */
  data: T[];
  /** Table columns */
  columns: Array<{
    key: keyof T;
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (value: any, item: T) => ReactNode;
  }>;
  /** Sort configuration */
  sortConfig?: {
    key: keyof T;
    direction: 'asc' | 'desc';
  };
  /** Sort change handler */
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Pagination configuration */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

/**
 * Modal component props
 */
export interface ModalProps extends BaseComponentProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether modal can be closed by clicking overlay */
  closeOnOverlayClick?: boolean;
  /** Whether modal can be closed by pressing escape */
  closeOnEscape?: boolean;
  /** Footer content */
  footer?: ReactNode;
}

/**
 * Form field component props
 */
export interface FormFieldProps extends BaseComponentProps {
  /** Field label */
  label?: string;
  /** Field name */
  name: string;
  /** Field type */
  type?: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'radio';
  /** Field value */
  value?: any;
  /** Change handler */
  onChange?: (value: any) => void;
  /** Field placeholder */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Help text */
  helpText?: string;
  /** Field options (for select/radio) */
  options?: Array<{ value: any; label: string }>;
}

// =============================================================================
// BATCH PROCESSING TYPES
// =============================================================================

/**
 * Batch job configuration
 */
export interface BatchJob {
  /** Job identifier */
  id: string;
  /** Job name */
  name: string;
  /** Job description */
  description: string;
  /** Current status */
  status: StatusType;
  /** Progress percentage */
  progress: number;
  /** Creation date */
  createdAt: Date;
  /** Start date */
  startedAt?: Date;
  /** Completion date */
  completedAt?: Date;
  /** Template IDs to process */
  templateIds: string[];
  /** Consolidation type */
  consolidationType: 'merge' | 'replace' | 'archive';
  /** Job priority */
  priority: PriorityLevel;
  /** Estimated duration */
  estimatedDuration: number;
  /** Actual duration */
  actualDuration?: number;
  /** Error messages */
  errors: string[];
  /** Warning messages */
  warnings: string[];
  /** Current processing stage */
  currentStage?: string;
  /** Current template being processed */
  currentTemplate?: string;
  /** Job results */
  results?: BatchResults;
  /** Execution IDs */
  executionIds: string[];
  /** Job configuration */
  config: BatchConfig;
}

/**
 * Batch processing results
 */
export interface BatchResults {
  /** Templates processed count */
  templatesProcessed: number;
  /** Duplicates removed count */
  duplicatesRemoved: number;
  /** Conflicts resolved count */
  conflictsResolved: number;
  /** Files created count */
  filesCreated: number;
  /** Files modified count */
  filesModified: number;
  /** Whether backup was created */
  backupCreated: boolean;
  /** Processing statistics */
  statistics?: Record<string, number>;
}

/**
 * Batch job configuration
 */
export interface BatchConfig {
  /** Backup strategy */
  backupStrategy: 'auto' | 'manual' | 'none';
  /** Conflict resolution strategy */
  conflictResolution: 'interactive' | 'auto' | 'skip';
  /** Maximum concurrent jobs */
  maxConcurrentJobs?: number;
  /** Retry attempts */
  retryAttempts?: number;
  /** Timeout per template */
  timeoutPerTemplate?: number;
  /** Rollback on failure */
  rollbackOnFailure?: boolean;
}

// =============================================================================
// WEBSOCKET & REALTIME TYPES
// =============================================================================

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  /** Message type */
  type: 'subscribe' | 'unsubscribe' | 'data' | 'error' | 'ping' | 'pong' | 'auth';
  /** Channel name */
  channel?: string;
  /** Message payload */
  payload?: any;
  /** Message timestamp */
  timestamp: string;
  /** Message ID */
  id?: string;
}

/**
 * Real-time update structure
 */
export interface RealtimeUpdate<T = any> {
  /** Update type */
  type: 'performance' | 'quality' | 'git' | 'analysis' | 'batch' | 'report';
  /** Update data */
  data: T;
  /** Update timestamp */
  timestamp: string;
  /** Source identifier */
  source?: string;
}

/**
 * Data fetch options
 */
export interface DataFetchOptions {
  /** Time range filter */
  timeRange?: TimeRange;
  /** Enable real-time updates */
  realtime?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Whether to use cache */
  useCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

// =============================================================================
// SCRIPT & EXECUTION TYPES
// =============================================================================

/**
 * Script definition
 */
export interface Script {
  /** Script identifier */
  id: string;
  /** Script name */
  name: string;
  /** Script description */
  description: string;
  /** Script content */
  content: string;
  /** Script language */
  language: 'bash' | 'python' | 'nodejs' | 'powershell';
  /** Script parameters */
  parameters: ScriptParameter[];
  /** Script tags */
  tags: string[];
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  updatedAt: Date;
  /** Script version */
  version: string;
  /** Script author */
  author?: string;
}

/**
 * Script parameter definition
 */
export interface ScriptParameter {
  /** Parameter name */
  name: string;
  /** Parameter label */
  label: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'file' | 'select';
  /** Whether required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Parameter description */
  description?: string;
  /** Validation rules */
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

/**
 * Script execution result
 */
export interface ScriptExecution {
  /** Execution identifier */
  id: string;
  /** Script identifier */
  scriptId: string;
  /** Execution status */
  status: StatusType;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime?: Date;
  /** Execution duration */
  duration?: number;
  /** Standard output */
  stdout?: string;
  /** Standard error */
  stderr?: string;
  /** Exit code */
  exitCode?: number;
  /** Execution parameters */
  parameters: Record<string, any>;
  /** Error message */
  error?: string;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Template definition
 */
export interface Template {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template category */
  category: string;
  /** Template content */
  content: string;
  /** Template variables */
  variables: TemplateVariable[];
  /** Template tags */
  tags: string[];
  /** Creation date */
  createdAt: Date;
  /** Last modified date */
  updatedAt: Date;
  /** Template version */
  version: string;
  /** Template author */
  author?: string;
  /** Template preview */
  preview?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable label */
  label: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  /** Whether required */
  required: boolean;
  /** Default value */
  defaultValue?: any;
  /** Variable description */
  description?: string;
  /** Variable options (for select types) */
  options?: Array<{ value: any; label: string }>;
}

// =============================================================================
// EXPORT ALL TYPES
// =============================================================================

// Re-export all types for convenience
export * from './data';
export * from './reports';
export * from './config';

// Additional utility types
export type { LucideIcon } from 'lucide-react';
export type { ReactNode, ReactElement } from 'react';

// Default export for main types
export default {
  // Core types
  ApiResponse,
  ErrorState,
  LoadingState,
  CacheEntry,
  
  // File system
  FileInfo,
  FileOperations,
  FileUpload,
  
  // Analysis
  AnalysisEntity,
  AnalysisIssue,
  AnalysisDuplicate,
  CircularDependency,
  AnalysisData,
  DashboardSummary,
  
  // Performance
  PerformanceMetrics,
  QualityMetrics,
  GitActivity,
  
  // Reports
  Report,
  ReportTemplate,
  ReportSection,
  
  // Configuration
  ConfigurationState,
  GeneralSettings,
  AnalysisSettings,
  
  // Components
  SummaryCardProps,
  ChartProps,
  TableProps,
  ModalProps,
  FormFieldProps,
  
  // Batch processing
  BatchJob,
  BatchResults,
  BatchConfig,
  
  // WebSocket
  WebSocketMessage,
  RealtimeUpdate,
  
  // Scripts
  Script,
  ScriptExecution,
  ScriptParameter,
  
  // Templates
  Template,
  TemplateVariable,
};