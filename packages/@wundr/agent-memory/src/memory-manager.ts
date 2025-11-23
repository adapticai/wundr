/**
 * @wundr.io/agent-memory - Agent Memory Manager
 *
 * Orchestrates all memory tiers implementing MemGPT-inspired virtual memory management.
 * Handles context compilation, memory promotion/demotion, and automatic consolidation.
 */

import { EpisodicStore } from './episodic-store';
import { ForgettingCurve } from './forgetting-curve';
import { Scratchpad } from './scratchpad';
import { SemanticStore } from './semantic-store';
import { SessionManager } from './session-manager';
import { DEFAULT_MEMORY_CONFIG } from './types';

import type { KnowledgeCategory } from './semantic-store';
import type { CreateSessionOptions } from './session-manager';
import type {
  Memory,
  MemoryConfig,
  MemoryTier,
  ManagedContext,
  StoreMemoryOptions,
  RetrieveMemoryOptions,
  RetrievalResult,
  CompileContextOptions,
  MemoryStatistics,
  CompactionResult,
  ConsolidationResult,
  MemoryEvent,
  MemoryEventHandler,
} from './types';

/**
 * AgentMemoryManager initialization options
 */
export interface AgentMemoryManagerOptions {
  /** Memory configuration (uses defaults if not provided) */
  config?: Partial<MemoryConfig>;
  /** Token estimation function */
  tokenEstimator?: (content: unknown) => number;
  /** Enable automatic consolidation */
  autoConsolidation?: boolean;
  /** Enable automatic compaction */
  autoCompaction?: boolean;
  /** Enable persistence */
  persistence?: boolean;
}

/**
 * AgentMemoryManager - Central orchestrator for tiered memory system
 *
 * Implements MemGPT-inspired virtual memory management with:
 * - Scratchpad (working memory) for immediate context
 * - Episodic store for autobiographical memories
 * - Semantic store for consolidated knowledge
 * - Forgetting curve for realistic memory decay
 * - Session management for persistence
 *
 * @example
 * ```typescript
 * const memoryManager = new AgentMemoryManager({
 *   config: {
 *     scratchpad: { maxTokens: 4000 },
 *     episodic: { maxTokens: 16000 },
 *     semantic: { maxTokens: 32000 },
 *   },
 * });
 *
 * await memoryManager.initialize();
 *
 * // Store a memory
 * const memory = await memoryManager.store(
 *   { role: 'user', content: 'Hello!' },
 *   { source: 'user', tier: 'scratchpad' }
 * );
 *
 * // Compile context for the LLM
 * const context = await memoryManager.compileContext({
 *   systemPrompt: 'You are a helpful assistant.',
 *   maxTokens: 8000,
 * });
 * ```
 */
export class AgentMemoryManager {
  private config: MemoryConfig;
  private scratchpad: Scratchpad;
  private episodic: EpisodicStore;
  private semantic: SemanticStore;
  private forgettingCurve: ForgettingCurve;
  private sessionManager: SessionManager;
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();
  private consolidationInterval: ReturnType<typeof setInterval> | null = null;
  private compactionInterval: ReturnType<typeof setInterval> | null = null;
  private initialized: boolean = false;
  private currentSessionId: string | null = null;
  private tokenEstimator: (content: unknown) => number;

  /**
   * Creates a new AgentMemoryManager instance
   *
   * @param options - Initialization options
   */
  constructor(options: AgentMemoryManagerOptions = {}) {
    // Merge configuration with defaults
    this.config = {
      ...DEFAULT_MEMORY_CONFIG,
      ...options.config,
      scratchpad: {
        ...DEFAULT_MEMORY_CONFIG.scratchpad,
        ...options.config?.scratchpad,
      },
      episodic: {
        ...DEFAULT_MEMORY_CONFIG.episodic,
        ...options.config?.episodic,
      },
      semantic: {
        ...DEFAULT_MEMORY_CONFIG.semantic,
        ...options.config?.semantic,
      },
      forgettingCurve: {
        ...DEFAULT_MEMORY_CONFIG.forgettingCurve,
        ...options.config?.forgettingCurve,
      },
    };

    this.tokenEstimator = options.tokenEstimator || this.defaultTokenEstimator;

    // Initialize memory tiers
    this.scratchpad = new Scratchpad({
      ...this.config.scratchpad,
      tokenEstimator: this.tokenEstimator,
      onOverflow: async memories => {
        await this.handleScratchpadOverflow(memories);
      },
    });

    this.episodic = new EpisodicStore({
      ...this.config.episodic,
      tokenEstimator: this.tokenEstimator,
      onConsolidate: async memories => {
        await this.handleEpisodicConsolidation(memories);
      },
    });

    this.semantic = new SemanticStore({
      ...this.config.semantic,
      tokenEstimator: this.tokenEstimator,
    });

    this.forgettingCurve = new ForgettingCurve(this.config.forgettingCurve);
    this.sessionManager = new SessionManager();

    // Wire up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the memory manager
   *
   * @returns Success status
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize session manager
    this.sessionManager.initialize();

    // Start automatic consolidation if enabled
    if (this.config.autoConsolidation) {
      this.startAutoConsolidation();
    }

    // Start automatic compaction
    this.startAutoCompaction();

    this.initialized = true;

    this.emit('memory:initialized', {
      details: { config: this.config },
    });
  }

  /**
   * Create or restore a session
   *
   * @param options - Session options
   * @returns Session ID
   */
  async startSession(options: CreateSessionOptions = {}): Promise<string> {
    const session = this.sessionManager.createSession(options);
    this.currentSessionId = session.sessionId;

    // If scratchpad has state from a previous session, restore it
    if (session.scratchpadState.length > 0) {
      this.scratchpad.restore({
        memories: session.scratchpadState,
        currentTokens: session.scratchpadState.reduce(
          (sum, m) => sum + m.tokenCount,
          0
        ),
      });
    }

    return session.sessionId;
  }

  /**
   * End the current session
   *
   * @param persist - Whether to persist before ending
   */
  async endSession(persist: boolean = true): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    // Save scratchpad state to session
    const scratchpadMemories = this.scratchpad.getAll();
    this.sessionManager.updateScratchpad(
      this.currentSessionId,
      scratchpadMemories
    );

    await this.sessionManager.endSession(this.currentSessionId, persist);
    this.currentSessionId = null;

    // Clear scratchpad for next session
    this.scratchpad.clear(false);
  }

  /**
   * Store a memory in the appropriate tier
   *
   * @param content - Memory content
   * @param options - Storage options
   * @returns Created memory
   */
  async store(content: unknown, options: StoreMemoryOptions): Promise<Memory> {
    const tier = options.tier || 'scratchpad';

    let memory: Memory;

    switch (tier) {
      case 'scratchpad':
        memory = await this.scratchpad.store(content, options);
        break;
      case 'episodic':
        memory = await this.episodic.store(content, options);
        break;
      case 'semantic':
        memory = await this.semantic.store(content, options);
        break;
      default:
        throw new Error(`Unknown memory tier: ${tier}`);
    }

    // Update session activity
    if (this.currentSessionId) {
      this.sessionManager.updateActivity(this.currentSessionId);
    }

    return memory;
  }

  /**
   * Retrieve a memory by ID from any tier
   *
   * @param id - Memory ID
   * @returns Memory or null
   */
  async retrieve(id: string): Promise<Memory | null> {
    // Try each tier
    let memory = this.scratchpad.get(id);
    if (memory) {
      this.forgettingCurve.applyAccessBoost(memory);
      return memory;
    }

    memory = this.episodic.get(id);
    if (memory) {
      this.forgettingCurve.applyAccessBoost(memory);
      return memory;
    }

    memory = this.semantic.get(id);
    if (memory) {
      this.forgettingCurve.applyAccessBoost(memory);
      return memory;
    }

    return null;
  }

  /**
   * Search memories across tiers
   *
   * @param options - Search options
   * @returns Search results
   */
  async search(options: RetrieveMemoryOptions): Promise<RetrievalResult> {
    const startTime = Date.now();
    const tiers = options.tiers || ['scratchpad', 'episodic', 'semantic'];
    const allMemories: Memory[] = [];

    // Search requested tiers
    if (tiers.includes('scratchpad')) {
      let memories = this.scratchpad.getAll();
      if (options.tags) {
        memories = memories.filter(m =>
          options.tags!.some(tag => m.metadata.tags.includes(tag))
        );
      }
      if (options.agentId) {
        memories = memories.filter(m => m.metadata.agentId === options.agentId);
      }
      allMemories.push(...memories);
    }

    if (tiers.includes('episodic')) {
      const result = await this.episodic.retrieve(options);
      allMemories.push(...result.memories);
    }

    if (tiers.includes('semantic')) {
      const result = await this.semantic.retrieve(options);
      allMemories.push(...result.memories);
    }

    // Apply forgetting curve filtering
    const validMemories = allMemories.filter(m => {
      if (options.minStrength !== undefined) {
        return m.metadata.retentionStrength >= options.minStrength;
      }
      return !this.forgettingCurve.shouldForget(m);
    });

    // Sort by importance
    const sorted = this.forgettingCurve.sortByImportance(validMemories);

    const limit = options.limit ?? 50;

    return {
      memories: sorted.slice(0, limit),
      totalCount: sorted.length,
      latencyMs: Date.now() - startTime,
      truncated: sorted.length > limit,
    };
  }

  /**
   * Compile a managed context window for the LLM
   *
   * This is the core "virtual memory" function that assembles the optimal
   * context from all memory tiers within token limits.
   *
   * @param options - Context compilation options
   * @returns Compiled managed context
   */
  async compileContext(
    options: CompileContextOptions
  ): Promise<ManagedContext> {
    const systemPromptTokens = this.tokenEstimator(options.systemPrompt);
    let availableTokens = options.maxTokens - systemPromptTokens;

    const scratchpadEntries: Memory[] = [];
    const episodicEntries: Memory[] = [];
    const semanticEntries: Memory[] = [];

    // 1. Include scratchpad (working memory) - highest priority
    if (options.includeScratchpad !== false) {
      let scratchpad = this.scratchpad.getAll();

      // Filter by agent/task if specified
      if (options.agentId) {
        scratchpad = scratchpad.filter(
          m => m.metadata.agentId === options.agentId
        );
      }
      if (options.taskId) {
        scratchpad = scratchpad.filter(
          m => m.metadata.taskId === options.taskId
        );
      }

      // Sort by priority and recency
      scratchpad.sort((a, b) => {
        if (a.metadata.pinned !== b.metadata.pinned) {
          return a.metadata.pinned ? -1 : 1;
        }
        if (a.metadata.priority !== b.metadata.priority) {
          return b.metadata.priority - a.metadata.priority;
        }
        return b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime();
      });

      for (const memory of scratchpad) {
        if (memory.tokenCount <= availableTokens) {
          scratchpadEntries.push(memory);
          availableTokens -= memory.tokenCount;
        }
      }
    }

    // 2. Add relevant episodic memories
    if (
      options.episodicLimit &&
      options.episodicLimit > 0 &&
      availableTokens > 0
    ) {
      const episodicOptions: RetrieveMemoryOptions = {
        limit: options.episodicLimit,
        agentId: options.agentId,
        taskId: options.taskId,
        sortBy: 'recency',
        sortDirection: 'desc',
      };

      if (options.queryEmbedding) {
        episodicOptions.queryEmbedding = options.queryEmbedding;
      }

      const episodic = await this.episodic.retrieve(episodicOptions);

      for (const memory of episodic.memories) {
        if (memory.tokenCount <= availableTokens) {
          episodicEntries.push(memory);
          availableTokens -= memory.tokenCount;
          this.forgettingCurve.applyAccessBoost(memory);
        }
      }
    }

    // 3. Add relevant semantic memories
    if (
      options.semanticLimit &&
      options.semanticLimit > 0 &&
      availableTokens > 0
    ) {
      const semanticOptions: RetrieveMemoryOptions = {
        limit: options.semanticLimit,
        sortBy: 'relevance',
        sortDirection: 'desc',
      };

      if (options.queryEmbedding) {
        semanticOptions.queryEmbedding = options.queryEmbedding;
      }

      const semantic = await this.semantic.retrieve(semanticOptions);

      for (const memory of semantic.memories) {
        if (memory.tokenCount <= availableTokens) {
          semanticEntries.push(memory);
          availableTokens -= memory.tokenCount;
          this.forgettingCurve.applyAccessBoost(memory);
        }
      }
    }

    const totalTokens = options.maxTokens - availableTokens;

    const context: ManagedContext = {
      systemPrompt: options.systemPrompt,
      scratchpadEntries,
      episodicEntries,
      semanticEntries,
      totalTokens,
      maxTokens: options.maxTokens,
      utilization: totalTokens / options.maxTokens,
      compiledAt: new Date(),
    };

    this.emit('context:compiled', {
      details: {
        scratchpad: scratchpadEntries.length,
        episodic: episodicEntries.length,
        semantic: semanticEntries.length,
        utilization: context.utilization,
      },
    });

    return context;
  }

  /**
   * Promote a memory to a higher tier
   *
   * @param memoryId - Memory ID to promote
   * @param fromTier - Source tier
   * @param toTier - Target tier
   * @returns Promoted memory or null
   */
  async promote(
    memoryId: string,
    fromTier: MemoryTier,
    toTier: MemoryTier
  ): Promise<Memory | null> {
    let sourceMemory: Memory | null = null;

    // Get memory from source tier
    switch (fromTier) {
      case 'scratchpad':
        sourceMemory = this.scratchpad.get(memoryId);
        break;
      case 'episodic':
        sourceMemory = this.episodic.get(memoryId);
        break;
      default:
        return null; // Semantic is highest tier
    }

    if (!sourceMemory) {
      return null;
    }

    // Create in target tier
    let promotedMemory: Memory;

    switch (toTier) {
      case 'episodic':
        promotedMemory = await this.episodic.store(sourceMemory.content, {
          source: 'consolidation',
          tags: sourceMemory.metadata.tags,
          priority: sourceMemory.metadata.priority,
          agentId: sourceMemory.metadata.agentId,
          taskId: sourceMemory.metadata.taskId,
          embedding: sourceMemory.embedding,
          linkedMemories: sourceMemory.linkedMemories,
        });
        break;
      case 'semantic':
        promotedMemory = await this.semantic.store(sourceMemory.content, {
          source: 'consolidation',
          tags: sourceMemory.metadata.tags,
          priority: sourceMemory.metadata.priority,
          embedding: sourceMemory.embedding,
          linkedMemories: sourceMemory.linkedMemories,
        });
        break;
      default:
        return null;
    }

    // Remove from source tier
    switch (fromTier) {
      case 'scratchpad':
        this.scratchpad.remove(memoryId);
        break;
      case 'episodic':
        this.episodic.remove(memoryId);
        break;
    }

    this.emit('memory:promoted', {
      memoryId: promotedMemory.id,
      tier: toTier,
      details: { fromTier, originalId: memoryId },
    });

    return promotedMemory;
  }

  /**
   * Run memory decay on all tiers
   *
   * @returns Decay statistics
   */
  async applyDecay(): Promise<{
    forgotten: number;
    consolidated: number;
  }> {
    let forgotten = 0;
    let consolidated = 0;

    // Apply decay to episodic memories
    const episodicResult = this.forgettingCurve.applyDecayBatch(
      this.episodic.getAll()
    );

    for (const memory of episodicResult.toForget) {
      this.episodic.remove(memory.id);
      forgotten++;
    }

    // Mark consolidation candidates
    for (const _memory of episodicResult.toConsolidate) {
      // These will be handled by the consolidation process
      consolidated++;
    }

    // Apply decay to semantic memories
    const semanticResult = this.forgettingCurve.applyDecayBatch(
      this.semantic.getAll()
    );

    for (const memory of semanticResult.toForget) {
      this.semantic.remove(memory.id);
      forgotten++;
    }

    return { forgotten, consolidated };
  }

  /**
   * Run consolidation process
   *
   * @returns Consolidation result
   */
  async runConsolidation(): Promise<ConsolidationResult> {
    const startTime = Date.now();

    // Get consolidation candidates from episodic
    const candidates = this.episodic.getConsolidationCandidates(
      this.config.forgettingCurve.consolidationThreshold,
      2
    );

    // Simple consolidation: promote high-value episodic memories to semantic
    let promotedToSemantic = 0;

    for (const memory of candidates) {
      await this.promote(memory.id, 'episodic', 'semantic');
      promotedToSemantic++;
    }

    const result: ConsolidationResult = {
      episodicConsolidated: candidates.length,
      promotedToSemantic,
      clustersFormed: 0, // Could implement clustering in the future
      durationMs: Date.now() - startTime,
    };

    this.emit('memory:consolidated', {
      details: result as unknown as Record<string, unknown>,
    });

    return result;
  }

  /**
   * Run compaction on all tiers
   *
   * @returns Compaction results per tier
   */
  async runCompaction(): Promise<Record<MemoryTier, CompactionResult>> {
    const scratchpadResult = await this.scratchpad.compact();
    const episodicResult = await this.episodic.compact();
    const semanticResult = await this.semantic.compact();

    return {
      scratchpad: scratchpadResult,
      episodic: episodicResult,
      semantic: semanticResult,
    };
  }

  /**
   * Get memory system statistics
   *
   * @returns Current statistics
   */
  getStatistics(): MemoryStatistics {
    const scratchpadStats = this.scratchpad.getStatistics();
    const episodicStats = this.episodic.getStatistics();
    const semanticStats = this.semantic.getStatistics();

    return {
      tiers: {
        scratchpad: scratchpadStats,
        episodic: episodicStats,
        semantic: semanticStats,
      },
      totalMemories:
        scratchpadStats.memoryCount +
        episodicStats.memoryCount +
        semanticStats.memoryCount,
      totalTokens:
        scratchpadStats.totalTokens +
        episodicStats.totalTokens +
        semanticStats.totalTokens,
      activeSessions: this.sessionManager.getActiveSessions().length,
      consolidatedLastInterval: 0, // Could track this over time
      forgottenLastInterval: 0, // Could track this over time
    };
  }

  /**
   * Get the current configuration
   *
   * @returns Memory configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<MemoryConfig>): void {
    Object.assign(this.config, updates);

    if (updates.forgettingCurve) {
      this.forgettingCurve.updateConfig(updates.forgettingCurve);
    }
  }

  /**
   * Register an event handler
   *
   * @param event - Event type
   * @param handler - Handler function
   */
  on(event: string, handler: MemoryEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   *
   * @param event - Event type
   * @param handler - Handler to remove
   */
  off(event: string, handler: MemoryEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Shutdown the memory manager
   */
  async shutdown(): Promise<void> {
    // Stop intervals
    if (this.consolidationInterval) {
      clearInterval(this.consolidationInterval);
      this.consolidationInterval = null;
    }

    if (this.compactionInterval) {
      clearInterval(this.compactionInterval);
      this.compactionInterval = null;
    }

    // End current session
    if (this.currentSessionId) {
      await this.endSession(true);
    }

    // Shutdown session manager
    await this.sessionManager.shutdown();

    this.initialized = false;
  }

  /**
   * Serialize entire memory state
   *
   * @returns Serialized state
   */
  serialize(): {
    scratchpad: ReturnType<Scratchpad['serialize']>;
    episodic: ReturnType<EpisodicStore['serialize']>;
    semantic: ReturnType<SemanticStore['serialize']>;
    forgettingCurve: ReturnType<ForgettingCurve['serialize']>;
    sessions: ReturnType<SessionManager['serialize']>;
    currentSessionId: string | null;
  } {
    return {
      scratchpad: this.scratchpad.serialize(),
      episodic: this.episodic.serialize(),
      semantic: this.semantic.serialize(),
      forgettingCurve: this.forgettingCurve.serialize(),
      sessions: this.sessionManager.serialize(),
      currentSessionId: this.currentSessionId,
    };
  }

  /**
   * Restore entire memory state
   *
   * @param state - State to restore
   */
  restore(state: ReturnType<typeof this.serialize>): void {
    this.scratchpad.restore(state.scratchpad);
    this.episodic.restore(state.episodic);
    this.semantic.restore(state.semantic);
    this.forgettingCurve.restore(state.forgettingCurve);
    this.sessionManager.restore(state.sessions);
    this.currentSessionId = state.currentSessionId;
  }

  // ============================================================================
  // Tier Accessors
  // ============================================================================

  /**
   * Get direct access to scratchpad tier
   */
  getScratchpad(): Scratchpad {
    return this.scratchpad;
  }

  /**
   * Get direct access to episodic store
   */
  getEpisodic(): EpisodicStore {
    return this.episodic;
  }

  /**
   * Get direct access to semantic store
   */
  getSemantic(): SemanticStore {
    return this.semantic;
  }

  /**
   * Get direct access to forgetting curve
   */
  getForgettingCurve(): ForgettingCurve {
    return this.forgettingCurve;
  }

  /**
   * Get direct access to session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async handleScratchpadOverflow(memories: Memory[]): Promise<void> {
    // Promote overflowed scratchpad memories to episodic
    for (const memory of memories) {
      await this.episodic.store(memory.content, {
        source: 'system',
        tags: [...memory.metadata.tags, 'from-scratchpad'],
        priority: memory.metadata.priority,
        agentId: memory.metadata.agentId,
        taskId: memory.metadata.taskId,
        embedding: memory.embedding,
        linkedMemories: memory.linkedMemories,
        episode: {
          sessionId: this.currentSessionId || undefined,
          turnNumber: 0,
          episodeType: 'conversation',
          participants: [],
          importance: memory.metadata.priority / 10,
        },
      });
    }
  }

  private async handleEpisodicConsolidation(memories: Memory[]): Promise<void> {
    // Simple knowledge extraction: store as semantic facts
    for (const memory of memories) {
      await this.semantic.store(memory.content, {
        source: 'consolidation',
        tags: [...memory.metadata.tags, 'consolidated'],
        priority: memory.metadata.priority,
        embedding: memory.embedding,
        linkedMemories: memory.linkedMemories,
        semantic: {
          category: 'fact' as KnowledgeCategory,
          confidence: memory.metadata.retentionStrength,
          supportingEvidenceCount: memory.metadata.accessCount,
          sourceEpisodes: [memory.id],
          relatedConcepts: [],
          isLearned: true,
          contradictionCount: 0,
        },
      });
    }
  }

  private setupEventForwarding(): void {
    // Forward events from child components
    const forwardEvent = (event: MemoryEvent) => {
      this.emit(event.type, event.payload);
    };

    this.scratchpad.on('memory:stored', forwardEvent);
    this.scratchpad.on('memory:forgotten', forwardEvent);
    this.episodic.on('memory:stored', forwardEvent);
    this.episodic.on('memory:forgotten', forwardEvent);
    this.semantic.on('memory:stored', forwardEvent);
    this.semantic.on('memory:forgotten', forwardEvent);
    this.sessionManager.on('session:created', forwardEvent);
    this.sessionManager.on('session:ended', forwardEvent);
  }

  private startAutoConsolidation(): void {
    this.consolidationInterval = setInterval(async () => {
      try {
        await this.runConsolidation();
      } catch (error) {
        console.error('Auto-consolidation failed:', error);
      }
    }, this.config.consolidationIntervalMs);
  }

  private startAutoCompaction(): void {
    // Run compaction every 5 minutes
    this.compactionInterval = setInterval(
      async () => {
        try {
          // Check if any tier needs compaction
          if (
            this.scratchpad.needsCompaction() ||
            this.episodic.needsCompaction() ||
            this.semantic.needsCompaction()
          ) {
            await this.runCompaction();
          }

          // Apply decay
          await this.applyDecay();
        } catch (error) {
          console.error('Auto-compaction failed:', error);
        }
      },
      5 * 60 * 1000
    );
  }

  private defaultTokenEstimator(content: unknown): number {
    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    return Math.ceil(text.length / 4);
  }

  private emit(type: string, payload: MemoryEvent['payload']): void {
    const event: MemoryEvent = {
      type: type as MemoryEvent['type'],
      timestamp: new Date(),
      payload,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${type}:`, error);
        }
      }
    }
  }
}
