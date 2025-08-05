# Performance Benchmarks & Guidelines

This document establishes performance standards and benchmarks for the monorepo refactoring toolkit.

## 🎯 Overall Performance Goals

### Analysis Performance Targets
- **Small Projects** (< 50 files): Analysis completes in < 30 seconds
- **Medium Projects** (50-200 files): Analysis completes in < 2 minutes
- **Large Projects** (200-500 files): Analysis completes in < 5 minutes
- **Enterprise Projects** (500+ files): Analysis completes in < 10 minutes

### Memory Usage Targets
- **Peak Memory Usage**: < 512MB for projects up to 1000 files
- **Memory Growth**: Linear with project size, not exponential
- **Memory Cleanup**: No memory leaks during long-running operations

### Dashboard Performance
- **Load Time**: Dashboard loads in < 3 seconds with cached data
- **Interaction Response**: UI interactions respond in < 500ms
- **Chart Rendering**: Charts render in < 1 second for datasets up to 10k entities

## 📊 Benchmark Metrics

### Code Analysis Benchmarks

| Operation | Small (50 files) | Medium (200 files) | Large (500 files) | Enterprise (1000+ files) |
|-----------|------------------|-------------------|-------------------|-------------------------|
| AST Parsing | < 5s | < 15s | < 30s | < 60s |
| Duplicate Detection | < 10s | < 30s | < 60s | < 120s |
| Dependency Analysis | < 5s | < 15s | < 30s | < 60s |
| Report Generation | < 3s | < 10s | < 20s | < 40s |
| **Total Time** | **< 30s** | **< 2m** | **< 5m** | **< 10m** |

### Memory Usage Benchmarks

| Project Size | Expected Memory | Peak Memory | Acceptable Peak |
|-------------|----------------|-------------|-----------------|
| 50 files | 64MB | 128MB | 256MB |
| 200 files | 128MB | 256MB | 384MB |
| 500 files | 256MB | 384MB | 512MB |
| 1000+ files | 384MB | 512MB | 768MB |

## 🔧 Performance Testing Framework

### Automated Performance Tests

```typescript
// scripts/performance/benchmark-runner.ts
import { performance } from 'perf_hooks';
import { EnhancedASTAnalyzer } from '../analysis/enhanced-ast-analyzer';

interface BenchmarkResult {
  operation: string;
  fileCount: number;
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmarks(testProjects: string[]): Promise<BenchmarkResult[]> {
    for (const projectPath of testProjects) {
      await this.benchmarkProject(projectPath);
    }
    return this.results;
  }

  private async benchmarkProject(projectPath: string): Promise<void> {
    const analyzer = new EnhancedASTAnalyzer();
    
    // Warm up
    process.gc?.();
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const report = await analyzer.analyzeProject();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      this.results.push({
        operation: 'full-analysis',
        fileCount: report.summary.totalFiles,
        duration: endTime - startTime,
        memoryUsage: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external - startMemory.external,
        }
      });
      
    } catch (error) {
      console.error(`Benchmark failed for ${projectPath}:`, error);
    }
  }
}
```

### Performance Test Suite

```bash
#!/bin/bash
# scripts/performance/run-benchmarks.sh

echo "🚀 Running Performance Benchmarks..."

# Create test projects of different sizes
./create-test-projects.sh

# Run benchmarks
echo "📊 Running analysis benchmarks..."
npx ts-node scripts/performance/benchmark-runner.ts

# Memory stress tests
echo "🧠 Running memory stress tests..."
npx ts-node scripts/performance/memory-stress-test.ts

# Dashboard performance tests
echo "🎨 Running dashboard performance tests..."
npm run test:performance:dashboard

# Generate performance report
echo "📋 Generating performance report..."
npx ts-node scripts/performance/generate-report.ts

echo "✅ Performance benchmarks complete!"
```

## 📈 Performance Monitoring

### Key Performance Indicators (KPIs)

1. **Analysis Speed**
   - Files processed per second
   - Time to first result
   - Total analysis time

2. **Memory Efficiency**
   - Peak memory usage
   - Memory growth rate
   - Garbage collection frequency

3. **Scalability**
   - Performance degradation curve
   - Breaking points for large projects
   - Resource utilization efficiency

### Continuous Performance Monitoring

```typescript
// scripts/performance/performance-monitor.ts
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getAverageMetric(name: string): number {
    const values = this.metrics.get(name) || [];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  exportMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      result[name] = {
        count: values.length,
        average: this.getAverageMetric(name),
        min: Math.min(...values),
        max: Math.max(...values),
        latest: values[values.length - 1],
      };
    }
    
    return result;
  }
}
```

## 🎯 Optimization Guidelines

### Code-Level Optimizations

#### AST Processing
```typescript
// ❌ Inefficient - Creates new visitor for each file
files.forEach(file => {
  const visitor = new ASTVisitor();
  visitor.visit(file);
});

// ✅ Efficient - Reuses visitor instance
const visitor = new ASTVisitor();
files.forEach(file => {
  visitor.reset();
  visitor.visit(file);
});
```

#### Memory Management
```typescript
// ❌ Memory leak - Holds references unnecessarily
class EntityCollector {
  private allEntities: Map<string, Entity> = new Map();
  
  processFile(file: string) {
    // Processes file but never clears old data
  }
}

// ✅ Memory efficient - Clears data when appropriate
class EntityCollector {
  private currentBatch: Map<string, Entity> = new Map();
  
  processFile(file: string) {
    // Process file
    if (this.currentBatch.size > 1000) {
      this.flushBatch();
    }
  }
  
  private flushBatch() {
    // Process batch and clear
    this.currentBatch.clear();
  }
}
```

#### Async Operations
```typescript
// ❌ Sequential processing - Slow
for (const file of files) {
  await processFile(file);
}

// ✅ Parallel processing with concurrency limit
const concurrencyLimit = 10;
const semaphore = new Semaphore(concurrencyLimit);

await Promise.all(
  files.map(file => 
    semaphore.acquire().then(() => 
      processFile(file).finally(() => semaphore.release())
    )
  )
);
```

### Database Optimization

#### Query Optimization
```typescript
// ❌ N+1 Query Problem
const entities = await entityRepository.findAll();
for (const entity of entities) {
  entity.dependencies = await dependencyRepository.findByEntity(entity.id);
}

// ✅ Batch Loading
const entities = await entityRepository.findAll();
const entityIds = entities.map(e => e.id);
const dependencies = await dependencyRepository.findByEntityIds(entityIds);
const dependencyMap = groupBy(dependencies, 'entityId');

entities.forEach(entity => {
  entity.dependencies = dependencyMap[entity.id] || [];
});
```

### Caching Strategies

#### File-Level Caching
```typescript
class CachedAnalyzer {
  private cache = new Map<string, CachedResult>();
  
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const stat = await fs.stat(filePath);
    const cacheKey = `${filePath}:${stat.mtime.getTime()}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.result;
    }
    
    const result = await this.performAnalysis(filePath);
    this.cache.set(cacheKey, { result, timestamp: Date.now() });
    
    return result;
  }
}
```

#### Result Caching
```typescript
// Implement Redis caching for expensive operations
class ResultCache {
  async getCachedResult(key: string): Promise<any> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async setCachedResult(key: string, result: any, ttl = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(result));
  }
}
```

## 🚨 Performance Alerts

### Automated Alerts

Set up alerts for:
- Analysis time exceeding benchmarks by 50%
- Memory usage exceeding 512MB
- Dashboard load time > 5 seconds
- API response time > 2 seconds
- Error rate > 5%

### Alert Configuration

```typescript
// config/performance-alerts.ts
export const PERFORMANCE_ALERTS = {
  ANALYSIS_TIME_THRESHOLD: {
    small: 45000,   // 45 seconds (50% over 30s target)
    medium: 180000, // 3 minutes (50% over 2m target)
    large: 450000,  // 7.5 minutes (50% over 5m target)
  },
  MEMORY_THRESHOLD: 537395200, // 512MB in bytes
  DASHBOARD_LOAD_THRESHOLD: 5000, // 5 seconds
  ERROR_RATE_THRESHOLD: 0.05, // 5%
};
```

## 🔍 Performance Profiling

### CPU Profiling
```bash
# Profile specific operations
node --prof scripts/analysis/enhanced-ast-analyzer.js
node --prof-process isolate-*.log > cpu-profile.txt
```

### Memory Profiling
```bash
# Generate heap snapshots
node --inspect scripts/analysis/enhanced-ast-analyzer.js
# Use Chrome DevTools to analyze heap snapshots
```

### Custom Profiling
```typescript
// Built-in performance profiling
import { PerformanceObserver } from 'perf_hooks';

const obs = new PerformanceObserver((items) => {
  items.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});

obs.observe({ entryTypes: ['measure', 'function'] });

// Wrap functions for automatic profiling
function profile(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();
    
    PerformanceMonitor.getInstance().recordMetric(
      `${target.constructor.name}.${propertyName}`,
      end - start
    );
    
    return result;
  };
}
```

## 📊 Performance Reporting

### Daily Performance Reports
- Average analysis times by project size
- Memory usage trends
- Performance regression detection
- Resource utilization patterns

### Weekly Performance Reviews
- Benchmark comparison with previous week
- Performance improvement opportunities
- Bottleneck identification
- Optimization recommendations

### Performance Dashboard
Create a dedicated performance dashboard showing:
- Real-time performance metrics
- Historical performance trends
- Comparison with benchmarks
- Alert status and recent issues

---

## Quick Performance Check Commands

```bash
# Run performance benchmarks
npm run performance:benchmark

# Check memory usage
npm run performance:memory

# Profile CPU usage
npm run performance:profile

# Generate performance report
npm run performance:report

# Performance regression test
npm run performance:regression
```

Remember: Performance optimization is an ongoing process. Regular monitoring and profiling help maintain optimal performance as the codebase grows.