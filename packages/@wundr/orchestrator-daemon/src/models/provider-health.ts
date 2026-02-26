/**
 * Provider Health Tracker - Circuit breaker and latency tracking for LLM providers
 *
 * Implements a three-state circuit breaker (closed -> open -> half-open) per
 * provider to avoid hammering unhealthy endpoints. Also tracks rolling latency
 * percentiles for latency-aware routing decisions.
 *
 * Inspired by OpenClaw's cooldown escalation pattern in auth-profiles.ts,
 * generalized from per-key to per-provider health.
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ProviderHealthConfig {
  /** Number of failures before tripping the circuit (default: 5) */
  failureThreshold?: number;
  /** Milliseconds the circuit stays open before transitioning to half-open (default: 30_000) */
  openDurationMs?: number;
  /** Maximum consecutive successes needed in half-open to close the circuit (default: 2) */
  halfOpenSuccessThreshold?: number;
  /** Rolling window size for latency tracking (default: 50) */
  latencyWindowSize?: number;
  /** Maximum concurrent requests per provider (default: 10) */
  maxConcurrentPerProvider?: number;
}

export interface ProviderHealthSnapshot {
  provider: string;
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  openUntil: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  totalRequests: number;
  totalFailures: number;
  currentConcurrent: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_OPEN_DURATION_MS = 30_000;
const DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD = 2;
const DEFAULT_LATENCY_WINDOW_SIZE = 50;
const DEFAULT_MAX_CONCURRENT = 10;

// ---------------------------------------------------------------------------
// Internal state per provider
// ---------------------------------------------------------------------------

interface ProviderState {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  openUntil: number | null;
  latencies: number[];
  totalRequests: number;
  totalFailures: number;
  currentConcurrent: number;
}

// ---------------------------------------------------------------------------
// ProviderHealthTracker class
// ---------------------------------------------------------------------------

interface ProviderHealthEvents {
  'circuit:opened': (provider: string, failures: number) => void;
  'circuit:half_open': (provider: string) => void;
  'circuit:closed': (provider: string) => void;
  'latency:recorded': (provider: string, latencyMs: number) => void;
  'concurrency:rejected': (
    provider: string,
    current: number,
    max: number
  ) => void;
}

export class ProviderHealthTracker extends EventEmitter<ProviderHealthEvents> {
  private readonly states: Map<string, ProviderState> = new Map();
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly latencyWindowSize: number;
  private readonly maxConcurrent: number;

  constructor(config?: ProviderHealthConfig) {
    super();
    this.failureThreshold =
      config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.openDurationMs = config?.openDurationMs ?? DEFAULT_OPEN_DURATION_MS;
    this.halfOpenSuccessThreshold =
      config?.halfOpenSuccessThreshold ?? DEFAULT_HALF_OPEN_SUCCESS_THRESHOLD;
    this.latencyWindowSize =
      config?.latencyWindowSize ?? DEFAULT_LATENCY_WINDOW_SIZE;
    this.maxConcurrent =
      config?.maxConcurrentPerProvider ?? DEFAULT_MAX_CONCURRENT;
  }

  // -------------------------------------------------------------------------
  // Circuit breaker queries
  // -------------------------------------------------------------------------

  /**
   * Check whether a provider is available for requests.
   * Handles the open -> half-open transition automatically.
   */
  isAvailable(provider: string): boolean {
    const state = this.getState(provider);
    const now = Date.now();

    if (state.state === 'closed') {
      return true;
    }

    if (state.state === 'open') {
      if (state.openUntil !== null && now >= state.openUntil) {
        // Transition to half-open
        state.state = 'half_open';
        state.consecutiveSuccesses = 0;
        this.emit('circuit:half_open', provider);
        return true;
      }
      return false;
    }

    // half_open: allow requests through (probe)
    return true;
  }

  /**
   * Get the current circuit state for a provider.
   */
  getCircuitState(provider: string): CircuitState {
    // Trigger automatic state transitions
    this.isAvailable(provider);
    return this.getState(provider).state;
  }

  // -------------------------------------------------------------------------
  // Request lifecycle tracking
  // -------------------------------------------------------------------------

  /**
   * Record the start of a request. Returns false if the concurrency limit
   * is exceeded and the request should be rejected.
   */
  acquireSlot(provider: string): boolean {
    const state = this.getState(provider);
    if (state.currentConcurrent >= this.maxConcurrent) {
      this.emit(
        'concurrency:rejected',
        provider,
        state.currentConcurrent,
        this.maxConcurrent
      );
      return false;
    }
    state.currentConcurrent++;
    return true;
  }

  /**
   * Release a concurrency slot after a request completes (success or failure).
   */
  releaseSlot(provider: string): void {
    const state = this.getState(provider);
    state.currentConcurrent = Math.max(0, state.currentConcurrent - 1);
  }

  /**
   * Record a successful request. Resets the failure counter and may close
   * the circuit from half-open state.
   */
  recordSuccess(provider: string, latencyMs: number): void {
    const state = this.getState(provider);
    state.totalRequests++;
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses++;

    this.recordLatency(state, provider, latencyMs);

    if (state.state === 'half_open') {
      if (state.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
        state.state = 'closed';
        state.openUntil = null;
        this.emit('circuit:closed', provider);
      }
    }
  }

  /**
   * Record a failed request. Increments the failure counter and may trip
   * the circuit to open state.
   */
  recordFailure(provider: string, latencyMs?: number): void {
    const state = this.getState(provider);
    state.totalRequests++;
    state.totalFailures++;
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;

    if (typeof latencyMs === 'number') {
      this.recordLatency(state, provider, latencyMs);
    }

    if (state.state === 'half_open') {
      // Immediately trip back to open on any failure during half-open
      this.tripCircuit(state, provider);
    } else if (
      state.state === 'closed' &&
      state.consecutiveFailures >= this.failureThreshold
    ) {
      this.tripCircuit(state, provider);
    }
  }

  // -------------------------------------------------------------------------
  // Latency queries
  // -------------------------------------------------------------------------

  /**
   * Get the median (P50) latency for a provider.
   * Returns null if no latency data is available.
   */
  getLatencyP50(provider: string): number | null {
    return this.getPercentile(provider, 0.5);
  }

  /**
   * Get the P95 latency for a provider.
   */
  getLatencyP95(provider: string): number | null {
    return this.getPercentile(provider, 0.95);
  }

  /**
   * Get the P99 latency for a provider.
   */
  getLatencyP99(provider: string): number | null {
    return this.getPercentile(provider, 0.99);
  }

  /**
   * Get a complete health snapshot for a provider.
   */
  getSnapshot(provider: string): ProviderHealthSnapshot {
    // Trigger state transitions
    this.isAvailable(provider);
    const state = this.getState(provider);
    return {
      provider,
      state: state.state,
      consecutiveFailures: state.consecutiveFailures,
      consecutiveSuccesses: state.consecutiveSuccesses,
      openUntil: state.openUntil,
      latencyP50Ms: this.getLatencyP50(provider),
      latencyP95Ms: this.getLatencyP95(provider),
      latencyP99Ms: this.getLatencyP99(provider),
      totalRequests: state.totalRequests,
      totalFailures: state.totalFailures,
      currentConcurrent: state.currentConcurrent,
    };
  }

  /**
   * Get snapshots for all tracked providers.
   */
  getAllSnapshots(): ProviderHealthSnapshot[] {
    return Array.from(this.states.keys()).map(p => this.getSnapshot(p));
  }

  // -------------------------------------------------------------------------
  // Management
  // -------------------------------------------------------------------------

  /**
   * Reset a provider's circuit breaker to closed state.
   */
  resetCircuit(provider: string): void {
    const state = this.getState(provider);
    state.state = 'closed';
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses = 0;
    state.openUntil = null;
    this.emit('circuit:closed', provider);
  }

  /**
   * Clear all tracked state.
   */
  clear(): void {
    this.states.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private getState(provider: string): ProviderState {
    const normalized = provider.toLowerCase();
    let state = this.states.get(normalized);
    if (!state) {
      state = {
        state: 'closed',
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        openUntil: null,
        latencies: [],
        totalRequests: 0,
        totalFailures: 0,
        currentConcurrent: 0,
      };
      this.states.set(normalized, state);
    }
    return state;
  }

  private tripCircuit(state: ProviderState, provider: string): void {
    state.state = 'open';
    state.openUntil = Date.now() + this.openDurationMs;
    state.consecutiveSuccesses = 0;
    this.emit('circuit:opened', provider, state.consecutiveFailures);
  }

  private recordLatency(
    state: ProviderState,
    provider: string,
    latencyMs: number
  ): void {
    state.latencies.push(latencyMs);
    if (state.latencies.length > this.latencyWindowSize) {
      state.latencies.shift();
    }
    this.emit('latency:recorded', provider, latencyMs);
  }

  private getPercentile(provider: string, percentile: number): number | null {
    const state = this.states.get(provider.toLowerCase());
    if (!state || state.latencies.length === 0) {
      return null;
    }
    const sorted = [...state.latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}
