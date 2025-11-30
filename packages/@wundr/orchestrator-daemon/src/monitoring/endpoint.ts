/**
 * Prometheus Metrics HTTP Endpoint
 *
 * Provides HTTP server for Prometheus metrics scraping and health checks.
 * Implements /metrics, /health, and /ready endpoints with middleware support.
 */

import * as http from 'http';
import type { MetricsRegistry } from './metrics';
import { Logger } from '../utils/logger';

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
}

/**
 * HTTP request handler type
 */
type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>;

/**
 * MetricsServer provides HTTP endpoints for Prometheus metrics and health checks
 */
export class MetricsServer {
  private server: http.Server | null = null;
  private registry: MetricsRegistry;
  private config: Required<Omit<MetricsServerConfig, 'healthChecks'>> & { healthChecks: HealthChecks };
  private logger: Logger;
  private startTime: number;
  private isReady: boolean = false;

  constructor(
    registry: MetricsRegistry,
    config: MetricsServerConfig = {}
  ) {
    this.registry = registry;
    this.config = {
      port: config.port ?? 9090,
      host: config.host ?? '0.0.0.0',
      enableCors: config.enableCors ?? true,
      enableLogging: config.enableLogging ?? true,
      version: config.version ?? '1.0.6',
      healthChecks: config.healthChecks ?? {},
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
            `Metrics server listening on http://${this.config.host}:${this.config.port}`
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
    res: http.ServerResponse
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
    res: http.ServerResponse
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
   * Returns detailed health status
   */
  private async handleHealth(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
      return;
    }

    try {
      const healthResponse = await this.performHealthChecks();
      const statusCode = healthResponse.status === 'healthy' ? 200 :
                        healthResponse.status === 'degraded' ? 200 : 503;

      this.sendJson(res, statusCode, healthResponse);
    } catch (error) {
      this.logger.error('Health check failed:', error);
      this.sendError(res, 500, 'Health check failed');
    }
  }

  /**
   * Handle GET /ready
   * Returns readiness status for Kubernetes probes
   */
  private async handleReady(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (req.method !== 'GET') {
      this.sendMethodNotAllowed(res, ['GET']);
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
   * Handle 404 Not Found
   */
  private handleNotFound(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    this.sendError(res, 404, 'Not Found');
  }

  /**
   * Handle errors with proper logging and response
   */
  private handleError(
    error: unknown,
    req: http.IncomingMessage,
    res: http.ServerResponse
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
          .then(result => { checks.redis = result; })
          .catch(() => { checks.redis = false; })
      );
    } else {
      // If no health check provided, assume healthy
      checks.redis = true;
    }

    if (this.config.healthChecks.database) {
      checkPromises.push(
        this.config.healthChecks.database()
          .then(result => { checks.database = result; })
          .catch(() => { checks.database = false; })
      );
    } else {
      checks.database = true;
    }

    if (this.config.healthChecks.federationRegistry) {
      checkPromises.push(
        this.config.healthChecks.federationRegistry()
          .then(result => { checks.federationRegistry = result; })
          .catch(() => { checks.federationRegistry = false; })
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
    data: unknown
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
    message: string
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
    allowedMethods: string[]
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
  config?: MetricsServerConfig
): MetricsServer {
  return new MetricsServer(registry, config);
}
