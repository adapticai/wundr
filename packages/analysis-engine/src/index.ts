/**
 * @fileoverview Analysis engine package entry point
 * Provides comprehensive code analysis and quality metrics engine.
 */

export * from './metrics';
export * from './analyzers';

// Optimized modules
export {
  OptimizedBaseAnalysisService,
  type OptimizedAnalysisConfig,
  type OptimizedAnalysisResult,
  type AnalysisPhaseResult,
  type DuplicateGroup as OptimizedDuplicateGroup,
  type QualityMetrics,
  type ReportData as OptimizedReportData,
} from './analyzers/BaseAnalysisServiceOptimizations';

export {
  OptimizedDuplicateDetectionEngine,
  type DuplicateGroup as DuplicateDetectionGroup,
  type DuplicateFile,
  type DetectionStats,
} from './engines/DuplicateDetectionEngineSimple';

export {
  StreamingFileProcessor,
  type StreamingConfig,
  type ProcessingResult,
} from './streaming/StreamingFileProcessorSimple';

export {
  MemoryMonitorService,
  type MemoryStats,
  type MemoryAlert,
} from './monitoring/MemoryMonitorSimple';

export {
  PerformanceBenchmarkSuite,
  type BenchmarkResult,
  type BenchmarkConfig,
} from './optimization/PerformanceBenchmarkSuiteSimple';

// Re-export reporters with specific names to avoid conflicts
export {
  SimpleHtmlReporter,
  SimpleMarkdownReporter,
  SimpleJsonReporter,
} from './reporters';