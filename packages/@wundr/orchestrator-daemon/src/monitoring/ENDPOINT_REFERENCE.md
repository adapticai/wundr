# Metrics HTTP Endpoint Reference

## Overview

The MetricsServer provides a production-ready HTTP endpoint for Prometheus metrics scraping and health monitoring. It implements three endpoints with comprehensive middleware support.

## Quick Start

```typescript
import { createMetricsServer, metricsRegistry } from '@wundr.io/orchestrator-daemon';

// Register metrics
metricsRegistry.register();

// Create server
const server = createMetricsServer(metricsRegistry, {
  port: 9090,
  version: '1.0.6',
});

// Start server
await server.start();

// Stop server
await server.stop();
```

## Class: MetricsServer

### Constructor

```typescript
constructor(registry: MetricsRegistry, config?: MetricsServerConfig)
```

**Parameters:**
- `registry` - MetricsRegistry instance for metrics collection
- `config` - Optional configuration object

### Methods

#### start(): Promise<void>
Starts the HTTP server and begins listening for requests.

**Returns:** Promise that resolves when server is ready

**Throws:** Error if server fails to start or port is in use

**Example:**
```typescript
await server.start();
console.log('Server started on port 9090');
```

#### stop(): Promise<void>
Gracefully stops the HTTP server.

**Returns:** Promise that resolves when server is stopped

**Example:**
```typescript
process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});
```

#### setReady(ready: boolean): void
Sets the readiness state for the `/ready` endpoint.

**Parameters:**
- `ready` - True if service is ready to accept traffic

**Example:**
```typescript
// Mark as not ready during initialization
server.setReady(false);

// Mark as ready after initialization
await initializeComponents();
server.setReady(true);
```

#### isRunning(): boolean
Checks if the server is currently running.

**Returns:** True if server is running

**Example:**
```typescript
if (server.isRunning()) {
  console.log('Server is running');
}
```

## Configuration

### MetricsServerConfig

```typescript
interface MetricsServerConfig {
  /** Port to listen on (default: 9090) */
  port?: number;

  /** Host to bind to (default: '0.0.0.0') */
  host?: string;

  /** Enable CORS headers (default: true) */
  enableCors?: boolean;

  /** Enable request logging (default: true) */
  enableLogging?: boolean;

  /** Application version for health endpoint */
  version?: string;

  /** Health check functions */
  healthChecks?: HealthChecks;
}
```

### HealthChecks

```typescript
interface HealthChecks {
  redis?: () => Promise<boolean>;
  database?: () => Promise<boolean>;
  federationRegistry?: () => Promise<boolean>;
}
```

**Example:**
```typescript
const server = createMetricsServer(metricsRegistry, {
  port: 9090,
  host: '0.0.0.0',
  enableCors: true,
  version: '1.0.6',
  healthChecks: {
    redis: async () => {
      try {
        await redisClient.ping();
        return true;
      } catch {
        return false;
      }
    },
  },
});
```

## HTTP Endpoints

### GET /metrics

Returns Prometheus-formatted metrics for scraping.

**Response Headers:**
- `Content-Type: text/plain; version=0.0.4; charset=utf-8`
- `Access-Control-Allow-Origin: *` (if CORS enabled)

**Status Codes:**
- `200 OK` - Metrics successfully collected
- `405 Method Not Allowed` - Non-GET request
- `500 Internal Server Error` - Failed to collect metrics

**Response Format:**
```
# HELP orchestrator_sessions_active Number of currently active orchestrator sessions
# TYPE orchestrator_sessions_active gauge
orchestrator_sessions_active{orchestrator_id="orch-1",session_type="claude-code"} 5

# HELP orchestrator_tokens_used_total Total number of tokens used by the orchestrator
# TYPE orchestrator_tokens_used_total counter
orchestrator_tokens_used_total{orchestrator_id="orch-1",model="claude-sonnet-4"} 15000
```

**cURL Example:**
```bash
curl http://localhost:9090/metrics
```

### GET /health

Returns detailed health status with dependency checks.

**Response Headers:**
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (if CORS enabled)

**Status Codes:**
- `200 OK` - Service is healthy or degraded
- `503 Service Unavailable` - Service is unhealthy
- `405 Method Not Allowed` - Non-GET request
- `500 Internal Server Error` - Health check failed

**Response Format:**
```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;  // seconds
  checks: {
    redis: boolean;
    database: boolean;
    federationRegistry: boolean;
  };
  timestamp: string;  // ISO 8601
}
```

**Health Status Logic:**
- `healthy` - All checks passed
- `degraded` - Some checks failed
- `unhealthy` - All checks failed

**cURL Example:**
```bash
curl http://localhost:9090/health | jq
```

**Example Response:**
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

### GET /ready

Returns readiness status for Kubernetes readiness probes.

**Response Headers:**
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` (if CORS enabled)

**Status Codes:**
- `200 OK` - Service is ready
- `503 Service Unavailable` - Service is not ready
- `405 Method Not Allowed` - Non-GET request

**Response Format:**
```typescript
interface ReadinessResponse {
  ready: boolean;
  timestamp: string;  // ISO 8601
  message?: string;
}
```

**cURL Example:**
```bash
curl http://localhost:9090/ready | jq
```

**Example Response:**
```json
{
  "ready": true,
  "timestamp": "2024-11-30T23:45:00.000Z",
  "message": "Service is ready"
}
```

## Middleware Features

### CORS Support

Automatically adds CORS headers when `enableCors: true`:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Max-Age: 86400`

Handles OPTIONS preflight requests with `204 No Content`.

### Request Logging

When `enableLogging: true`, logs:
- Request method, URL, and remote address
- Response time in milliseconds
- Error details if request fails

### Error Handling

All errors return JSON format:
```json
{
  "error": "Error message",
  "statusCode": 500,
  "timestamp": "2024-11-30T23:45:00.000Z"
}
```

## Integration Examples

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 9090
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Kubernetes Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 9090
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 2
```

### Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'orchestrator-daemon'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 30s
    metrics_path: /metrics
```

### Docker Healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:9090/health || exit 1
```

## Best Practices

### 1. Graceful Shutdown

Always drain connections before stopping:

```typescript
process.on('SIGTERM', async () => {
  server.setReady(false);                      // Stop accepting new traffic
  await new Promise(r => setTimeout(r, 5000)); // Wait for in-flight requests
  await server.stop();                         // Stop server
  process.exit(0);
});
```

### 2. Health Check Implementation

Keep health checks fast and lightweight:

```typescript
healthChecks: {
  redis: async () => {
    try {
      await redisClient.ping();  // Quick operation
      return true;
    } catch {
      return false;  // Don't throw, return false
    }
  },
}
```

### 3. Version Management

Use package.json version in production:

```typescript
import { version } from '../package.json';

const server = createMetricsServer(metricsRegistry, {
  version,  // "1.0.6"
});
```

### 4. Error Handling

Never expose sensitive information in errors:

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed:', error);  // Log details
  throw new Error('Internal error');         // Generic message
}
```

### 5. Port Configuration

Use environment variables for configuration:

```typescript
const server = createMetricsServer(metricsRegistry, {
  port: Number(process.env.METRICS_PORT) || 9090,
  host: process.env.METRICS_HOST || '0.0.0.0',
});
```

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solutions:**
```bash
# Find process using port
lsof -i :9090

# Kill process
kill -9 <PID>

# Or use different port
METRICS_PORT=9091 node server.js
```

### Health Checks Always Fail

**Symptoms:** `/health` returns `unhealthy` status

**Solutions:**
1. Check health check function doesn't throw
2. Verify dependencies are reachable
3. Add timeout to health checks
4. Log health check results

```typescript
healthChecks: {
  redis: async () => {
    try {
      const result = await Promise.race([
        redisClient.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 1000)
        ),
      ]);
      console.log('Redis health check:', result);
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  },
}
```

### Metrics Not Updating

**Symptoms:** `/metrics` shows stale data

**Solutions:**
1. Ensure metrics are registered
2. Check collector is flushing batches
3. Verify metrics are being recorded

```typescript
// Check registration
metricsRegistry.register();

// Force flush
collector.flush();

// Verify recording
daemonMetrics.tokensUsed.inc({ orchestrator_id: 'test', model: 'test' }, 100);
```

## Performance Considerations

- **Request Handling:** Non-blocking async handlers
- **Health Checks:** Run in parallel with Promise.all
- **Batching:** Collector batches metric updates
- **Memory:** Minimal overhead per request
- **Concurrency:** Handles multiple concurrent requests

## Security Considerations

1. **No Authentication:** Metrics endpoint has no auth by default
2. **Internal Network:** Deploy on internal network only
3. **Rate Limiting:** Consider adding rate limiting for public exposure
4. **Sensitive Data:** Never expose secrets in metrics or health checks
5. **CORS:** Restrict origins in production if needed

## Related Documentation

- [Metrics Registry](./metrics.ts)
- [Metrics Collector](./collector.ts)
- [Examples](./examples/README.md)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
