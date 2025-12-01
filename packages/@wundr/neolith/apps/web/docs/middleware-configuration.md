# Middleware Configuration Guide

## Overview

The Next.js middleware at `/middleware.ts` provides comprehensive security and access control:

1. **Authentication** - NextAuth.js v5 session validation
2. **Rate Limiting** - Request throttling per IP
3. **CORS** - Cross-Origin Resource Sharing
4. **Security Headers** - Additional protection layers

## Authentication

### Protected Routes

All routes are protected by default **except**:

- `/` - Landing page
- `/login` - Sign in page
- `/register` - Sign up page
- `/forgot-password` - Password reset
- `/reset-password` - Password reset confirmation
- `/auth/error` - Auth error page
- `/api/health` - Health check endpoint
- `/api/auth/*` - NextAuth.js endpoints

### How It Works

1. **Non-API Routes**: Unauthenticated users are redirected to `/login?callbackUrl=/protected-route`
2. **API Routes**: Returns `401 Unauthorized` JSON response
3. **Edge Runtime**: Uses `@/lib/auth.edge` for JWT-only validation (no database access)

### Adding Public Routes

Edit `PUBLIC_ROUTES` array in `middleware.ts`:

```typescript
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/your-new-public-route',
  // ... other routes
];
```

## Rate Limiting

### Configuration

- **Window**: 60 seconds (1 minute)
- **Max Requests**: 100 per window per IP
- **Scope**: API routes only (`/api/*`)

### Response Headers

All API responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-27T10:30:00.000Z
```

### 429 Too Many Requests

When limit exceeded:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "resetTime": "2025-11-27T10:30:00.000Z"
}
```

Headers:

```
Retry-After: 45
```

### Customizing Rate Limits

Edit constants in `middleware.ts`:

```typescript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests
```

### Production Considerations

**IMPORTANT**: The current implementation uses in-memory storage which:

- Does NOT persist across deployments
- Does NOT work with multiple instances/regions
- Will reset on server restart

**For Production**, replace with Redis:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

async function checkRateLimit(ip: string) {
  const key = `rate-limit:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 60 seconds
  }

  return {
    allowed: count <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - count),
    resetTime: Date.now() + 60000,
  };
}
```

## CORS Configuration

### Allowed Origins

Set via environment variable:

```env
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Default (development):

```typescript
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];
```

### CORS Headers

Automatically applied to all API responses:

```
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token
```

### Preflight Requests

OPTIONS requests are handled automatically with:

- 204 No Content response
- All CORS headers
- 24-hour cache (`Access-Control-Max-Age: 86400`)

## Security Headers

Additional security headers from `next.config.js`:

```
X-DNS-Prefetch-Control: on
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: origin-when-cross-origin
```

## Matcher Configuration

Middleware applies to:

```typescript
export const config = {
  matcher: [
    // All routes except static files
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)',
    // Always API routes
    '/api/:path*',
    // Always workspace routes
    '/(workspace)/:path*',
  ],
};
```

## Environment Variables

### Required

```env
# NextAuth.js (already configured)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# OAuth Providers (already configured)
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### Optional

```env
# CORS Origins (comma-separated)
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com

# Redis for production rate limiting (recommended)
UPSTASH_REDIS_REST_URL=<your-redis-url>
UPSTASH_REDIS_REST_TOKEN=<your-redis-token>
```

## Monitoring & Debugging

### Development Logging

Set in `.env.local`:

```env
NODE_ENV=development
```

This enables:

- NextAuth debug logging
- Detailed error messages
- Console output for auth events

### Production Logging

Recommended to add logging service integration:

```typescript
// Add to middleware.ts
import { track } from '@/lib/analytics';

// In rate limit check
if (!rateLimit.allowed) {
  track('rate_limit_exceeded', { ip, pathname });
  // ... return 429
}
```

## Performance Considerations

### Edge Runtime

Middleware runs on the Edge Runtime for optimal performance:

- ~50ms cold start vs ~200ms Node.js
- Global distribution (runs close to users)
- Limited to Edge-compatible code only

### Rate Limit Cleanup

Automatic cleanup of expired entries:

```typescript
// 1% chance per request to clean up expired entries
if (Math.random() < 0.01) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < Date.now()) {
      rateLimitStore.delete(key);
    }
  }
}
```

## Troubleshooting

### Issue: "401 Unauthorized" on Public Routes

**Solution**: Check that route is in `PUBLIC_ROUTES` array

### Issue: Rate Limit Resets on Deploy

**Solution**: Implement Redis-based rate limiting (see Production Considerations)

### Issue: CORS Errors

**Solution**: Add origin to `ALLOWED_ORIGINS` environment variable

### Issue: Middleware Not Running

**Solution**: Check `matcher` configuration includes your route pattern

### Issue: Session Not Found

**Solution**: Ensure `lib/auth.edge.ts` is properly configured for Edge Runtime

## Migration from No Middleware

If you're adding this middleware to an existing app:

1. **Test Public Routes**: Verify login/register still work
2. **Update API Clients**: Handle 401/429 responses properly
3. **Configure CORS**: Add all allowed origins
4. **Monitor Rate Limits**: Watch for legitimate users hitting limits
5. **Add Redis**: Before going to production with multiple instances

## Next Steps

1. Review and customize `PUBLIC_ROUTES` for your app
2. Configure `ALLOWED_ORIGINS` environment variable
3. Implement Redis rate limiting for production
4. Add monitoring/alerting for rate limit violations
5. Consider API-specific rate limits (different limits per endpoint)
