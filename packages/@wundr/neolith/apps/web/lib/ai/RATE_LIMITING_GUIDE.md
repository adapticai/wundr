# AI Rate Limiting & Quota Management Guide

Complete guide to implementing and using the AI rate limiting system in Neolith.

## Overview

The AI rate limiting system provides comprehensive request throttling and quota management for AI
features:

- **Rate Limiting**: Sliding window algorithm with Redis-based distributed tracking
- **Quota Management**: Per-user and per-workspace quotas with multiple tiers
- **Graceful Degradation**: Automatic fallback to in-memory storage when Redis unavailable
- **UI Components**: Warning displays and quota visualizations
- **Middleware**: Easy integration into API routes

## Architecture

```
┌─────────────────┐
│  API Request    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Middleware     │ ← Check bypass token
│  (withRateLimit)│
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Quota Manager   │ ← Check user/workspace tier
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Rate Limiter    │ ← Sliding window check
│ (Redis/Memory)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    v         v
 Allow     Reject (429)
```

## Quota Tiers

### Free Tier

- 10 requests/hour
- 50 requests/day
- 500 requests/month
- 100,000 tokens/month

### Pro Tier

- 100 requests/hour
- 500 requests/day
- 5,000 requests/month
- 1,000,000 tokens/month

### Enterprise Tier

- 1,000 requests/hour
- 5,000 requests/day
- 50,000 requests/month
- 10,000,000 tokens/month

### Unlimited Tier

- No limits (for admin/testing)

## API Integration

### Basic Usage with Middleware

```typescript
// app/api/ai/your-endpoint/route.ts
import { withRateLimit } from '@/lib/ai/rate-limit-middleware';

const handler = async (req, context) => {
  // Your AI logic here
  const { userId, workspaceId, bypassed } = context;

  // Make AI request...

  return NextResponse.json({ result: 'success' });
};

export const POST = withRateLimit(handler, {
  scope: 'user', // or 'workspace'
});
```

### Workspace-Scoped Rate Limiting

```typescript
import { withRateLimit } from '@/lib/ai/rate-limit-middleware';

export const POST = withRateLimit(handler, {
  scope: 'workspace',
  getWorkspaceId: async req => {
    const body = await req.json();
    return body.workspaceId || null;
  },
});
```

### Manual Quota Checking

```typescript
import { checkUserQuota, checkWorkspaceQuota } from '@/lib/ai/quota-manager';

// Check user quota
const quotaResult = await checkUserQuota(userId);
if (!quotaResult.allowed) {
  return NextResponse.json(
    { error: quotaResult.reason },
    {
      status: 429,
      headers: {
        'Retry-After': quotaResult.retryAfter?.toString() || '3600',
      },
    }
  );
}

// Check workspace quota
const workspaceResult = await checkWorkspaceQuota(workspaceId);
```

### Adding Rate Limit Headers

```typescript
import { withRateLimitHeaders } from '@/lib/ai/rate-limit-middleware';

const response = NextResponse.json({ data: result });
return await withRateLimitHeaders(response, userId, 'user');
```

### Tracking Token Usage

```typescript
import { trackAIUsage } from '@/lib/ai/rate-limit-middleware';

// After AI request completes
const tokensUsed = completion.usage.total_tokens;
await trackAIUsage(userId, tokensUsed, 'user');
```

## UI Components

### Quota Display (Full)

```tsx
import { QuotaDisplay } from '@/components/ai';

export function SettingsPage() {
  return (
    <div>
      <h2>Your AI Usage</h2>
      <QuotaDisplay scope='user' autoRefresh={true} refreshInterval={60000} />
    </div>
  );
}
```

### Quota Display (Compact)

```tsx
<QuotaDisplay scope='workspace' workspaceId={workspaceId} compact={true} />
```

### Rate Limit Warning

```tsx
import { RateLimitWarning } from '@/components/ai';

export function ChatInterface() {
  const [quota, setQuota] = useState(null);

  return (
    <>
      <RateLimitWarning
        percentage={quota.percentages.hourlyRequests}
        limitType='hourly'
        limit={quota.limits.maxRequestsPerHour}
        current={quota.requestsThisHour}
        resetAt={new Date(quota.resetAt.hour)}
        onUpgrade={() => router.push('/settings/billing')}
      />
      {/* Chat UI */}
    </>
  );
}
```

### Inline Warning (Compact)

```tsx
import { InlineRateLimitWarning } from '@/components/ai';

<InlineRateLimitWarning percentage={85} limitType='hourly' />;
```

## Fetching Usage Data

### Client-Side Hook

```typescript
// hooks/use-ai-usage.ts
import { useEffect, useState } from 'react';

export function useAIUsage(scope: 'user' | 'workspace', workspaceId?: string) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      const params = new URLSearchParams({ scope });
      if (workspaceId) params.append('workspaceId', workspaceId);

      const res = await fetch(`/api/ai/usage?${params}`);
      const data = await res.json();
      setUsage(data.usage);
      setLoading(false);
    }

    fetchUsage();
  }, [scope, workspaceId]);

  return { usage, loading };
}
```

### Server-Side Usage

```typescript
import { getUserQuotaUsage, getWorkspaceQuotaUsage } from '@/lib/ai/quota-manager';

// In Server Component or API route
const usage = await getUserQuotaUsage(userId);
const workspaceUsage = await getWorkspaceQuotaUsage(workspaceId);
```

## Admin Features

### Bypass Token

Set environment variable:

```bash
RATE_LIMIT_BYPASS_TOKENS=token1,token2,token3
```

Use in requests:

```typescript
fetch('/api/ai/chat', {
  headers: {
    'X-Bypass-Token': 'your-bypass-token',
  },
});
```

### Reset Quota (Admin Only)

```typescript
// POST /api/ai/usage/reset
fetch('/api/ai/usage/reset', {
  method: 'POST',
  headers: {
    'X-Bypass-Token': 'your-admin-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    scope: 'user',
    identifier: 'user-id-here',
  }),
});
```

### Manual Reset

```typescript
import { resetRateLimit } from '@/lib/ai/rate-limiter';

// Reset user limits
await resetRateLimit('user:userId');
await resetRateLimit('user:userId:daily');

// Reset workspace limits
await resetRateLimit('workspace:workspaceId');
await resetRateLimit('workspace:workspaceId:daily');
```

## Environment Setup

### Required Variables

```bash
# Redis Connection (Required for distributed rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional Redis Configuration
REDIS_PASSWORD=your-password
REDIS_DB=0

# Admin Bypass Tokens (Optional)
RATE_LIMIT_BYPASS_TOKENS=admin-token-1,admin-token-2
```

### Testing Without Redis

The system automatically falls back to in-memory storage if Redis is unavailable. This works for
development but is not suitable for production with multiple instances.

## Error Handling

### 429 Rate Limit Exceeded

```typescript
try {
  const response = await fetch('/api/ai/chat', { ... });

  if (response.status === 429) {
    const data = await response.json();
    const retryAfter = response.headers.get('Retry-After');

    console.log('Rate limit exceeded');
    console.log('Reason:', data.message);
    console.log('Retry after:', retryAfter, 'seconds');
    console.log('Usage:', data.usage);
  }
} catch (error) {
  // Handle error
}
```

### Graceful Degradation

The rate limiter gracefully handles Redis failures:

```typescript
// If Redis fails, the system:
// 1. Logs the error
// 2. Falls back to in-memory storage
// 3. Continues serving requests
// 4. Allows the request (fail-open) on critical errors
```

## Best Practices

1. **Choose Appropriate Scope**: Use `user` scope for personal features, `workspace` scope for team
   features

2. **Add UI Warnings**: Show warnings at 80% usage to give users time to adjust

3. **Provide Upgrade Path**: Include upgrade CTAs in warnings when limits are approached

4. **Track Token Usage**: Always track tokens after AI requests to enforce monthly quotas

5. **Use Bypass Tokens Carefully**: Only for admin/testing, never commit to source control

6. **Monitor Redis**: Set up alerts for Redis availability in production

7. **Test Rate Limits**: Test with low limits in development to ensure UI handles limits gracefully

## Example: Complete Integration

```typescript
// app/api/ai/chat/route.ts
import { withRateLimit, trackAIUsage, withRateLimitHeaders } from '@/lib/ai/rate-limit-middleware';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const chatHandler = async (req, context) => {
  const { userId, bypassed } = context;
  const { messages } = await req.json();

  // Make AI request
  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages,
  });

  // Track usage (in background)
  result.then(async completion => {
    if (completion.usage) {
      await trackAIUsage(userId, completion.usage.totalTokens, 'user');
    }
  });

  // Return streaming response with rate limit headers
  const response = result.toDataStreamResponse();
  return await withRateLimitHeaders(response, userId, 'user');
};

export const POST = withRateLimit(chatHandler, {
  scope: 'user',
});
```

```tsx
// app/settings/ai/page.tsx
import { QuotaDisplay, RateLimitWarning } from '@/components/ai';

export default function AISettingsPage() {
  return (
    <div className='space-y-6'>
      <h1>AI Usage & Quotas</h1>

      <QuotaDisplay scope='user' />

      <div className='mt-4'>
        <h2>Current Limits</h2>
        <p>You are on the Free tier</p>
        <Button>Upgrade to Pro</Button>
      </div>
    </div>
  );
}
```

## Monitoring

### Key Metrics to Track

- Rate limit hit rate (percentage of requests rejected)
- Average usage per user/workspace
- Peak usage times
- Redis availability
- Quota upgrade conversion rate

### Logging

The system logs important events:

- Redis connection status
- Rate limit violations
- Quota checks
- Token usage tracking

Check application logs for `[RateLimit]` and `[Quota]` prefixes.

## Troubleshooting

### Issue: Redis connection fails

**Solution**: Check Redis host/port, verify Redis is running, check firewall rules

### Issue: Limits not working across instances

**Solution**: Ensure Redis is configured and accessible from all instances

### Issue: Users hitting limits unexpectedly

**Solution**: Check quota tier, review usage analytics, consider increasing limits or upgrading tier

### Issue: Rate limit headers not appearing

**Solution**: Ensure `withRateLimitHeaders` is called, check for middleware errors

## Future Enhancements

- [ ] Database persistence for monthly quotas
- [ ] Usage analytics dashboard
- [ ] Automatic tier upgrades
- [ ] Quota tier management UI
- [ ] Usage forecasting
- [ ] Burst allowance
- [ ] Custom quota overrides per user
