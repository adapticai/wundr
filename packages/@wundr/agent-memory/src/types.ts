/**
 * @wundr.io/agent-memory - Type Definitions
 *
 * TypeScript interfaces for the MemGPT-inspired tiered memory architecture.
 * Defines structures for memory configuration, memories, managed context, and session state.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Schema for memory tier configuration
 */
export const MemoryTierConfigSchema = z.object({
  /** Maximum number of tokens allowed in this tier */
  maxTokens: z.number().positive(),
  /** Time-to-live in milliseconds (optional, undefined means no expiry) */
  ttlMs: z.number().positive().optional(),
  /** Whether compression is enabled for this tier */
  compressionEnabled: z.boolean().default(false),
  /** Threshold for triggering compaction (0-1) */
  compactionThreshold: z.number().min(0).max(1).default(0.8),
});

/**
 * Schema for forgetting curve configuration
 */
export const ForgettingCurveConfigSchema = z.object({
  /** Initial retention strength (0-1) */
  initialStrength: z.number().min(0).max(1).default(1.0),
  /** Decay rate parameter (higher = faster forgetting) */
  decayRate: z.number().positive().default(0.1),
  /** Minimum retention threshold before memory is forgotten */
  minimumThreshold: z.number().min(0).max(1).default(0.1),
  /** Strength boost on memory access */
  accessBoost: z.number().min(0).max(1).default(0.2),
  /** Consolidation threshold for promotion to long-term memory */
  consolidationThreshold: z.number().min(0).max(1).default(0.7),
});

/**
 * Schema for full memory configuration
 */
export const MemoryConfigSchema = z.object({
  /** Scratchpad (working memory) configuration */
  scratchpad: MemoryTierConfigSchema,
  /** Episodic memory configuration */
  episodic: MemoryTierConfigSchema,
  /** Semantic memory configuration */
  semantic: MemoryTierConfigSchema,
  /** Forgetting curve parameters */
  forgettingCurve: ForgettingCurveConfigSchema,
  /** Enable cross-session persistence */
  persistenceEnabled: z.boolean().default(true),
  /** Path for persistent storage */
  persistencePath: z.string().optional(),
  /** Enable automatic memory consolidation */
  autoConsolidation: z.boolean().default(true),
  /** Consolidation interval in milliseconds */
  consolidationIntervalMs: z.number().positive().default(300000),
});

/**
 * Schema for memory metadata
 */
export const MemoryMetadataSchema = z.object({
  /** When the memory was created */
  createdAt: z.date(),
  /** When the memory was last accessed */
  lastAccessedAt: z.date(),
  /** Number of times the memory has been accessed */
  accessCount: z.number().nonnegative().default(0),
  /** Current retention strength (0-1) */
  retentionStrength: z.number().min(0).max(1).default(1.0),
  /** Source of the memory */
  source: z.enum(['user', 'system', 'agent', 'consolidation']),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Priority level (higher = more important) */
  priority: z.number().min(0).max(10).default(5),
  /** Whether this memory is pinned (exempt from forgetting) */
  pinned: z.boolean().default(false),
  /** Associated agent ID */
  agentId: z.string().optional(),
  /** Associated task ID */
  taskId: z.string().optional(),
  /** Custom metadata fields */
  custom: z.record(z.unknown()).default({}),
});

/**
 * Schema for a single memory entry
 */
export const MemorySchema = z.object({
  /** Unique memory identifier */
  id: z.string().uuid(),
  /** Memory type/tier */
  type: z.enum(['scratchpad', 'episodic', 'semantic']),
  /** Memory content (flexible structure) */
  content: z.unknown(),
  /** Token count estimate for this memory */
  tokenCount: z.number().nonnegative(),
  /** Memory metadata */
  metadata: MemoryMetadataSchema,
  /** Embedding vector for semantic search (optional) */
  embedding: z.array(z.number()).optional(),
  /** Linked memory IDs for associative retrieval */
  linkedMemories: z.array(z.string().uuid()).default([]),
});

/**
 * Schema for managed context window
 */
export const ManagedContextSchema = z.object({
  /** System instructions (always included) */
  systemPrompt: z.string(),
  /** Active scratchpad entries */
  scratchpadEntries: z.array(MemorySchema),
  /** Retrieved episodic memories */
  episodicEntries: z.array(MemorySchema),
  /** Retrieved semantic memories */
  semanticEntries: z.array(MemorySchema),
  /** Total token count of context */
  totalTokens: z.number().nonnegative(),
  /** Maximum allowed tokens */
  maxTokens: z.number().positive(),
  /** Context utilization ratio (0-1) */
  utilization: z.number().min(0).max(1),
  /** Timestamp when context was compiled */
  compiledAt: z.date(),
});

/**
 * Schema for session state
 */
export const SessionStateSchema = z.object({
  /** Session identifier */
  sessionId: z.string(),
  /** When the session started */
  startedAt: z.date(),
  /** When the session was last active */
  lastActiveAt: z.date(),
  /** Current turn number in the conversation */
  turnNumber: z.number().nonnegative(),
  /** Active agent IDs in this session */
  activeAgents: z.array(z.string()),
  /** Current scratchpad state */
  scratchpadState: z.array(MemorySchema),
  /** Session-level metadata */
  metadata: z.record(z.unknown()).default({}),
  /** Whether session is currently active */
  isActive: z.boolean().default(true),
  /** Pending compaction flag */
  pendingCompaction: z.boolean().default(false),
});

// ============================================================================
// TypeScript Types (Inferred from Zod Schemas)
// ============================================================================

/**
 * Configuration for a single memory tier
 */
export type MemoryTierConfig = z.infer<typeof MemoryTierConfigSchema>;

/**
 * Configuration for the forgetting curve algorithm
 */
export type ForgettingCurveConfig = z.infer<typeof ForgettingCurveConfigSchema>;

/**
 * Full memory system configuration
 */
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

/**
 * Metadata attached to each memory entry
 */
export type MemoryMetadata = z.infer<typeof MemoryMetadataSchema>;

/**
 * A single memory entry in any tier
 */
export type Memory = z.infer<typeof MemorySchema>;

/**
 * Managed context window for AI agent consumption
 */
export type ManagedContext = z.infer<typeof ManagedContextSchema>;

/**
 * Session state for persistence and restoration
 */
export type SessionState = z.infer<typeof SessionStateSchema>;

// ============================================================================
// Additional Types (Not Schema-Validated)
// ============================================================================

/**
 * Memory tier identifiers
 */
export type MemoryTier = 'scratchpad' | 'episodic' | 'semantic';

/**
 * Memory source identifiers
 */
export type MemorySource = 'user' | 'system' | 'agent' | 'consolidation';

/**
 * Options for storing a new memory
 */
export interface StoreMemoryOptions {
  /** Target tier (defaults to scratchpad) */
  tier?: MemoryTier;
  /** Memory source */
  source: MemorySource;
  /** Tags for categorization */
  tags?: string[];
  /** Priority level */
  priority?: number;
  /** Pin memory to prevent forgetting */
  pinned?: boolean;
  /** Associated agent ID */
  agentId?: string;
  /** Associated task ID */
  taskId?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
  /** Pre-computed embedding vector */
  embedding?: number[];
  /** IDs of related memories to link */
  linkedMemories?: string[];
}

/**
 * Options for retrieving memories
 */
export interface RetrieveMemoryOptions {
  /** Target tier(s) to search */
  tiers?: MemoryTier[];
  /** Maximum number of memories to return */
  limit?: number;
  /** Minimum retention strength threshold */
  minStrength?: number;
  /** Filter by tags (OR logic) */
  tags?: string[];
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Sort by field */
  sortBy?: 'recency' | 'relevance' | 'strength' | 'priority';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Query embedding for semantic search */
  queryEmbedding?: number[];
  /** Include linked memories */
  includeLinked?: boolean;
}

/**
 * Result of a memory retrieval operation
 */
export interface RetrievalResult {
  /** Retrieved memories */
  memories: Memory[];
  /** Total count matching criteria */
  totalCount: number;
  /** Search latency in milliseconds */
  latencyMs: number;
  /** Whether results were truncated */
  truncated: boolean;
}

/**
 * Options for compiling managed context
 */
export interface CompileContextOptions {
  /** System prompt to include */
  systemPrompt: string;
  /** Maximum tokens for context */
  maxTokens: number;
  /** Query for relevance-based retrieval */
  query?: string;
  /** Query embedding for semantic search */
  queryEmbedding?: number[];
  /** Include all scratchpad entries */
  includeScratchpad?: boolean;
  /** Number of episodic memories to include */
  episodicLimit?: number;
  /** Number of semantic memories to include */
  semanticLimit?: number;
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by task ID */
  taskId?: string;
}

/**
 * Statistics for a memory tier
 */
export interface TierStatistics {
  /** Tier name */
  tier: MemoryTier;
  /** Number of memories in tier */
  memoryCount: number;
  /** Total tokens used */
  totalTokens: number;
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Utilization ratio */
  utilization: number;
  /** Average retention strength */
  avgStrength: number;
  /** Number of pinned memories */
  pinnedCount: number;
  /** Oldest memory timestamp */
  oldestMemory: Date | null;
  /** Newest memory timestamp */
  newestMemory: Date | null;
}

/**
 * Overall memory system statistics
 */
export interface MemoryStatistics {
  /** Statistics per tier */
  tiers: Record<MemoryTier, TierStatistics>;
  /** Total memories across all tiers */
  totalMemories: number;
  /** Total tokens across all tiers */
  totalTokens: number;
  /** Active sessions count */
  activeSessions: number;
  /** Memories consolidated in last interval */
  consolidatedLastInterval: number;
  /** Memories forgotten in last interval */
  forgottenLastInterval: number;
}

/**
 * Event types emitted by the memory system
 */
export type MemoryEventType =
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

/**
 * Memory system event payload
 */
export interface MemoryEvent {
  /** Event type */
  type: MemoryEventType;
  /** Event timestamp */
  timestamp: Date;
  /** Event payload */
  payload: {
    memoryId?: string;
    sessionId?: string;
    tier?: MemoryTier;
    details?: Record<string, unknown> | CompactionResult | ConsolidationResult;
  };
}

/**
 * Handler for memory events
 */
export type MemoryEventHandler = (event: MemoryEvent) => void | Promise<void>;

/**
 * Compaction result after tier cleanup
 */
export interface CompactionResult {
  /** Tier that was compacted */
  tier: MemoryTier;
  /** Number of memories before compaction */
  beforeCount: number;
  /** Number of memories after compaction */
  afterCount: number;
  /** Tokens freed */
  tokensFreed: number;
  /** Memories promoted to next tier */
  promoted: number;
  /** Memories forgotten */
  forgotten: number;
  /** Compaction duration in milliseconds */
  durationMs: number;
  /** Allow indexing for Record<string, unknown> compatibility */
  [key: string]: MemoryTier | number;
}

/**
 * Consolidation result for memory promotion
 */
export interface ConsolidationResult {
  /** Number of episodic memories consolidated */
  episodicConsolidated: number;
  /** Number promoted to semantic tier */
  promotedToSemantic: number;
  /** Clusters formed during consolidation */
  clustersFormed: number;
  /** Consolidation duration in milliseconds */
  durationMs: number;
  /** Allow indexing for Record<string, unknown> compatibility */
  [key: string]: number;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  scratchpad: {
    maxTokens: 4000,
    ttlMs: 3600000, // 1 hour
    compressionEnabled: false,
    compactionThreshold: 0.9,
  },
  episodic: {
    maxTokens: 16000,
    ttlMs: 86400000 * 7, // 7 days
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
  consolidationIntervalMs: 300000, // 5 minutes
};
