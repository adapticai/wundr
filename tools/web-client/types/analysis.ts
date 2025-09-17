/**
 * Analysis Component Type Definitions
 *
 * Specific type definitions for analysis components including package analysis,
 * dependency charts, and security vulnerability reports to replace all 'any' types.
 *
 * @version 1.0.0
 * @author Wundr Development Team
 */

// =============================================================================
// PACKAGE ANALYSIS TYPES
// =============================================================================

/**
 * Package information for analysis components
 */
export interface PackageInfo {
  /** Package name */
  name: string;
  /** Package version */
  version: string;
  /** Package description */
  description?: string;
  /** Package author */
  author?: string;
  /** Package license */
  license?: string;
  /** Package homepage */
  homepage?: string;
  /** Package repository */
  repository?: string;
  /** Package size in bytes */
  size: number;
  /** Package dependencies */
  dependencies: string[];
  /** Package dev dependencies */
  devDependencies?: string[];
  /** Package peer dependencies */
  peerDependencies?: string[];
  /** Last published date */
  publishedDate: Date;
  /** Download statistics */
  downloads: {
    /** Daily downloads */
    daily: number;
    /** Weekly downloads */
    weekly: number;
    /** Monthly downloads */
    monthly: number;
    /** Total downloads */
    total: number;
  };
  /** Package vulnerability information */
  vulnerabilities?: VulnerabilityInfo[];
  /** Package deprecation status */
  deprecated?: boolean;
  /** Package maintenance status */
  maintenance?: 'active' | 'maintained' | 'deprecated' | 'unmaintained';
}

/**
 * Enriched package information with analysis data
 */
export interface EnrichedPackageInfo extends PackageInfo {
  /** Risk score (0-100) */
  riskScore: number;
  /** Security audit results */
  securityAudit: {
    /** Audit score */
    score: number;
    /** Found vulnerabilities */
    vulnerabilities: VulnerabilityInfo[];
    /** Security recommendations */
    recommendations: string[];
    /** Last audit date */
    lastAuditDate: Date;
  };
  /** Dependency analysis */
  dependencyAnalysis: {
    /** Dependency depth */
    depth: number;
    /** Circular dependencies */
    circularDependencies: string[];
    /** Outdated dependencies */
    outdatedDependencies: string[];
    /** Duplicate dependencies */
    duplicateDependencies: string[];
  };
  /** Bundle analysis */
  bundleAnalysis: {
    /** Minified size */
    minifiedSize: number;
    /** Gzipped size */
    gzippedSize: number;
    /** Tree-shakeable */
    treeShakeable: boolean;
    /** ES modules support */
    esModules: boolean;
  };
}

/**
 * Vulnerability information
 */
export interface VulnerabilityInfo {
  /** Vulnerability identifier */
  id: string;
  /** Vulnerability title */
  title: string;
  /** Vulnerability description */
  description: string;
  /** Severity level */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** CVSS score */
  cvssScore?: number;
  /** Affected versions */
  affectedVersions: string[];
  /** Patched versions */
  patchedVersions?: string[];
  /** Vulnerability source */
  source: 'npm' | 'github' | 'snyk' | 'owasp' | 'custom';
  /** Discovery date */
  discoveredDate: Date;
  /** Publication date */
  publishedDate: Date;
  /** Fix available */
  fixAvailable: boolean;
  /** Recommended action */
  recommendedAction: string;
  /** External references */
  references: string[];
}

// =============================================================================
// DOWNLOAD STATISTICS TYPES
// =============================================================================

/**
 * Download statistics data structure
 */
export interface DownloadStats {
  [packageName: string]: {
    /** Total downloads */
    total: number;
    /** Daily downloads */
    daily: number;
    /** Weekly downloads */
    weekly: number;
    /** Monthly downloads */
    monthly: number;
    /** Historical data */
    history: Array<{
      /** Date */
      date: Date;
      /** Download count */
      downloads: number;
    }>;
    /** Growth statistics */
    growth: {
      /** Daily growth percentage */
      daily: number;
      /** Weekly growth percentage */
      weekly: number;
      /** Monthly growth percentage */
      monthly: number;
    };
    /** Ranking information */
    ranking?: {
      /** Global rank */
      global: number;
      /** Category rank */
      category: number;
      /** Language rank */
      language: number;
    };
  };
}

// =============================================================================
// CHART DATA TYPES
// =============================================================================

/**
 * Chart context type for tooltips and labels
 */
export interface ChartContext {
  /** Chart instance */
  chart: unknown;
  /** Data index */
  dataIndex: number;
  /** Dataset index */
  datasetIndex: number;
  /** Raw data value */
  raw: number;
  /** Parsed data value */
  parsed: number;
  /** Data element */
  element: unknown;
  /** Active elements */
  active: boolean;
  /** Chart mode */
  mode: string;
  /** Dataset */
  dataset: {
    data: number[];
    label?: string;
  };
  /** Label */
  label: string;
}

/**
 * Package version chart data
 */
export interface PackageVersionData {
  /** Package name */
  name: string;
  /** Current version */
  currentVersion: string;
  /** Latest version */
  latestVersion: string;
  /** Version behind count */
  versionsBehind: number;
  /** Update urgency */
  updateUrgency: 'low' | 'medium' | 'high' | 'critical';
  /** Security issues in current version */
  securityIssues: number;
  /** Breaking changes in update */
  breakingChanges: boolean;
  /** Update recommendation */
  recommendation: string;
}

/**
 * Entity type distribution data
 */
export interface EntityTypeData {
  /** Entity type */
  type: string;
  /** Count of entities */
  count: number;
  /** Percentage of total */
  percentage: number;
  /** Average complexity */
  averageComplexity: number;
  /** Color for chart display */
  color: string;
  /** Additional metadata */
  metadata?: {
    /** Description */
    description?: string;
    /** Examples */
    examples?: string[];
    /** Best practices */
    bestPractices?: string[];
  };
}

/**
 * Dependency size analysis data
 */
export interface DependencySizeData {
  /** Dependency name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Percentage of total bundle size */
  percentage: number;
  /** Size category */
  category: 'small' | 'medium' | 'large' | 'huge';
  /** Gzipped size */
  gzippedSize: number;
  /** Tree-shakeable portions */
  treeShakeable: {
    /** Used size */
    used: number;
    /** Unused size */
    unused: number;
    /** Potential savings */
    savings: number;
  };
  /** Import analysis */
  imports: {
    /** Total imports */
    total: number;
    /** Used imports */
    used: number;
    /** Unused imports */
    unused: string[];
  };
  /** Alternative suggestions */
  alternatives?: Array<{
    /** Alternative package name */
    name: string;
    /** Size comparison */
    sizeReduction: number;
    /** Feature comparison */
    featureCompatibility: number;
    /** Migration effort */
    migrationEffort: 'low' | 'medium' | 'high';
  }>;
}

// =============================================================================
// ANALYSIS COMPONENT PROPS
// =============================================================================

/**
 * Package version chart component props
 */
export interface PackageVersionChartProps {
  /** Package data */
  packages?: PackageInfo[];
  /** Chart title */
  title?: string;
  /** Chart height */
  height?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Enable interactions */
  interactive?: boolean;
  /** Update handler */
  onPackageUpdate?: (packageName: string, targetVersion: string) => void;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: string;
}

/**
 * Entity type chart component props
 */
export interface EntityTypeChartProps {
  /** Entity data */
  entities?: EntityTypeData[];
  /** Chart type */
  chartType?: 'pie' | 'doughnut' | 'bar';
  /** Chart title */
  title?: string;
  /** Chart height */
  height?: number;
  /** Color scheme */
  colorScheme?: string[];
  /** Show percentages */
  showPercentages?: boolean;
  /** Entity click handler */
  onEntityClick?: (entityType: string) => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * Security vulnerability report component props
 */
export interface SecurityVulnerabilityReportProps {
  /** Package data with vulnerabilities */
  packages?: EnrichedPackageInfo[];
  /** Severity filter */
  severityFilter?: Array<'low' | 'moderate' | 'high' | 'critical'>;
  /** Show only fixable vulnerabilities */
  fixableOnly?: boolean;
  /** Vulnerability click handler */
  onVulnerabilityClick?: (vulnerability: VulnerabilityInfo) => void;
  /** Fix vulnerability handler */
  onFixVulnerability?: (packageName: string, vulnerabilityId: string) => void;
  /** Report generation handler */
  onGenerateReport?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Auto-refresh interval */
  refreshInterval?: number;
}

/**
 * Dependency size analyzer component props
 */
export interface DependencySizeAnalyzerProps {
  /** Package data with size information */
  packages?: PackageInfo[];
  /** Size threshold for highlighting */
  sizeThreshold?: number;
  /** Show optimization suggestions */
  showOptimizations?: boolean;
  /** Bundle analyzer integration */
  bundleAnalyzer?: boolean;
  /** Size optimization handler */
  onOptimizeSize?: (packageName: string, optimization: string) => void;
  /** Alternative package handler */
  onSuggestAlternative?: (packageName: string) => void;
  /** Loading state */
  loading?: boolean;
  /** View mode */
  viewMode?: 'chart' | 'table' | 'tree';
}

/**
 * Entity export modal component props
 */
export interface EntityExportModalProps {
  /** Whether modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Entities to export */
  entities?: any[];
  /** Export format options */
  exportFormats?: Array<'json' | 'csv' | 'excel' | 'xml'>;
  /** Export filters */
  exportFilters?: {
    /** Entity types to include */
    entityTypes?: string[];
    /** Severity levels to include */
    severityLevels?: string[];
    /** Date range */
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  /** Export handler */
  onExport?: (format: string, filters: any) => void;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Analysis processing status
 */
export interface AnalysisStatus {
  /** Current status */
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  /** Progress percentage */
  progress: number;
  /** Current step */
  currentStep: string;
  /** Total steps */
  totalSteps: number;
  /** Error message */
  error?: string;
  /** Processing metadata */
  metadata?: {
    /** Start time */
    startTime: Date;
    /** Estimated completion time */
    estimatedCompletion?: Date;
    /** Packages processed */
    packagesProcessed: number;
    /** Total packages */
    totalPackages: number;
  };
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  /** Include dev dependencies */
  includeDevDependencies: boolean;
  /** Include peer dependencies */
  includePeerDependencies: boolean;
  /** Vulnerability sources to check */
  vulnerabilitySources: Array<'npm' | 'github' | 'snyk' | 'owasp'>;
  /** Security audit depth */
  securityAuditDepth: 'shallow' | 'medium' | 'deep';
  /** Bundle analysis enabled */
  bundleAnalysis: boolean;
  /** Performance analysis enabled */
  performanceAnalysis: boolean;
  /** License compliance check */
  licenseCompliance: boolean;
  /** Custom rules */
  customRules?: Array<{
    /** Rule name */
    name: string;
    /** Rule description */
    description: string;
    /** Rule pattern */
    pattern: string;
    /** Rule severity */
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

// Types are already exported as interfaces above