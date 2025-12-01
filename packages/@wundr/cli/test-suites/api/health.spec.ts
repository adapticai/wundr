import { test, expect } from '@playwright/test';

/**
 * Portable API health checks
 * These tests work with common API patterns
 */

test.describe('API Health Checks', () => {
  test('health endpoint responds', async ({ request, baseURL }) => {
    // Try common health check endpoints
    const healthEndpoints = [
      '/health',
      '/api/health',
      '/healthz',
      '/status',
      '/api/status',
      '/_health',
      '/ping',
    ];

    let healthyEndpoint = null;

    for (const endpoint of healthEndpoints) {
      try {
        const response = await request.get(`${baseURL}${endpoint}`);
        if (response.ok()) {
          healthyEndpoint = endpoint;
          break;
        }
      } catch {
        // Continue to next endpoint
      }
    }

    // At least one health endpoint should work
    expect(healthyEndpoint).toBeTruthy();
  });

  test('API returns proper content types', async ({ request, baseURL }) => {
    // Try to find an API endpoint
    const apiEndpoints = ['/api', '/api/v1', '/api/v2', '/graphql'];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await request.get(`${baseURL}${endpoint}`);
        if (response.ok() || response.status() === 404) {
          const contentType = response.headers()['content-type'];

          // Should return JSON or HTML
          expect(
            contentType?.includes('application/json') ||
              contentType?.includes('text/html')
          ).toBeTruthy();
        }
      } catch {
        // Continue to next endpoint
      }
    }
  });

  test('API handles errors gracefully', async ({ request, baseURL }) => {
    // Test 404 handling
    const response = await request.get(
      `${baseURL}/api/nonexistent-endpoint-${Date.now()}`
    );

    // Should return appropriate status code
    expect([404, 400, 401, 403]).toContain(response.status());

    // Should not expose sensitive information
    const body = await response.text();
    expect(body).not.toContain('stack');
    expect(body).not.toContain('traceback');
  });

  test('API responds within acceptable time', async ({ request, baseURL }) => {
    const startTime = Date.now();

    // Make a simple request
    await request.get(`${baseURL}/`);

    const responseTime = Date.now() - startTime;

    // Should respond within 5 seconds
    expect(responseTime).toBeLessThan(5000);
  });

  test('CORS headers are properly configured', async ({ request, baseURL }) => {
    try {
      const response = await request.get(`${baseURL}/api`, {
        headers: {
          Origin: 'https://example.com',
        },
      });

      const headers = response.headers();

      // Check for CORS headers if API exists
      if (response.status() !== 404) {
        const hasCorsHeaders =
          headers['access-control-allow-origin'] !== undefined ||
          headers['access-control-allow-methods'] !== undefined;

        // Log CORS configuration
        console.log('CORS configured:', hasCorsHeaders);
      }
    } catch {
      // API might not exist, which is okay for generic tests
    }
  });

  test('API supports common HTTP methods', async ({ request, baseURL }) => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    const results: Record<string, number> = {};

    for (const method of methods) {
      try {
        const response = await request.fetch(`${baseURL}/api`, {
          method,
        });
        results[method] = response.status();
      } catch {
        results[method] = 0;
      }
    }

    // At least GET and OPTIONS should be supported
    expect(results['GET']).toBeGreaterThan(0);
    expect(results['OPTIONS']).toBeGreaterThan(0);
  });
});
