# Metrics Server Quick Start Guide

## 5-Minute Setup

### 1. Import and Initialize

```typescript
import {
  createMetricsServer,
  metricsRegistry
} from '@wundr.io/orchestrator-daemon/monitoring';

// Register metrics
metricsRegistry.register();

// Create server
const server = createMetricsServer(metricsRegistry, {
  port: 9090
});

// Start server
await server.start();
```

### 2. Add Health Checks (Optional)

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
    }
  }
});
```

### 3. Test Endpoints

```bash
# View metrics
curl http://localhost:9090/metrics

# Check health
curl http://localhost:9090/health | jq

# Check readiness
curl http://localhost:9090/ready | jq
```

### 4. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  server.setReady(false);
  await new Promise(r => setTimeout(r, 5000));
  await server.stop();
  process.exit(0);
});
```

## Common Use Cases

### Basic Monitoring

```typescript
import { createMetricsServer, metricsRegistry } from '@wundr.io/orchestrator-daemon/monitoring';

metricsRegistry.register();
const server = createMetricsServer(metricsRegistry);
await server.start();
```

### Production Deployment

```typescript
const server = createMetricsServer(metricsRegistry, {
  port: Number(process.env.METRICS_PORT) || 9090,
  host: process.env.METRICS_HOST || '0.0.0.0',
  version: process.env.APP_VERSION || '1.0.0',
  enableCors: true,
  healthChecks: {
    redis: checkRedis,
    database: checkDatabase,
    federationRegistry: checkFederation,
  }
});
```

### Kubernetes Deployment

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 9090
readinessProbe:
  httpGet:
    path: /ready
    port: 9090
```

## API Cheat Sheet

### Endpoints

| Endpoint | Method | Returns |
|----------|--------|---------|
| /metrics | GET | Prometheus metrics (text) |
| /health  | GET | Health status (JSON) |
| /ready   | GET | Readiness status (JSON) |

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 405 | Method not allowed |
| 503 | Service unavailable |

### Methods

```typescript
// Start server
await server.start();

// Stop server
await server.stop();

// Set readiness
server.setReady(true);
server.setReady(false);

// Check if running
if (server.isRunning()) { }
```

## Configuration Defaults

```typescript
{
  port: 9090,
  host: '0.0.0.0',
  enableCors: true,
  enableLogging: true,
  version: '1.0.6',
  healthChecks: {} // All pass by default
}
```

## Examples

Run the examples:

```bash
# Basic server
npx ts-node src/monitoring/examples/basic-server.ts

# With health checks
npx ts-node src/monitoring/examples/with-health-checks.ts

# Full stack
npx ts-node src/monitoring/examples/full-stack.ts
```

## Troubleshooting

### Port in use

```bash
lsof -i :9090
kill -9 <PID>
```

### Health checks fail

Add error handling:
```typescript
healthChecks: {
  redis: async () => {
    try {
      await redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis check failed:', error);
      return false;
    }
  }
}
```

## Next Steps

- Read [ENDPOINT_REFERENCE.md](./ENDPOINT_REFERENCE.md) for full API docs
- Check [examples/](./examples/) for detailed examples
- See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture

## Support

- Issues: https://github.com/adapticai/wundr/issues
- Docs: /docs/monitoring/
- Examples: /src/monitoring/examples/
