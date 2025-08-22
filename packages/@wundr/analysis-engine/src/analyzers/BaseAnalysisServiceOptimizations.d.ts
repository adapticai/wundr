/**
 * BaseAnalysisService Optimizations - Memory and concurrency enhancements
 * Extends BaseAnalysisService with advanced performance optimizations
 */
import * as ts from 'typescript';
import { BaseAnalysisService } from './BaseAnalysisService';
import { EntityInfo, AnalysisConfig } from '../types';
export declare class OptimizedBaseAnalysisService extends BaseAnalysisService {
    private optimizedStreamingProcessor;
    private optimizedWorkerPool;
    private optimizedMemoryMonitor;
    private optimizedObjectPools;
    constructor(name: string, config: Partial<AnalysisConfig & any>);
    protected performAnalysis(entities: EntityInfo[]): Promise<any>;
    protected extractEntityFromNode(node: ts.Node, sourceFile: ts.SourceFile): EntityInfo | null;
    /**
     * Setup memory optimizations and object pooling
     */
    private setupOptimizedMemoryOptimizations;
    /**
     * Main analysis method with advanced memory optimization and concurrency
     */
    analyze(): Promise<any>;
    /**
     * Get target files with streaming optimization
     */
    private getOptimizedTargetFiles;
    /**
     * Filter files with streaming and memory-efficient processing
     */
    private filterFilesByCriteriaOptimized;
    /**
     * Get line count efficiently without loading entire file
     */
    private getLineCountEfficient;
    /**
     * Perform streaming analysis for large codebases
     */
    private performStreamingAnalysis;
    /**
     * Extract entities with optimized concurrent processing
     */
    private extractEntitiesOptimizedConcurrent;
    /**
     * Perform analysis with concurrent processing
     */
    private performAnalysisConcurrent;
    /**
     * Generate report with memory optimization
     */
    private generateReportOptimized;
    /**
     * Get total file size for streaming decision
     */
    private getTotalFileSize;
    /**
     * Calculate memory efficiency score
     */
    private calculateMemoryEfficiency;
    /**
     * Generate optimization recommendations
     */
    private generateOptimizationRecommendations;
    /**
     * Force cleanup when memory pressure is high
     */
    private forceOptimizedCleanup;
    /**
     * Enhanced cleanup with resource management
     */
    private cleanupOptimized;
    private sleep;
}
//# sourceMappingURL=BaseAnalysisServiceOptimizations.d.ts.map