/**
 * DaemonHealthMonitor
 *
 * Polls and subscribes to daemon health events, providing a simple interface
 * for checking daemon health, retrieving status and metrics, and reacting to
 * health state transitions.
 */

import type { DaemonClient } from './daemon-client.js';
import type {
  HealthMetrics,
  HealthPingParams,
  HealthPongPayload,
  HealthStatusPayload,
  HeartbeatPayload,
} from './protocol.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DaemonHealthStatus = HealthStatusPayload['status'];

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  status: DaemonHealthStatus;
  timestamp: number;
}

export interface DaemonStatusSnapshot extends HealthStatusPayload {
  /** Client-side timestamp of when this snapshot was taken. */
  capturedAt: number;
}

export type HealthChangeCallback = (
  current: DaemonHealthStatus,
  previous: DaemonHealthStatus | null
) => void;

export interface HealthMonitorOptions {
  /**
   * How often (ms) to automatically poll daemon health status.
   * Set to 0 to disable automatic polling.
   * @default 60_000
   */
  pollIntervalMs?: number;
  /**
   * How many status snapshots to retain in the in-memory history.
   * @default 20
   */
  historyLimit?: number;
}

// ---------------------------------------------------------------------------
// DaemonHealthMonitor
// ---------------------------------------------------------------------------

export class DaemonHealthMonitor {
  private client: DaemonClient;
  private opts: Required<HealthMonitorOptions>;

  private lastStatus: DaemonHealthStatus | null = null;
  private statusHistory: DaemonStatusSnapshot[] = [];
  private healthChangeCallbacks = new Set<HealthChangeCallback>();

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatUnsubscribe: (() => void) | null = null;
  private statusEventUnsubscribe: (() => void) | null = null;

  constructor(client: DaemonClient, opts: HealthMonitorOptions = {}) {
    this.client = client;
    this.opts = {
      pollIntervalMs: opts.pollIntervalMs ?? 60_000,
      historyLimit: opts.historyLimit ?? 20,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Perform an immediate health ping and return the result.
   * Measures round-trip latency.
   */
  async getHealth(): Promise<HealthCheckResult> {
    const clientTimestamp = Date.now();
    const params: HealthPingParams = { clientTimestamp };

    const pong = await this.client.sendMessage<HealthPongPayload>(
      'health.ping',
      params
    );

    const latencyMs = Date.now() - clientTimestamp;

    // Attempt a quick status check to report the daemon's current health tier.
    let status: DaemonHealthStatus = 'running';
    try {
      const snapshot = await this.fetchStatus();
      status = snapshot.status;
    } catch {
      // Non-fatal; the ping already succeeded.
    }

    return {
      healthy: true,
      latencyMs,
      status,
      timestamp: pong.serverTimestamp,
    };
  }

  /**
   * Retrieve the full daemon status including subsystem health and metrics.
   */
  async getDaemonStatus(): Promise<DaemonStatusSnapshot> {
    const snapshot = await this.fetchStatus();
    this.recordSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Retrieve daemon performance metrics only.
   * Returns null if the daemon has not reported metrics yet.
   */
  async getMetrics(): Promise<HealthMetrics | null> {
    const snapshot = await this.fetchStatus();
    return snapshot.metrics ?? null;
  }

  /**
   * Register a callback that fires whenever the daemon's health status
   * transitions to a new value (e.g. "running" -> "degraded").
   *
   * @returns  Unsubscribe function.
   */
  onHealthChange(callback: HealthChangeCallback): () => void {
    this.healthChangeCallbacks.add(callback);
    return () => this.healthChangeCallbacks.delete(callback);
  }

  /**
   * Start automatic polling and server-event listening.
   * Safe to call multiple times; subsequent calls are no-ops.
   */
  start(): void {
    this.startPolling();
    this.subscribeToServerEvents();
  }

  /**
   * Stop automatic polling and remove server-event listeners.
   */
  stop(): void {
    this.stopPolling();
    this.unsubscribeFromServerEvents();
  }

  /**
   * Return all retained status snapshots, ordered oldest to newest.
   */
  getHistory(): DaemonStatusSnapshot[] {
    return [...this.statusHistory];
  }

  /**
   * Return the most recently observed health status, or null if no check has
   * been performed yet.
   */
  getLastKnownStatus(): DaemonHealthStatus | null {
    return this.lastStatus;
  }

  // -------------------------------------------------------------------------
  // Automatic polling
  // -------------------------------------------------------------------------

  private startPolling(): void {
    if (this.pollTimer !== null || this.opts.pollIntervalMs <= 0) return;

    // Immediate first check.
    void this.poll();

    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.opts.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const snapshot = await this.fetchStatus();
      this.recordSnapshot(snapshot);
    } catch (err) {
      console.error('[DaemonHealthMonitor] Poll failed:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Server-event subscription
  // -------------------------------------------------------------------------

  private subscribeToServerEvents(): void {
    if (this.heartbeatUnsubscribe === null) {
      this.heartbeatUnsubscribe = this.client.subscribe<HeartbeatPayload>(
        'health.heartbeat',
        payload => {
          // A heartbeat arriving means the server is alive.
          // If we have no status yet, optimistically record "running".
          if (this.lastStatus === null) {
            this.applyStatus('running');
          }
          // Emit to listeners only if they want low-level heartbeat data.
          // For now we just use this as a liveness signal.
          void payload;
        }
      );
    }

    if (this.statusEventUnsubscribe === null) {
      // Some server implementations push a full health.status event on change.
      this.statusEventUnsubscribe = this.client.subscribe<
        Partial<HealthStatusPayload>
      >('health.status', payload => {
        if (payload.status) {
          this.applyStatus(payload.status);
        }
        if (isFullStatusPayload(payload)) {
          const snapshot: DaemonStatusSnapshot = {
            ...payload,
            capturedAt: Date.now(),
          };
          this.recordSnapshot(snapshot);
        }
      });
    }
  }

  private unsubscribeFromServerEvents(): void {
    this.heartbeatUnsubscribe?.();
    this.heartbeatUnsubscribe = null;
    this.statusEventUnsubscribe?.();
    this.statusEventUnsubscribe = null;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async fetchStatus(): Promise<DaemonStatusSnapshot> {
    const payload =
      await this.client.sendMessage<HealthStatusPayload>('health.status');
    return { ...payload, capturedAt: Date.now() };
  }

  private recordSnapshot(snapshot: DaemonStatusSnapshot): void {
    this.statusHistory.push(snapshot);
    if (this.statusHistory.length > this.opts.historyLimit) {
      this.statusHistory.shift();
    }
    this.applyStatus(snapshot.status);
  }

  private applyStatus(newStatus: DaemonHealthStatus): void {
    const previous = this.lastStatus;
    if (previous === newStatus) return;

    this.lastStatus = newStatus;

    for (const cb of this.healthChangeCallbacks) {
      try {
        cb(newStatus, previous);
      } catch (err) {
        console.error(
          '[DaemonHealthMonitor] Error in health change callback:',
          err
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isFullStatusPayload(
  value: Partial<HealthStatusPayload>
): value is HealthStatusPayload {
  return (
    typeof value.status === 'string' &&
    typeof value.uptime === 'number' &&
    typeof value.activeSessions === 'number' &&
    typeof value.connectedClients === 'number' &&
    typeof value.subsystems === 'object' &&
    value.subsystems !== null
  );
}
