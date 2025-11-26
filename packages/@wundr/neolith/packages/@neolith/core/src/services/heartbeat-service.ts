/**
 * @genesis/core - Heartbeat Service
 *
 * Service for managing VP daemon heartbeats, registration, and health monitoring.
 * Uses Redis for storage with automatic TTL management.
 *
 * @packageDocumentation
 */

import { prisma } from '@neolith/database';

import { GenesisError, VPNotFoundError } from '../errors';
import {
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_HEARTBEAT_METRICS,
  DEFAULT_HEALTH_STATUS,
  HEARTBEAT_REDIS_KEYS,
  isHeartbeatDaemonInfo,
} from '../types/heartbeat';

import type {
  HeartbeatDaemonInfo,
  HeartbeatMetrics,
  HeartbeatRecord,
  HealthStatus,
  HealthStatusType,
  HeartbeatConfig,
} from '../types/heartbeat';
import type { PrismaClient } from '@neolith/database';

// =============================================================================
// Redis Client Interface
// =============================================================================

/**
 * Interface for Redis client operations.
 * Allows for dependency injection and testing.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  del(key: string): Promise<void>;
  hset(key: string, field: string, value: string): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hdel(key: string, field: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zremrangebyrank(key: string, start: number, stop: number): Promise<void>;
  expire(key: string, seconds: number): Promise<void>;
  exists(key: string): Promise<number>;
}

// =============================================================================
// Heartbeat Errors
// =============================================================================

/**
 * Error thrown when heartbeat operations fail.
 */
export class HeartbeatError extends GenesisError {
  constructor(message: string, code: string, statusCode: number = 500, metadata?: Record<string, unknown>) {
    super(message, code, statusCode, metadata);
    this.name = 'HeartbeatError';
  }
}

/**
 * Error thrown when a daemon is not registered.
 */
export class DaemonNotRegisteredError extends HeartbeatError {
  constructor(vpId: string) {
    super(
      `Daemon not registered for VP: ${vpId}`,
      'DAEMON_NOT_REGISTERED',
      404,
      { vpId },
    );
    this.name = 'DaemonNotRegisteredError';
  }
}

/**
 * Error thrown when a daemon is already registered.
 */
export class DaemonAlreadyRegisteredError extends HeartbeatError {
  constructor(vpId: string) {
    super(
      `Daemon already registered for VP: ${vpId}`,
      'DAEMON_ALREADY_REGISTERED',
      409,
      { vpId },
    );
    this.name = 'DaemonAlreadyRegisteredError';
  }
}

/**
 * Error thrown when heartbeat validation fails.
 */
export class HeartbeatValidationError extends HeartbeatError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'HEARTBEAT_VALIDATION_ERROR', 400, { errors });
    this.name = 'HeartbeatValidationError';
    this.errors = errors;
  }
}

// =============================================================================
// Heartbeat Service Interface
// =============================================================================

/**
 * Interface for heartbeat service operations.
 */
export interface HeartbeatService {
  /**
   * Registers a daemon for a VP.
   *
   * @param vpId - The VP ID
   * @param daemonInfo - Information about the daemon
   * @throws {VPNotFoundError} If the VP doesn't exist
   * @throws {DaemonAlreadyRegisteredError} If a daemon is already registered
   */
  registerDaemon(vpId: string, daemonInfo: HeartbeatDaemonInfo): Promise<void>;

  /**
   * Unregisters a daemon for a VP.
   *
   * @param vpId - The VP ID
   * @throws {DaemonNotRegisteredError} If no daemon is registered
   */
  unregisterDaemon(vpId: string): Promise<void>;

  /**
   * Sends a heartbeat for a VP.
   *
   * @param vpId - The VP ID
   * @param metrics - Optional metrics to include
   * @throws {DaemonNotRegisteredError} If no daemon is registered
   */
  sendHeartbeat(vpId: string, metrics?: HeartbeatMetrics): Promise<void>;

  /**
   * Gets the last heartbeat record for a VP.
   *
   * @param vpId - The VP ID
   * @returns The last heartbeat record, or null if none exists
   */
  getLastHeartbeat(vpId: string): Promise<HeartbeatRecord | null>;

  /**
   * Checks the health status of a VP.
   *
   * @param vpId - The VP ID
   * @returns The current health status
   */
  checkHealth(vpId: string): Promise<HealthStatus>;

  /**
   * Gets all unhealthy VPs for an organization.
   *
   * @param orgId - The organization ID
   * @returns Array of unhealthy VP IDs
   */
  getUnhealthyVPs(orgId: string): Promise<string[]>;

  /**
   * Marks a VP as recovering.
   *
   * @param vpId - The VP ID
   */
  markRecovering(vpId: string): Promise<void>;

  /**
   * Marks a VP as recovered.
   *
   * @param vpId - The VP ID
   */
  markRecovered(vpId: string): Promise<void>;

  /**
   * Gets daemon info for a VP.
   *
   * @param vpId - The VP ID
   * @returns Daemon info or null if not registered
   */
  getDaemonInfo(vpId: string): Promise<HeartbeatDaemonInfo | null>;

  /**
   * Gets heartbeat history for a VP.
   *
   * @param vpId - The VP ID
   * @param limit - Maximum number of records to return
   * @returns Array of heartbeat records
   */
  getHeartbeatHistory(vpId: string, limit?: number): Promise<HeartbeatRecord[]>;
}

// =============================================================================
// Heartbeat Service Implementation
// =============================================================================

/**
 * Heartbeat service implementation using Redis for storage.
 */
export class HeartbeatServiceImpl implements HeartbeatService {
  private readonly db: PrismaClient;
  private readonly redis: RedisClient;
  private readonly config: HeartbeatConfig;
  private sequenceCounters: Map<string, number> = new Map();

  /**
   * Creates a new HeartbeatServiceImpl instance.
   *
   * @param redis - Redis client for heartbeat storage
   * @param config - Optional heartbeat configuration
   * @param database - Optional Prisma client instance
   */
  constructor(
    redis: RedisClient,
    config?: Partial<HeartbeatConfig>,
    database?: PrismaClient,
  ) {
    this.redis = redis;
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config };
    this.db = database ?? prisma;
  }

  // ===========================================================================
  // Daemon Registration
  // ===========================================================================

  /**
   * Registers a daemon for a VP.
   */
  async registerDaemon(vpId: string, daemonInfo: HeartbeatDaemonInfo): Promise<void> {
    // Validate VP exists
    const vp = await this.db.vP.findUnique({
      where: { id: vpId },
      include: { organization: true },
    });

    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Validate daemon info
    if (!isHeartbeatDaemonInfo(daemonInfo)) {
      throw new HeartbeatValidationError('Invalid daemon info', {
        daemonInfo: ['Missing required fields'],
      });
    }

    // Check if already registered
    const existingDaemon = await this.redis.get(HEARTBEAT_REDIS_KEYS.daemon(vpId));
    if (existingDaemon) {
      throw new DaemonAlreadyRegisteredError(vpId);
    }

    // Store daemon info
    const daemonData = {
      ...daemonInfo,
      startedAt: daemonInfo.startedAt.toISOString(),
      registeredAt: new Date().toISOString(),
    };

    await this.redis.set(
      HEARTBEAT_REDIS_KEYS.daemon(vpId),
      JSON.stringify(daemonData),
      { EX: this.config.heartbeatTTLSeconds * 10 }, // Longer TTL for daemon info
    );

    // Add to registered VPs set
    await this.redis.sadd(HEARTBEAT_REDIS_KEYS.registeredVPs(), vpId);
    await this.redis.sadd(HEARTBEAT_REDIS_KEYS.orgVPs(vp.organizationId), vpId);

    // Initialize health status
    const healthStatus: HealthStatus = {
      healthy: false,
      status: 'unknown',
      missedHeartbeats: 0,
    };
    await this.redis.set(
      HEARTBEAT_REDIS_KEYS.health(vpId),
      JSON.stringify(healthStatus),
      { EX: this.config.heartbeatTTLSeconds },
    );

    // Initialize sequence counter
    this.sequenceCounters.set(vpId, 0);

    // Update VP status to ONLINE
    await this.db.vP.update({
      where: { id: vpId },
      data: { status: 'ONLINE' },
    });
  }

  /**
   * Unregisters a daemon for a VP.
   */
  async unregisterDaemon(vpId: string): Promise<void> {
    // Check if registered
    const existingDaemon = await this.redis.get(HEARTBEAT_REDIS_KEYS.daemon(vpId));
    if (!existingDaemon) {
      throw new DaemonNotRegisteredError(vpId);
    }

    // Get VP to find org ID
    const vp = await this.db.vP.findUnique({
      where: { id: vpId },
    });

    // Remove all heartbeat data
    await Promise.all([
      this.redis.del(HEARTBEAT_REDIS_KEYS.daemon(vpId)),
      this.redis.del(HEARTBEAT_REDIS_KEYS.heartbeat(vpId)),
      this.redis.del(HEARTBEAT_REDIS_KEYS.health(vpId)),
      this.redis.srem(HEARTBEAT_REDIS_KEYS.registeredVPs(), vpId),
      vp ? this.redis.srem(HEARTBEAT_REDIS_KEYS.orgVPs(vp.organizationId), vpId) : Promise.resolve(),
    ]);

    // Remove sequence counter
    this.sequenceCounters.delete(vpId);

    // Update VP status to OFFLINE
    if (vp) {
      await this.db.vP.update({
        where: { id: vpId },
        data: { status: 'OFFLINE' },
      });
    }
  }

  // ===========================================================================
  // Heartbeat Operations
  // ===========================================================================

  /**
   * Sends a heartbeat for a VP.
   */
  async sendHeartbeat(vpId: string, metrics?: HeartbeatMetrics): Promise<void> {
    // Get daemon info to verify registration
    const daemonInfoStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.daemon(vpId));
    if (!daemonInfoStr) {
      throw new DaemonNotRegisteredError(vpId);
    }

    const daemonInfo = JSON.parse(daemonInfoStr);

    // Get VP for org ID
    const vp = await this.db.vP.findUnique({
      where: { id: vpId },
    });

    if (!vp) {
      throw new VPNotFoundError(vpId);
    }

    // Increment sequence number
    const currentSeq = this.sequenceCounters.get(vpId) ?? 0;
    const newSeq = currentSeq + 1;
    this.sequenceCounters.set(vpId, newSeq);

    // Create heartbeat record
    const heartbeatRecord: HeartbeatRecord = {
      vpId,
      organizationId: vp.organizationId,
      timestamp: new Date(),
      metrics: metrics ?? DEFAULT_HEARTBEAT_METRICS,
      daemonInfo: {
        ...daemonInfo,
        startedAt: new Date(daemonInfo.startedAt),
      },
      sequenceNumber: newSeq,
    };

    // Store current heartbeat
    await this.redis.set(
      HEARTBEAT_REDIS_KEYS.heartbeat(vpId),
      JSON.stringify({
        ...heartbeatRecord,
        timestamp: heartbeatRecord.timestamp.toISOString(),
        daemonInfo: {
          ...heartbeatRecord.daemonInfo,
          startedAt: heartbeatRecord.daemonInfo.startedAt.toISOString(),
        },
      }),
      { EX: this.config.heartbeatTTLSeconds },
    );

    // Add to history
    await this.redis.zadd(
      HEARTBEAT_REDIS_KEYS.history(vpId),
      heartbeatRecord.timestamp.getTime(),
      JSON.stringify({
        ...heartbeatRecord,
        timestamp: heartbeatRecord.timestamp.toISOString(),
        daemonInfo: {
          ...heartbeatRecord.daemonInfo,
          startedAt: heartbeatRecord.daemonInfo.startedAt.toISOString(),
        },
      }),
    );

    // Trim history to max entries
    const historyCount = (await this.redis.zrange(
      HEARTBEAT_REDIS_KEYS.history(vpId),
      0,
      -1,
    )).length;

    if (historyCount > this.config.maxHistoryEntries) {
      await this.redis.zremrangebyrank(
        HEARTBEAT_REDIS_KEYS.history(vpId),
        0,
        historyCount - this.config.maxHistoryEntries - 1,
      );
    }

    // Update health status
    await this.updateHealthStatus(vpId, heartbeatRecord);

    // Refresh daemon info TTL
    await this.redis.expire(
      HEARTBEAT_REDIS_KEYS.daemon(vpId),
      this.config.heartbeatTTLSeconds * 10,
    );
  }

  /**
   * Gets the last heartbeat record for a VP.
   */
  async getLastHeartbeat(vpId: string): Promise<HeartbeatRecord | null> {
    const heartbeatStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.heartbeat(vpId));
    if (!heartbeatStr) {
      return null;
    }

    const parsed = JSON.parse(heartbeatStr);
    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      daemonInfo: {
        ...parsed.daemonInfo,
        startedAt: new Date(parsed.daemonInfo.startedAt),
      },
      metrics: {
        ...parsed.metrics,
        lastMessageAt: parsed.metrics.lastMessageAt
          ? new Date(parsed.metrics.lastMessageAt)
          : undefined,
      },
    };
  }

  // ===========================================================================
  // Health Monitoring
  // ===========================================================================

  /**
   * Checks the health status of a VP.
   */
  async checkHealth(vpId: string): Promise<HealthStatus> {
    // Get stored health status
    const healthStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.health(vpId));
    if (!healthStr) {
      return DEFAULT_HEALTH_STATUS;
    }

    const health = JSON.parse(healthStr);

    // Get last heartbeat
    const lastHeartbeat = await this.getLastHeartbeat(vpId);

    // Calculate missed heartbeats
    if (lastHeartbeat) {
      const now = Date.now();
      const lastTime = lastHeartbeat.timestamp.getTime();
      const elapsed = now - lastTime;
      const expectedHeartbeats = Math.floor(elapsed / this.config.heartbeatIntervalMs);
      const missedHeartbeats = Math.max(0, expectedHeartbeats - 1);

      // Determine health status
      let status: HealthStatusType;
      let healthy: boolean;

      if (missedHeartbeats === 0) {
        status = health.recovering ? 'recovering' : 'healthy';
        healthy = true;
      } else if (missedHeartbeats < this.config.unhealthyThreshold) {
        status = 'degraded';
        healthy = true;
      } else {
        status = 'unhealthy';
        healthy = false;
      }

      // Check for degraded metrics
      if (healthy && lastHeartbeat.metrics) {
        if (
          lastHeartbeat.metrics.cpuUsage > 90 ||
          lastHeartbeat.metrics.memoryUsage > 90 ||
          lastHeartbeat.metrics.messageQueueSize > 1000
        ) {
          status = 'degraded';
        }
      }

      const updatedHealth: HealthStatus = {
        healthy,
        status,
        lastHeartbeat: lastHeartbeat.timestamp,
        missedHeartbeats,
        latestMetrics: lastHeartbeat.metrics,
        recovering: health.recovering,
        unhealthySince: health.unhealthySince ? new Date(health.unhealthySince) : undefined,
        details: this.getHealthDetails(status, missedHeartbeats, lastHeartbeat.metrics),
      };

      return updatedHealth;
    }

    // No heartbeat data
    return {
      ...DEFAULT_HEALTH_STATUS,
      details: 'No heartbeat data available',
    };
  }

  /**
   * Gets all unhealthy VPs for an organization.
   */
  async getUnhealthyVPs(orgId: string): Promise<string[]> {
    // Get all VPs for the organization
    const vpIds = await this.redis.smembers(HEARTBEAT_REDIS_KEYS.orgVPs(orgId));
    const unhealthyVPs: string[] = [];

    // Check health of each VP
    for (const vpId of vpIds) {
      const health = await this.checkHealth(vpId);
      if (!health.healthy) {
        unhealthyVPs.push(vpId);
      }
    }

    return unhealthyVPs;
  }

  // ===========================================================================
  // Recovery Operations
  // ===========================================================================

  /**
   * Marks a VP as recovering.
   */
  async markRecovering(vpId: string): Promise<void> {
    const healthStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.health(vpId));
    if (!healthStr) {
      return;
    }

    const health = JSON.parse(healthStr);
    health.recovering = true;
    health.status = 'recovering';

    await this.redis.set(
      HEARTBEAT_REDIS_KEYS.health(vpId),
      JSON.stringify(health),
      { EX: this.config.heartbeatTTLSeconds },
    );
  }

  /**
   * Marks a VP as recovered.
   */
  async markRecovered(vpId: string): Promise<void> {
    const healthStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.health(vpId));
    if (!healthStr) {
      return;
    }

    const health = JSON.parse(healthStr);
    health.recovering = false;
    health.status = 'healthy';
    health.healthy = true;
    health.unhealthySince = undefined;

    await this.redis.set(
      HEARTBEAT_REDIS_KEYS.health(vpId),
      JSON.stringify(health),
      { EX: this.config.heartbeatTTLSeconds },
    );

    // Update VP status to ONLINE
    await this.db.vP.update({
      where: { id: vpId },
      data: { status: 'ONLINE' },
    });
  }

  // ===========================================================================
  // Query Operations
  // ===========================================================================

  /**
   * Gets daemon info for a VP.
   */
  async getDaemonInfo(vpId: string): Promise<HeartbeatDaemonInfo | null> {
    const daemonStr = await this.redis.get(HEARTBEAT_REDIS_KEYS.daemon(vpId));
    if (!daemonStr) {
      return null;
    }

    const parsed = JSON.parse(daemonStr);
    return {
      ...parsed,
      startedAt: new Date(parsed.startedAt),
    };
  }

  /**
   * Gets heartbeat history for a VP.
   */
  async getHeartbeatHistory(vpId: string, limit: number = 50): Promise<HeartbeatRecord[]> {
    const historyStrs = await this.redis.zrange(
      HEARTBEAT_REDIS_KEYS.history(vpId),
      -limit,
      -1,
    );

    return historyStrs.map((str) => {
      const parsed = JSON.parse(str);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp),
        daemonInfo: {
          ...parsed.daemonInfo,
          startedAt: new Date(parsed.daemonInfo.startedAt),
        },
        metrics: {
          ...parsed.metrics,
          lastMessageAt: parsed.metrics.lastMessageAt
            ? new Date(parsed.metrics.lastMessageAt)
            : undefined,
        },
      };
    });
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Updates the health status after receiving a heartbeat.
   */
  private async updateHealthStatus(
    vpId: string,
    heartbeat: HeartbeatRecord,
  ): Promise<void> {
    const currentHealth = await this.checkHealth(vpId);

    // Check if recovering
    if (currentHealth.status === 'unhealthy' || currentHealth.recovering) {
      // Was unhealthy, now receiving heartbeats - mark as recovering
      const health: HealthStatus = {
        healthy: true,
        status: 'recovering',
        lastHeartbeat: heartbeat.timestamp,
        missedHeartbeats: 0,
        recovering: true,
        latestMetrics: heartbeat.metrics,
      };

      await this.redis.set(
        HEARTBEAT_REDIS_KEYS.health(vpId),
        JSON.stringify({
          ...health,
          lastHeartbeat: health.lastHeartbeat?.toISOString(),
        }),
        { EX: this.config.heartbeatTTLSeconds },
      );
    } else {
      // Normal heartbeat update
      const health: HealthStatus = {
        healthy: true,
        status: 'healthy',
        lastHeartbeat: heartbeat.timestamp,
        missedHeartbeats: 0,
        recovering: false,
        latestMetrics: heartbeat.metrics,
      };

      // Check for degraded metrics
      if (
        heartbeat.metrics.cpuUsage > 90 ||
        heartbeat.metrics.memoryUsage > 90 ||
        heartbeat.metrics.messageQueueSize > 1000
      ) {
        health.status = 'degraded';
        health.details = this.getHealthDetails('degraded', 0, heartbeat.metrics);
      }

      await this.redis.set(
        HEARTBEAT_REDIS_KEYS.health(vpId),
        JSON.stringify({
          ...health,
          lastHeartbeat: health.lastHeartbeat?.toISOString(),
        }),
        { EX: this.config.heartbeatTTLSeconds },
      );
    }
  }

  /**
   * Generates human-readable health details.
   */
  private getHealthDetails(
    status: HealthStatusType,
    missedHeartbeats: number,
    metrics?: HeartbeatMetrics,
  ): string {
    switch (status) {
      case 'healthy':
        return 'VP daemon is operating normally';
      case 'degraded': {
        const issues: string[] = [];
        if (missedHeartbeats > 0) {
          issues.push(`${missedHeartbeats} missed heartbeat(s)`);
        }
        if (metrics) {
          if (metrics.cpuUsage > 90) {
issues.push('high CPU usage');
}
          if (metrics.memoryUsage > 90) {
issues.push('high memory usage');
}
          if (metrics.messageQueueSize > 1000) {
issues.push('large message queue');
}
        }
        return `VP daemon is degraded: ${issues.join(', ')}`;
      }
      case 'unhealthy':
        return `VP daemon is unhealthy: ${missedHeartbeats} consecutive missed heartbeats`;
      case 'recovering':
        return 'VP daemon is recovering from unhealthy state';
      case 'unknown':
      default:
        return 'VP daemon status is unknown';
    }
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new heartbeat service instance.
 *
 * @param redis - Redis client for storage
 * @param config - Optional heartbeat configuration
 * @param database - Optional Prisma client
 * @returns Heartbeat service instance
 *
 * @example
 * ```typescript
 * import { createHeartbeatService } from '@genesis/core';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis();
 * const heartbeatService = createHeartbeatService(redis, {
 *   heartbeatIntervalMs: 30000,
 *   unhealthyThreshold: 3,
 * });
 *
 * // Register a daemon
 * await heartbeatService.registerDaemon('vp_123', {
 *   instanceId: 'daemon_abc',
 *   version: '1.0.0',
 *   host: 'localhost',
 *   port: 8080,
 *   protocol: 'http',
 *   startedAt: new Date(),
 * });
 *
 * // Send heartbeat
 * await heartbeatService.sendHeartbeat('vp_123', {
 *   cpuUsage: 45,
 *   memoryUsage: 60,
 *   activeConnections: 10,
 *   messageQueueSize: 5,
 * });
 * ```
 */
export function createHeartbeatService(
  redis: RedisClient,
  config?: Partial<HeartbeatConfig>,
  database?: PrismaClient,
): HeartbeatServiceImpl {
  return new HeartbeatServiceImpl(redis, config, database);
}
