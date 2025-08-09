/**
 * Core types and interfaces for the Analysis Engine
 */

export interface EntityInfo {
  id: string;
  name: string;
  type: EntityType;
  file: string;
  startLine: number; // Changed from line for consistency
  endLine?: number; // Add end line
  line: number; // Keep for compatibility
  column: number;
  exportType: ExportType;
  signature?: string;
  normalizedHash?: string;
  semanticHash?: string;
  jsDoc?: string; // Make optional
  complexity?: ComplexityMetrics;
  dependencies: string[];
  members?: EntityMembers;
  metadata?: Record<string, any>;
}

export type EntityType = 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'enum' 
  | 'function' 
  | 'method'
  | 'const' 
  | 'variable'
  | 'service'
  | 'component'
  | 'hook'
  | 'utility'
  | 'comment'
  | 'whitespace';

export type ExportType = 'default' | 'named' | 'none';

export interface EntityMembers {
  properties?: Array<{
    name: string;
    type: string;
    optional: boolean;
    visibility?: 'public' | 'private' | 'protected';
  }>;
  methods?: Array<{
    name: string;
    signature: string;
    complexity?: number;
    visibility?: 'public' | 'private' | 'protected';
  }>;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  maintainability?: number;
  depth?: number;
  parameters?: number;
  lines?: number;
  halstead?: {
    operators: number;
    operands: number;
    vocabulary: number;
    length: number;
    volume: number;
    difficulty: number;
    effort: number;
  };
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  peakUsage: number;
  gcEvents: number;
  objectPoolHits: number;
  objectPoolMisses: number;
}

export interface ConcurrencyStats {
  tasksCompleted: number;
  tasksQueued: number;
  averageTaskTime: number;
  currentConcurrency: number;
  backpressureEvents: number;
}

export interface DuplicateCluster {
  id: string;
  hash: string;
  type: EntityType;
  severity: SeverityLevel;
  entities: EntityInfo[];
  structuralMatch: boolean;
  semanticMatch: boolean;
  similarity: number;
  consolidationSuggestion?: ConsolidationSuggestion;
}

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ConsolidationSuggestion {
  strategy: 'merge' | 'extract' | 'refactor';
  targetFile: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: string;
  steps: string[];
}

export interface CircularDependency {
  id: string;
  cycle: string[];
  severity: SeverityLevel;
  depth: number;
  files: string[];
  suggestions: string[];
  source?: string;
  weight?: number;
  impact?: any;
  breakPoints?: any[];
  relatedCycles?: string[];
}

export interface CodeSmell {
  id: string;
  type: CodeSmellType;
  severity: SeverityLevel;
  file: string;
  line: number;
  message: string;
  suggestion: string;
  entity?: EntityInfo;
}

export type CodeSmellType =
  | 'long-method'
  | 'large-class'
  | 'duplicate-code'
  | 'dead-code'
  | 'complex-conditional'
  | 'feature-envy'
  | 'inappropriate-intimacy'
  | 'god-object'
  | 'wrapper-pattern'
  | 'deep-nesting'
  | 'long-parameter-list';

export interface AnalysisReport {
  id: string;
  timestamp: string;
  version: string;
  targetDir: string;
  config: AnalysisConfig;
  summary: AnalysisSummary;
  entities: EntityInfo[];
  duplicates: DuplicateCluster[];
  circularDependencies: CircularDependency[];
  unusedExports: EntityInfo[];
  codeSmells: CodeSmell[];
  recommendations: Recommendation[];
  performance: PerformanceMetrics;
  visualizations?: VisualizationData;
}

export interface AnalysisSummary {
  totalFiles: number;
  totalEntities: number;
  duplicateClusters: number;
  circularDependencies: number;
  unusedExports: number;
  codeSmells: number;
  averageComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: {
    score: number;
    estimatedHours: number;
  };
}

export interface AnalysisConfig {
  targetDir: string;
  excludeDirs: string[];
  includePatterns: string[];
  excludePatterns: string[];
  includeTests: boolean;
  enableAIAnalysis: boolean;
  outputFormats: OutputFormat[];
  performance: {
    maxConcurrency: number;
    chunkSize: number;
    enableCaching: boolean;
  };
  thresholds: {
    complexity: {
      cyclomatic: number;
      cognitive: number;
    };
    duplicates: {
      minSimilarity: number;
    };
    fileSize: {
      maxLines: number;
    };
  };
  // Memory optimization settings
  useOptimizations?: boolean; // Enable memory optimizations
  maxMemoryUsage?: number; // Memory limit in bytes
  enableStreaming?: boolean; // Enable streaming for large datasets
}

export type OutputFormat = 'json' | 'html' | 'markdown' | 'csv' | 'xml';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  entities?: EntityInfo[];
  steps?: string[];
  codeExample?: string;
  estimatedTimeHours?: number;
}

export type RecommendationType =
  | 'MERGE_DUPLICATES'
  | 'REMOVE_DEAD_CODE'
  | 'REFACTOR_WRAPPER'
  | 'BREAK_CIRCULAR_DEPS'
  | 'REDUCE_COMPLEXITY'
  | 'EXTRACT_METHOD'
  | 'CONSOLIDATE_INTERFACES'
  | 'OPTIMIZE_IMPORTS';

export interface PerformanceMetrics {
  analysisTime: number;
  filesPerSecond: number;
  entitiesPerSecond: number;
  memoryUsage: {
    peak: number;
    average: number;
  };
  cacheHits: number;
  cacheSize: number;
  // Additional optimization metrics
  workerMetrics?: any;
  streamingMetrics?: any;
  memoryEfficiency?: number;
}

export interface VisualizationData {
  dependencyGraph: {
    nodes: Array<{
      id: string;
      label: string;
      type: EntityType;
      file: string;
      complexity?: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      type: 'import' | 'extends' | 'implements' | 'uses';
    }>;
  };
  duplicateNetworks: Array<{
    clusterId: string;
    nodes: Array<{
      id: string;
      label: string;
      file: string;
      similarity: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      similarity: number;
    }>;
  }>;
  complexityHeatmap: Array<{
    file: string;
    complexity: number;
    entities: Array<{
      name: string;
      complexity: number;
      line: number;
    }>;
  }>;
}

export interface ServiceConfig {
  name: string;
  version: string;
  outputDir?: string;
  verbose?: boolean;
}

export interface AnalysisEngine {
  analyze(): Promise<AnalysisReport>;
  analyzeFiles(files: string[]): Promise<AnalysisReport>;
  getConfig(): AnalysisConfig;
  setConfig(config: Partial<AnalysisConfig>): void;
}

export interface BaseAnalyzer<T = any> {
  name: string;
  version: string;
  analyze(entities: EntityInfo[], config: AnalysisConfig): Promise<T>;
}

// Event types for progress tracking
export interface AnalysisProgressEvent {
  type: 'progress' | 'phase' | 'complete' | 'error';
  phase?: string;
  progress?: number;
  total?: number;
  message?: string;
  error?: Error;
}

export type AnalysisProgressCallback = (event: AnalysisProgressEvent) => void;