/**
 * @wundr/agent-memory - Provider Health Monitor
 *
 * Tracks request outcomes (success/failure) and latencies per provider over
 * a rolling time window. When the error rate exceeds a configurable threshold,
 * the provider is marked unhealthy and enters a cooldown period during which
 * the failover orchestrator will skip it.
 *
 * Inspired by OpenClaw's retry-with-backoff pattern but extracted into a
 * dedicated, provider-aware health tracker.
 */

import {
  type EmbeddingProviderId,
  type HealthMonitorConfig,
  type ProviderHealthSnapshot,
  DEFAULT_HEALTH_MONITOR_CONFIG,
} from './provider';

// ============================================================================
// Types
// ============================================================================

interface RequestRecord {
  timestamp: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

interface ProviderState {
  records: RequestRecord[];
  cooldownUntil: number;
  lastErrorMessage?: string;
  lastErrorAt?: number;
}

// ============================================================================
// HealthMonitor
// ============================================================================

/**
 * Monitors embedding provider health using a rolling window of request outcomes.
 *
 * Usage:
 * ```typescript
 * const monitor = new HealthMonitor();
 *
 * // Before calling a provider, check health
 * if (!monitor.isHealthy('openai')) {
 *   // Skip to next provider in failover chain
 * }
 *
 * // After a request completes
 * monitor.recordSuccess('openai', latencyMs);
 * // or
 * monitor.recordFailure('openai', latencyMs, 'rate limit exceeded');
 *
 * // Inspect health for observability
 * const snapshot = monitor.getSnapshot('openai');
 * ```
 */
export class HealthMonitor {
  private readonly config: HealthMonitorConfig;
  private readonly providers: Map<EmbeddingProviderId, ProviderState> = new Map();

  constructor(config?: Partial<HealthMonitorConfig>) {
    this.config = { ...DEFAULT_HEALTH_MONITOR_CONFIG, ...config };
  }

  /**
   * Whether a given provider is currently considered healthy.
   *
   * A provider is unhealthy when:
   * 1. It has exceeded the error rate threshold within the window, AND
   * 2. It is still within its cooldown period.
   *
   * If health monitoring is disabled, always returns true.
   */
  isHealthy(providerId: EmbeddingProviderId): boolean {
    if (!this.config.enabled) {
      return true;
    }

    const state = this.providers.get(providerId);
    if (!state) {
      return true;
    }

    // If in cooldown, provider is unhealthy
    if (state.cooldownUntil > Date.now()) {
      return false;
    }

    // Evaluate error rate within window
    const windowRecords = this.getWindowRecords(state);
    if (windowRecords.length < this.config.minRequestsForEvaluation) {
      return true;
    }

    const failures = windowRecords.filter((r) => !r.success).length;
    const errorRate = failures / windowRecords.length;
    return errorRate < this.config.unhealthyThreshold;
  }

  /**
   * Record a successful request for a provider.
   */
  recordSuccess(providerId: EmbeddingProviderId, latencyMs: number): void {
    if (!this.config.enabled) {
      return;
    }
    const state = this.ensureState(providerId);
    state.records.push({
      timestamp: Date.now(),
      latencyMs,
      success: true,
    });
    this.pruneRecords(state);
  }

  /**
   * Record a failed request for a provider.
   * If the error rate now exceeds the threshold, a cooldown is set.
   */
  recordFailure(
    providerId: EmbeddingProviderId,
    latencyMs: number,
    errorMessage?: string,
  ): void {
    if (!this.config.enabled) {
      return;
    }
    const now = Date.now();
    const state = this.ensureState(providerId);
    state.records.push({
      timestamp: now,
      latencyMs,
      success: false,
      errorMessage,
    });
    state.lastErrorMessage = errorMessage;
    state.lastErrorAt = now;
    this.pruneRecords(state);

    // Check if cooldown should be applied
    const windowRecords = this.getWindowRecords(state);
    if (windowRecords.length >= this.config.minRequestsForEvaluation) {
      const failures = windowRecords.filter((r) => !r.success).length;
      const errorRate = failures / windowRecords.length;
      if (errorRate >= this.config.unhealthyThreshold) {
        state.cooldownUntil = now + this.config.cooldownMs;
      }
    }
  }

  /**
   * Get a health snapshot for a specific provider.
   */
  getSnapshot(providerId: EmbeddingProviderId): ProviderHealthSnapshot {
    const state = this.providers.get(providerId);
    if (!state) {
      return {
        providerId,
        healthy: true,
        totalRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        avgLatencyMs: 0,
      };
    }

    const windowRecords = this.getWindowRecords(state);
    const failures = windowRecords.filter((r) => !r.success).length;
    const errorRate = windowRecords.length > 0 ? failures / windowRecords.length : 0;
    const avgLatencyMs = windowRecords.length > 0
      ? windowRecords.reduce((sum, r) => sum + r.latencyMs, 0) / windowRecords.length
      : 0;

    return {
      providerId,
      healthy: this.isHealthy(providerId),
      totalRequests: windowRecords.length,
      failedRequests: failures,
      errorRate,
      avgLatencyMs,
      lastErrorMessage: state.lastErrorMessage,
      lastErrorAt: state.lastErrorAt,
      cooldownUntil: state.cooldownUntil > Date.now() ? state.cooldownUntil : undefined,
    };
  }

  /**
   * Get health snapshots for all tracked providers.
   */
  getAllSnapshots(): ProviderHealthSnapshot[] {
    const snapshots: ProviderHealthSnapshot[] = [];
    for (const providerId of this.providers.keys()) {
      snapshots.push(this.getSnapshot(providerId));
    }
    return snapshots;
  }

  /**
   * Reset health tracking for a specific provider (e.g., after manual recovery).
   */
  reset(providerId: EmbeddingProviderId): void {
    this.providers.delete(providerId);
  }

  /**
   * Reset all health tracking.
   */
  resetAll(): void {
    this.providers.clear();
  }

  // ==========================================================================
  // Private
  // ==========================================================================

  private ensureState(providerId: EmbeddingProviderId): ProviderState {
    let state = this.providers.get(providerId);
    if (!state) {
      state = { records: [], cooldownUntil: 0 };
      this.providers.set(providerId, state);
    }
    return state;
  }

  private getWindowRecords(state: ProviderState): RequestRecord[] {
    const cutoff = Date.now() - this.config.windowMs;
    return state.records.filter((r) => r.timestamp > cutoff);
  }

  private pruneRecords(state: ProviderState): void {
    const cutoff = Date.now() - this.config.windowMs;
    state.records = state.records.filter((r) => r.timestamp > cutoff);
  }
}
