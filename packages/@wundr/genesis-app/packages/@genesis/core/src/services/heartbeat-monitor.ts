/**
 * @genesis/core - Heartbeat Monitor
 *
 * Background service for monitoring VP daemon health and triggering
 * recovery actions when heartbeats are missed.
 *
 * @packageDocumentation
 */

import type { PrismaClient } from '@genesis/database';
import { prisma } from '@genesis/database';

import type {
  HealthStatus,
  HeartbeatConfig,
  OnVPUnhealthyCallback,
  OnVPRecoveredCallback,
} from '../types/heartbeat';
import {
  DEFAULT_HEARTBEAT_CONFIG,
  HEARTBEAT_REDIS_KEYS,
} from '../types/heartbeat';
import type { RedisClient, HeartbeatService } from './heartbeat-service';
import { createHeartbeatService } from './heartbeat-service';

// =============================================================================
// Heartbeat Monitor Interface
// =============================================================================

/**
 * Interface for heartbeat monitor operations.
 */
export interface HeartbeatMonitorService {
  /**
   * Starts the periodic health monitoring.
   *
   * @param intervalMs - Check interval in milliseconds (default from config)
   */
  startMonitoring(intervalMs?: number): void;

  /**
   * Stops the periodic health monitoring.
   */
  stopMonitoring(): void;

  /**
   * Registers a callback for VP unhealthy events.
   *
   * @param callback - Function to call when a VP becomes unhealthy
   */
  onVPUnhealthy(callback: OnVPUnhealthyCallback): void;

  /**
   * Registers a callback for VP recovered events.
   *
   * @param callback - Function to call when a VP recovers
   */
  onVPRecovered(callback: OnVPRecoveredCallback): void;

  /**
   * Manually checks all registered VPs.
   *
   * @returns Map of VP ID to health status
   */
  checkAllVPs(): Promise<Map<string, HealthStatus>>;

  /**
   * Checks VPs for a specific organization.
   *
   * @param orgId - Organization ID
   * @returns Map of VP ID to health status
   */
  checkOrganizationVPs(orgId: string): Promise<Map<string, HealthStatus>>;

  /**
   * Gets the current monitoring status.
   *
   * @returns Whether monitoring is active
   */
  isMonitoring(): boolean;

  /**
   * Gets statistics about the monitor.
   *
   * @returns Monitor statistics
   */
  getStats(): MonitorStats;
}

/**
 * Statistics about the heartbeat monitor.
 */
export interface MonitorStats {
  /** Whether the monitor is currently running */
  isRunning: boolean;

  /** Number of check cycles completed */
  checkCycles: number;

  /** Last check timestamp */
  lastCheck?: Date;

  /** Number of VPs currently being monitored */
  monitoredVPs: number;

  /** Number of currently unhealthy VPs */
  unhealthyVPs: number;

  /** Number of VPs in recovery */
  recoveringVPs: number;

  /** Total unhealthy events triggered */
  totalUnhealthyEvents: number;

  /** Total recovery events triggered */
  totalRecoveryEvents: number;
}

// =============================================================================
// Heartbeat Monitor Implementation
// =============================================================================

/**
 * Heartbeat monitor implementation for background health checking.
 */
export class HeartbeatMonitor implements HeartbeatMonitorService {
  private readonly redis: RedisClient;
  private readonly heartbeatService: HeartbeatService;
  private readonly config: HeartbeatConfig;
  private readonly db: PrismaClient;

  private monitorInterval: NodeJS.Timeout | null = null;
  private unhealthyCallbacks: OnVPUnhealthyCallback[] = [];
  private recoveredCallbacks: OnVPRecoveredCallback[] = [];

  // Track VP states for detecting transitions
  private vpStates: Map<string, HealthStatus> = new Map();

  // Recovery tracking
  private recoveryHeartbeats: Map<string, number> = new Map();

  // Statistics
  private stats: MonitorStats = {
    isRunning: false,
    checkCycles: 0,
    monitoredVPs: 0,
    unhealthyVPs: 0,
    recoveringVPs: 0,
    totalUnhealthyEvents: 0,
    totalRecoveryEvents: 0,
  };

  /**
   * Creates a new HeartbeatMonitor instance.
   *
   * @param redis - Redis client for heartbeat storage
   * @param config - Optional heartbeat configuration
   * @param database - Optional Prisma client
   */
  constructor(
    redis: RedisClient,
    config?: Partial<HeartbeatConfig>,
    database?: PrismaClient
  ) {
    this.redis = redis;
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.db = database ?? prisma;
    this.heartbeatService = createHeartbeatService(redis, config, database);
  }

  // ===========================================================================
  // Monitoring Control
  // ===========================================================================

  /**
   * Starts the periodic health monitoring.
   */
  startMonitoring(intervalMs?: number): void {
    if (this.monitorInterval) {
      return; // Already monitoring
    }

    const interval = intervalMs ?? this.config.monitorIntervalMs;

    this.monitorInterval = setInterval(async () => {
      await this.runHealthCheck();
    }, interval);

    this.stats.isRunning = true;

    // Run an immediate check
    void this.runHealthCheck();
  }

  /**
   * Stops the periodic health monitoring.
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.stats.isRunning = false;
  }

  /**
   * Checks if monitoring is active.
   */
  isMonitoring(): boolean {
    return this.stats.isRunning;
  }

  // ===========================================================================
  // Event Callbacks
  // ===========================================================================

  /**
   * Registers a callback for VP unhealthy events.
   */
  onVPUnhealthy(callback: OnVPUnhealthyCallback): void {
    this.unhealthyCallbacks.push(callback);
  }

  /**
   * Registers a callback for VP recovered events.
   */
  onVPRecovered(callback: OnVPRecoveredCallback): void {
    this.recoveredCallbacks.push(callback);
  }

  // ===========================================================================
  // Health Checking
  // ===========================================================================

  /**
   * Manually checks all registered VPs.
   */
  async checkAllVPs(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    // Get all registered VP IDs
    const vpIds = await this.redis.smembers(HEARTBEAT_REDIS_KEYS.registeredVPs());

    // Check each VP
    for (const vpId of vpIds) {
      const health = await this.heartbeatService.checkHealth(vpId);
      results.set(vpId, health);
    }

    return results;
  }

  /**
   * Checks VPs for a specific organization.
   */
  async checkOrganizationVPs(orgId: string): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    // Get VP IDs for this organization
    const vpIds = await this.redis.smembers(HEARTBEAT_REDIS_KEYS.orgVPs(orgId));

    // Check each VP
    for (const vpId of vpIds) {
      const health = await this.heartbeatService.checkHealth(vpId);
      results.set(vpId, health);
    }

    return results;
  }

  /**
   * Gets monitor statistics.
   */
  getStats(): MonitorStats {
    return { ...this.stats };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Runs a health check cycle.
   */
  private async runHealthCheck(): Promise<void> {
    const healthResults = await this.checkAllVPs();

    let unhealthyCount = 0;
    let recoveringCount = 0;

    for (const [vpId, health] of Array.from(healthResults.entries())) {
      const previousState = this.vpStates.get(vpId);

      // Track unhealthy VPs
      if (!health.healthy) {
        unhealthyCount++;
      }

      // Track recovering VPs
      if (health.status === 'recovering') {
        recoveringCount++;
      }

      // Detect state transitions
      await this.handleStateTransition(vpId, previousState, health);

      // Update stored state
      this.vpStates.set(vpId, health);
    }

    // Update statistics
    this.stats.checkCycles++;
    this.stats.lastCheck = new Date();
    this.stats.monitoredVPs = healthResults.size;
    this.stats.unhealthyVPs = unhealthyCount;
    this.stats.recoveringVPs = recoveringCount;
  }

  /**
   * Handles state transitions and triggers callbacks.
   */
  private async handleStateTransition(
    vpId: string,
    previousState: HealthStatus | undefined,
    currentState: HealthStatus
  ): Promise<void> {
    const wasHealthy = previousState?.healthy ?? true;
    const wasUnhealthy = previousState?.status === 'unhealthy';
    // Note: wasRecovering could be used for additional state transition logic
    void previousState?.status; // Acknowledge we may use previousState.status for 'recovering'

    // Transition to unhealthy
    if (wasHealthy && !currentState.healthy) {
      await this.triggerUnhealthyEvent(vpId, currentState);
    }

    // Transition from unhealthy to recovering
    if (wasUnhealthy && currentState.status === 'recovering') {
      // Start tracking recovery heartbeats
      this.recoveryHeartbeats.set(vpId, 1);
      await this.heartbeatService.markRecovering(vpId);
    }

    // During recovery, track heartbeats
    if (currentState.status === 'recovering') {
      const heartbeatCount = this.recoveryHeartbeats.get(vpId) ?? 0;

      if (currentState.healthy) {
        // Received a heartbeat during recovery
        const newCount = heartbeatCount + 1;
        this.recoveryHeartbeats.set(vpId, newCount);

        // Check if recovery threshold met
        if (newCount >= this.config.recoveryThreshold) {
          await this.triggerRecoveredEvent(vpId);
          this.recoveryHeartbeats.delete(vpId);
          await this.heartbeatService.markRecovered(vpId);
        }
      } else {
        // Missed heartbeat during recovery - reset counter
        this.recoveryHeartbeats.set(vpId, 0);
      }
    }

    // Auto-deactivate if configured
    if (
      this.config.autoDeactivate &&
      !currentState.healthy &&
      currentState.missedHeartbeats >= this.config.unhealthyThreshold * 2
    ) {
      await this.deactivateVP(vpId);
    }
  }

  /**
   * Triggers unhealthy event callbacks.
   */
  private async triggerUnhealthyEvent(vpId: string, status: HealthStatus): Promise<void> {
    this.stats.totalUnhealthyEvents++;

    // Update VP status in database
    await this.db.vP.update({
      where: { id: vpId },
      data: { status: 'AWAY' }, // Set to AWAY for unhealthy
    }).catch(() => {
      // Ignore errors if VP doesn't exist
    });

    // Call all registered callbacks
    for (const callback of this.unhealthyCallbacks) {
      try {
        await callback(vpId, status);
      } catch (error) {
        // Log error but continue with other callbacks
        console.error(`[HeartbeatMonitor] Error in unhealthy callback for VP ${vpId}:`, error);
      }
    }
  }

  /**
   * Triggers recovered event callbacks.
   */
  private async triggerRecoveredEvent(vpId: string): Promise<void> {
    this.stats.totalRecoveryEvents++;

    // Update VP status in database
    await this.db.vP.update({
      where: { id: vpId },
      data: { status: 'ONLINE' },
    }).catch(() => {
      // Ignore errors if VP doesn't exist
    });

    // Call all registered callbacks
    for (const callback of this.recoveredCallbacks) {
      try {
        await callback(vpId);
      } catch (error) {
        // Log error but continue with other callbacks
        console.error(`[HeartbeatMonitor] Error in recovered callback for VP ${vpId}:`, error);
      }
    }
  }

  /**
   * Deactivates an unhealthy VP.
   */
  private async deactivateVP(vpId: string): Promise<void> {
    await this.db.vP.update({
      where: { id: vpId },
      data: { status: 'OFFLINE' },
    }).catch(() => {
      // Ignore errors if VP doesn't exist
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new heartbeat monitor instance.
 *
 * @param redis - Redis client for storage
 * @param config - Optional heartbeat configuration
 * @param database - Optional Prisma client
 * @returns Heartbeat monitor instance
 *
 * @example
 * ```typescript
 * import { createHeartbeatMonitor } from '@genesis/core';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis();
 * const monitor = createHeartbeatMonitor(redis, {
 *   monitorIntervalMs: 30000,
 *   unhealthyThreshold: 3,
 *   autoDeactivate: true,
 * });
 *
 * // Register callbacks
 * monitor.onVPUnhealthy((vpId, status) => {
 *   console.log(`VP ${vpId} is unhealthy:`, status);
 *   // Send notification, trigger alert, etc.
 * });
 *
 * monitor.onVPRecovered((vpId) => {
 *   console.log(`VP ${vpId} has recovered`);
 * });
 *
 * // Start monitoring
 * monitor.startMonitoring();
 *
 * // Later, stop monitoring
 * // monitor.stopMonitoring();
 * ```
 */
export function createHeartbeatMonitor(
  redis: RedisClient,
  config?: Partial<HeartbeatConfig>,
  database?: PrismaClient
): HeartbeatMonitor {
  return new HeartbeatMonitor(redis, config, database);
}
