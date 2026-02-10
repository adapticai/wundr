/**
 * Metric Retention and Rollup for Orchestrator Daemon
 *
 * Provides in-process metric time-series storage with configurable retention
 * windows, automatic rollup (downsampling) from fine-grained to coarser
 * intervals, and dashboard-ready JSON export.
 *
 * This complements Prometheus scraping by keeping a local ring buffer of
 * data points that can be queried instantly without PromQL.
 *
 * Retention tiers:
 *   - raw:    1-second resolution, retained for `rawRetentionMs` (default 5min)
 *   - minute: 1-minute averages, retained for `minuteRetentionMs` (default 1h)
 *   - hour:   1-hour averages, retained for `hourRetentionMs` (default 24h)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single data point in a time series.
 */
export interface DataPoint {
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Observed value. */
  value: number;
  /** Optional label set (serialized to string for grouping). */
  labels?: Record<string, string>;
}

/**
 * A rolled-up data point with statistical summary.
 */
export interface RollupPoint {
  /** Start of the rollup window (ms). */
  timestamp: number;
  /** End of the rollup window (ms). */
  endTimestamp: number;
  /** Number of samples in this window. */
  count: number;
  /** Sum of values. */
  sum: number;
  /** Minimum observed value. */
  min: number;
  /** Maximum observed value. */
  max: number;
  /** Average (sum / count). */
  avg: number;
}

/**
 * Configuration for the retention store.
 */
export interface RetentionConfig {
  /** How long to keep raw data points (ms). Default: 300_000 (5 min). */
  rawRetentionMs?: number;
  /** How long to keep minute-level rollups (ms). Default: 3_600_000 (1 hour). */
  minuteRetentionMs?: number;
  /** How long to keep hour-level rollups (ms). Default: 86_400_000 (24 hours). */
  hourRetentionMs?: number;
  /** How often to run the compaction loop (ms). Default: 60_000 (1 min). */
  compactionIntervalMs?: number;
  /** Maximum raw data points per metric before forced eviction. Default: 10000. */
  maxRawPointsPerMetric?: number;
}

/**
 * Dashboard export format for a single metric.
 */
export interface MetricTimeSeries {
  metric: string;
  labels?: Record<string, string>;
  resolution: 'raw' | 'minute' | 'hour';
  points: Array<{
    timestamp: number;
    value: number;
    min?: number;
    max?: number;
    count?: number;
  }>;
}

/**
 * Full dashboard export.
 */
export interface DashboardExport {
  exportedAt: string;
  retentionConfig: {
    rawRetentionMs: number;
    minuteRetentionMs: number;
    hourRetentionMs: number;
  };
  metrics: MetricTimeSeries[];
  summary: {
    totalMetrics: number;
    totalRawPoints: number;
    totalMinuteRollups: number;
    totalHourRollups: number;
  };
}

// ---------------------------------------------------------------------------
// MetricRetentionStore
// ---------------------------------------------------------------------------

/**
 * In-process metric time-series store with automatic rollup and retention.
 *
 * @example
 * ```ts
 * const store = new MetricRetentionStore();
 * store.start();
 *
 * // Record data points
 * store.record('wundr_model_request_duration_seconds', 1.23, { provider: 'openai' });
 * store.record('wundr_model_request_duration_seconds', 0.87, { provider: 'anthropic' });
 *
 * // Query
 * const raw = store.queryRaw('wundr_model_request_duration_seconds', Date.now() - 60000);
 * const minutes = store.queryMinute('wundr_model_request_duration_seconds', Date.now() - 3600000);
 *
 * // Export for dashboard
 * const dashboard = store.exportForDashboard();
 * ```
 */
export class MetricRetentionStore {
  private readonly config: Required<RetentionConfig>;

  /** Raw data points: metricKey -> DataPoint[] */
  private readonly raw: Map<string, DataPoint[]> = new Map();
  /** Minute rollups: metricKey -> RollupPoint[] */
  private readonly minuteRollups: Map<string, RollupPoint[]> = new Map();
  /** Hour rollups: metricKey -> RollupPoint[] */
  private readonly hourRollups: Map<string, RollupPoint[]> = new Map();

  private compactionTimer: NodeJS.Timeout | null = null;

  constructor(config?: RetentionConfig) {
    this.config = {
      rawRetentionMs: config?.rawRetentionMs ?? 300_000,
      minuteRetentionMs: config?.minuteRetentionMs ?? 3_600_000,
      hourRetentionMs: config?.hourRetentionMs ?? 86_400_000,
      compactionIntervalMs: config?.compactionIntervalMs ?? 60_000,
      maxRawPointsPerMetric: config?.maxRawPointsPerMetric ?? 10_000,
    };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Start the periodic compaction loop.
   */
  start(): void {
    if (this.compactionTimer) {
return;
}

    this.compactionTimer = setInterval(
      () => this.compact(),
      this.config.compactionIntervalMs,
    );

    if (this.compactionTimer.unref) {
      this.compactionTimer.unref();
    }
  }

  /**
   * Stop the compaction loop and release resources.
   */
  stop(): void {
    if (this.compactionTimer) {
      clearInterval(this.compactionTimer);
      this.compactionTimer = null;
    }
  }

  /**
   * Clear all stored data.
   */
  clear(): void {
    this.raw.clear();
    this.minuteRollups.clear();
    this.hourRollups.clear();
  }

  destroy(): void {
    this.stop();
    this.clear();
  }

  // -----------------------------------------------------------------------
  // Recording
  // -----------------------------------------------------------------------

  /**
   * Record a data point.
   *
   * @param metric - The metric name (e.g. "wundr_model_request_duration_seconds").
   * @param value - The observed value.
   * @param labels - Optional label set.
   */
  record(metric: string, value: number, labels?: Record<string, string>): void {
    const key = this.metricKey(metric, labels);
    let points = this.raw.get(key);

    if (!points) {
      points = [];
      this.raw.set(key, points);
    }

    points.push({
      timestamp: Date.now(),
      value,
      labels,
    });

    // Enforce per-metric cap.
    if (points.length > this.config.maxRawPointsPerMetric) {
      points.splice(0, points.length - this.config.maxRawPointsPerMetric);
    }
  }

  // -----------------------------------------------------------------------
  // Querying
  // -----------------------------------------------------------------------

  /**
   * Query raw data points for a metric since a given timestamp.
   */
  queryRaw(metric: string, sinceMs: number, labels?: Record<string, string>): DataPoint[] {
    const key = this.metricKey(metric, labels);
    const points = this.raw.get(key);
    if (!points) {
return [];
}
    return points.filter((p) => p.timestamp >= sinceMs);
  }

  /**
   * Query minute-level rollups for a metric since a given timestamp.
   */
  queryMinute(metric: string, sinceMs: number, labels?: Record<string, string>): RollupPoint[] {
    const key = this.metricKey(metric, labels);
    const rollups = this.minuteRollups.get(key);
    if (!rollups) {
return [];
}
    return rollups.filter((r) => r.timestamp >= sinceMs);
  }

  /**
   * Query hour-level rollups for a metric since a given timestamp.
   */
  queryHour(metric: string, sinceMs: number, labels?: Record<string, string>): RollupPoint[] {
    const key = this.metricKey(metric, labels);
    const rollups = this.hourRollups.get(key);
    if (!rollups) {
return [];
}
    return rollups.filter((r) => r.timestamp >= sinceMs);
  }

  /**
   * Get the list of all tracked metric keys.
   */
  getMetricKeys(): string[] {
    const keys = new Set<string>();
    for (const key of this.raw.keys()) {
keys.add(key);
}
    for (const key of this.minuteRollups.keys()) {
keys.add(key);
}
    for (const key of this.hourRollups.keys()) {
keys.add(key);
}
    return Array.from(keys);
  }

  // -----------------------------------------------------------------------
  // Dashboard Export
  // -----------------------------------------------------------------------

  /**
   * Export all data in a dashboard-ready JSON format.
   *
   * @param options - Control which resolutions to include.
   */
  exportForDashboard(options?: {
    includeRaw?: boolean;
    includeMinute?: boolean;
    includeHour?: boolean;
    sinceMs?: number;
  }): DashboardExport {
    const includeRaw = options?.includeRaw ?? true;
    const includeMinute = options?.includeMinute ?? true;
    const includeHour = options?.includeHour ?? true;
    const sinceMs = options?.sinceMs ?? 0;

    const metrics: MetricTimeSeries[] = [];
    let totalRawPoints = 0;
    let totalMinuteRollups = 0;
    let totalHourRollups = 0;

    const allKeys = this.getMetricKeys();

    for (const key of allKeys) {
      const { metric, labels } = this.parseMetricKey(key);

      if (includeRaw) {
        const rawPoints = this.raw.get(key) ?? [];
        const filtered = rawPoints.filter((p) => p.timestamp >= sinceMs);
        if (filtered.length > 0) {
          metrics.push({
            metric,
            labels,
            resolution: 'raw',
            points: filtered.map((p) => ({
              timestamp: p.timestamp,
              value: p.value,
            })),
          });
          totalRawPoints += filtered.length;
        }
      }

      if (includeMinute) {
        const minutePoints = this.minuteRollups.get(key) ?? [];
        const filtered = minutePoints.filter((p) => p.timestamp >= sinceMs);
        if (filtered.length > 0) {
          metrics.push({
            metric,
            labels,
            resolution: 'minute',
            points: filtered.map((r) => ({
              timestamp: r.timestamp,
              value: r.avg,
              min: r.min,
              max: r.max,
              count: r.count,
            })),
          });
          totalMinuteRollups += filtered.length;
        }
      }

      if (includeHour) {
        const hourPoints = this.hourRollups.get(key) ?? [];
        const filtered = hourPoints.filter((p) => p.timestamp >= sinceMs);
        if (filtered.length > 0) {
          metrics.push({
            metric,
            labels,
            resolution: 'hour',
            points: filtered.map((r) => ({
              timestamp: r.timestamp,
              value: r.avg,
              min: r.min,
              max: r.max,
              count: r.count,
            })),
          });
          totalHourRollups += filtered.length;
        }
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      retentionConfig: {
        rawRetentionMs: this.config.rawRetentionMs,
        minuteRetentionMs: this.config.minuteRetentionMs,
        hourRetentionMs: this.config.hourRetentionMs,
      },
      metrics,
      summary: {
        totalMetrics: allKeys.length,
        totalRawPoints,
        totalMinuteRollups,
        totalHourRollups,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Compaction
  // -----------------------------------------------------------------------

  /**
   * Run compaction: roll up raw -> minute, minute -> hour, then evict stale data.
   */
  compact(): void {
    const now = Date.now();
    this.rollupRawToMinute(now);
    this.rollupMinuteToHour(now);
    this.evictStaleData(now);
  }

  private rollupRawToMinute(now: number): void {
    const minuteFloor = this.floorToMinute(now);
    // Roll up raw points that are at least one full minute old.
    const cutoff = minuteFloor - 60_000;

    for (const [key, points] of this.raw) {
      const eligible = points.filter((p) => p.timestamp < cutoff);
      if (eligible.length === 0) {
continue;
}

      // Group by minute.
      const byMinute = new Map<number, DataPoint[]>();
      for (const p of eligible) {
        const minuteKey = this.floorToMinute(p.timestamp);
        let group = byMinute.get(minuteKey);
        if (!group) {
          group = [];
          byMinute.set(minuteKey, group);
        }
        group.push(p);
      }

      // Create rollup points.
      let rollups = this.minuteRollups.get(key);
      if (!rollups) {
        rollups = [];
        this.minuteRollups.set(key, rollups);
      }

      for (const [minuteTs, group] of byMinute) {
        // Skip if we already have a rollup for this minute.
        if (rollups.some((r) => r.timestamp === minuteTs)) {
continue;
}

        const values = group.map((p) => p.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const min = Math.min(...values);
        const max = Math.max(...values);

        rollups.push({
          timestamp: minuteTs,
          endTimestamp: minuteTs + 60_000,
          count: values.length,
          sum,
          min,
          max,
          avg: sum / values.length,
        });
      }

      // Sort rollups by timestamp.
      rollups.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  private rollupMinuteToHour(now: number): void {
    const hourFloor = this.floorToHour(now);
    const cutoff = hourFloor - 3_600_000;

    for (const [key, minutePoints] of this.minuteRollups) {
      const eligible = minutePoints.filter((p) => p.timestamp < cutoff);
      if (eligible.length === 0) {
continue;
}

      // Group by hour.
      const byHour = new Map<number, RollupPoint[]>();
      for (const p of eligible) {
        const hourKey = this.floorToHour(p.timestamp);
        let group = byHour.get(hourKey);
        if (!group) {
          group = [];
          byHour.set(hourKey, group);
        }
        group.push(p);
      }

      let rollups = this.hourRollups.get(key);
      if (!rollups) {
        rollups = [];
        this.hourRollups.set(key, rollups);
      }

      for (const [hourTs, group] of byHour) {
        if (rollups.some((r) => r.timestamp === hourTs)) {
continue;
}

        let totalCount = 0;
        let totalSum = 0;
        let globalMin = Infinity;
        let globalMax = -Infinity;

        for (const r of group) {
          totalCount += r.count;
          totalSum += r.sum;
          if (r.min < globalMin) {
globalMin = r.min;
}
          if (r.max > globalMax) {
globalMax = r.max;
}
        }

        rollups.push({
          timestamp: hourTs,
          endTimestamp: hourTs + 3_600_000,
          count: totalCount,
          sum: totalSum,
          min: globalMin === Infinity ? 0 : globalMin,
          max: globalMax === -Infinity ? 0 : globalMax,
          avg: totalCount > 0 ? totalSum / totalCount : 0,
        });
      }

      rollups.sort((a, b) => a.timestamp - b.timestamp);
    }
  }

  private evictStaleData(now: number): void {
    const rawCutoff = now - this.config.rawRetentionMs;
    const minuteCutoff = now - this.config.minuteRetentionMs;
    const hourCutoff = now - this.config.hourRetentionMs;

    for (const [key, points] of this.raw) {
      const kept = points.filter((p) => p.timestamp >= rawCutoff);
      if (kept.length === 0) {
        this.raw.delete(key);
      } else {
        this.raw.set(key, kept);
      }
    }

    for (const [key, rollups] of this.minuteRollups) {
      const kept = rollups.filter((r) => r.timestamp >= minuteCutoff);
      if (kept.length === 0) {
        this.minuteRollups.delete(key);
      } else {
        this.minuteRollups.set(key, kept);
      }
    }

    for (const [key, rollups] of this.hourRollups) {
      const kept = rollups.filter((r) => r.timestamp >= hourCutoff);
      if (kept.length === 0) {
        this.hourRollups.delete(key);
      } else {
        this.hourRollups.set(key, kept);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private metricKey(metric: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
return metric;
}
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    const labelStr = sorted.map(([k, v]) => `${k}="${v}"`).join(',');
    return `${metric}{${labelStr}}`;
  }

  private parseMetricKey(key: string): { metric: string; labels?: Record<string, string> } {
    const braceIdx = key.indexOf('{');
    if (braceIdx === -1) {
return { metric: key };
}

    const metric = key.slice(0, braceIdx);
    const labelStr = key.slice(braceIdx + 1, -1);
    const labels: Record<string, string> = {};

    for (const pair of labelStr.split(',')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) {
continue;
}
      const k = pair.slice(0, eqIdx);
      // Remove surrounding quotes.
      const v = pair.slice(eqIdx + 1).replace(/^"|"$/g, '');
      labels[k] = v;
    }

    return { metric, labels: Object.keys(labels).length > 0 ? labels : undefined };
  }

  private floorToMinute(ts: number): number {
    return ts - (ts % 60_000);
  }

  private floorToHour(ts: number): number {
    return ts - (ts % 3_600_000);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRetentionStore(config?: RetentionConfig): MetricRetentionStore {
  return new MetricRetentionStore(config);
}
