/**
 * Health Check Implementation for MCP Server
 *
 * Provides comprehensive health monitoring capabilities including
 * server status, dependency checks, and performance metrics.
 *
 * @packageDocumentation
 */

import type { Logger } from '../types';

// =============================================================================
// Health Check Types
// =============================================================================

/**
 * Health status values
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual health check result
 */
export interface HealthCheckResult {
  /** Name of the check */
  readonly name: string;
  /** Status of the check */
  readonly status: HealthStatus;
  /** Human-readable description */
  readonly message?: string;
  /** Time taken to perform the check (ms) */
  readonly duration: number;
  /** Timestamp of the check */
  readonly timestamp: Date;
  /** Additional details */
  readonly details?: Record<string, unknown>;
}

/**
 * Aggregate health report
 */
export interface HealthReport {
  /** Overall health status */
  readonly status: HealthStatus;
  /** Server uptime in milliseconds */
  readonly uptime: number;
  /** Timestamp of the report */
  readonly timestamp: Date;
  /** Individual check results */
  readonly checks: readonly HealthCheckResult[];
  /** Server version */
  readonly version: string;
  /** Server name */
  readonly serverName: string;
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * Health check registration
 */
export interface HealthCheckRegistration {
  /** Check name */
  readonly name: string;
  /** Check function */
  readonly check: HealthCheckFunction;
  /** Whether the check is critical (affects overall status) */
  readonly critical?: boolean;
  /** Timeout for the check in milliseconds */
  readonly timeout?: number;
  /** Check interval for periodic monitoring */
  readonly interval?: number;
}

/**
 * Health check manager configuration
 */
export interface HealthCheckConfig {
  /** Server name for reporting */
  readonly serverName: string;
  /** Server version for reporting */
  readonly version: string;
  /** Default timeout for checks (ms) */
  readonly defaultTimeout?: number;
  /** Whether to run checks periodically */
  readonly enablePeriodicChecks?: boolean;
  /** Default interval for periodic checks (ms) */
  readonly defaultInterval?: number;
  /** Logger instance */
  readonly logger?: Logger;
}

// =============================================================================
// Built-in Health Checks
// =============================================================================

/**
 * Create a memory usage health check
 *
 * @param thresholds - Memory thresholds for degraded/unhealthy status
 * @returns Health check function
 */
export function createMemoryHealthCheck(
  thresholds: {
    degradedPercent?: number;
    unhealthyPercent?: number;
  } = {}
): HealthCheckFunction {
  const degradedThreshold = thresholds.degradedPercent ?? 80;
  const unhealthyThreshold = thresholds.unhealthyPercent ?? 95;

  return async (): Promise<HealthCheckResult> => {
    const start = Date.now();
    const memUsage = process.memoryUsage();

    // Calculate heap usage percentage
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    let status: HealthStatus = 'healthy';
    let message = 'Memory usage is normal';

    if (heapUsedPercent >= unhealthyThreshold) {
      status = 'unhealthy';
      message = `Memory usage critical: ${heapUsedPercent.toFixed(1)}%`;
    } else if (heapUsedPercent >= degradedThreshold) {
      status = 'degraded';
      message = `Memory usage elevated: ${heapUsedPercent.toFixed(1)}%`;
    }

    return {
      name: 'memory',
      status,
      message,
      duration: Date.now() - start,
      timestamp: new Date(),
      details: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedPercent: Math.round(heapUsedPercent * 10) / 10,
        rss: memUsage.rss,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
      },
    };
  };
}

/**
 * Create an event loop lag health check
 *
 * @param thresholds - Event loop lag thresholds
 * @returns Health check function
 */
export function createEventLoopHealthCheck(
  thresholds: {
    degradedMs?: number;
    unhealthyMs?: number;
  } = {}
): HealthCheckFunction {
  const degradedThreshold = thresholds.degradedMs ?? 100;
  const unhealthyThreshold = thresholds.unhealthyMs ?? 500;

  return async (): Promise<HealthCheckResult> => {
    const start = Date.now();

    // Measure event loop lag
    const lagStart = process.hrtime.bigint();
    await new Promise<void>(resolve => setImmediate(resolve));
    const lagEnd = process.hrtime.bigint();
    const lagMs = Number(lagEnd - lagStart) / 1_000_000;

    let status: HealthStatus = 'healthy';
    let message = 'Event loop is responsive';

    if (lagMs >= unhealthyThreshold) {
      status = 'unhealthy';
      message = `Event loop lag critical: ${lagMs.toFixed(2)}ms`;
    } else if (lagMs >= degradedThreshold) {
      status = 'degraded';
      message = `Event loop lag elevated: ${lagMs.toFixed(2)}ms`;
    }

    return {
      name: 'event-loop',
      status,
      message,
      duration: Date.now() - start,
      timestamp: new Date(),
      details: {
        lagMs: Math.round(lagMs * 100) / 100,
      },
    };
  };
}

/**
 * Create a process health check
 *
 * @returns Health check function
 */
export function createProcessHealthCheck(): HealthCheckFunction {
  return async (): Promise<HealthCheckResult> => {
    const start = Date.now();

    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    return {
      name: 'process',
      status: 'healthy',
      message: 'Process is running normally',
      duration: Date.now() - start,
      timestamp: new Date(),
      details: {
        pid: process.pid,
        uptime: Math.round(uptime),
        platform: process.platform,
        nodeVersion: process.version,
        cpuUser: cpuUsage.user,
        cpuSystem: cpuUsage.system,
      },
    };
  };
}

// =============================================================================
// Health Check Manager
// =============================================================================

/**
 * Health Check Manager
 *
 * Manages health checks for the MCP server, providing both
 * on-demand and periodic health monitoring.
 *
 * @example
 * ```typescript
 * const healthManager = new HealthCheckManager({
 *   serverName: 'wundr-mcp-server',
 *   version: '1.0.0',
 * });
 *
 * healthManager.registerCheck({
 *   name: 'database',
 *   check: async () => {
 *     // Check database connection
 *     return {
 *       name: 'database',
 *       status: 'healthy',
 *       duration: 10,
 *       timestamp: new Date(),
 *     };
 *   },
 *   critical: true,
 * });
 *
 * const report = await healthManager.getHealthReport();
 * ```
 */
export class HealthCheckManager {
  private readonly config: HealthCheckConfig;
  private readonly checks: Map<string, HealthCheckRegistration> = new Map();
  private readonly periodicChecks: Map<string, NodeJS.Timeout> = new Map();
  private readonly lastResults: Map<string, HealthCheckResult> = new Map();
  private readonly startTime: number;
  private readonly logger?: Logger;

  /**
   * Create a new Health Check Manager
   *
   * @param config - Manager configuration
   */
  constructor(config: HealthCheckConfig) {
    this.config = {
      defaultTimeout: 5000,
      enablePeriodicChecks: false,
      defaultInterval: 30000,
      ...config,
    };
    this.startTime = Date.now();
    this.logger = config.logger;

    // Register built-in checks
    this.registerBuiltInChecks();
  }

  /**
   * Register a health check
   *
   * @param registration - Health check registration
   */
  public registerCheck(registration: HealthCheckRegistration): void {
    this.checks.set(registration.name, registration);
    this.logger?.debug(`Registered health check: ${registration.name}`);

    // Start periodic check if enabled
    if (this.config.enablePeriodicChecks && registration.interval) {
      this.startPeriodicCheck(registration);
    }
  }

  /**
   * Unregister a health check
   *
   * @param name - Check name to unregister
   * @returns Whether the check was unregistered
   */
  public unregisterCheck(name: string): boolean {
    // Stop periodic check if running
    const interval = this.periodicChecks.get(name);
    if (interval) {
      clearInterval(interval);
      this.periodicChecks.delete(name);
    }

    // Remove from checks
    const removed = this.checks.delete(name);
    this.lastResults.delete(name);

    if (removed) {
      this.logger?.debug(`Unregistered health check: ${name}`);
    }

    return removed;
  }

  /**
   * Run a single health check
   *
   * @param name - Check name to run
   * @returns Check result
   */
  public async runCheck(name: string): Promise<HealthCheckResult> {
    const registration = this.checks.get(name);

    if (!registration) {
      return {
        name,
        status: 'unhealthy',
        message: `Health check not found: ${name}`,
        duration: 0,
        timestamp: new Date(),
      };
    }

    return this.executeCheck(registration);
  }

  /**
   * Get a complete health report
   *
   * @param useCache - Whether to use cached results for periodic checks
   * @returns Comprehensive health report
   */
  public async getHealthReport(useCache = false): Promise<HealthReport> {
    const results: HealthCheckResult[] = [];

    // Run all checks
    for (const [name, registration] of this.checks) {
      let result: HealthCheckResult;

      if (useCache && this.lastResults.has(name)) {
        result = this.lastResults.get(name)!;
      } else {
        result = await this.executeCheck(registration);
      }

      results.push(result);
    }

    // Calculate overall status
    const overallStatus = this.calculateOverallStatus(results);

    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime,
      timestamp: new Date(),
      checks: results,
      version: this.config.version,
      serverName: this.config.serverName,
    };
  }

  /**
   * Get a quick liveness check
   *
   * @returns Simple liveness response
   */
  public getLiveness(): { alive: boolean; uptime: number } {
    return {
      alive: true,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get a readiness check
   *
   * @returns Whether the server is ready to accept requests
   */
  public async getReadiness(): Promise<{ ready: boolean; checks: string[] }> {
    const failedChecks: string[] = [];

    for (const [name, registration] of this.checks) {
      if (registration.critical) {
        const result = await this.executeCheck(registration);
        if (result.status === 'unhealthy') {
          failedChecks.push(name);
        }
      }
    }

    return {
      ready: failedChecks.length === 0,
      checks: failedChecks,
    };
  }

  /**
   * Start all periodic checks
   */
  public startPeriodicChecks(): void {
    for (const registration of this.checks.values()) {
      if (registration.interval) {
        this.startPeriodicCheck(registration);
      }
    }
    this.logger?.info('Started periodic health checks');
  }

  /**
   * Stop all periodic checks
   */
  public stopPeriodicChecks(): void {
    for (const [name, interval] of this.periodicChecks) {
      clearInterval(interval);
      this.logger?.debug(`Stopped periodic check: ${name}`);
    }
    this.periodicChecks.clear();
    this.logger?.info('Stopped all periodic health checks');
  }

  /**
   * Get the last result for a check
   *
   * @param name - Check name
   * @returns Last check result or undefined
   */
  public getLastResult(name: string): HealthCheckResult | undefined {
    return this.lastResults.get(name);
  }

  /**
   * Get all registered check names
   */
  public getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Register built-in health checks
   */
  private registerBuiltInChecks(): void {
    // Memory check
    this.registerCheck({
      name: 'memory',
      check: createMemoryHealthCheck(),
      critical: false,
      interval: this.config.enablePeriodicChecks
        ? this.config.defaultInterval
        : undefined,
    });

    // Event loop check
    this.registerCheck({
      name: 'event-loop',
      check: createEventLoopHealthCheck(),
      critical: false,
      interval: this.config.enablePeriodicChecks
        ? this.config.defaultInterval
        : undefined,
    });

    // Process check
    this.registerCheck({
      name: 'process',
      check: createProcessHealthCheck(),
      critical: true,
    });
  }

  /**
   * Execute a health check with timeout
   */
  private async executeCheck(
    registration: HealthCheckRegistration
  ): Promise<HealthCheckResult> {
    const timeout = registration.timeout ?? this.config.defaultTimeout ?? 5000;
    const start = Date.now();

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Health check '${registration.name}' timed out after ${timeout}ms`
            )
          );
        }, timeout);
      });

      // Race check against timeout
      const result = await Promise.race([registration.check(), timeoutPromise]);

      // Cache result
      this.lastResults.set(registration.name, result);

      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        name: registration.name,
        status: 'unhealthy',
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - start,
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };

      // Cache failed result
      this.lastResults.set(registration.name, result);

      return result;
    }
  }

  /**
   * Start periodic execution of a health check
   */
  private startPeriodicCheck(registration: HealthCheckRegistration): void {
    // Clear existing interval if any
    const existing = this.periodicChecks.get(registration.name);
    if (existing) {
      clearInterval(existing);
    }

    const interval =
      registration.interval ?? this.config.defaultInterval ?? 30000;

    const timer = setInterval(async () => {
      try {
        const result = await this.executeCheck(registration);
        this.lastResults.set(registration.name, result);

        if (result.status === 'unhealthy' && registration.critical) {
          this.logger?.error(
            `Critical health check failed: ${registration.name}`,
            result
          );
        } else if (result.status !== 'healthy') {
          this.logger?.warning(
            `Health check degraded: ${registration.name}`,
            result
          );
        }
      } catch (error) {
        this.logger?.error(
          `Error running periodic health check: ${registration.name}`,
          error
        );
      }
    }, interval);

    this.periodicChecks.set(registration.name, timer);
    this.logger?.debug(
      `Started periodic check: ${registration.name} (interval: ${interval}ms)`
    );
  }

  /**
   * Calculate overall health status from check results
   */
  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const result of results) {
      const registration = this.checks.get(result.name);

      if (result.status === 'unhealthy') {
        if (registration?.critical) {
          // Critical check failed - overall unhealthy
          return 'unhealthy';
        }
        hasUnhealthy = true;
      } else if (result.status === 'degraded') {
        hasDegraded = true;
      }
    }

    // Non-critical unhealthy or any degraded = degraded
    if (hasUnhealthy || hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }
}

/**
 * Create a health check manager with default configuration
 *
 * @param serverName - Server name
 * @param version - Server version
 * @returns Configured health check manager
 */
export function createHealthCheckManager(
  serverName: string,
  version: string
): HealthCheckManager {
  return new HealthCheckManager({
    serverName,
    version,
  });
}
