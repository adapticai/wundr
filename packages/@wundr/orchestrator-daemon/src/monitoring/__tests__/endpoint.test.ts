/**
 * Tests for Metrics HTTP Endpoint
 */

import * as http from 'http';
import { MetricsServer, createMetricsServer } from '../endpoint';
import { MetricsRegistry } from '../metrics';

describe('MetricsServer', () => {
  let server: MetricsServer;
  let registry: MetricsRegistry;
  const testPort = 9091;

  beforeEach(() => {
    registry = new MetricsRegistry();
    registry.register();
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
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
      const response = await makeRequest('GET', '/metrics');

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.body).toContain('orchestrator_');
    });

    it('should reject non-GET requests', async () => {
      const response = await makeRequest('POST', '/metrics');

      expect(response.statusCode).toBe(405);
      expect(response.headers['allow']).toContain('GET');
    });

    it('should include CORS headers when enabled', async () => {
      const response = await makeRequest('GET', '/metrics');

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should handle OPTIONS preflight request', async () => {
      const response = await makeRequest('OPTIONS', '/metrics');

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
      const response = await makeRequest('GET', '/health');
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

      server = createMetricsServer(registry, {
        port: testPort,
        healthChecks: {
          redis: async () => true,
          database: async () => false,
          federationRegistry: async () => true,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health');
      const health = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(health.status).toBe('degraded');
      expect(health.checks.redis).toBe(true);
      expect(health.checks.database).toBe(false);
      expect(health.checks.federationRegistry).toBe(true);
    });

    it('should return unhealthy status when all checks fail', async () => {
      await server.stop();

      server = createMetricsServer(registry, {
        port: testPort,
        healthChecks: {
          redis: async () => false,
          database: async () => false,
          federationRegistry: async () => false,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health');
      const health = JSON.parse(response.body);

      expect(response.statusCode).toBe(503);
      expect(health.status).toBe('unhealthy');
    });

    it('should handle health check errors gracefully', async () => {
      await server.stop();

      server = createMetricsServer(registry, {
        port: testPort,
        healthChecks: {
          redis: async () => { throw new Error('Redis connection failed'); },
          database: async () => true,
        },
      });
      await server.start();

      const response = await makeRequest('GET', '/health');
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
      const response = await makeRequest('GET', '/ready');
      const readiness = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(readiness.ready).toBe(true);
      expect(readiness.timestamp).toBeDefined();
      expect(readiness.message).toContain('ready');
    });

    it('should return not ready when marked', async () => {
      server.setReady(false);

      const response = await makeRequest('GET', '/ready');
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
      const response = await makeRequest('GET', '/unknown');

      expect(response.statusCode).toBe(404);
      const error = JSON.parse(response.body);
      expect(error.error).toBe('Not Found');
    });

    it('should include timestamp in error responses', async () => {
      const response = await makeRequest('GET', '/unknown');
      const error = JSON.parse(response.body);

      expect(error.timestamp).toBeDefined();
      expect(new Date(error.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('configuration', () => {
    it('should use custom port and host', async () => {
      server = createMetricsServer(registry, {
        port: 9092,
        host: 'localhost',
      });

      await server.start();

      const response = await makeRequest('GET', '/health', 9092);
      expect(response.statusCode).toBe(200);
    });

    it('should disable CORS when configured', async () => {
      server = createMetricsServer(registry, {
        port: testPort,
        enableCors: false,
      });
      await server.start();

      const response = await makeRequest('GET', '/metrics');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  /**
   * Helper function to make HTTP requests
   */
  function makeRequest(
    method: string,
    path: string,
    port: number = testPort
  ): Promise<{
    statusCode: number;
    headers: http.IncomingHttpHeaders;
    body: string;
  }> {
    return new Promise((resolve, reject) => {
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
        }
      );

      req.on('error', reject);
      req.end();
    });
  }
});
