/**
 * Metrics Collector - System metrics collection and aggregation
 */

import * as os from 'os';
import { EventEmitter } from 'eventemitter3';

import { PerformanceMetrics, OperationResult } from '../types';

interface CpuTimes {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
}

interface RequestAccumulator {
  totalLatencyMs: number;
  requestCount: number;
  errorCount: number;
  windowStartMs: number;
}

export class MetricsCollector extends EventEmitter {
  private _metrics: PerformanceMetrics[] = [];

  // Accumulators for request-based metrics
  private _requestAccumulator: RequestAccumulator = {
    totalLatencyMs: 0,
    requestCount: 0,
    errorCount: 0,
    windowStartMs: Date.now(),
  };

  // Real-time counters for connections and queue
  private _activeConnections: number = 0;
  private _queueLength: number = 0;

  // Snapshot of CPU times taken at the previous collectMetrics() call
  private _prevCpuTimes: CpuTimes | null = null;

  constructor() {
    super();
  }

  async initialize(): Promise<OperationResult> {
    // Seed the initial CPU snapshot so the first delta is meaningful
    this._prevCpuTimes = this._aggregateCpuTimes();
    return { success: true, message: 'Metrics Collector initialized' };
  }

  // ---------------------------------------------------------------------------
  // Public tracking helpers – call these from request/queue handlers
  // ---------------------------------------------------------------------------

  /** Record a completed request. latencyMs is the end-to-end response time. */
  recordRequest(latencyMs: number, isError: boolean = false): void {
    this._requestAccumulator.totalLatencyMs += latencyMs;
    this._requestAccumulator.requestCount += 1;
    if (isError) {
      this._requestAccumulator.errorCount += 1;
    }
  }

  /** Adjust the active connection counter by a delta (e.g. +1 on open, -1 on close). */
  trackConnection(delta: number): void {
    this._activeConnections = Math.max(0, this._activeConnections + delta);
  }

  /** Set the current queue length directly. */
  trackQueueLength(length: number): void {
    this._queueLength = Math.max(0, length);
  }

  // ---------------------------------------------------------------------------
  // Core collection
  // ---------------------------------------------------------------------------

  collectMetrics(): PerformanceMetrics {
    const now = Date.now();
    const acc = this._requestAccumulator;

    // --- CPU usage (delta between two snapshots, 0-1 range) ---
    const currentCpuTimes = this._aggregateCpuTimes();
    const cpuUsage = this._prevCpuTimes
      ? this._calculateCpuUsage(this._prevCpuTimes, currentCpuTimes)
      : 0;
    this._prevCpuTimes = currentCpuTimes;

    // --- Memory usage (RSS as fraction of total system RAM, 0-1 range) ---
    const rssBytes = process.memoryUsage().rss;
    const totalMemBytes = os.totalmem();
    const memoryUsage = totalMemBytes > 0 ? rssBytes / totalMemBytes : 0;

    // --- Request-based metrics ---
    const windowSeconds = Math.max((now - acc.windowStartMs) / 1000, 1);
    const responseTime =
      acc.requestCount > 0 ? acc.totalLatencyMs / acc.requestCount : 0;
    const throughput = acc.requestCount / windowSeconds;
    const errorRate =
      acc.requestCount > 0 ? acc.errorCount / acc.requestCount : 0;

    // Reset window accumulator after each sample
    this._requestAccumulator = {
      totalLatencyMs: 0,
      requestCount: 0,
      errorCount: 0,
      windowStartMs: now,
    };

    return {
      responseTime,
      throughput,
      errorRate,
      memoryUsage,
      cpuUsage,
      activeConnections: this._activeConnections,
      queueLength: this._queueLength,
    };
  }

  async shutdown(): Promise<OperationResult> {
    return { success: true, message: 'Metrics Collector shutdown completed' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Aggregate tick counts across all CPU cores into a single CpuTimes object. */
  private _aggregateCpuTimes(): CpuTimes {
    const cpus = os.cpus();
    const totals: CpuTimes = { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    for (const cpu of cpus) {
      totals.user += cpu.times.user;
      totals.nice += cpu.times.nice;
      totals.sys += cpu.times.sys;
      totals.idle += cpu.times.idle;
      totals.irq += cpu.times.irq;
    }
    return totals;
  }

  /** Calculate CPU utilisation as a 0-1 value from two CpuTimes snapshots. */
  private _calculateCpuUsage(prev: CpuTimes, curr: CpuTimes): number {
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

    const totalDelta = currTotal - prevTotal;
    const idleDelta = curr.idle - prev.idle;

    if (totalDelta <= 0) {
      return 0;
    }

    return Math.min(1, Math.max(0, (totalDelta - idleDelta) / totalDelta));
  }
}
