/**
 * VP-Daemon Memory System
 *
 * Tiered memory architecture for Virtual Principal sessions:
 * - Scratchpad: Current session context, active tasks
 * - Episodic: Session history, task completions, agent decisions
 * - Semantic: Learned patterns, policies, knowledge base
 *
 * Integrates with @wundr.io/agent-memory for advanced memory management.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import {
  type AgentMemoryManager,
  type CompileContextOptions,
  type ManagedContext,
  type Memory,
  type MemoryConfig,
  type MemoryStatistics,
  type RetrieveMemoryOptions,
  type StoreMemoryOptions,
  createMemoryManager,
} from '@wundr.io/agent-memory';

import type {
  DecisionTelemetry,
  SessionSlot,
  TriageRequest,
  TriageResult,
} from './types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * VP-specific memory entry types
 */
export type VPMemoryType =
  | 'task'
  | 'decision'
  | 'triage'
  | 'policy'
  | 'pattern'
  | 'session'
  | 'intervention'
  | 'guardian_interaction';

/**
 * Memory storage configuration for VP-Daemon
 */
export interface VPMemoryConfig {
  /** Base directory for memory storage */
  basePath: string;
  /** Whether to persist to disk */
  persistToDisk: boolean;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs: number;
  /** Memory tier configuration */
  tiers: MemoryConfig;
  /** Enable semantic search */
  enableSemanticSearch: boolean;
}

/**
 * Task memory entry
 */
export interface TaskMemory {
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

/**
 * Decision memory entry (from telemetry)
 */
export interface DecisionMemory extends DecisionTelemetry {
  outcome: 'approved' | 'rejected' | 'escalated';
  context: string;
}

/**
 * Triage memory entry
 */
export interface TriageMemory {
  request: TriageRequest;
  result: TriageResult;
  processingTimeMs: number;
  timestamp: Date;
}

/**
 * Policy memory entry
 */
export interface PolicyMemory {
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

/**
 * Pattern memory entry
 */
export interface PatternMemory {
  patternId: string;
  name: string;
  description: string;
  occurrenceCount: number;
  firstSeen: Date;
  lastSeen: Date;
  confidence: number;
  tags: string[];
}

/**
 * Session snapshot
 */
export interface SessionSnapshot {
  sessionId: string;
  slot: SessionSlot;
  startTime: Date;
  endTime?: Date;
  taskCount: number;
  decisionsCount: number;
  escalationsCount: number;
  summary: string;
}

/**
 * Memory search query
 */
export interface MemorySearchQuery {
  query: string;
  types?: VPMemoryType[];
  sessionId?: string;
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  memories: Memory[];
  totalCount: number;
  searchTimeMs: number;
  facets: {
    types: Record<VPMemoryType, number>;
    sessions: Record<string, number>;
    agents: Record<string, number>;
  };
}

/**
 * Memory pruning policy
 */
export interface PruningPolicy {
  /** Maximum age for scratchpad entries (ms) */
  scratchpadMaxAge: number;
  /** Maximum age for episodic entries (ms) */
  episodicMaxAge: number;
  /** Minimum access count to keep */
  minAccessCount: number;
  /** Minimum retention strength to keep */
  minRetentionStrength: number;
  /** Always keep pinned memories */
  preservePinned: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_VP_MEMORY_CONFIG: VPMemoryConfig = {
  basePath: path.join(process.env['HOME'] || '~', '.vp-daemon', 'memory'),
  persistToDisk: true,
  autoSaveIntervalMs: 60000, // 1 minute
  enableSemanticSearch: false,
  tiers: {
    scratchpad: {
      maxTokens: 8000, // Current session context
      ttlMs: 3600000, // 1 hour
      compressionEnabled: false,
      compactionThreshold: 0.9,
    },
    episodic: {
      maxTokens: 32000, // Session history
      ttlMs: 86400000 * 30, // 30 days
      compressionEnabled: true,
      compactionThreshold: 0.8,
    },
    semantic: {
      maxTokens: 64000, // Knowledge base
      compressionEnabled: true,
      compactionThreshold: 0.7,
      // No TTL - long-term storage
    },
    forgettingCurve: {
      initialStrength: 1.0,
      decayRate: 0.05, // Slower decay for VP memories
      minimumThreshold: 0.15,
      accessBoost: 0.3,
      consolidationThreshold: 0.75,
    },
    persistenceEnabled: true,
    autoConsolidation: true,
    consolidationIntervalMs: 600000, // 10 minutes
  },
};

const DEFAULT_PRUNING_POLICY: PruningPolicy = {
  scratchpadMaxAge: 3600000, // 1 hour
  episodicMaxAge: 86400000 * 30, // 30 days
  minAccessCount: 2,
  minRetentionStrength: 0.2,
  preservePinned: true,
};

// ============================================================================
// VP Memory System
// ============================================================================

/**
 * VP Memory System - Manages tiered memory for Virtual Principal
 *
 * Provides:
 * - Scratchpad: Active session context
 * - Episodic: Task and decision history
 * - Semantic: Learned policies and patterns
 * - Integration with @wundr.io/agent-memory
 * - Disk persistence and archival
 */
export class VPMemorySystem {
  private readonly config: VPMemoryConfig;
  private memoryManager: AgentMemoryManager | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  // In-memory caches for quick access
  private taskCache = new Map<string, TaskMemory>();
  private policyCache = new Map<string, PolicyMemory>();
  private patternCache = new Map<string, PatternMemory>();

  constructor(config?: Partial<VPMemoryConfig>) {
    this.config = {
      ...DEFAULT_VP_MEMORY_CONFIG,
      ...config,
      tiers: {
        ...DEFAULT_VP_MEMORY_CONFIG.tiers,
        ...config?.tiers,
      },
    };
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure memory directories exist
    await this.ensureDirectories();

    // Initialize agent memory manager
    this.memoryManager = await createMemoryManager({
      config: this.config.tiers,
    });

    // Start a default session
    await this.memoryManager.startSession({
      agentIds: ['vp-daemon'],
      metadata: {
        daemonStartTime: new Date().toISOString(),
      },
    });

    // Load persistent data
    if (this.config.persistToDisk) {
      await this.loadFromDisk();
    }

    // Start auto-save
    if (this.config.persistToDisk && this.config.autoSaveIntervalMs > 0) {
      this.startAutoSave();
    }

    this.initialized = true;
  }

  /**
   * Shutdown the memory system
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Stop auto-save
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Save to disk
    if (this.config.persistToDisk && this.memoryManager) {
      await this.saveToDisk();
    }

    // Shutdown memory manager
    if (this.memoryManager) {
      await this.memoryManager.shutdown();
      this.memoryManager = null;
    }

    this.initialized = false;
  }

  // ============================================================================
  // Task Memory Operations
  // ============================================================================

  /**
   * Store a task in memory
   */
  async storeTask(task: Omit<TaskMemory, 'createdAt' | 'updatedAt'>): Promise<void> {
    this.assertInitialized();

    const fullTask: TaskMemory = {
      ...task,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.taskCache.set(task.taskId, fullTask);

    await this.memoryManager!.store(fullTask, {
      source: 'system',
      tier: 'scratchpad',
      tags: ['task', task.status, `priority:${task.priority}`],
      priority: task.priority,
      agentId: 'vp-daemon',
      taskId: task.taskId,
      custom: { type: 'task' as VPMemoryType },
    });
  }

  /**
   * Update a task in memory
   */
  async updateTask(
    taskId: string,
    updates: Partial<Omit<TaskMemory, 'taskId' | 'createdAt'>>,
  ): Promise<void> {
    this.assertInitialized();

    const existing = this.taskCache.get(taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found in memory`);
    }

    const updated: TaskMemory = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.taskCache.set(taskId, updated);

    // Store updated version
    await this.memoryManager!.store(updated, {
      source: 'system',
      tier: 'scratchpad',
      tags: ['task', updated.status, `priority:${updated.priority}`],
      priority: updated.priority,
      agentId: 'vp-daemon',
      taskId: taskId,
      custom: { type: 'task' as VPMemoryType },
    });
  }

  /**
   * Get a task from memory
   */
  getTask(taskId: string): TaskMemory | undefined {
    return this.taskCache.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): TaskMemory[] {
    return Array.from(this.taskCache.values()).filter(
      t => t.status === 'in_progress' || t.status === 'pending',
    );
  }

  // ============================================================================
  // Decision Memory Operations
  // ============================================================================

  /**
   * Store a decision in episodic memory
   */
  async storeDecision(decision: DecisionMemory): Promise<void> {
    this.assertInitialized();

    await this.memoryManager!.store(decision, {
      source: 'agent',
      tier: 'episodic',
      tags: [
        'decision',
        decision.outcome,
        decision.agentId,
        ...decision.escalationTriggers,
      ],
      priority: decision.escalationTriggers.length > 0 ? 8 : 5,
      agentId: decision.agentId,
      custom: { type: 'decision' as VPMemoryType },
    });
  }

  /**
   * Get decisions by agent
   */
  async getDecisionsByAgent(agentId: string, limit: number = 50): Promise<Memory[]> {
    this.assertInitialized();

    const result = await this.memoryManager!.search({
      tiers: ['episodic'],
      agentId,
      tags: ['decision'],
      limit,
      sortBy: 'recency',
      sortDirection: 'desc',
    });

    return result.memories;
  }

  // ============================================================================
  // Triage Memory Operations
  // ============================================================================

  /**
   * Store a triage result
   */
  async storeTriage(triage: TriageMemory): Promise<void> {
    this.assertInitialized();

    await this.memoryManager!.store(triage, {
      source: 'system',
      tier: 'scratchpad',
      tags: ['triage', triage.result.intent, `priority:${triage.result.priority}`],
      priority: triage.result.priority,
      custom: { type: 'triage' as VPMemoryType },
    });
  }

  // ============================================================================
  // Policy Memory Operations
  // ============================================================================

  /**
   * Store or update a policy
   */
  async storePolicy(policy: PolicyMemory): Promise<void> {
    this.assertInitialized();

    this.policyCache.set(policy.policyId, policy);

    await this.memoryManager!.store(policy, {
      source: 'system',
      tier: 'semantic',
      tags: ['policy', policy.name],
      priority: 9, // High priority for policies
      pinned: true, // Never forget policies
      custom: { type: 'policy' as VPMemoryType },
    });
  }

  /**
   * Get a policy by ID
   */
  getPolicy(policyId: string): PolicyMemory | undefined {
    return this.policyCache.get(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): PolicyMemory[] {
    return Array.from(this.policyCache.values());
  }

  /**
   * Record a policy violation
   */
  async recordPolicyViolation(policyId: string): Promise<void> {
    const policy = this.policyCache.get(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    policy.violationCount++;
    policy.lastViolation = new Date();

    await this.storePolicy(policy);
  }

  // ============================================================================
  // Pattern Memory Operations
  // ============================================================================

  /**
   * Store or update a learned pattern
   */
  async storePattern(pattern: PatternMemory): Promise<void> {
    this.assertInitialized();

    this.patternCache.set(pattern.patternId, pattern);

    await this.memoryManager!.store(pattern, {
      source: 'consolidation',
      tier: 'semantic',
      tags: ['pattern', ...pattern.tags],
      priority: Math.floor(pattern.confidence * 10),
      custom: { type: 'pattern' as VPMemoryType },
    });
  }

  /**
   * Get a pattern by ID
   */
  getPattern(patternId: string): PatternMemory | undefined {
    return this.patternCache.get(patternId);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): PatternMemory[] {
    return Array.from(this.patternCache.values());
  }

  /**
   * Record pattern occurrence
   */
  async recordPatternOccurrence(patternId: string): Promise<void> {
    const pattern = this.patternCache.get(patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    pattern.occurrenceCount++;
    pattern.lastSeen = new Date();
    pattern.confidence = Math.min(
      1.0,
      pattern.confidence + 0.05 * (1 - pattern.confidence),
    );

    await this.storePattern(pattern);
  }

  // ============================================================================
  // Session Memory Operations
  // ============================================================================

  /**
   * Store a session snapshot
   */
  async storeSessionSnapshot(snapshot: SessionSnapshot): Promise<void> {
    this.assertInitialized();

    await this.memoryManager!.store(snapshot, {
      source: 'system',
      tier: 'episodic',
      tags: ['session', snapshot.sessionId],
      priority: 5,
      custom: {
        type: 'session' as VPMemoryType,
        sessionId: snapshot.sessionId,
      },
    });
  }

  // ============================================================================
  // Context Compilation
  // ============================================================================

  /**
   * Compile context for the Virtual Principal
   */
  async compileContext(options: {
    systemPrompt: string;
    maxTokens: number;
    includeActiveTasks?: boolean;
    includePolicies?: boolean;
    includePatterns?: boolean;
  }): Promise<ManagedContext> {
    this.assertInitialized();

    const compileOptions: CompileContextOptions = {
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      includeScratchpad: true,
      episodicLimit: 10,
      semanticLimit: 5,
      agentId: 'vp-daemon',
    };

    const context = await this.memoryManager!.compileContext(compileOptions);

    // Optionally inject additional context
    if (options.includeActiveTasks) {
      const tasks = this.getActiveTasks();
      // Tasks are already in scratchpad, but we could add summary
    }

    if (options.includePolicies) {
      const policies = this.getAllPolicies();
      // Policies are already in semantic memory
    }

    if (options.includePatterns) {
      const patterns = this.getAllPatterns().filter(p => p.confidence > 0.7);
      // High-confidence patterns are already in semantic memory
    }

    return context;
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search memory across all tiers
   */
  async search(query: MemorySearchQuery): Promise<MemorySearchResult> {
    this.assertInitialized();

    const startTime = Date.now();

    const searchOptions: RetrieveMemoryOptions = {
      limit: query.limit || 50,
      tags: query.types,
      agentId: query.agentId,
      sortBy: 'relevance',
      sortDirection: 'desc',
    };

    const result = await this.memoryManager!.search(searchOptions);

    // Calculate facets
    const facets = {
      types: {} as Record<VPMemoryType, number>,
      sessions: {} as Record<string, number>,
      agents: {} as Record<string, number>,
    };

    for (const memory of result.memories) {
      const type = (memory.metadata.custom as { type?: VPMemoryType })?.type;
      if (type) {
        facets.types[type] = (facets.types[type] || 0) + 1;
      }

      const sessionId = (memory.metadata.custom as { sessionId?: string })?.sessionId;
      if (sessionId) {
        facets.sessions[sessionId] = (facets.sessions[sessionId] || 0) + 1;
      }

      if (memory.metadata.agentId) {
        facets.agents[memory.metadata.agentId] =
          (facets.agents[memory.metadata.agentId] || 0) + 1;
      }
    }

    return {
      memories: result.memories,
      totalCount: result.totalCount,
      searchTimeMs: Date.now() - startTime,
      facets,
    };
  }

  // ============================================================================
  // Memory Management
  // ============================================================================

  /**
   * Run memory consolidation
   */
  async consolidate(): Promise<void> {
    this.assertInitialized();
    await this.memoryManager!.runConsolidation();
  }

  /**
   * Run memory compaction
   */
  async compact(): Promise<void> {
    this.assertInitialized();
    await this.memoryManager!.runCompaction();
  }

  /**
   * Prune old memories based on policy
   */
  async prune(policy: Partial<PruningPolicy> = {}): Promise<{
    pruned: number;
    preserved: number;
  }> {
    this.assertInitialized();

    const fullPolicy = { ...DEFAULT_PRUNING_POLICY, ...policy };
    const now = Date.now();
    let pruned = 0;
    let preserved = 0;

    // Apply decay first
    const decayResult = await this.memoryManager!.applyDecay();
    pruned += decayResult.forgotten;

    // Get all memories
    const scratchpad = this.memoryManager!.getScratchpad().getAll();
    const episodic = this.memoryManager!.getEpisodic().getAll();

    // Prune scratchpad
    for (const memory of scratchpad) {
      if (fullPolicy.preservePinned && memory.metadata.pinned) {
        preserved++;
        continue;
      }

      const age = now - memory.metadata.createdAt.getTime();
      if (
        age > fullPolicy.scratchpadMaxAge ||
        (memory.metadata.accessCount < fullPolicy.minAccessCount &&
          memory.metadata.retentionStrength < fullPolicy.minRetentionStrength)
      ) {
        this.memoryManager!.getScratchpad().remove(memory.id);
        pruned++;
      } else {
        preserved++;
      }
    }

    // Prune episodic
    for (const memory of episodic) {
      if (fullPolicy.preservePinned && memory.metadata.pinned) {
        preserved++;
        continue;
      }

      const age = now - memory.metadata.createdAt.getTime();
      if (
        age > fullPolicy.episodicMaxAge ||
        (memory.metadata.accessCount < fullPolicy.minAccessCount &&
          memory.metadata.retentionStrength < fullPolicy.minRetentionStrength)
      ) {
        this.memoryManager!.getEpisodic().remove(memory.id);
        pruned++;
      } else {
        preserved++;
      }
    }

    return { pruned, preserved };
  }

  /**
   * Get memory statistics
   */
  getStatistics(): MemoryStatistics {
    this.assertInitialized();
    return this.memoryManager!.getStatistics();
  }

  // ============================================================================
  // Persistence Operations
  // ============================================================================

  /**
   * Save memory to disk
   */
  async saveToDisk(): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    const state = this.memoryManager.serialize();

    // Save main state
    const statePath = path.join(this.config.basePath, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');

    // Save caches
    const cachesPath = path.join(this.config.basePath, 'caches.json');
    await fs.writeFile(
      cachesPath,
      JSON.stringify(
        {
          tasks: Array.from(this.taskCache.entries()),
          policies: Array.from(this.policyCache.entries()),
          patterns: Array.from(this.patternCache.entries()),
        },
        null,
        2,
      ),
      'utf-8',
    );
  }

  /**
   * Load memory from disk
   */
  async loadFromDisk(): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    try {
      // Load main state
      const statePath = path.join(this.config.basePath, 'state.json');
      const stateData = await fs.readFile(statePath, 'utf-8');
      const state = JSON.parse(stateData);
      this.memoryManager.restore(state);

      // Load caches
      const cachesPath = path.join(this.config.basePath, 'caches.json');
      const cachesData = await fs.readFile(cachesPath, 'utf-8');
      const caches = JSON.parse(cachesData);

      this.taskCache = new Map(caches.tasks);
      this.policyCache = new Map(caches.policies);
      this.patternCache = new Map(caches.patterns);
    } catch (error) {
      // If files don't exist, that's OK - start fresh
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error loading memory from disk:', error);
      }
    }
  }

  /**
   * Archive old memories to separate file
   */
  async archiveOldMemories(olderThanDays: number = 90): Promise<{
    archived: number;
    archivePath: string;
  }> {
    this.assertInitialized();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const episodic = this.memoryManager!.getEpisodic().getAll();
    const toArchive = episodic.filter(
      m => m.metadata.createdAt < cutoffDate && !m.metadata.pinned,
    );

    if (toArchive.length === 0) {
      return { archived: 0, archivePath: '' };
    }

    // Create archive
    const archivePath = path.join(
      this.config.basePath,
      'archives',
      `archive-${cutoffDate.toISOString().split('T')[0]}.json`,
    );

    await fs.mkdir(path.dirname(archivePath), { recursive: true });
    await fs.writeFile(archivePath, JSON.stringify(toArchive, null, 2), 'utf-8');

    // Remove from active memory
    for (const memory of toArchive) {
      this.memoryManager!.getEpisodic().remove(memory.id);
    }

    return { archived: toArchive.length, archivePath };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.basePath,
      path.join(this.config.basePath, 'scratchpad'),
      path.join(this.config.basePath, 'episodic'),
      path.join(this.config.basePath, 'semantic'),
      path.join(this.config.basePath, 'archives'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      try {
        await this.saveToDisk();
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.config.autoSaveIntervalMs);
  }

  private assertInitialized(): void {
    if (!this.initialized || !this.memoryManager) {
      throw new Error('VPMemorySystem not initialized. Call initialize() first.');
    }
  }
}

/**
 * Factory function to create and initialize a VP Memory System
 */
export async function createVPMemorySystem(
  config?: Partial<VPMemoryConfig>,
): Promise<VPMemorySystem> {
  const system = new VPMemorySystem(config);
  await system.initialize();
  return system;
}
