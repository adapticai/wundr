/**
 * Monitoring Types
 * Type definitions for Prometheus metrics and monitoring configuration
 */

import type { Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Label interfaces for each metric type
 */

export interface SessionLabels {
  orchestrator_id: string;
  session_type: string;
  [key: string]: string | number;
}

export interface TokenLabels {
  orchestrator_id: string;
  model: string;
  [key: string]: string | number;
}

export interface LatencyLabels {
  orchestrator_id: string;
  [key: string]: string | number;
}

export interface ToolLabels {
  orchestrator_id: string;
  tool_name: string;
  status: 'success' | 'error' | 'timeout';
  [key: string]: string | number;
}

export interface FederationLabels {
  from_orchestrator: string;
  to_orchestrator: string;
  status: 'success' | 'error' | 'rejected';
  [key: string]: string | number;
}

export interface NodeLabels {
  node_id: string;
  [key: string]: string | number;
}

export interface ErrorLabels {
  orchestrator_id: string;
  error_type: string;
  [key: string]: string | number;
}

export interface BudgetLabels {
  orchestrator_id: string;
  period: 'daily' | 'weekly' | 'monthly';
  [key: string]: string | number;
}

/**
 * Metric configuration
 */

export interface MetricConfig {
  name: string;
  help: string;
  labelNames: string[];
  buckets?: number[];
}

/**
 * Daemon metrics collection
 */

export interface DaemonMetrics {
  sessionsActive: Gauge<string>;
  tokensUsed: Counter<string>;
  messageLatency: Histogram<string>;
  toolInvocations: Counter<string>;
  federationDelegations: Counter<string>;
  nodeLoad: Gauge<string>;
  errorCount: Counter<string>;
  budgetUtilization: Gauge<string>;
}

/**
 * Collected metrics for export
 */

export interface CollectedMetrics {
  timestamp: number;
  metrics: {
    sessionsActive: Array<{
      labels: SessionLabels;
      value: number;
    }>;
    tokensUsed: Array<{
      labels: TokenLabels;
      value: number;
    }>;
    messageLatency: Array<{
      labels: LatencyLabels;
      buckets: Record<string, number>;
      count: number;
      sum: number;
    }>;
    toolInvocations: Array<{
      labels: ToolLabels;
      value: number;
    }>;
    federationDelegations: Array<{
      labels: FederationLabels;
      value: number;
    }>;
    nodeLoad: Array<{
      labels: NodeLabels;
      value: number;
    }>;
    errorCount: Array<{
      labels: ErrorLabels;
      value: number;
    }>;
    budgetUtilization: Array<{
      labels: BudgetLabels;
      value: number;
    }>;
  };
}

/**
 * Metrics registry interface
 */

export interface IMetricsRegistry {
  register(): void;
  collect(): Promise<string>;
  reset(): void;
  getMetric(name: keyof DaemonMetrics): Counter<string> | Gauge<string> | Histogram<string> | undefined;
  getRegistry(): Registry;
}
