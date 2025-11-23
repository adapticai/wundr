# @wundr.io/agent-memory

MemGPT-inspired tiered memory architecture for AI agents. Provides intelligent context management with scratchpad (working), episodic (recent), and semantic (long-term) memory tiers, human-like forgetting curves, and cross-session persistence.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
  - [Memory Tiers](#memory-tiers)
  - [Forgetting Curve](#forgetting-curve)
- [Core API](#core-api)
  - [AgentMemoryManager](#agentmemorymanager)
  - [Memory Operations](#memory-operations)
  - [Context Compilation](#context-compilation)
- [Memory Tiers in Detail](#memory-tiers-in-detail)
  - [Scratchpad (Working Memory)](#scratchpad-working-memory)
  - [Episodic Store](#episodic-store)
  - [Semantic Store](#semantic-store)
- [Retrieval Strategies](#retrieval-strategies)
- [Session Management](#session-management)
- [Cross-Session Memory Sharing](#cross-session-memory-sharing)
- [Integration with VP Daemon](#integration-with-vp-daemon)
- [Events](#events)
- [Configuration Reference](#configuration-reference)
- [Types](#types)
- [Best Practices](#best-practices)

## Overview

This package implements a sophisticated memory system inspired by [MemGPT](https://memgpt.ai/), featuring:

- **Tiered Memory Architecture**: Three distinct tiers (scratchpad, episodic, semantic) with automatic promotion and compaction
- **Human-like Forgetting**: Ebbinghaus forgetting curve implementation for realistic memory decay
- **Intelligent Context Compilation**: Optimizes context window usage by selecting the most relevant memories
- **Session Persistence**: Cross-session memory management with automatic save/restore
- **Event-Driven Architecture**: Subscribe to memory lifecycle events for custom integrations

## Installation

```bash
npm install @wundr.io/agent-memory
# or
yarn add @wundr.io/agent-memory
# or
pnpm add @wundr.io/agent-memory
```

## Quick Start

```typescript
import { createMemoryManager } from '@wundr.io/agent-memory';

// Create and initialize memory manager
const memory = await createMemoryManager({
  config: {
    scratchpad: { maxTokens: 4000 },
    episodic: { maxTokens: 16000 },
    semantic: { maxTokens: 32000 },
  },
});

// Start a session
const sessionId = await memory.startSession({
  agentIds: ['my-agent'],
});

// Store memories
await memory.store(
  { role: 'user', content: 'Remember that I prefer TypeScript.' },
  { source: 'user', tier: 'scratchpad' }
);

await memory.store(
  { role: 'assistant', content: 'Noted! I will use TypeScript for code examples.' },
  { source: 'agent', tier: 'scratchpad' }
);

// Compile context for LLM
const context = await memory.compileContext({
  systemPrompt: 'You are a helpful coding assistant.',
  maxTokens: 8000,
  includeScratchpad: true,
  episodicLimit: 10,
  semanticLimit: 5,
});

console.log(`Context utilization: ${(context.utilization * 100).toFixed(1)}%`);

// End session (persists state)
await memory.endSession(true);
```

## Architecture

### Memory Tiers

The memory system uses three tiers inspired by human memory:

```
+------------------+     overflow      +------------------+     consolidation    +------------------+
|    SCRATCHPAD    | ----------------> |     EPISODIC     | -------------------> |     SEMANTIC     |
|  (Working Memory)|                   | (Recent Events)  |                      | (Long-term Facts)|
+------------------+                   +------------------+                      +------------------+
| - Immediate ctx  |                   | - Time-indexed   |                      | - Consolidated   |
| - Token-limited  |                   | - Session-scoped |                      | - High confidence|
| - Fast access    |                   | - TTL-based      |                      | - Permanent      |
| - Auto-eviction  |                   | - Semantic search|                      | - Knowledge graph|
+------------------+                   +------------------+                      +------------------+
     4,000 tokens                           16,000 tokens                            32,000 tokens
```

| Tier | Purpose | Default Size | TTL | Key Features |
|------|---------|--------------|-----|--------------|
| **Scratchpad** | Immediate working context | 4,000 tokens | 1 hour | Fast access, auto-eviction, priority-based |
| **Episodic** | Recent events and interactions | 16,000 tokens | 7 days | Time-indexed, session-scoped, semantic search |
| **Semantic** | Consolidated knowledge | 32,000 tokens | None | Confidence-scored, domain-indexed, knowledge graph |

### Forgetting Curve

Memory retention follows the Ebbinghaus forgetting curve:

```
Retention = S * e^(-t / (k * stability))
```

Where:
- `S` = initial strength
- `t` = time elapsed (hours)
- `k` = decay rate modifier
- `stability` = 1 + (accessCount * 0.5)

Memories that drop below the minimum threshold (default: 0.1) are forgotten. Memories above the consolidation threshold (default: 0.7) with multiple accesses are candidates for promotion to semantic memory.

## Core API

### AgentMemoryManager

The central orchestrator for the tiered memory system.

```typescript
import { AgentMemoryManager, createMemoryManager } from '@wundr.io/agent-memory';

// Option 1: Factory function (recommended)
const memory = await createMemoryManager({
  config: { /* optional overrides */ },
  tokenEstimator: (content) => Math.ceil(JSON.stringify(content).length / 4),
  autoConsolidation: true,
  autoCompaction: true,
});

// Option 2: Manual instantiation
const manager = new AgentMemoryManager({ /* options */ });
await manager.initialize();
```

### Memory Operations

#### Store

```typescript
// Store to scratchpad (default)
const memory = await manager.store(
  { role: 'user', content: 'Hello!' },
  {
    source: 'user',           // 'user' | 'system' | 'agent' | 'consolidation'
    tier: 'scratchpad',       // Optional: 'scratchpad' | 'episodic' | 'semantic'
    tags: ['greeting'],       // Optional: categorization tags
    priority: 7,              // Optional: 0-10, higher = more important
    pinned: false,            // Optional: prevent forgetting
    agentId: 'agent-1',       // Optional: associate with agent
    taskId: 'task-123',       // Optional: associate with task
    embedding: [...],         // Optional: pre-computed embedding
    linkedMemories: ['id1'],  // Optional: related memory IDs
  }
);
```

#### Retrieve

```typescript
// Get by ID
const memory = await manager.retrieve('memory-id');

// Search with criteria
const results = await manager.search({
  tiers: ['episodic', 'semantic'],  // Which tiers to search
  limit: 20,                         // Max results
  minStrength: 0.5,                  // Min retention strength
  tags: ['important'],               // Filter by tags (OR logic)
  agentId: 'agent-1',                // Filter by agent
  taskId: 'task-123',                // Filter by task
  sortBy: 'recency',                 // 'recency' | 'relevance' | 'strength' | 'priority'
  sortDirection: 'desc',             // 'asc' | 'desc'
  queryEmbedding: [...],             // Semantic search vector
  includeLinked: true,               // Include linked memories
});
```

#### Compact

```typescript
// Compact a specific tier
const result = await manager.runCompaction();
// Returns: { scratchpad: {...}, episodic: {...}, semantic: {...} }

// Result structure
interface CompactionResult {
  tier: MemoryTier;
  beforeCount: number;
  afterCount: number;
  tokensFreed: number;
  promoted: number;     // Moved to next tier
  forgotten: number;    // Permanently removed
  durationMs: number;
}
```

#### Archive (Consolidation)

```typescript
// Run consolidation process
const result = await manager.runConsolidation();
// Result: { episodicConsolidated, promotedToSemantic, clustersFormed, durationMs }

// Manually promote a memory
const promoted = await manager.promote('memory-id', 'episodic', 'semantic');
```

### Context Compilation

The core "virtual memory" function that assembles optimal context:

```typescript
const context = await manager.compileContext({
  systemPrompt: 'You are a helpful assistant.',
  maxTokens: 8000,

  // Control what's included
  includeScratchpad: true,    // Include all scratchpad (default: true)
  episodicLimit: 10,          // Number of episodic memories
  semanticLimit: 5,           // Number of semantic memories

  // Filtering
  agentId: 'agent-1',
  taskId: 'task-123',

  // Semantic search
  query: 'user preferences',
  queryEmbedding: [...],
});

// Result structure
interface ManagedContext {
  systemPrompt: string;
  scratchpadEntries: Memory[];
  episodicEntries: Memory[];
  semanticEntries: Memory[];
  totalTokens: number;
  maxTokens: number;
  utilization: number;        // 0-1 ratio
  compiledAt: Date;
}
```

## Memory Tiers in Detail

### Scratchpad (Working Memory)

Token-limited working memory for immediate context.

```typescript
import { Scratchpad } from '@wundr.io/agent-memory';

const scratchpad = new Scratchpad({
  maxTokens: 4000,
  ttlMs: 3600000,             // 1 hour
  compactionThreshold: 0.9,   // Compact at 90% capacity
  compressionEnabled: false,
  tokenEstimator: (content) => Math.ceil(JSON.stringify(content).length / 4),
  onOverflow: async (evictedMemories) => {
    // Handle evicted memories (e.g., promote to episodic)
  },
});

// Direct tier access via manager
const scratchpad = manager.getScratchpad();

// Key methods
await scratchpad.store(content, options);
scratchpad.get(id);
scratchpad.getAll();
scratchpad.getByTag('important');
scratchpad.getByAgent('agent-1');
scratchpad.pin(id);           // Prevent eviction
scratchpad.unpin(id);
scratchpad.link(sourceId, targetId);
scratchpad.clear(preservePinned);
await scratchpad.compact();
scratchpad.getStatistics();
scratchpad.getTokenCount();
scratchpad.getAvailableTokens();
scratchpad.needsCompaction();
```

### Episodic Store

Time-based autobiographical memories with temporal queries.

```typescript
import { EpisodicStore } from '@wundr.io/agent-memory';

const episodic = new EpisodicStore({
  maxTokens: 16000,
  ttlMs: 86400000 * 7,        // 7 days
  compactionThreshold: 0.8,
  compressionEnabled: true,
  similarityThreshold: 0.7,
  onConsolidate: async (memories) => {
    // Handle consolidation candidates
  },
});

// Store with episode metadata
await episodic.store(content, {
  source: 'agent',
  episode: {
    sessionId: 'session-123',
    turnNumber: 5,
    episodeType: 'conversation',  // 'conversation' | 'task' | 'error' | 'decision' | 'observation'
    participants: ['user', 'agent-1'],
    outcome: 'success',           // 'success' | 'failure' | 'partial' | 'pending'
    valence: 0.8,                 // Emotional valence: -1 to 1
    importance: 0.7,
  },
});

// Temporal queries
const recent = await episodic.queryByTimeRange(
  new Date(Date.now() - 3600000),  // 1 hour ago
  new Date(),
  50  // limit
);

// Session queries
const sessionMemories = await episodic.queryBySession('session-123');

// Semantic search
const similar = await episodic.findSimilar(queryEmbedding, 10);

// Get consolidation candidates
const candidates = episodic.getConsolidationCandidates(
  0.7,  // strengthThreshold
  2     // accessCountThreshold
);
```

### Semantic Store

Consolidated knowledge with confidence scoring and knowledge graphs.

```typescript
import { SemanticStore } from '@wundr.io/agent-memory';

const semantic = new SemanticStore({
  maxTokens: 32000,
  compactionThreshold: 0.7,
  compressionEnabled: true,
  similarityThreshold: 0.7,
  minConfidence: 0.3,
});

// Store with semantic metadata
await semantic.store(content, {
  source: 'consolidation',
  semantic: {
    category: 'preference',    // 'fact' | 'concept' | 'procedure' | 'preference' | 'pattern' | 'rule' | 'entity' | 'relationship'
    confidence: 0.9,
    domain: 'coding',
    relatedConcepts: ['typescript', 'programming'],
    supportingEvidenceCount: 3,
    sourceEpisodes: ['ep-1', 'ep-2', 'ep-3'],
    isLearned: true,
    contradictionCount: 0,
  },
});

// Consolidate from episodic memories
const created = await semantic.consolidate(episodes, (episodes) => {
  // Extract knowledge from episodes
  return [{
    content: { fact: 'User prefers TypeScript' },
    category: 'preference',
    domain: 'coding',
    confidence: 0.9,
  }];
});

// Reinforce existing knowledge
await semantic.reinforce(memoryId, newEvidence);

// Record contradictions
await semantic.contradict(memoryId, contradictingEvidence);

// Query by category or domain
const preferences = await semantic.queryByCategory('preference');
const codingKnowledge = await semantic.queryByDomain('coding');

// Knowledge graph operations
semantic.linkConcepts('typescript', 'javascript');
const related = semantic.getRelatedConcepts('typescript');
```

## Retrieval Strategies

The system supports multiple retrieval strategies:

### Recency-Weighted Relevance

The default strategy balances recency with semantic relevance:

```typescript
const results = await manager.search({
  sortBy: 'recency',
  sortDirection: 'desc',
  queryEmbedding: embeddingVector,  // Optional semantic boost
});
```

### Importance-Based (Forgetting Curve)

Uses the forgetting curve to rank by importance:

```typescript
const curve = manager.getForgettingCurve();
const sorted = curve.sortByImportance(memories);

// Importance calculation considers:
// - Retention strength (40% weight)
// - Access count (30% weight)
// - Recency (20% weight)
// - Priority (10% weight)
```

### Semantic Search

Use embedding vectors for similarity search:

```typescript
const results = await manager.search({
  queryEmbedding: await embedder.encode('user preferences'),
  sortBy: 'relevance',
  minStrength: 0.5,
});
```

## Session Management

```typescript
import { SessionManager } from '@wundr.io/agent-memory';

const sessionManager = manager.getSessionManager();

// Create session
const session = sessionManager.createSession({
  sessionId: 'custom-id',           // Optional
  agentIds: ['agent-1', 'agent-2'],
  metadata: { project: 'demo' },
});

// Session lifecycle
sessionManager.incrementTurn(sessionId);
sessionManager.updateActivity(sessionId);
sessionManager.addAgent(sessionId, 'agent-3');
sessionManager.removeAgent(sessionId, 'agent-2');
sessionManager.updateMetadata(sessionId, { phase: 'testing' });

// Persistence
await sessionManager.saveSession(sessionId);
await sessionManager.saveAllSessions();
const restored = await sessionManager.getSession(sessionId);

// Cleanup
sessionManager.cleanupInactiveSessions(86400000);  // 24 hours
await sessionManager.endSession(sessionId, true);   // persist = true
```

### Session Persistence Configuration

```typescript
const sessionManager = new SessionManager({
  autoSaveIntervalMs: 60000,   // Auto-save every minute
  maxCachedSessions: 10,       // LRU cache limit
  compression: false,
});

// Initialize with persistence callbacks
sessionManager.initialize(
  async (state) => {
    // Save to database/file
    await db.sessions.upsert(state);
  },
  async (sessionId) => {
    // Load from database/file
    return await db.sessions.findOne({ sessionId });
  }
);
```

## Cross-Session Memory Sharing

Memories persist across sessions through the tiered architecture:

1. **Scratchpad**: Cleared between sessions (or optionally restored)
2. **Episodic**: Persists across sessions, filtered by TTL
3. **Semantic**: Permanent knowledge, shared across all sessions

```typescript
// Serialize entire memory state
const state = manager.serialize();
// {
//   scratchpad: { memories, currentTokens },
//   episodic: { memories, currentTokens },
//   semantic: { memories, currentTokens, conceptGraph },
//   forgettingCurve: { config, schedules },
//   sessions: [...],
//   currentSessionId: '...',
// }

// Persist to storage
await fs.writeFile('memory-state.json', JSON.stringify(state));

// Restore state
const loaded = JSON.parse(await fs.readFile('memory-state.json'));
manager.restore(loaded);
```

## Integration with VP Daemon

The agent-memory package integrates with VP (Virtual Process) daemon for multi-agent orchestration:

```typescript
import { createMemoryManager } from '@wundr.io/agent-memory';

// Create shared memory manager for VP daemon
const sharedMemory = await createMemoryManager({
  config: {
    persistenceEnabled: true,
    persistencePath: '/var/vp-daemon/memory',
    autoConsolidation: true,
    consolidationIntervalMs: 300000,  // 5 minutes
  },
});

// Each agent gets its own session with shared episodic/semantic tiers
class VPAgent {
  constructor(
    private agentId: string,
    private memory: AgentMemoryManager
  ) {}

  async initialize() {
    await this.memory.startSession({
      agentIds: [this.agentId],
      metadata: { type: 'vp-agent' },
    });
  }

  async processMessage(message: string) {
    // Store interaction in scratchpad
    await this.memory.store(
      { role: 'user', content: message },
      { source: 'user', agentId: this.agentId }
    );

    // Compile context with agent-specific filtering
    const context = await this.memory.compileContext({
      systemPrompt: this.getSystemPrompt(),
      maxTokens: 8000,
      agentId: this.agentId,
      episodicLimit: 10,
      semanticLimit: 5,
    });

    // Use context for LLM call
    return await this.generateResponse(context);
  }
}

// VP daemon coordinates multiple agents
class VPDaemon {
  private agents = new Map<string, VPAgent>();

  constructor(private memory: AgentMemoryManager) {}

  async spawnAgent(agentId: string) {
    const agent = new VPAgent(agentId, this.memory);
    await agent.initialize();
    this.agents.set(agentId, agent);
    return agent;
  }

  async shutdown() {
    await this.memory.shutdown();
  }
}
```

## Events

Subscribe to memory lifecycle events:

```typescript
manager.on('memory:stored', (event) => {
  console.log(`Stored memory ${event.payload.memoryId} in ${event.payload.tier}`);
});

manager.on('memory:forgotten', (event) => {
  console.log(`Forgot memory ${event.payload.memoryId}`);
});

manager.on('memory:consolidated', (event) => {
  console.log(`Consolidated ${event.payload.details.episodicConsolidated} memories`);
});

manager.on('context:compiled', (event) => {
  console.log(`Context utilization: ${event.payload.details.utilization * 100}%`);
});

// Available events
type MemoryEventType =
  | 'memory:stored'
  | 'memory:retrieved'
  | 'memory:updated'
  | 'memory:forgotten'
  | 'memory:consolidated'
  | 'memory:promoted'
  | 'memory:linked'
  | 'tier:compacted'
  | 'tier:overflow'
  | 'session:created'
  | 'session:restored'
  | 'session:ended'
  | 'context:compiled';
```

## Configuration Reference

```typescript
const DEFAULT_MEMORY_CONFIG = {
  scratchpad: {
    maxTokens: 4000,
    ttlMs: 3600000,           // 1 hour
    compressionEnabled: false,
    compactionThreshold: 0.9,
  },
  episodic: {
    maxTokens: 16000,
    ttlMs: 86400000 * 7,      // 7 days
    compressionEnabled: true,
    compactionThreshold: 0.8,
  },
  semantic: {
    maxTokens: 32000,
    compressionEnabled: true,
    compactionThreshold: 0.7,
  },
  forgettingCurve: {
    initialStrength: 1.0,
    decayRate: 0.1,
    minimumThreshold: 0.1,
    accessBoost: 0.2,
    consolidationThreshold: 0.7,
  },
  persistenceEnabled: true,
  autoConsolidation: true,
  consolidationIntervalMs: 300000,  // 5 minutes
};
```

## Types

Key TypeScript types exported by the package:

```typescript
// Core types
export type MemoryTier = 'scratchpad' | 'episodic' | 'semantic';
export type MemorySource = 'user' | 'system' | 'agent' | 'consolidation';
export type KnowledgeCategory = 'fact' | 'concept' | 'procedure' | 'preference' | 'pattern' | 'rule' | 'entity' | 'relationship';

// Memory structure
export interface Memory {
  id: string;
  type: MemoryTier;
  content: unknown;
  tokenCount: number;
  metadata: MemoryMetadata;
  embedding?: number[];
  linkedMemories: string[];
}

export interface MemoryMetadata {
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
  retentionStrength: number;
  source: MemorySource;
  tags: string[];
  priority: number;
  pinned: boolean;
  agentId?: string;
  taskId?: string;
  custom: Record<string, unknown>;
}

// Statistics
export interface TierStatistics {
  tier: MemoryTier;
  memoryCount: number;
  totalTokens: number;
  maxTokens: number;
  utilization: number;
  avgStrength: number;
  pinnedCount: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
}
```

## Best Practices

### 1. Token Budget Management

```typescript
// Reserve tokens for system prompt and response
const systemPromptTokens = estimateTokens(systemPrompt);
const responseBuffer = 1000;  // Reserve for response
const availableForContext = maxTokens - systemPromptTokens - responseBuffer;

const context = await manager.compileContext({
  systemPrompt,
  maxTokens: availableForContext,
  // ...
});
```

### 2. Strategic Pinning

```typescript
// Pin critical information
await manager.store(
  { type: 'system_rule', content: 'Never reveal API keys' },
  { source: 'system', pinned: true, priority: 10 }
);
```

### 3. Efficient Retrieval

```typescript
// Use embeddings for semantic search when available
const context = await manager.compileContext({
  // ...
  queryEmbedding: await embedder.encode(userMessage),
  episodicLimit: 5,  // Limit to most relevant
});
```

### 4. Memory Hygiene

```typescript
// Periodically run cleanup
setInterval(async () => {
  await manager.runCompaction();
  await manager.applyDecay();
  manager.getSessionManager().cleanupInactiveSessions(86400000);
}, 3600000);  // Every hour
```

### 5. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await manager.shutdown();
  process.exit(0);
});
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
