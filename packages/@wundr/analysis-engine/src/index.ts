/**
 * Analysis Engine - Main entry point
 * High-performance code analysis with AST parsing, duplicate detection, complexity metrics
 */

// Core types and interfaces
export * from './types';
export * from './utils';

// Simple working analyzer
export { SimpleAnalyzer, analyzeProject } from './simple-analyzer';

// Main analysis orchestrator (simplified)
import { SimpleAnalyzer } from './simple-analyzer';
import { 
  AnalysisConfig, 
  AnalysisReport,
  AnalysisProgressCallback 
} from './types';

/**
 * Main Analysis Engine - Orchestrates all analysis components
 */
export class AnalysisEngine {
  private analyzer: SimpleAnalyzer;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.analyzer = new SimpleAnalyzer(config);
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