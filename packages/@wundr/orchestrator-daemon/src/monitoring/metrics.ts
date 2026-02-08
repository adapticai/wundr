/**
 * Prometheus Metrics for Orchestrator Daemon
 *
 * Implements comprehensive monitoring for orchestration operations.
 *
 * This module contains two metric families:
 *   1. Legacy `orchestrator_*` metrics (backward-compatible, unchanged)
 *   2. Enhanced `wundr_*` metrics (new, covering agent lifecycle, sessions,
 *      memory, tools, WebSocket, model routing, queues, and system resources)
 *
 * Both families are registered on the same prom-client Registry so the
 * existing /metrics endpoint serves everything without changes.
 */

import { Counter, Gauge, Histogram, Registry, register as defaultRegister } from 'prom-client';
import type {
  DaemonMetrics,
  IMetricsRegistry,
  SessionLabels,
  TokenLabels,
  LatencyLabels,
  ToolLabels,
  FederationLabels,
  NodeLabels,
  ErrorLabels,
  BudgetLabels,
} from './types';

// ===========================================================================
// Legacy Metrics (orchestrator_* prefix) -- unchanged for backward compat
// ===========================================================================

/**
 * Daemon metrics collection
 */
export const daemonMetrics: DaemonMetrics = {
  sessionsActive: new Gauge<string>({
    name: 'orchestrator_sessions_active',
    help: 'Number of currently active orchestrator sessions',
    labelNames: ['orchestrator_id', 'session_type'],
  }),

  tokensUsed: new Counter<string>({
    name: 'orchestrator_tokens_used_total',
    help: 'Total number of tokens used by the orchestrator',
    labelNames: ['orchestrator_id', 'model'],
  }),

  messageLatency: new Histogram<string>({
    name: 'orchestrator_message_latency_seconds',
    help: 'Message processing latency in seconds',
    labelNames: ['orchestrator_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  toolInvocations: new Counter<string>({
    name: 'orchestrator_tool_invocations_total',
    help: 'Total number of tool invocations',
    labelNames: ['orchestrator_id', 'tool_name', 'status'],
  }),

  federationDelegations: new Counter<string>({
    name: 'orchestrator_federation_delegations_total',
    help: 'Total number of federation delegation requests',
    labelNames: ['from_orchestrator', 'to_orchestrator', 'status'],
  }),

  nodeLoad: new Gauge<string>({
    name: 'orchestrator_node_load',
    help: 'Current load on orchestrator nodes',
    labelNames: ['node_id'],
  }),

  errorCount: new Counter<string>({
    name: 'orchestrator_errors_total',
    help: 'Total number of errors by type',
    labelNames: ['orchestrator_id', 'error_type'],
  }),

  budgetUtilization: new Gauge<string>({
    name: 'orchestrator_budget_utilization_percent',
    help: 'Budget utilization percentage by period',
    labelNames: ['orchestrator_id', 'period'],
  }),
};

// ===========================================================================
// Enhanced Metrics (wundr_* prefix) -- new categories
// ===========================================================================

// ---- Agent Lifecycle ----

export interface AgentLifecycleMetrics {
  spawned: Counter<string>;
  running: Gauge<string>;
  completed: Counter<string>;
  failed: Counter<string>;
  duration: Histogram<string>;
}

export const agentMetrics: AgentLifecycleMetrics = {
  spawned: new Counter<string>({
    name: 'wundr_agent_spawned_total',
    help: 'Total number of agents spawned',
    labelNames: ['orchestrator_id', 'session_type'],
  }),
  running: new Gauge<string>({
    name: 'wundr_agent_running',
    help: 'Number of currently running agents',
    labelNames: ['orchestrator_id', 'session_type'],
  }),
  completed: new Counter<string>({
    name: 'wundr_agent_completed_total',
    help: 'Total number of agents that completed successfully',
    labelNames: ['orchestrator_id', 'session_type', 'exit_reason'],
  }),
  failed: new Counter<string>({
    name: 'wundr_agent_failed_total',
    help: 'Total number of agents that failed',
    labelNames: ['orchestrator_id', 'session_type', 'error_type'],
  }),
  duration: new Histogram<string>({
    name: 'wundr_agent_duration_seconds',
    help: 'Agent session duration in seconds',
    labelNames: ['orchestrator_id', 'session_type'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
  }),
};

// ---- Session Metrics (enhanced) ----

export interface EnhancedSessionMetrics {
  duration: Histogram<string>;
  tokensPrompt: Counter<string>;
  tokensCompletion: Counter<string>;
  cost: Counter<string>;
  iterations: Counter<string>;
}

export const sessionMetrics: EnhancedSessionMetrics = {
  duration: new Histogram<string>({
    name: 'wundr_session_duration_seconds',
    help: 'Session execution duration in seconds',
    labelNames: ['orchestrator_id', 'session_type'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  }),
  tokensPrompt: new Counter<string>({
    name: 'wundr_session_tokens_prompt_total',
    help: 'Total prompt tokens consumed',
    labelNames: ['orchestrator_id', 'model'],
  }),
  tokensCompletion: new Counter<string>({
    name: 'wundr_session_tokens_completion_total',
    help: 'Total completion tokens consumed',
    labelNames: ['orchestrator_id', 'model'],
  }),
  cost: new Counter<string>({
    name: 'wundr_session_cost_dollars_total',
    help: 'Total cost in USD',
    labelNames: ['orchestrator_id', 'model', 'provider'],
  }),
  iterations: new Counter<string>({
    name: 'wundr_session_iterations_total',
    help: 'Total conversation loop iterations',
    labelNames: ['orchestrator_id'],
  }),
};

// ---- Memory System Metrics ----

export interface MemorySystemMetrics {
  entries: Gauge<string>;
  searches: Counter<string>;
  searchLatency: Histogram<string>;
  cacheHits: Counter<string>;
  cacheMisses: Counter<string>;
  compactions: Counter<string>;
  bytes: Gauge<string>;
}

export const memoryMetrics: MemorySystemMetrics = {
  entries: new Gauge<string>({
    name: 'wundr_memory_entries_total',
    help: 'Number of entries in each memory tier',
    labelNames: ['tier', 'orchestrator_id'],
  }),
  searches: new Counter<string>({
    name: 'wundr_memory_searches_total',
    help: 'Total memory search operations',
    labelNames: ['tier', 'orchestrator_id'],
  }),
  searchLatency: new Histogram<string>({
    name: 'wundr_memory_search_latency_seconds',
    help: 'Memory search latency in seconds',
    labelNames: ['tier'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  }),
  cacheHits: new Counter<string>({
    name: 'wundr_memory_cache_hits_total',
    help: 'Total memory cache hits',
    labelNames: ['tier'],
  }),
  cacheMisses: new Counter<string>({
    name: 'wundr_memory_cache_misses_total',
    help: 'Total memory cache misses',
    labelNames: ['tier'],
  }),
  compactions: new Counter<string>({
    name: 'wundr_memory_compaction_total',
    help: 'Total memory compaction operations',
    labelNames: ['tier', 'strategy'],
  }),
  bytes: new Gauge<string>({
    name: 'wundr_memory_bytes',
    help: 'Memory usage in bytes per tier',
    labelNames: ['tier'],
  }),
};

// ---- Tool Execution Metrics (enhanced) ----

export interface EnhancedToolMetrics {
  executionDuration: Histogram<string>;
  executionTotal: Counter<string>;
  errors: Counter<string>;
  queueDepth: Gauge<string>;
}

export const toolMetrics: EnhancedToolMetrics = {
  executionDuration: new Histogram<string>({
    name: 'wundr_tool_execution_duration_seconds',
    help: 'Tool execution duration in seconds',
    labelNames: ['tool_name', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30, 60],
  }),
  executionTotal: new Counter<string>({
    name: 'wundr_tool_execution_total',
    help: 'Total tool executions',
    labelNames: ['tool_name', 'status'],
  }),
  errors: new Counter<string>({
    name: 'wundr_tool_errors_total',
    help: 'Total tool execution errors',
    labelNames: ['tool_name', 'error_type'],
  }),
  queueDepth: new Gauge<string>({
    name: 'wundr_tool_queue_depth',
    help: 'Number of tool executions waiting in queue',
    labelNames: [],
  }),
};

// ---- WebSocket Metrics ----

export interface WebSocketMetrics {
  connectionsActive: Gauge<string>;
  connectionsTotal: Counter<string>;
  messagesReceived: Counter<string>;
  messagesSent: Counter<string>;
  messageSize: Histogram<string>;
  errors: Counter<string>;
  sessionSubscriptions: Gauge<string>;
}

export const wsMetrics: WebSocketMetrics = {
  connectionsActive: new Gauge<string>({
    name: 'wundr_ws_connections_active',
    help: 'Number of active WebSocket connections',
    labelNames: [],
  }),
  connectionsTotal: new Counter<string>({
    name: 'wundr_ws_connections_total',
    help: 'Total WebSocket connections established',
    labelNames: ['auth_method'],
  }),
  messagesReceived: new Counter<string>({
    name: 'wundr_ws_messages_received_total',
    help: 'Total WebSocket messages received',
    labelNames: ['message_type'],
  }),
  messagesSent: new Counter<string>({
    name: 'wundr_ws_messages_sent_total',
    help: 'Total WebSocket messages sent',
    labelNames: ['message_type'],
  }),
  messageSize: new Histogram<string>({
    name: 'wundr_ws_message_size_bytes',
    help: 'WebSocket message size in bytes',
    labelNames: ['direction'],
    buckets: [64, 256, 1024, 4096, 16384, 65536, 262144, 1048576],
  }),
  errors: new Counter<string>({
    name: 'wundr_ws_errors_total',
    help: 'Total WebSocket errors',
    labelNames: ['error_type'],
  }),
  sessionSubscriptions: new Gauge<string>({
    name: 'wundr_ws_session_subscriptions',
    help: 'Number of active session subscriptions across WebSocket clients',
    labelNames: [],
  }),
};

// ---- Model Routing Metrics ----

export interface ModelRoutingMetrics {
  requests: Counter<string>;
  requestDuration: Histogram<string>;
  requestTokens: Counter<string>;
  cost: Counter<string>;
  errors: Counter<string>;
  rateLimited: Counter<string>;
}

export const modelMetrics: ModelRoutingMetrics = {
  requests: new Counter<string>({
    name: 'wundr_model_requests_total',
    help: 'Total LLM requests by provider and model',
    labelNames: ['provider', 'model'],
  }),
  requestDuration: new Histogram<string>({
    name: 'wundr_model_request_duration_seconds',
    help: 'LLM request duration in seconds',
    labelNames: ['provider', 'model'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120],
  }),
  requestTokens: new Counter<string>({
    name: 'wundr_model_request_tokens_total',
    help: 'Total tokens in LLM requests',
    labelNames: ['provider', 'model', 'token_type'],
  }),
  cost: new Counter<string>({
    name: 'wundr_model_cost_dollars_total',
    help: 'Total LLM cost in USD',
    labelNames: ['provider', 'model'],
  }),
  errors: new Counter<string>({
    name: 'wundr_model_errors_total',
    help: 'Total LLM request errors',
    labelNames: ['provider', 'model', 'error_type'],
  }),
  rateLimited: new Counter<string>({
    name: 'wundr_model_rate_limited_total',
    help: 'Total rate-limited LLM requests',
    labelNames: ['provider', 'model'],
  }),
};

// ---- Queue and Processing Metrics ----

export interface QueueMetrics {
  depth: Gauge<string>;
  processingDuration: Histogram<string>;
  enqueued: Counter<string>;
  dequeued: Counter<string>;
  dropped: Counter<string>;
}

export const queueMetrics: QueueMetrics = {
  depth: new Gauge<string>({
    name: 'wundr_queue_depth',
    help: 'Current queue depth',
    labelNames: ['queue_name'],
  }),
  processingDuration: new Histogram<string>({
    name: 'wundr_queue_processing_duration_seconds',
    help: 'Queue item processing duration in seconds',
    labelNames: ['queue_name'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
  }),
  enqueued: new Counter<string>({
    name: 'wundr_queue_enqueued_total',
    help: 'Total items enqueued',
    labelNames: ['queue_name'],
  }),
  dequeued: new Counter<string>({
    name: 'wundr_queue_dequeued_total',
    help: 'Total items dequeued',
    labelNames: ['queue_name'],
  }),
  dropped: new Counter<string>({
    name: 'wundr_queue_dropped_total',
    help: 'Total items dropped from queue',
    labelNames: ['queue_name', 'reason'],
  }),
};

// ---- System Resource Metrics ----

export interface SystemResourceMetrics {
  memoryHeap: Gauge<string>;
  memoryRss: Gauge<string>;
  memoryExternal: Gauge<string>;
  cpuUser: Gauge<string>;
  cpuSystem: Gauge<string>;
  eventLoopLag: Histogram<string>;
  uptime: Gauge<string>;
}

export const systemMetrics: SystemResourceMetrics = {
  memoryHeap: new Gauge<string>({
    name: 'wundr_process_memory_heap_bytes',
    help: 'Process heap memory usage in bytes',
    labelNames: [],
  }),
  memoryRss: new Gauge<string>({
    name: 'wundr_process_memory_rss_bytes',
    help: 'Process RSS memory in bytes',
    labelNames: [],
  }),
  memoryExternal: new Gauge<string>({
    name: 'wundr_process_memory_external_bytes',
    help: 'Process external memory in bytes (C++ objects bound to JS)',
    labelNames: [],
  }),
  cpuUser: new Gauge<string>({
    name: 'wundr_process_cpu_user_seconds_total',
    help: 'Process user CPU time in seconds',
    labelNames: [],
  }),
  cpuSystem: new Gauge<string>({
    name: 'wundr_process_cpu_system_seconds_total',
    help: 'Process system CPU time in seconds',
    labelNames: [],
  }),
  eventLoopLag: new Histogram<string>({
    name: 'wundr_process_event_loop_lag_seconds',
    help: 'Node.js event loop lag in seconds',
    labelNames: [],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  }),
  uptime: new Gauge<string>({
    name: 'wundr_process_uptime_seconds',
    help: 'Process uptime in seconds',
    labelNames: [],
  }),
};

// ===========================================================================
// System Metrics Collector
// ===========================================================================

/**
 * Periodically collects system resource metrics (memory, CPU, event loop lag).
 * Call `startSystemMetricsCollection()` once at daemon startup.
 */
let systemMetricsTimer: NodeJS.Timeout | null = null;
let eventLoopLagTimer: NodeJS.Timeout | null = null;

export function startSystemMetricsCollection(intervalMs: number = 15000): void {
  if (systemMetricsTimer) return;

  const collectSystemMetrics = () => {
    const mem = process.memoryUsage();
    systemMetrics.memoryHeap.set(mem.heapUsed);
    systemMetrics.memoryRss.set(mem.rss);
    systemMetrics.memoryExternal.set(mem.external);

    const cpu = process.cpuUsage();
    systemMetrics.cpuUser.set(cpu.user / 1_000_000);
    systemMetrics.cpuSystem.set(cpu.system / 1_000_000);

    systemMetrics.uptime.set(process.uptime());
  };

  // Collect immediately, then on interval
  collectSystemMetrics();
  systemMetricsTimer = setInterval(collectSystemMetrics, intervalMs);
  if (systemMetricsTimer.unref) {
    systemMetricsTimer.unref();
  }

  // Event loop lag measurement
  const measureEventLoopLag = () => {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lagNs = Number(process.hrtime.bigint() - start);
      const lagSeconds = lagNs / 1_000_000_000;
      systemMetrics.eventLoopLag.observe(lagSeconds);
    });
  };

  eventLoopLagTimer = setInterval(measureEventLoopLag, 5000);
  if (eventLoopLagTimer.unref) {
    eventLoopLagTimer.unref();
  }
}

export function stopSystemMetricsCollection(): void {
  if (systemMetricsTimer) {
    clearInterval(systemMetricsTimer);
    systemMetricsTimer = null;
  }
  if (eventLoopLagTimer) {
    clearInterval(eventLoopLagTimer);
    eventLoopLagTimer = null;
  }
}

// ===========================================================================
// Metrics Registry (unchanged API, enhanced internals)
// ===========================================================================

/**
 * Metrics Registry
 * Manages registration, collection, and lifecycle of metrics
 */
export class MetricsRegistry implements IMetricsRegistry {
  private registry: Registry;
  private registered: boolean = false;

  constructor(registry?: Registry) {
    this.registry = registry || defaultRegister;
  }

  /**
   * Register all daemon metrics with the registry
   */
  register(): void {
    if (this.registered) {
      return;
    }

    // Metrics are automatically registered with the default registry
    // when created, so we just need to mark as registered
    this.registered = true;
  }

  /**
   * Collect metrics in Prometheus format
   * @returns Prometheus-formatted metrics string
   */
  async collect(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Reset all metrics to initial state
   */
  reset(): void {
    this.registry.resetMetrics();
  }

  /**
   * Get a specific metric by name
   * @param name - Metric name from DaemonMetrics
   * @returns The requested metric or undefined if not found
   */
  getMetric(
    name: keyof DaemonMetrics
  ): Counter<string> | Gauge<string> | Histogram<string> | undefined {
    return daemonMetrics[name];
  }

  /**
   * Get the underlying Prometheus registry
   * @returns The Prometheus registry instance
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Clear all metrics from the registry
   * Useful for testing or resetting state
   */
  clear(): void {
    this.registry.clear();
    this.registered = false;
  }
}

// ===========================================================================
// Helper Functions (legacy -- unchanged)
// ===========================================================================

export const recordSessionActive = (labels: SessionLabels, value: number): void => {
  daemonMetrics.sessionsActive.set(labels, value);
};

export const recordTokensUsed = (labels: TokenLabels, value: number): void => {
  daemonMetrics.tokensUsed.inc(labels, value);
};

export const recordMessageLatency = (labels: LatencyLabels, value: number): void => {
  daemonMetrics.messageLatency.observe(labels, value);
};

export const recordToolInvocation = (labels: ToolLabels): void => {
  daemonMetrics.toolInvocations.inc(labels, 1);
};

export const recordFederationDelegation = (labels: FederationLabels): void => {
  daemonMetrics.federationDelegations.inc(labels, 1);
};

export const recordNodeLoad = (labels: NodeLabels, value: number): void => {
  daemonMetrics.nodeLoad.set(labels, value);
};

export const recordError = (labels: ErrorLabels): void => {
  daemonMetrics.errorCount.inc(labels, 1);
};

export const recordBudgetUtilization = (labels: BudgetLabels, value: number): void => {
  daemonMetrics.budgetUtilization.set(labels, value);
};

// ===========================================================================
// Enhanced Helper Functions (new)
// ===========================================================================

/**
 * Record an agent spawn event.
 */
export function recordAgentSpawned(
  orchestratorId: string,
  sessionType: string,
): void {
  agentMetrics.spawned.inc({ orchestrator_id: orchestratorId, session_type: sessionType });
  agentMetrics.running.inc({ orchestrator_id: orchestratorId, session_type: sessionType });
}

/**
 * Record an agent completion event.
 */
export function recordAgentCompleted(
  orchestratorId: string,
  sessionType: string,
  exitReason: string = 'success',
  durationSeconds?: number,
): void {
  agentMetrics.completed.inc({
    orchestrator_id: orchestratorId,
    session_type: sessionType,
    exit_reason: exitReason,
  });
  agentMetrics.running.dec({ orchestrator_id: orchestratorId, session_type: sessionType });
  if (durationSeconds !== undefined) {
    agentMetrics.duration.observe(
      { orchestrator_id: orchestratorId, session_type: sessionType },
      durationSeconds,
    );
  }
}

/**
 * Record an agent failure event.
 */
export function recordAgentFailed(
  orchestratorId: string,
  sessionType: string,
  errorType: string = 'unknown',
  durationSeconds?: number,
): void {
  agentMetrics.failed.inc({
    orchestrator_id: orchestratorId,
    session_type: sessionType,
    error_type: errorType,
  });
  agentMetrics.running.dec({ orchestrator_id: orchestratorId, session_type: sessionType });
  if (durationSeconds !== undefined) {
    agentMetrics.duration.observe(
      { orchestrator_id: orchestratorId, session_type: sessionType },
      durationSeconds,
    );
  }
}

/**
 * Record an LLM model request with timing and token counts.
 */
export function recordModelRequest(params: {
  provider: string;
  model: string;
  durationSeconds: number;
  promptTokens?: number;
  completionTokens?: number;
  costDollars?: number;
  error?: string;
}): void {
  const { provider, model, durationSeconds } = params;
  const labels = { provider, model };

  modelMetrics.requests.inc(labels);
  modelMetrics.requestDuration.observe(labels, durationSeconds);

  if (params.promptTokens) {
    modelMetrics.requestTokens.inc(
      { provider, model, token_type: 'prompt' },
      params.promptTokens,
    );
  }
  if (params.completionTokens) {
    modelMetrics.requestTokens.inc(
      { provider, model, token_type: 'completion' },
      params.completionTokens,
    );
  }
  if (params.costDollars) {
    modelMetrics.cost.inc(labels, params.costDollars);
  }
  if (params.error) {
    modelMetrics.errors.inc({ provider, model, error_type: params.error });
  }
}

/**
 * Record a WebSocket connection event.
 */
export function recordWsConnection(authMethod: string = 'none'): void {
  wsMetrics.connectionsActive.inc();
  wsMetrics.connectionsTotal.inc({ auth_method: authMethod });
}

/**
 * Record a WebSocket disconnection.
 */
export function recordWsDisconnection(): void {
  wsMetrics.connectionsActive.dec();
}

/**
 * Record an inbound WebSocket message.
 */
export function recordWsMessageReceived(messageType: string, sizeBytes?: number): void {
  wsMetrics.messagesReceived.inc({ message_type: messageType });
  if (sizeBytes !== undefined) {
    wsMetrics.messageSize.observe({ direction: 'inbound' }, sizeBytes);
  }
}

/**
 * Record an outbound WebSocket message.
 */
export function recordWsMessageSent(messageType: string, sizeBytes?: number): void {
  wsMetrics.messagesSent.inc({ message_type: messageType });
  if (sizeBytes !== undefined) {
    wsMetrics.messageSize.observe({ direction: 'outbound' }, sizeBytes);
  }
}

/**
 * Record a tool execution with duration.
 */
export function recordToolExecution(
  toolName: string,
  status: 'success' | 'error' | 'timeout',
  durationSeconds: number,
): void {
  toolMetrics.executionTotal.inc({ tool_name: toolName, status });
  toolMetrics.executionDuration.observe({ tool_name: toolName, status }, durationSeconds);
}

/**
 * Record a memory system operation.
 */
export function recordMemoryOperation(params: {
  operation: 'search' | 'store' | 'compact';
  tier: string;
  orchestratorId?: string;
  durationSeconds?: number;
  cacheHit?: boolean;
}): void {
  if (params.operation === 'search') {
    memoryMetrics.searches.inc({
      tier: params.tier,
      orchestrator_id: params.orchestratorId ?? '',
    });
    if (params.durationSeconds !== undefined) {
      memoryMetrics.searchLatency.observe({ tier: params.tier }, params.durationSeconds);
    }
    if (params.cacheHit === true) {
      memoryMetrics.cacheHits.inc({ tier: params.tier });
    } else if (params.cacheHit === false) {
      memoryMetrics.cacheMisses.inc({ tier: params.tier });
    }
  } else if (params.operation === 'compact') {
    memoryMetrics.compactions.inc({ tier: params.tier, strategy: 'summarize-and-archive' });
  }
}

/**
 * Default metrics registry instance
 */
export const metricsRegistry = new MetricsRegistry();
