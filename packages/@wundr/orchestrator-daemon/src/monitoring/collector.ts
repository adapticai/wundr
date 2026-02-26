/**
 * Metrics Collector for Orchestrator Daemon
 *
 * Provides high-level API for recording metrics with batching,
 * timing utilities, and aggregation capabilities.
 */

import { daemonMetrics } from './metrics';
import { Logger } from '../utils/logger';

import type { MetricsRegistry } from './metrics';
import type { DaemonMetrics } from './types';

/**
 * Configuration for metrics collector
 */
export interface CollectorConfig {
  /** Enable batching of metric updates */
  enableBatching?: boolean;
  /** Batch flush interval in milliseconds */
  batchFlushInterval?: number;
  /** Maximum batch size before auto-flush */
  maxBatchSize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Batched metric update
 */
interface BatchedUpdate {
  type: 'counter' | 'gauge' | 'histogram';
  metricName: keyof DaemonMetrics;
  value?: number;
  labels?: Record<string, string>;
  operation?: 'inc' | 'dec' | 'set' | 'observe';
}

/**
 * Aggregated statistics result
 */
export interface AggregatedStats {
  orchestratorId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalSessions: number;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  toolInvocations: number;
  delegations: number;
}

/**
 * Timer function returned by startTimer
 */
export type TimerFunction = (labels?: Record<string, string>) => number;

/**
 * MetricsCollector provides a high-level API for recording metrics
 * with support for batching, timing, and aggregation.
 */
export class MetricsCollector {
  private metrics: DaemonMetrics;
  private metricsRegistry: MetricsRegistry;
  private config: Required<CollectorConfig>;
  private logger: Logger;
  private batchQueue: BatchedUpdate[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private activeTimers: Map<
    string,
    { start: number; labels?: Record<string, string> }
  > = new Map();

  constructor(metricsRegistry: MetricsRegistry, config: CollectorConfig = {}) {
    this.metrics = daemonMetrics;
    this.metricsRegistry = metricsRegistry;
    this.config = {
      enableBatching: config.enableBatching ?? true,
      batchFlushInterval: config.batchFlushInterval ?? 5000,
      maxBatchSize: config.maxBatchSize ?? 100,
      debug: config.debug ?? false,
    };
    this.logger = new Logger('MetricsCollector');

    if (this.config.enableBatching) {
      this.startBatchTimer();
    }
  }

  /**
   * Record session start - increments active sessions gauge
   */
  recordSessionStart(
    orchestratorId: string,
    sessionType: 'claude-code' | 'claude-flow'
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'gauge',
        metricName: 'sessionsActive',
        operation: 'inc',
        labels: { orchestrator_id: orchestratorId, session_type: sessionType },
      });
    } else {
      this.metrics.sessionsActive.inc({
        orchestrator_id: orchestratorId,
        session_type: sessionType,
      });
    }

    if (this.config.debug) {
      this.logger.debug(`Session started: ${orchestratorId} (${sessionType})`);
    }
  }

  /**
   * Record session end - decrements active sessions gauge
   */
  recordSessionEnd(
    orchestratorId: string,
    sessionType: 'claude-code' | 'claude-flow'
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'gauge',
        metricName: 'sessionsActive',
        operation: 'dec',
        labels: { orchestrator_id: orchestratorId, session_type: sessionType },
      });
    } else {
      this.metrics.sessionsActive.dec({
        orchestrator_id: orchestratorId,
        session_type: sessionType,
      });
    }

    if (this.config.debug) {
      this.logger.debug(`Session ended: ${orchestratorId} (${sessionType})`);
    }
  }

  /**
   * Record token usage
   */
  recordTokenUsage(
    orchestratorId: string,
    model: string,
    tokens: number
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'counter',
        metricName: 'tokensUsed',
        value: tokens,
        labels: { orchestrator_id: orchestratorId, model },
      });
    } else {
      this.metrics.tokensUsed.inc(
        { orchestrator_id: orchestratorId, model },
        tokens
      );
    }

    if (this.config.debug) {
      this.logger.debug(
        `Token usage: ${orchestratorId} model=${model} tokens=${tokens}`
      );
    }
  }

  /**
   * Record message latency in seconds
   */
  recordMessageLatency(orchestratorId: string, latencyMs: number): void {
    const latencySeconds = latencyMs / 1000;

    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'histogram',
        metricName: 'messageLatency',
        operation: 'observe',
        value: latencySeconds,
        labels: { orchestrator_id: orchestratorId },
      });
    } else {
      this.metrics.messageLatency.observe(
        { orchestrator_id: orchestratorId },
        latencySeconds
      );
    }

    if (this.config.debug) {
      this.logger.debug(
        `Message latency: ${orchestratorId} latency=${latencyMs}ms`
      );
    }
  }

  /**
   * Record tool invocation
   */
  recordToolInvocation(
    orchestratorId: string,
    toolName: string,
    status: 'success' | 'error' | 'timeout'
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'counter',
        metricName: 'toolInvocations',
        operation: 'inc',
        labels: {
          orchestrator_id: orchestratorId,
          tool_name: toolName,
          status,
        },
      });
    } else {
      this.metrics.toolInvocations.inc({
        orchestrator_id: orchestratorId,
        tool_name: toolName,
        status,
      });
    }

    if (this.config.debug) {
      this.logger.debug(
        `Tool invocation: ${orchestratorId} tool=${toolName} status=${status}`
      );
    }
  }

  /**
   * Record delegation between orchestrators
   */
  recordDelegation(
    fromOrchestrator: string,
    toOrchestrator: string,
    status: 'success' | 'error' | 'rejected'
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'counter',
        metricName: 'federationDelegations',
        operation: 'inc',
        labels: {
          from_orchestrator: fromOrchestrator,
          to_orchestrator: toOrchestrator,
          status,
        },
      });
    } else {
      this.metrics.federationDelegations.inc({
        from_orchestrator: fromOrchestrator,
        to_orchestrator: toOrchestrator,
        status,
      });
    }

    if (this.config.debug) {
      this.logger.debug(
        `Delegation: ${fromOrchestrator} -> ${toOrchestrator} status=${status}`
      );
    }
  }

  /**
   * Record error
   */
  recordError(orchestratorId: string, errorType: string): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'counter',
        metricName: 'errorCount',
        operation: 'inc',
        labels: { orchestrator_id: orchestratorId, error_type: errorType },
      });
    } else {
      this.metrics.errorCount.inc({
        orchestrator_id: orchestratorId,
        error_type: errorType,
      });
    }

    if (this.config.debug) {
      this.logger.debug(`Error recorded: ${orchestratorId} type=${errorType}`);
    }
  }

  /**
   * Update node load (0-1 scale)
   */
  updateNodeLoad(nodeId: string, load: number): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'gauge',
        metricName: 'nodeLoad',
        operation: 'set',
        value: load,
        labels: { node_id: nodeId },
      });
    } else {
      this.metrics.nodeLoad.set({ node_id: nodeId }, load);
    }

    if (this.config.debug) {
      this.logger.debug(`Node load updated: ${nodeId} load=${load}`);
    }
  }

  /**
   * Update budget utilization percentage
   */
  updateBudgetUtilization(
    orchestratorId: string,
    period: 'daily' | 'weekly' | 'monthly',
    percent: number
  ): void {
    if (this.config.enableBatching) {
      this.queueBatchedUpdate({
        type: 'gauge',
        metricName: 'budgetUtilization',
        operation: 'set',
        value: percent,
        labels: { orchestrator_id: orchestratorId, period },
      });
    } else {
      this.metrics.budgetUtilization.set(
        { orchestrator_id: orchestratorId, period },
        percent
      );
    }

    if (this.config.debug) {
      this.logger.debug(
        `Budget utilization: ${orchestratorId} period=${period} percent=${percent}%`
      );
    }
  }

  /**
   * Start a timer and return a function to record the duration
   *
   * @example
   * const endTimer = collector.startTimer();
   * // ... do work ...
   * const durationMs = endTimer({ orchestrator_id: 'orch-1' });
   */
  startTimer(): TimerFunction {
    const startTime = Date.now();
    const timerId = `timer_${startTime}_${Math.random()}`;

    this.activeTimers.set(timerId, { start: startTime });

    return (labels?: Record<string, string>): number => {
      const timer = this.activeTimers.get(timerId);
      if (!timer) {
        this.logger.warn(`Timer ${timerId} not found`);
        return 0;
      }

      const durationMs = Date.now() - timer.start;
      this.activeTimers.delete(timerId);

      if (this.config.debug) {
        this.logger.debug(
          `Timer completed: duration=${durationMs}ms labels=${JSON.stringify(labels)}`
        );
      }

      return durationMs;
    };
  }

  /**
   * Wrap a function with automatic timing and metric recording
   *
   * @example
   * const result = await collector.withMetrics(
   *   async () => processTask(),
   *   { orchestrator_id: 'orch-1' }
   * );
   */
  async withMetrics<T>(
    fn: () => Promise<T>,
    labels: { orchestrator_id: string }
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      // Record latency
      this.recordMessageLatency(labels.orchestrator_id, durationMs);

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Record error
      this.recordError(labels.orchestrator_id, 'function_execution_error');

      if (this.config.debug) {
        this.logger.error(`Function failed after ${durationMs}ms:`, error);
      }

      throw error;
    }
  }

  /**
   * Get aggregated statistics for an orchestrator over a time range
   * Note: This is a simplified version as Prometheus metrics don't store time series data
   */
  async getAggregatedStats(
    orchestratorId: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<AggregatedStats> {
    const end = timeRange?.end || new Date();
    const start = timeRange?.start || new Date(end.getTime() - 3600000); // Default: last hour

    // Get current metrics from registry
    const metricsJSON = await this.metricsRegistry
      .getRegistry()
      .getMetricsAsJSON();

    let totalSessions = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let totalErrors = 0;
    let successfulToolCalls = 0;
    let failedToolCalls = 0;
    let toolInvocations = 0;
    let delegations = 0;

    for (const metric of metricsJSON as any[]) {
      // Session metrics (active sessions)
      if (metric.name === 'orchestrator_sessions_active') {
        for (const value of metric.values || []) {
          if (value.labels?.orchestrator_id === orchestratorId) {
            totalSessions += value.value || 0;
          }
        }
      }

      // Token metrics
      if (metric.name === 'orchestrator_tokens_used_total') {
        for (const value of metric.values || []) {
          if (value.labels?.orchestrator_id === orchestratorId) {
            totalTokens += value.value || 0;
          }
        }
      }

      // Latency metrics
      if (metric.name === 'orchestrator_message_latency_seconds') {
        for (const value of metric.values || []) {
          if (value.labels?.orchestrator_id === orchestratorId) {
            const sum = (value as any).sum || 0;
            const count = (value as any).count || 0;
            totalLatency += sum;
            latencyCount += count;
          }
        }
      }

      // Error metrics
      if (metric.name === 'orchestrator_errors_total') {
        for (const value of metric.values || []) {
          if (value.labels?.orchestrator_id === orchestratorId) {
            totalErrors += value.value || 0;
          }
        }
      }

      // Tool invocation metrics
      if (metric.name === 'orchestrator_tool_invocations_total') {
        for (const value of metric.values || []) {
          if (value.labels?.orchestrator_id === orchestratorId) {
            toolInvocations += value.value || 0;
            if (value.labels?.status === 'success') {
              successfulToolCalls += value.value || 0;
            } else if (
              value.labels?.status === 'error' ||
              value.labels?.status === 'timeout'
            ) {
              failedToolCalls += value.value || 0;
            }
          }
        }
      }

      // Delegation metrics
      if (metric.name === 'orchestrator_federation_delegations_total') {
        for (const value of metric.values || []) {
          if (
            value.labels?.from_orchestrator === orchestratorId ||
            value.labels?.to_orchestrator === orchestratorId
          ) {
            delegations += value.value || 0;
          }
        }
      }
    }

    const avgLatency =
      latencyCount > 0 ? (totalLatency / latencyCount) * 1000 : 0; // Convert to ms
    const errorRate = toolInvocations > 0 ? totalErrors / toolInvocations : 0;

    return {
      orchestratorId,
      timeRange: { start, end },
      totalSessions,
      totalTokens,
      avgLatency,
      errorRate,
      successfulToolCalls,
      failedToolCalls,
      toolInvocations,
      delegations,
    };
  }

  /**
   * Flush any pending batched updates
   */
  flush(): void {
    if (this.batchQueue.length === 0) {
      return;
    }

    const updates = [...this.batchQueue];
    this.batchQueue = [];

    if (this.config.debug) {
      this.logger.debug(`Flushing ${updates.length} batched metric updates`);
    }

    for (const update of updates) {
      this.applyBatchedUpdate(update);
    }
  }

  /**
   * Close the collector and cleanup resources
   */
  close(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flush();
    this.activeTimers.clear();
  }

  /**
   * Queue a batched metric update
   */
  private queueBatchedUpdate(update: BatchedUpdate): void {
    this.batchQueue.push(update);

    if (this.batchQueue.length >= this.config.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Apply a batched metric update
   */
  private applyBatchedUpdate(update: BatchedUpdate): void {
    const metric = this.metrics[update.metricName];
    if (!metric) {
      this.logger.warn(`Unknown metric: ${update.metricName}`);
      return;
    }

    const labels = update.labels as Record<string, string>;

    try {
      switch (update.operation) {
        case 'inc':
          if ('inc' in metric) {
            (metric as any).inc(labels, update.value);
          }
          break;
        case 'dec':
          if ('dec' in metric) {
            (metric as any).dec(labels, update.value);
          }
          break;
        case 'set':
          if ('set' in metric) {
            (metric as any).set(labels, update.value);
          }
          break;
        case 'observe':
          if ('observe' in metric) {
            (metric as any).observe(labels, update.value);
          }
          break;
        default:
          // Default counter increment
          if ('inc' in metric) {
            (metric as any).inc(labels, update.value);
          }
      }
    } catch (error) {
      this.logger.error(
        `Failed to apply metric update: ${update.metricName}`,
        error
      );
    }
  }

  /**
   * Start the batch flush timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.batchFlushInterval);

    // Don't prevent Node.js from exiting
    if (this.batchTimer.unref) {
      this.batchTimer.unref();
    }
  }
}

/**
 * Create a new metrics collector
 */
export function createMetricsCollector(
  metricsRegistry: MetricsRegistry,
  config?: CollectorConfig
): MetricsCollector {
  return new MetricsCollector(metricsRegistry, config);
}
