/**
 * Tests for ProviderHealthTracker (src/models/provider-health.ts).
 *
 * Covers:
 *  - Three-state circuit breaker (closed -> open -> half-open -> closed)
 *  - State transitions on consecutive failures exceeding threshold
 *  - State transitions on success in half-open state
 *  - Immediate re-open on failure during half-open
 *  - Open -> half-open transition after timeout expiry
 *  - Concurrency slot acquisition and release
 *  - Latency percentile tracking (P50, P95, P99)
 *  - Health snapshot generation
 *  - Manual circuit reset
 *  - Provider name case-insensitivity
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ProviderHealthTracker } from '../../../models/provider-health';


describe('ProviderHealthTracker', () => {
  let tracker: ProviderHealthTracker;

  afterEach(() => {
    tracker?.clear();
  });

  // ---------------------------------------------------------------------------
  // Circuit breaker: three-state model
  // ---------------------------------------------------------------------------

  describe('circuit breaker states', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({
        failureThreshold: 3,
        openDurationMs: 5_000,
        halfOpenSuccessThreshold: 2,
      });
    });

    it('should start in closed state for a new provider', () => {
      expect(tracker.getCircuitState('openai')).toBe('closed');
      expect(tracker.isAvailable('openai')).toBe(true);
    });

    it('should remain closed when failures are below the threshold', () => {
      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);

      expect(tracker.getCircuitState('openai')).toBe('closed');
      expect(tracker.isAvailable('openai')).toBe(true);
    });

    it('should transition from closed to open when failures meet the threshold', () => {
      const openedSpy = vi.fn();
      tracker.on('circuit:opened', openedSpy);

      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);

      expect(tracker.getCircuitState('openai')).toBe('open');
      expect(tracker.isAvailable('openai')).toBe(false);
      expect(openedSpy).toHaveBeenCalledOnce();
      expect(openedSpy).toHaveBeenCalledWith('openai', 3);
    });

    it('should transition from open to half-open after the open duration expires', () => {
      const halfOpenSpy = vi.fn();
      tracker.on('circuit:half_open', halfOpenSpy);

      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('openai', 100);
      }
      expect(tracker.isAvailable('openai')).toBe(false);

      // Advance time past the open duration
      vi.useFakeTimers();
      vi.advanceTimersByTime(5_001);

      expect(tracker.isAvailable('openai')).toBe(true);
      expect(tracker.getCircuitState('openai')).toBe('half_open');
      expect(halfOpenSpy).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it('should remain open before the duration expires', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('openai', 100);
      }

      // Not yet expired
      vi.advanceTimersByTime(4_999);
      expect(tracker.isAvailable('openai')).toBe(false);

      vi.useRealTimers();
    });

    it('should close the circuit after enough successes in half-open state', () => {
      const closedSpy = vi.fn();
      tracker.on('circuit:closed', closedSpy);

      // Trip to open
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('openai', 100);
      }

      // Move to half-open
      vi.useFakeTimers();
      vi.advanceTimersByTime(5_001);
      tracker.isAvailable('openai'); // trigger transition

      // Record 2 successes (halfOpenSuccessThreshold = 2)
      tracker.recordSuccess('openai', 200);
      expect(tracker.getCircuitState('openai')).toBe('half_open');

      tracker.recordSuccess('openai', 200);
      expect(tracker.getCircuitState('openai')).toBe('closed');
      expect(closedSpy).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it('should re-open the circuit on any failure during half-open', () => {
      const openedSpy = vi.fn();
      tracker.on('circuit:opened', openedSpy);

      // Trip to open
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('openai', 100);
      }
      expect(openedSpy).toHaveBeenCalledOnce();

      // Move to half-open
      vi.useFakeTimers();
      vi.advanceTimersByTime(5_001);
      tracker.isAvailable('openai');

      // One success, then a failure
      tracker.recordSuccess('openai', 200);
      tracker.recordFailure('openai', 300);

      expect(tracker.getCircuitState('openai')).toBe('open');
      // opened fired again for the re-trip
      expect(openedSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should reset consecutive failures on success', () => {
      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);
      // 2 failures, threshold is 3
      tracker.recordSuccess('openai', 200);

      // Now failures reset; need 3 more to trip
      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);
      expect(tracker.getCircuitState('openai')).toBe('closed');

      tracker.recordFailure('openai', 100);
      expect(tracker.getCircuitState('openai')).toBe('open');
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrency slot management
  // ---------------------------------------------------------------------------

  describe('concurrency slots', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({
        maxConcurrentPerProvider: 3,
      });
    });

    it('should allow acquiring slots up to the limit', () => {
      expect(tracker.acquireSlot('anthropic')).toBe(true);
      expect(tracker.acquireSlot('anthropic')).toBe(true);
      expect(tracker.acquireSlot('anthropic')).toBe(true);
    });

    it('should reject slot acquisition when the limit is reached', () => {
      const rejectedSpy = vi.fn();
      tracker.on('concurrency:rejected', rejectedSpy);

      tracker.acquireSlot('anthropic');
      tracker.acquireSlot('anthropic');
      tracker.acquireSlot('anthropic');

      expect(tracker.acquireSlot('anthropic')).toBe(false);
      expect(rejectedSpy).toHaveBeenCalledOnce();
      expect(rejectedSpy).toHaveBeenCalledWith('anthropic', 3, 3);
    });

    it('should allow re-acquisition after releasing a slot', () => {
      tracker.acquireSlot('anthropic');
      tracker.acquireSlot('anthropic');
      tracker.acquireSlot('anthropic');

      expect(tracker.acquireSlot('anthropic')).toBe(false);

      tracker.releaseSlot('anthropic');
      expect(tracker.acquireSlot('anthropic')).toBe(true);
    });

    it('should not let concurrent count go below zero', () => {
      tracker.releaseSlot('google');
      tracker.releaseSlot('google');

      const snapshot = tracker.getSnapshot('google');
      expect(snapshot.currentConcurrent).toBe(0);
    });

    it('should track concurrency independently per provider', () => {
      tracker.acquireSlot('openai');
      tracker.acquireSlot('openai');
      tracker.acquireSlot('openai');

      expect(tracker.acquireSlot('openai')).toBe(false);
      // Different provider should be fine
      expect(tracker.acquireSlot('anthropic')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Latency tracking
  // ---------------------------------------------------------------------------

  describe('latency percentiles', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({
        latencyWindowSize: 10,
      });
    });

    it('should return null when no latency data exists', () => {
      expect(tracker.getLatencyP50('anthropic')).toBeNull();
      expect(tracker.getLatencyP95('anthropic')).toBeNull();
      expect(tracker.getLatencyP99('anthropic')).toBeNull();
    });

    it('should compute P50 correctly for a small sample', () => {
      // Record latencies 100..500
      tracker.recordSuccess('openai', 100);
      tracker.recordSuccess('openai', 200);
      tracker.recordSuccess('openai', 300);
      tracker.recordSuccess('openai', 400);
      tracker.recordSuccess('openai', 500);

      // Sorted: [100, 200, 300, 400, 500]
      // P50 index = ceil(5 * 0.5) - 1 = 2 => value 300
      expect(tracker.getLatencyP50('openai')).toBe(300);
    });

    it('should compute P95 correctly', () => {
      for (let i = 1; i <= 10; i++) {
        tracker.recordSuccess('openai', i * 100);
      }
      // Sorted: [100, 200, ..., 1000]
      // P95 index = ceil(10 * 0.95) - 1 = 9 => value 1000
      expect(tracker.getLatencyP95('openai')).toBe(1000);
    });

    it('should respect the rolling window size', () => {
      // Window size is 10; push 12 entries
      for (let i = 1; i <= 12; i++) {
        tracker.recordSuccess('openai', i * 100);
      }
      // Oldest 2 (100, 200) should be evicted
      // Remaining: [300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]
      // P50 index = ceil(10 * 0.5) - 1 = 4 => sorted[4] = 700
      expect(tracker.getLatencyP50('openai')).toBe(700);
    });

    it('should emit latency:recorded events', () => {
      const spy = vi.fn();
      tracker.on('latency:recorded', spy);

      tracker.recordSuccess('openai', 150);
      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith('openai', 150);
    });
  });

  // ---------------------------------------------------------------------------
  // Health snapshot
  // ---------------------------------------------------------------------------

  describe('getSnapshot', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({
        failureThreshold: 3,
        openDurationMs: 5_000,
      });
    });

    it('should return a complete snapshot for a new provider', () => {
      const snapshot = tracker.getSnapshot('google');

      expect(snapshot.provider).toBe('google');
      expect(snapshot.state).toBe('closed');
      expect(snapshot.consecutiveFailures).toBe(0);
      expect(snapshot.consecutiveSuccesses).toBe(0);
      expect(snapshot.openUntil).toBeNull();
      expect(snapshot.latencyP50Ms).toBeNull();
      expect(snapshot.latencyP95Ms).toBeNull();
      expect(snapshot.latencyP99Ms).toBeNull();
      expect(snapshot.totalRequests).toBe(0);
      expect(snapshot.totalFailures).toBe(0);
      expect(snapshot.currentConcurrent).toBe(0);
    });

    it('should reflect accumulated stats in the snapshot', () => {
      tracker.recordSuccess('google', 100);
      tracker.recordSuccess('google', 200);
      tracker.recordFailure('google', 300);

      const snapshot = tracker.getSnapshot('google');
      expect(snapshot.totalRequests).toBe(3);
      expect(snapshot.totalFailures).toBe(1);
      expect(snapshot.consecutiveFailures).toBe(1);
      expect(snapshot.consecutiveSuccesses).toBe(0);
      expect(snapshot.latencyP50Ms).not.toBeNull();
    });

    it('should include openUntil when circuit is open', () => {
      for (let i = 0; i < 3; i++) {
        tracker.recordFailure('google', 100);
      }
      const snapshot = tracker.getSnapshot('google');
      expect(snapshot.state).toBe('open');
      expect(snapshot.openUntil).toBeTypeOf('number');
      expect(snapshot.openUntil! > Date.now()).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // getAllSnapshots
  // ---------------------------------------------------------------------------

  describe('getAllSnapshots', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker();
    });

    it('should return snapshots for all tracked providers', () => {
      tracker.recordSuccess('openai', 100);
      tracker.recordSuccess('anthropic', 200);
      tracker.recordSuccess('google', 300);

      const snapshots = tracker.getAllSnapshots();
      expect(snapshots).toHaveLength(3);
      const names = snapshots.map((s) => s.provider);
      expect(names).toContain('openai');
      expect(names).toContain('anthropic');
      expect(names).toContain('google');
    });
  });

  // ---------------------------------------------------------------------------
  // Manual reset
  // ---------------------------------------------------------------------------

  describe('resetCircuit', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({
        failureThreshold: 2,
      });
    });

    it('should reset an open circuit back to closed', () => {
      const closedSpy = vi.fn();
      tracker.on('circuit:closed', closedSpy);

      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);
      expect(tracker.getCircuitState('openai')).toBe('open');

      tracker.resetCircuit('openai');
      expect(tracker.getCircuitState('openai')).toBe('closed');
      expect(tracker.isAvailable('openai')).toBe(true);
      expect(closedSpy).toHaveBeenCalledOnce();
    });

    it('should reset failure counters', () => {
      tracker.recordFailure('openai', 100);
      tracker.recordFailure('openai', 100);
      tracker.resetCircuit('openai');

      // After reset, need failureThreshold failures again to trip
      tracker.recordFailure('openai', 100);
      expect(tracker.getCircuitState('openai')).toBe('closed');
    });
  });

  // ---------------------------------------------------------------------------
  // Case insensitivity
  // ---------------------------------------------------------------------------

  describe('provider name normalization', () => {
    beforeEach(() => {
      tracker = new ProviderHealthTracker({ failureThreshold: 2 });
    });

    it('should treat provider names as case-insensitive', () => {
      tracker.recordFailure('OpenAI', 100);
      tracker.recordFailure('openai', 100);

      expect(tracker.getCircuitState('OPENAI')).toBe('open');
      expect(tracker.isAvailable('openai')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all tracked state', () => {
      tracker = new ProviderHealthTracker();
      tracker.recordSuccess('openai', 100);
      tracker.recordSuccess('anthropic', 200);

      tracker.clear();

      const snapshots = tracker.getAllSnapshots();
      expect(snapshots).toHaveLength(0);
    });
  });
});
