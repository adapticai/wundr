'use client';

/**
 * useDaemonStatus - React hook for monitoring orchestrator daemon health.
 *
 * Builds on top of the shared DaemonProvider connection to:
 * - Subscribe to daemon status events pushed by the server
 * - Periodically poll the daemon's health endpoint
 * - Expose online status, health data, system metrics, and active sessions
 *
 * @module hooks/use-daemon-status
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useOptionalDaemonContext } from '@/contexts/daemon-context';

import type { DaemonRawMessage } from './use-daemon-connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaemonSubsystemHealth {
  status: 'running' | 'degraded' | 'error' | 'stopped';
  lastCheckAt?: string;
  errors?: string[];
}

export interface DaemonHealthMetrics {
  totalSessionsSpawned: number;
  totalTokensUsed: number;
  averageResponseTimeMs: number;
  successRate: number;
}

export interface DaemonHealth {
  /** Overall daemon status. */
  status: 'initializing' | 'running' | 'degraded' | 'stopped';
  /** Uptime in seconds. */
  uptime: number;
  /** Number of currently active sessions. */
  activeSessions: number;
  /** Number of currently connected WebSocket clients. */
  connectedClients: number;
  /** Per-subsystem health breakdown. */
  subsystems: Record<string, DaemonSubsystemHealth>;
  /** Aggregate performance metrics. */
  metrics?: DaemonHealthMetrics;
  /** Timestamp when this status was last received. */
  receivedAt: Date;
}

export interface UseDaemonStatusOptions {
  /**
   * How often (ms) to request a fresh health status from the daemon.
   * Set to 0 to disable polling (rely on server-pushed events only).
   * Defaults to 30 000 ms.
   */
  pollIntervalMs?: number;
  /**
   * Whether to send an immediate status request on mount.
   * Defaults to true.
   */
  fetchOnMount?: boolean;
}

export interface UseDaemonStatusReturn {
  /** True when the daemon is reachable and in a running state. */
  isOnline: boolean;
  /** Full health object, or null while pending. */
  health: DaemonHealth | null;
  /** Aggregated performance metrics (alias for health.metrics). */
  metrics: DaemonHealthMetrics | null;
  /** Number of active sessions reported by the daemon. */
  activeSessions: number;
  /** Last error from the daemon connection layer. */
  error: Error | null;
  /** Whether the daemon connection is currently established. */
  isConnected: boolean;
  /** Manually trigger a health status refresh. */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDaemonStatus(msg: DaemonRawMessage): DaemonHealth | null {
  // Support both the v1 daemon_status response and v2 health.status event
  const payload =
    (msg.data as Record<string, unknown> | undefined) ??
    (msg as Record<string, unknown>);

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  return {
    status: (payload.status as DaemonHealth['status']) ?? 'stopped',
    uptime:
      typeof payload.uptime === 'number'
        ? payload.uptime
        : typeof payload.uptimeSeconds === 'number'
          ? payload.uptimeSeconds
          : 0,
    activeSessions:
      typeof payload.activeSessions === 'number' ? payload.activeSessions : 0,
    connectedClients:
      typeof payload.connectedClients === 'number'
        ? payload.connectedClients
        : 0,
    subsystems:
      payload.subsystems != null &&
      typeof payload.subsystems === 'object' &&
      !Array.isArray(payload.subsystems)
        ? (payload.subsystems as Record<string, DaemonSubsystemHealth>)
        : {},
    metrics:
      payload.metrics != null && typeof payload.metrics === 'object'
        ? (payload.metrics as DaemonHealthMetrics)
        : undefined,
    receivedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * Hook for monitoring daemon health and system status.
 *
 * Subscribes to `daemon_status` and `health_check_response` messages from
 * the shared daemon connection and periodically requests fresh status.
 *
 * Falls back gracefully when no DaemonProvider is present (returns offline
 * state with a null health object).
 *
 * @example
 * ```tsx
 * function DaemonStatusBadge() {
 *   const { isOnline, health, activeSessions } = useDaemonStatus();
 *
 *   return (
 *     <div>
 *       <span>{isOnline ? 'Online' : 'Offline'}</span>
 *       <span>{activeSessions} active sessions</span>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDaemonStatus(
  options: UseDaemonStatusOptions = {}
): UseDaemonStatusReturn {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, fetchOnMount = true } =
    options;

  const daemonCtx = useOptionalDaemonContext();

  const [health, setHealth] = useState<DaemonHealth | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Status request helper
  // ---------------------------------------------------------------------------

  const requestStatus = useCallback(() => {
    if (!daemonCtx?.isConnected) {
      return;
    }
    try {
      // Send v1-style daemon_status request; the server will respond with
      // a `daemon_status` message. Also send a health_check for servers
      // that speak the simpler health protocol.
      daemonCtx.sendMessage({ type: 'daemon_status' });
      daemonCtx.sendMessage({ type: 'health_check' });
    } catch {
      // Connection may have closed between the isConnected check and send
    }
  }, [daemonCtx]);

  // ---------------------------------------------------------------------------
  // Subscribe to pushed status events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!daemonCtx) {
      return;
    }

    const handleStatus = (msg: DaemonRawMessage) => {
      const parsed = parseDaemonStatus(msg);
      if (parsed) {
        setHealth(parsed);
      }
    };

    // Listen for both v1 and v2 event names
    const unsub1 = daemonCtx.subscribe('daemon_status', handleStatus);
    const unsub2 = daemonCtx.subscribe('health_check_response', handleStatus);
    const unsub3 = daemonCtx.subscribe('health.status', handleStatus);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [daemonCtx]);

  // ---------------------------------------------------------------------------
  // Initial fetch + polling
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!daemonCtx?.isConnected) {
      return;
    }

    if (fetchOnMount) {
      requestStatus();
    }

    if (pollIntervalMs > 0) {
      pollTimerRef.current = setInterval(requestStatus, pollIntervalMs);
    }

    return () => {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [daemonCtx?.isConnected, fetchOnMount, pollIntervalMs, requestStatus]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isOnline =
    (daemonCtx?.isConnected ?? false) &&
    health !== null &&
    (health.status === 'running' || health.status === 'degraded');

  return {
    isOnline,
    health,
    metrics: health?.metrics ?? null,
    activeSessions: health?.activeSessions ?? 0,
    error: daemonCtx?.error ?? null,
    isConnected: daemonCtx?.isConnected ?? false,
    refresh: requestStatus,
  };
}
