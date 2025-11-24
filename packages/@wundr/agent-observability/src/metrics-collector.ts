/**
 * @wundr.io/agent-observability - Metrics Collector
 *
 * Provides metrics collection and aggregation capabilities for
 * monitoring AI agent performance and behavior.
 *
 * Supports counters, gauges, histograms, and summaries with
 * dimensional labels for detailed analysis.
 */

import type {
  MetricType,
  MetricDefinition,
  MetricDataPoint,
  MetricAggregation,
} from './types';

/**
 * Configuration for the metrics collector
 */
export interface MetricsCollectorConfig {
  /** Maximum data points to retain per metric */
  maxDataPointsPerMetric: number;
  /** Default aggregation window in milliseconds */
  defaultAggregationWindowMs: number;
  /** Enable automatic cleanup of old data points */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds */
  cleanupIntervalMs: number;
  /** Data retention period in milliseconds */
  retentionPeriodMs: number;
}

/**
 * Internal counter state
 */
interface CounterState {
  value: number;
  labels: Record<string, string>;
  lastUpdated: Date;
}

/**
 * Internal gauge state
 */
interface GaugeState {
  value: number;
  labels: Record<string, string>;
  lastUpdated: Date;
}

/**
 * Internal histogram state
 */
interface HistogramState {
  sum: number;
  count: number;
  buckets: Map<number, number>;
  labels: Record<string, string>;
  lastUpdated: Date;
}

/**
 * Internal summary state
 */
interface SummaryState {
  values: number[];
  labels: Record<string, string>;
  lastUpdated: Date;
}

/**
 * Metrics Collector
 *
 * Collects and aggregates metrics for observability purposes.
 * Provides counters, gauges, histograms, and summaries with
 * support for dimensional labels.
 *
 * @example
 * ```typescript
 * const collector = new MetricsCollector();
 *
 * // Define metrics
 * collector.defineMetric({
 *   name: 'agent_requests_total',
 *   type: 'counter',
 *   description: 'Total agent requests',
 *   labels: ['agent_id', 'status']
 * });
 *
 * // Record values
 * collector.incrementCounter('agent_requests_total', { agent_id: 'agent-1', status: 'success' });
 *
 * // Get aggregations
 * const agg = collector.aggregate('agent_requests_total', 'sum', Date.now() - 3600000, Date.now());
 * ```
 */
export class MetricsCollector {
  private config: MetricsCollectorConfig;
  private definitions: Map<string, MetricDefinition> = new Map();
  private counters: Map<string, Map<string, CounterState>> = new Map();
  private gauges: Map<string, Map<string, GaugeState>> = new Map();
  private histograms: Map<string, Map<string, HistogramState>> = new Map();
  private summaries: Map<string, Map<string, SummaryState>> = new Map();
  private dataPoints: Map<string, MetricDataPoint[]> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new MetricsCollector instance
   *
   * @param config - Collector configuration
   */
  constructor(config: Partial<MetricsCollectorConfig> = {}) {
    this.config = {
      maxDataPointsPerMetric: config.maxDataPointsPerMetric ?? 10000,
      defaultAggregationWindowMs: config.defaultAggregationWindowMs ?? 60000,
      autoCleanup: config.autoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60000,
      retentionPeriodMs: config.retentionPeriodMs ?? 86400000, // 24 hours
    };

    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  /**
   * Define a new metric
   *
   * @param definition - Metric definition
   */
  defineMetric(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);

    // Initialize storage based on type
    switch (definition.type) {
      case 'counter':
        this.counters.set(definition.name, new Map());
        break;
      case 'gauge':
        this.gauges.set(definition.name, new Map());
        break;
      case 'histogram':
        this.histograms.set(definition.name, new Map());
        break;
      case 'summary':
        this.summaries.set(definition.name, new Map());
        break;
    }

    this.dataPoints.set(definition.name, []);
  }

  /**
   * Get a metric definition
   *
   * @param name - Metric name
   * @returns Metric definition or undefined
   */
  getDefinition(name: string): MetricDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if a metric is defined
   *
   * @param name - Metric name
   * @returns True if metric is defined
   */
  hasMetric(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * Increment a counter metric
   *
   * @param name - Counter name
   * @param labels - Label values
   * @param value - Increment value (default: 1)
   */
  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1,
  ): void {
    this.ensureMetricExists(name, 'counter');

    const counterMap = this.counters.get(name)!;
    const labelKey = this.labelsToKey(labels);

    const state = counterMap.get(labelKey) || {
      value: 0,
      labels,
      lastUpdated: new Date(),
    };

    state.value += value;
    state.lastUpdated = new Date();
    counterMap.set(labelKey, state);

    this.recordDataPoint(name, state.value, labels);
  }

  /**
   * Get current counter value
   *
   * @param name - Counter name
   * @param labels - Label values
   * @returns Current counter value or 0
   */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    const counterMap = this.counters.get(name);
    if (!counterMap) {
      return 0;
    }

    const labelKey = this.labelsToKey(labels);
    return counterMap.get(labelKey)?.value ?? 0;
  }

  /**
   * Set a gauge metric value
   *
   * @param name - Gauge name
   * @param value - Gauge value
   * @param labels - Label values
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.ensureMetricExists(name, 'gauge');

    const gaugeMap = this.gauges.get(name)!;
    const labelKey = this.labelsToKey(labels);

    gaugeMap.set(labelKey, {
      value,
      labels,
      lastUpdated: new Date(),
    });

    this.recordDataPoint(name, value, labels);
  }

  /**
   * Increment a gauge metric
   *
   * @param name - Gauge name
   * @param value - Increment value
   * @param labels - Label values
   */
  incrementGauge(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {},
  ): void {
    const currentValue = this.getGauge(name, labels);
    this.setGauge(name, currentValue + value, labels);
  }

  /**
   * Decrement a gauge metric
   *
   * @param name - Gauge name
   * @param value - Decrement value
   * @param labels - Label values
   */
  decrementGauge(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {},
  ): void {
    const currentValue = this.getGauge(name, labels);
    this.setGauge(name, currentValue - value, labels);
  }

  /**
   * Get current gauge value
   *
   * @param name - Gauge name
   * @param labels - Label values
   * @returns Current gauge value or 0
   */
  getGauge(name: string, labels: Record<string, string> = {}): number {
    const gaugeMap = this.gauges.get(name);
    if (!gaugeMap) {
      return 0;
    }

    const labelKey = this.labelsToKey(labels);
    return gaugeMap.get(labelKey)?.value ?? 0;
  }

  /**
   * Record a histogram observation
   *
   * @param name - Histogram name
   * @param value - Observed value
   * @param labels - Label values
   */
  observeHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.ensureMetricExists(name, 'histogram');

    const histogramMap = this.histograms.get(name)!;
    const labelKey = this.labelsToKey(labels);
    const definition = this.definitions.get(name)!;
    const buckets = definition.buckets || [
      0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ];

    let state = histogramMap.get(labelKey);
    if (!state) {
      state = {
        sum: 0,
        count: 0,
        buckets: new Map(buckets.map(b => [b, 0])),
        labels,
        lastUpdated: new Date(),
      };
      histogramMap.set(labelKey, state);
    }

    state.sum += value;
    state.count++;
    state.lastUpdated = new Date();

    // Update bucket counts
    for (const bucket of buckets) {
      if (value <= bucket) {
        state.buckets.set(bucket, (state.buckets.get(bucket) || 0) + 1);
      }
    }

    this.recordDataPoint(name, value, labels);
  }

  /**
   * Get histogram statistics
   *
   * @param name - Histogram name
   * @param labels - Label values
   * @returns Histogram statistics or null
   */
  getHistogram(
    name: string,
    labels: Record<string, string> = {},
  ): {
    sum: number;
    count: number;
    avg: number;
    buckets: Map<number, number>;
  } | null {
    const histogramMap = this.histograms.get(name);
    if (!histogramMap) {
      return null;
    }

    const labelKey = this.labelsToKey(labels);
    const state = histogramMap.get(labelKey);
    if (!state) {
      return null;
    }

    return {
      sum: state.sum,
      count: state.count,
      avg: state.count > 0 ? state.sum / state.count : 0,
      buckets: new Map(state.buckets),
    };
  }

  /**
   * Record a summary observation
   *
   * @param name - Summary name
   * @param value - Observed value
   * @param labels - Label values
   */
  observeSummary(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.ensureMetricExists(name, 'summary');

    const summaryMap = this.summaries.get(name)!;
    const labelKey = this.labelsToKey(labels);

    let state = summaryMap.get(labelKey);
    if (!state) {
      state = {
        values: [],
        labels,
        lastUpdated: new Date(),
      };
      summaryMap.set(labelKey, state);
    }

    state.values.push(value);
    state.lastUpdated = new Date();

    // Limit stored values
    if (state.values.length > 1000) {
      state.values = state.values.slice(-1000);
    }

    this.recordDataPoint(name, value, labels);
  }

  /**
   * Get summary quantiles
   *
   * @param name - Summary name
   * @param labels - Label values
   * @returns Summary statistics or null
   */
  getSummary(
    name: string,
    labels: Record<string, string> = {},
  ): { count: number; sum: number; quantiles: Record<string, number> } | null {
    const summaryMap = this.summaries.get(name);
    if (!summaryMap) {
      return null;
    }

    const labelKey = this.labelsToKey(labels);
    const state = summaryMap.get(labelKey);
    if (!state || state.values.length === 0) {
      return null;
    }

    const definition = this.definitions.get(name)!;
    const targetQuantiles = definition.quantiles || [0.5, 0.9, 0.95, 0.99];

    const sorted = [...state.values].sort((a, b) => a - b);
    const quantiles: Record<string, number> = {};

    for (const q of targetQuantiles) {
      const index = Math.ceil(q * sorted.length) - 1;
      quantiles[`p${q * 100}`] = sorted[Math.max(0, index)];
    }

    return {
      count: state.values.length,
      sum: state.values.reduce((a, b) => a + b, 0),
      quantiles,
    };
  }

  /**
   * Aggregate metric data over a time window
   *
   * @param name - Metric name
   * @param aggregationType - Type of aggregation
   * @param startTime - Start of aggregation window
   * @param endTime - End of aggregation window
   * @param labels - Optional label filter
   * @returns Aggregation result or null
   */
  aggregate(
    name: string,
    aggregationType: MetricAggregation['aggregationType'],
    startTime: Date,
    endTime: Date,
    labels: Record<string, string> = {},
  ): MetricAggregation | null {
    const points = this.dataPoints.get(name);
    if (!points || points.length === 0) {
      return null;
    }

    // Filter by time window and labels
    const filtered = points.filter(p => {
      const inTimeRange = p.timestamp >= startTime && p.timestamp <= endTime;
      const matchesLabels = Object.entries(labels).every(
        ([k, v]) => p.labels[k] === v,
      );
      return inTimeRange && matchesLabels;
    });

    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map(p => p.value);
    let aggregatedValue: number;

    switch (aggregationType) {
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'min':
        aggregatedValue = Math.min(...values);
        break;
      case 'max':
        aggregatedValue = Math.max(...values);
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      case 'p50':
      case 'p90':
      case 'p95':
      case 'p99': {
        const percentile = parseInt(aggregationType.slice(1)) / 100;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil(percentile * sorted.length) - 1;
        aggregatedValue = sorted[Math.max(0, index)];
        break;
      }
      default:
        aggregatedValue = 0;
    }

    return {
      name,
      aggregationType,
      value: aggregatedValue,
      windowStart: startTime,
      windowEnd: endTime,
      labels,
      dataPointCount: filtered.length,
    };
  }

  /**
   * Get all data points for a metric
   *
   * @param name - Metric name
   * @param startTime - Optional start time filter
   * @param endTime - Optional end time filter
   * @returns Array of data points
   */
  getDataPoints(
    name: string,
    startTime?: Date,
    endTime?: Date,
  ): MetricDataPoint[] {
    const points = this.dataPoints.get(name) || [];

    if (!startTime && !endTime) {
      return [...points];
    }

    return points.filter(p => {
      if (startTime && p.timestamp < startTime) {
        return false;
      }
      if (endTime && p.timestamp > endTime) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get all defined metric names
   *
   * @returns Array of metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get all label combinations for a metric
   *
   * @param name - Metric name
   * @returns Array of label combinations
   */
  getLabelCombinations(name: string): Record<string, string>[] {
    const definition = this.definitions.get(name);
    if (!definition) {
      return [];
    }

    let stateMap: Map<string, { labels: Record<string, string> }> | undefined;

    switch (definition.type) {
      case 'counter':
        stateMap = this.counters.get(name);
        break;
      case 'gauge':
        stateMap = this.gauges.get(name);
        break;
      case 'histogram':
        stateMap = this.histograms.get(name);
        break;
      case 'summary':
        stateMap = this.summaries.get(name);
        break;
    }

    if (!stateMap) {
      return [];
    }

    return Array.from(stateMap.values()).map(s => ({ ...s.labels }));
  }

  /**
   * Reset a metric to its initial state
   *
   * @param name - Metric name
   * @param labels - Optional label filter (resets all if not provided)
   */
  resetMetric(name: string, labels?: Record<string, string>): void {
    const definition = this.definitions.get(name);
    if (!definition) {
      return;
    }

    if (labels) {
      const labelKey = this.labelsToKey(labels);

      switch (definition.type) {
        case 'counter':
          this.counters.get(name)?.delete(labelKey);
          break;
        case 'gauge':
          this.gauges.get(name)?.delete(labelKey);
          break;
        case 'histogram':
          this.histograms.get(name)?.delete(labelKey);
          break;
        case 'summary':
          this.summaries.get(name)?.delete(labelKey);
          break;
      }
    } else {
      // Reset all label combinations
      switch (definition.type) {
        case 'counter':
          this.counters.get(name)?.clear();
          break;
        case 'gauge':
          this.gauges.get(name)?.clear();
          break;
        case 'histogram':
          this.histograms.get(name)?.clear();
          break;
        case 'summary':
          this.summaries.get(name)?.clear();
          break;
      }

      this.dataPoints.set(name, []);
    }
  }

  /**
   * Clear all metrics and definitions
   */
  clearAll(): void {
    this.definitions.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.dataPoints.clear();
  }

  /**
   * Export all current metric values
   *
   * @returns Exported metrics data
   */
  exportMetrics(): {
    timestamp: Date;
    metrics: Array<{
      name: string;
      type: MetricType;
      values: Array<{ labels: Record<string, string>; value: unknown }>;
    }>;
  } {
    const metrics: Array<{
      name: string;
      type: MetricType;
      values: Array<{ labels: Record<string, string>; value: unknown }>;
    }> = [];

    for (const [name, definition] of this.definitions) {
      const values: Array<{ labels: Record<string, string>; value: unknown }> =
        [];

      switch (definition.type) {
        case 'counter':
          for (const state of this.counters.get(name)?.values() || []) {
            values.push({ labels: state.labels, value: state.value });
          }
          break;
        case 'gauge':
          for (const state of this.gauges.get(name)?.values() || []) {
            values.push({ labels: state.labels, value: state.value });
          }
          break;
        case 'histogram':
          for (const state of this.histograms.get(name)?.values() || []) {
            values.push({
              labels: state.labels,
              value: {
                sum: state.sum,
                count: state.count,
                buckets: Object.fromEntries(state.buckets),
              },
            });
          }
          break;
        case 'summary':
          for (const state of this.summaries.get(name)?.values() || []) {
            const sorted = [...state.values].sort((a, b) => a - b);
            const quantiles = definition.quantiles || [0.5, 0.9, 0.95, 0.99];
            const quantileValues: Record<string, number> = {};
            for (const q of quantiles) {
              const index = Math.ceil(q * sorted.length) - 1;
              quantileValues[`p${q * 100}`] = sorted[Math.max(0, index)] || 0;
            }
            values.push({
              labels: state.labels,
              value: {
                count: state.values.length,
                sum: state.values.reduce((a, b) => a + b, 0),
                quantiles: quantileValues,
              },
            });
          }
          break;
      }

      metrics.push({ name, type: definition.type, values });
    }

    return { timestamp: new Date(), metrics };
  }

  /**
   * Stop the cleanup timer and release resources
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Ensure a metric exists and has the correct type
   */
  private ensureMetricExists(name: string, expectedType: MetricType): void {
    const definition = this.definitions.get(name);

    if (!definition) {
      // Auto-define the metric
      this.defineMetric({
        name,
        type: expectedType,
        labels: [],
      });
    } else if (definition.type !== expectedType) {
      throw new Error(
        `Metric "${name}" is defined as ${definition.type}, not ${expectedType}`,
      );
    }
  }

  /**
   * Convert labels object to a consistent string key
   */
  private labelsToKey(labels: Record<string, string>): string {
    const sortedEntries = Object.entries(labels).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return JSON.stringify(sortedEntries);
  }

  /**
   * Record a data point for time-series analysis
   */
  private recordDataPoint(
    name: string,
    value: number,
    labels: Record<string, string>,
  ): void {
    const points = this.dataPoints.get(name);
    if (!points) {
      return;
    }

    points.push({
      name,
      value,
      timestamp: new Date(),
      labels: { ...labels },
    });

    // Trim if over limit
    if (points.length > this.config.maxDataPointsPerMetric) {
      points.splice(0, points.length - this.config.maxDataPointsPerMetric);
    }
  }

  /**
   * Start the automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Clean up old data points beyond retention period
   */
  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.config.retentionPeriodMs);

    for (const [name, points] of this.dataPoints) {
      const filtered = points.filter(p => p.timestamp > cutoff);
      this.dataPoints.set(name, filtered);
    }
  }
}

/**
 * Create a pre-configured metrics collector
 *
 * @param config - Additional configuration
 * @returns Configured MetricsCollector instance
 */
export function createMetricsCollector(
  config: Partial<MetricsCollectorConfig> = {},
): MetricsCollector {
  return new MetricsCollector(config);
}
