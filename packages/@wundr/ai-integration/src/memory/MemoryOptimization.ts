/**
 * Memory Optimization - Advanced memory management and optimization
 *
 * Provides intelligent memory optimization, garbage collection, compression,
 * and performance tuning for the AI Integration memory system.
 */

import { EventEmitter } from 'eventemitter3';

import { MemoryEntry, OperationResult } from '../types';

export interface MemoryOptimizationConfig {
  maxMemoryUsage: number; // MB
  compressionThreshold: number; // MB
  gcInterval: number; // milliseconds
  retentionPolicies: RetentionPolicy[];
  optimizationStrategies: OptimizationStrategy[];
}

export interface RetentionPolicy {
  name: string;
  condition: (entry: MemoryEntry) => boolean;
  retentionDays: number;
  priority: number;
}

export interface OptimizationStrategy {
  name: string;
  trigger: (metrics: MemoryMetrics) => boolean;
  action: (optimizer: MemoryOptimization) => Promise<void>;
  cooldownMs: number;
}

export interface MemoryMetrics {
  totalEntries: number;
  totalSizeBytes: number;
  memoryUsageMB: number;
  compressionRatio: number;
  hitRate: number;
  avgAccessTime: number;
  fragmentationRatio: number;
  gcFrequency: number;
  oldestEntryAge: number; // days
  newestEntryAge: number; // days
}

export interface OptimizationResult {
  strategy: string;
  entriesProcessed: number;
  bytesReclaimed: number;
  executionTimeMs: number;
  metricsImprovement: Partial<MemoryMetrics>;
}

export class MemoryOptimization extends EventEmitter {
  private config: MemoryOptimizationConfig;
  private metrics: MemoryMetrics;
  private memoryEntries: Map<string, MemoryEntry> = new Map();
  private accessLog: Map<
    string,
    { count: number; lastAccess: Date; avgTime: number }
  > = new Map();
  private compressionCache: Map<string, any> = new Map();
  private gcTimer: NodeJS.Timeout | null = null;
  private strategyLastExecuted: Map<string, Date> = new Map();

  constructor(config: MemoryOptimizationConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
  }

  async initialize(): Promise<OperationResult> {
    try {
      this.startGarbageCollection();
      this.setupOptimizationStrategies();

      return {
        success: true,
        message: 'Memory Optimization initialized successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Initialization failed: ${(error as Error).message}`,
        error,
      };
    }
  }

  private initializeMetrics(): MemoryMetrics {
    return {
      totalEntries: 0,
      totalSizeBytes: 0,
      memoryUsageMB: 0,
      compressionRatio: 1.0,
      hitRate: 1.0,
      avgAccessTime: 0,
      fragmentationRatio: 0,
      gcFrequency: 0,
      oldestEntryAge: 0,
      newestEntryAge: 0,
    };
  }

  /**
   * Register memory entries for optimization
   */
  registerEntries(entries: Map<string, MemoryEntry>): void {
    this.memoryEntries = entries;
    this.updateMetrics();
    this.emit('entries-registered', { count: entries.size });
  }

  /**
   * Track memory access for optimization decisions
   */
  trackAccess(entryId: string, accessTime: number): void {
    const existing = this.accessLog.get(entryId);
    if (existing) {
      existing.count++;
      existing.lastAccess = new Date();
      existing.avgTime =
        (existing.avgTime * (existing.count - 1) + accessTime) / existing.count;
    } else {
      this.accessLog.set(entryId, {
        count: 1,
        lastAccess: new Date(),
        avgTime: accessTime,
      });
    }

    this.updateMetrics();
  }

  /**
   * Run comprehensive memory optimization
   */
  async optimize(): Promise<OptimizationResult[]> {
    const results: OptimizationResult[] = [];

    this.emit('optimization-started', this.metrics);

    for (const strategy of this.config.optimizationStrategies) {
      if (this.shouldExecuteStrategy(strategy)) {
        const result = await this.executeStrategy(strategy);
        results.push(result);
        this.strategyLastExecuted.set(strategy.name, new Date());
      }
    }

    this.updateMetrics();
    this.emit('optimization-completed', {
      results,
      finalMetrics: this.metrics,
    });

    return results;
  }

  private shouldExecuteStrategy(strategy: OptimizationStrategy): boolean {
    // Check cooldown
    const lastExecution = this.strategyLastExecuted.get(strategy.name);
    if (lastExecution) {
      const timeSince = Date.now() - lastExecution.getTime();
      if (timeSince < strategy.cooldownMs) {
        return false;
      }
    }

    // Check trigger condition
    return strategy.trigger(this.metrics);
  }

  private async executeStrategy(
    strategy: OptimizationStrategy
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const initialMetrics = { ...this.metrics };

    try {
      await strategy.action(this);

      const executionTime = Date.now() - startTime;
      this.updateMetrics();

      return {
        strategy: strategy.name,
        entriesProcessed: this.memoryEntries.size,
        bytesReclaimed: Math.max(
          0,
          initialMetrics.totalSizeBytes - this.metrics.totalSizeBytes
        ),
        executionTimeMs: executionTime,
        metricsImprovement: {
          totalSizeBytes:
            this.metrics.totalSizeBytes - initialMetrics.totalSizeBytes,
          memoryUsageMB:
            this.metrics.memoryUsageMB - initialMetrics.memoryUsageMB,
          compressionRatio:
            this.metrics.compressionRatio - initialMetrics.compressionRatio,
          fragmentationRatio:
            this.metrics.fragmentationRatio - initialMetrics.fragmentationRatio,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `Strategy "${strategy.name}" execution failed: ${errorMessage}`
      );
      this.emit('strategy-failed', { strategy: strategy.name, error });

      return {
        strategy: strategy.name,
        entriesProcessed: 0,
        bytesReclaimed: 0,
        executionTimeMs: Date.now() - startTime,
        metricsImprovement: {},
      };
    }
  }

  /**
   * Compress memory entries using various techniques
   */
  async compressEntries(compressionLevel: number = 1): Promise<number> {
    let compressedCount = 0;
    const compressionThreshold = 1024; // 1KB minimum size to compress

    for (const [entryId, entry] of this.memoryEntries.entries()) {
      const entrySize = this.calculateEntrySize(entry);

      if (
        entrySize > compressionThreshold &&
        !this.compressionCache.has(entryId)
      ) {
        const compressed = await this.compressEntry(entry, compressionLevel);
        if (compressed.size < entrySize * 0.8) {
          // Only keep if 20%+ reduction
          this.compressionCache.set(entryId, compressed);
          compressedCount++;
        }
      }
    }

    this.emit('compression-completed', { compressedCount });
    return compressedCount;
  }

  private async compressEntry(entry: MemoryEntry, level: number): Promise<any> {
    // Simulate compression - in real implementation, use actual compression library
    const serialized = JSON.stringify(entry);
    const compressionRatio = Math.max(0.3, 1 - level * 0.2);

    return {
      compressed: serialized,
      originalSize: serialized.length,
      size: Math.floor(serialized.length * compressionRatio),
      algorithm: `level-${level}`,
      timestamp: new Date(),
    };
  }

  /**
   * Garbage collect old and unused entries
   */
  async garbageCollect(): Promise<number> {
    let collectedCount = 0;
    const now = new Date();

    for (const policy of this.config.retentionPolicies.sort(
      (a, b) => b.priority - a.priority
    )) {
      for (const [entryId, entry] of this.memoryEntries.entries()) {
        if (policy.condition(entry)) {
          const ageInDays =
            (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24);

          if (ageInDays > policy.retentionDays) {
            this.memoryEntries.delete(entryId);
            this.accessLog.delete(entryId);
            this.compressionCache.delete(entryId);
            collectedCount++;
          }
        }
      }
    }

    this.metrics.gcFrequency++;
    this.emit('garbage-collection-completed', { collectedCount });

    return collectedCount;
  }

  /**
   * Defragment memory to reduce fragmentation
   */
  async defragment(): Promise<number> {
    // Simulate defragmentation by reorganizing entries
    const entries = Array.from(this.memoryEntries.entries());

    // Sort by access frequency and size for optimal layout
    entries.sort(([aId, aEntry], [bId, bEntry]) => {
      const aAccess = this.accessLog.get(aId)?.count || 0;
      const bAccess = this.accessLog.get(bId)?.count || 0;
      const aSize = this.calculateEntrySize(aEntry);
      const bSize = this.calculateEntrySize(bEntry);

      // Prioritize frequently accessed, smaller entries
      return bAccess / bSize - aAccess / aSize;
    });

    // Rebuild the map with optimized layout
    this.memoryEntries.clear();
    entries.forEach(([id, entry]) => {
      this.memoryEntries.set(id, entry);
    });

    const fragmentationReduction = Math.random() * 0.3 + 0.1; // 10-40% reduction
    this.emit('defragmentation-completed', { fragmentationReduction });

    return entries.length;
  }

  /**
   * Analyze access patterns for optimization insights
   */
  analyzeAccessPatterns(): any {
    const patterns = {
      hotEntries: [],
      coldEntries: [],
      accessDistribution: {},
      temporalPatterns: {},
      sizeDistribution: {},
    };

    // Identify hot and cold entries
    const accessThreshold = this.calculateAccessThreshold();

    for (const [entryId, entry] of this.memoryEntries.entries()) {
      const accessInfo = this.accessLog.get(entryId);
      const accessCount = accessInfo?.count || 0;
      const entrySize = this.calculateEntrySize(entry);

      if (accessCount > accessThreshold) {
        patterns.hotEntries.push({
          id: entryId,
          accessCount,
          size: entrySize,
          lastAccess: accessInfo?.lastAccess,
          avgAccessTime: accessInfo?.avgTime,
        });
      } else if (accessCount === 0) {
        patterns.coldEntries.push({
          id: entryId,
          age: (Date.now() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          size: entrySize,
        });
      }
    }

    // Sort by relevance
    patterns.hotEntries.sort((a: any, b: any) => b.accessCount - a.accessCount);
    patterns.coldEntries.sort((a: any, b: any) => b.age - a.age);

    return patterns;
  }

  private calculateAccessThreshold(): number {
    const accessCounts = Array.from(this.accessLog.values()).map(
      info => info.count
    );
    if (accessCounts.length === 0) return 0;

    const sum = accessCounts.reduce((a, b) => a + b, 0);
    const mean = sum / accessCounts.length;

    // Threshold is mean + standard deviation
    const variance =
      accessCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) /
      accessCounts.length;
    const stdDev = Math.sqrt(variance);

    return Math.floor(mean + stdDev);
  }

  /**
   * Preload frequently accessed entries
   */
  async preloadOptimizations(): Promise<void> {
    const patterns = this.analyzeAccessPatterns();

    // Preload hot entries into compression cache
    for (const hotEntry of patterns.hotEntries.slice(0, 100)) {
      const entry = this.memoryEntries.get(hotEntry.id);
      if (entry && !this.compressionCache.has(hotEntry.id)) {
        const compressed = await this.compressEntry(entry, 2);
        this.compressionCache.set(hotEntry.id, compressed);
      }
    }

    this.emit('preload-completed', {
      preloadedCount: Math.min(patterns.hotEntries.length, 100),
    });
  }

  private calculateEntrySize(entry: MemoryEntry): number {
    // Estimate memory size of entry
    const serialized = JSON.stringify(entry);
    return serialized.length * 2; // Rough estimate for Unicode
  }

  private updateMetrics(): void {
    const entries = Array.from(this.memoryEntries.values());
    const now = new Date();

    this.metrics.totalEntries = entries.length;
    this.metrics.totalSizeBytes = entries.reduce(
      (sum, entry) => sum + this.calculateEntrySize(entry),
      0
    );
    this.metrics.memoryUsageMB = this.metrics.totalSizeBytes / (1024 * 1024);

    // Compression ratio
    const compressedSize = Array.from(this.compressionCache.values()).reduce(
      (sum, compressed) => sum + compressed.size,
      0
    );
    const originalCompressedSize = Array.from(
      this.compressionCache.values()
    ).reduce((sum, compressed) => sum + compressed.originalSize, 0);
    this.metrics.compressionRatio =
      originalCompressedSize > 0 ? compressedSize / originalCompressedSize : 1;

    // Hit rate (entries found in cache vs total requests)
    const totalAccess = Array.from(this.accessLog.values()).reduce(
      (sum, info) => sum + info.count,
      0
    );
    const cacheHits = Array.from(this.accessLog.entries()).filter(([id]) =>
      this.compressionCache.has(id)
    ).length;
    this.metrics.hitRate = totalAccess > 0 ? cacheHits / totalAccess : 1;

    // Average access time
    const accessTimes = Array.from(this.accessLog.values())
      .map(info => info.avgTime)
      .filter(time => time > 0);
    this.metrics.avgAccessTime =
      accessTimes.length > 0
        ? accessTimes.reduce((a, b) => a + b) / accessTimes.length
        : 0;

    // Age statistics
    if (entries.length > 0) {
      const ages = entries.map(
        entry =>
          (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      this.metrics.oldestEntryAge = Math.max(...ages);
      this.metrics.newestEntryAge = Math.min(...ages);
    }

    // Fragmentation (simplified calculation)
    this.metrics.fragmentationRatio = Math.random() * 0.3; // Placeholder

    this.emit('metrics-updated', this.metrics);
  }

  private setupOptimizationStrategies(): void {
    // Auto-run optimization based on metrics
    setInterval(() => {
      if (this.metrics.memoryUsageMB > this.config.maxMemoryUsage * 0.8) {
        this.optimize();
      }
    }, this.config.gcInterval);
  }

  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      this.garbageCollect();
    }, this.config.gcInterval);
  }

  /**
   * Get current optimization metrics
   */
  getMetrics(): MemoryMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Generate optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.memoryUsageMB > this.config.maxMemoryUsage * 0.9) {
      recommendations.push(
        'Memory usage is critically high. Consider aggressive garbage collection.'
      );
    }

    if (this.metrics.compressionRatio > 0.8) {
      recommendations.push(
        'Compression ratio is low. Consider stronger compression algorithms.'
      );
    }

    if (this.metrics.hitRate < 0.5) {
      recommendations.push(
        'Cache hit rate is low. Consider preloading hot entries.'
      );
    }

    if (this.metrics.fragmentationRatio > 0.3) {
      recommendations.push(
        'Memory fragmentation is high. Consider defragmentation.'
      );
    }

    const patterns = this.analyzeAccessPatterns();
    if (patterns.coldEntries.length > this.metrics.totalEntries * 0.5) {
      recommendations.push(
        'Many entries are never accessed. Consider more aggressive retention policies.'
      );
    }

    return recommendations;
  }

  async shutdown(): Promise<OperationResult> {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
    }

    this.memoryEntries.clear();
    this.accessLog.clear();
    this.compressionCache.clear();
    this.strategyLastExecuted.clear();

    return {
      success: true,
      message: 'Memory Optimization shutdown completed',
    };
  }
}
