# VP-Daemon Memory System

Complete tiered memory architecture for Virtual Principal sessions, integrating with `@wundr.io/agent-memory`.

## Quick Start

```typescript
import { createMemoryAPI } from './memory-api';

// Initialize memory system
const memory = await createMemoryAPI();

// Create and manage tasks
await memory.createTask({
  taskId: 'task-1',
  description: 'Fix authentication bug',
  priority: 8
});

await memory.startTask('task-1', 'slot-1');
await memory.completeTask('task-1', { success: true });

// Record decisions
await memory.recordDecision({
  sessionId: 'session-1',
  agentId: 'agent-1',
  action: 'approve_pr',
  rationale: 'All checks passed',
  outcome: 'approved',
  context: 'PR #123'
});

// Manage policies
await memory.addPolicy({
  policyId: 'no-force-push',
  name: 'No Force Push',
  rule: 'Force push forbidden on protected branches'
});

// Learn patterns
await memory.learnPattern({
  patternId: 'common-error',
  name: 'NPE in User Service',
  description: 'Recurring null pointer exception',
  confidence: 0.8
});

// Compile context for VP
const context = await memory.compileVPContext({
  systemPrompt: 'You are the Virtual Principal...',
  maxTokens: 8000
});

// Shutdown
await memory.shutdown();
```

## Architecture

### Memory Tiers

**Scratchpad (Working Memory)**
- Capacity: 8,000 tokens
- TTL: 1 hour
- Contents: Active tasks, current work

**Episodic (Session History)**
- Capacity: 32,000 tokens
- TTL: 30 days
- Contents: Task history, decisions, sessions

**Semantic (Knowledge Base)**
- Capacity: 64,000 tokens
- TTL: None (permanent)
- Contents: Policies, patterns, knowledge

### Memory Types

1. **Task Memory**: Active and completed tasks
2. **Decision Memory**: Agent decisions with rationale
3. **Policy Memory**: Rules and constraints
4. **Pattern Memory**: Learned behaviors and patterns
5. **Session Memory**: Session snapshots

## Features

- Automatic memory consolidation
- Forgetting curve implementation
- Memory compaction and pruning
- Disk persistence and archival
- Full-text search across tiers
- Context compilation for LLM
- Integration with @wundr.io/agent-memory

## Installation

The memory system requires the `@wundr.io/agent-memory` package:

```bash
# From workspace root
pnpm install

# Build agent-memory package
pnpm --filter @wundr.io/agent-memory build
```

## API Reference

### MemoryAPI

High-level API for memory operations.

#### Task Operations

```typescript
// Create task
await memory.createTask({
  taskId: string,
  description: string,
  priority?: number,
  assignedSlot?: string,
  metadata?: Record<string, unknown>
});

// Start task
await memory.startTask(taskId: string, slotId: string);

// Complete task
await memory.completeTask(taskId: string, result?: unknown);

// Fail task
await memory.failTask(taskId: string, error: unknown);

// Get active tasks
const tasks = memory.getActiveTasks();

// Get specific task
const task = memory.getTask(taskId: string);
```

#### Decision Operations

```typescript
// Record decision
await memory.recordDecision({
  sessionId: string,
  agentId: string,
  action: string,
  rationale: string,
  outcome: 'approved' | 'rejected' | 'escalated',
  context: string,
  rewardScores?: Record<string, number>,
  policyChecks?: Record<string, boolean>,
  escalationTriggers?: string[]
});

// Get recent decisions
const decisions = await memory.getRecentDecisions(agentId: string, limit?: number);
```

#### Policy Operations

```typescript
// Add policy
await memory.addPolicy({
  policyId: string,
  name: string,
  rule: string,
  examples?: Array<{
    description: string,
    outcome: 'pass' | 'fail'
  }>
});

// Record violation
await memory.recordViolation(policyId: string);

// Get policy
const policy = memory.getPolicy(policyId: string);

// Get all policies
const policies = memory.getAllPolicies();

// Get violated policies
const violated = memory.getViolatedPolicies(minViolations?: number);
```

#### Pattern Operations

```typescript
// Learn pattern
await memory.learnPattern({
  patternId: string,
  name: string,
  description: string,
  confidence?: number,
  tags?: string[]
});

// Reinforce pattern
await memory.reinforcePattern(patternId: string);

// Get pattern
const pattern = memory.getPattern(patternId: string);

// Get high-confidence patterns
const patterns = memory.getHighConfidencePatterns(minConfidence?: number);
```

#### Search Operations

```typescript
// Fluent query builder
const results = await memory.search(
  memory.query()
    .withQuery('deployment')
    .withTypes('task', 'decision')
    .inSession('session-1')
    .byAgent('agent-1')
    .betweenDates(startDate, endDate)
    .limit(20)
    .build()
);

// Search tasks
const tasks = await memory.searchTasks(keyword: string, limit?: number);
```

#### Context Operations

```typescript
// Compile VP context
const context = await memory.compileVPContext({
  systemPrompt: string,
  maxTokens: number,
  currentTaskId?: string
});
```

#### Maintenance Operations

```typescript
// Consolidate memories
await memory.consolidate();

// Compact memories
await memory.compact();

// Prune old memories
const result = await memory.pruneOldMemories({
  scratchpadMaxAgeDays?: number,
  episodicMaxAgeDays?: number
});

// Archive old memories
const archive = await memory.archiveOldMemories(olderThanDays?: number);

// Get statistics
const stats = memory.getStats();

// Check health
const health = memory.needsMaintenance();

// Get active summary
const summary = await memory.getActiveSummary();

// Save to disk
await memory.save();
```

## Configuration

```typescript
const memory = await createMemoryAPI({
  basePath: '~/.vp-daemon/memory',
  persistToDisk: true,
  autoSaveIntervalMs: 60000,
  enableSemanticSearch: false,
  tiers: {
    scratchpad: {
      maxTokens: 8000,
      ttlMs: 3600000,
      compressionEnabled: false,
      compactionThreshold: 0.9
    },
    episodic: {
      maxTokens: 32000,
      ttlMs: 86400000 * 30,
      compressionEnabled: true,
      compactionThreshold: 0.8
    },
    semantic: {
      maxTokens: 64000,
      compressionEnabled: true,
      compactionThreshold: 0.7
    },
    forgettingCurve: {
      initialStrength: 1.0,
      decayRate: 0.05,
      minimumThreshold: 0.15,
      accessBoost: 0.3,
      consolidationThreshold: 0.75
    },
    persistenceEnabled: true,
    autoConsolidation: true,
    consolidationIntervalMs: 600000
  }
});
```

## Examples

See `examples/memory-usage.ts` for complete examples:

- Basic task management
- Decision recording and retrieval
- Policy management
- Pattern learning
- Context compilation
- Memory search
- Memory maintenance
- Complete session workflow

## Testing

```bash
# Run tests
npm test -- scripts/vp-daemon/__tests__/memory-system.test.ts

# With coverage
npm test -- --coverage scripts/vp-daemon/__tests__/memory-system.test.ts
```

## Performance

### Memory Operations

| Operation | Time | Notes |
|-----------|------|-------|
| Store | O(1) | Constant time |
| Retrieve | O(1) | Hash map lookup |
| Search | O(n log n) | Sorted by relevance |
| Consolidate | O(n) | Process episodic |
| Compact | O(n) | Process each tier |

### Space Usage

| Tier | Tokens | Size |
|------|--------|------|
| Scratchpad | 8K | ~32 KB |
| Episodic | 32K | ~128 KB |
| Semantic | 64K | ~256 KB |
| **Total** | **104K** | **~416 KB** |

Plus overhead: ~1 MB total

## Monitoring

```typescript
// Get statistics
const stats = memory.getStats();
console.log('Total memories:', stats.totalMemories);
console.log('Scratchpad:', stats.tiers.scratchpad.utilization);
console.log('Episodic:', stats.tiers.episodic.utilization);
console.log('Semantic:', stats.tiers.semantic.utilization);

// Check health
const health = memory.needsMaintenance();
console.log('Health:', health.reason);
if (health.needsConsolidation) {
  await memory.consolidate();
}
if (health.needsCompaction) {
  await memory.compact();
}
```

## Best Practices

### 1. Use Descriptive IDs

```typescript
// ✅ Good
taskId: `refactor-auth-${Date.now()}`

// ❌ Bad
taskId: 'task1'
```

### 2. Include Metadata

```typescript
// ✅ Good
await memory.createTask({
  taskId: 'task-1',
  description: 'Refactor auth',
  metadata: {
    module: 'auth',
    type: 'refactor',
    estimatedHours: 16,
    assignee: 'john@example.com'
  }
});
```

### 3. Record Comprehensive Decisions

```typescript
// ✅ Good
await memory.recordDecision({
  sessionId: currentSession,
  agentId: 'agent-1',
  action: 'approve_pr',
  rationale: 'All checks passed, code reviewed by 2 senior devs',
  outcome: 'approved',
  context: 'PR #123: Add rate limiting to API',
  policyChecks: {
    'require-tests': true,
    'require-review': true,
    'security-scan': true
  }
});
```

### 4. Pin Important Memories

Policies and critical knowledge should be pinned to prevent forgetting:

```typescript
await memory.addPolicy({
  policyId: 'critical-policy',
  name: 'Critical Policy',
  rule: '...'
  // Automatically pinned
});
```

### 5. Regular Maintenance

```typescript
// Daily maintenance
async function dailyMaintenance() {
  const memory = await createMemoryAPI();

  const health = memory.needsMaintenance();
  if (health.needsConsolidation) {
    await memory.consolidate();
  }
  if (health.needsCompaction) {
    await memory.compact();
  }

  await memory.pruneOldMemories();
  await memory.save();
  await memory.shutdown();
}
```

## Troubleshooting

### High Memory Usage

**Symptoms**: System using >500 MB RAM

**Solution**:
```typescript
const stats = memory.getStats();
console.log('Total memories:', stats.totalMemories);

// Compact and prune
await memory.compact();
await memory.pruneOldMemories();
```

### Context Overflow

**Symptoms**: Cannot fit required context

**Solution**:
```typescript
// Increase max tokens
const context = await memory.compileVPContext({
  systemPrompt: prompt,
  maxTokens: 16000 // Increased from 8000
});

// Or reduce scratchpad usage
await memory.compact();
```

### Slow Searches

**Symptoms**: Search takes >1 second

**Solution**:
```typescript
// Be more specific
const results = await memory.search(
  memory.query()
    .withQuery('deployment')
    .withTypes('task') // Filter by type
    .inSession('session-1') // Filter by session
    .limit(10) // Reduce limit
    .build()
);
```

## Documentation

- [Memory Architecture](./docs/MEMORY_ARCHITECTURE.md) - Detailed architecture
- [Examples](./examples/memory-usage.ts) - Usage examples
- [API Reference](./memory-api.ts) - Full API documentation

## License

MIT
