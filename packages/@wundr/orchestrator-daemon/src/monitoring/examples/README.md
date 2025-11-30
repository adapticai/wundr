# Metrics Server Examples

This directory contains examples demonstrating how to use the Prometheus metrics HTTP endpoint in various scenarios.

## Examples Overview

### 1. Basic Server (`basic-server.ts`)

Demonstrates the simplest setup for a metrics server with automatic metric updates.

**Features:**
- Basic server setup on port 9090
- Simulated metrics updates every 5 seconds
- All three endpoints: `/metrics`, `/health`, `/ready`
- Graceful shutdown handling

**Run:**
```bash
ts-node basic-server.ts
```

**Test:**
```bash
# View metrics
curl http://localhost:9090/metrics

# Check health
curl http://localhost:9090/health | jq

# Check readiness
curl http://localhost:9090/ready | jq
```

### 2. With Health Checks (`with-health-checks.ts`)

Shows how to implement custom health checks for external dependencies.

**Features:**
- Custom health check functions for Redis, database, and federation registry
- Readiness state management
- CORS and logging enabled
- Detailed health status in responses

**Run:**
```bash
ts-node with-health-checks.ts
```

**Health Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 42,
  "checks": {
    "redis": true,
    "database": true,
    "federationRegistry": true
  },
  "timestamp": "2024-11-30T23:45:00.000Z"
}
```

### 3. Kubernetes Integration (`kubernetes-integration.ts`)

Production-ready example with Kubernetes deployment configuration.

**Features:**
- Application lifecycle management
- Liveness and readiness probe support
- Graceful shutdown with connection draining
- Environment variable configuration
- Complete Kubernetes manifests included

**Run:**
```bash
METRICS_PORT=9090 APP_VERSION=1.0.0 ts-node kubernetes-integration.ts
```

**Kubernetes Manifests:**
The example includes complete YAML for:
- Deployment with probes
- Service for metrics exposure
- ServiceMonitor for Prometheus Operator

## API Reference

### Endpoints

#### GET /metrics
Returns Prometheus-formatted metrics for scraping.

**Response:**
```
Content-Type: text/plain; version=0.0.4; charset=utf-8

# HELP orchestrator_sessions_active Number of currently active orchestrator sessions
# TYPE orchestrator_sessions_active gauge
orchestrator_sessions_active{orchestrator_id="orch-1",session_type="claude-code"} 5

# HELP orchestrator_tokens_used_total Total number of tokens used by the orchestrator
# TYPE orchestrator_tokens_used_total counter
orchestrator_tokens_used_total{orchestrator_id="orch-1",model="claude-sonnet-4"} 15000
...
```

#### GET /health
Returns detailed health status with dependency checks.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.6",
  "uptime": 3600,
  "checks": {
    "redis": true,
    "database": true,
    "federationRegistry": true
  },
  "timestamp": "2024-11-30T23:45:00.000Z"
}
```

**Status Codes:**
- `200` - Healthy or degraded
- `503` - Unhealthy

**Health Status:**
- `healthy` - All checks passed
- `degraded` - Some checks failed
- `unhealthy` - All checks failed

#### GET /ready
Returns readiness status for load balancer configuration.

**Response:**
```json
{
  "ready": true,
  "timestamp": "2024-11-30T23:45:00.000Z",
  "message": "Service is ready"
}
```

**Status Codes:**
- `200` - Ready
- `503` - Not ready

## Configuration

### MetricsServerConfig

```typescript
interface MetricsServerConfig {
  port?: number;                    // Default: 9090
  host?: string;                    // Default: '0.0.0.0'
  enableCors?: boolean;             // Default: true
  enableLogging?: boolean;          // Default: true
  version?: string;                 // Default: package.json version
  healthChecks?: HealthChecks;      // Optional health check functions
}
```

### Health Checks

```typescript
interface HealthChecks {
  redis?: () => Promise<boolean>;
  database?: () => Promise<boolean>;
  federationRegistry?: () => Promise<boolean>;
}
```

## Usage Patterns

### Basic Setup

```typescript
import { createMetricsServer, metricsRegistry } from '@wundr.io/orchestrator-daemon';

metricsRegistry.register();

const server = createMetricsServer(metricsRegistry, {
  port: 9090,
  version: '1.0.0',
});

await server.start();
```

### With Custom Health Checks

```typescript
const server = createMetricsServer(metricsRegistry, {
  port: 9090,
  healthChecks: {
    redis: async () => {
      try {
        await redisClient.ping();
        return true;
      } catch {
        return false;
      }
    },
    database: async () => {
      try {
        await db.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
  },
});
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  server.setReady(false);                    // Stop accepting traffic
  await new Promise(r => setTimeout(r, 5000)); // Drain connections
  await server.stop();                        // Stop server
  process.exit(0);
});
```

## Prometheus Configuration

### Scrape Config

```yaml
scrape_configs:
  - job_name: 'orchestrator-daemon'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 30s
    metrics_path: /metrics
```

### Alert Rules

```yaml
groups:
  - name: orchestrator_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(orchestrator_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate detected

      - alert: ServiceUnhealthy
        expr: up{job="orchestrator-daemon"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Orchestrator daemon is down
```

## Best Practices

1. **Always implement health checks** for production deployments
2. **Use readiness probes** to prevent traffic during initialization
3. **Enable graceful shutdown** with connection draining
4. **Monitor metrics regularly** with alerting
5. **Keep uptime accurate** by tracking start time
6. **Log errors** but don't expose sensitive data
7. **Use CORS headers** for dashboard access
8. **Version your API** in health responses

## Troubleshooting

### Server won't start
- Check if port is already in use: `lsof -i :9090`
- Verify permissions for binding to port
- Check firewall settings

### Health checks always fail
- Verify health check functions don't throw exceptions
- Check timeout settings
- Test dependencies separately

### Metrics not updating
- Ensure metrics are registered before recording
- Check if collector is properly configured
- Verify batch flush interval

## Related Documentation

- [Metrics Registry](../metrics.ts)
- [Metrics Collector](../collector.ts)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
