/**
 * BaseAnalysisService Optimizations - Memory and concurrency enhancements
 * Extends BaseAnalysisService with advanced performance optimizations
 */

import { BaseAnalysisService } from './BaseAnalysisService';
import { StreamingFileProcessor } from '../streaming/StreamingFileProcessor';
import { WorkerPoolManager } from '../workers/WorkerPoolManager';
import { MemoryMonitor } from '../monitoring/MemoryMonitor';
import { EntityInfo, AnalysisConfig, AnalysisReport, AnalysisSummary, PerformanceMetrics } from '../types';
import { createId, normalizeFilePath, formatDuration, formatFileSize, chunk } from '../utils';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export class OptimizedBaseAnalysisService extends BaseAnalysisService {
  // Memory optimization components
  private streamingProcessor: StreamingFileProcessor;
  private workerPool: WorkerPoolManager;
  private memoryMonitor: MemoryMonitor;
  private objectPools = {
    entities: [] as EntityInfo[],
    buffers: [] as Buffer[],
    arrays: [] as any[][]
  };

  constructor(name: string, config: Partial<AnalysisConfig & any>) {
    super(name, config);
    
    // Initialize optimization components
    this.streamingProcessor = new StreamingFileProcessor({
      chunkSize: 32 * 1024, // 32KB chunks for memory efficiency
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB limit
      workerPoolSize: this.config.performance.maxConcurrency,
      bufferSize: 512 * 1024 // 512KB buffer
    });
    
    this.workerPool = new WorkerPoolManager({
      minWorkers: Math.max(2, Math.floor(this.config.performance.maxConcurrency * 0.5)),
      maxWorkers: Math.max(30, this.config.performance.maxConcurrency * 2), // Target 30+ workers
      enableAutoScaling: true,
      workerScript: path.join(__dirname, '../workers/analysis-worker.js')
    });
    
    this.memoryMonitor = new MemoryMonitor({
      snapshotInterval: 10000, // 10 second intervals
      maxSnapshots: 500,
      outputDir: path.join(this.config.outputDir || '.', 'memory-profiles')
    });
    
    this.setupMemoryOptimizations();
  }

  /**
   * Setup memory optimizations and object pooling
   */
  private setupMemoryOptimizations(): void {
    // Initialize object pools
    for (let i = 0; i < 100; i++) {
      this.objectPools.entities.push({} as EntityInfo);
      this.objectPools.arrays.push([]);
    }
    
    for (let i = 0; i < 20; i++) {
      this.objectPools.buffers.push(Buffer.alloc(0));
    }
    
    // Setup memory monitoring events
    this.memoryMonitor.on('memory-alert', (alert) => {
      if (this.config.verbose) {
        console.warn(`Memory Alert: ${alert.type} - Current: ${formatFileSize(alert.current)}`);
      }
      
      if (alert.severity === 'critical') {
        // Force garbage collection and cleanup
        this.forceCleanup();
      }
    });
    
    this.memoryMonitor.on('memory-leak-detected', (analysis) => {
      this.emit('memory-leak-warning', {
        growthRate: analysis.growthRate,
        severity: analysis.severity,
        recommendations: analysis.recommendations
      });
    });
  }

  /**
   * Main analysis method with advanced memory optimization and concurrency
   */
  async analyze(): Promise<any> {
    const startTime = Date.now();
    this.emitProgress({ type: 'phase', message: 'Initializing high-performance analysis...' });
    
    try {
      if (this.config.verbose) {
        this.spinner.start('Starting optimized analysis...');
      }

      // Start memory monitoring
      await this.memoryMonitor.startMonitoring();
      
      await this.initialize();
      
      // Get target files with caching and streaming
      const files = await this.getTargetFilesOptimized();
      if (files.length === 0) {
        throw new Error('No files found to analyze');
      }

      this.emitProgress({
        type: 'progress',
        phase: 'file-discovery',
        progress: files.length,
        total: files.length,
        message: `Found ${files.length} files (using streaming optimization)`
      });

      // Use streaming analysis for large codebases
      let entities: EntityInfo[];
      let analysisResults: any;
      
      if (files.length > 1000 || this.getTotalFileSize(files) > 50 * 1024 * 1024) {
        // Large codebase - use streaming
        ({ entities, analysisResults } = await this.performStreamingAnalysis(files));
      } else {
        // Small codebase - use optimized traditional approach
        this.createOptimizedProgram(files);
        entities = await this.extractEntitiesOptimizedConcurrent(files);
        analysisResults = await this.performAnalysisConcurrent(entities);
      }
      
      // Generate report with memory optimization
      const report = await this.generateReportOptimized(files, entities, analysisResults);
      
      // Save report in multiple formats
      await this.saveReport(report);
      
      const duration = Date.now() - startTime;
      const memoryMetrics = this.memoryMonitor.getMetrics();
      
      this.emitProgress({ 
        type: 'complete', 
        message: `Analysis completed in ${formatDuration(duration)} (Peak memory: ${formatFileSize(memoryMetrics.peak.heapUsed)})`
      });

      return {
        success: true,
        data: report,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emitProgress({ 
        type: 'error', 
        message: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error))
      });
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration
      };
    } finally {
      await this.cleanupOptimized();
    }
  }

  /**
   * Get target files with streaming optimization
   */
  private async getTargetFilesOptimized(): Promise<string[]> {
    const cacheKey = 'target-files-optimized';
    if (this.config.performance.enableCaching && this.analysisCache.has(cacheKey)) {
      this.cacheHits++;
      return this.analysisCache.get(cacheKey);
    }

    const patterns = this.config.includePatterns;
    const allFiles: string[] = [];

    // Use concurrent glob processing
    const globPromises = patterns.map(pattern => 
      import('glob').then(glob => glob.glob(pattern, {
        cwd: this.config.targetDir,
        absolute: true,
        ignore: [
          ...this.config.excludeDirs.map(dir => `${dir}/**`),
          ...(this.config.includeTests ? [] : this.config.excludePatterns)
        ]
      }))
    );
    
    const results = await Promise.all(globPromises);
    allFiles.push(...results.flat());

    // Remove duplicates and normalize paths
    const uniqueFiles = [...new Set(allFiles.map(normalizeFilePath))];
    
    // Filter by file size and other criteria with streaming
    const filteredFiles = await this.filterFilesByCriteriaOptimized(uniqueFiles);
    
    if (this.config.performance.enableCaching) {
      this.analysisCache.set(cacheKey, filteredFiles);
    }

    return filteredFiles;
  }

  /**
   * Filter files with streaming and memory-efficient processing
   */
  private async filterFilesByCriteriaOptimized(files: string[]): Promise<string[]> {
    const maxLines = this.config.thresholds.fileSize.maxLines;
    const filteredFiles: string[] = [];
    const maxFileSize = 2 * 1024 * 1024; // 2MB limit

    // Process files in smaller batches to reduce memory pressure
    const batchSize = Math.max(10, Math.min(50, Math.floor(this.config.performance.maxConcurrency / 2)));
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const stats = await fs.stat(file);
            
            // Skip very large files
            if (stats.size > maxFileSize) {
              if (this.config.verbose) {
                console.warn(`Skipping large file: ${file} (${formatFileSize(stats.size)})`);
              }
              return null;
            }

            // For medium files, do a quick line count check
            if (stats.size > 100 * 1024) { // > 100KB
              const lineCount = await this.getLineCountEfficient(file);
              if (lineCount > maxLines * 2) {
                if (this.config.verbose) {
                  console.warn(`Skipping file with ${lineCount} lines: ${file}`);
                }
                return null;
              }
            }
            
            return file;
          } catch (error) {
            if (this.config.verbose) {
              console.warn(`Error checking file ${file}: ${error instanceof Error ? error.message : String(error)}`);
            }
            return null;
          }
        })
      );

      filteredFiles.push(...batchResults.filter(Boolean) as string[]);
      
      // Check memory pressure between batches
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > 200 * 1024 * 1024) { // 200MB threshold
        // Force cleanup
        if (global.gc) global.gc();
        await this.sleep(100); // Brief pause
      }
    }

    return filteredFiles;
  }

  /**
   * Get line count efficiently without loading entire file
   */
  private async getLineCountEfficient(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let lineCount = 0;
      const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
      
      stream.on('data', (chunk: string) => {
        lineCount += (chunk.match(/\n/g) || []).length;
      });
      
      stream.on('end', () => resolve(lineCount));
      stream.on('error', reject);
    });
  }

  /**
   * Perform streaming analysis for large codebases
   */
  private async performStreamingAnalysis(files: string[]): Promise<{ entities: EntityInfo[]; analysisResults: any }> {
    this.emitProgress({ type: 'phase', message: 'Starting streaming analysis for large codebase...' });
    
    const entities: EntityInfo[] = [];
    let processedFiles = 0;
    
    const entityProcessor = async (chunk: any) => {
      const chunkEntities = await this.workerPool.submitTask({
        id: `extract-entities-${chunk.id}`,
        type: 'extract-entities',
        data: { filePaths: [chunk.filePath] },
        priority: 'medium'
      });
      
      if (chunkEntities.success && chunkEntities.data) {
        entities.push(...chunkEntities.data);
      }
      
      processedFiles++;
      this.emitProgress({
        type: 'progress',
        progress: processedFiles,
        total: files.length,
        message: `Streaming analysis: ${processedFiles}/${files.length} files`
      });
    };

    // Use streaming file processor
    const streamingMetrics = await this.streamingProcessor.streamProcessFiles(files, entityProcessor);
    
    this.emitProgress({ 
      type: 'phase', 
      message: `Streaming extraction complete. Analyzing ${entities.length} entities...`
    });
    
    // Perform analysis on collected entities using worker pool
    const analysisResults = await this.performAnalysisConcurrent(entities);
    
    return { entities, analysisResults };
  }

  /**
   * Extract entities with optimized concurrent processing
   */
  private async extractEntitiesOptimizedConcurrent(files: string[]): Promise<EntityInfo[]> {
    this.emitProgress({
      type: 'phase',
      message: 'Extracting entities with optimized concurrency...'
    });

    const allEntities: EntityInfo[] = [];
    const batchSize = Math.min(this.config.performance.chunkSize, 50);
    const fileChunks = chunk(files, batchSize);
    let processedFiles = 0;

    // Use worker pool for concurrent entity extraction
    const chunkPromises = fileChunks.map(async (fileChunk, chunkIndex) => {
      const task = {
        id: `extract-entities-chunk-${chunkIndex}`,
        type: 'extract-entities' as const,
        data: { filePaths: fileChunk },
        priority: 'high' as const
      };
      
      const result = await this.workerPool.submitTask(task);
      
      processedFiles += fileChunk.length;
      this.emitProgress({
        type: 'progress',
        progress: processedFiles,
        total: files.length,
        message: `Processing files with ${this.workerPool.getMetrics().activeWorkers} workers...`
      });
      
      return result.success ? result.data : [];
    });

    // Wait for all chunks to complete
    const chunkResults = await Promise.all(chunkPromises);
    allEntities.push(...chunkResults.flat());

    return allEntities;
  }

  /**
   * Perform analysis with concurrent processing
   */
  private async performAnalysisConcurrent(entities: EntityInfo[]): Promise<any> {
    this.emitProgress({ type: 'phase', message: 'Performing concurrent analysis...' });
    
    // Split entities by type for parallel processing
    const entitiesByType = new Map<string, EntityInfo[]>();
    entities.forEach(entity => {
      if (!entitiesByType.has(entity.type)) {
        entitiesByType.set(entity.type, []);
      }
      entitiesByType.get(entity.type)!.push(entity);
    });
    
    const analysisPromises = [];
    
    // Duplicate detection
    if (entitiesByType.size > 0) {
      analysisPromises.push(
        this.workerPool.submitTask({
          id: 'detect-duplicates',
          type: 'detect-duplicates',
          data: { entities, config: this.config.thresholds.duplicates },
          priority: 'high'
        })
      );
    }
    
    // Complexity analysis for functions and classes
    const complexEntities = entities.filter(e => ['function', 'class', 'method'].includes(e.type));
    if (complexEntities.length > 0) {
      const complexityChunks = chunk(complexEntities, 100);
      complexityChunks.forEach((entityChunk, index) => {
        analysisPromises.push(
          this.workerPool.submitTask({
            id: `complexity-analysis-${index}`,
            type: 'calculate-complexity',
            data: { entities: entityChunk },
            priority: 'medium'
          })
        );
      });
    }
    
    // Wait for all analysis to complete
    const results = await Promise.all(analysisPromises);
    
    return {
      duplicates: results[0]?.success ? results[0].data : [],
      complexityResults: results.slice(1).filter(r => r.success).map(r => r.data).flat(),
      circularDependencies: [], // Placeholder
      unusedExports: [], // Placeholder
      codeSmells: [], // Placeholder
      recommendations: this.generateOptimizationRecommendations()
    };
  }

  /**
   * Generate report with memory optimization
   */
  private async generateReportOptimized(
    files: string[],
    entities: EntityInfo[],
    analysisResults: any
  ): Promise<AnalysisReport> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const memoryMetrics = this.memoryMonitor.getMetrics();

    const summary: AnalysisSummary = {
      totalFiles: files.length,
      totalEntities: entities.length,
      duplicateClusters: analysisResults.duplicates?.length || 0,
      circularDependencies: analysisResults.circularDependencies?.length || 0,
      unusedExports: analysisResults.unusedExports?.length || 0,
      codeSmells: analysisResults.codeSmells?.length || 0,
      averageComplexity: this.calculateAverageComplexity(entities),
      maintainabilityIndex: this.calculateMaintainabilityIndex(entities),
      technicalDebt: {
        score: this.calculateTechnicalDebtScore(analysisResults),
        estimatedHours: this.estimateTechnicalDebtHours(analysisResults)
      }
    };

    const performance: PerformanceMetrics = {
      analysisTime: duration,
      filesPerSecond: Math.round(files.length / (duration / 1000)),
      entitiesPerSecond: Math.round(entities.length / (duration / 1000)),
      memoryUsage: {
        peak: memoryMetrics.peak.heapUsed,
        average: memoryMetrics.average.heapUsed
      },
      cacheHits: this.cacheHits,
      cacheSize: this.analysisCache.size,
      // Additional optimization metrics
      workerMetrics: this.workerPool.getMetrics(),
      streamingMetrics: this.streamingProcessor.getMetrics(),
      memoryEfficiency: this.calculateMemoryEfficiency(files.length, memoryMetrics.peak.heapUsed)
    };

    return {
      id: createId(),
      timestamp: new Date().toISOString(),
      version: this.config.version,
      targetDir: this.config.targetDir,
      config: this.config,
      summary,
      entities,
      duplicates: analysisResults.duplicates || [],
      circularDependencies: analysisResults.circularDependencies || [],
      unusedExports: analysisResults.unusedExports || [],
      codeSmells: analysisResults.codeSmells || [],
      recommendations: analysisResults.recommendations || [],
      performance,
      visualizations: analysisResults.visualizations
    };
  }

  /**
   * Get total file size for streaming decision
   */
  private getTotalFileSize(files: string[]): number {
    // Estimate based on average file size (avoid I/O for all files)
    return files.length * 50 * 1024; // Assume 50KB average
  }

  /**
   * Calculate memory efficiency score
   */
  private calculateMemoryEfficiency(fileCount: number, peakMemory: number): number {
    const expectedMemory = fileCount * 1024 * 50; // 50KB per file baseline
    return expectedMemory > 0 ? Math.max(0, 100 - ((peakMemory - expectedMemory) / expectedMemory) * 100) : 100;
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(): string[] {
    const recommendations = [];
    const workerMetrics = this.workerPool.getMetrics();
    const memoryMetrics = this.memoryMonitor.getMetrics();
    
    if (workerMetrics.throughput < 100) {
      recommendations.push('Consider increasing worker pool size for better throughput');
    }
    
    if (memoryMetrics.leakAnalysis.leakDetected) {
      recommendations.push('Memory leak detected - review object lifecycle management');
    }
    
    if (this.cacheHits / Math.max(1, this.analysisCache.size) < 0.5) {
      recommendations.push('Low cache hit ratio - consider adjusting cache strategy');
    }
    
    return recommendations;
  }

  /**
   * Force cleanup when memory pressure is high
   */
  private forceCleanup(): void {
    // Clear caches
    this.fileCache.clear();
    if (!this.config.performance.enableCaching) {
      this.analysisCache.clear();
    }
    
    // Return objects to pools
    this.objectPools.entities.length = 0;
    this.objectPools.arrays.length = 0;
    this.objectPools.buffers.length = 0;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Enhanced cleanup with resource management
   */
  private async cleanupOptimized(): Promise<void> {
    // Stop monitoring
    this.memoryMonitor.stopMonitoring();
    
    // Shutdown worker pool gracefully
    await this.workerPool.shutdown(10000); // 10 second timeout
    
    // Traditional cleanup
    this.program = null;
    this.checker = null;
    this.fileCache.clear();
    
    if (!this.config.performance.enableCaching) {
      this.analysisCache.clear();
    }
    
    // Clear object pools
    this.objectPools.entities.length = 0;
    this.objectPools.arrays.length = 0;
    this.objectPools.buffers.length = 0;
    
    // Final memory report
    if (this.config.verbose) {
      const finalMetrics = this.memoryMonitor.getMetrics();
      console.log(chalk.cyan(`\n📊 Final Memory Report:`));
      console.log(chalk.gray(`Peak Usage: ${formatFileSize(finalMetrics.peak.heapUsed)}`));
      console.log(chalk.gray(`Average Usage: ${formatFileSize(finalMetrics.average.heapUsed)}`));
      console.log(chalk.gray(`Cache Hits: ${this.cacheHits}`));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}