/**
 * Prometheus Metrics HTTP Endpoint
 *
 * Provides HTTP server for Prometheus metrics scraping and health checks.
 * Implements /metrics, /health, /ready, /live, /dashboard, and /loglevel
 * endpoints with middleware support.
 *
 * Enhanced endpoints:
 *   - GET  /metrics    - Prometheus exposition format
 *   - GET  /health     - Full health check with component details
 *   - GET  /ready      - Kubernetes readiness probe
 *   - GET  /live       - Kubernetes liveness probe
 *   - GET  /dashboard  - Dashboard-ready JSON metric export
 *   - GET  /alerts     - Active alert summary
 *   - GET  /loglevel   - Current log level configuration
 *   - POST /loglevel   - Dynamic log level adjustment
 */

import * as http from 'http';

import { LogLevelRegistry, type LogLevel } from './logger';
import { Logger } from '../utils/logger';

import type { AlertManager } from './alerts';
import type { HealthChecker } from './health';
import type { MetricsRegistry } from './metrics';
import type { MetricRetentionStore } from './retention';


/**
 * Health check status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check response format
 */
export interface HealthResponse {
  status: HealthStatus;
  version: string;
  uptime: number;
  checks: {
    redis: boolean;
    database: boolean;
    federationRegistry: boolean;
  };
  timestamp: string;
}

/**
 * Readiness check response format
 */
export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  message?: string;
}

/**
 * Health check function signature
 */
export type HealthCheckFunction = () => Promise<boolean>;

/**
 * Health checks configuration
 */
export interface HealthChecks {
  redis?: HealthCheckFunction;
  database?: HealthCheckFunction;
  federationRegistry?: HealthCheckFunction;
}

/**
 * Metrics server configuration
 */
export interface MetricsServerConfig {
  /** Port to listen on (default: 9090) */
  port?: number;
  /** Host to bind to (default: '0.0.0.0') */
  host?: string;
  /** Enable CORS headers (default: true) */
  enableCors?: boolean;
  /** Enable request logging (default: true) */
  enableLogging?: boolean;
  /** Application version for health endpoint */
  version?: string;
  /** Health check functions */
  healthChecks?: HealthChecks;
  /** Enhanced health checker (takes priority over healthChecks if set) */
  healthChecker?: HealthChecker;
  /** Metric retention store for dashboard export */
  retentionStore?: MetricRetentionStore;
  /** Alert manager for alert endpoint */
  alertManager?: AlertManager;
}

/**
 * MetricsServer provides HTTP endpoints for Prometheus metrics and health checks
 */
export class MetricsServer {
  private server: http.Server | null = null;
  private registry: MetricsRegistry;
  private config: Required<Omit<MetricsServerConfig, 'healthChecks' | 'healthChecker' | 'retentionStore' | 'alertManager'>> & {
    healthChecks: HealthChecks;
    healthChecker: HealthChecker | null;
    retentionStore: MetricRetentionStore | null;
    alertManager: AlertManager | null;
  };
  private logger: Logger;
  private startTime: number;
  private isReady: boolean = false;

  constructor(
    registry: MetricsRegistry,
    config: MetricsServerConfig = {},
  ) {
    this.registry = registry;
    this.config = {
      port: config.port ?? 9090,
      host: config.host ?? '0.0.0.0',
      enableCors: config.enableCors ?? true,
      enableLogging: config.enableLogging ?? true,
      version: config.version ?? '1.0.6',
      healthChecks: config.healthChecks ?? {},
      healthChecker: config.healthChecker ?? null,
      retentionStore: config.retentionStore ?? null,
      alertManager: config.alertManager ?? null,
    };
    this.logger = new Logger('MetricsServer');
    this.startTime = Date.now();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (this.server) {
      this.logger.warn('Server already running');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = http.createServer(this.handleRequest.bind(this));

        this.server.on('error', (error) => {
          this.logger.error('Server error:', error);
          reject(error);
        });

        this.server.listen(this.config.port, this.config.host, () => {
          this.isReady = true;
          this.logger.info(
            `Metrics server listening on http://${this.config.host}:${this.config.port}`,
          );
          resolve();
        });
      } catch (error) {
        this.logger.error('Failed to start server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server gracefully
   */
  async stop(): Promise<void> {
    if (!this.server) {
      this.logger.warn('Server not running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.isReady = false;

      this.server!.close((error) => {
        if (error) {
          this.logger.error('Error stopping server:', error);
          reject(error);
        } else {
          this.logger.info('Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Mark server as ready to serve traffic
   */
  setReady(ready: boolean): void {
    this.isReady = ready;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Main request router
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const startTime = Date.now();

    // Apply CORS middleware
    if (this.config.enableCors) {
      this.applyCorsHeaders(res);
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Log request
    if (this.config.enableLogging) {
      this.logger.debug(`${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    }

    try {
      // Route to appropriate handler
      const url = req.url || '/';
      const path = url.split('?')[0];

      switch (path) {
        case '/metrics':
          await this.handleMetrics(req, res);
          break;
        case '/health':
          await this.handleHealth(req, res);
          break;
        case '/ready':
          await this.handleReady(req, res);
          break;
        case '/live':
          this.handleLive(req, res);
          break;
        case '/dashboard':
          this.handleDashboard(req, res);
          break;
        case '/alerts':
          this.handleAlerts(req, res);
          break;
        case '/loglevel':
          await this.handleLogLevel(req, res);
          break;
        default:
          this.handleNotFound(req, res);
      }

      // Log response time
      if (this.config.enableLogging) {
        const duration = Date.now() - startTime;
        this.logger.debug(`${req.method} ${req.url} completed in ${duration}ms`);
      }
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  /**
   * Handle GET /metrics
   * Returns Prometheus-formatted metrics
   */
  private async handleMetrics(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    try {
      const metrics = await this.registry.collect();

      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Content-Length': Buffer.byteLength(metrics),
      });
      res.end(metrics);
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
      this.sendError(res, 500, 'Failed to collect metrics');
    }
  }

  /**
   * Handle GET /health
   * Returns detailed health status. Uses enhanced HealthChecker if available,
   * otherwise falls back to legacy health check functions.
   */
  private async handleHealth(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    try {
      if (this.config.healthChecker) {
        const enhanced = await this.config.healthChecker.check();
        const statusCode = enhanced.status === 'unhealthy' ? 503 : 200;
        this.sendJson(res, statusCode, enhanced);
      } else {
        const healthResponse = await this.performHealthChecks();
        const statusCode = healthResponse.status === 'healthy' ? 200 :
                          healthResponse.status === 'degraded' ? 200 : 503;
        this.sendJson(res, statusCode, healthResponse);
      }
    } catch (error) {
      this.logger.error('Health check failed:', error);
      this.sendError(res, 500, 'Health check failed');
    }
  }

  /**
   * Handle GET /ready
   * Returns readiness status for Kubernetes probes.
   * Uses HealthChecker readiness if available.
   */
  private async handleReady(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    if (this.config.healthChecker) {
      const readiness = this.config.healthChecker.readiness();
      const statusCode = readiness.ready ? 200 : 503;
      this.sendJson(res, statusCode, readiness);
      return;
    }

    const readinessResponse: ReadinessResponse = {
      ready: this.isReady,
      timestamp: new Date().toISOString(),
      message: this.isReady ? 'Service is ready' : 'Service is not ready',
    };

    const statusCode = this.isReady ? 200 : 503;
    this.sendJson(res, statusCode, readinessResponse);
  }

  /**
   * Handle GET /live
   * Kubernetes liveness probe. Returns 200 if the process is alive.
   */
  private handleLive(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    if (this.config.healthChecker) {
      this.sendJson(res, 200, this.config.healthChecker.liveness());
    } else {
      this.sendJson(res, 200, {
        alive: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle GET /dashboard
   * Returns dashboard-ready JSON export from the retention store.
   */
  private handleDashboard(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    if (!this.config.retentionStore) {
      this.sendJson(res, 200, {
        message: 'Retention store not configured',
        metrics: [],
        summary: { totalMetrics: 0, totalRawPoints: 0, totalMinuteRollups: 0, totalHourRollups: 0 },
      });
      return;
    }

    // Parse optional query parameters for time range.
    const url = req.url || '/';
    const queryStart = url.indexOf('?');
    let sinceMs = 0;
    let includeRaw = true;
    let includeMinute = true;
    let includeHour = true;

    if (queryStart !== -1) {
      const params = new URLSearchParams(url.slice(queryStart + 1));
      const since = params.get('since');
      if (since) {
        const parsed = parseInt(since, 10);
        if (!isNaN(parsed)) {
sinceMs = parsed;
}
      }
      if (params.get('raw') === 'false') {
includeRaw = false;
}
      if (params.get('minute') === 'false') {
includeMinute = false;
}
      if (params.get('hour') === 'false') {
includeHour = false;
}
    }

    const dashboard = this.config.retentionStore.exportForDashboard({
      sinceMs,
      includeRaw,
      includeMinute,
      includeHour,
    });

    this.sendJson(res, 200, dashboard);
  }

  /**
   * Handle GET /alerts
   * Returns the current alert summary and active alerts.
   */
  private handleAlerts(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    if (!this.config.alertManager) {
      this.sendJson(res, 200, {
        message: 'Alert manager not configured',
        summary: { total: 0, firing: 0, pending: 0, resolved: 0, bySeverity: { info: 0, warning: 0, critical: 0 } },
        alerts: [],
      });
      return;
    }

    const summary = this.config.alertManager.getSummary();
    const activeAlerts = this.config.alertManager.getActiveAlerts();
    const recentResolved = this.config.alertManager.getResolvedAlerts(20);

    this.sendJson(res, 200, {
      summary,
      activeAlerts,
      recentResolved,
      thresholds: this.config.alertManager.getThresholds(),
    });
  }

  /**
   * Handle GET/POST /loglevel
   * GET: Returns current log level configuration.
   * POST: Adjusts log level dynamically.
   */
  private async handleLogLevel(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const registry = LogLevelRegistry.getInstance();

    if (req.method === 'GET') {
      this.sendJson(res, 200, {
        ...registry.getSnapshot(),
        validLevels: ['debug', 'info', 'warn', 'error'],
      });
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await this.readBody(req);
        const payload = JSON.parse(body);

        const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

        if (payload.level && validLevels.includes(payload.level)) {
          if (payload.component) {
            registry.setComponentLevel(payload.component, payload.level);
          } else {
            registry.setGlobalLevel(payload.level);
          }
          this.sendJson(res, 200, {
            message: payload.component
              ? `Log level for ${payload.component} set to ${payload.level}`
              : `Global log level set to ${payload.level}`,
            ...registry.getSnapshot(),
          });
        } else if (payload.reset) {
          if (payload.component) {
            registry.resetComponent(payload.component);
          } else {
            registry.resetAll();
          }
          this.sendJson(res, 200, {
            message: payload.component
              ? `Log level for ${payload.component} reset`
              : 'All log level overrides cleared',
            ...registry.getSnapshot(),
          });
        } else {
          this.sendError(res, 400, 'Invalid request. Provide { level: "debug"|"info"|"warn"|"error", component?: string } or { reset: true }');
        }
      } catch {
        this.sendError(res, 400, 'Invalid JSON body');
      }
      return;
    }

    this.sendMethodNotAllowed(res, ['GET', 'POST']);
  }

  /**
   * Read the full request body as a string.
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  /**
   * Handle 404 Not Found
   */
  private handleNotFound(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    this.sendError(res, 404, 'Not Found');
  }

  /**
   * Handle errors with proper logging and response
   */
  private handleError(
    error: unknown,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    this.logger.error(`Error handling ${req.method} ${req.url}:`, error);

    if (res.headersSent) {
      return;
    }

    this.sendError(res, 500, 'Internal Server Error');
  }

  /**
   * Perform health checks on all registered services
   */
  private async performHealthChecks(): Promise<HealthResponse> {
    const uptime = Date.now() - this.startTime;
    const checks = {
      redis: false,
      database: false,
      federationRegistry: false,
    };

    // Run health checks in parallel
    const checkPromises: Promise<void>[] = [];

    if (this.config.healthChecks.redis) {
      checkPromises.push(
        this.config.healthChecks.redis()
          .then(result => {
 checks.redis = result; 
})
          .catch(() => {
 checks.redis = false; 
}),
      );
    } else {
      // If no health check provided, assume healthy
      checks.redis = true;
    }

    if (this.config.healthChecks.database) {
      checkPromises.push(
        this.config.healthChecks.database()
          .then(result => {
 checks.database = result; 
})
          .catch(() => {
 checks.database = false; 
}),
      );
    } else {
      checks.database = true;
    }

    if (this.config.healthChecks.federationRegistry) {
      checkPromises.push(
        this.config.healthChecks.federationRegistry()
          .then(result => {
 checks.federationRegistry = result; 
})
          .catch(() => {
 checks.federationRegistry = false; 
}),
      );
    } else {
      checks.federationRegistry = true;
    }

    // Wait for all checks to complete
    await Promise.all(checkPromises);

    // Determine overall health status
    const allHealthy = checks.redis && checks.database && checks.federationRegistry;
    const someHealthy = checks.redis || checks.database || checks.federationRegistry;

    let status: HealthStatus;
    if (allHealthy) {
      status = 'healthy';
    } else if (someHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      version: this.config.version,
      uptime: Math.floor(uptime / 1000), // Convert to seconds
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Apply CORS headers to response
   */
  private applyCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  /**
   * Send JSON response
   */
  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    data: unknown,
  ): void {
    const body = JSON.stringify(data, null, 2);

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  /**
   * Send error response
   */
  private sendError(
    res: http.ServerResponse,
    statusCode: number,
    message: string,
  ): void {
    const errorBody = {
      error: message,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    this.sendJson(res, statusCode, errorBody);
  }

  /**
   * Send 405 Method Not Allowed
   */
  private sendMethodNotAllowed(
    res: http.ServerResponse,
    allowedMethods: string[],
  ): void {
    res.writeHead(405, {
      'Allow': allowedMethods.join(', '),
      'Content-Type': 'application/json',
    });

    const body = JSON.stringify({
      error: 'Method Not Allowed',
      allowedMethods,
      timestamp: new Date().toISOString(),
    });

    res.end(body);
  }
}

/**
 * Create a new metrics server
 */
export function createMetricsServer(
  registry: MetricsRegistry,
  config?: MetricsServerConfig,
): MetricsServer {
  return new MetricsServer(registry, config);
}
