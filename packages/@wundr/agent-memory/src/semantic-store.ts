/**
 * @wundr.io/agent-memory - Semantic Store (Long-term Semantic Memory)
 *
 * Consolidated knowledge and facts extracted from episodic memories.
 * Implements the semantic tier of the MemGPT-inspired architecture.
 *
 * Semantic memory stores general knowledge, learned patterns, and
 * consolidated understanding that persists long-term.
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
 * Semantic knowledge categories
 */
export type KnowledgeCategory =
  | 'fact'
  | 'concept'
  | 'procedure'
  | 'preference'
  | 'pattern'
  | 'rule'
  | 'entity'
  | 'relationship';

/**
 * Semantic metadata for knowledge entries
 */
export interface SemanticMetadata {
  /** Category of knowledge */
  category: KnowledgeCategory;
  /** Confidence level in this knowledge (0-1) */
  confidence: number;
  /** Number of episodic memories that support this */
  supportingEvidenceCount: number;
  /** IDs of source episodic memories */
  sourceEpisodes: string[];
  /** Domain or topic area */
  domain?: string;
  /** Related concepts */
  relatedConcepts: string[];
  /** Whether this is a learned pattern */
  isLearned: boolean;
  /** Contradiction count (how often this was contradicted) */
  contradictionCount: number;
}

/**
 * Configuration for SemanticStore
 */
export interface SemanticStoreConfig extends MemoryTierConfig {
  /** Token estimation function */
  tokenEstimator?: (content: unknown) => number;
  /** Similarity threshold for semantic search */
  similarityThreshold?: number;
  /** Minimum confidence for knowledge to be retained */
  minConfidence?: number;
  /** Callback when memory is forgotten */
  onForgotten?: (memories: Memory[]) => void | Promise<void>;
}

/**
 * SemanticStore - Long-term semantic memory
 *
 * Stores consolidated knowledge, facts, and learned patterns.
 * Optimized for semantic retrieval and knowledge management.
 *
 * @example
 * ```typescript
 * const semantic = new SemanticStore({
 *   maxTokens: 32000,
 *   compressionEnabled: true,
 * });
 *
 * // Store a fact
 * const fact = await semantic.store(
 *   { fact: 'User prefers TypeScript', domain: 'coding' },
 *   { source: 'consolidation', category: 'preference' }
 * );
 *
 * // Query by domain
 * const codingKnowledge = await semantic.queryByDomain('coding');
 * ```
 */
export class SemanticStore {
  private memories: Map<string, Memory> = new Map();
  private config: SemanticStoreConfig;
  private currentTokens: number = 0;
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();

  // Indices for efficient querying
  private categoryIndex: Map<KnowledgeCategory, Set<string>> = new Map();
  private domainIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private conceptGraph: Map<string, Set<string>> = new Map(); // Concept relationships

  /**
   * Creates a new SemanticStore instance
   *
   * @param config - Store configuration
   */
  constructor(config: SemanticStoreConfig) {
    this.config = {
      ...config,
      tokenEstimator: config.tokenEstimator || this.defaultTokenEstimator,
      similarityThreshold: config.similarityThreshold ?? 0.7,
      minConfidence: config.minConfidence ?? 0.3,
    };
  }

  /**
   * Store knowledge in semantic memory
   *
   * @param content - Knowledge content
   * @param options - Storage options with semantic metadata
   * @returns Created memory entry
   */
  async store(
    content: unknown,
    options: StoreMemoryOptions & { semantic?: Partial<SemanticMetadata> }
  ): Promise<Memory> {
    const tokenCount = this.config.tokenEstimator!(content);

    // Check capacity
    if (this.currentTokens + tokenCount > this.config.maxTokens) {
      await this.makeRoom(tokenCount);
    }

    const now = new Date();
    const semanticMeta: SemanticMetadata = {
      category: options.semantic?.category || 'fact',
      confidence: options.semantic?.confidence ?? 1.0,
      supportingEvidenceCount: options.semantic?.supportingEvidenceCount ?? 1,
      sourceEpisodes: options.semantic?.sourceEpisodes || [],
      domain: options.semantic?.domain,
      relatedConcepts: options.semantic?.relatedConcepts || [],
      isLearned: options.semantic?.isLearned ?? false,
      contradictionCount: options.semantic?.contradictionCount ?? 0,
    };

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
        semantic: semanticMeta,
      },
    };

    const memory: Memory = {
      id: uuidv4(),
      type: 'semantic',
      content,
      tokenCount,
      metadata,
      embedding: options.embedding,
      linkedMemories: options.linkedMemories || [],
    };

    this.memories.set(memory.id, memory);
    this.currentTokens += tokenCount;

    this.addToIndices(memory);

    this.emit('memory:stored', {
      memoryId: memory.id,
      tier: 'semantic',
      details: { tokenCount, category: semanticMeta.category },
    });

    return memory;
  }

  /**
   * Consolidate episodic memories into semantic knowledge
   *
   * @param episodes - Episodic memories to consolidate
   * @param extractor - Function to extract knowledge from episodes
   * @returns Newly created semantic memories
   */
  async consolidate(
    episodes: Memory[],
    extractor: (episodes: Memory[]) => {
      content: unknown;
      category: KnowledgeCategory;
      domain?: string;
      confidence: number;
    }[]
  ): Promise<Memory[]> {
    const extracted = extractor(episodes);
    const created: Memory[] = [];

    for (const knowledge of extracted) {
      // Check for existing similar knowledge
      const existing = await this.findSimilarKnowledge(knowledge.content);

      if (existing) {
        // Reinforce existing knowledge
        await this.reinforce(existing.id, episodes);
      } else {
        // Create new knowledge entry
        const memory = await this.store(knowledge.content, {
          source: 'consolidation',
          semantic: {
            category: knowledge.category,
            domain: knowledge.domain,
            confidence: knowledge.confidence,
            supportingEvidenceCount: episodes.length,
            sourceEpisodes: episodes.map(e => e.id),
            isLearned: true,
            relatedConcepts: [],
            contradictionCount: 0,
          },
        });
        created.push(memory);
      }
    }

    if (created.length > 0) {
      this.emit('memory:consolidated', {
        tier: 'semantic',
        details: { count: created.length, sourceEpisodes: episodes.length },
      });
    }

    return created;
  }

  /**
   * Reinforce existing knowledge with new evidence
   *
   * @param id - Memory ID to reinforce
   * @param evidence - New supporting evidence
   * @returns Updated memory
   */
  async reinforce(id: string, evidence: Memory[]): Promise<Memory | null> {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    const semantic = (memory.metadata.custom as { semantic?: SemanticMetadata })
      ?.semantic;
    if (!semantic) {
      return memory;
    }

    // Update evidence count
    semantic.supportingEvidenceCount += evidence.length;
    semantic.sourceEpisodes = [
      ...new Set([...semantic.sourceEpisodes, ...evidence.map(e => e.id)]),
    ];

    // Increase confidence (with diminishing returns)
    const confidenceBoost = Math.min(
      0.1 * evidence.length,
      (1 - semantic.confidence) * 0.5
    );
    semantic.confidence = Math.min(1.0, semantic.confidence + confidenceBoost);

    // Boost retention strength
    memory.metadata.retentionStrength = Math.min(
      1.0,
      memory.metadata.retentionStrength + 0.1
    );
    memory.metadata.lastAccessedAt = new Date();
    memory.metadata.accessCount++;

    this.emit('memory:updated', {
      memoryId: id,
      tier: 'semantic',
      details: { reinforced: true, newConfidence: semantic.confidence },
    });

    return memory;
  }

  /**
   * Record a contradiction to existing knowledge
   *
   * @param id - Memory ID that was contradicted
   * @param contradictingEvidence - Evidence that contradicts
   */
  async contradict(id: string, contradictingEvidence: Memory[]): Promise<void> {
    const memory = this.memories.get(id);
    if (!memory) {
      return;
    }

    const semantic = (memory.metadata.custom as { semantic?: SemanticMetadata })
      ?.semantic;
    if (!semantic) {
      return;
    }

    semantic.contradictionCount += contradictingEvidence.length;

    // Reduce confidence based on contradictions
    const confidenceReduction = 0.1 * contradictingEvidence.length;
    semantic.confidence = Math.max(
      0,
      semantic.confidence - confidenceReduction
    );

    // If confidence drops below threshold, consider removal
    if (semantic.confidence < this.config.minConfidence!) {
      this.remove(id);
    }
  }

  /**
   * Retrieve knowledge by ID
   *
   * @param id - Memory ID
   * @returns Memory if found
   */
  get(id: string): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    memory.metadata.lastAccessedAt = new Date();
    memory.metadata.accessCount++;

    this.emit('memory:retrieved', {
      memoryId: id,
      tier: 'semantic',
    });

    return memory;
  }

  /**
   * Query knowledge by category
   *
   * @param category - Knowledge category
   * @param limit - Maximum results
   * @returns Knowledge in the category
   */
  async queryByCategory(
    category: KnowledgeCategory,
    limit: number = 50
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const memoryIds = this.categoryIndex.get(category) || new Set();
    const results: Memory[] = [];

    for (const id of memoryIds) {
      const memory = this.memories.get(id);
      if (memory) {
        memory.metadata.lastAccessedAt = new Date();
        memory.metadata.accessCount++;
        results.push(memory);
      }
    }

    results.sort((a, b) => {
      const confA =
        (a.metadata.custom as { semantic?: SemanticMetadata })?.semantic
          ?.confidence || 0;
      const confB =
        (b.metadata.custom as { semantic?: SemanticMetadata })?.semantic
          ?.confidence || 0;
      return confB - confA;
    });

    return {
      memories: results.slice(0, limit),
      totalCount: results.length,
      latencyMs: Date.now() - startTime,
      truncated: results.length > limit,
    };
  }

  /**
   * Query knowledge by domain
   *
   * @param domain - Domain to query
   * @param limit - Maximum results
   * @returns Knowledge in the domain
   */
  async queryByDomain(
    domain: string,
    limit: number = 50
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const memoryIds = this.domainIndex.get(domain) || new Set();
    const results: Memory[] = [];

    for (const id of memoryIds) {
      const memory = this.memories.get(id);
      if (memory) {
        memory.metadata.lastAccessedAt = new Date();
        memory.metadata.accessCount++;
        results.push(memory);
      }
    }

    results.sort((a, b) => {
      const confA =
        (a.metadata.custom as { semantic?: SemanticMetadata })?.semantic
          ?.confidence || 0;
      const confB =
        (b.metadata.custom as { semantic?: SemanticMetadata })?.semantic
          ?.confidence || 0;
      return confB - confA;
    });

    return {
      memories: results.slice(0, limit),
      totalCount: results.length,
      latencyMs: Date.now() - startTime,
      truncated: results.length > limit,
    };
  }

  /**
   * Retrieve knowledge with flexible criteria
   *
   * @param options - Retrieval options
   * @returns Matching knowledge
   */
  async retrieve(options: RetrieveMemoryOptions): Promise<RetrievalResult> {
    const startTime = Date.now();
    let candidates: Memory[] = Array.from(this.memories.values());

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

    // Semantic search if embedding provided
    if (options.queryEmbedding && options.queryEmbedding.length > 0) {
      candidates = this.semanticSearch(candidates, options.queryEmbedding);
    }

    // Sort results
    candidates = this.sortMemories(
      candidates,
      options.sortBy || 'relevance',
      options.sortDirection || 'desc'
    );

    // Update access metadata
    for (const memory of candidates) {
      memory.metadata.lastAccessedAt = new Date();
      memory.metadata.accessCount++;
    }

    const limit = options.limit ?? 50;

    return {
      memories: candidates.slice(0, limit),
      totalCount: candidates.length,
      latencyMs: Date.now() - startTime,
      truncated: candidates.length > limit,
    };
  }

  /**
   * Find similar knowledge using embeddings
   *
   * @param queryEmbedding - Query embedding
   * @param limit - Maximum results
   * @returns Similar knowledge
   */
  async findSimilar(
    queryEmbedding: number[],
    limit: number = 10
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const candidates = Array.from(this.memories.values()).filter(
      m => m.embedding && m.embedding.length > 0
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
   * Get related concepts for a given concept
   *
   * @param concept - Concept to find relations for
   * @returns Related concept IDs
   */
  getRelatedConcepts(concept: string): string[] {
    return Array.from(this.conceptGraph.get(concept) || []);
  }

  /**
   * Link two concepts as related
   *
   * @param concept1 - First concept
   * @param concept2 - Second concept
   */
  linkConcepts(concept1: string, concept2: string): void {
    if (!this.conceptGraph.has(concept1)) {
      this.conceptGraph.set(concept1, new Set());
    }
    if (!this.conceptGraph.has(concept2)) {
      this.conceptGraph.set(concept2, new Set());
    }

    this.conceptGraph.get(concept1)!.add(concept2);
    this.conceptGraph.get(concept2)!.add(concept1);
  }

  /**
   * Update knowledge content or metadata
   *
   * @param id - Memory ID
   * @param updates - Updates to apply
   * @returns Updated memory
   */
  update(
    id: string,
    updates: { content?: unknown; metadata?: Partial<MemoryMetadata> }
  ): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

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

    this.emit('memory:updated', {
      memoryId: id,
      tier: 'semantic',
    });

    return memory;
  }

  /**
   * Remove knowledge from the store
   *
   * @param id - Memory ID
   * @returns Removed memory
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
      tier: 'semantic',
    });

    return memory;
  }

  /**
   * Link two memories
   *
   * @param sourceId - Source memory
   * @param targetId - Target memory
   * @returns Success
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
        tier: 'semantic',
        details: { linkedTo: targetId },
      });
    }

    return true;
  }

  /**
   * Compact the semantic store
   *
   * @returns Compaction result
   */
  async compact(): Promise<CompactionResult> {
    const startTime = Date.now();
    const beforeCount = this.memories.size;
    const forgotten: Memory[] = [];

    // Remove low-confidence knowledge
    for (const [id, memory] of this.memories.entries()) {
      const semantic = (
        memory.metadata.custom as { semantic?: SemanticMetadata }
      )?.semantic;

      if (
        semantic &&
        semantic.confidence < this.config.minConfidence! &&
        !memory.metadata.pinned
      ) {
        this.removeFromIndices(memory);
        this.memories.delete(id);
        this.currentTokens -= memory.tokenCount;
        forgotten.push(memory);
      }
    }

    // If still over threshold, remove lowest value
    if (
      this.currentTokens / this.config.maxTokens >=
      this.config.compactionThreshold
    ) {
      const sorted = Array.from(this.memories.values())
        .filter(m => !m.metadata.pinned)
        .sort((a, b) => {
          const semA = (a.metadata.custom as { semantic?: SemanticMetadata })
            ?.semantic;
          const semB = (b.metadata.custom as { semantic?: SemanticMetadata })
            ?.semantic;

          // Score by confidence * retention * evidence
          const scoreA =
            (semA?.confidence || 0.5) *
            a.metadata.retentionStrength *
            Math.log((semA?.supportingEvidenceCount || 1) + 1);
          const scoreB =
            (semB?.confidence || 0.5) *
            b.metadata.retentionStrength *
            Math.log((semB?.supportingEvidenceCount || 1) + 1);

          return scoreA - scoreB;
        });

      const targetTokens =
        this.config.maxTokens * this.config.compactionThreshold * 0.8;

      for (const memory of sorted) {
        if (this.currentTokens <= targetTokens) {
          break;
        }

        this.removeFromIndices(memory);
        this.memories.delete(memory.id);
        this.currentTokens -= memory.tokenCount;
        forgotten.push(memory);
      }
    }

    if (forgotten.length > 0 && this.config.onForgotten) {
      await this.config.onForgotten(forgotten);
    }

    const result: CompactionResult = {
      tier: 'semantic',
      beforeCount,
      afterCount: this.memories.size,
      tokensFreed: forgotten.reduce((sum, m) => sum + m.tokenCount, 0),
      promoted: 0,
      forgotten: forgotten.length,
      durationMs: Date.now() - startTime,
    };

    this.emit('tier:compacted', {
      tier: 'semantic',
      details: result,
    });

    return result;
  }

  /**
   * Get tier statistics
   */
  getStatistics(): TierStatistics {
    const memories = Array.from(this.memories.values());
    const pinnedCount = memories.filter(m => m.metadata.pinned).length;
    const avgStrength =
      memories.length > 0
        ? memories.reduce((sum, m) => sum + m.metadata.retentionStrength, 0) /
          memories.length
        : 0;

    const sortedByDate = memories.sort(
      (a, b) => a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime()
    );

    return {
      tier: 'semantic',
      memoryCount: memories.length,
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
   * Get all memories
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Register event handler
   */
  on(event: string, handler: MemoryEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: MemoryEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Serialize store state
   */
  serialize(): {
    memories: Memory[];
    currentTokens: number;
    conceptGraph: [string, string[]][];
  } {
    return {
      memories: Array.from(this.memories.values()),
      currentTokens: this.currentTokens,
      conceptGraph: Array.from(this.conceptGraph.entries()).map(([k, v]) => [
        k,
        Array.from(v),
      ]),
    };
  }

  /**
   * Restore store state
   */
  restore(state: {
    memories: Memory[];
    currentTokens: number;
    conceptGraph: [string, string[]][];
  }): void {
    this.memories.clear();
    this.currentTokens = 0;
    this.categoryIndex.clear();
    this.domainIndex.clear();
    this.tagIndex.clear();
    this.conceptGraph.clear();

    for (const memory of state.memories) {
      memory.metadata.createdAt = new Date(memory.metadata.createdAt);
      memory.metadata.lastAccessedAt = new Date(memory.metadata.lastAccessedAt);

      this.memories.set(memory.id, memory);
      this.currentTokens += memory.tokenCount;
      this.addToIndices(memory);
    }

    for (const [concept, related] of state.conceptGraph) {
      this.conceptGraph.set(concept, new Set(related));
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private addToIndices(memory: Memory): void {
    const semantic = (memory.metadata.custom as { semantic?: SemanticMetadata })
      ?.semantic;

    // Category index
    if (semantic?.category) {
      if (!this.categoryIndex.has(semantic.category)) {
        this.categoryIndex.set(semantic.category, new Set());
      }
      this.categoryIndex.get(semantic.category)!.add(memory.id);
    }

    // Domain index
    if (semantic?.domain) {
      if (!this.domainIndex.has(semantic.domain)) {
        this.domainIndex.set(semantic.domain, new Set());
      }
      this.domainIndex.get(semantic.domain)!.add(memory.id);
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
    const semantic = (memory.metadata.custom as { semantic?: SemanticMetadata })
      ?.semantic;

    if (semantic?.category) {
      this.categoryIndex.get(semantic.category)?.delete(memory.id);
    }

    if (semantic?.domain) {
      this.domainIndex.get(semantic.domain)?.delete(memory.id);
    }

    for (const tag of memory.metadata.tags) {
      this.tagIndex.get(tag)?.delete(memory.id);
    }
  }

  private async findSimilarKnowledge(content: unknown): Promise<Memory | null> {
    // Simple content-based similarity for now
    const contentStr = JSON.stringify(content);

    for (const memory of this.memories.values()) {
      const memoryStr = JSON.stringify(memory.content);
      if (memoryStr === contentStr) {
        return memory;
      }
    }

    return null;
  }

  private async makeRoom(requiredTokens: number): Promise<void> {
    const targetTokens = this.config.maxTokens - requiredTokens;

    const candidates = Array.from(this.memories.values())
      .filter(m => !m.metadata.pinned)
      .sort((a, b) => {
        const semA = (a.metadata.custom as { semantic?: SemanticMetadata })
          ?.semantic;
        const semB = (b.metadata.custom as { semantic?: SemanticMetadata })
          ?.semantic;

        const scoreA = (semA?.confidence || 0.5) * a.metadata.retentionStrength;
        const scoreB = (semB?.confidence || 0.5) * b.metadata.retentionStrength;

        return scoreA - scoreB;
      });

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
        case 'relevance':
        default: {
          const semA = (a.metadata.custom as { semantic?: SemanticMetadata })
            ?.semantic;
          const semB = (b.metadata.custom as { semantic?: SemanticMetadata })
            ?.semantic;
          return (
            multiplier * ((semA?.confidence || 0) - (semB?.confidence || 0))
          );
        }
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
