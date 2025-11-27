# VP-Daemon Memory Architecture

## Overview

The VP-Daemon implements a sophisticated tiered memory architecture inspired by MemGPT and cognitive psychology principles. The system provides persistent, searchable, and automatically managed memory for Virtual Principal sessions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VP-Daemon Memory                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Scratchpad  │  │   Episodic   │  │   Semantic   │ │
│  │   (Working)  │  │  (History)   │  │  (Knowledge) │ │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤ │
│  │ 8K tokens    │  │ 32K tokens   │  │ 64K tokens   │ │
│  │ TTL: 1 hour  │  │ TTL: 30 days │  │ No expiry    │ │
│  │ Current work │  │ Task history │  │ Policies     │ │
│  │ Active tasks │  │ Decisions    │  │ Patterns     │ │
│  │ Triage queue │  │ Sessions     │  │ Knowledge    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Forgetting Curve Engine               │   │
│  │  - Decay rate: 0.05 (slower than default)       │   │
│  │  - Access boost: 0.3                            │   │
│  │  - Consolidation threshold: 0.75                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Persistence Layer                      │   │
│  │  - Auto-save: 1 minute intervals                │   │
│  │  - Disk storage: ~/.orchestrator-daemon/memory            │   │
│  │  - Archive: 90-day rotation                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Memory Tiers

### 1. Scratchpad (Working Memory)

**Purpose**: Current session context and active tasks
**Capacity**: 8,000 tokens
**TTL**: 1 hour
**Compression**: Disabled (fast access)

**Contents**:
- Active tasks and their status
- Current triage requests
- Recent command outputs
- Temporary session data

**Eviction Policy**:
- Oldest-first when capacity reached
- Automatic promotion to episodic tier
- Cleared on session end

### 2. Episodic (Session History)

**Purpose**: Task and decision history
**Capacity**: 32,000 tokens
**TTL**: 30 days
**Compression**: Enabled

**Contents**:
- Completed tasks
- Agent decisions and rationale
- Triage results
- Session snapshots
- Intervention events

**Consolidation**:
- Every 10 minutes
- High-value memories promoted to semantic tier
- Based on access count and retention strength

### 3. Semantic (Knowledge Base)

**Purpose**: Learned patterns, policies, and knowledge
**Capacity**: 64,000 tokens
**TTL**: None (permanent)
**Compression**: Enabled

**Contents**:
- Policies (pinned, never forgotten)
- Learned patterns (high confidence)
- Consolidated knowledge
- Best practices
- Guardian interactions

**Characteristics**:
- Pinned memories exempt from forgetting
- Highest priority in context compilation
- Manually curated content

## Memory Types

### Task Memory

```typescript
interface TaskMemory {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  assignedSlot?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: unknown;
  metadata: Record<string, unknown>;
}
```

**Lifecycle**:
1. Created in scratchpad as 'pending'
2. Moved to 'in_progress' when assigned
3. Promoted to episodic on completion
4. Archived after 30 days

### Decision Memory

```typescript
interface DecisionMemory {
  timestamp: Date;
  sessionId: string;
  agentId: string;
  action: string;
  rationale: string;
  outcome: 'approved' | 'rejected' | 'escalated';
  context: string;
  rewardScores: Record<string, number>;
  policyChecks: Record<string, boolean>;
  escalationTriggers: string[];
}
```

**Usage**:
- Stored in episodic tier
- Tagged by outcome and agent
- High priority if escalated
- Used for learning patterns

### Policy Memory

```typescript
interface PolicyMemory {
  policyId: string;
  name: string;
  rule: string;
  violationCount: number;
  lastViolation?: Date;
  examples: Array<{
    description: string;
    outcome: 'pass' | 'fail';
  }>;
}
```

**Characteristics**:
- Stored in semantic tier
- Pinned (never forgotten)
- Priority: 9/10
- Updated on violations

### Pattern Memory

```typescript
interface PatternMemory {
  patternId: string;
  name: string;
  description: string;
  occurrenceCount: number;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;
  tags: string[];
}
```

**Learning Process**:
1. Detected from episodic memories
2. Initial confidence: 0.5
3. Reinforced on each occurrence (+5% confidence)
4. Promoted to semantic at 0.75 confidence

## Forgetting Curve

The system implements Ebbinghaus forgetting curve with:

- **Initial Strength**: 1.0 (perfect retention)
- **Decay Rate**: 0.05 (slower than default for important Orchestrator memories)
- **Minimum Threshold**: 0.15 (below this, memory forgotten)
- **Access Boost**: 0.3 (significant boost on retrieval)
- **Consolidation Threshold**: 0.75 (promote to higher tier)

**Formula**:
```
R(t) = R0 * e^(-λt) + B * A
where:
  R(t) = retention at time t
  R0 = initial retention
  λ = decay rate (0.05)
  B = access boost (0.3)
  A = access count
```

## Context Compilation

When compiling context for the VP, memories are selected in order:

1. **System Prompt** (always included)
2. **Scratchpad** (all active tasks, recent work)
3. **Semantic** (relevant policies, patterns)
4. **Episodic** (relevant decisions, history)

**Token Budget Allocation**:
- System Prompt: As specified
- Scratchpad: Up to capacity
- Semantic: 20% of remaining
- Episodic: 80% of remaining

## Persistence

### Auto-Save

- **Interval**: 1 minute
- **Format**: JSON
- **Location**: `~/.orchestrator-daemon/memory/`

**Files**:
```
~/.orchestrator-daemon/memory/
├── state.json          # Full memory state
├── caches.json         # Quick-access caches
├── scratchpad/         # Scratchpad snapshots
├── episodic/           # Episodic store
├── semantic/           # Semantic store
└── archives/           # Old memory archives
```

### Archival

**Policy**:
- Archive memories older than 90 days
- Compress to `archive-YYYY-MM-DD.json`
- Keep archives for 1 year
- Pinned memories exempt

**Process**:
```bash
# Manual archive
npm run orchestrator-daemon -- archive --older-than 90

# Scheduled (via cron)
0 0 * * 0  # Weekly on Sunday
```

## Memory API

### High-Level Operations

```typescript
import { createMemoryAPI } from './memory-api';

const memory = await createMemoryAPI();

// Tasks
await memory.createTask({
  taskId: 'task-1',
  description: 'Implement feature X',
  priority: 7
});

await memory.startTask('task-1', 'slot-1');
await memory.completeTask('task-1', { success: true });

// Decisions
await memory.recordDecision({
  sessionId: 'session-1',
  agentId: 'agent-1',
  action: 'deploy',
  rationale: 'Tests passed',
  outcome: 'approved',
  context: 'Production deployment'
});

// Policies
await memory.addPolicy({
  policyId: 'no-force-push',
  name: 'No Force Push',
  rule: 'git push --force is forbidden on protected branches'
});

// Patterns
await memory.learnPattern({
  patternId: 'common-error',
  name: 'Null Pointer in User Service',
  description: 'Frequent NPE in UserService.getProfile()',
  confidence: 0.8,
  tags: ['error', 'user-service']
});

// Context
const context = await memory.compileVPContext({
  systemPrompt: 'You are the Virtual Principal...',
  maxTokens: 8000
});

// Search
const results = await memory.search(
  memory.query()
    .withQuery('deployment')
    .withTypes('task', 'decision')
    .inSession('session-1')
    .limit(20)
    .build()
);

// Maintenance
const stats = memory.getStats();
const health = memory.needsMaintenance();
if (health.needsConsolidation) {
  await memory.consolidate();
}
```

## Integration with @wundr.io/agent-memory

The Orchestrator Memory System is built on top of `@wundr.io/agent-memory`, leveraging:

- ✅ Tiered memory architecture
- ✅ Forgetting curve algorithms
- ✅ Automatic consolidation
- ✅ Memory compaction
- ✅ Session management
- ✅ Serialization/deserialization

**Benefits**:
- Battle-tested memory management
- Consistent API across Wundr ecosystem
- Advanced features (embeddings, semantic search)
- Well-documented and tested

## Performance Characteristics

### Memory Operations

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Store | O(1) | Constant time insert |
| Retrieve by ID | O(1) | Hash map lookup |
| Search | O(n log n) | Sorted by relevance |
| Consolidate | O(n) | Process all episodic |
| Compact | O(n) | Process each tier |
| Context Compile | O(n log n) | Sort by priority |

### Space Complexity

| Tier | Tokens | Approximate Size |
|------|--------|------------------|
| Scratchpad | 8K | ~32 KB |
| Episodic | 32K | ~128 KB |
| Semantic | 64K | ~256 KB |
| **Total** | **104K** | **~416 KB** |

Plus metadata, indices, and caches: **~1 MB total**

## Monitoring

### Health Metrics

```typescript
const stats = memory.getStats();

// Per-tier metrics
stats.tiers.scratchpad.utilization  // 0.0 - 1.0
stats.tiers.episodic.memoryCount    // Total memories
stats.tiers.semantic.avgStrength    // Avg retention

// Global metrics
stats.totalMemories                 // All tiers
stats.activeSessions                // Current sessions
stats.consolidatedLastInterval      // Recent consolidation
stats.forgottenLastInterval         // Recent forgetting
```

### Alerts

**High Utilization** (>90%)
- Action: Run compaction
- Urgency: Medium

**Episodic Overflow** (>80%)
- Action: Run consolidation
- Urgency: Low

**Scratchpad Full** (100%)
- Action: Immediate compaction
- Urgency: High

## Best Practices

### 1. Task Management

```typescript
// ✅ Good: Clear, descriptive tasks
await memory.createTask({
  taskId: `task-${Date.now()}`,
  description: 'Refactor authentication module',
  priority: 7,
  metadata: {
    module: 'auth',
    type: 'refactor',
    estimatedHours: 8
  }
});

// ❌ Bad: Vague, no metadata
await memory.createTask({
  taskId: 'task1',
  description: 'Fix stuff',
  priority: 5
});
```

### 2. Decision Recording

```typescript
// ✅ Good: Full context
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

// ❌ Bad: Minimal context
await memory.recordDecision({
  sessionId: 's1',
  agentId: 'a1',
  action: 'approve',
  rationale: 'looks good',
  outcome: 'approved',
  context: 'PR'
});
```

### 3. Policy Definition

```typescript
// ✅ Good: Clear rules with examples
await memory.addPolicy({
  policyId: 'deployment-hours',
  name: 'Deployment Hours Policy',
  rule: 'Production deployments only between 9 AM - 5 PM EST on weekdays',
  examples: [
    {
      description: 'Deploy at 10 AM Tuesday',
      outcome: 'pass'
    },
    {
      description: 'Deploy at 11 PM Saturday',
      outcome: 'fail'
    }
  ]
});
```

### 4. Pattern Learning

```typescript
// Detect pattern from multiple observations
const errors = await memory.search(
  memory.query()
    .withQuery('NullPointerException')
    .withTypes('decision')
    .limit(50)
    .build()
);

if (errors.totalCount > 10) {
  await memory.learnPattern({
    patternId: 'npe-user-service',
    name: 'NPE in User Service',
    description: `Recurring null pointer exceptions in UserService.getProfile(),
                  typically when user ID is invalid or session expired`,
    confidence: Math.min(errors.totalCount / 50, 0.95),
    tags: ['error', 'user-service', 'npe']
  });
}
```

### 5. Regular Maintenance

```typescript
// Daily maintenance routine
async function dailyMaintenance() {
  const memory = await createMemoryAPI();

  // Check health
  const health = memory.needsMaintenance();
  console.log('Memory health:', health.reason);

  // Consolidate if needed
  if (health.needsConsolidation) {
    await memory.consolidate();
  }

  // Compact if needed
  if (health.needsCompaction) {
    await memory.compact();
  }

  // Prune old scratchpad
  await memory.pruneOldMemories({
    scratchpadMaxAgeDays: 1,
    episodicMaxAgeDays: 30
  });

  // Weekly: Archive
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0) { // Sunday
    await memory.archiveOldMemories(90);
  }

  // Save state
  await memory.save();

  console.log('Maintenance complete:', memory.getStats());
}
```

## Troubleshooting

### Issue: High Memory Usage

**Symptoms**: System using >500 MB RAM

**Diagnosis**:
```typescript
const stats = memory.getStats();
console.log('Total memories:', stats.totalMemories);
console.log('Utilization:', stats.tiers.scratchpad.utilization);
```

**Solutions**:
1. Run compaction: `await memory.compact()`
2. Increase compaction frequency
3. Lower token limits in config
4. Archive old memories more aggressively

### Issue: Context Overflow

**Symptoms**: Cannot fit required context in token limit

**Diagnosis**:
```typescript
const context = await memory.compileVPContext({
  systemPrompt: prompt,
  maxTokens: 8000
});
console.log('Utilization:', context.utilization); // >1.0 means overflow
```

**Solutions**:
1. Increase maxTokens
2. Reduce scratchpad size
3. Be more selective with episodic/semantic includes
4. Compact scratchpad

### Issue: Slow Searches

**Symptoms**: Search takes >1 second

**Diagnosis**:
```typescript
const result = await memory.search(query);
console.log('Search time:', result.searchTimeMs, 'ms');
```

**Solutions**:
1. Add more specific filters (agent, session, type)
2. Reduce limit
3. Enable semantic search (requires embeddings)
4. Run consolidation to reduce episodic count

## Future Enhancements

### Planned Features

1. **Semantic Search**
   - Embedding generation via OpenAI
   - Vector similarity search
   - Relevance ranking

2. **Memory Clustering**
   - Group related memories
   - Automatic theme extraction
   - Hierarchical organization

3. **Adaptive Parameters**
   - Learn optimal decay rates
   - Adjust consolidation frequency
   - Dynamic token allocation

4. **Cross-Session Learning**
   - Pattern transfer between agents
   - Shared knowledge base
   - Collective memory

5. **Advanced Analytics**
   - Memory access heatmaps
   - Forgetting curve visualization
   - Decision correlation analysis

## References

- [MemGPT Paper](https://arxiv.org/abs/2310.08560)
- [@wundr.io/agent-memory Documentation](../packages/@wundr/agent-memory/README.md)
- [Ebbinghaus Forgetting Curve](https://en.wikipedia.org/wiki/Forgetting_curve)
- [Virtual Memory Management](https://en.wikipedia.org/wiki/Virtual_memory)
