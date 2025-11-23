/**
 * @wundr.io/agent-memory - Episodic Store (Long-term Episodic Memory)
 *
 * Time-based autobiographical memories representing specific events and experiences.
 * Implements the episodic tier of the MemGPT-inspired architecture.
 *
 * Episodic memory stores discrete events with temporal context, enabling
 * the agent to recall specific past interactions and experiences.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  Memory,
  MemoryMetadata,
  MemoryTierConfig,
  StoreMemoryOptions,
  RetrieveMemoryOptions,
  RetrievalResult,
  TierStatistics,
  CompactionResult,
  MemoryEvent,
  MemoryEventHandler,
} from './types';

/**
 * Episode metadata specific to episodic memories
 */
export interface EpisodeMetadata {
  /** Session ID where episode occurred */
  sessionId: string;
  /** Turn number within the session */
  turnNumber: number;
  /** Type of episode (conversation, task, error, etc.) */
  episodeType: 'conversation' | 'task' | 'error' | 'decision' | 'observation';
  /** Participants in the episode */
  participants: string[];
  /** Outcome or result of the episode */
  outcome?: 'success' | 'failure' | 'partial' | 'pending';
  /** Emotional valence (-1 to 1, negative to positive) */
  valence?: number;
  /** Importance score for this episode */
  importance: number;
}

/**
 * Configuration for EpisodicStore initialization
 */
export interface EpisodicStoreConfig extends MemoryTierConfig {
  /** Token estimation function */
  tokenEstimator?: (content: unknown) => number;
  /** Callback when memories should be consolidated to semantic */
  onConsolidate?: (memories: Memory[]) => void | Promise<void>;
  /** Similarity threshold for semantic search (0-1) */
  similarityThreshold?: number;
}

/**
 * EpisodicStore - Long-term episodic memory
 *
 * Stores time-based memories of specific events and experiences.
 * Supports temporal queries, semantic search via embeddings,
 * and automatic consolidation to semantic memory.
 *
 * @example
 * ```typescript
 * const episodic = new EpisodicStore({
 *   maxTokens: 16000,
 *   ttlMs: 86400000 * 7, // 7 days
 *   compressionEnabled: true,
 * });
 *
 * // Store an episode
 * const episode = await episodic.store(
 *   { event: 'user_login', details: {...} },
 *   { source: 'system', sessionId: 'sess-123' }
 * );
 *
 * // Query by time range
 * const recentEpisodes = await episodic.queryByTimeRange(
 *   new Date(Date.now() - 3600000), // 1 hour ago
 *   new Date()
 * );
 * ```
 */
export class EpisodicStore {
  private memories: Map<string, Memory> = new Map();
  private config: EpisodicStoreConfig;
  private currentTokens: number = 0;
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();

  // Indices for efficient querying
  private timeIndex: Map<number, Set<string>> = new Map(); // hourly buckets
  private sessionIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  /**
   * Creates a new EpisodicStore instance
   *
   * @param config - Store configuration
   */
  constructor(config: EpisodicStoreConfig) {
    this.config = {
      ...config,
      tokenEstimator: config.tokenEstimator || this.defaultTokenEstimator,
      similarityThreshold: config.similarityThreshold ?? 0.7,
    };
  }

  /**
   * Store a new episode in episodic memory
   *
   * @param content - Episode content
   * @param options - Storage options with episode metadata
   * @returns The created memory entry
   */
  async store(
    content: unknown,
    options: StoreMemoryOptions & { episode?: Partial<EpisodeMetadata> }
  ): Promise<Memory> {
    const tokenCount = this.config.tokenEstimator!(content);

    // Check if we need to make room
    if (this.currentTokens + tokenCount > this.config.maxTokens) {
      await this.makeRoom(tokenCount);
    }

    const now = new Date();
    const metadata: MemoryMetadata = {
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      retentionStrength: 1.0,
      source: options.source,
      tags: options.tags || [],
      priority: options.priority ?? 5,
      pinned: options.pinned ?? false,
      agentId: options.agentId,
      taskId: options.taskId,
      custom: {
        ...options.custom,
        episode: options.episode || {},
      },
    };

    const memory: Memory = {
      id: uuidv4(),
      type: 'episodic',
      content,
      tokenCount,
      metadata,
      embedding: options.embedding,
      linkedMemories: options.linkedMemories || [],
    };

    this.memories.set(memory.id, memory);
    this.currentTokens += tokenCount;

    // Update indices
    this.addToIndices(memory);

    this.emit('memory:stored', {
      memoryId: memory.id,
      tier: 'episodic',
      details: { tokenCount, totalTokens: this.currentTokens },
    });

    return memory;
  }

  /**
   * Retrieve a memory by ID
   *
   * @param id - Memory ID
   * @returns The memory if found, null otherwise
   */
  get(id: string): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    // Check TTL
    if (this.isExpired(memory)) {
      this.remove(memory.id);
      return null;
    }

    // Update access metadata
    memory.metadata.lastAccessedAt = new Date();
    memory.metadata.accessCount++;

    this.emit('memory:retrieved', {
      memoryId: id,
      tier: 'episodic',
    });

    return memory;
  }

  /**
   * Query episodes by time range
   *
   * @param start - Start of time range
   * @param end - End of time range
   * @param limit - Maximum results to return
   * @returns Episodes within the time range
   */
  async queryByTimeRange(
    start: Date,
    end: Date,
    limit: number = 50
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const results: Memory[] = [];

    for (const memory of this.memories.values()) {
      if (this.isExpired(memory)) {
        continue;
      }

      const createdAt = memory.metadata.createdAt.getTime();
      if (createdAt >= start.getTime() && createdAt <= end.getTime()) {
        memory.metadata.lastAccessedAt = new Date();
        memory.metadata.accessCount++;
        results.push(memory);
      }
    }

    // Sort by creation time (newest first)
    results.sort(
      (a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
    );

    const truncated = results.length > limit;
    const memories = results.slice(0, limit);

    return {
      memories,
      totalCount: results.length,
      latencyMs: Date.now() - startTime,
      truncated,
    };
  }

  /**
   * Query episodes by session ID
   *
   * @param sessionId - Session ID to query
   * @param limit - Maximum results
   * @returns Episodes from the session
   */
  async queryBySession(
    sessionId: string,
    limit: number = 50
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const memoryIds = this.sessionIndex.get(sessionId) || new Set();
    const results: Memory[] = [];

    for (const id of memoryIds) {
      const memory = this.memories.get(id);
      if (memory && !this.isExpired(memory)) {
        memory.metadata.lastAccessedAt = new Date();
        memory.metadata.accessCount++;
        results.push(memory);
      }
    }

    results.sort(
      (a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
    );

    const truncated = results.length > limit;

    return {
      memories: results.slice(0, limit),
      totalCount: results.length,
      latencyMs: Date.now() - startTime,
      truncated,
    };
  }

  /**
   * Retrieve episodes with flexible criteria
   *
   * @param options - Retrieval options
   * @returns Matching episodes
   */
  async retrieve(options: RetrieveMemoryOptions): Promise<RetrievalResult> {
    const startTime = Date.now();
    let candidates: Memory[] = Array.from(this.memories.values());

    // Filter out expired memories
    candidates = candidates.filter(m => !this.isExpired(m));

    // Apply filters
    if (options.minStrength !== undefined) {
      candidates = candidates.filter(
        m => m.metadata.retentionStrength >= options.minStrength!
      );
    }

    if (options.tags && options.tags.length > 0) {
      candidates = candidates.filter(m =>
        options.tags!.some(tag => m.metadata.tags.includes(tag))
      );
    }

    if (options.agentId) {
      candidates = candidates.filter(
        m => m.metadata.agentId === options.agentId
      );
    }

    if (options.taskId) {
      candidates = candidates.filter(m => m.metadata.taskId === options.taskId);
    }

    // Semantic search if embedding provided
    if (options.queryEmbedding && options.queryEmbedding.length > 0) {
      candidates = this.semanticSearch(candidates, options.queryEmbedding);
    }

    // Sort results
    candidates = this.sortMemories(
      candidates,
      options.sortBy || 'recency',
      options.sortDirection || 'desc'
    );

    // Update access metadata
    for (const memory of candidates) {
      memory.metadata.lastAccessedAt = new Date();
      memory.metadata.accessCount++;
    }

    const limit = options.limit ?? 50;
    const truncated = candidates.length > limit;

    return {
      memories: candidates.slice(0, limit),
      totalCount: candidates.length,
      latencyMs: Date.now() - startTime,
      truncated,
    };
  }

  /**
   * Find similar episodes using embedding similarity
   *
   * @param queryEmbedding - Query embedding vector
   * @param limit - Maximum results
   * @returns Similar episodes
   */
  async findSimilar(
    queryEmbedding: number[],
    limit: number = 10
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const candidates = Array.from(this.memories.values()).filter(
      m => !this.isExpired(m) && m.embedding && m.embedding.length > 0
    );

    const scored = candidates.map(memory => ({
      memory,
      similarity: this.cosineSimilarity(queryEmbedding, memory.embedding!),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);

    const filtered = scored.filter(
      s => s.similarity >= this.config.similarityThreshold!
    );

    const memories = filtered.slice(0, limit).map(s => {
      s.memory.metadata.lastAccessedAt = new Date();
      s.memory.metadata.accessCount++;
      return s.memory;
    });

    return {
      memories,
      totalCount: filtered.length,
      latencyMs: Date.now() - startTime,
      truncated: filtered.length > limit,
    };
  }

  /**
   * Get episodes ready for consolidation to semantic memory
   *
   * @param strengthThreshold - Minimum retention strength
   * @param accessCountThreshold - Minimum access count
   * @returns Episodes meeting consolidation criteria
   */
  getConsolidationCandidates(
    strengthThreshold: number = 0.7,
    accessCountThreshold: number = 3
  ): Memory[] {
    return Array.from(this.memories.values()).filter(
      m =>
        !this.isExpired(m) &&
        m.metadata.retentionStrength >= strengthThreshold &&
        m.metadata.accessCount >= accessCountThreshold
    );
  }

  /**
   * Update a memory's content or metadata
   *
   * @param id - Memory ID
   * @param updates - Updates to apply
   * @returns Updated memory or null
   */
  update(
    id: string,
    updates: { content?: unknown; metadata?: Partial<MemoryMetadata> }
  ): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    const oldTags = [...memory.metadata.tags];

    if (updates.content !== undefined) {
      const oldTokens = memory.tokenCount;
      const newTokens = this.config.tokenEstimator!(updates.content);
      this.currentTokens = this.currentTokens - oldTokens + newTokens;
      memory.content = updates.content;
      memory.tokenCount = newTokens;
    }

    if (updates.metadata) {
      Object.assign(memory.metadata, updates.metadata);
    }

    memory.metadata.lastAccessedAt = new Date();

    // Update tag index if tags changed
    if (updates.metadata?.tags) {
      this.updateTagIndex(memory.id, oldTags, memory.metadata.tags);
    }

    this.emit('memory:updated', {
      memoryId: id,
      tier: 'episodic',
    });

    return memory;
  }

  /**
   * Remove a memory from the store
   *
   * @param id - Memory ID to remove
   * @returns Removed memory or null
   */
  remove(id: string): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    this.removeFromIndices(memory);
    this.memories.delete(id);
    this.currentTokens -= memory.tokenCount;

    this.emit('memory:forgotten', {
      memoryId: id,
      tier: 'episodic',
    });

    return memory;
  }

  /**
   * Link two memories together
   *
   * @param sourceId - Source memory ID
   * @param targetId - Target memory ID
   * @returns True if link was created
   */
  link(sourceId: string, targetId: string): boolean {
    const source = this.memories.get(sourceId);
    if (!source) {
      return false;
    }

    if (!source.linkedMemories.includes(targetId)) {
      source.linkedMemories.push(targetId);

      this.emit('memory:linked', {
        memoryId: sourceId,
        tier: 'episodic',
        details: { linkedTo: targetId },
      });
    }

    return true;
  }

  /**
   * Compact the episodic store
   *
   * @returns Compaction result
   */
  async compact(): Promise<CompactionResult> {
    const startTime = Date.now();
    const beforeCount = this.memories.size;
    const forgotten: Memory[] = [];
    const consolidated: Memory[] = [];

    // Remove expired memories
    for (const [id, memory] of this.memories.entries()) {
      if (this.isExpired(memory)) {
        this.removeFromIndices(memory);
        this.memories.delete(id);
        this.currentTokens -= memory.tokenCount;
        forgotten.push(memory);
      }
    }

    // Find consolidation candidates
    const candidates = this.getConsolidationCandidates();

    // If we're still over threshold, evict low-value memories
    if (
      this.currentTokens / this.config.maxTokens >=
      this.config.compactionThreshold
    ) {
      const sortedMemories = Array.from(this.memories.values())
        .filter(m => !m.metadata.pinned)
        .sort((a, b) => {
          // Consolidation candidates have higher priority
          const aConsolidated = candidates.includes(a) ? 1 : 0;
          const bConsolidated = candidates.includes(b) ? 1 : 0;
          if (aConsolidated !== bConsolidated) {
            return aConsolidated - bConsolidated;
          }
          // Then by retention strength
          return a.metadata.retentionStrength - b.metadata.retentionStrength;
        });

      const targetTokens =
        this.config.maxTokens * this.config.compactionThreshold * 0.8;

      for (const memory of sortedMemories) {
        if (this.currentTokens <= targetTokens) {
          break;
        }

        if (candidates.includes(memory)) {
          consolidated.push(memory);
        } else {
          forgotten.push(memory);
        }

        this.removeFromIndices(memory);
        this.memories.delete(memory.id);
        this.currentTokens -= memory.tokenCount;
      }
    }

    // Notify consolidation callback
    if (consolidated.length > 0 && this.config.onConsolidate) {
      await this.config.onConsolidate(consolidated);
    }

    const result: CompactionResult = {
      tier: 'episodic',
      beforeCount,
      afterCount: this.memories.size,
      tokensFreed:
        forgotten.reduce((sum, m) => sum + m.tokenCount, 0) +
        consolidated.reduce((sum, m) => sum + m.tokenCount, 0),
      promoted: consolidated.length,
      forgotten: forgotten.length,
      durationMs: Date.now() - startTime,
    };

    this.emit('tier:compacted', {
      tier: 'episodic',
      details: result,
    });

    return result;
  }

  /**
   * Get tier statistics
   *
   * @returns Current statistics
   */
  getStatistics(): TierStatistics {
    const memories = Array.from(this.memories.values());
    const validMemories = memories.filter(m => !this.isExpired(m));
    const pinnedCount = validMemories.filter(m => m.metadata.pinned).length;
    const avgStrength =
      validMemories.length > 0
        ? validMemories.reduce(
            (sum, m) => sum + m.metadata.retentionStrength,
            0
          ) / validMemories.length
        : 0;

    const sortedByDate = validMemories.sort(
      (a, b) => a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
    );

    return {
      tier: 'episodic',
      memoryCount: validMemories.length,
      totalTokens: this.currentTokens,
      maxTokens: this.config.maxTokens,
      utilization: this.currentTokens / this.config.maxTokens,
      avgStrength,
      pinnedCount,
      oldestMemory: sortedByDate[0]?.metadata.createdAt || null,
      newestMemory:
        sortedByDate[sortedByDate.length - 1]?.metadata.createdAt || null,
    };
  }

  /**
   * Check if compaction is needed
   */
  needsCompaction(): boolean {
    return (
      this.currentTokens / this.config.maxTokens >=
      this.config.compactionThreshold
    );
  }

  /**
   * Get all memories (for iteration)
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values()).filter(m => !this.isExpired(m));
  }

  /**
   * Register an event handler
   */
  on(event: string, handler: MemoryEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event handler
   */
  off(event: string, handler: MemoryEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Serialize store state
   */
  serialize(): { memories: Memory[]; currentTokens: number } {
    return {
      memories: Array.from(this.memories.values()),
      currentTokens: this.currentTokens,
    };
  }

  /**
   * Restore store state
   */
  restore(state: { memories: Memory[]; currentTokens: number }): void {
    this.memories.clear();
    this.currentTokens = 0;
    this.timeIndex.clear();
    this.sessionIndex.clear();
    this.typeIndex.clear();
    this.tagIndex.clear();

    for (const memory of state.memories) {
      memory.metadata.createdAt = new Date(memory.metadata.createdAt);
      memory.metadata.lastAccessedAt = new Date(memory.metadata.lastAccessedAt);

      this.memories.set(memory.id, memory);
      this.currentTokens += memory.tokenCount;
      this.addToIndices(memory);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private addToIndices(memory: Memory): void {
    // Time index (hourly buckets)
    const hourBucket = Math.floor(
      memory.metadata.createdAt.getTime() / (1000 * 60 * 60)
    );
    if (!this.timeIndex.has(hourBucket)) {
      this.timeIndex.set(hourBucket, new Set());
    }
    this.timeIndex.get(hourBucket)!.add(memory.id);

    // Session index
    const sessionId = (memory.metadata.custom as { episode?: EpisodeMetadata })
      ?.episode?.sessionId;
    if (sessionId) {
      if (!this.sessionIndex.has(sessionId)) {
        this.sessionIndex.set(sessionId, new Set());
      }
      this.sessionIndex.get(sessionId)!.add(memory.id);
    }

    // Type index
    const episodeType = (
      memory.metadata.custom as { episode?: EpisodeMetadata }
    )?.episode?.episodeType;
    if (episodeType) {
      if (!this.typeIndex.has(episodeType)) {
        this.typeIndex.set(episodeType, new Set());
      }
      this.typeIndex.get(episodeType)!.add(memory.id);
    }

    // Tag index
    for (const tag of memory.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(memory.id);
    }
  }

  private removeFromIndices(memory: Memory): void {
    // Remove from time index
    const hourBucket = Math.floor(
      memory.metadata.createdAt.getTime() / (1000 * 60 * 60)
    );
    this.timeIndex.get(hourBucket)?.delete(memory.id);

    // Remove from session index
    const sessionId = (memory.metadata.custom as { episode?: EpisodeMetadata })
      ?.episode?.sessionId;
    if (sessionId) {
      this.sessionIndex.get(sessionId)?.delete(memory.id);
    }

    // Remove from type index
    const episodeType = (
      memory.metadata.custom as { episode?: EpisodeMetadata }
    )?.episode?.episodeType;
    if (episodeType) {
      this.typeIndex.get(episodeType)?.delete(memory.id);
    }

    // Remove from tag index
    for (const tag of memory.metadata.tags) {
      this.tagIndex.get(tag)?.delete(memory.id);
    }
  }

  private updateTagIndex(
    id: string,
    oldTags: string[],
    newTags: string[]
  ): void {
    for (const tag of oldTags) {
      if (!newTags.includes(tag)) {
        this.tagIndex.get(tag)?.delete(id);
      }
    }
    for (const tag of newTags) {
      if (!oldTags.includes(tag)) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(id);
      }
    }
  }

  private isExpired(memory: Memory): boolean {
    if (!this.config.ttlMs) {
      return false;
    }
    const age = Date.now() - memory.metadata.createdAt.getTime();
    return age > this.config.ttlMs;
  }

  private async makeRoom(requiredTokens: number): Promise<void> {
    const targetTokens = this.config.maxTokens - requiredTokens;

    const candidates = Array.from(this.memories.values())
      .filter(m => !m.metadata.pinned)
      .sort(
        (a, b) => a.metadata.retentionStrength - b.metadata.retentionStrength
      );

    for (const memory of candidates) {
      if (this.currentTokens <= targetTokens) {
        break;
      }

      this.removeFromIndices(memory);
      this.memories.delete(memory.id);
      this.currentTokens -= memory.tokenCount;
    }
  }

  private semanticSearch(
    memories: Memory[],
    queryEmbedding: number[]
  ): Memory[] {
    return memories
      .filter(m => m.embedding && m.embedding.length > 0)
      .map(memory => ({
        memory,
        similarity: this.cosineSimilarity(queryEmbedding, memory.embedding!),
      }))
      .filter(s => s.similarity >= this.config.similarityThreshold!)
      .sort((a, b) => b.similarity - a.similarity)
      .map(s => s.memory);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private sortMemories(
    memories: Memory[],
    sortBy: string,
    direction: 'asc' | 'desc'
  ): Memory[] {
    const multiplier = direction === 'asc' ? 1 : -1;

    return memories.sort((a, b) => {
      switch (sortBy) {
        case 'recency':
          return (
            multiplier *
            (a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime())
          );
        case 'strength':
          return (
            multiplier *
            (a.metadata.retentionStrength - b.metadata.retentionStrength)
          );
        case 'priority':
          return multiplier * (a.metadata.priority - b.metadata.priority);
        default:
          return 0;
      }
    });
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
