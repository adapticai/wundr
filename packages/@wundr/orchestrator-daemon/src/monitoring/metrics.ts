/**
 * Prometheus Metrics for Orchestrator Daemon
 * Implements comprehensive monitoring for orchestration operations
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

/**
 * Daemon metrics collection
 */
export const daemonMetrics: DaemonMetrics = {
  /**
   * Active sessions gauge
   * Tracks the number of currently active orchestrator sessions
   */
  sessionsActive: new Gauge<string>({
    name: 'orchestrator_sessions_active',
    help: 'Number of currently active orchestrator sessions',
    labelNames: ['orchestrator_id', 'session_type'],
  }),

  /**
   * Tokens used counter
   * Tracks total tokens consumed by model and orchestrator
   */
  tokensUsed: new Counter<string>({
    name: 'orchestrator_tokens_used_total',
    help: 'Total number of tokens used by the orchestrator',
    labelNames: ['orchestrator_id', 'model'],
  }),

  /**
   * Message latency histogram
   * Tracks message processing latency in seconds
   */
  messageLatency: new Histogram<string>({
    name: 'orchestrator_message_latency_seconds',
    help: 'Message processing latency in seconds',
    labelNames: ['orchestrator_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  /**
   * Tool invocations counter
   * Tracks tool usage by type and status
   */
  toolInvocations: new Counter<string>({
    name: 'orchestrator_tool_invocations_total',
    help: 'Total number of tool invocations',
    labelNames: ['orchestrator_id', 'tool_name', 'status'],
  }),

  /**
   * Federation delegations counter
   * Tracks delegation requests between orchestrators
   */
  federationDelegations: new Counter<string>({
    name: 'orchestrator_federation_delegations_total',
    help: 'Total number of federation delegation requests',
    labelNames: ['from_orchestrator', 'to_orchestrator', 'status'],
  }),

  /**
   * Node load gauge
   * Tracks current load per orchestrator node
   */
  nodeLoad: new Gauge<string>({
    name: 'orchestrator_node_load',
    help: 'Current load on orchestrator nodes',
    labelNames: ['node_id'],
  }),

  /**
   * Error count counter
   * Tracks errors by type and orchestrator
   */
  errorCount: new Counter<string>({
    name: 'orchestrator_errors_total',
    help: 'Total number of errors by type',
    labelNames: ['orchestrator_id', 'error_type'],
  }),

  /**
   * Budget utilization gauge
   * Tracks budget usage percentage by period
   */
  budgetUtilization: new Gauge<string>({
    name: 'orchestrator_budget_utilization_percent',
    help: 'Budget utilization percentage by period',
    labelNames: ['orchestrator_id', 'period'],
  }),
};

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

/**
 * Helper functions for recording metrics
 */

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

/**
 * Default metrics registry instance
 */
export const metricsRegistry = new MetricsRegistry();
