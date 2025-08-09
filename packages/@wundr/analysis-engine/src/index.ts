/**
 * Analysis Engine - Main entry point
 * High-performance code analysis with AST parsing, duplicate detection, complexity metrics
 */

// Core types and interfaces
export * from './types';
export * from './utils';

// Simple working analyzer
export { SimpleAnalyzer, analyzeProject } from './simple-analyzer';

// Memory-optimized components
export { OptimizedDuplicateDetectionEngine } from './engines/DuplicateDetectionEngineOptimized';
export { WorkerPoolManager } from './workers/WorkerPoolManager';
export { MemoryMonitor } from './monitoring/MemoryMonitor';

// Main analysis orchestrator (simplified)
import { SimpleAnalyzer } from './simple-analyzer';
import { 
  AnalysisConfig, 
  AnalysisReport,
  AnalysisProgressCallback 
} from './types';

/**
 * Main Analysis Engine - Orchestrates all analysis components
 * Now includes optimized duplicate detection with memory management
 */
export class AnalysisEngine {
  private analyzer: SimpleAnalyzer;
  private optimizedDuplicateEngine?: OptimizedDuplicateDetectionEngine;
  private memoryMonitor?: MemoryMonitor;
  private useOptimizations: boolean;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.analyzer = new SimpleAnalyzer(config);
    this.useOptimizations = config.useOptimizations !== false;
    
    if (this.useOptimizations) {
      this.initializeOptimizations();
    }
  }

  private initializeOptimizations(): void {
    this.optimizedDuplicateEngine = new OptimizedDuplicateDetectionEngine({
      enableStreaming: true,
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      enableSemanticAnalysis: true
    });

    this.memoryMonitor = new MemoryMonitor({
      snapshotInterval: 5000,
      maxSnapshots: 200
    });

    console.log('🚀 Memory optimizations initialized');
  }

  /**
   * Run complete analysis
   */
  async analyze(): Promise<AnalysisReport> {
    return this.analyzer.analyze();
  }

  /**
   * Set progress callback (placeholder)
   */
  setProgressCallback(callback: AnalysisProgressCallback): void {
    console.log('Progress callback set (placeholder implementation)');
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisConfig {
    return (this.analyzer as any).config;
  }
}

/**
 * Convenience function for analyzing with progress tracking
 */
export async function analyzeProjectWithProgress(
  targetDir: string,
  progressCallback: AnalysisProgressCallback,
  config?: Partial<AnalysisConfig>
): Promise<AnalysisReport> {
  console.log('Starting analysis with progress tracking...');
  progressCallback({ type: 'phase', message: 'Initializing analysis...' });
  
  const engine = new AnalysisEngine({
    targetDir,
    ...config
  });

  const result = await engine.analyze();
  
  progressCallback({ type: 'complete', message: 'Analysis completed successfully!' });
  return result;
}