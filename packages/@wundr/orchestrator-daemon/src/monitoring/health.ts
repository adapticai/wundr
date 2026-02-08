/**
 * Enhanced Health Check System for Orchestrator Daemon
 *
 * Provides component-level health checking with latency measurement,
 * subsystem status integration, and configurable health check probes.
 * Extends the existing /health endpoint with deeper introspection.
 *
 * Environment variables:
 *   - HEALTH_CHECK_ENABLED: "true" | "false" (default: "true")
 *   - HEALTH_CHECK_TIMEOUT: per-component timeout in ms (default: 5000)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health status for an individual component.
 */
export interface ComponentHealth {
  /** Component name (e.g., "websocket", "redis", "llmClient"). */
  name: string;
  /** Current health status. */
  status: HealthStatus;
  /** How long the health check took in milliseconds. */
  latency?: number;
  /** Human-readable status message. */
  message?: string;
  /** ISO 8601 timestamp of when this check was performed. */
  lastCheck: string;
  /** Additional component-specific metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Full health response returned by the /health endpoint.
 */
export interface EnhancedHealthResponse {
  /** Aggregate health status (worst of all components). */
  status: HealthStatus;
  /** Application version. */
  version: string;
  /** Uptime in seconds. */
  uptime: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Per-component health results. */
  components: Record<string, ComponentHealth>;
  /** High-level operational metrics snapshot. */
  metrics: HealthMetricsSnapshot;
}

/**
 * Snapshot of key operational metrics included in the health response.
 */
export interface HealthMetricsSnapshot {
  activeSessions: number;
  queuedTasks: number;
  memoryUsageMB: number;
  memoryHeapUsedMB: number;
  memoryHeapTotalMB: number;
  cpuUsagePercent: number;
  uptimeSeconds: number;
  openFileDescriptors?: number;
  eventLoopLagMs?: number;
}

/**
 * A health check probe: an async function that returns a ComponentHealth.
 */
export type HealthCheckProbe = () => Promise<ComponentHealth>;

/**
 * Configuration for the health check system.
 */
export interface HealthCheckConfig {
  /** Enable/disable health checks. */
  enabled?: boolean;
  /** Timeout per component check in milliseconds. */
  timeoutMs?: number;
  /** Application version string. */
  version?: string;
  /** Process start time (Date.now()). */
  startTime?: number;
}

/**
 * Status provider interface: implemented by OrchestratorDaemon to expose
 * subsystem status without circular dependencies.
 */
export interface DaemonStatusProvider {
  getActiveSessions(): number;
  getQueuedTasks(): number;
  getSubsystemStatus(): Record<
    string,
    { status: string; lastCheck: Date; errors?: string[] }
  >;
}

// ---------------------------------------------------------------------------
// Built-in probes
// ---------------------------------------------------------------------------

/**
 * Create a probe for a simple async health check function.
 * Wraps the check with timeout handling and latency measurement.
 */
export function createProbe(
  name: string,
  checkFn: () => Promise<boolean>,
  timeoutMs: number = 5000,
): HealthCheckProbe {
  return async (): Promise<ComponentHealth> => {
    const start = Date.now();

    try {
      const result = await Promise.race([
        checkFn(),
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), timeoutMs),
        ),
      ]);

      const latency = Date.now() - start;

      if (result === 'timeout') {
        return {
          name,
          status: 'degraded',
          latency,
          message: `Health check timed out after ${timeoutMs}ms`,
          lastCheck: new Date().toISOString(),
        };
      }

      return {
        name,
        status: result ? 'healthy' : 'unhealthy',
        latency,
        message: result ? 'OK' : 'Check returned false',
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - start;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        name,
        status: 'unhealthy',
        latency,
        message: `Check failed: ${errorMessage}`,
        lastCheck: new Date().toISOString(),
      };
    }
  };
}

/**
 * Create a probe that checks a subsystem status value from the daemon.
 */
export function createSubsystemProbe(
  name: string,
  getStatus: () => { status: string; lastCheck: Date; errors?: string[] },
): HealthCheckProbe {
  return async (): Promise<ComponentHealth> => {
    try {
      const sub = getStatus();
      let status: HealthStatus;

      switch (sub.status) {
        case 'running':
          status = 'healthy';
          break;
        case 'degraded':
          status = 'degraded';
          break;
        default:
          status = 'unhealthy';
      }

      return {
        name,
        status,
        message: sub.errors?.join('; ') ?? sub.status,
        lastCheck: sub.lastCheck.toISOString(),
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date().toISOString(),
      };
    }
  };
}

// ---------------------------------------------------------------------------
// Process metrics collector
// ---------------------------------------------------------------------------

/**
 * Collect a snapshot of process-level metrics.
 */
function collectProcessMetrics(startTime: number): HealthMetricsSnapshot {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  // CPU usage as a rough percentage (user + system time over process uptime)
  const totalCpuMicroseconds = cpuUsage.user + cpuUsage.system;
  const totalCpuSeconds = totalCpuMicroseconds / 1_000_000;
  const processUptimeSeconds = process.uptime();
  const cpuUsagePercent =
    processUptimeSeconds > 0
      ? Math.round((totalCpuSeconds / processUptimeSeconds) * 100 * 100) / 100
      : 0;

  return {
    activeSessions: 0, // Filled by caller
    queuedTasks: 0, // Filled by caller
    memoryUsageMB: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
    memoryHeapUsedMB:
      Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
    memoryHeapTotalMB:
      Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
    cpuUsagePercent,
    uptimeSeconds,
  };
}

// ---------------------------------------------------------------------------
// HealthChecker
// ---------------------------------------------------------------------------

/**
 * Orchestrates health check probes and produces a unified health response.
 *
 * @example
 * ```ts
 * const checker = new HealthChecker({
 *   version: '1.0.6',
 *   startTime: Date.now(),
 * });
 *
 * // Register probes
 * checker.registerProbe('redis', createProbe('redis', async () => {
 *   await redisClient.ping();
 *   return true;
 * }));
 *
 * checker.registerProbe('websocket', createSubsystemProbe('websocket', () => ({
 *   status: 'running',
 *   lastCheck: new Date(),
 * })));
 *
 * // Perform full health check
 * const health = await checker.check();
 * // => { status: 'healthy', components: {...}, metrics: {...} }
 * ```
 */
export class HealthChecker {
  private readonly config: Required<HealthCheckConfig>;
  private readonly probes: Map<string, HealthCheckProbe> = new Map();
  private statusProvider: DaemonStatusProvider | null = null;

  /** Cache of the most recent health check result for fast reads. */
  private lastResult: EnhancedHealthResponse | null = null;
  private lastCheckTime: number = 0;

  /** Minimum interval between full health checks (prevents thundering herd). */
  private static readonly MIN_CHECK_INTERVAL_MS = 1000;

  constructor(config?: HealthCheckConfig) {
    this.config = {
      enabled: config?.enabled ?? (process.env['HEALTH_CHECK_ENABLED'] !== 'false'),
      timeoutMs: config?.timeoutMs ?? parseInt(process.env['HEALTH_CHECK_TIMEOUT'] ?? '5000', 10),
      version: config?.version ?? '1.0.6',
      startTime: config?.startTime ?? Date.now(),
    };
  }

  // -----------------------------------------------------------------------
  // Probe Registration
  // -----------------------------------------------------------------------

  /**
   * Register a health check probe for a named component.
   */
  registerProbe(name: string, probe: HealthCheckProbe): void {
    this.probes.set(name, probe);
  }

  /**
   * Remove a health check probe by name.
   */
  removeProbe(name: string): boolean {
    return this.probes.delete(name);
  }

  /**
   * Set the daemon status provider for injecting operational metrics.
   */
  setStatusProvider(provider: DaemonStatusProvider): void {
    this.statusProvider = provider;
  }

  /**
   * Register multiple probes from a map.
   */
  registerProbes(probes: Record<string, HealthCheckProbe>): void {
    for (const [name, probe] of Object.entries(probes)) {
      this.registerProbe(name, probe);
    }
  }

  // -----------------------------------------------------------------------
  // Health Check Execution
  // -----------------------------------------------------------------------

  /**
   * Perform a full health check across all registered probes.
   * Results are cached for MIN_CHECK_INTERVAL_MS to prevent overload.
   */
  async check(): Promise<EnhancedHealthResponse> {
    if (!this.config.enabled) {
      return this.buildDisabledResponse();
    }

    // Return cached result if within the minimum check interval
    const now = Date.now();
    if (
      this.lastResult &&
      now - this.lastCheckTime < HealthChecker.MIN_CHECK_INTERVAL_MS
    ) {
      return this.lastResult;
    }

    // Run all probes in parallel
    const componentResults: Record<string, ComponentHealth> = {};
    const probePromises: Promise<void>[] = [];

    for (const [name, probe] of this.probes) {
      probePromises.push(
        this.executeProbe(name, probe).then((result) => {
          componentResults[name] = result;
        }),
      );
    }

    await Promise.all(probePromises);

    // Determine aggregate status
    const statuses = Object.values(componentResults).map((c) => c.status);
    const aggregateStatus = this.computeAggregateStatus(statuses);

    // Collect process metrics
    const metrics = collectProcessMetrics(this.config.startTime);

    // Inject operational metrics from the status provider
    if (this.statusProvider) {
      metrics.activeSessions = this.statusProvider.getActiveSessions();
      metrics.queuedTasks = this.statusProvider.getQueuedTasks();
    }

    const response: EnhancedHealthResponse = {
      status: aggregateStatus,
      version: this.config.version,
      uptime: Math.floor((now - this.config.startTime) / 1000),
      timestamp: new Date(now).toISOString(),
      components: componentResults,
      metrics,
    };

    // Cache result
    this.lastResult = response;
    this.lastCheckTime = now;

    return response;
  }

  /**
   * Quick liveness check (no probe execution, just returns if the process is alive).
   */
  liveness(): { alive: boolean; timestamp: string } {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check: returns true only if the last health check was healthy
   * or degraded (not unhealthy).
   */
  readiness(): { ready: boolean; timestamp: string; message?: string } {
    if (!this.lastResult) {
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        message: 'No health check has been performed yet',
      };
    }

    const ready = this.lastResult.status !== 'unhealthy';
    return {
      ready,
      timestamp: new Date().toISOString(),
      message: ready
        ? `Service is ready (status: ${this.lastResult.status})`
        : 'Service is unhealthy',
    };
  }

  /**
   * Get the most recent health check result without performing a new check.
   */
  getLastResult(): EnhancedHealthResponse | null {
    return this.lastResult;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  /**
   * Execute a single probe with timeout protection.
   */
  private async executeProbe(
    name: string,
    probe: HealthCheckProbe,
  ): Promise<ComponentHealth> {
    try {
      const result = await Promise.race<ComponentHealth | 'timeout'>([
        probe(),
        new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), this.config.timeoutMs),
        ),
      ]);

      if (result === 'timeout') {
        return {
          name,
          status: 'degraded',
          latency: this.config.timeoutMs,
          message: `Probe timed out after ${this.config.timeoutMs}ms`,
          lastCheck: new Date().toISOString(),
        };
      }

      return result;
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: `Probe error: ${error instanceof Error ? error.message : String(error)}`,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Compute aggregate health from component statuses.
   * - All healthy = healthy
   * - Any degraded (none unhealthy) = degraded
   * - Any unhealthy = unhealthy
   * - No components = healthy (vacuously true)
   */
  private computeAggregateStatus(statuses: HealthStatus[]): HealthStatus {
    if (statuses.length === 0) return 'healthy';

    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const status of statuses) {
      if (status === 'unhealthy') hasUnhealthy = true;
      if (status === 'degraded') hasDegraded = true;
    }

    if (hasUnhealthy) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  /**
   * Build a response when health checks are disabled.
   */
  private buildDisabledResponse(): EnhancedHealthResponse {
    return {
      status: 'healthy',
      version: this.config.version,
      uptime: Math.floor((Date.now() - this.config.startTime) / 1000),
      timestamp: new Date().toISOString(),
      components: {},
      metrics: collectProcessMetrics(this.config.startTime),
    };
  }
}

// ---------------------------------------------------------------------------
// HTTP Response Helpers
// ---------------------------------------------------------------------------

/**
 * Map an EnhancedHealthResponse to an HTTP status code.
 */
export function healthStatusToHttpCode(status: HealthStatus): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still serving traffic
    case 'unhealthy':
      return 503;
    default:
      return 500;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a HealthChecker with sensible defaults.
 */
export function createHealthChecker(
  config?: HealthCheckConfig,
): HealthChecker {
  return new HealthChecker(config);
}
