# Wave 2 Analysis: Enhanced Metrics & Monitoring System

## Document ID: 26
## Status: Implementation Ready
## Priority: P1 (Critical Infrastructure)

---

## 1. Executive Summary

The orchestrator daemon has a foundational Prometheus metrics layer (`monitoring/metrics.ts`, `monitoring/collector.ts`, `monitoring/endpoint.ts`) that covers session counts, token usage, message latency, tool invocations, federation delegations, node load, errors, and budget utilization. However, the system lacks several critical observability capabilities:

- **Structured logging** -- the existing `Logger` class writes unstructured console output with no correlation IDs
- **Distributed tracing** -- no trace/span propagation across agent boundaries, sessions, or WebSocket messages
- **Agent lifecycle metrics** -- spawned/running/completed/failed states are tracked in `DaemonMetrics` (the internal type) but not exposed to Prometheus
- **Memory system metrics** -- no counters for entries, searches, cache hits, or compaction events
- **WebSocket metrics** -- connections, messages, and errors are logged but not metered
- **Model routing metrics** -- provider, model, latency, and cost are not observable
- **Queue depth** -- the TODO in `getStatus()` (`queuedTasks: 0`) has no backing metric
- **System resource metrics** -- process memory, CPU, and file descriptor counts are not collected
- **Health checks** -- the endpoint exists but only checks redis/database/federation; subsystem health from `getStatus()` is not surfaced
- **Alerting rules** -- no configurable threshold definitions beyond budget alerts

This document designs an enhanced monitoring system that fills every gap above while maintaining backward compatibility with the existing `prom-client` integration.

---

## 2. Current State Analysis

### 2.1 Existing Prometheus Metrics (`monitoring/metrics.ts`)

| Metric Name | Type | Labels | Status |
|---|---|---|---|
| `orchestrator_sessions_active` | Gauge | orchestrator_id, session_type | Working |
| `orchestrator_tokens_used_total` | Counter | orchestrator_id, model | Working |
| `orchestrator_message_latency_seconds` | Histogram | orchestrator_id | Working |
| `orchestrator_tool_invocations_total` | Counter | orchestrator_id, tool_name, status | Working |
| `orchestrator_federation_delegations_total` | Counter | from/to_orchestrator, status | Working |
| `orchestrator_node_load` | Gauge | node_id | Working |
| `orchestrator_errors_total` | Counter | orchestrator_id, error_type | Working |
| `orchestrator_budget_utilization_percent` | Gauge | orchestrator_id, period | Working |

### 2.2 Existing Logger (`utils/logger.ts`)

- Simple console-based logger with `DEBUG/INFO/WARN/ERROR` levels
- No JSON output, no correlation IDs, no context propagation
- Used across all modules: `new Logger('ComponentName')`

### 2.3 Existing Health Endpoint (`monitoring/endpoint.ts`)

- HTTP server on port 9090 (configurable)
- Routes: `/metrics`, `/health`, `/ready`
- Health checks: redis, database, federationRegistry (all optional, default to true)
- No integration with `DaemonStatus.subsystems`

### 2.4 OpenClaw Patterns

OpenClaw uses `pino`-style structured logging via `getChildLogger({ module, runId })` with fields like `connectionId`, `reconnectAttempts`, `messagesHandled`, `uptimeMs`. The Discord gateway attaches event-based metrics logging. These patterns inform our structured logging design.

---

## 3. Enhanced Metrics Design

### 3.1 New Prometheus Metrics

All new metrics use the `wundr_` prefix to distinguish from the existing `orchestrator_` metrics, which remain for backward compatibility.

#### Agent Lifecycle Metrics

```
wundr_agent_spawned_total              Counter   {orchestrator_id, session_type}
wundr_agent_running                    Gauge     {orchestrator_id, session_type}
wundr_agent_completed_total            Counter   {orchestrator_id, session_type, exit_reason}
wundr_agent_failed_total               Counter   {orchestrator_id, session_type, error_type}
wundr_agent_duration_seconds           Histogram {orchestrator_id, session_type}
```

#### Session Metrics (enhanced)

```
wundr_session_duration_seconds         Histogram {orchestrator_id, session_type}
wundr_session_tokens_prompt_total      Counter   {orchestrator_id, model}
wundr_session_tokens_completion_total  Counter   {orchestrator_id, model}
wundr_session_cost_dollars_total       Counter   {orchestrator_id, model, provider}
wundr_session_iterations_total         Counter   {orchestrator_id}
```

#### Memory System Metrics

```
wundr_memory_entries_total             Gauge     {tier, orchestrator_id}
wundr_memory_searches_total            Counter   {tier, orchestrator_id}
wundr_memory_search_latency_seconds    Histogram {tier}
wundr_memory_cache_hits_total          Counter   {tier}
wundr_memory_cache_misses_total        Counter   {tier}
wundr_memory_compaction_total          Counter   {tier, strategy}
wundr_memory_bytes                     Gauge     {tier}
```

#### Tool Execution Metrics (enhanced)

```
wundr_tool_execution_duration_seconds  Histogram {tool_name, status}
wundr_tool_execution_total             Counter   {tool_name, status}
wundr_tool_errors_total                Counter   {tool_name, error_type}
wundr_tool_queue_depth                 Gauge     {}
```

#### WebSocket Metrics

```
wundr_ws_connections_active            Gauge     {}
wundr_ws_connections_total             Counter   {auth_method}
wundr_ws_messages_received_total       Counter   {message_type}
wundr_ws_messages_sent_total           Counter   {message_type}
wundr_ws_message_size_bytes            Histogram {direction}
wundr_ws_errors_total                  Counter   {error_type}
wundr_ws_session_subscriptions         Gauge     {}
```

#### Model Routing Metrics

```
wundr_model_requests_total             Counter   {provider, model}
wundr_model_request_duration_seconds   Histogram {provider, model}
wundr_model_request_tokens_total       Counter   {provider, model, token_type}
wundr_model_cost_dollars_total         Counter   {provider, model}
wundr_model_errors_total               Counter   {provider, model, error_type}
wundr_model_rate_limited_total         Counter   {provider, model}
```

#### Queue and Processing Metrics

```
wundr_queue_depth                      Gauge     {queue_name}
wundr_queue_processing_duration_seconds Histogram {queue_name}
wundr_queue_enqueued_total             Counter   {queue_name}
wundr_queue_dequeued_total             Counter   {queue_name}
wundr_queue_dropped_total              Counter   {queue_name, reason}
```

#### System Resource Metrics

```
wundr_process_memory_heap_bytes        Gauge     {}
wundr_process_memory_rss_bytes         Gauge     {}
wundr_process_memory_external_bytes    Gauge     {}
wundr_process_cpu_user_seconds_total   Counter   {}
wundr_process_cpu_system_seconds_total Counter   {}
wundr_process_open_fds                 Gauge     {}
wundr_process_max_fds                  Gauge     {}
wundr_process_event_loop_lag_seconds   Histogram {}
wundr_process_uptime_seconds           Gauge     {}
```

### 3.2 Metrics Registry Architecture

```
MetricsRegistry (existing, backward-compatible)
  |
  +-- EnhancedMetricsRegistry (new, extends)
       |
       +-- AgentMetrics
       +-- SessionMetrics
       +-- MemoryMetrics
       +-- ToolMetrics
       +-- WebSocketMetrics
       +-- ModelRoutingMetrics
       +-- QueueMetrics
       +-- SystemMetrics
```

The `EnhancedMetricsRegistry` creates all new metrics on a shared `prom-client` `Registry` instance, allowing the existing `/metrics` endpoint to serve everything.

---

## 4. Structured Logging Design

### 4.1 Logger Architecture

Replace the existing `Logger` class with `StructuredLogger` that outputs JSON logs with correlation IDs while maintaining the same call-site API.

```typescript
interface LogEntry {
  timestamp: string;          // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  component: string;          // Logger name (e.g., 'SessionExecutor')
  traceId?: string;           // Distributed trace ID
  spanId?: string;            // Span within the trace
  parentSpanId?: string;      // Parent span
  sessionId?: string;         // Active session
  orchestratorId?: string;    // Owning orchestrator
  correlationId?: string;     // Request correlation
  duration?: number;          // Operation duration in ms
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}
```

### 4.2 Log Output Modes

| Mode | Format | Use Case |
|---|---|---|
| `json` | One JSON object per line | Production (log aggregation) |
| `text` | `[timestamp] [LEVEL] [component] message` | Development / TTY |

Selected via `LOG_FORMAT` environment variable (already in config schema).

### 4.3 Child Logger Pattern

Following OpenClaw's `getChildLogger` pattern:

```typescript
const logger = new StructuredLogger('SessionExecutor');
const child = logger.child({
  sessionId: session.id,
  orchestratorId: session.orchestratorId,
  traceId: trace.id,
});
child.info('Session started');
// Output: {"timestamp":"...","level":"info","message":"Session started","component":"SessionExecutor","sessionId":"sess_123","orchestratorId":"orch_1","traceId":"trace_abc"}
```

---

## 5. Distributed Tracing Design

### 5.1 Trace Context

```typescript
interface TraceContext {
  traceId: string;      // 32-char hex, propagated across boundaries
  spanId: string;       // 16-char hex, unique per operation
  parentSpanId?: string;
  baggage: Map<string, string>;  // Propagated key-value pairs
}
```

### 5.2 Propagation Points

| Boundary | Mechanism |
|---|---|
| WebSocket message -> session | `x-trace-id` field in WSMessage payload |
| Session -> tool execution | TraceContext passed through ToolExecutor |
| Session -> LLM call | TraceContext in request metadata |
| Orchestrator -> federation | `x-trace-id` header in delegation request |
| HTTP metrics endpoint | `X-Trace-Id` response header |

### 5.3 Span Lifecycle

```
[WebSocket Message Received]
  |
  +-- [Session Spawn] (spanId=A, parentSpanId=root)
       |
       +-- [LLM Call] (spanId=B, parentSpanId=A)
       |
       +-- [Tool Execution: drift_detection] (spanId=C, parentSpanId=A)
       |    |
       |    +-- [MCP Call] (spanId=D, parentSpanId=C)
       |
       +-- [LLM Call] (spanId=E, parentSpanId=A)
       |
       +-- [Session Complete] (spanId=F, parentSpanId=A)
```

### 5.4 W3C Trace Context Compatibility

The trace ID format follows W3C Trace Context (32 hex chars for trace ID, 16 hex chars for span ID) so traces can be exported to OpenTelemetry-compatible backends (Jaeger, Zipkin, Datadog) without conversion.

---

## 6. Enhanced Health Check Design

### 6.1 Component Health Model

```typescript
interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;          // Check duration in ms
  message?: string;
  lastCheck: string;         // ISO 8601
  metadata?: Record<string, unknown>;
}

interface EnhancedHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: {
    websocket: ComponentHealth;
    sessionManager: ComponentHealth;
    memoryManager: ComponentHealth;
    llmClient: ComponentHealth;
    mcpRegistry: ComponentHealth;
    redis?: ComponentHealth;
    database?: ComponentHealth;
    federation?: ComponentHealth;
  };
  metrics: {
    activeSessions: number;
    queuedTasks: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
    uptimeSeconds: number;
  };
}
```

### 6.2 Health Check Integration

The enhanced health endpoint integrates with `OrchestratorDaemon.getStatus()` to surface the subsystem status already tracked there, plus adds latency-checked probes for external dependencies.

---

## 7. Alerting Rules Design

### 7.1 Rule Configuration

```typescript
interface AlertRule {
  name: string;
  description: string;
  metric: string;               // Prometheus metric name
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number;             // Seconds the condition must hold
  severity: 'info' | 'warning' | 'critical';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  actions: AlertAction[];
}

interface AlertAction {
  type: 'log' | 'event' | 'webhook' | 'metric';
  config: Record<string, unknown>;
}
```

### 7.2 Default Alert Rules

| Rule | Metric | Condition | Threshold | Severity |
|---|---|---|---|---|
| High Error Rate | `wundr_agent_failed_total` / `wundr_agent_spawned_total` | > | 0.1 (10%) | warning |
| Session Duration | `wundr_session_duration_seconds` p99 | > | 300s | warning |
| Memory Pressure | `wundr_process_memory_heap_bytes` | > | 80% of max | critical |
| WebSocket Errors | `wundr_ws_errors_total` rate | > | 10/min | warning |
| Budget Exhaustion | `orchestrator_budget_utilization_percent` | > | 90 | critical |
| LLM Latency | `wundr_model_request_duration_seconds` p95 | > | 30s | warning |
| Queue Backlog | `wundr_queue_depth` | > | 100 | warning |
| Tool Failures | `wundr_tool_errors_total` rate | > | 5/min | warning |

### 7.3 Prometheus Alertmanager Export

Alert rules are exported as Prometheus recording/alerting rules in YAML format compatible with Alertmanager:

```yaml
groups:
  - name: wundr_alerts
    rules:
      - alert: HighAgentFailureRate
        expr: rate(wundr_agent_failed_total[5m]) / rate(wundr_agent_spawned_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Agent failure rate exceeds 10%"
```

---

## 8. Implementation Plan

### 8.1 File Structure

```
monitoring/
  index.ts                  -- Updated barrel exports
  types.ts                  -- Existing + new type definitions
  metrics.ts                -- Enhanced with new metric categories
  collector.ts              -- Existing (backward-compatible)
  endpoint.ts               -- Existing (enhanced health checks)
  logger.ts                 -- NEW: Structured JSON logging
  tracing.ts                -- NEW: Distributed tracing
  health.ts                 -- NEW: Enhanced health check logic
  __tests__/
    endpoint.test.ts         -- Existing
```

### 8.2 Migration Strategy

1. **Phase 1**: Add new files (`logger.ts`, `tracing.ts`, `health.ts`) -- zero breaking changes
2. **Phase 2**: Enhance `metrics.ts` with new metric categories -- additive only
3. **Phase 3**: Update `endpoint.ts` to use enhanced health checks -- backward-compatible
4. **Phase 4**: Migrate existing `Logger` usages to `StructuredLogger` -- gradual

### 8.3 Dependencies

- `prom-client` (existing) -- Prometheus metrics
- No new external dependencies; the structured logger and tracing are built in-house

---

## 9. Grafana Dashboard Model

A JSON dashboard model targeting Grafana 10+ is provided alongside the implementation. Key panels:

1. **Agent Overview**: Spawned/Running/Completed/Failed time series
2. **Session Performance**: Duration histogram, token usage, cost breakdown
3. **Memory System**: Entries by tier, search latency, cache hit ratio
4. **Tool Execution**: Invocations by tool, duration percentiles, error rates
5. **WebSocket Health**: Active connections, message throughput, error rate
6. **Model Routing**: Requests by provider/model, latency heatmap, cost accumulation
7. **System Resources**: Memory/CPU/FD usage, event loop lag
8. **Budget Tracking**: Utilization by period, threshold alerts

---

## 10. Integration Points

| Component | Integration | Mechanism |
|---|---|---|
| `OrchestratorDaemon` | Agent lifecycle metrics | Emit on spawn/complete/fail events |
| `SessionExecutor` | Session metrics, tracing | Wrap `executeSession` with trace spans |
| `SessionManager` | Session count gauge | Update on spawn/stop |
| `MemoryManager` | Memory metrics | Instrument store/search/compact |
| `ToolExecutor` | Tool metrics | Wrap `executeToolCalls` |
| `WebSocketServer` | WS metrics | Instrument connection/message handlers |
| `LLM Client` | Model routing metrics | Wrap `chat()` calls |
| `TokenBudgetTracker` | Budget metrics | Forward threshold events |

---

## 11. Configuration

All new monitoring features are controlled via environment variables (matching existing config schema patterns):

```env
# Structured Logging
LOG_FORMAT=json                    # json | text
LOG_LEVEL=info                     # debug | info | warn | error

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_COLLECT_DEFAULT=true       # prom-client default metrics

# Tracing
TRACING_ENABLED=true
TRACING_SAMPLE_RATE=1.0           # 0.0 - 1.0

# Health
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_TIMEOUT=5000         # ms per component check

# Alerting
ALERTING_ENABLED=true
ALERTING_EVALUATION_INTERVAL=30   # seconds
```

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Metric cardinality explosion | Medium | High | Bound label values; document allowed label sets |
| Logger performance overhead | Low | Medium | Async writes; configurable log level |
| Trace context memory leak | Low | Medium | Auto-expire spans after configurable TTL |
| Breaking existing metrics consumers | Low | High | All new metrics use `wundr_` prefix; existing `orchestrator_` metrics unchanged |
| Health check false positives | Medium | Low | Configurable timeouts; degraded vs unhealthy distinction |
