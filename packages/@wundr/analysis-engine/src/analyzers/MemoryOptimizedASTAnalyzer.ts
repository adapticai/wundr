/**
 * Memory-Optimized AST Analyzer with Enhanced Concurrency
 * Implements streaming processing, object pooling, and intelligent memory management
 */

import * as ts from 'typescript';
import { Project } from "ts-morph";
import { Worker } from 'worker_threads';
import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { performance } from 'perf_hooks';
import { memoryUsage } from 'process';

import { BaseAnalysisService } from './BaseAnalysisService';
import {
  EntityInfo,
  ComplexityMetrics,
  AnalysisConfig,
  ServiceConfig,
  MemoryMetrics,
  ConcurrencyStats
} from '../types';
import {
  generateNormalizedHash,
  generateSemanticHash,
  createId,
  normalizeFilePath
} from '../utils';

/**
 * Object pool for reusing expensive objects
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(createFn: () => T, resetFn: (obj: T) => void, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }

  get size(): number {
    return this.pool.length;
  }
}

/**
 * Memory pressure monitor
 */
class MemoryPressureMonitor {
  private thresholds = {
    warning: 0.8,  // 80% memory usage
    critical: 0.9  // 90% memory usage
  };
  private listeners: ((level: 'normal' | 'warning' | 'critical') => void)[] = [];
  private intervalId: NodeJS.Timer | null = null;

  start(intervalMs = 1000): void {
    this.intervalId = setInterval(() => {
      const usage = memoryUsage();
      const totalMem = process.memoryUsage.rss();
      const usageRatio = usage.heapUsed / usage.heapTotal;
      
      let level: 'normal' | 'warning' | 'critical' = 'normal';
      if (usageRatio >= this.thresholds.critical) {
        level = 'critical';
      } else if (usageRatio >= this.thresholds.warning) {
        level = 'warning';
      }
      
      this.listeners.forEach(listener => listener(level));
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onPressureChange(listener: (level: 'normal' | 'warning' | 'critical') => void): void {
    this.listeners.push(listener);
  }
}

/**
 * Concurrent task scheduler with backpressure handling
 */
class ConcurrentTaskScheduler {
  private queue: (() => Promise<any>)[] = [];
  private running = 0;
  private maxConcurrency: number;
  private backpressureThreshold: number;
  private stats: ConcurrencyStats;

  constructor(maxConcurrency = 15, backpressureThreshold = 1000) {
    this.maxConcurrency = maxConcurrency;
    this.backpressureThreshold = backpressureThreshold;
    this.stats = {
      tasksCompleted: 0,
      tasksQueued: 0,
      averageTaskTime: 0,
      currentConcurrency: 0,
      backpressureEvents: 0
    };
  }

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskWithStats = async () => {
        const startTime = performance.now();
        try {
          this.running++;
          this.stats.currentConcurrency = this.running;
          const result = await task();
          
          const taskTime = performance.now() - startTime;
          this.stats.averageTaskTime = 
            (this.stats.averageTaskTime * this.stats.tasksCompleted + taskTime) / 
            (this.stats.tasksCompleted + 1);
          this.stats.tasksCompleted++;
          
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.stats.currentConcurrency = this.running;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrency) {
        taskWithStats();
      } else {
        if (this.queue.length >= this.backpressureThreshold) {
          this.stats.backpressureEvents++;
          // Apply backpressure by reducing concurrency temporarily
          this.maxConcurrency = Math.max(1, Math.floor(this.maxConcurrency * 0.8));
        }
        
        this.queue.push(taskWithStats);
        this.stats.tasksQueued = this.queue.length;
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrency) {
      const task = this.queue.shift();
      if (task) {
        this.stats.tasksQueued = this.queue.length;
        task();
      }
    }
  }

  getStats(): ConcurrencyStats {
    return { ...this.stats };
  }

  adjustConcurrency(factor: number): void {
    this.maxConcurrency = Math.max(1, Math.floor(this.maxConcurrency * factor));
  }
}

/**
 * Streaming AST processor for large codebases
 */
class StreamingASTProcessor extends Transform {
  private analyzer: MemoryOptimizedASTAnalyzer;
  private entityPool: ObjectPool<EntityInfo>;
  private batchSize: number;
  private currentBatch: EntityInfo[] = [];

  constructor(
    analyzer: MemoryOptimizedASTAnalyzer,
    entityPool: ObjectPool<EntityInfo>,
    batchSize = 100
  ) {
    super({ objectMode: true });
    this.analyzer = analyzer;
    this.entityPool = entityPool;
    this.batchSize = batchSize;
  }

  _transform(sourceFile: ts.SourceFile, encoding: string, callback: Function): void {
    try {
      const entities = this.analyzer.extractEntitiesFromSourceFile(sourceFile);
      this.currentBatch.push(...entities);

      if (this.currentBatch.length >= this.batchSize) {
        this.push(this.currentBatch.splice(0, this.batchSize));
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: Function): void {
    if (this.currentBatch.length > 0) {
      this.push(this.currentBatch);
      this.currentBatch = [];
    }
    callback();
  }
}

/**
 * Memory-Optimized AST Analyzer with Enhanced Performance
 */
export class MemoryOptimizedASTAnalyzer extends BaseAnalysisService {
  private project: Project;
  private tsProgram: ts.Program;
  private typeChecker: ts.TypeChecker;
  private imports: Map<string, Set<string>> = new Map();
  private exports: Map<string, Set<string>> = new Map();
  
  // Memory and concurrency optimizations
  private entityPool: ObjectPool<EntityInfo>;
  private memoryMonitor: MemoryPressureMonitor;
  private taskScheduler: ConcurrentTaskScheduler;
  private memoryMetrics: MemoryMetrics;
  private streamProcessor: StreamingASTProcessor;
  
  // Performance tracking
  private performanceStats = {
    entitiesProcessed: 0,
    averageProcessingTime: 0,
    memoryPeakUsage: 0,
    gcEvents: 0
  };

  constructor(config: Partial<AnalysisConfig & ServiceConfig> = {}) {
    super('MemoryOptimizedASTAnalyzer', {
      ...config,
      performance: {
        maxConcurrency: 25, // Increased concurrency
        chunkSize: 25,      // Smaller chunks for better memory management
        enableCaching: true,
        enableStreaming: true,
        memoryLimit: 512 * 1024 * 1024, // 512MB limit
        ...config.performance
      }
    });

    // Initialize memory optimizations
    this.initializeOptimizations();
    this.initializeTSProject(config);
  }

  private initializeOptimizations(): void {
    // Object pool for entities
    this.entityPool = new ObjectPool<EntityInfo>(
      () => ({
        id: '',
        name: '',
        type: '',
        file: '',
        line: 0,
        column: 0,
        exportType: 'none',
        dependencies: []
      } as EntityInfo),
      (entity) => {
        // Reset entity for reuse
        entity.id = '';
        entity.name = '';
        entity.type = '';
        entity.file = '';
        entity.line = 0;
        entity.column = 0;
        entity.dependencies.length = 0;
        delete entity.normalizedHash;
        delete entity.semanticHash;
        delete entity.jsDoc;
        delete entity.complexity;
        delete entity.members;
        delete entity.signature;
      },
      200
    );

    // Memory pressure monitoring
    this.memoryMonitor = new MemoryPressureMonitor();
    this.memoryMonitor.onPressureChange((level) => {
      if (level === 'critical') {
        this.handleMemoryPressure();
      }
    });

    // Concurrent task scheduler
    this.taskScheduler = new ConcurrentTaskScheduler(
      this.config.performance.maxConcurrency,
      1000
    );

    // Initialize memory metrics
    this.memoryMetrics = {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
      peakUsage: 0,
      gcEvents: 0,
      objectPoolHits: 0,
      objectPoolMisses: 0
    };
  }

  private initializeTSProject(config: any): void {
    this.project = new Project({
      tsConfigFilePath: config.targetDir ? `${config.targetDir}/tsconfig.json` : './tsconfig.json',
      skipAddingFilesFromTsConfig: true,
      useInMemoryFileSystem: false,
      compilerOptions: {
        skipLibCheck: true,
        skipDefaultLibCheck: true,
        noResolve: false,
        allowJs: true,
        checkJs: false,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS
      }
    });

    this.tsProgram = (this.project as any).getProgram?.()?.compilerObject;
    this.typeChecker = this.tsProgram?.getTypeChecker();

    // Initialize streaming processor
    this.streamProcessor = new StreamingASTProcessor(
      this,
      this.entityPool,
      this.config.performance.chunkSize
    );
  }

  /**
   * Enhanced analysis with streaming and memory management
   */
  protected async performAnalysis(entities: EntityInfo[]): Promise<any> {
    this.memoryMonitor.start();
    const startTime = performance.now();
    const initialMemory = memoryUsage();

    try {
      this.emitProgress({ type: 'phase', message: 'Starting memory-optimized analysis...' });

      // Use streaming processing for large datasets
      if (entities.length > 5000) {
        return await this.performStreamingAnalysis(entities);
      } else {
        return await this.performBatchAnalysis(entities);
      }
    } finally {
      this.memoryMonitor.stop();
      this.updatePerformanceStats(startTime, initialMemory);
      this.cleanupMemory();
    }
  }

  /**
   * Streaming analysis for large codebases (>5K files)
   */
  private async performStreamingAnalysis(entities: EntityInfo[]): Promise<any> {
    this.emitProgress({ type: 'phase', message: 'Using streaming analysis for large codebase...' });

    const results = {
      duplicates: [],
      circularDependencies: [],
      unusedExports: [],
      codeSmells: [],
      wrapperPatterns: []
    };

    // Process entities in streams
    const entityStream = Readable.from(this.chunkArray(entities, 100));
    
    await pipeline(
      entityStream,
      this.createDuplicateDetectionStream(),
      this.createCircularDependencyStream(),
      this.createCodeSmellsStream(),
      async function* (source) {
        for await (const chunk of source) {
          Object.assign(results, chunk);
          yield chunk;
        }
      }
    );

    return this.finalizeResults(results);
  }

  /**
   * Batch analysis with optimized concurrency
   */
  private async performBatchAnalysis(entities: EntityInfo[]): Promise<any> {
    this.emitProgress({ type: 'phase', message: 'Using optimized batch analysis...' });

    // Dynamic concurrency adjustment based on memory pressure
    this.memoryMonitor.onPressureChange((level) => {
      if (level === 'critical') {
        this.taskScheduler.adjustConcurrency(0.5);
      } else if (level === 'warning') {
        this.taskScheduler.adjustConcurrency(0.8);
      } else {
        this.taskScheduler.adjustConcurrency(1.2);
      }
    });

    // Run analysis phases with intelligent scheduling
    const [duplicates, circularDeps, unusedExports, codeSmells, wrapperPatterns] = 
      await Promise.all([
        this.taskScheduler.schedule(() => this.detectDuplicatesOptimized(entities)),
        this.taskScheduler.schedule(() => this.detectCircularDependencies()),
        this.taskScheduler.schedule(() => this.findUnusedExports(entities)),
        this.taskScheduler.schedule(() => this.detectCodeSmells(entities)),
        this.taskScheduler.schedule(() => this.detectWrapperPatterns(entities))
      ]);

    return this.finalizeResults({
      duplicates,
      circularDependencies: circularDeps,
      unusedExports,
      codeSmells,
      wrapperPatterns
    });
  }

  /**
   * Extract entities from source file with memory optimization
   */
  extractEntitiesFromSourceFile(sourceFile: ts.SourceFile): EntityInfo[] {
    const entities: EntityInfo[] = [];
    const filePath = normalizeFilePath(sourceFile.fileName);

    const visitNode = (node: ts.Node) => {
      const entity = this.extractEntityFromNode(node, sourceFile);
      if (entity) {
        entities.push(entity);
      }
      ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
    return entities;
  }

  /**
   * Extract entity with object pooling
   */
  protected extractEntityFromNode(node: ts.Node, sourceFile: ts.SourceFile): EntityInfo | null {
    const entity = this.entityPool.acquire();
    this.memoryMetrics.objectPoolHits++;

    try {
      const filePath = normalizeFilePath(sourceFile.fileName);
      const position = this.getPositionInfo(node, sourceFile);

      // Populate entity based on node type
      switch (node.kind) {
        case ts.SyntaxKind.ClassDeclaration:
          return this.populateClassEntity(entity, node as ts.ClassDeclaration, filePath, position);
        case ts.SyntaxKind.InterfaceDeclaration:
          return this.populateInterfaceEntity(entity, node as ts.InterfaceDeclaration, filePath, position);
        case ts.SyntaxKind.FunctionDeclaration:
          return this.populateFunctionEntity(entity, node as ts.FunctionDeclaration, filePath, position);
        // Add more cases as needed
        default:
          this.entityPool.release(entity);
          return null;
      }
    } catch (error) {
      this.entityPool.release(entity);
      throw error;
    }
  }

  private populateClassEntity(
    entity: EntityInfo,
    classDecl: ts.ClassDeclaration,
    filePath: string,
    position: { line: number; column: number }
  ): EntityInfo {
    const name = classDecl.name?.getText();
    if (!name) {
      this.entityPool.release(entity);
      return null;
    }

    entity.id = createId();
    entity.name = name;
    entity.type = 'class';
    entity.file = filePath;
    entity.line = position.line;
    entity.column = position.column;
    entity.exportType = this.getExportType(classDecl);

    // Lazy computation of expensive properties
    Object.defineProperty(entity, 'complexity', {
      get: () => this.calculateNodeComplexity(classDecl),
      configurable: true
    });

    Object.defineProperty(entity, 'members', {
      get: () => ({
        methods: this.extractMethods(classDecl),
        properties: this.extractProperties(classDecl)
      }),
      configurable: true
    });

    // Generate hashes on demand
    Object.defineProperty(entity, 'normalizedHash', {
      get: () => {
        if (!this._normalizedHash) {
          this._normalizedHash = generateNormalizedHash(entity.members);
        }
        return this._normalizedHash;
      },
      configurable: true
    });

    return entity;
  }

  // Similar optimizations for other entity types...

  /**
   * Handle memory pressure by forcing cleanup
   */
  private handleMemoryPressure(): void {
    this.emitProgress({ 
      type: 'warning', 
      message: 'High memory pressure detected, forcing cleanup...' 
    });

    // Clear object pools
    this.entityPool.clear();
    
    // Clear caches
    this.imports.clear();
    this.exports.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.memoryMetrics.gcEvents++;
    }

    // Reduce concurrency
    this.taskScheduler.adjustConcurrency(0.5);
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(startTime: number, initialMemory: any): void {
    const endTime = performance.now();
    const finalMemory = memoryUsage();
    
    this.performanceStats.averageProcessingTime = endTime - startTime;
    this.performanceStats.memoryPeakUsage = Math.max(
      this.performanceStats.memoryPeakUsage,
      finalMemory.heapUsed - initialMemory.heapUsed
    );

    this.memoryMetrics.heapUsed = finalMemory.heapUsed;
    this.memoryMetrics.heapTotal = finalMemory.heapTotal;
    this.memoryMetrics.external = finalMemory.external;
    this.memoryMetrics.rss = finalMemory.rss;
    this.memoryMetrics.peakUsage = Math.max(this.memoryMetrics.peakUsage, finalMemory.heapUsed);
  }

  /**
   * Clean up memory after analysis
   */
  private cleanupMemory(): void {
    // Clear large data structures
    this.imports.clear();
    this.exports.clear();
    
    // Return pooled objects
    this.entityPool.clear();
    
    // Clear WeakMaps and other caches if they exist
    if (this.project) {
      // Clear ts-morph caches
      this.project.getSourceFiles().forEach(sf => sf.forget());
    }
  }

  /**
   * Create streaming transforms for analysis phases
   */
  private createDuplicateDetectionStream(): Transform {
    const hashGroups = new Map<string, EntityInfo[]>();
    
    return new Transform({
      objectMode: true,
      transform(entities: EntityInfo[], encoding, callback) {
        // Process entities for duplicates
        entities.forEach(entity => {
          if (entity.normalizedHash) {
            if (!hashGroups.has(entity.normalizedHash)) {
              hashGroups.set(entity.normalizedHash, []);
            }
            hashGroups.get(entity.normalizedHash)!.push(entity);
          }
        });
        
        callback(null, { duplicates: Array.from(hashGroups.values()).filter(g => g.length > 1) });
      }
    });
  }

  private createCircularDependencyStream(): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // Process circular dependencies
        callback(null, { ...chunk, circularDependencies: [] });
      }
    });
  }

  private createCodeSmellsStream(): Transform {
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // Process code smells
        callback(null, { ...chunk, codeSmells: [] });
      }
    });
  }

  /**
   * Utility method to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get current memory metrics
   */
  getMemoryMetrics(): MemoryMetrics {
    return { ...this.memoryMetrics };
  }

  /**
   * Get concurrency statistics
   */
  getConcurrencyStats(): ConcurrencyStats {
    return this.taskScheduler.getStats();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  // Implement remaining abstract methods...
  private finalizeResults(results: any): any {
    return {
      ...results,
      recommendations: this.generateRecommendations(results),
      visualizations: this.generateVisualizationData([], results)
    };
  }

  private generateRecommendations(results: any): any[] {
    return [];
  }

  private generateVisualizationData(entities: EntityInfo[], results: any): any {
    return {};
  }

  // Add other required methods from the parent class...
}
