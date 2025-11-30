# Token Budget Tracker

The Token Budget Tracker provides distributed token usage tracking and budget enforcement for orchestrators using Redis as the backend.

## Features

- **Multi-Period Tracking**: Track usage across hourly, daily, and monthly periods
- **Distributed Counting**: Redis-based distributed token counting with atomic operations
- **Pre-flight Checks**: Validate budget before making LLM calls
- **Token Reservations**: Reserve tokens before calls, release unused tokens after
- **Threshold Monitoring**: Emit events at 50%, 75%, 90%, and 100% thresholds
- **Budget Overrides**: Support priority tasks with temporary budget increases
- **Detailed Analytics**: Track prompt/completion token breakdown and model usage

## Installation

The budget tracker is included in `@wundr.io/orchestrator-daemon`. Ensure Redis is installed and running:

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)
sudo apt-get install redis-server
sudo systemctl start redis
```

## Configuration

```typescript
import { TokenBudgetTracker, BudgetConfig } from '@wundr.io/orchestrator-daemon/budget';

const config: BudgetConfig = {
  // Default budget for all orchestrators
  defaultBudget: {
    hourly: 100000,   // 100k tokens per hour
    daily: 1000000,   // 1M tokens per day
    monthly: 20000000 // 20M tokens per month
  },

  // Per-orchestrator budgets (override default)
  orchestratorBudgets: {
    'orchestrator-tier1': {
      hourly: 200000,
      daily: 2000000,
      monthly: 40000000
    },
    'orchestrator-tier2': {
      hourly: 50000,
      daily: 500000,
      monthly: 10000000
    }
  },

  // Threshold percentages for events
  thresholds: [0.5, 0.75, 0.9, 1.0],

  // Reservation TTL (15 minutes)
  reservationTTL: 15 * 60 * 1000,

  // Enable budget overrides
  enableOverrides: true,

  // Redis configuration
  redis: {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    db: 0,
    keyPrefix: 'orchestrator'
  }
};

const tracker = new TokenBudgetTracker(config);
```

## Usage

### 1. Pre-flight Budget Check

```typescript
const check = await tracker.checkBudget(
  'orchestrator-id',
  5000, // estimated tokens
  'hourly'
);

if (!check.allowed) {
  console.log(`Budget exceeded: ${check.message}`);
  // Handle budget exceeded
} else {
  console.log(`Budget OK: ${check.remaining} tokens remaining`);
  // Proceed with LLM call
}
```

### 2. Reserve Tokens

```typescript
// Reserve tokens before making the call
const reservation = await tracker.reserveTokens(
  'orchestrator-id',
  5000,
  'hourly'
);

if (!reservation.success) {
  console.log(`Reservation failed: ${reservation.error}`);
  return;
}

try {
  // Make LLM call
  const response = await makeLLMCall();

  // Release reservation with actual usage
  await tracker.releaseReservation(
    reservation.reservationId!,
    response.usage.total_tokens
  );
} catch (error) {
  // Release reservation on error
  await tracker.releaseReservation(reservation.reservationId!, 0);
  throw error;
}
```

### 3. Track Usage

```typescript
await tracker.trackUsage({
  orchestratorId: 'orchestrator-id',
  sessionId: 'session-123',
  timestamp: new Date(),
  promptTokens: 1000,
  completionTokens: 2000,
  totalTokens: 3000,
  model: 'claude-sonnet-4.5',
  requestId: 'req-xyz',
  metadata: {
    task: 'code-generation',
    priority: 'high'
  }
});
```

### 4. Get Usage Statistics

```typescript
const stats = await tracker.getUsageStats('orchestrator-id', 'hourly');

console.log(`
Usage Stats:
  Period: ${stats.period}
  Used: ${stats.totalUsed} / ${stats.limit} (${stats.percentUsed.toFixed(1)}%)
  Remaining: ${stats.remaining}
  Reserved: ${stats.reservedTokens}
  Active Reservations: ${stats.activeReservations}

Breakdown:
  Prompt Tokens: ${stats.breakdown.promptTokens}
  Completion Tokens: ${stats.breakdown.completionTokens}

Top Models:
  ${stats.topModels.map(m => `${m.model}: ${m.tokens} (${m.percentage.toFixed(1)}%)`).join('\n  ')}
`);
```

### 5. Set Budget Override

```typescript
await tracker.setBudgetOverride({
  orchestratorId: 'orchestrator-id',
  period: 'hourly',
  additionalTokens: 50000,
  reason: 'Critical production issue',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  createdBy: 'admin-user',
  metadata: {
    ticketId: 'INC-12345'
  }
});
```

### 6. Listen to Events

```typescript
// Budget thresholds
tracker.on('threshold:50', (event) => {
  console.log(`⚠️ 50% budget used for ${event.orchestratorId}`);
});

tracker.on('threshold:75', (event) => {
  console.log(`⚠️ 75% budget used for ${event.orchestratorId}`);
  // Send notification
});

tracker.on('threshold:90', (event) => {
  console.log(`⚠️⚠️ 90% budget used for ${event.orchestratorId}`);
  // Alert team
});

tracker.on('threshold:100', (event) => {
  console.log(`🚨 Budget exceeded for ${event.orchestratorId}`);
  // Pause orchestrator or escalate
});

// Usage tracking
tracker.on('usage:tracked', (usage) => {
  console.log(`Tracked ${usage.totalTokens} tokens for ${usage.orchestratorId}`);
});

// Reservations
tracker.on('reservation:created', (reservation) => {
  console.log(`Reserved ${reservation.tokens} tokens`);
});

tracker.on('reservation:released', (reservationId) => {
  console.log(`Released reservation ${reservationId}`);
});

// Overrides
tracker.on('override:set', (override) => {
  console.log(`Budget override: +${override.additionalTokens} tokens for ${override.reason}`);
});
```

## Redis Key Structure

The tracker uses the following Redis key structure:

```
orchestrator:budget:<orchestratorId>:<period>:usage
orchestrator:budget:<orchestratorId>:<period>:reservations:<reservationId>
orchestrator:budget:<orchestratorId>:<period>:reservations:total
orchestrator:budget:<orchestratorId>:<period>:overrides:<overrideId>
orchestrator:budget:<orchestratorId>:<period>:metadata:history
```

### Example Keys

```
orchestrator:budget:orchestrator-1:hourly:usage
orchestrator:budget:orchestrator-1:hourly:reservations:abc-123
orchestrator:budget:orchestrator-1:hourly:reservations:total
orchestrator:budget:orchestrator-1:daily:usage
orchestrator:budget:orchestrator-1:monthly:metadata:history
```

## Best Practices

### 1. Always Use Reservations for LLM Calls

```typescript
// ✅ Good: Reserve before call
const reservation = await tracker.reserveTokens(orchestratorId, estimatedTokens);
if (reservation.success) {
  try {
    const response = await llm.call();
    await tracker.releaseReservation(reservation.reservationId!, response.usage.total_tokens);
  } catch (error) {
    await tracker.releaseReservation(reservation.reservationId!, 0);
  }
}

// ❌ Bad: Direct tracking without reservation
const response = await llm.call();
await tracker.trackUsage({ ... });
```

### 2. Check Multiple Periods

```typescript
// Check all periods before making expensive calls
const checks = await Promise.all([
  tracker.checkBudget(orchestratorId, tokens, 'hourly'),
  tracker.checkBudget(orchestratorId, tokens, 'daily'),
  tracker.checkBudget(orchestratorId, tokens, 'monthly')
]);

if (checks.some(c => !c.allowed)) {
  // Budget exceeded in at least one period
  return;
}
```

### 3. Monitor Threshold Events

```typescript
// Set up monitoring before starting
tracker.on('threshold:75', async (event) => {
  await notificationService.send({
    to: 'team@company.com',
    subject: `Budget Alert: ${event.orchestratorId}`,
    message: `75% of ${event.period} budget used`
  });
});

tracker.on('budget:exceeded', async (event) => {
  // Pause low-priority tasks
  await orchestrator.pauseLowPriorityTasks();

  // Alert on-call
  await pagerDuty.trigger({
    severity: 'high',
    summary: `Budget exceeded: ${event.orchestratorId}`
  });
});
```

### 4. Use Overrides Sparingly

```typescript
// Only use overrides for critical situations
if (isPriority && isTimeSemsitive) {
  await tracker.setBudgetOverride({
    orchestratorId,
    period: 'hourly',
    additionalTokens: 100000,
    reason: 'Critical production incident',
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    createdBy: currentUser
  });
}
```

## Integration with Orchestrator Daemon

```typescript
import { OrchestratorDaemon } from '@wundr.io/orchestrator-daemon';
import { TokenBudgetTracker } from '@wundr.io/orchestrator-daemon/budget';

const daemon = new OrchestratorDaemon({ ... });
const tracker = new TokenBudgetTracker({ ... });

// Integrate with session spawning
daemon.on('session:spawned', async (session) => {
  // Check budget before session starts
  const check = await tracker.checkBudget(
    session.orchestratorId,
    10000, // estimated initial budget
    'hourly'
  );

  if (!check.allowed) {
    await daemon.stopSession(session.id);
    console.log('Session stopped: budget exceeded');
  }
});

// Track usage from session metrics
daemon.on('session:completed', async (session) => {
  await tracker.trackUsage({
    orchestratorId: session.orchestratorId,
    sessionId: session.id,
    timestamp: new Date(),
    promptTokens: session.metrics.promptTokens,
    completionTokens: session.metrics.completionTokens,
    totalTokens: session.metrics.tokensUsed,
    model: session.model,
  });
});
```

## Testing

```typescript
import { TokenBudgetTracker } from '@wundr.io/orchestrator-daemon/budget';

describe('TokenBudgetTracker', () => {
  let tracker: TokenBudgetTracker;

  beforeAll(async () => {
    tracker = new TokenBudgetTracker({
      defaultBudget: { hourly: 1000 },
      thresholds: [0.5, 0.75, 0.9, 1.0],
      reservationTTL: 60000,
      enableOverrides: true,
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test'
      }
    });
  });

  afterAll(async () => {
    await tracker.disconnect();
  });

  it('should track usage correctly', async () => {
    await tracker.trackUsage({
      orchestratorId: 'test-orch',
      sessionId: 'session-1',
      timestamp: new Date(),
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      model: 'claude-sonnet-4.5'
    });

    const stats = await tracker.getUsageStats('test-orch', 'hourly');
    expect(stats.totalUsed).toBe(300);
    expect(stats.percentUsed).toBe(30);
  });
});
```

## Troubleshooting

### Redis Connection Issues

```typescript
// Check Redis connection
const healthy = await tracker.healthCheck();
if (!healthy) {
  console.error('Redis not connected');
}
```

### Budget Not Updating

- Verify Redis TTL is set correctly
- Check clock synchronization across servers
- Ensure Redis persistence is configured if needed

### Threshold Events Not Firing

- Check that thresholds are configured in ascending order
- Verify event listeners are set up before tracking usage
- Clear threshold cache if needed

## Performance Considerations

- **Redis Pipeline**: The tracker uses Redis multi/exec for atomic operations
- **Key Expiration**: Automatic TTL ensures old data is cleaned up
- **Memory Usage**: History is limited by Redis TTL, not count
- **Scalability**: Fully distributed, scales horizontally with Redis cluster

## License

MIT
