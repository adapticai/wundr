# Scaling Wundr

Optimize Wundr performance for large codebases and enterprise environments.

## Overview

Scale Wundr to handle large monorepos, multiple teams, and enterprise-grade requirements while maintaining fast analysis times.

## Performance Optimization

### Analysis Scaling

```json
{
  "performance": {
    "workers": 8,
    "chunkSize": 500,
    "memoryLimit": "4GB",
    "timeout": 300000,
    "cache": {
      "enabled": true,
      "ttl": 3600,
      "strategy": "intelligent"
    }
  }
}
```

### Incremental Analysis

Only analyze changed files:

```json
{
  "incremental": {
    "enabled": true,
    "baseRef": "main",
    "trackDependencies": true,
    "cacheKey": "git-hash"
  }
}
```

### Parallel Execution

```typescript
// Distribute analysis across multiple machines
export const distributedConfig = {
  cluster: {
    enabled: true,
    nodes: [
      { host: 'analyzer-1.company.com', port: 8080 },
      { host: 'analyzer-2.company.com', port: 8080 },
      { host: 'analyzer-3.company.com', port: 8080 }
    ],
    loadBalancer: 'round-robin'
  }
};
```

## Enterprise Architecture

### Multi-Tenant Setup

```yaml
# docker-compose.yml for multi-tenant deployment
version: '3.8'
services:
  wundr-api:
    image: wundr/enterprise:latest
    environment:
      - MULTI_TENANT=true
      - DATABASE_URL=postgresql://user:pass@db/wundr
    deploy:
      replicas: 3

  wundr-worker:
    image: wundr/worker:latest
    environment:
      - WORKER_CONCURRENCY=4
    deploy:
      replicas: 6

  redis:
    image: redis:alpine

  postgresql:
    image: postgres:13
```

### Database Scaling

```sql
-- Partitioned tables for large datasets
CREATE TABLE analysis_results (
    id BIGSERIAL,
    project_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    data JSONB
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE analysis_results_2024_01 PARTITION OF analysis_results
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Monitoring & Observability

### Metrics Collection

```typescript
import { createPrometheusMetrics } from '@wundr.io/metrics';

const metrics = createPrometheusMetrics({
  analysisTime: 'histogram',
  queueSize: 'gauge',
  errorRate: 'counter',
  throughput: 'histogram'
});

// Custom metrics
metrics.analysisTime.observe(analysisTime);
metrics.queueSize.set(currentQueueSize);
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkWorkers(),
    checkDiskSpace()
  ]);

  const healthy = checks.every(check => check.status === 'ok');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  });
});
```

### Alerting

```yaml
# Prometheus alerts
groups:
- name: wundr
  rules:
  - alert: HighAnalysisTime
    expr: wundr_analysis_time_seconds > 300
    for: 5m
    annotations:
      summary: Analysis taking too long

  - alert: HighErrorRate
    expr: rate(wundr_errors_total[5m]) > 0.1
    for: 2m
    annotations:
      summary: High error rate detected
```

## Resource Management

### Memory Optimization

```typescript
// Memory-efficient analysis for large files
export class StreamingAnalyzer {
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    const stream = fs.createReadStream(filePath, {
      highWaterMark: 64 * 1024 // 64KB chunks
    });

    let result = new AnalysisResult();

    for await (const chunk of stream) {
      result = await this.analyzeChunk(chunk, result);

      // Periodic garbage collection
      if (result.processedLines % 1000 === 0) {
        global.gc?.();
      }
    }

    return result;
  }
}
```

### CPU Optimization

```typescript
// Use worker threads for CPU-intensive tasks
import { Worker, isMainThread, parentPort } from 'worker_threads';

if (isMainThread) {
  // Main thread
  export class PatternAnalyzer {
    private workers: Worker[] = [];

    constructor(workerCount = os.cpus().length) {
      for (let i = 0; i < workerCount; i++) {
        this.workers.push(new Worker(__filename));
      }
    }

    async analyzePatterns(files: string[]): Promise<Result[]> {
      const chunks = this.chunkArray(files, this.workers.length);

      const promises = chunks.map((chunk, i) =>
        this.runWorker(this.workers[i], chunk)
      );

      return Promise.all(promises);
    }
  }
} else {
  // Worker thread
  parentPort?.on('message', async (files) => {
    const results = await analyzeFiles(files);
    parentPort?.postMessage(results);
  });
}
```

## Network Optimization

### Content Delivery

```typescript
// CDN configuration for dashboard assets
export const cdnConfig = {
  enabled: true,
  provider: 'cloudflare',
  domains: {
    static: 'static.wundr.company.com',
    api: 'api.wundr.company.com'
  },
  caching: {
    staticAssets: '1y',
    apiResponses: '5m',
    reports: '1h'
  }
};
```

### API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const createRateLimit = (windowMs: number, max: number) =>
  rateLimit({
    windowMs,
    max,
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false
  });

// Different limits for different endpoints
app.use('/api/analyze', createRateLimit(15 * 60 * 1000, 100)); // 100 per 15min
app.use('/api/reports', createRateLimit(60 * 1000, 30)); // 30 per minute
```

## Security at Scale

### Authentication & Authorization

```typescript
// JWT with role-based access control
export interface UserToken {
  userId: string;
  email: string;
  roles: string[];
  permissions: string[];
  tenantId: string;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  const decoded = await verifyJWT(token);

  // Check permissions for the requested resource
  const required = getRequiredPermissions(req.path, req.method);

  if (!hasPermissions(decoded.permissions, required)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  req.user = decoded;
  next();
};
```

### Data Encryption

```typescript
// Encrypt sensitive data at rest
import { encrypt, decrypt } from '@company/encryption';

export class SecureAnalysisStorage {
  async store(projectId: string, data: AnalysisData): Promise<void> {
    const encrypted = await encrypt(JSON.stringify(data), {
      keyId: await this.getProjectKey(projectId)
    });

    await this.database.store(projectId, encrypted);
  }

  async retrieve(projectId: string): Promise<AnalysisData> {
    const encrypted = await this.database.retrieve(projectId);
    const decrypted = await decrypt(encrypted);

    return JSON.parse(decrypted);
  }
}
```

## Deployment Strategies

### Blue-Green Deployment

```yaml
# Kubernetes blue-green deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wundr-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wundr
      version: blue
  template:
    metadata:
      labels:
        app: wundr
        version: blue
    spec:
      containers:
      - name: wundr
        image: wundr:v2.1.0
---
apiVersion: v1
kind: Service
metadata:
  name: wundr-service
spec:
  selector:
    app: wundr
    version: blue  # Switch to green for deployment
  ports:
  - port: 80
    targetPort: 8080
```

### Auto-scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: wundr-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: wundr-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Next Steps

- Learn about [Performance Optimization](./performance-optimization.md)
- Explore [Enterprise Features](../../docs/enterprise/)
- Set up [Monitoring Dashboard](/web-dashboard/setup)