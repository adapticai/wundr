/**
 * Enhanced Base Analysis Service - Core functionality for all analysis services
 * Migrated and optimized from original AnalysisService with performance improvements
 */
import * as ts from 'typescript';
import { Ora } from 'ora';
import { AnalysisConfig, AnalysisReport, EntityInfo, AnalysisProgressEvent, AnalysisProgressCallback } from '../types';
export interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    duration: number;
}
export interface ServiceConfig {
    name: string;
    version: string;
    outputDir?: string;
    verbose?: boolean;
}
/**
 * Enhanced base class for all analysis services with performance optimizations
 */
export declare abstract class BaseAnalysisService {
    protected config: AnalysisConfig & ServiceConfig;
    protected program: ts.Program | null;
    protected checker: ts.TypeChecker | null;
    protected spinner: Ora;
    protected progressCallback?: AnalysisProgressCallback;
    private startTime;
    private fileCache;
    private analysisCache;
    private memoryUsage;
    private cacheHits;
    private streamingProcessor;
    private workerPool;
    private memoryMonitor;
    private objectPools;
    constructor(name: string, config: Partial<AnalysisConfig & ServiceConfig>);
    /**
     * Set progress callback for real-time updates
     */
    setProgressCallback(callback: AnalysisProgressCallback): void;
    /**
     * Emit progress event
     */
    protected emitProgress(event: AnalysisProgressEvent): void;
    /**
     * Main analysis method with advanced memory optimization and concurrency
     */
    analyze(): Promise<ServiceResult<AnalysisReport>>;
    /**
     * Get TypeScript files with advanced filtering and caching
     */
    protected getTargetFiles(): Promise<string[]>;
    /**
     * Filter files by size and other criteria
     */
    private filterFilesByCriteria;
    /**
     * Create optimized TypeScript program with caching
     */
    protected createOptimizedProgram(files: string[]): void;
    /**
     * Extract entities with performance optimization
     */
    private extractEntitiesOptimized;
    /**
     * Extract entities from a single file with caching
     */
    protected extractEntitiesFromFile(filePath: string): Promise<EntityInfo[]>;
    /**
     * Generate comprehensive analysis report
     */
    private generateReport;
    /**
     * Save analysis report in multiple formats
     */
    protected saveReport(report: AnalysisReport): Promise<void>;
    protected calculateAverageComplexity(entities: EntityInfo[]): number;
    protected calculateMaintainabilityIndex(entities: EntityInfo[]): number;
    protected calculateTechnicalDebtScore(analysisResults: any): number;
    protected estimateTechnicalDebtHours(analysisResults: any): number;
    protected abstract performAnalysis(entities: EntityInfo[]): Promise<any>;
    protected abstract extractEntityFromNode(node: ts.Node, sourceFile: ts.SourceFile): EntityInfo | null;
    protected setupMemoryOptimizations(): void;
    private forceCleanup;
    protected getSourceFile(filePath: string): ts.SourceFile | undefined;
    protected visitNode(node: ts.Node, visitor: (node: ts.Node) => void): void;
    protected getPositionInfo(node: ts.Node, sourceFile: ts.SourceFile): {
        line: number;
        column: number;
    };
    protected generateHtmlReport(report: AnalysisReport): string;
    protected generateMarkdownReport(report: AnalysisReport): string;
    protected generateCsvReport(report: AnalysisReport): string;
    protected initialize(): Promise<void>;
    protected cleanup(): Promise<void>;
}
//# sourceMappingURL=BaseAnalysisService.d.ts.map