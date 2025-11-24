/**
 * @wundr.io/mcp-registry - Health Monitor
 *
 * Server health tracking, monitoring, and automatic recovery.
 * Provides continuous health checks and status reporting.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';

import { HealthMonitorConfigSchema } from './types';

import type { MCPServerRegistry } from './registry';
import type {
  HealthStatus,
  HealthLevel,
  HealthCheckResult,
  HealthMonitorConfig,
  MCPServerRegistration,
} from './types';

// =============================================================================
// Health Monitor Error Types
// =============================================================================

/**
 * Error thrown when health check fails
 */
export class HealthCheckError extends Error {
  constructor(
    public readonly serverId: string,
    public readonly checkName: string,
    message?: string,
  ) {
    super(
      message ?? `Health check "${checkName}" failed for server: ${serverId}`,
    );
    this.name = 'HealthCheckError';
  }
}

// =============================================================================
// Health Monitor Event Types
// =============================================================================

/**
 * Event map for health monitor events
 */
export interface HealthMonitorEvents {
  'health:checked': (event: HealthCheckEvent) => void;
  'health:changed': (event: HealthChangeEvent) => void;
  'health:degraded': (event: HealthChangeEvent) => void;
  'health:recovered': (event: HealthChangeEvent) => void;
  'health:failed': (event: HealthChangeEvent) => void;
  'server:connected': (event: ConnectionEvent) => void;
  'server:disconnected': (event: ConnectionEvent) => void;
  'monitor:started': () => void;
  'monitor:stopped': () => void;
}

/**
 * Health check event data
 */
export interface HealthCheckEvent {
  readonly serverId: string;
  readonly status: HealthStatus;
  readonly checks: readonly HealthCheckResult[];
  readonly timestamp: Date;
}

/**
 * Health change event data
 */
export interface HealthChangeEvent {
  readonly serverId: string;
  readonly previousStatus: HealthLevel;
  readonly newStatus: HealthLevel;
  readonly reason?: string;
  readonly timestamp: Date;
}

/**
 * Connection event data
 */
export interface ConnectionEvent {
  readonly serverId: string;
  readonly connected: boolean;
  readonly timestamp: Date;
}

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * Health check function type
 */
export type HealthCheckFn = (
  server: MCPServerRegistration
) => Promise<HealthCheckResult>;

/**
 * Registered health check
 */
export interface RegisteredHealthCheck {
  /** Check name */
  readonly name: string;
  /** Check function */
  readonly check: HealthCheckFn;
  /** Whether check is critical (affects overall status) */
  readonly critical: boolean;
  /** Check timeout in milliseconds */
  readonly timeout: number;
}

// =============================================================================
// ServerHealthMonitor Class
// =============================================================================

/**
 * Server Health Monitor
 *
 * Provides continuous health monitoring for registered MCP servers.
 * Tracks connection status, latency, and custom health checks.
 *
 * @example
 * ```typescript
 * const monitor = new ServerHealthMonitor(registry, {
 *   checkInterval: 10000,
 *   pingTimeout: 5000,
 *   failureThreshold: 3,
 * });
 *
 * // Register custom health check
 * monitor.registerCheck({
 *   name: 'memory-usage',
 *   check: async (server) => ({
 *     name: 'memory-usage',
 *     status: 'healthy',
 *     durationMs: 10,
 *     timestamp: new Date(),
 *   }),
 *   critical: false,
 *   timeout: 5000,
 * });
 *
 * // Start monitoring
 * await monitor.start();
 *
 * // Get server health
 * const health = monitor.getHealth('server-id');
 * ```
 */
export class ServerHealthMonitor extends EventEmitter<HealthMonitorEvents> {
  /** Configuration */
  private readonly config: Required<HealthMonitorConfig>;

  /** Registered health checks */
  private readonly healthChecks: Map<string, RegisteredHealthCheck>;

  /** Latency history by server ID */
  private readonly latencyHistory: Map<string, number[]>;

  /** Consecutive failure counts by server ID */
  private readonly failureCounts: Map<string, number>;

  /** Consecutive success counts by server ID */
  private readonly successCounts: Map<string, number>;

  /** Monitoring interval handle */
  private monitoringInterval?: NodeJS.Timeout;

  /** Whether monitoring is active */
  private isMonitoring: boolean;

  /** Request counts by server ID */
  private readonly requestCounts: Map<
    string,
    { total: number; successful: number }
  >;

  /**
   * Creates a new ServerHealthMonitor
   *
   * @param registry - The server registry
   * @param config - Health monitor configuration
   */
  constructor(
    private readonly registry: MCPServerRegistry,
    config: HealthMonitorConfig = {},
  ) {
    super();

    // Validate and merge config with defaults
    const validation = HealthMonitorConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new Error(
        `Invalid health monitor config: ${validation.error.message}`,
      );
    }

    this.config = {
      checkInterval: config.checkInterval ?? 30000,
      pingTimeout: config.pingTimeout ?? 5000,
      failureThreshold: config.failureThreshold ?? 3,
      recoveryThreshold: config.recoveryThreshold ?? 2,
      degradedLatencyThreshold: config.degradedLatencyThreshold ?? 1000,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
    };

    this.healthChecks = new Map();
    this.latencyHistory = new Map();
    this.failureCounts = new Map();
    this.successCounts = new Map();
    this.requestCounts = new Map();
    this.isMonitoring = false;

    // Register default ping check
    this.registerCheck({
      name: 'ping',
      check: this.createPingCheck(),
      critical: true,
      timeout: this.config.pingTimeout,
    });
  }

  // ===========================================================================
  // Lifecycle Methods
  // ===========================================================================

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    // Perform initial health check on all servers
    await this.checkAllServers();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllServers().catch(error => {
        console.error('Health check cycle failed:', error);
      });
    }, this.config.checkInterval);

    this.emit('monitor:started');
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.emit('monitor:stopped');
  }

  /**
   * Check if monitoring is active
   *
   * @returns True if monitoring is active
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  // ===========================================================================
  // Health Check Registration
  // ===========================================================================

  /**
   * Register a custom health check
   *
   * @param check - Health check to register
   */
  registerCheck(check: RegisteredHealthCheck): void {
    this.healthChecks.set(check.name, check);
  }

  /**
   * Unregister a health check
   *
   * @param name - Check name to unregister
   */
  unregisterCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  /**
   * Get all registered checks
   *
   * @returns Array of registered health checks
   */
  getRegisteredChecks(): readonly RegisteredHealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  // ===========================================================================
  // Health Status Methods
  // ===========================================================================

  /**
   * Get health status for a server
   *
   * @param serverId - Server ID
   * @returns Health status or undefined
   */
  getHealth(serverId: string): HealthStatus | undefined {
    return this.registry.getHealthStatus(serverId);
  }

  /**
   * Get health statuses for all servers
   *
   * @returns Map of server ID to health status
   */
  getAllHealth(): ReadonlyMap<string, HealthStatus> {
    const statuses = new Map<string, HealthStatus>();

    for (const server of this.registry.getAll()) {
      const health = this.registry.getHealthStatus(server.id);
      if (health) {
        statuses.set(server.id, health);
      }
    }

    return statuses;
  }

  /**
   * Force a health check for a specific server
   *
   * @param serverId - Server ID
   * @returns Health status after check
   */
  async checkServer(serverId: string): Promise<HealthStatus> {
    const server = this.registry.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    return this.performHealthCheck(server);
  }

  /**
   * Check health of all servers
   */
  async checkAllServers(): Promise<void> {
    const servers = this.registry.getAll();

    await Promise.all(
      servers.map(server =>
        this.performHealthCheck(server).catch(error => {
          console.error(`Health check failed for server ${server.id}:`, error);
        }),
      ),
    );
  }

  // ===========================================================================
  // Request Tracking Methods
  // ===========================================================================

  /**
   * Record a request for a server
   *
   * @param serverId - Server ID
   * @param success - Whether request was successful
   * @param latencyMs - Request latency in milliseconds
   */
  recordRequest(serverId: string, success: boolean, latencyMs?: number): void {
    // Update request counts
    const counts = this.requestCounts.get(serverId) ?? {
      total: 0,
      successful: 0,
    };
    counts.total++;
    if (success) {
      counts.successful++;
    }
    this.requestCounts.set(serverId, counts);

    // Update latency history
    if (latencyMs !== undefined) {
      this.recordLatency(serverId, latencyMs);
    }

    // Update consecutive counts
    if (success) {
      this.incrementSuccessCount(serverId);
      this.resetFailureCount(serverId);
    } else {
      this.incrementFailureCount(serverId);
      this.resetSuccessCount(serverId);
    }

    // Update health status
    this.updateHealthFromCounts(serverId);
  }

  // ===========================================================================
  // Private Health Check Methods
  // ===========================================================================

  /**
   * Perform health check on a server
   */
  private async performHealthCheck(
    server: MCPServerRegistration,
  ): Promise<HealthStatus> {
    const startTime = Date.now();
    const checkResults: HealthCheckResult[] = [];
    let allPassed = true;
    let hasCriticalFailure = false;

    // Run all registered health checks
    for (const [name, check] of this.healthChecks) {
      try {
        const result = await this.runCheckWithTimeout(check, server);
        checkResults.push(result);

        if (result.status === 'unhealthy') {
          allPassed = false;
          if (check.critical) {
            hasCriticalFailure = true;
          }
        } else if (result.status === 'degraded') {
          allPassed = false;
        }
      } catch (error) {
        const result: HealthCheckResult = {
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
          timestamp: new Date(),
        };
        checkResults.push(result);
        allPassed = false;
        if (check.critical) {
          hasCriticalFailure = true;
        }
      }
    }

    // Calculate overall status
    const previousStatus = this.registry.getHealthStatus(server.id);
    const previousLevel = previousStatus?.status ?? 'unknown';

    let newStatus: HealthLevel;
    if (hasCriticalFailure) {
      newStatus = 'unhealthy';
    } else if (!allPassed) {
      newStatus = 'degraded';
    } else {
      newStatus = 'healthy';
    }

    // Get latency metrics
    const latencyMs = Date.now() - startTime;
    this.recordLatency(server.id, latencyMs);
    const avgLatencyMs = this.calculateAverageLatency(server.id);

    // Check for latency-based degradation
    if (
      newStatus === 'healthy' &&
      avgLatencyMs > this.config.degradedLatencyThreshold
    ) {
      newStatus = 'degraded';
    }

    // Get request stats
    const requestStats = this.requestCounts.get(server.id) ?? {
      total: 0,
      successful: 0,
    };
    const errorRate =
      requestStats.total > 0
        ? 1 - requestStats.successful / requestStats.total
        : 0;

    // Build health status
    const healthStatus: HealthStatus = {
      serverId: server.id,
      status: newStatus,
      connected: newStatus !== 'unhealthy',
      lastPing: new Date(),
      latencyMs,
      avgLatencyMs,
      consecutiveFailures: this.failureCounts.get(server.id) ?? 0,
      totalRequests: requestStats.total,
      successfulRequests: requestStats.successful,
      errorRate,
      checks: checkResults,
      updatedAt: new Date(),
    };

    // Update registry
    this.registry.updateHealthStatus(server.id, healthStatus);

    // Emit events
    this.emitHealthCheckEvent(server.id, healthStatus, checkResults);

    if (previousLevel !== newStatus) {
      this.emitHealthChangeEvent(server.id, previousLevel, newStatus);
    }

    return healthStatus;
  }

  /**
   * Run a health check with timeout
   */
  private async runCheckWithTimeout(
    check: RegisteredHealthCheck,
    server: MCPServerRegistration,
  ): Promise<HealthCheckResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new HealthCheckError(server.id, check.name, 'Health check timed out'),
        );
      }, check.timeout);

      check
        .check(server)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Create the default ping check
   */
  private createPingCheck(): HealthCheckFn {
    return async (
      server: MCPServerRegistration,
    ): Promise<HealthCheckResult> => {
      const startTime = Date.now();

      // Simulate a ping check (in real implementation, would ping the server)
      // For now, check if server is in registry and has valid transport config
      const isValid =
        server.transport.type !== undefined &&
        (server.transport.command !== undefined ||
          server.transport.url !== undefined);

      return {
        name: 'ping',
        status: isValid ? 'healthy' : 'unhealthy',
        message: isValid
          ? 'Server is reachable'
          : 'Server configuration invalid',
        durationMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Record latency for a server
   */
  private recordLatency(serverId: string, latencyMs: number): void {
    let history = this.latencyHistory.get(serverId);
    if (!history) {
      history = [];
      this.latencyHistory.set(serverId, history);
    }

    // Keep last 100 latency measurements
    history.push(latencyMs);
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Calculate average latency for a server
   */
  private calculateAverageLatency(serverId: string): number {
    const history = this.latencyHistory.get(serverId);
    if (!history || history.length === 0) {
      return 0;
    }

    const sum = history.reduce((acc, val) => acc + val, 0);
    return sum / history.length;
  }

  /**
   * Increment failure count for a server
   */
  private incrementFailureCount(serverId: string): void {
    const count = this.failureCounts.get(serverId) ?? 0;
    this.failureCounts.set(serverId, count + 1);
  }

  /**
   * Reset failure count for a server
   */
  private resetFailureCount(serverId: string): void {
    this.failureCounts.set(serverId, 0);
  }

  /**
   * Increment success count for a server
   */
  private incrementSuccessCount(serverId: string): void {
    const count = this.successCounts.get(serverId) ?? 0;
    this.successCounts.set(serverId, count + 1);
  }

  /**
   * Reset success count for a server
   */
  private resetSuccessCount(serverId: string): void {
    this.successCounts.set(serverId, 0);
  }

  /**
   * Update health status from consecutive counts
   */
  private updateHealthFromCounts(serverId: string): void {
    const failureCount = this.failureCounts.get(serverId) ?? 0;
    const successCount = this.successCounts.get(serverId) ?? 0;

    const currentHealth = this.registry.getHealthStatus(serverId);
    const previousStatus = currentHealth?.status ?? 'unknown';
    let newStatus = previousStatus;

    if (failureCount >= this.config.failureThreshold) {
      newStatus = 'unhealthy';
    } else if (
      previousStatus === 'unhealthy' &&
      successCount >= this.config.recoveryThreshold
    ) {
      newStatus = 'healthy';
    } else if (failureCount > 0 && previousStatus === 'healthy') {
      newStatus = 'degraded';
    }

    if (previousStatus !== newStatus) {
      this.registry.updateHealthStatus(serverId, { status: newStatus });
      this.emitHealthChangeEvent(serverId, previousStatus, newStatus);
    }
  }

  /**
   * Emit health check event
   */
  private emitHealthCheckEvent(
    serverId: string,
    status: HealthStatus,
    checks: readonly HealthCheckResult[],
  ): void {
    const event: HealthCheckEvent = {
      serverId,
      status,
      checks,
      timestamp: new Date(),
    };

    this.emit('health:checked', event);
  }

  /**
   * Emit health change event
   */
  private emitHealthChangeEvent(
    serverId: string,
    previousStatus: HealthLevel,
    newStatus: HealthLevel,
  ): void {
    const event: HealthChangeEvent = {
      serverId,
      previousStatus,
      newStatus,
      timestamp: new Date(),
    };

    this.emit('health:changed', event);

    // Emit specific events
    if (newStatus === 'degraded' && previousStatus === 'healthy') {
      this.emit('health:degraded', event);
    } else if (newStatus === 'healthy' && previousStatus !== 'healthy') {
      this.emit('health:recovered', event);
    } else if (newStatus === 'unhealthy') {
      this.emit('health:failed', event);
    }

    // Emit connection events
    if (previousStatus !== 'unhealthy' && newStatus === 'unhealthy') {
      this.emit('server:disconnected', {
        serverId,
        connected: false,
        timestamp: new Date(),
      });
    } else if (previousStatus === 'unhealthy' && newStatus !== 'unhealthy') {
      this.emit('server:connected', {
        serverId,
        connected: true,
        timestamp: new Date(),
      });
    }
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get monitoring statistics
   *
   * @returns Health monitor statistics
   */
  getStats(): HealthMonitorStats {
    const allHealth = this.getAllHealth();
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let unknown = 0;

    for (const status of allHealth.values()) {
      switch (status.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
        default:
          unknown++;
      }
    }

    return {
      isMonitoring: this.isMonitoring,
      checkInterval: this.config.checkInterval,
      totalServers: allHealth.size,
      healthyServers: healthy,
      degradedServers: degraded,
      unhealthyServers: unhealthy,
      unknownServers: unknown,
      registeredChecks: this.healthChecks.size,
    };
  }

  /**
   * Reset all monitoring state
   */
  reset(): void {
    this.latencyHistory.clear();
    this.failureCounts.clear();
    this.successCounts.clear();
    this.requestCounts.clear();
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): Readonly<Required<HealthMonitorConfig>> {
    return { ...this.config };
  }
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Health monitor statistics
 */
export interface HealthMonitorStats {
  /** Whether monitoring is active */
  readonly isMonitoring: boolean;
  /** Check interval in milliseconds */
  readonly checkInterval: number;
  /** Total number of servers */
  readonly totalServers: number;
  /** Number of healthy servers */
  readonly healthyServers: number;
  /** Number of degraded servers */
  readonly degradedServers: number;
  /** Number of unhealthy servers */
  readonly unhealthyServers: number;
  /** Number of servers with unknown status */
  readonly unknownServers: number;
  /** Number of registered health checks */
  readonly registeredChecks: number;
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ServerHealthMonitor
 *
 * @param registry - The server registry
 * @param config - Optional health monitor configuration
 * @returns New health monitor instance
 *
 * @example
 * ```typescript
 * const monitor = createServerHealthMonitor(registry, {
 *   checkInterval: 10000,
 *   pingTimeout: 5000,
 * });
 * await monitor.start();
 * ```
 */
export function createServerHealthMonitor(
  registry: MCPServerRegistry,
  config?: HealthMonitorConfig,
): ServerHealthMonitor {
  return new ServerHealthMonitor(registry, config);
}
