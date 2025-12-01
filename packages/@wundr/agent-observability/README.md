# @wundr.io/agent-observability

Observability pipeline for AI agent monitoring - centralized logging, metrics collection, alerting,
and sensitive data redaction.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Observability Pipeline](#observability-pipeline)
  - [Tracing and Spans](#tracing-and-spans)
  - [Metrics Collection](#metrics-collection)
  - [Log Aggregation](#log-aggregation)
  - [Alerting Patterns](#alerting-patterns)
  - [Sensitive Data Redaction](#sensitive-data-redaction)
- [Dashboard Integration](#dashboard-integration)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Overview

`@wundr.io/agent-observability` provides a unified observability solution for AI agent systems. It
combines:

- **Centralized Logging** - Structured event collection with categories and log levels
- **Metrics Collection** - Counters, gauges, histograms, and summaries with dimensional labels
- **Distributed Tracing** - Trace and span IDs for request correlation across agents
- **Alerting** - Threshold-based and pattern-based alerting with cooldowns
- **Data Redaction** - Automatic removal of sensitive information from logs

## Installation

```bash
npm install @wundr.io/agent-observability
```

## Quick Start

```typescript
import { createObservabilityPipeline, CommonAlerts } from '@wundr.io/agent-observability';

// Create the pipeline
const pipeline = createObservabilityPipeline({
  minLogLevel: 'info',
  autoMetrics: true,
  defaultMetadata: {
    service: 'agent-orchestrator',
    environment: 'production',
  },
});

// Start the pipeline
pipeline.start();

// Log events
await pipeline.info(
  'agent',
  'Agent started processing',
  {
    taskCount: 5,
    queueDepth: 12,
  },
  {
    agentId: 'agent-001',
    traceId: 'trace-abc123',
  }
);

// Add alerts
pipeline.alertManager.addAlert(CommonAlerts.highErrorRate({ threshold: 10 }));

// Query logs
const result = await pipeline.query({
  levels: ['error', 'fatal'],
  limit: 100,
});

// Stop the pipeline
await pipeline.stop();
```

## Core Concepts

### Observability Pipeline

The `ObservabilityPipeline` is the central component that orchestrates logging, metrics, redaction,
and alerting.

```typescript
import { ObservabilityPipeline, createObservabilityPipeline } from '@wundr.io/agent-observability';

const pipeline = new ObservabilityPipeline({
  // Log store configuration
  logStore: {
    maxEvents: 10000,
    ttlMs: 86400000, // 24 hours
    persistenceEnabled: false,
    flushIntervalMs: 5000,
  },

  // Redaction configuration
  redaction: {
    enabled: true,
    sensitiveFields: ['password', 'apiKey', 'token'],
  },

  // Metrics configuration
  metrics: {
    maxDataPointsPerMetric: 10000,
    retentionPeriodMs: 86400000,
  },

  // Alert configuration
  alerts: {
    defaultCooldownMs: 300000, // 5 minutes
    maxAlertHistory: 1000,
    autoResolveEnabled: true,
  },

  // Pipeline settings
  autoMetrics: true,
  minLogLevel: 'info',
  bufferingEnabled: false,
  defaultMetadata: {
    service: 'my-agent-service',
  },
});

// Start and stop lifecycle
pipeline.start();
// ... operations ...
await pipeline.stop();
```

#### Logging Methods

```typescript
// Log at specific levels
await pipeline.trace('agent', 'Detailed trace message');
await pipeline.debug('task', 'Debug information', { taskId: '123' });
await pipeline.info('system', 'System started');
await pipeline.warn('memory', 'Memory usage high', { usagePercent: 85 });
await pipeline.error('llm', 'LLM call failed', new Error('Timeout'));
await pipeline.fatal('agent', 'Agent crashed', new Error('Fatal error'));

// Log with duration tracking
await pipeline.timed('performance', 'Request completed', 250, {
  endpoint: '/api/process',
});

// Timer helper
const timer = pipeline.startTimer();
// ... perform operation ...
await timer.end('performance', 'Operation completed', { items: 100 });
```

#### Event Categories

Events are categorized for filtering and analysis:

| Category      | Description                          |
| ------------- | ------------------------------------ |
| `agent`       | Agent lifecycle and behavior events  |
| `task`        | Task execution and status events     |
| `memory`      | Memory operations and state changes  |
| `llm`         | LLM API calls and responses          |
| `tool`        | Tool invocations and results         |
| `system`      | System-level events                  |
| `security`    | Security-related events              |
| `performance` | Performance metrics and measurements |
| `user`        | User interaction events              |
| `custom`      | Custom application events            |

#### Log Levels

| Level   | Priority | Use Case                  |
| ------- | -------- | ------------------------- |
| `trace` | 0        | Detailed debugging traces |
| `debug` | 1        | Debug information         |
| `info`  | 2        | General information       |
| `warn`  | 3        | Warning conditions        |
| `error` | 4        | Error conditions          |
| `fatal` | 5        | Critical failures         |

### Tracing and Spans

The observability system supports distributed tracing through trace and span IDs in event metadata.

```typescript
import { v4 as uuidv4 } from 'uuid';

// Create a trace context
const traceId = uuidv4();
const rootSpanId = uuidv4();

// Log parent operation
await pipeline.info(
  'agent',
  'Starting agent workflow',
  {},
  {
    traceId,
    spanId: rootSpanId,
    agentId: 'agent-001',
  }
);

// Log child operation
const childSpanId = uuidv4();
await pipeline.info(
  'task',
  'Processing task',
  {},
  {
    traceId,
    spanId: childSpanId,
    parentSpanId: rootSpanId,
    taskId: 'task-001',
  }
);

// Query by trace ID to see full request flow
const traceEvents = await pipeline.query({
  traceId,
  sortBy: 'timestamp',
  sortDirection: 'asc',
});
```

#### Metadata Fields for Tracing

```typescript
interface EventMetadata {
  agentId?: string; // Agent identifier
  taskId?: string; // Task identifier
  sessionId?: string; // User session ID
  traceId?: string; // Distributed trace ID
  spanId?: string; // Current span ID
  parentSpanId?: string; // Parent span for nesting
  environment?: string; // Deployment environment
  service?: string; // Service name
  host?: string; // Host identifier
  labels: Record<string, string>; // Custom string labels
  attributes: Record<string, unknown>; // Custom attributes
}
```

### Metrics Collection

The `MetricsCollector` provides comprehensive metrics collection with four metric types.

```typescript
import { MetricsCollector, createMetricsCollector } from '@wundr.io/agent-observability';

const metrics = createMetricsCollector({
  maxDataPointsPerMetric: 10000,
  defaultAggregationWindowMs: 60000,
  autoCleanup: true,
  cleanupIntervalMs: 60000,
  retentionPeriodMs: 86400000, // 24 hours
});
```

#### Counter Metrics

Counters are cumulative metrics that only increase (or reset to zero).

```typescript
// Define a counter
metrics.defineMetric({
  name: 'agent_requests_total',
  type: 'counter',
  description: 'Total number of agent requests',
  labels: ['agent_id', 'status'],
});

// Increment counter
metrics.incrementCounter('agent_requests_total', {
  agent_id: 'agent-001',
  status: 'success',
});

// Increment by specific value
metrics.incrementCounter(
  'agent_requests_total',
  {
    agent_id: 'agent-001',
    status: 'error',
  },
  5
);

// Get current value
const count = metrics.getCounter('agent_requests_total', {
  agent_id: 'agent-001',
  status: 'success',
});
```

#### Gauge Metrics

Gauges represent values that can go up or down.

```typescript
// Define a gauge
metrics.defineMetric({
  name: 'active_agents',
  type: 'gauge',
  description: 'Number of active agents',
  unit: 'agents',
});

// Set gauge value
metrics.setGauge('active_agents', 10);

// Increment/decrement gauge
metrics.incrementGauge('active_agents', 1);
metrics.decrementGauge('active_agents', 1);

// Get current value
const activeAgents = metrics.getGauge('active_agents');
```

#### Histogram Metrics

Histograms track value distributions across configurable buckets.

```typescript
// Define a histogram with custom buckets
metrics.defineMetric({
  name: 'llm_response_time_seconds',
  type: 'histogram',
  description: 'LLM response time distribution',
  unit: 'seconds',
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// Record observations
metrics.observeHistogram('llm_response_time_seconds', 0.35, {
  model: 'gpt-4',
});

// Get histogram statistics
const stats = metrics.getHistogram('llm_response_time_seconds', {
  model: 'gpt-4',
});
// { sum: 0.35, count: 1, avg: 0.35, buckets: Map { ... } }
```

#### Summary Metrics

Summaries calculate quantiles over observed values.

```typescript
// Define a summary with quantiles
metrics.defineMetric({
  name: 'request_duration_seconds',
  type: 'summary',
  description: 'Request duration quantiles',
  quantiles: [0.5, 0.9, 0.95, 0.99],
});

// Record observations
metrics.observeSummary('request_duration_seconds', 0.125);
metrics.observeSummary('request_duration_seconds', 0.25);
metrics.observeSummary('request_duration_seconds', 0.5);

// Get summary with quantiles
const summary = metrics.getSummary('request_duration_seconds');
// { count: 3, sum: 0.875, quantiles: { p50: 0.25, p90: 0.5, p95: 0.5, p99: 0.5 } }
```

#### Metrics Aggregation

```typescript
// Aggregate metrics over a time window
const aggregation = metrics.aggregate(
  'agent_requests_total',
  'sum', // Aggregation type: sum, avg, min, max, count, p50, p90, p95, p99
  new Date(Date.now() - 3600000), // Start time (1 hour ago)
  new Date(), // End time (now)
  { agent_id: 'agent-001' } // Optional label filter
);

// Get raw data points
const dataPoints = metrics.getDataPoints(
  'agent_requests_total',
  new Date(Date.now() - 3600000),
  new Date()
);

// Export all metrics
const exported = metrics.exportMetrics();
```

### Log Aggregation

The pipeline provides powerful querying capabilities for log aggregation.

```typescript
// Query logs with filters
const result = await pipeline.query({
  // Time range
  startTime: new Date(Date.now() - 3600000),
  endTime: new Date(),

  // Filter by level and category
  levels: ['warn', 'error', 'fatal'],
  categories: ['agent', 'llm'],

  // Filter by identifiers
  agentId: 'agent-001',
  taskId: 'task-123',
  sessionId: 'session-abc',
  traceId: 'trace-xyz',

  // Text search
  query: 'timeout',

  // Label filters
  labels: {
    environment: 'production',
  },

  // Pagination
  limit: 100,
  offset: 0,

  // Sorting
  sortBy: 'timestamp', // 'timestamp' | 'level' | 'category'
  sortDirection: 'desc', // 'asc' | 'desc'
});

// Result structure
// {
//   events: ObservabilityEvent[],
//   totalCount: number,
//   hasMore: boolean,
//   executionTimeMs: number
// }
```

#### Log Store Statistics

```typescript
const stats = await pipeline.getStatistics();
// {
//   totalEvents: 5000,
//   eventsByLevel: { trace: 100, debug: 500, info: 3000, warn: 800, error: 500, fatal: 100 },
//   eventsByCategory: { agent: 1000, task: 2000, ... },
//   oldestEvent: Date,
//   newestEvent: Date,
//   storageSizeBytes: 1024000,
//   pendingFlush: 0
// }
```

#### Log Deletion

```typescript
// Delete by criteria
const deletedCount = await pipeline.delete({
  beforeTime: new Date(Date.now() - 86400000 * 7), // Older than 7 days
  categories: ['debug'],
  levels: ['trace', 'debug'],
  ids: ['event-id-1', 'event-id-2'],
});

// Clear all logs
await pipeline.clear();
```

### Alerting Patterns

The `AlertManager` provides configurable alerting with conditions, cooldowns, and notification
channels.

```typescript
import { AlertManager, createAlertManager, CommonAlerts } from '@wundr.io/agent-observability';

const alertManager = createAlertManager({
  defaultCooldownMs: 300000, // 5 minutes
  maxAlertHistory: 1000,
  autoResolveEnabled: true,
  autoResolveTimeoutMs: 3600000, // 1 hour
  maxEventsPerEvaluation: 1000,
});
```

#### Defining Custom Alerts

```typescript
alertManager.addAlert({
  id: 'high-latency',
  name: 'High Latency Alert',
  description: 'Response latency exceeds threshold',
  severity: 'high', // 'low' | 'medium' | 'high' | 'critical'
  enabled: true,

  // Filter events to evaluate
  categories: ['performance'],
  levels: ['warn', 'error'],

  // All conditions must be met
  conditions: [
    {
      field: 'durationMs',
      operator: 'gte', // gt, gte, lt, lte, eq, neq, contains, matches
      threshold: 5000,
      windowMs: 300000, // Evaluation window (5 minutes)
      minOccurrences: 5, // Minimum events before triggering
    },
  ],

  cooldownMs: 600000, // 10 minute cooldown between alerts
  notificationChannels: ['slack', 'pagerduty'],
  metadata: { team: 'platform' },
});
```

#### Pre-built Alert Templates

```typescript
// High error rate
alertManager.addAlert(
  CommonAlerts.highErrorRate({
    threshold: 10, // Number of errors
    windowMs: 60000, // In 1 minute
    cooldownMs: 300000, // 5 minute cooldown
  })
);

// Agent failure
alertManager.addAlert(
  CommonAlerts.agentFailure({
    cooldownMs: 60000,
  })
);

// Slow response time
alertManager.addAlert(
  CommonAlerts.slowResponseTime({
    thresholdMs: 5000,
    windowMs: 300000,
    minOccurrences: 5,
  })
);

// Memory pressure
alertManager.addAlert(
  CommonAlerts.memoryPressure({
    thresholdPercent: 90,
    windowMs: 60000,
  })
);

// Security event (immediate alert)
alertManager.addAlert(
  CommonAlerts.securityEvent({
    cooldownMs: 0,
  })
);
```

#### Alert Handlers

```typescript
// Global alert handler
alertManager.onAlert(notification => {
  console.log('Alert triggered:', notification.alert.message);
  console.log('Severity:', notification.alert.severity);
  console.log('Events:', notification.events.length);
});

// Channel-specific handlers
alertManager.registerChannel('slack', async notification => {
  await sendSlackMessage({
    channel: '#alerts',
    text: `[${notification.alert.severity.toUpperCase()}] ${notification.alert.message}`,
  });
});

alertManager.registerChannel('pagerduty', async notification => {
  if (notification.alert.severity === 'critical') {
    await triggerPagerDutyIncident(notification);
  }
});
```

#### Alert Lifecycle Management

```typescript
// Acknowledge an alert
alertManager.acknowledge('alert-instance-id', 'operator@example.com');

// Resolve an alert
alertManager.resolve('alert-instance-id', 'Fixed by deploying hotfix v1.2.3');

// Query alerts
const activeAlerts = alertManager.getActiveAlerts();
const acknowledgedAlerts = alertManager.getAcknowledgedAlerts();
const criticalAlerts = alertManager.getAlertsBySeverity('critical');
const alertHistory = alertManager.getAlertHistory(100);

// Get statistics
const stats = alertManager.getStatistics();
// {
//   totalConfigurations: 5,
//   enabledConfigurations: 4,
//   activeAlerts: 2,
//   acknowledgedAlerts: 1,
//   alertsBySeverity: { low: 1, medium: 2, high: 3, critical: 0 },
//   alertsLast24h: 15,
//   alertsLastHour: 3
// }
```

### Sensitive Data Redaction

The `SensitiveDataRedactor` automatically removes or masks sensitive data from logs.

```typescript
import { SensitiveDataRedactor, createDefaultRedactor } from '@wundr.io/agent-observability';

// Create with default patterns
const redactor = createDefaultRedactor();

// Or customize configuration
const redactor = new SensitiveDataRedactor({
  enabled: true,
  preserveHash: true, // Keep hash for verification
  hashAlgorithm: 'sha256', // sha256, sha512, md5

  // Field names to always redact
  sensitiveFields: ['password', 'secret', 'token', 'apiKey', 'authorization'],

  // Pattern-based redaction
  patterns: [
    {
      name: 'custom_key',
      pattern: 'MY_SECRET_KEY=\\w+',
      replacement: 'MY_SECRET_KEY=[REDACTED]',
      fields: [], // Apply to all fields
      enabled: true,
    },
  ],
});
```

#### Built-in Redaction Patterns

The default redactor includes patterns for:

| Pattern        | Detects                      |
| -------------- | ---------------------------- |
| `api_key`      | API keys in various formats  |
| `password`     | Password fields and values   |
| `bearer_token` | Bearer authentication tokens |
| `credit_card`  | Credit card numbers          |
| `email`        | Email addresses              |
| `ssn`          | Social Security Numbers      |

#### Manual Redaction

```typescript
// Redact an object
const result = redactor.redact({
  username: 'john',
  password: 'secret123',
  data: {
    apiKey: 'sk-abc123',
    nested: {
      secret: 'value',
    },
  },
});

// Result:
// {
//   data: {
//     username: 'john',
//     password: '[REDACTED]',
//     data: {
//       apiKey: '[REDACTED]',
//       nested: { secret: '[REDACTED]' }
//     }
//   },
//   wasRedacted: true,
//   redactedFields: ['password', 'data.apiKey', 'data.nested.secret'],
//   valueHashes: { ... } // If preserveHash enabled
// }

// Redact an event
const redactedEvent = redactor.redactEvent(event);
```

#### Pattern Management

```typescript
// Add new pattern
redactor.addPattern({
  name: 'internal_token',
  pattern: 'INTERNAL_[A-Z0-9]{32}',
  replacement: '[INTERNAL_TOKEN_REDACTED]',
  enabled: true,
});

// Enable/disable pattern
redactor.setPatternEnabled('email', false);

// Remove pattern
redactor.removePattern('internal_token');

// Add sensitive field
redactor.addSensitiveField('privateKey');

// Test if value would be redacted
const wouldRedact = redactor.wouldRedact('Bearer abc123');
```

## Dashboard Integration

### Prometheus/Grafana Export

```typescript
// Export metrics in a format suitable for Prometheus
function exportForPrometheus(metrics: MetricsCollector): string {
  const exported = metrics.exportMetrics();
  const lines: string[] = [];

  for (const metric of exported.metrics) {
    for (const { labels, value } of metric.values) {
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');

      if (typeof value === 'number') {
        lines.push(`${metric.name}{${labelStr}} ${value}`);
      } else if (typeof value === 'object') {
        // Handle histogram/summary
        const obj = value as Record<string, unknown>;
        if ('count' in obj) {
          lines.push(`${metric.name}_count{${labelStr}} ${obj.count}`);
        }
        if ('sum' in obj) {
          lines.push(`${metric.name}_sum{${labelStr}} ${obj.sum}`);
        }
      }
    }
  }

  return lines.join('\n');
}
```

### Custom Dashboard Data

```typescript
// Build dashboard data
async function getDashboardData(pipeline: ObservabilityPipeline) {
  const [stats, alertStats] = await Promise.all([
    pipeline.getStatistics(),
    Promise.resolve(pipeline.alertManager.getStatistics()),
  ]);

  // Get metrics
  const metricsExport = pipeline.metrics.exportMetrics();

  // Get recent errors
  const recentErrors = await pipeline.query({
    levels: ['error', 'fatal'],
    limit: 10,
    sortBy: 'timestamp',
    sortDirection: 'desc',
  });

  return {
    logs: {
      total: stats.totalEvents,
      byLevel: stats.eventsByLevel,
      byCategory: stats.eventsByCategory,
      storageBytes: stats.storageSizeBytes,
    },
    alerts: {
      active: alertStats.activeAlerts,
      acknowledged: alertStats.acknowledgedAlerts,
      bySeverity: alertStats.alertsBySeverity,
      lastHour: alertStats.alertsLastHour,
      last24h: alertStats.alertsLast24h,
    },
    metrics: metricsExport,
    recentErrors: recentErrors.events,
  };
}
```

### Pipeline Event Handlers

```typescript
// Listen for pipeline events
pipeline.on('event:received', event => {
  // Real-time event processing
});

pipeline.on('event:redacted', event => {
  // Track redaction activity
});

pipeline.on('alert:triggered', event => {
  // Handle triggered alerts
  const alert = event.data.triggeredAlert;
});

pipeline.on('metric:recorded', event => {
  // Metric update notifications
});

pipeline.on('pipeline:started', () => {
  console.log('Pipeline started');
});

pipeline.on('pipeline:stopped', () => {
  console.log('Pipeline stopped');
});

pipeline.on('pipeline:error', event => {
  console.error('Pipeline error:', event);
});
```

## API Reference

### ObservabilityPipeline

| Method                                                   | Description                          |
| -------------------------------------------------------- | ------------------------------------ |
| `start()`                                                | Start the pipeline                   |
| `stop()`                                                 | Stop the pipeline                    |
| `log(options)`                                           | Log an event with options            |
| `trace/debug/info/warn/error/fatal()`                    | Log at specific level                |
| `timed(category, message, durationMs, data?, metadata?)` | Log with duration                    |
| `startTimer()`                                           | Create a timer for duration tracking |
| `query(options)`                                         | Query stored events                  |
| `get(id)`                                                | Get event by ID                      |
| `delete(criteria)`                                       | Delete events                        |
| `getStatistics()`                                        | Get store statistics                 |
| `clear()`                                                | Clear all events                     |
| `on(eventType, handler)`                                 | Register event handler               |
| `off(eventType, handler)`                                | Remove event handler                 |
| `getStore()`                                             | Get underlying log store             |
| `setStore(store)`                                        | Set custom log store                 |
| `flushBuffer()`                                          | Flush event buffer                   |

### MetricsCollector

| Method                                       | Description                  |
| -------------------------------------------- | ---------------------------- |
| `defineMetric(definition)`                   | Define a new metric          |
| `incrementCounter(name, labels?, value?)`    | Increment counter            |
| `getCounter(name, labels?)`                  | Get counter value            |
| `setGauge(name, value, labels?)`             | Set gauge value              |
| `incrementGauge/decrementGauge()`            | Adjust gauge                 |
| `getGauge(name, labels?)`                    | Get gauge value              |
| `observeHistogram(name, value, labels?)`     | Record histogram observation |
| `getHistogram(name, labels?)`                | Get histogram statistics     |
| `observeSummary(name, value, labels?)`       | Record summary observation   |
| `getSummary(name, labels?)`                  | Get summary with quantiles   |
| `aggregate(name, type, start, end, labels?)` | Aggregate metric data        |
| `getDataPoints(name, start?, end?)`          | Get raw data points          |
| `exportMetrics()`                            | Export all metrics           |
| `resetMetric(name, labels?)`                 | Reset metric                 |
| `clearAll()`                                 | Clear all metrics            |
| `close()`                                    | Stop cleanup timer           |

### AlertManager

| Method                           | Description                   |
| -------------------------------- | ----------------------------- |
| `addAlert(config)`               | Add alert configuration       |
| `removeAlert(id)`                | Remove alert                  |
| `getAlert(id)`                   | Get alert config              |
| `getAllAlerts()`                 | Get all alert configs         |
| `setAlertEnabled(id, enabled)`   | Enable/disable alert          |
| `updateAlert(id, updates)`       | Update alert config           |
| `onAlert(handler)`               | Register alert handler        |
| `offAlert(handler)`              | Remove handler                |
| `registerChannel(name, handler)` | Register notification channel |
| `unregisterChannel(name)`        | Remove channel                |
| `evaluate(event)`                | Evaluate event against alerts |
| `evaluateBatch(events)`          | Batch evaluation              |
| `acknowledge(id, by)`            | Acknowledge alert             |
| `resolve(id, notes?)`            | Resolve alert                 |
| `getActiveAlerts()`              | Get active alerts             |
| `getAcknowledgedAlerts()`        | Get acknowledged alerts       |
| `getAlertsBySeverity(severity)`  | Filter by severity            |
| `getAlertHistory(limit?)`        | Get resolved alerts           |
| `getStatistics()`                | Get alert statistics          |
| `clearState()`                   | Clear alert state             |
| `clearAll()`                     | Clear all alerts              |
| `checkAutoResolve()`             | Auto-resolve aged alerts      |

### SensitiveDataRedactor

| Method                             | Description                     |
| ---------------------------------- | ------------------------------- |
| `redact(data, path?)`              | Redact an object                |
| `redactEvent(event)`               | Redact an observability event   |
| `addPattern(pattern)`              | Add redaction pattern           |
| `removePattern(name)`              | Remove pattern                  |
| `setPatternEnabled(name, enabled)` | Enable/disable pattern          |
| `addSensitiveField(name)`          | Add sensitive field             |
| `removeSensitiveField(name)`       | Remove sensitive field          |
| `setEnabled(enabled)`              | Enable/disable redaction        |
| `isEnabled()`                      | Check if enabled                |
| `getConfig()`                      | Get current config              |
| `getActivePatterns()`              | Get enabled patterns            |
| `wouldRedact(value)`               | Test if value would be redacted |

## Configuration

### ObservabilityPipelineConfig

```typescript
interface ObservabilityPipelineConfig {
  logStore?: Partial<LogStoreConfig>;
  redaction?: Partial<RedactionConfig>;
  metrics?: Partial<MetricsCollectorConfig>;
  alerts?: Partial<AlertManagerConfig>;
  autoMetrics?: boolean;
  defaultMetadata?: Partial<EventMetadata>;
  minLogLevel?: LogLevel;
  bufferingEnabled?: boolean;
  bufferFlushIntervalMs?: number;
  maxBufferSize?: number;
}
```

### LogStoreConfig

```typescript
interface LogStoreConfig {
  maxEvents: number; // Default: 10000
  ttlMs?: number; // Default: 86400000 (24h)
  persistenceEnabled: boolean; // Default: false
  persistencePath?: string;
  flushIntervalMs: number; // Default: 5000
  compressionEnabled: boolean; // Default: false
  batchSize: number; // Default: 100
}
```

### MetricsCollectorConfig

```typescript
interface MetricsCollectorConfig {
  maxDataPointsPerMetric: number; // Default: 10000
  defaultAggregationWindowMs: number; // Default: 60000
  autoCleanup: boolean; // Default: true
  cleanupIntervalMs: number; // Default: 60000
  retentionPeriodMs: number; // Default: 86400000
}
```

### AlertManagerConfig

```typescript
interface AlertManagerConfig {
  defaultCooldownMs: number; // Default: 300000 (5min)
  maxAlertHistory: number; // Default: 1000
  autoResolveEnabled: boolean; // Default: true
  autoResolveTimeoutMs: number; // Default: 3600000 (1h)
  maxEventsPerEvaluation: number; // Default: 1000
}
```

### RedactionConfig

```typescript
interface RedactionConfig {
  enabled: boolean; // Default: true
  patterns: RedactionPattern[]; // Default: built-in patterns
  sensitiveFields: string[]; // Default: common field names
  preserveHash: boolean; // Default: false
  hashAlgorithm: 'sha256' | 'sha512' | 'md5'; // Default: 'sha256'
}
```

## Best Practices

### 1. Use Structured Metadata

```typescript
// Good: Structured, queryable metadata
await pipeline.info(
  'agent',
  'Task completed',
  {
    result: 'success',
    itemsProcessed: 100,
  },
  {
    agentId: 'agent-001',
    taskId: 'task-123',
    traceId: 'trace-abc',
    labels: {
      environment: 'production',
      region: 'us-east-1',
    },
  }
);

// Avoid: Unstructured messages
await pipeline.info('agent', 'agent-001 completed task-123 with 100 items');
```

### 2. Use Appropriate Log Levels

```typescript
// trace: Detailed debugging (normally disabled)
await pipeline.trace('llm', 'Token-by-token response', { tokens });

// debug: Development debugging
await pipeline.debug('task', 'Task state transition', { from, to });

// info: Normal operations
await pipeline.info('agent', 'Agent started');

// warn: Potential issues
await pipeline.warn('memory', 'Memory usage above 80%');

// error: Recoverable errors
await pipeline.error('llm', 'API call failed, retrying', error);

// fatal: Unrecoverable errors
await pipeline.fatal('agent', 'Agent crashed', error);
```

### 3. Set Up Meaningful Alerts

```typescript
// Start with pre-built templates
alertManager.addAlert(CommonAlerts.highErrorRate({ threshold: 10 }));

// Add business-specific alerts
alertManager.addAlert({
  id: 'task-backlog',
  name: 'Task Backlog Growing',
  severity: 'medium',
  categories: ['task'],
  conditions: [
    {
      field: 'data.queueDepth',
      operator: 'gte',
      threshold: 100,
      windowMs: 300000,
      minOccurrences: 3,
    },
  ],
  cooldownMs: 600000,
  notificationChannels: ['slack'],
});
```

### 4. Use Tracing for Distributed Systems

```typescript
// Create trace context at entry point
const traceId = generateTraceId();

// Pass through all operations
async function processRequest(request, traceId) {
  const spanId = generateSpanId();

  await pipeline.info(
    'api',
    'Request received',
    { request },
    {
      traceId,
      spanId,
    }
  );

  // Pass to downstream services
  await callDownstreamService(request, traceId, spanId);
}
```

### 5. Configure Redaction for Compliance

```typescript
// Add patterns for your specific sensitive data
redactor.addPattern({
  name: 'internal_user_id',
  pattern: 'user_[a-f0-9]{32}',
  replacement: 'user_[REDACTED]',
  enabled: true,
});

// Add fields specific to your domain
redactor.addSensitiveField('socialSecurityNumber');
redactor.addSensitiveField('bankAccountNumber');
```

### 6. Monitor Pipeline Health

```typescript
// Periodic health check
setInterval(async () => {
  const stats = await pipeline.getStatistics();
  const alertStats = pipeline.alertManager.getStatistics();

  // Check for issues
  if (stats.pendingFlush > 1000) {
    console.warn('High pending flush count');
  }

  if (alertStats.activeAlerts > 10) {
    console.warn('Many active alerts');
  }
}, 60000);
```

## License

MIT
