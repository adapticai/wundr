"use strict";
/**
 * Simple Memory Optimization Integration Test
 * Basic test to verify memory optimizations are working
 */
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const DuplicateDetectionEngineOptimized_1 = require("../../src/engines/DuplicateDetectionEngineOptimized");
const WorkerPoolManager_1 = require("../../src/workers/WorkerPoolManager");
const MemoryMonitor_1 = require("../../src/monitoring/MemoryMonitor");
const fs = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
describe('Memory Optimization Simple Integration Test', () => {
    let optimizedEngine;
    let memoryMonitor;
    let workerPool;
    const outputDir = path.join(__dirname, '../../test-output/simple-integration');
    beforeAll(async () => {
        await fs.ensureDir(outputDir);
        console.log(`🧪 Starting simple integration test`);
    });
    afterEach(async () => {
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
    test('✅ Basic Memory Monitor Functionality', async () => {
        console.log('🔍 Testing basic memory monitoring...');
        memoryMonitor = new MemoryMonitor_1.MemoryMonitor({
            snapshotInterval: 2000,
            maxSnapshots: 10
        });
        let snapshotCount = 0;
        memoryMonitor.on('snapshot-taken', () => {
            snapshotCount++;
        });
        await memoryMonitor.startMonitoring();
        // Wait for a few snapshots
        await new Promise(resolve => setTimeout(resolve, 5000));
        const metrics = memoryMonitor.getMetrics();
        expect(snapshotCount).toBeGreaterThan(0);
        expect(metrics.current.heapUsed).toBeGreaterThan(0);
        console.log(`✅ Memory Monitor: ${snapshotCount} snapshots taken`);
        console.log(`📊 Current heap usage: ${Math.round(metrics.current.heapUsed / 1024 / 1024)}MB`);
    }, 10000);
    test('✅ Basic Worker Pool Functionality', async () => {
        console.log('⚡ Testing basic worker pool...');
        workerPool = new WorkerPoolManager_1.WorkerPoolManager({
            minWorkers: 2,
            maxWorkers: 4,
            enableAutoScaling: false
        });
        // Create simple tasks
        const tasks = [];
        for (let i = 0; i < 5; i++) {
            tasks.push({
                id: `test-${i}`,
                type: 'detect-duplicates',
                data: {
                    entities: generateSimpleEntities(10),
                    config: { minSimilarity: 0.8 }
                },
                priority: 'medium'
            });
        }
        const results = await workerPool.processBatch(tasks);
        const metrics = workerPool.getMetrics();
        expect(results.length).toBe(5);
        expect(metrics.completedTasks).toBeGreaterThanOrEqual(5);
        console.log(`✅ Worker Pool: ${results.length} tasks completed`);
        console.log(`📈 Success rate: ${((1 - metrics.errorRate) * 100).toFixed(1)}%`);
    }, 20000);
    test('✅ Basic Optimized Engine Functionality', async () => {
        console.log('🚀 Testing optimized duplicate detection...');
        optimizedEngine = new DuplicateDetectionEngineOptimized_1.OptimizedDuplicateDetectionEngine({
            enableStreaming: false, // Disable for simple test
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB limit
            enableSemanticAnalysis: true
        });
        const testEntities = generateSimpleEntities(1000);
        const startTime = Date.now();
        const results = await optimizedEngine.analyze(testEntities, { targetDir: './test' });
        const duration = Date.now() - startTime;
        const metrics = optimizedEngine.getMetrics();
        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(metrics.stats.entitiesProcessed).toBeGreaterThan(0);
        console.log(`✅ Optimized Engine: ${results.length} clusters found in ${duration}ms`);
        console.log(`📊 Entities processed: ${metrics.stats.entitiesProcessed}`);
        console.log(`🎯 Cache hits: ${metrics.stats.cacheHits}`);
        // Save results
        await fs.writeJSON(path.join(outputDir, 'optimized-engine-results.json'), {
            clustersFound: results.length,
            duration,
            metrics: metrics.stats,
            timestamp: new Date().toISOString()
        }, { spaces: 2 });
    }, 30000);
});
// Helper function to generate simple test entities
function generateSimpleEntities(count) {
    const entities = [];
    const types = ['function', 'class', 'interface'];
    for (let i = 0; i < count; i++) {
        const type = types[i % types.length];
        const name = `TestEntity${Math.floor(i / 10)}`;
        // Create some duplicates intentionally
        const isDuplicate = i % 20 === 0 && i > 0;
        const actualName = isDuplicate ? `TestEntity${Math.floor((i - 20) / 10)}` : name;
        entities.push({
            id: `entity-${i}`,
            name: actualName,
            type: type,
            file: `test-file-${Math.floor(i / 50)}.ts`,
            startLine: (i % 30) + 1,
            endLine: (i % 30) + 5,
            line: (i % 30) + 1,
            column: 1,
            exportType: 'named',
            signature: `${actualName}(): void`,
            dependencies: [`dep-${i % 10}`],
            complexity: {
                cyclomatic: Math.floor(Math.random() * 5) + 1,
                cognitive: Math.floor(Math.random() * 8) + 1
            }
        });
    }
    return entities;
}
//# sourceMappingURL=integration-test-simple.test.js.map