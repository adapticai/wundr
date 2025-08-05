// Report data structure interfaces
export interface AnalysisReport {
  id: string;
  timestamp: string;
  projectName: string;
  version: string;
  summary: ReportSummary;
  duplicates: DuplicateAnalysis;
  dependencies: DependencyAnalysis;
  circularDependencies: CircularDependency[];
  metrics: ProjectMetrics;
  packages: PackageInfo[];
}

export interface ReportSummary {
  totalFiles: number;
  totalPackages: number;
  duplicateCount: number;
  circularDependencyCount: number;
  codebaseSize: number;
  testCoverage?: number;
}

export interface DuplicateAnalysis {
  totalDuplicates: number;
  duplicatesByType: Record<string, number>;
  duplicateFiles: DuplicateFile[];
  similarityThreshold: number;
}

export interface DuplicateFile {
  id: string;
  path: string;
  size: number;
  type: string;
  similarFiles: SimilarFile[];
  duplicateScore: number;
}

export interface SimilarFile {
  path: string;
  similarity: number;
  lineCount: number;
}

export interface DependencyAnalysis {
  totalDependencies: number;
  directDependencies: number;
  devDependencies: number;
  peerDependencies: number;
  dependencyTree: DependencyNode[];
  vulnerabilities: Vulnerability[];
}

export interface DependencyNode {
  name: string;
  version: string;
  type: 'direct' | 'dev' | 'peer' | 'transitive';
  dependencies: DependencyNode[];
  size?: number;
  lastUpdated?: string;
}

export interface CircularDependency {
  id: string;
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
  impactScore: number;
  affectedFiles: string[];
}

export interface ProjectMetrics {
  codeQuality: CodeQualityMetrics;
  performance: PerformanceMetrics;
  maintainability: MaintainabilityMetrics;
  complexity: ComplexityMetrics;
}

export interface CodeQualityMetrics {
  linesOfCode: number;
  technicalDebt: number;
  codeSmells: number;
  duplicateLines: number;
  testCoverage: number;
}

export interface PerformanceMetrics {
  buildTime: number;
  bundleSize: number;
  loadTime: number;
  memoryUsage: number;
}

export interface MaintainabilityMetrics {
  maintainabilityIndex: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  afferentCoupling: number;
  efferentCoupling: number;
}

export interface ComplexityMetrics {
  averageComplexity: number;
  maxComplexity: number;
  complexityDistribution: Record<string, number>;
}

export interface PackageInfo {
  name: string;
  version: string;
  path: string;
  size: number;
  files: number;
  dependencies: string[];
  lastModified: string;
}

export interface Vulnerability {
  id: string;
  package: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  patchedVersions: string[];
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[] | { x: number; y: number }[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
}

export interface ExportOptions {
  format: 'png' | 'pdf' | 'csv' | 'json';
  filename?: string;
  includeData?: boolean;
}