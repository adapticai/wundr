/**
 * Sandbox Metrics Collection
 *
 * Tracks per-plugin resource usage: memory, CPU time, call counts,
 * error rates, and uptime. Metrics are exposed as snapshots for
 * monitoring integration and are used internally for resource-limit
 * enforcement.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PluginMetricsSnapshot = {
  pluginName: string;
  tier: string;
  uptime: number;
  callCount: number;
  callErrors: number;
  callTimeouts: number;
  totalCallDurationMs: number;
  averageCallDurationMs: number;
  peakCallDurationMs: number;
  lastCallAt: number | null;
  memoryUsageBytes: number | null;
  cpuTimeMs: number | null;
  messagesReceived: number;
  messagesSent: number;
  restartCount: number;
};

export type MetricsUpdatePayload = {
  callDurationMs?: number;
  callError?: boolean;
  callTimeout?: boolean;
  memoryUsageBytes?: number;
  cpuTimeMs?: number;
  messageReceived?: boolean;
  messageSent?: boolean;
  restart?: boolean;
};

// ---------------------------------------------------------------------------
// Metrics Collector
// ---------------------------------------------------------------------------

export class PluginMetrics {
  private pluginName: string;
  private tier: string;
  private startedAt: number;

  private callCount = 0;
  private callErrors = 0;
  private callTimeouts = 0;
  private totalCallDurationMs = 0;
  private peakCallDurationMs = 0;
  private lastCallAt: number | null = null;
  private memoryUsageBytes: number | null = null;
  private cpuTimeMs: number | null = null;
  private messagesReceived = 0;
  private messagesSent = 0;
  private restartCount = 0;

  constructor(pluginName: string, tier: string) {
    this.pluginName = pluginName;
    this.tier = tier;
    this.startedAt = Date.now();
  }

  /**
   * Record a completed call with its duration and outcome.
   */
  recordCall(
    durationMs: number,
    error: boolean = false,
    timeout: boolean = false
  ): void {
    this.callCount++;
    this.totalCallDurationMs += durationMs;
    this.lastCallAt = Date.now();

    if (durationMs > this.peakCallDurationMs) {
      this.peakCallDurationMs = durationMs;
    }

    if (error) {
      this.callErrors++;
    }
    if (timeout) {
      this.callTimeouts++;
    }
  }

  /**
   * Record an incoming message from the plugin.
   */
  recordMessageReceived(): void {
    this.messagesReceived++;
  }

  /**
   * Record an outgoing message to the plugin.
   */
  recordMessageSent(): void {
    this.messagesSent++;
  }

  /**
   * Record a plugin restart.
   */
  recordRestart(): void {
    this.restartCount++;
  }

  /**
   * Update resource usage gauges (memory, CPU).
   */
  updateResourceUsage(memoryBytes?: number, cpuMs?: number): void {
    if (memoryBytes !== undefined) {
      this.memoryUsageBytes = memoryBytes;
    }
    if (cpuMs !== undefined) {
      this.cpuTimeMs = cpuMs;
    }
  }

  /**
   * Apply a batch of metric updates.
   */
  update(payload: MetricsUpdatePayload): void {
    if (payload.callDurationMs !== undefined) {
      this.recordCall(
        payload.callDurationMs,
        payload.callError ?? false,
        payload.callTimeout ?? false
      );
    }
    if (
      payload.memoryUsageBytes !== undefined ||
      payload.cpuTimeMs !== undefined
    ) {
      this.updateResourceUsage(payload.memoryUsageBytes, payload.cpuTimeMs);
    }
    if (payload.messageReceived) {
      this.messagesReceived++;
    }
    if (payload.messageSent) {
      this.messagesSent++;
    }
    if (payload.restart) {
      this.restartCount++;
    }
  }

  /**
   * Return a frozen snapshot of all metrics.
   */
  snapshot(): PluginMetricsSnapshot {
    const uptime = Date.now() - this.startedAt;
    return {
      pluginName: this.pluginName,
      tier: this.tier,
      uptime,
      callCount: this.callCount,
      callErrors: this.callErrors,
      callTimeouts: this.callTimeouts,
      totalCallDurationMs: this.totalCallDurationMs,
      averageCallDurationMs:
        this.callCount > 0 ? this.totalCallDurationMs / this.callCount : 0,
      peakCallDurationMs: this.peakCallDurationMs,
      lastCallAt: this.lastCallAt,
      memoryUsageBytes: this.memoryUsageBytes,
      cpuTimeMs: this.cpuTimeMs,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      restartCount: this.restartCount,
    };
  }

  /**
   * Reset all counters (used on plugin restart).
   */
  reset(): void {
    this.startedAt = Date.now();
    this.callCount = 0;
    this.callErrors = 0;
    this.callTimeouts = 0;
    this.totalCallDurationMs = 0;
    this.peakCallDurationMs = 0;
    this.lastCallAt = null;
    this.memoryUsageBytes = null;
    this.cpuTimeMs = null;
    this.messagesReceived = 0;
    this.messagesSent = 0;
    // restartCount is intentionally NOT reset
  }
}

// ---------------------------------------------------------------------------
// Metrics Registry
// ---------------------------------------------------------------------------

/**
 * Global registry of all plugin metrics, keyed by plugin name.
 */
export class PluginMetricsRegistry {
  private registry = new Map<string, PluginMetrics>();

  /**
   * Get or create a metrics collector for a plugin.
   */
  getOrCreate(pluginName: string, tier: string): PluginMetrics {
    let metrics = this.registry.get(pluginName);
    if (!metrics) {
      metrics = new PluginMetrics(pluginName, tier);
      this.registry.set(pluginName, metrics);
    }
    return metrics;
  }

  /**
   * Retrieve a metrics collector without creating.
   */
  get(pluginName: string): PluginMetrics | undefined {
    return this.registry.get(pluginName);
  }

  /**
   * Remove a plugin's metrics (on uninstall).
   */
  remove(pluginName: string): void {
    this.registry.delete(pluginName);
  }

  /**
   * Return snapshots for all tracked plugins.
   */
  allSnapshots(): PluginMetricsSnapshot[] {
    const snapshots: PluginMetricsSnapshot[] = [];
    for (const metrics of this.registry.values()) {
      snapshots.push(metrics.snapshot());
    }
    return snapshots;
  }

  /**
   * Return an aggregate summary across all plugins.
   */
  aggregateSummary(): {
    totalPlugins: number;
    totalCalls: number;
    totalErrors: number;
    totalTimeouts: number;
    totalMemoryBytes: number;
  } {
    let totalCalls = 0;
    let totalErrors = 0;
    let totalTimeouts = 0;
    let totalMemoryBytes = 0;

    for (const metrics of this.registry.values()) {
      const snap = metrics.snapshot();
      totalCalls += snap.callCount;
      totalErrors += snap.callErrors;
      totalTimeouts += snap.callTimeouts;
      totalMemoryBytes += snap.memoryUsageBytes ?? 0;
    }

    return {
      totalPlugins: this.registry.size,
      totalCalls,
      totalErrors,
      totalTimeouts,
      totalMemoryBytes,
    };
  }
}
