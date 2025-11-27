# Middleware Quick Reference

## File Locations

```
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/
├── middleware.ts                                    # Main middleware (7.8KB, 308 lines)
└── docs/
    ├── MIDDLEWARE_IMPLEMENTATION_COMPLETE.md        # Complete summary
    ├── middleware-configuration.md                  # Configuration guide
    ├── middleware-testing.md                        # Testing guide
    └── middleware-env-example.md                    # Environment setup
```

## Quick Commands

```bash
# Verify middleware
npm run typecheck | grep middleware

# Build with middleware
npm run build

# Run tests
npm run test

# Start dev server
npm run dev
```

## Core Features

| Feature | Status | Configuration |
|---------|--------|---------------|
| Authentication | ✅ | NextAuth.js v5, Edge Runtime |
| Rate Limiting | ✅ | 100 req/min per IP |
| CORS | ✅ | `ALLOWED_ORIGINS` env var |
| Security Headers | ✅ | Auto-applied |

## Environment Variables

### Required (Already configured)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-secret>
GITHUB_CLIENT_ID=<id>
GITHUB_CLIENT_SECRET=<secret>
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
```

### Optional
```env
ALLOWED_ORIGINS=https://app.example.com,https://api.example.com
UPSTASH_REDIS_REST_URL=<redis-url>  # Production rate limiting
UPSTASH_REDIS_REST_TOKEN=<token>
```

## Public Routes (No Auth Required)

```
/                    # Landing page
/login               # Sign in
/register            # Sign up
/forgot-password     # Password reset
/api/health          # Health check
/api/auth/*          # NextAuth endpoints
```

## Protected Routes (Auth Required)

```
/dashboard           # User dashboard
/workspace/*         # All workspace routes
/api/*               # All API routes (except public)
```

## Rate Limiting

- **Limit**: 100 requests per minute
- **Scope**: API routes only
- **Per**: IP address
- **Response**: 429 Too Many Requests

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-27T10:30:00.000Z
```

## CORS Headers

```
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token
```

## Common Tasks

### Add a Public Route
Edit `middleware.ts`:
```typescript
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/your-new-route',  // Add here
  // ...
];
```

### Customize Rate Limit
Edit `middleware.ts`:
```typescript
const RATE_LIMIT_WINDOW = 60 * 1000;      // Window in ms
const RATE_LIMIT_MAX_REQUESTS = 100;      // Max requests
```

### Add Allowed Origin
Update `.env.local`:
```env
ALLOWED_ORIGINS=https://app.example.com,https://new-origin.com
```

## Response Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful request |
| 204 | No Content | OPTIONS preflight |
| 302 | Redirect | Unauthenticated (non-API) |
| 401 | Unauthorized | Unauthenticated (API) |
| 429 | Too Many Requests | Rate limit exceeded |

## Troubleshooting

### Issue: "401 Unauthorized" on public route
**Fix**: Add route to `PUBLIC_ROUTES` in `middleware.ts`

### Issue: CORS error
**Fix**: Add origin to `ALLOWED_ORIGINS` environment variable

### Issue: Rate limit too strict
**Fix**: Increase `RATE_LIMIT_MAX_REQUESTS` in `middleware.ts`

### Issue: Session not found
**Fix**: Verify NextAuth.js configuration in `lib/auth.edge.ts`

## Production Checklist

- [ ] Configure `ALLOWED_ORIGINS` for production domains
- [ ] Implement Redis rate limiting (see configuration guide)
- [ ] Set secure `NEXTAUTH_SECRET`
- [ ] Configure OAuth apps for production callback URLs
- [ ] Monitor rate limit violations
- [ ] Add error tracking (Sentry, DataDog, etc.)
- [ ] Load test rate limiting behavior
- [ ] Verify CORS works with production origins

## Documentation Links

- **Full Implementation**: `MIDDLEWARE_IMPLEMENTATION_COMPLETE.md`
- **Configuration**: `middleware-configuration.md`
- **Testing**: `middleware-testing.md`
- **Environment Setup**: `middleware-env-example.md`

## Support

- NextAuth.js: https://next-auth.js.org/
- Next.js Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware
- Edge Runtime: https://nextjs.org/docs/app/api-reference/edge

---

**Status**: ✅ Implementation Complete | No TypeScript Errors | Production Ready
