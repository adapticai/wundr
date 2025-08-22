/**
 * @fileoverview Analysis engine package entry point
 * Provides comprehensive code analysis and quality metrics engine.
 */

export * from './metrics';
export * from './analyzers';
export * from './reporters';

// Optimized modules
export * from './analyzers/BaseAnalysisServiceOptimizations';
export * from './engines/DuplicateDetectionEngineSimple';
export * from './streaming/StreamingFileProcessorSimple';
export * from './monitoring/MemoryMonitorSimple';
export * from './optimization/PerformanceBenchmarkSuiteSimple';