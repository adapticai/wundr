# Middleware Testing Guide

## Test Recommendations

### 1. Authentication Tests

#### Test: Public Routes Don't Require Auth

```typescript
// __tests__/middleware/public-routes.test.ts
import { NextRequest } from 'next/server';
import middleware from '@/middleware';

describe('Public Routes', () => {
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/api/health'];

  publicRoutes.forEach(route => {
    it(`should allow access to ${route} without authentication`, async () => {
      const request = new NextRequest(new URL(route, 'http://localhost:3000'));
      const response = await middleware(request);

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302); // No redirect
    });
  });
});
```

#### Test: Protected Routes Require Auth

```typescript
describe('Protected Routes', () => {
  it('should redirect unauthenticated users from /dashboard', async () => {
    const request = new NextRequest(new URL('/dashboard', 'http://localhost:3000'));
    const response = await middleware(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('location')).toContain('callbackUrl=%2Fdashboard');
  });

  it('should return 401 for unauthenticated API requests', async () => {
    const request = new NextRequest(new URL('/api/users/me', 'http://localhost:3000'));
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });
});
```

### 2. Rate Limiting Tests

#### Test: Rate Limit Enforcement

```typescript
// __tests__/middleware/rate-limit.test.ts
describe('Rate Limiting', () => {
  it('should enforce rate limits on API routes', async () => {
    const ip = '192.168.1.100';
    const requests = [];

    // Make 101 requests (limit is 100)
    for (let i = 0; i < 101; i++) {
      const request = new NextRequest(new URL('/api/users/me', 'http://localhost:3000'), {
        headers: { 'x-forwarded-for': ip },
      });
      requests.push(middleware(request));
    }

    const responses = await Promise.all(requests);
    const lastResponse = responses[responses.length - 1];

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers.get('Retry-After')).toBeTruthy();
  });

  it('should include rate limit headers', async () => {
    const request = new NextRequest(new URL('/api/health', 'http://localhost:3000'));
    const response = await middleware(request);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('should isolate rate limits by IP', async () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    // Exhaust IP1's limit
    for (let i = 0; i < 100; i++) {
      await middleware(
        new NextRequest(new URL('/api/health', 'http://localhost:3000'), {
          headers: { 'x-forwarded-for': ip1 },
        })
      );
    }

    // IP2 should still have full limit
    const request = new NextRequest(new URL('/api/health', 'http://localhost:3000'), {
      headers: { 'x-forwarded-for': ip2 },
    });
    const response = await middleware(request);

    expect(response.status).not.toBe(429);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
  });
});
```

### 3. CORS Tests

#### Test: CORS Headers

```typescript
// __tests__/middleware/cors.test.ts
describe('CORS', () => {
  it('should add CORS headers for allowed origins', async () => {
    const request = new NextRequest(new URL('/api/health', 'http://localhost:3000'), {
      headers: { origin: 'http://localhost:3000' },
    });
    const response = await middleware(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should not add CORS headers for disallowed origins', async () => {
    const request = new NextRequest(new URL('/api/health', 'http://localhost:3000'), {
      headers: { origin: 'https://evil.com' },
    });
    const response = await middleware(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.com');
  });

  it('should handle OPTIONS preflight requests', async () => {
    const request = new NextRequest(new URL('/api/users/me', 'http://localhost:3000'), {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const response = await middleware(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
});
```

### 4. Static Asset Tests

#### Test: Skip Middleware for Static Assets

```typescript
describe('Static Assets', () => {
  const staticPaths = [
    '/_next/static/chunks/main.js',
    '/_next/image?url=/logo.png',
    '/favicon.ico',
    '/images/logo.png',
    '/fonts/inter.woff2',
  ];

  staticPaths.forEach(path => {
    it(`should skip middleware for ${path}`, async () => {
      const request = new NextRequest(new URL(path, 'http://localhost:3000'));
      const response = await middleware(request);

      // Should pass through without modification
      expect(response.headers.get('X-RateLimit-Limit')).toBeNull();
    });
  });
});
```

### 5. Integration Tests with Playwright

#### Test: Full Authentication Flow

```typescript
// tests/e2e/middleware-auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Middleware Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  });

  test('allows authenticated users to access protected routes', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should be able to access dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('preserves callback URL after login', async ({ page }) => {
    await page.goto('/workspace/123/channels');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);

    // Login
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should redirect back to original URL
    await expect(page).toHaveURL('/workspace/123/channels');
  });
});
```

#### Test: API Rate Limiting

```typescript
test.describe('Middleware Rate Limiting', () => {
  test('enforces rate limits on API endpoints', async ({ request }) => {
    const responses = [];

    // Make 101 requests
    for (let i = 0; i < 101; i++) {
      responses.push(await request.get('/api/health'));
    }

    const lastResponse = responses[responses.length - 1];
    expect(lastResponse.status()).toBe(429);

    const body = await lastResponse.json();
    expect(body.error).toBe('Too Many Requests');
  });

  test('includes rate limit headers in responses', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.headers()['x-ratelimit-limit']).toBe('100');
    expect(response.headers()['x-ratelimit-remaining']).toBeTruthy();
  });
});
```

### 6. Manual Testing Checklist

#### Authentication

- [ ] Login page is publicly accessible
- [ ] Register page is publicly accessible
- [ ] Dashboard redirects to login when not authenticated
- [ ] Callback URL is preserved after redirect
- [ ] API returns 401 for unauthenticated requests
- [ ] Static assets load without authentication
- [ ] OAuth callbacks work correctly

#### Rate Limiting

- [ ] Rate limit headers appear in API responses
- [ ] 100 requests per minute limit is enforced
- [ ] 429 response includes reset time
- [ ] Rate limits reset after 1 minute
- [ ] Different IPs have separate limits
- [ ] Rate limiting doesn't affect non-API routes

#### CORS

- [ ] CORS headers present on API responses
- [ ] OPTIONS preflight requests return 204
- [ ] Allowed origins can make requests
- [ ] Disallowed origins are blocked
- [ ] Credentials are allowed

#### Security

- [ ] X-Frame-Options header present
- [ ] X-Content-Type-Options header present
- [ ] Referrer-Policy header present
- [ ] No sensitive data in error responses

## Test Environment Setup

### 1. Create Test Utilities

```typescript
// __tests__/utils/middleware-helpers.ts
import { NextRequest } from 'next/server';

export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
  }
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options?.method || 'GET',
    headers: new Headers(options?.headers || {}),
  });
}

export function createAuthenticatedRequest(url: string, sessionToken: string): NextRequest {
  return createMockRequest(url, {
    headers: {
      cookie: `next-auth.session-token=${sessionToken}`,
    },
  });
}
```

### 2. Mock NextAuth Session

```typescript
// __tests__/setup/next-auth-mock.ts
import { vi } from 'vitest';

vi.mock('@/lib/auth.edge', () => ({
  auth: vi.fn(() => null), // No session by default
}));

export function mockAuthSession(session: any) {
  const { auth } = require('@/lib/auth.edge');
  auth.mockResolvedValue(session);
}

export function clearAuthSession() {
  const { auth } = require('@/lib/auth.edge');
  auth.mockResolvedValue(null);
}
```

### 3. Test Configuration

```typescript
// vitest.config.ts
export default {
  test: {
    environment: 'edge-runtime', // For middleware tests
    setupFiles: ['__tests__/setup/next-auth-mock.ts'],
  },
};
```

## Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Specific test file
npm run test middleware.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Middleware Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Performance Testing

Test middleware performance impact:

```typescript
// __tests__/performance/middleware-bench.test.ts
describe('Middleware Performance', () => {
  it('should process requests within 50ms', async () => {
    const start = performance.now();

    await middleware(createMockRequest('/api/health'));

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(50);
  });

  it('should handle 1000 concurrent requests', async () => {
    const requests = Array.from({ length: 1000 }, () =>
      middleware(createMockRequest('/api/health'))
    );

    const start = performance.now();
    await Promise.all(requests);
    const duration = performance.now() - start;

    // Should complete in under 1 second
    expect(duration).toBeLessThan(1000);
  });
});
```
