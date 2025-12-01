/**
 * Memory Optimization Performance Benchmark Test
 * Tests and measures memory improvements from optimizations
 */

import { OptimizedDuplicateDetectionEngine } from '../../src/engines/DuplicateDetectionEngineOptimized';
import { DuplicateDetectionEngine } from '../../src/engines/DuplicateDetectionEngine';
import { WorkerPoolManager } from '../../src/workers/WorkerPoolManager';
import { MemoryMonitor } from '../../src/monitoring/MemoryMonitor';
import { EntityInfo, AnalysisConfig } from '../../src/types';
import * as fs from 'fs-extra';
import * as path from 'path';

interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    leaked: number;
  };
  entitiesProcessed: number;
  clustersFound: number;
  cacheHits?: number;
  workerMetrics?: any;
}

interface ComparisonReport {
  optimized: BenchmarkResult;
  standard: BenchmarkResult;
  improvements: {
    speedImprovement: number;
    memoryReduction: number;
    leakReduction: number;
    throughputImprovement: number;
  };
  summary: string[];
}

describe('Memory Optimization Integration Tests', () => {
  let optimizedEngine: OptimizedDuplicateDetectionEngine;
  let standardEngine: DuplicateDetectionEngine;
  let memoryMonitor: MemoryMonitor;
  let workerPool: WorkerPoolManager;

  const testEntities: EntityInfo[] = generateTestEntities(10000); // Large dataset
  const outputDir = path.join(__dirname, '../../test-output/benchmark-results');

  beforeAll(async () => {
    await fs.ensureDir(outputDir);
    console.log(`📊 Starting comprehensive memory optimization benchmark`);
    console.log(`📁 Results will be saved to: ${outputDir}`);
  });

  beforeEach(async () => {
    // Force garbage collection before each test
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  });

  afterEach(async () => {
    // Cleanup after each test
    if (optimizedEngine) {
      await optimizedEngine.shutdown();
    }
    if (memoryMonitor) {
      memoryMonitor.cleanup();
    }
    if (workerPool) {
      await workerPool.shutdown();
    }
  });

  test('🧪 Memory Monitor Real-time Tracking', async () => {
    console.log('\n🔬 Testing Memory Monitor functionality...');

    memoryMonitor = new MemoryMonitor({
      snapshotInterval: 1000,
      maxSnapshots: 50,
      thresholds: {
        heapWarning: 50 * 1024 * 1024, // 50MB
        heapCritical: 100 * 1024 * 1024, // 100MB
      },
    });

    let alertsReceived = 0;
    let snapshotsTaken = 0;

    memoryMonitor.on('memory-alert', alert => {
      console.log(
        `⚠️  Memory Alert: ${alert.type} - ${Math.round(alert.current / 1024 / 1024)}MB`
      );
      alertsReceived++;
    });

    memoryMonitor.on('snapshot-taken', () => {
      snapshotsTaken++;
    });

    await memoryMonitor.startMonitoring();

    // Simulate memory usage with large arrays
    const memoryHogs = [];
    for (let i = 0; i < 10; i++) {
      memoryHogs.push(new Array(1000000).fill(i)); // 1M elements each
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const metrics = memoryMonitor.getMetrics();

    expect(snapshotsTaken).toBeGreaterThan(0);
    expect(metrics.current.heapUsed).toBeGreaterThan(0);
    expect(metrics.peak.heapUsed).toBeGreaterThanOrEqual(
      metrics.current.heapUsed
    );

    console.log(
      `✅ Memory Monitor: ${snapshotsTaken} snapshots, peak: ${Math.round(metrics.peak.heapUsed / 1024 / 1024)}MB`
    );

    // Export monitoring data
    const exportPath = await memoryMonitor.exportData('json');
    console.log(`📄 Memory data exported to: ${exportPath}`);
  });

  test('⚡ Worker Pool Manager Concurrency Test', async () => {
    console.log('\n🔧 Testing Worker Pool Manager with 30+ workers...');

    workerPool = new WorkerPoolManager({
      minWorkers: 4,
      maxWorkers: 32, // Target 30+ workers
      enableAutoScaling: true,
      resourceThresholds: {
        cpu: 0.8,
        memory: 0.85,
      },
      workerScript: path.join(
        __dirname,
        '../../src/workers/analysis-worker.js'
      ),
    });

    // Create many concurrent tasks
    const tasks = [];
    for (let i = 0; i < 100; i++) {
      tasks.push({
        id: `test-task-${i}`,
        type: 'duplicate-detection',
        data: { entities: testEntities.slice(i * 50, (i + 1) * 50) },
        priority: 'medium' as const,
      });
    }

    console.log(`🏃‍♂️ Submitting ${tasks.length} tasks to worker pool...`);

    const startTime = Date.now();
    const results = await workerPool.processBatch(tasks, 20);
    const duration = Date.now() - startTime;

    const metrics = workerPool.getMetrics();
    const status = workerPool.getStatus();

    expect(results.length).toBe(tasks.length);
    expect(metrics.completedTasks).toBeGreaterThan(0);
    expect(status.workers.length).toBeGreaterThanOrEqual(4);

    console.log(
      `✅ Worker Pool: ${status.workers.length} workers, ${results.length} tasks completed in ${duration}ms`
    );
    console.log(`📈 Throughput: ${metrics.throughput.toFixed(2)} tasks/second`);
    console.log(
      `📊 Success Rate: ${((1 - metrics.errorRate) * 100).toFixed(1)}%`
    );

    // Save detailed metrics
    await fs.writeJSON(
      path.join(outputDir, 'worker-pool-metrics.json'),
      {
        duration,
        tasksCompleted: results.length,
        workers: status.workers.length,
        metrics,
        timestamp: new Date().toISOString(),
      },
      { spaces: 2 }
    );
  });

  test('🔥 Optimized vs Standard Duplicate Detection Performance', async () => {
    console.log(
      '\n⚔️  Benchmarking Optimized vs Standard Duplicate Detection...'
    );

    // Test with standard engine
    console.log('🐢 Testing Standard Engine...');
    const standardResult = await runDuplicateDetectionBenchmark(
      'standard',
      () => new DuplicateDetectionEngine(),
      testEntities
    );

    // Test with optimized engine
    console.log('🚀 Testing Optimized Engine...');
    const optimizedResult = await runDuplicateDetectionBenchmark(
      'optimized',
      () =>
        new OptimizedDuplicateDetectionEngine({
          enableStreaming: true,
          maxMemoryUsage: 150 * 1024 * 1024,
          enableSemanticAnalysis: true,
          streamingBatchSize: 1000,
        }),
      testEntities
    );

    // Calculate improvements
    const comparison = generateComparisonReport(
      optimizedResult,
      standardResult
    );

    console.log('\n📊 PERFORMANCE COMPARISON RESULTS:');
    comparison.summary.forEach(line => console.log(`   ${line}`));

    // Save detailed comparison report
    await fs.writeJSON(
      path.join(outputDir, 'performance-comparison.json'),
      comparison,
      { spaces: 2 }
    );

    // Verify improvements
    expect(comparison.improvements.memoryReduction).toBeGreaterThan(0);
    expect(comparison.improvements.speedImprovement).toBeGreaterThan(0);
    expect(optimizedResult.clustersFound).toBeGreaterThanOrEqual(
      standardResult.clustersFound
    );

    console.log(
      `\n✅ Memory optimization delivers ${comparison.improvements.memoryReduction.toFixed(1)}% memory reduction!`
    );
    console.log(
      `✅ Performance improved by ${comparison.improvements.speedImprovement.toFixed(1)}%!`
    );
  });

  test('🧠 Memory Leak Detection and Cleanup', async () => {
    console.log('\n🕵️ Testing Memory Leak Detection...');

    optimizedEngine = new OptimizedDuplicateDetectionEngine({
      maxMemoryUsage: 100 * 1024 * 1024, // Low limit to trigger cleanup
      enableStreaming: true,
    });

    memoryMonitor = new MemoryMonitor({
      snapshotInterval: 1000,
      thresholds: {
        heapWarning: 50 * 1024 * 1024,
        heapCritical: 90 * 1024 * 1024,
        growthRateWarning: 5 * 1024 * 1024,
        growthRateCritical: 20 * 1024 * 1024,
      },
    });

    let leakDetected = false;
    let memoryAlertsCount = 0;
    let cleanupTriggered = false;

    optimizedEngine.on('memory-leak', () => {
      leakDetected = true;
      console.log('🚨 Memory leak detected by optimized engine');
    });

    optimizedEngine.on('memory-cleanup', () => {
      cleanupTriggered = true;
      console.log('🧹 Memory cleanup triggered');
    });

    memoryMonitor.on('memory-alert', () => {
      memoryAlertsCount++;
    });

    await memoryMonitor.startMonitoring();

    // Run multiple analysis cycles to stress memory
    for (let i = 0; i < 5; i++) {
      console.log(`   Running analysis cycle ${i + 1}/5...`);
      await optimizedEngine.analyze(testEntities, { targetDir: './test' });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const leakAnalysis = memoryMonitor.detectMemoryLeaks();
    const metrics = optimizedEngine.getMetrics();

    console.log(
      `🔍 Memory growth rate: ${(leakAnalysis.growthRate / 1024 / 1024).toFixed(2)} MB/s`
    );
    console.log(`📊 Cache hits: ${metrics.stats.cacheHits}`);
    console.log(`🧠 Memory alerts: ${memoryAlertsCount}`);

    // Save leak detection results
    await fs.writeJSON(
      path.join(outputDir, 'memory-leak-analysis.json'),
      {
        leakAnalysis,
        metrics: metrics.stats,
        memoryMetrics: metrics.memoryMetrics,
        cleanupTriggered,
        timestamp: new Date().toISOString(),
      },
      { spaces: 2 }
    );

    expect(leakAnalysis.growthRate).toBeLessThan(10 * 1024 * 1024); // Less than 10MB/s growth
    expect(metrics.stats.entitiesProcessed).toBeGreaterThan(0);
  });

  test('📈 Streaming Performance with Large Dataset', async () => {
    console.log('\n🌊 Testing Streaming Performance with 50K entities...');

    const largeDataset = generateTestEntities(50000);

    optimizedEngine = new OptimizedDuplicateDetectionEngine({
      enableStreaming: true,
      streamingBatchSize: 2000,
      maxMemoryUsage: 300 * 1024 * 1024,
      enableSemanticAnalysis: true,
    });

    memoryMonitor = new MemoryMonitor({
      snapshotInterval: 2000,
      maxSnapshots: 100,
    });

    let batchesProcessed = 0;
    let streamingStarted = false;

    optimizedEngine.on('streaming-analysis-started', () => {
      streamingStarted = true;
      console.log('🌊 Streaming analysis started');
    });

    optimizedEngine.on('batch-processed', progress => {
      batchesProcessed++;
      console.log(
        `   Batch ${batchesProcessed}: ${progress.processed}/${progress.total} entities (${progress.progress.toFixed(1)}%)`
      );
    });

    await memoryMonitor.startMonitoring();

    const startTime = Date.now();
    const results = await optimizedEngine.analyze(largeDataset, {
      targetDir: './test',
    });
    const duration = Date.now() - startTime;

    const memMetrics = memoryMonitor.getMetrics();
    const engineMetrics = optimizedEngine.getMetrics();

    console.log(
      `✅ Streaming completed: ${results.length} clusters in ${duration}ms`
    );
    console.log(`📊 Batches processed: ${batchesProcessed}`);
    console.log(
      `💾 Peak memory: ${Math.round(memMetrics.peak.heapUsed / 1024 / 1024)}MB`
    );
    console.log(
      `⚡ Throughput: ${Math.round(largeDataset.length / (duration / 1000))} entities/sec`
    );

    expect(streamingStarted).toBe(true);
    expect(batchesProcessed).toBeGreaterThan(0);
    expect(results.length).toBeGreaterThan(0);
    expect(memMetrics.peak.heapUsed).toBeLessThan(350 * 1024 * 1024); // Under 350MB

    // Save streaming performance metrics
    await fs.writeJSON(
      path.join(outputDir, 'streaming-performance.json'),
      {
        entitiesProcessed: largeDataset.length,
        clustersFound: results.length,
        duration,
        batchesProcessed,
        memoryMetrics: memMetrics,
        engineMetrics: engineMetrics.stats,
        throughput: largeDataset.length / (duration / 1000),
        timestamp: new Date().toISOString(),
      },
      { spaces: 2 }
    );
  });

  // Helper function to run benchmark
  async function runDuplicateDetectionBenchmark(
    name: string,
    engineFactory: () => any,
    entities: EntityInfo[]
  ): Promise<BenchmarkResult> {
    const engine = engineFactory();

    // Force GC before measurement
    if (global.gc) global.gc();
    const beforeMemory = process.memoryUsage();

    let peakMemory = beforeMemory;
    const memoryTracker = setInterval(() => {
      const current = process.memoryUsage();
      if (current.heapUsed > peakMemory.heapUsed) {
        peakMemory = current;
      }
    }, 100);

    const startTime = Date.now();
    const results = await engine.analyze(entities, { targetDir: './test' });
    const duration = Date.now() - startTime;

    clearInterval(memoryTracker);

    // Force GC and measure final memory
    if (global.gc) global.gc();
    await new Promise(resolve => setTimeout(resolve, 100));
    const afterMemory = process.memoryUsage();

    const metrics = engine.getMetrics ? engine.getMetrics() : {};

    if (engine.shutdown) {
      await engine.shutdown();
    }

    return {
      name,
      duration,
      memoryUsage: {
        before: beforeMemory,
        peak: peakMemory,
        after: afterMemory,
        leaked: afterMemory.heapUsed - beforeMemory.heapUsed,
      },
      entitiesProcessed: entities.length,
      clustersFound: results.length,
      cacheHits: metrics.stats?.cacheHits || 0,
      workerMetrics: metrics.workerPoolMetrics,
    };
  }

  function generateComparisonReport(
    optimized: BenchmarkResult,
    standard: BenchmarkResult
  ): ComparisonReport {
    const speedImprovement =
      ((standard.duration - optimized.duration) / standard.duration) * 100;
    const memoryReduction =
      ((standard.memoryUsage.peak.heapUsed -
        optimized.memoryUsage.peak.heapUsed) /
        standard.memoryUsage.peak.heapUsed) *
      100;
    const leakReduction =
      ((standard.memoryUsage.leaked - optimized.memoryUsage.leaked) /
        Math.max(1, standard.memoryUsage.leaked)) *
      100;
    const throughputImprovement =
      ((optimized.entitiesProcessed / optimized.duration -
        standard.entitiesProcessed / standard.duration) /
        (standard.entitiesProcessed / standard.duration)) *
      100;

    const summary = [
      `🚀 Speed Improvement: ${speedImprovement.toFixed(1)}% (${standard.duration}ms → ${optimized.duration}ms)`,
      `💾 Memory Reduction: ${memoryReduction.toFixed(1)}% (${Math.round(standard.memoryUsage.peak.heapUsed / 1024 / 1024)}MB → ${Math.round(optimized.memoryUsage.peak.heapUsed / 1024 / 1024)}MB)`,
      `🔒 Leak Reduction: ${leakReduction.toFixed(1)}% (${Math.round(standard.memoryUsage.leaked / 1024)}KB → ${Math.round(optimized.memoryUsage.leaked / 1024)}KB)`,
      `⚡ Throughput Improvement: ${throughputImprovement.toFixed(1)}%`,
      `📊 Clusters Found: Standard=${standard.clustersFound}, Optimized=${optimized.clustersFound}`,
      `🎯 Cache Hits: ${optimized.cacheHits} (optimized engine only)`,
    ];

    return {
      optimized,
      standard,
      improvements: {
        speedImprovement,
        memoryReduction,
        leakReduction,
        throughputImprovement,
      },
      summary,
    };
  }
});

// Helper function to generate test entities
function generateTestEntities(count: number): EntityInfo[] {
  const entities: EntityInfo[] = [];
  const types = ['function', 'class', 'interface', 'method', 'variable'];
  const namePatterns = [
    'Process',
    'Handle',
    'Manage',
    'Execute',
    'Create',
    'Update',
    'Delete',
    'Validate',
  ];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const pattern = namePatterns[i % namePatterns.length];

    // Create some duplicates intentionally
    const isDuplicate = i % 10 === 0 && i > 0;
    const baseIndex = isDuplicate ? i - 10 : i;

    entities.push({
      id: `entity-${i}`,
      name: isDuplicate
        ? `${pattern}Data${Math.floor(baseIndex / 100)}`
        : `${pattern}Data${Math.floor(i / 100)}`,
      type: type,
      file: `test-file-${Math.floor(i / 100)}.ts`,
      startLine: (i % 50) + 1,
      endLine: (i % 50) + 10,
      signature: isDuplicate
        ? `${pattern}Data${Math.floor(baseIndex / 100)}(): void`
        : `${pattern}Data${Math.floor(i / 100)}(): void`,
      dependencies: [`dep-${i % 20}`, `dep-${(i + 1) % 20}`],
      complexity: {
        cyclomatic: Math.floor(Math.random() * 10) + 1,
        cognitive: Math.floor(Math.random() * 15) + 1,
        halstead: {
          operators: Math.floor(Math.random() * 20) + 5,
          operands: Math.floor(Math.random() * 30) + 10,
          vocabulary: Math.floor(Math.random() * 50) + 15,
          length: Math.floor(Math.random() * 100) + 20,
          volume: Math.random() * 1000 + 100,
          difficulty: Math.random() * 20 + 5,
          effort: Math.random() * 5000 + 500,
        },
      },
    });
  }

  return entities;
}
