# MetricsCollector - Orchestrator Daemon Monitoring

## Overview

The `MetricsCollector` provides a high-level API for recording Prometheus metrics in the Orchestrator Daemon. It offers batching, timing utilities, and aggregation capabilities to efficiently monitor orchestrator performance, resource usage, and system health.

## Features

- **Batch Recording**: Buffer metric updates and flush at intervals or thresholds for efficiency
- **Timing Utilities**: Built-in timer functions and function wrappers for latency tracking
- **Aggregation**: Query aggregated statistics across time ranges
- **Type Safety**: Full TypeScript support with type-safe metric recording
- **Prometheus Integration**: Seamlessly integrates with prom-client metrics

## Architecture

```
┌─────────────────────────────────────────────────┐
│           MetricsCollector                       │
│                                                  │
│  ┌────────────────┐      ┌──────────────────┐  │
│  │ Public API     │      │ Batch Queue       │  │
│  │                │─────▶│ - Updates buffer  │  │
│  │ - recordXXX()  │      │ - Auto-flush      │  │
│  │ - startTimer() │      │ - Max size limit  │  │
│  │ - withMetrics()│      └──────────────────┘  │
│  └────────────────┘                             │
│         │                                        │
│         ▼                                        │
│  ┌────────────────────────────────────────────┐ │
│  │        DaemonMetrics (prom-client)         │ │
│  │                                             │ │
│  │ - sessionsActive     (Gauge)               │ │
│  │ - tokensUsed         (Counter)             │ │
│  │ - messageLatency     (Histogram)           │ │
│  │ - toolInvocations    (Counter)             │ │
│  │ - federationDelegations (Counter)          │ │
│  │ - nodeLoad           (Gauge)               │ │
│  │ - errorCount         (Counter)             │ │
│  │ - budgetUtilization  (Gauge)               │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Installation

```typescript
import {
  MetricsRegistry,
  MetricsCollector,
  createMetricsCollector
} from '@wundr.io/orchestrator-daemon';
```

## Quick Start

```typescript
import { MetricsRegistry, createMetricsCollector } from '@wundr.io/orchestrator-daemon';

// Create metrics registry
const registry = new MetricsRegistry();
registry.register();

// Create metrics collector with batching
const collector = createMetricsCollector(registry, {
  enableBatching: true,
  batchFlushInterval: 5000, // 5 seconds
  maxBatchSize: 100,
  debug: false
});

// Record session start
collector.recordSessionStart('orchestrator-1', 'claude-code');

// Record token usage
collector.recordTokenUsage('orchestrator-1', 'claude-sonnet-3.5', 1500);

// Record message latency
collector.recordMessageLatency('orchestrator-1', 150); // 150ms

// Record session end
collector.recordSessionEnd('orchestrator-1', 'claude-code');
```

## API Reference

### Constructor

```typescript
constructor(
  metricsRegistry: MetricsRegistry,
  config?: CollectorConfig
)
```

**CollectorConfig**:
- `enableBatching?: boolean` - Enable batching of metric updates (default: `true`)
- `batchFlushInterval?: number` - Batch flush interval in milliseconds (default: `5000`)
- `maxBatchSize?: number` - Maximum batch size before auto-flush (default: `100`)
- `debug?: boolean` - Enable debug logging (default: `false`)

### Session Metrics

#### recordSessionStart()
Increment active sessions gauge.

```typescript
recordSessionStart(
  orchestratorId: string,
  sessionType: 'claude-code' | 'claude-flow'
): void
```

**Example**:
```typescript
collector.recordSessionStart('orch-1', 'claude-code');
```

#### recordSessionEnd()
Decrement active sessions gauge.

```typescript
recordSessionEnd(
  orchestratorId: string,
  sessionType: 'claude-code' | 'claude-flow'
): void
```

**Example**:
```typescript
collector.recordSessionEnd('orch-1', 'claude-code');
```

### Token Metrics

#### recordTokenUsage()
Record token consumption.

```typescript
recordTokenUsage(
  orchestratorId: string,
  model: string,
  tokens: number
): void
```

**Example**:
```typescript
collector.recordTokenUsage('orch-1', 'claude-sonnet-3.5', 1500);
```

### Latency Metrics

#### recordMessageLatency()
Record message processing latency in milliseconds.

```typescript
recordMessageLatency(
  orchestratorId: string,
  latencyMs: number
): void
```

**Example**:
```typescript
collector.recordMessageLatency('orch-1', 150); // 150ms
```

### Tool Metrics

#### recordToolInvocation()
Record tool invocation with status.

```typescript
recordToolInvocation(
  orchestratorId: string,
  toolName: string,
  status: 'success' | 'error' | 'timeout'
): void
```

**Example**:
```typescript
collector.recordToolInvocation('orch-1', 'file_read', 'success');
collector.recordToolInvocation('orch-1', 'api_call', 'error');
```

### Federation Metrics

#### recordDelegation()
Record delegation between orchestrators.

```typescript
recordDelegation(
  fromOrchestrator: string,
  toOrchestrator: string,
  status: 'success' | 'error' | 'rejected'
): void
```

**Example**:
```typescript
collector.recordDelegation('orch-1', 'orch-2', 'success');
```

### Error Metrics

#### recordError()
Record error occurrence.

```typescript
recordError(
  orchestratorId: string,
  errorType: string
): void
```

**Example**:
```typescript
collector.recordError('orch-1', 'timeout_error');
collector.recordError('orch-1', 'memory_limit_exceeded');
```

### Resource Metrics

#### updateNodeLoad()
Update node load gauge (0-1 scale).

```typescript
updateNodeLoad(
  nodeId: string,
  load: number
): void
```

**Example**:
```typescript
collector.updateNodeLoad('node-1', 0.65); // 65% load
```

#### updateBudgetUtilization()
Update budget utilization percentage.

```typescript
updateBudgetUtilization(
  orchestratorId: string,
  period: 'daily' | 'weekly' | 'monthly',
  percent: number
): void
```

**Example**:
```typescript
collector.updateBudgetUtilization('orch-1', 'daily', 75.5); // 75.5%
```

### Timing Utilities

#### startTimer()
Start a timer and return a function to record duration.

```typescript
startTimer(): TimerFunction
```

**Example**:
```typescript
const endTimer = collector.startTimer();

// ... do work ...

const durationMs = endTimer();
console.log(`Took ${durationMs}ms`);
```

#### withMetrics()
Wrap an async function with automatic timing and error recording.

```typescript
async withMetrics<T>(
  fn: () => Promise<T>,
  labels: { orchestrator_id: string }
): Promise<T>
```

**Example**:
```typescript
async function processTask() {
  // ... task logic ...
  return { status: 'completed' };
}

const result = await collector.withMetrics(
  processTask,
  { orchestrator_id: 'orch-1' }
);
```

### Aggregation

#### getAggregatedStats()
Get aggregated statistics for an orchestrator over a time range.

```typescript
async getAggregatedStats(
  orchestratorId: string,
  timeRange?: { start: Date; end: Date }
): Promise<AggregatedStats>
```

**Returns**:
```typescript
{
  orchestratorId: string;
  timeRange: { start: Date; end: Date };
  totalSessions: number;
  totalTokens: number;
  avgLatency: number;          // in milliseconds
  errorRate: number;            // 0-1 scale
  successfulToolCalls: number;
  failedToolCalls: number;
  toolInvocations: number;
  delegations: number;
}
```

**Example**:
```typescript
const stats = await collector.getAggregatedStats('orch-1', {
  start: new Date(Date.now() - 3600000), // 1 hour ago
  end: new Date()
});

console.log(`Avg latency: ${stats.avgLatency}ms`);
console.log(`Error rate: ${(stats.errorRate * 100).toFixed(2)}%`);
```

### Lifecycle Management

#### flush()
Manually flush all pending batched updates.

```typescript
flush(): void
```

**Example**:
```typescript
collector.flush();
```

#### close()
Close the collector and cleanup resources.

```typescript
close(): void
```

**Example**:
```typescript
collector.close();
```

## Batching Behavior

The MetricsCollector implements efficient batching to reduce overhead:

1. **Queue Updates**: Metrics are queued in memory when `enableBatching: true`
2. **Auto-Flush Triggers**:
   - Time-based: Every `batchFlushInterval` milliseconds
   - Size-based: When batch reaches `maxBatchSize` updates
3. **Manual Flush**: Call `flush()` to immediately apply pending updates
4. **Automatic Cleanup**: Timer automatically releases on Node.js exit

## Performance Considerations

### Batching vs. Immediate

**With Batching** (recommended for high-throughput scenarios):
```typescript
const collector = createMetricsCollector(registry, {
  enableBatching: true,
  batchFlushInterval: 5000,
  maxBatchSize: 100
});
```
- Lower overhead per metric update
- Reduced lock contention
- Slight delay in metric visibility

**Without Batching** (for real-time requirements):
```typescript
const collector = createMetricsCollector(registry, {
  enableBatching: false
});
```
- Immediate metric updates
- Higher overhead per update
- Real-time visibility

### Memory Usage

- **Batch Queue**: O(maxBatchSize) memory
- **Active Timers**: O(concurrent timers) memory
- **Metrics Registry**: Managed by prom-client

## Integration Examples

### Express.js Endpoint

```typescript
import express from 'express';
import { MetricsRegistry, createMetricsCollector } from '@wundr.io/orchestrator-daemon';

const app = express();
const registry = new MetricsRegistry();
const collector = createMetricsCollector(registry);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(await registry.collect());
});

// API endpoint with metrics
app.post('/api/session', async (req, res) => {
  const orchestratorId = req.body.orchestratorId;

  collector.recordSessionStart(orchestratorId, 'claude-code');

  try {
    const result = await collector.withMetrics(
      async () => {
        // Process session...
        return { sessionId: 'session-123' };
      },
      { orchestrator_id: orchestratorId }
    );

    res.json(result);
  } finally {
    collector.recordSessionEnd(orchestratorId, 'claude-code');
  }
});

app.listen(3000);
```

### Background Worker

```typescript
import { MetricsRegistry, createMetricsCollector } from '@wundr.io/orchestrator-daemon';

class OrchestratorWorker {
  private collector: MetricsCollector;

  constructor() {
    const registry = new MetricsRegistry();
    this.collector = createMetricsCollector(registry, {
      enableBatching: true,
      batchFlushInterval: 10000 // 10 seconds
    });
  }

  async processTask(orchestratorId: string, task: Task) {
    const endTimer = this.collector.startTimer();

    try {
      // Process task...
      const result = await this.executeTask(task);

      this.collector.recordToolInvocation(
        orchestratorId,
        task.tool,
        'success'
      );

      return result;
    } catch (error) {
      this.collector.recordError(orchestratorId, error.type);
      this.collector.recordToolInvocation(
        orchestratorId,
        task.tool,
        'error'
      );
      throw error;
    } finally {
      const durationMs = endTimer();
      this.collector.recordMessageLatency(orchestratorId, durationMs);
    }
  }

  async shutdown() {
    this.collector.flush();
    this.collector.close();
  }
}
```

## Prometheus Queries

Example PromQL queries for the recorded metrics:

### Active Sessions
```promql
# Current active sessions by orchestrator
orchestrator_sessions_active{orchestrator_id="orch-1"}

# Total active sessions across all orchestrators
sum(orchestrator_sessions_active)
```

### Token Usage
```promql
# Total tokens used by orchestrator over last hour
rate(orchestrator_tokens_used_total{orchestrator_id="orch-1"}[1h])

# Tokens per model
sum by (model) (rate(orchestrator_tokens_used_total[5m]))
```

### Latency
```promql
# Average message latency
histogram_quantile(0.50, orchestrator_message_latency_seconds_bucket{orchestrator_id="orch-1"})

# P95 latency
histogram_quantile(0.95, orchestrator_message_latency_seconds_bucket{orchestrator_id="orch-1"})
```

### Error Rate
```promql
# Error rate over 5 minutes
rate(orchestrator_errors_total{orchestrator_id="orch-1"}[5m])

# Error rate by type
sum by (error_type) (rate(orchestrator_errors_total[5m]))
```

### Tool Success Rate
```promql
# Tool success rate
sum(rate(orchestrator_tool_invocations_total{status="success"}[5m])) /
sum(rate(orchestrator_tool_invocations_total[5m]))
```

## Best Practices

1. **Use Batching in Production**: Enable batching for high-throughput systems
2. **Consistent IDs**: Use consistent orchestrator and node IDs across metrics
3. **Timer Cleanup**: Always call timer functions to prevent memory leaks
4. **Graceful Shutdown**: Call `close()` during application shutdown
5. **Monitor Batch Size**: Adjust `maxBatchSize` based on update frequency
6. **Debug Mode**: Enable debug mode only in development/testing
7. **Error Recording**: Always record errors with specific error types
8. **Label Cardinality**: Limit unique label combinations to prevent metric explosion

## Troubleshooting

### Metrics Not Updating
- Check if batching is enabled and flush interval configured
- Call `flush()` manually to verify pending updates
- Enable debug mode to see metric recording logs

### High Memory Usage
- Reduce `maxBatchSize` if batch queue grows too large
- Check for timer leaks (uncalled timer functions)
- Monitor active timer count

### Prometheus Export Issues
- Verify registry is properly initialized with `register()`
- Check metric name format (must match Prometheus conventions)
- Ensure labels don't contain invalid characters

## See Also

- [Prometheus Client Documentation](https://github.com/siimon/prom-client)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Example Usage](../src/monitoring/examples/collector-usage.example.ts)
