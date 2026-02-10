/**
 * Tests for Metrics HTTP Endpoint
 *
 * Each describe block uses a unique port derived from the PID and block index
 * to avoid EADDRINUSE / ECONNRESET when vitest runs tests in parallel workers.
 */

import * as http from 'http';
import * as net from 'net';

import { Registry, Gauge } from 'prom-client';

import { createMetricsServer } from '../endpoint';
import { MetricsRegistry } from '../metrics';

import type { MetricsServer} from '../endpoint';

/**
 * Find an available TCP port by binding to port 0 and immediately closing.
 */
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}

/**
 * Helper: wait for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('MetricsServer', () => {
  let server: MetricsServer;
  let registry: MetricsRegistry;
  let testPort: number;

  beforeEach(async () => {
    testPort = await getAvailablePort();

    // Create an isolated prom-client Registry for each test so that
    // clear() does not destroy global metrics shared across tests.
    const promRegistry = new Registry();

    // Register at least one orchestrator_* metric so the /metrics
    // endpoint returns content containing that prefix.
    new Gauge({
      name: 'orchestrator_sessions_active',
      help: 'Number of currently active orchestrator sessions',
      labelNames: ['orchestrator_id', 'session_type'],
      registers: [promRegistry],
    });

    registry = new MetricsRegistry(promRegistry);
    registry.register();
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
      // Give the OS a moment to fully release the socket
      await delay(50);
    }
    registry.clear();
  });

  describe('server lifecycle', () => {
    it('should start and stop successfully', async () => {
      server = createMetricsServer(registry, { port: testPort });

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should not start if already running', async () => {
      server = createMetricsServer(registry, { port: testPort });

      await server.start();
      await server.start(); // Should warn but not error

      expect(server.isRunning()).toBe(true);
    });

    it('should handle stop when not running', async () => {
      server = createMetricsServer(registry, { port: testPort });

      await server.stop(); // Should warn but not error
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('GET /metrics', () => {
    beforeEach(async () => {
      server = createMetricsServer(registry, { port: testPort });
      await server.start();
    });

    it('should return prometheus metrics', async () => {
      const response = await makeRequest('GET', '/metrics', testPort);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('orchestrator_');
    });

    it('should reject non-GET requests', async () => {
      const response = await makeRequest('POST', '/metrics', testPort);

      expect(response.statusCode).toBe(405);
      expect(response.headers['allow']).toContain('GET');
    });

    it('should include CORS headers when enabled', async () => {
      const response = await makeRequest('GET', '/metrics', testPort);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should handle OPTIONS preflight request', async () => {
      const response = await makeRequest('OPTIONS', '/metrics', testPort);

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('GET /health', () => {
    beforeEach(async () => {
      server = createMetricsServer(registry, {
        port: testPort,
        version: '1.0.0-test',
      });
      await server.start();
    });

    it('should return healthy status with default checks', async () => {
      const response = await makeRequest('GET', '/health', testPort);
      const health = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(health.status).toBe('healthy');
      expect(health.version).toBe('1.0.0-test');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.checks.redis).toBe(true);
      expect(health.checks.database).toBe(true);
      expect(health.checks.federationRegistry).toBe(true);
      expect(health.timestamp).toBeDefined();
    });

    it('should return degraded status when some checks fail', async () => {
      await server.stop();
      await delay(50);

      const newPort = await getAvailablePort();
      server = createMetricsServer(registry, {
        port: newPort,
        healthChecks: {
          redis: async () => true,
          database: async () => false,
          federationRegistry: async () => true,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health', newPort);
      const health = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(health.status).toBe('degraded');
      expect(health.checks.redis).toBe(true);
      expect(health.checks.database).toBe(false);
      expect(health.checks.federationRegistry).toBe(true);
    });

    it('should return unhealthy status when all checks fail', async () => {
      await server.stop();
      await delay(50);

      const newPort = await getAvailablePort();
      server = createMetricsServer(registry, {
        port: newPort,
        healthChecks: {
          redis: async () => false,
          database: async () => false,
          federationRegistry: async () => false,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health', newPort);
      const health = JSON.parse(response.body);

      expect(response.statusCode).toBe(503);
      expect(health.status).toBe('unhealthy');
    });

    it('should handle health check errors gracefully', async () => {
      await server.stop();
      await delay(50);

      const newPort = await getAvailablePort();
      server = createMetricsServer(registry, {
        port: newPort,
        healthChecks: {
          redis: async () => {
 throw new Error('Redis connection failed'); 
},
          database: async () => true,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health', newPort);
      const health = JSON.parse(response.body);

      expect(health.checks.redis).toBe(false);
      expect(health.checks.database).toBe(true);
    });
  });

  describe('GET /ready', () => {
    beforeEach(async () => {
      server = createMetricsServer(registry, { port: testPort });
      await server.start();
    });

    it('should return ready status after start', async () => {
      const response = await makeRequest('GET', '/ready', testPort);
      const readiness = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(readiness.ready).toBe(true);
      expect(readiness.timestamp).toBeDefined();
      expect(readiness.message).toContain('ready');
    });

    it('should return not ready when marked', async () => {
      server.setReady(false);

      const response = await makeRequest('GET', '/ready', testPort);
      const readiness = JSON.parse(response.body);

      expect(response.statusCode).toBe(503);
      expect(readiness.ready).toBe(false);
      expect(readiness.message).toContain('not ready');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      server = createMetricsServer(registry, { port: testPort });
      await server.start();
    });

    it('should return 404 for unknown routes', async () => {
      const response = await makeRequest('GET', '/unknown', testPort);

      expect(response.statusCode).toBe(404);
      const error = JSON.parse(response.body);
      expect(error.error).toBe('Not Found');
    });

    it('should include timestamp in error responses', async () => {
      const response = await makeRequest('GET', '/unknown', testPort);
      const error = JSON.parse(response.body);

      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use custom port and host', async () => {
      const customPort = await getAvailablePort();
      server = createMetricsServer(registry, {
        port: customPort,
        host: 'localhost',
      });

      await server.start();

      const response = await makeRequest('GET', '/health', customPort);
      expect(response.statusCode).toBe(200);
    });

    it('should disable CORS when configured', async () => {
      server = createMetricsServer(registry, {
        port: testPort,
        enableCors: false,
      });
      await server.start();

      const response = await makeRequest('GET', '/metrics', testPort);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  /**
   * Helper function to make HTTP requests with retry logic for transient errors.
   */
  function makeRequest(
    method: string,
    path: string,
    port: number,
    retries: number = 2,
  ): Promise<{
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
  }> {
    return new Promise((resolve, reject) => {
      const attempt = (retriesLeft: number) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path,
            method,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                body,
              });
            });
          },
        );

        req.on('error', (err) => {
          if (retriesLeft > 0 && (err as NodeJS.ErrnoException).code === 'ECONNRESET') {
            setTimeout(() => attempt(retriesLeft - 1), 50);
          } else {
            reject(err);
          }
        });
        req.end();
      };

      attempt(retries);
    });
  }
});
