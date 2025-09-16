# Performance Optimization

Optimize Wundr for better performance on large projects and complex codebases.

## Understanding Performance Factors

### Analysis Complexity

Wundr's analysis performance depends on:

- **Project size** (number of files and lines of code)
- **Code complexity** (nested structures, dependencies)
- **Analysis depth** (shallow, moderate, deep)
- **Pattern complexity** (simple vs. advanced patterns)
- **System resources** (CPU, memory, disk I/O)

### Resource Requirements

**Minimum Requirements**:
- 4GB RAM
- 2 CPU cores
- 1GB free disk space

**Recommended for Large Projects**:
- 16GB+ RAM
- 8+ CPU cores
- SSD storage

## Configuration Optimizations

### Basic Performance Config

```json
{
  "analysis": {
    "depth": "moderate",
    "parallel": true,
    "chunkSize": 1000,
    "incremental": true,
    "cache": {
      "enabled": true,
      "maxAge": "24h"
    }
  },
  "exclude": [
    "node_modules/**",
    "build/**",
    "dist/**",
    "coverage/**",
    ".git/**",
    "*.min.js",
    "*.map"
  ]
}
```

### Advanced Performance Settings

```json
{
  "performance": {
    "maxMemory": "8GB",
    "workerThreads": 8,
    "streaming": true,
    "batchSize": 500,
    "compressionLevel": 6
  },
  "analysis": {
    "skipLargeFiles": true,
    "largeFileThreshold": "1MB",
    "timeout": "10m",
    "retries": 3
  }
}
```

## Command-Line Optimizations

### Memory Management

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=8192" wundr analyze

# Use streaming for large projects
wundr analyze --stream --chunk-size=500

# Enable garbage collection optimization
NODE_OPTIONS="--optimize-for-size" wundr analyze
```

### Parallel Processing

```bash
# Enable parallel processing
wundr analyze --parallel --workers=8

# Process directories separately
wundr analyze src/ &
wundr analyze tests/ &
wait
```

### Incremental Analysis

```bash
# Only analyze changed files
wundr analyze --incremental

# Use git integration for smart incremental analysis
wundr analyze --git-diff --base=main

# Combine with caching
wundr analyze --incremental --cache
```

## File System Optimizations

### Exclude Strategies

**Smart Exclusions**:
```json
{
  "exclude": [
    "node_modules/**",
    "vendor/**",
    "build/**",
    "dist/**",
    "coverage/**",
    ".next/**",
    ".nuxt/**",
    "*.min.js",
    "*.bundle.js",
    "*.map",
    "*.log",
    "**/*.{png,jpg,jpeg,gif,svg,ico}",
    "**/*.{pdf,doc,docx,xls,xlsx}",
    "**/test-fixtures/**",
    "**/mock-data/**"
  ]
}
```

**Language-Specific Exclusions**:
```json
{
  "exclude": {
    "javascript": ["**/*.spec.js", "**/*.test.js"],
    "typescript": ["**/*.d.ts"],
    "python": ["**/__pycache__/**", "**/*.pyc"],
    "java": ["**/target/**", "**/*.class"],
    "csharp": ["**/bin/**", "**/obj/**"]
  }
}
```

### File Size Limits

```json
{
  "analysis": {
    "skipLargeFiles": true,
    "largeFileThreshold": "500KB",
    "maxFileSize": "2MB",
    "warnOnLargeFiles": true
  }
}
```

## Analysis Strategies

### Tiered Analysis

**Quick Analysis** (for CI/CD):
```json
{
  "profiles": {
    "quick": {
      "depth": "shallow",
      "patterns": ["critical", "security"],
      "timeout": "2m"
    }
  }
}
```

**Deep Analysis** (for weekly reviews):
```json
{
  "profiles": {
    "comprehensive": {
      "depth": "deep",
      "patterns": "all",
      "includeTests": true,
      "generateReports": true
    }
  }
}
```

### Smart Sampling

```json
{
  "analysis": {
    "sampling": {
      "enabled": true,
      "strategy": "statistical",
      "sampleSize": 0.3,
      "minFiles": 100,
      "preserveCritical": true
    }
  }
}
```

## Caching Strategies

### File-Level Caching

```json
{
  "cache": {
    "strategy": "file-hash",
    "location": ".wundr/cache",
    "maxSize": "2GB",
    "ttl": "7d",
    "compression": true
  }
}
```

### Result Caching

```json
{
  "cache": {
    "results": {
      "enabled": true,
      "strategy": "content-hash",
      "invalidateOn": ["config-change", "pattern-update"],
      "sharedCache": true
    }
  }
}
```

## Monitoring and Profiling

### Performance Metrics

```bash
# Enable performance monitoring
wundr analyze --profile --metrics

# Detailed timing information
wundr analyze --verbose --timing

# Memory usage tracking
wundr analyze --memory-profile
```

### Bottleneck Analysis

```bash
# Identify slow patterns
wundr profile patterns

# Analyze file processing times
wundr profile files

# Memory usage by component
wundr profile memory
```

## Environment-Specific Optimizations

### CI/CD Environments

```yaml
# GitHub Actions optimization
- name: Optimize Wundr for CI
  run: |
    export NODE_OPTIONS="--max-old-space-size=4096"
    wundr analyze --ci --incremental --parallel --profile=quick
  env:
    WUNDR_CACHE_DIR: ${{ runner.temp }}/wundr-cache
```

### Docker Environments

```dockerfile
# Multi-stage build for performance
FROM node:18-alpine AS builder
RUN npm install -g @wundr/cli

FROM node:18-alpine
COPY --from=builder /usr/local/lib/node_modules/@wundr /usr/local/lib/node_modules/@wundr
RUN ln -s /usr/local/lib/node_modules/@wundr/bin/wundr /usr/local/bin/wundr

# Optimize container resources
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV WUNDR_WORKERS=4
```

### Development Environments

```json
{
  "development": {
    "watchMode": true,
    "incrementalAnalysis": true,
    "fastMode": true,
    "skipNonCritical": true,
    "cache": {
      "aggressive": true,
      "preload": true
    }
  }
}
```

## Performance Monitoring

### Built-in Metrics

```bash
# Generate performance report
wundr analyze --performance-report

# Track metrics over time
wundr metrics track --output=performance.json

# Compare performance across versions
wundr metrics compare v1.0.0 v2.0.0
```

### Custom Metrics

```json
{
  "metrics": {
    "track": [
      "analysis-time",
      "memory-usage",
      "file-processing-rate",
      "cache-hit-ratio",
      "pattern-execution-time"
    ],
    "export": {
      "format": "json",
      "interval": "1h",
      "destination": "./metrics/"
    }
  }
}
```

## Troubleshooting Performance Issues

### Common Bottlenecks

1. **Large files**: Use file size limits
2. **Complex patterns**: Optimize or disable problematic patterns
3. **Memory leaks**: Enable garbage collection monitoring
4. **Disk I/O**: Use faster storage or enable streaming
5. **Network issues**: Configure proper timeouts and retries

### Debugging Commands

```bash
# Profile analysis performance
wundr analyze --profile --debug

# Identify memory hotspots
wundr analyze --memory-debug --heap-snapshot

# Trace slow operations
wundr analyze --trace --slow-ops-threshold=1000ms
```

## Best Practices

### Development Workflow

1. Use quick profiles for frequent analysis
2. Run comprehensive analysis weekly
3. Monitor performance metrics regularly
4. Optimize configuration based on metrics
5. Use incremental analysis for development

### Production Deployment

1. Pre-warm caches before analysis
2. Use dedicated analysis servers for large projects
3. Implement proper resource limits
4. Monitor and alert on performance degradation
5. Regular performance reviews and optimization

### Team Guidelines

1. Share optimized configurations across team
2. Document performance baselines
3. Regular performance reviews
4. Training on optimization techniques
5. Performance considerations in code reviews

## Next Steps

- [Scaling Wundr](./scaling)
- [Pattern Development](./pattern-development)
- [Team Collaboration](/team/collaboration)