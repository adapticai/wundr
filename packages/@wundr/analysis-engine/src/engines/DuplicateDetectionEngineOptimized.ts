/**
 * Optimized Duplicate Detection Engine - Memory-efficient with 30+ worker concurrency
 * Enhanced with streaming processing, object pooling, and advanced memory management
 */

import {
  EntityInfo,
  DuplicateCluster,
  SeverityLevel,
  ConsolidationSuggestion,
  BaseAnalyzer,
  AnalysisConfig,
  EntityType
} from '../types';
import {
  generateNormalizedHash,
  generateSemanticHash,
  createId,
  processConcurrently
} from '../utils';
import { WorkerPoolManager } from '../workers/WorkerPoolManager';
import { MemoryMonitor } from '../monitoring/MemoryMonitor';
import { EventEmitter } from 'events';

interface SimilarityMatrix {
  [key: string]: {
    [key: string]: number;
  };
}

interface OptimizedDuplicateDetectionConfig {
  minSimilarity: number;
  enableSemanticAnalysis: boolean;
  enableStructuralAnalysis: boolean;
  enableFuzzyMatching: boolean;
  clusteringAlgorithm: 'hash' | 'hierarchical' | 'density';
  maxClusterSize: number;
  enableStreaming: boolean;
  streamingBatchSize: number;
  maxMemoryUsage: number;
}

/**
 * Memory-optimized high-performance duplicate detection engine
 * Supports 30+ concurrent workers with streaming analysis
 */
export class OptimizedDuplicateDetectionEngine extends EventEmitter implements BaseAnalyzer<DuplicateCluster[]> {
  public readonly name = 'OptimizedDuplicateDetectionEngine';
  public readonly version = '3.0.0';

  private config: OptimizedDuplicateDetectionConfig;
  private workerPool: WorkerPoolManager;
  private memoryMonitor: MemoryMonitor;
  
  // Memory optimization - object pools and caches
  private hashCache = new Map<string, string>();
  private similarityCache = new Map<string, number>();
  private clusterPool: DuplicateCluster[] = [];
  private processed = new Set<string>();
  
  // Performance tracking
  private stats = {
    entitiesProcessed: 0,
    clustersFound: 0,
    cacheHits: 0,
    memoryPeakUsage: 0
  };

  constructor(config: Partial<OptimizedDuplicateDetectionConfig> = {}) {
    super();
    
    this.config = {
      minSimilarity: 0.8,
      enableSemanticAnalysis: true,
      enableStructuralAnalysis: true,
      enableFuzzyMatching: true,
      clusteringAlgorithm: 'hash',
      maxClusterSize: 20,
      enableStreaming: true,
      streamingBatchSize: 1000,
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB limit
      ...config
    };
    
    // Initialize worker pool for concurrent analysis
    this.workerPool = new WorkerPoolManager({
      minWorkers: 4,
      maxWorkers: Math.max(30, require('os').cpus().length * 4), // Target 30+ workers
      enableAutoScaling: true,
      resourceThresholds: {
        cpu: 0.85,
        memory: 0.9
      },
      workerScript: require.resolve('../workers/analysis-worker.js')
    });
    
    // Initialize memory monitor
    this.memoryMonitor = new MemoryMonitor({
      snapshotInterval: 5000,
      maxSnapshots: 200,
      thresholds: {
        heapWarning: this.config.maxMemoryUsage * 0.8,
        heapCritical: this.config.maxMemoryUsage * 0.95,
        growthRateWarning: 10 * 1024 * 1024, // 10MB/s
        growthRateCritical: 50 * 1024 * 1024  // 50MB/s
      }
    });
    
    this.setupOptimizations();
  }

  /**
   * Setup memory optimizations and event handlers
   */
  private setupOptimizations(): void {
    this.memoryMonitor.on('memory-alert', (alert) => {
      this.emit('memory-alert', alert);
      
      if (alert.severity === 'critical') {
        this.forceCleanup();
      }
    });
    
    this.memoryMonitor.on('memory-leak-detected', (analysis) => {
      this.emit('memory-leak', analysis);
      this.forceCleanup();
    });
    
    // Initialize cluster pool
    for (let i = 0; i < 100; i++) {
      this.clusterPool.push(this.createEmptyCluster());
    }
    
    this.emit('engine-initialized', {
      maxWorkers: this.workerPool.getStatus().workers.length,
      memoryLimit: this.config.maxMemoryUsage
    });
  }

  /**
   * Analyze entities for duplicates using memory-optimized multiple algorithms
   */
  async analyze(
    entities: EntityInfo[], 
    analysisConfig: AnalysisConfig
  ): Promise<DuplicateCluster[]> {
    await this.memoryMonitor.startMonitoring();
    this.emit('analysis-started', { entityCount: entities.length });
    
    const startTime = Date.now();
    
    try {
      // Pre-filter entities to reduce memory usage
      const filteredEntities = this.preFilterEntities(entities);
      this.stats.entitiesProcessed = filteredEntities.length;
      
      this.emit('entities-filtered', { 
        original: entities.length, 
        filtered: filteredEntities.length 
      });
      
      // Choose analysis strategy based on entity count and memory
      let clusters: DuplicateCluster[];
      
      if (this.config.enableStreaming && filteredEntities.length > 5000) {
        clusters = await this.performStreamingDuplicateAnalysis(filteredEntities, analysisConfig);
      } else {
        clusters = await this.performOptimizedDuplicateAnalysis(filteredEntities, analysisConfig);
      }
      
      this.stats.clustersFound = clusters.length;
      
      const duration = Date.now() - startTime;
      this.emit('analysis-completed', {
        duration,
        entitiesProcessed: this.stats.entitiesProcessed,
        clustersFound: this.stats.clustersFound,
        memoryPeakUsage: this.stats.memoryPeakUsage,
        cacheHits: this.stats.cacheHits
      });
      
      return clusters;
      
    } finally {
      this.memoryMonitor.stopMonitoring();
      this.cleanup();
    }
  }

  /**
   * Pre-filter entities to reduce memory usage and improve performance
   */
  private preFilterEntities(entities: EntityInfo[]): EntityInfo[] {
    return entities.filter(entity => {
      // Skip entities with insufficient information
      if (!entity.name || entity.name.length < 3) return false;
      
      // Skip private/internal members
      if (entity.name.startsWith('_') || entity.name.startsWith('__')) return false;
      
      // Skip comments and trivial types
      if (entity.type === 'comment' || entity.type === 'whitespace') return false;
      
      // Skip very small functions/methods (likely getters/setters)
      if (entity.type === 'function' || entity.type === 'method') {
        const complexity = entity.complexity?.cyclomatic || 1;
        if (complexity < 2 && entity.name.length < 5) return false;
      }
      
      return true;
    });
  }

  /**
   * Perform streaming duplicate analysis for large entity sets
   */
  private async performStreamingDuplicateAnalysis(
    entities: EntityInfo[],
    analysisConfig: AnalysisConfig
  ): Promise<DuplicateCluster[]> {
    this.emit('streaming-analysis-started', { totalEntities: entities.length });
    
    const allClusters: DuplicateCluster[] = [];
    const batchSize = this.config.streamingBatchSize;
    let processedCount = 0;
    
    // Group entities by type for more efficient processing
    const entitiesByType = this.groupEntitiesByType(entities);
    
    for (const [entityType, typeEntities] of entitiesByType.entries()) {
      if (typeEntities.length < 2) continue;
      
      this.emit('processing-type', { type: entityType, count: typeEntities.length });
      
      // Process type entities in batches
      for (let i = 0; i < typeEntities.length; i += batchSize) {
        const batch = typeEntities.slice(i, i + batchSize);
        
        // Process batch concurrently with multiple workers
        const batchClusters = await this.processBatchConcurrently(batch, entityType);
        allClusters.push(...batchClusters);
        
        processedCount += batch.length;
        
        this.emit('batch-processed', {
          processed: processedCount,
          total: entities.length,
          clustersFound: allClusters.length,
          type: entityType
        });
        
        // Memory management
        if (processedCount % (batchSize * 3) === 0) {
          await this.performMemoryMaintenance();
        }
      }
    }
    
    // Final optimization and deduplication
    return this.optimizeClusters(allClusters);
  }

  /**
   * Perform optimized duplicate analysis with memory management
   */
  private async performOptimizedDuplicateAnalysis(
    entities: EntityInfo[],
    analysisConfig: AnalysisConfig
  ): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];

    // Phase 1: Concurrent hash-based clustering
    if (this.config.enableStructuralAnalysis) {
      this.emit('phase-started', { phase: 'structural-analysis' });
      const hashClusters = await this.detectHashBasedDuplicatesConcurrent(entities);
      clusters.push(...hashClusters);
      this.emit('phase-completed', { phase: 'structural-analysis', clusters: hashClusters.length });
    }

    // Phase 2: Concurrent semantic analysis
    if (this.config.enableSemanticAnalysis) {
      this.emit('phase-started', { phase: 'semantic-analysis' });
      const semanticClusters = await this.detectSemanticDuplicatesConcurrent(entities);
      clusters.push(...this.mergeClustersOptimized(clusters, semanticClusters));
      this.emit('phase-completed', { phase: 'semantic-analysis', clusters: semanticClusters.length });
    }

    // Phase 3: Streaming fuzzy matching
    if (this.config.enableFuzzyMatching) {
      this.emit('phase-started', { phase: 'fuzzy-analysis' });
      const fuzzyClusters = await this.detectFuzzyDuplicatesStreaming(entities);
      clusters.push(...this.mergeClustersOptimized(clusters, fuzzyClusters));
      this.emit('phase-completed', { phase: 'fuzzy-analysis', clusters: fuzzyClusters.length });
    }

    // Phase 4: Advanced clustering with memory optimization
    const finalClusters = await this.performAdvancedClusteringOptimized(clusters, entities);

    // Phase 5: Generate consolidation suggestions
    return this.enhanceClustersWithSuggestions(finalClusters);
  }

  /**
   * Process batch of entities concurrently using worker pool
   */
  private async processBatchConcurrently(
    batch: EntityInfo[],
    entityType: string
  ): Promise<DuplicateCluster[]> {
    const tasks = [];
    
    // Split batch into smaller chunks for parallel processing
    const chunkSize = Math.max(50, Math.floor(batch.length / this.workerPool.getMetrics().activeWorkers));
    
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      
      tasks.push({
        id: `detect-duplicates-${entityType}-${i}-${Date.now()}`,
        type: 'detect-duplicates' as const,
        data: { 
          entities: chunk, 
          config: this.config,
          analysisType: 'batch'
        },
        priority: 'high' as const,
        timeout: 30000 // 30 second timeout
      });
    }
    
    const results = await this.workerPool.processBatch(tasks);
    const allClusters: DuplicateCluster[] = [];
    
    for (const result of results) {
      if (result?.success && result?.data) {
        allClusters.push(...(result.data as DuplicateCluster[]));
      }
    }
    
    return allClusters;
  }

  /**
   * Concurrent hash-based duplicate detection
   */
  private async detectHashBasedDuplicatesConcurrent(entities: EntityInfo[]): Promise<DuplicateCluster[]> {
    const entitiesByType = this.groupEntitiesByType(entities);
    const tasks = [];
    
    // Create concurrent tasks for each entity type
    for (const [entityType, typeEntities] of entitiesByType.entries()) {
      if (typeEntities.length < 2) continue;
      
      tasks.push({
        id: `hash-duplicates-${entityType}-${Date.now()}`,
        type: 'detect-duplicates' as const,
        data: {
          entities: typeEntities,
          config: { ...this.config, analysisType: 'hash' }
        },
        priority: 'high' as const
      });
    }
    
    const results = await this.workerPool.processBatch(tasks);
    const allClusters: DuplicateCluster[] = [];
    
    for (const result of results) {
      if (result?.success && result?.data) {
        allClusters.push(...(result.data as DuplicateCluster[]));
      }
    }
    
    return allClusters;
  }

  /**
   * Concurrent semantic duplicate detection
   */
  private async detectSemanticDuplicatesConcurrent(entities: EntityInfo[]): Promise<DuplicateCluster[]> {
    const entitiesByType = this.groupEntitiesByType(entities);
    const tasks = [];

    // Process each type concurrently using workers
    for (const [entityType, typeEntities] of entitiesByType.entries()) {
      if (typeEntities.length < 2) continue;
      
      // Split large types into smaller chunks
      const chunkSize = Math.min(500, typeEntities.length);
      
      for (let i = 0; i < typeEntities.length; i += chunkSize) {
        const chunk = typeEntities.slice(i, i + chunkSize);
        
        tasks.push({
          id: `semantic-duplicates-${entityType}-${i}-${Date.now()}`,
          type: 'detect-duplicates' as const,
          data: { 
            entities: chunk, 
            config: { 
              ...this.config,
              analysisType: 'semantic'
            }
          },
          priority: 'medium' as const
        });
      }
    }

    const results = await this.workerPool.processBatch(tasks);
    const allClusters: DuplicateCluster[] = [];
    
    for (const result of results) {
      if (result?.success && result?.data) {
        allClusters.push(...(result.data as DuplicateCluster[]));
      }
    }

    return allClusters;
  }

  /**
   * Streaming fuzzy duplicate detection with memory management
   */
  private async detectFuzzyDuplicatesStreaming(entities: EntityInfo[]): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const entitiesByType = this.groupEntitiesByType(entities);
    
    for (const [entityType, typeEntities] of entitiesByType.entries()) {
      if (typeEntities.length < 2) continue;
      
      // Process in smaller chunks to manage memory
      const chunkSize = Math.min(300, typeEntities.length);
      
      for (let i = 0; i < typeEntities.length; i += chunkSize) {
        const chunk = typeEntities.slice(i, i + chunkSize);
        const chunkClusters = await this.findFuzzyClustersForTypeOptimized(chunk);
        clusters.push(...chunkClusters);
        
        // Clear similarity cache periodically to prevent memory bloat
        if (this.similarityCache.size > 20000) {
          this.similarityCache.clear();
          this.emit('cache-cleared', { type: 'similarity', size: 20000 });
        }
      }
    }

    return clusters;
  }

  /**
   * Find fuzzy clusters with memory optimization and object pooling
   */
  private async findFuzzyClustersForTypeOptimized(entities: EntityInfo[]): Promise<DuplicateCluster[]> {
    const clusters: DuplicateCluster[] = [];
    const localProcessed = new Set<string>();
    
    // Use more efficient similarity calculation
    for (let i = 0; i < entities.length; i++) {
      const currentEntity = entities[i];
      if (!currentEntity || localProcessed.has(currentEntity.id)) continue;

      const cluster = [currentEntity];
      localProcessed.add(currentEntity.id);

      // Find entities with fuzzy similarity
      for (let j = i + 1; j < entities.length; j++) {
        const comparisonEntity = entities[j];
        if (!comparisonEntity || localProcessed.has(comparisonEntity.id)) continue;

        const similarity = this.getCachedSimilarity(currentEntity, comparisonEntity);
        if (similarity >= this.config.minSimilarity * 0.7) {
          cluster.push(comparisonEntity);
          localProcessed.add(comparisonEntity.id);
        }
      }

      if (cluster.length > 1 && cluster.length <= this.config.maxClusterSize) {
        const clusterObj = this.getClusterFromPool();
        this.populateCluster(clusterObj, cluster, currentEntity.type, false, false);
        clusters.push(clusterObj);
      }
    }

    return clusters;
  }

  /**
   * Advanced clustering with memory optimization
   */
  private async performAdvancedClusteringOptimized(
    initialClusters: DuplicateCluster[], 
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    // Filter out oversized clusters to save memory
    const validClusters = initialClusters.filter(
      cluster => cluster.entities.length <= this.config.maxClusterSize
    );
    
    this.emit('clustering-optimization', { 
      before: initialClusters.length, 
      after: validClusters.length 
    });
    
    switch (this.config.clusteringAlgorithm) {
      case 'hierarchical':
        return this.hierarchicalClusteringOptimized(validClusters);
      case 'density':
        return this.densityBasedClusteringOptimized(validClusters, entities);
      case 'hash':
      default:
        return this.optimizeHashClustersMemoryEfficient(validClusters);
    }
  }

  /**
   * Memory-optimized cluster merging
   */
  private mergeClustersOptimized(
    existingClusters: DuplicateCluster[], 
    newClusters: DuplicateCluster[]
  ): DuplicateCluster[] {
    const uniqueClusters: DuplicateCluster[] = [];
    
    // Create entity set for faster lookup
    const existingEntityIds = new Set(
      existingClusters.flatMap(c => c.entities.map(e => e.id))
    );

    for (const newCluster of newClusters) {
      const hasOverlap = newCluster.entities.some(e => existingEntityIds.has(e.id));
      
      if (!hasOverlap) {
        uniqueClusters.push(newCluster);
        newCluster.entities.forEach(e => existingEntityIds.add(e.id));
      } else {
        // Return unused cluster to pool
        this.returnClusterToPool(newCluster);
      }
    }

    return uniqueClusters;
  }

  /**
   * Hierarchical clustering with memory optimization
   */
  private async hierarchicalClusteringOptimized(clusters: DuplicateCluster[]): Promise<DuplicateCluster[]> {
    if (clusters.length === 0) return [];
    
    const mergedClusters: DuplicateCluster[] = [];
    const processed = new Set<string>();

    for (const cluster of clusters) {
      if (processed.has(cluster.id)) continue;

      const mergedCluster = { ...cluster };
      processed.add(cluster.id);

      // Only merge with highly similar clusters to maintain quality
      for (const otherCluster of clusters) {
        if (otherCluster.id === cluster.id || processed.has(otherCluster.id)) {
          continue;
        }

        if (this.shouldMergeClusters(cluster, otherCluster) && 
            cluster.similarity >= 0.9 && otherCluster.similarity >= 0.9) {
          
          // Check size limit before merging
          if (mergedCluster.entities.length + otherCluster.entities.length <= this.config.maxClusterSize) {
            mergedCluster.entities.push(...otherCluster.entities);
            mergedCluster.similarity = Math.min(mergedCluster.similarity, otherCluster.similarity);
            processed.add(otherCluster.id);
            
            // Return merged cluster to pool
            this.returnClusterToPool(otherCluster);
          }
        }
      }

      // Recalculate cluster properties
      mergedCluster.severity = this.calculateSeverity(mergedCluster.entities);
      mergedClusters.push(mergedCluster);
    }

    return mergedClusters;
  }

  /**
   * Density-based clustering with memory optimization
   */
  private async densityBasedClusteringOptimized(
    clusters: DuplicateCluster[], 
    entities: EntityInfo[]
  ): Promise<DuplicateCluster[]> {
    // Simplified implementation to reduce memory usage
    return clusters.filter(cluster => 
      cluster.entities.length >= 2 && 
      cluster.entities.length <= this.config.maxClusterSize
    );
  }

  /**
   * Memory-efficient hash cluster optimization
   */
  private optimizeHashClustersMemoryEfficient(clusters: DuplicateCluster[]): DuplicateCluster[] {
    return clusters
      .filter(cluster => 
        cluster.entities.length > 1 && 
        cluster.entities.length <= this.config.maxClusterSize
      )
      .sort((a, b) => {
        // Prioritize high similarity and reasonable size
        const scoreA = a.similarity * (1 / Math.log(a.entities.length + 1));
        const scoreB = b.similarity * (1 / Math.log(b.entities.length + 1));
        return scoreB - scoreA;
      })
      .slice(0, 1000); // Limit to top 1000 clusters
  }

  /**
   * Optimize clusters - remove duplicates and sort by quality
   */
  private optimizeClusters(clusters: DuplicateCluster[]): DuplicateCluster[] {
    const uniqueClusters = new Map<string, DuplicateCluster>();
    
    for (const cluster of clusters) {
      const key = cluster.entities.map(e => e.id).sort().join('-');
      
      if (!uniqueClusters.has(key) || 
          uniqueClusters.get(key)!.similarity < cluster.similarity) {
        
        // Return previous cluster to pool if it exists
        const existingCluster = uniqueClusters.get(key);
        if (existingCluster) {
          this.returnClusterToPool(existingCluster);
        }
        
        uniqueClusters.set(key, cluster);
      } else {
        // Return duplicate cluster to pool
        this.returnClusterToPool(cluster);
      }
    }
    
    return Array.from(uniqueClusters.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2000); // Limit results to prevent memory issues
  }

  /**
   * Enhanced clusters with consolidation suggestions (memory optimized)
   */
  private enhanceClustersWithSuggestions(clusters: DuplicateCluster[]): DuplicateCluster[] {
    return clusters.map(cluster => {
      cluster.consolidationSuggestion = this.generateConsolidationSuggestion(cluster.entities, cluster.type);
      return cluster;
    });
  }

  /**
   * Group entities by type for efficient processing
   */
  private groupEntitiesByType(entities: EntityInfo[]): Map<string, EntityInfo[]> {
    const groups = new Map<string, EntityInfo[]>();

    entities.forEach(entity => {
      if (!groups.has(entity.type)) {
        groups.set(entity.type, []);
      }
      groups.get(entity.type)!.push(entity);
    });

    return groups;
  }

  /**
   * Get cached similarity between entities
   */
  private getCachedSimilarity(entity1: EntityInfo, entity2: EntityInfo): number {
    const cacheKey = entity1.id < entity2.id ? 
      `${entity1.id}-${entity2.id}` : 
      `${entity2.id}-${entity1.id}`;
    
    if (this.similarityCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.similarityCache.get(cacheKey)!;
    }
    
    const similarity = this.calculateFuzzySimilarity(entity1, entity2);
    
    // Limit cache size to prevent memory bloat
    if (this.similarityCache.size < 50000) {
      this.similarityCache.set(cacheKey, similarity);
    }
    
    return similarity;
  }

  /**
   * Calculate fuzzy similarity using various string metrics
   */
  private calculateFuzzySimilarity(entity1: EntityInfo, entity2: EntityInfo): number {
    if (entity1.type !== entity2.type) return 0;

    let similarity = 0;
    let factors = 0;

    // Name similarity (Jaccard similarity)
    const nameSim = this.calculateStringSimilarity(entity1.name, entity2.name);
    similarity += nameSim;
    factors++;

    // Signature similarity
    if (entity1.signature && entity2.signature) {
      const sigSim = this.calculateStringSimilarity(entity1.signature, entity2.signature);
      similarity += sigSim;
      factors++;
    }

    // JSDoc similarity (lower weight)
    if (entity1.jsDoc && entity2.jsDoc) {
      const jsdocSim = this.calculateStringSimilarity(entity1.jsDoc, entity2.jsDoc);
      similarity += jsdocSim * 0.5;
      factors += 0.5;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate string similarity using Jaccard similarity
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const tokens1 = new Set(str1.toLowerCase().split(/\W+/).filter(t => t.length > 2));
    const tokens2 = new Set(str2.toLowerCase().split(/\W+/).filter(t => t.length > 2));
    
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate duplicate cluster severity
   */
  private calculateSeverity(entities: EntityInfo[]): SeverityLevel {
    const count = entities.length;
    const totalComplexity = entities.reduce(
      (sum, e) => sum + (e.complexity?.cyclomatic || 0), 
      0
    );
    const avgDependencies = entities.reduce(
      (sum, e) => sum + e.dependencies.length, 
      0
    ) / count;

    if (count > 5 || totalComplexity > 150 || avgDependencies > 20) {
      return 'critical';
    } else if (count > 3 || totalComplexity > 80 || avgDependencies > 15) {
      return 'high';
    } else if (count > 2 || totalComplexity > 30 || avgDependencies > 8) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate consolidation suggestion for a cluster
   */
  private generateConsolidationSuggestion(
    entities: EntityInfo[], 
    entityType: EntityType
  ): ConsolidationSuggestion {
    if (entities.length === 0) {
      throw new Error('Cannot generate suggestion for empty entity list');
    }
    const primaryEntity = entities[0];
    if (!primaryEntity) {
      throw new Error('Primary entity is undefined');
    }
    
    let strategy: 'merge' | 'extract' | 'refactor';
    if (entityType === 'interface' || entityType === 'type') {
      strategy = 'merge';
    } else if (entityType === 'class' || entityType === 'service') {
      strategy = 'extract';
    } else {
      strategy = 'refactor';
    }

    const estimatedEffort = entities.length > 5 ? 'high' : 
                          entities.length > 3 ? 'medium' : 'low';

    const steps = this.generateConsolidationSteps(strategy, entities);

    return {
      strategy,
      targetFile: primaryEntity.file,
      estimatedEffort,
      impact: `Consolidating ${entities.length} duplicate ${entityType}s will reduce maintenance burden and improve consistency`,
      steps
    };
  }

  /**
   * Generate consolidation steps based on strategy
   */
  private generateConsolidationSteps(
    strategy: 'merge' | 'extract' | 'refactor', 
    entities: EntityInfo[]
  ): string[] {
    const baseSteps = [
      'Review all duplicate implementations for functional differences',
      'Identify the most complete and well-tested implementation',
      'Create comprehensive test coverage for the consolidated version'
    ];

    switch (strategy) {
      case 'merge':
        return [
          ...baseSteps,
          'Merge interface/type definitions into a single declaration',
          'Update all import statements to reference the consolidated version',
          'Remove duplicate definitions',
          'Verify type compatibility across all usage sites'
        ];

      case 'extract':
        return [
          ...baseSteps,
          'Extract common functionality into a shared base class or utility',
          'Update duplicate classes to inherit from or use the extracted code',
          'Refactor specific implementations to extend base functionality',
          'Update dependency injection and service registration'
        ];

      case 'refactor':
        return [
          ...baseSteps,
          'Choose the best implementation as the canonical version',
          'Refactor duplicate functions to call the canonical implementation',
          'Update all call sites to use the consolidated function',
          'Remove duplicate implementations and update exports'
        ];

      default:
        return baseSteps;
    }
  }

  /**
   * Should merge clusters based on similarity and type
   */
  private shouldMergeClusters(cluster1: DuplicateCluster, cluster2: DuplicateCluster): boolean {
    return (
      cluster1.type === cluster2.type &&
      cluster1.similarity >= 0.8 &&
      cluster2.similarity >= 0.8 &&
      !this.clustersOverlap(cluster1, cluster2)
    );
  }

  /**
   * Check if two clusters overlap
   */
  private clustersOverlap(cluster1: DuplicateCluster, cluster2: DuplicateCluster): boolean {
    const entities1 = new Set(cluster1.entities.map(e => e.id));
    const entities2 = new Set(cluster2.entities.map(e => e.id));
    
    for (const entityId of entities1) {
      if (entities2.has(entityId)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get cluster from pool or create new
   */
  private getClusterFromPool(): DuplicateCluster {
    const cluster = this.clusterPool.pop();
    if (cluster) {
      return cluster;
    }
    
    return this.createEmptyCluster();
  }

  /**
   * Return cluster to pool
   */
  private returnClusterToPool(cluster: DuplicateCluster): void {
    if (this.clusterPool.length < 200) {
      this.resetCluster(cluster);
      this.clusterPool.push(cluster);
    }
  }

  /**
   * Create empty cluster
   */
  private createEmptyCluster(): DuplicateCluster {
    return {
      id: '',
      hash: '',
      type: 'function' as EntityType,
      severity: 'low' as SeverityLevel,
      entities: [],
      structuralMatch: false,
      semanticMatch: false,
      similarity: 0
    };
  }

  /**
   * Reset cluster for reuse
   */
  private resetCluster(cluster: DuplicateCluster): void {
    cluster.id = '';
    cluster.hash = '';
    cluster.type = 'function' as EntityType; // Default type
    cluster.severity = 'low';
    cluster.entities.length = 0; // Clear array without creating new one
    cluster.structuralMatch = false;
    cluster.semanticMatch = false;
    cluster.similarity = 0;
    delete cluster.consolidationSuggestion;
  }

  /**
   * Populate cluster with data
   */
  private populateCluster(
    cluster: DuplicateCluster,
    entities: EntityInfo[],
    type: EntityType,
    structuralMatch: boolean,
    semanticMatch: boolean
  ): void {
    cluster.id = createId();
    cluster.hash = generateNormalizedHash(entities.map(e => e.id).sort());
    cluster.type = type;
    cluster.severity = this.calculateSeverity(entities);
    cluster.entities = entities;
    cluster.structuralMatch = structuralMatch;
    cluster.semanticMatch = semanticMatch;
    cluster.similarity = this.calculateAverageSimilarityOptimized(entities);
  }

  /**
   * Calculate average similarity with optimization
   */
  private calculateAverageSimilarityOptimized(entities: EntityInfo[]): number {
    if (entities.length < 2) return 1.0;
    if (entities.length > 10) return 0.85; // Estimate for large clusters

    let totalSimilarity = 0;
    let pairs = 0;

    // Sample pairs instead of all pairs for large clusters
    const maxPairs = Math.min(15, (entities.length * (entities.length - 1)) / 2);
    
    for (let i = 0; i < entities.length && pairs < maxPairs; i++) {
      const entityI = entities[i];
      if (!entityI) continue;
      for (let j = i + 1; j < entities.length && pairs < maxPairs; j++) {
        const entityJ = entities[j];
        if (!entityJ) continue;
        totalSimilarity += this.getCachedSimilarity(entityI, entityJ);
        pairs++;
      }
    }

    return pairs > 0 ? totalSimilarity / pairs : 0;
  }

  /**
   * Perform memory maintenance
   */
  private async performMemoryMaintenance(): Promise<void> {
    const memUsage = process.memoryUsage();
    this.stats.memoryPeakUsage = Math.max(this.stats.memoryPeakUsage, memUsage.heapUsed);
    
    if (memUsage.heapUsed > this.config.maxMemoryUsage * 0.8) {
      this.forceCleanup();
      
      // Wait for garbage collection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.emit('memory-maintenance', {
        beforeMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        afterMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      });
    }
  }

  /**
   * Force cleanup when memory pressure is high
   */
  private forceCleanup(): void {
    // Clear caches
    this.hashCache.clear();
    this.similarityCache.clear();
    this.processed.clear();
    
    // Trim cluster pool
    this.clusterPool.length = Math.min(this.clusterPool.length, 50);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    this.emit('memory-cleanup', {
      hashCacheCleared: true,
      similarityCacheCleared: true,
      clusterPoolTrimmed: true
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.hashCache.clear();
    this.similarityCache.clear();
    this.processed.clear();
    this.clusterPool.length = 0;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      stats: { ...this.stats },
      workerPoolMetrics: this.workerPool.getMetrics(),
      memoryMetrics: this.memoryMonitor.getMetrics(),
      cacheStats: {
        hashCacheSize: this.hashCache.size,
        similarityCacheSize: this.similarityCache.size,
        clusterPoolSize: this.clusterPool.length
      }
    };
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.emit('shutdown-started');
    
    await this.workerPool.shutdown(30000); // 30 second timeout
    this.memoryMonitor.cleanup();
    this.cleanup();
    this.removeAllListeners();
    
    this.emit('shutdown-completed');
  }
}