/**
 * @wundr.io/agent-memory - Scratchpad (Working Memory)
 *
 * Short-term working memory with token-limited active context.
 * Implements the scratchpad tier of the MemGPT-inspired architecture.
 *
 * The scratchpad holds immediately relevant information for the current
 * conversation turn, with automatic overflow to episodic memory when
 * token limits are reached.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  Memory,
  MemoryMetadata,
  MemoryTierConfig,
  StoreMemoryOptions,
  TierStatistics,
  CompactionResult,
  MemoryEvent,
  MemoryEventHandler,
} from './types';

/**
 * Configuration for Scratchpad initialization
 */
export interface ScratchpadConfig extends MemoryTierConfig {
  /** Token estimation function (defaults to simple word-based estimate) */
  tokenEstimator?: (content: unknown) => number;
  /** Callback when overflow occurs */
  onOverflow?: (memories: Memory[]) => void | Promise<void>;
}

/**
 * Scratchpad - Token-limited working memory
 *
 * Provides fast access to immediately relevant context with automatic
 * management of token limits. When capacity is reached, older or less
 * important memories are evicted and can be promoted to episodic memory.
 *
 * @example
 * ```typescript
 * const scratchpad = new Scratchpad({
 *   maxTokens: 4000,
 *   compactionThreshold: 0.9,
 * });
 *
 * // Store a memory
 * const memory = await scratchpad.store(
 *   { role: 'user', content: 'Hello!' },
 *   { source: 'user', priority: 5 }
 * );
 *
 * // Get all current context
 * const context = scratchpad.getAll();
 * ```
 */
export class Scratchpad {
  private memories: Map<string, Memory> = new Map();
  private config: ScratchpadConfig;
  private currentTokens: number = 0;
  private eventHandlers: Map<string, Set<MemoryEventHandler>> = new Map();

  /**
   * Creates a new Scratchpad instance
   *
   * @param config - Scratchpad configuration
   */
  constructor(config: ScratchpadConfig) {
    this.config = {
      ...config,
      tokenEstimator: config.tokenEstimator || this.defaultTokenEstimator,
    };
  }

  /**
   * Store a new memory in the scratchpad
   *
   * @param content - Memory content to store
   * @param options - Storage options
   * @returns The created memory entry
   */
  async store(content: unknown, options: StoreMemoryOptions): Promise<Memory> {
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
      custom: options.custom || {},
    };

    const memory: Memory = {
      id: uuidv4(),
      type: 'scratchpad',
      content,
      tokenCount,
      metadata,
      embedding: options.embedding,
      linkedMemories: options.linkedMemories || [],
    };

    this.memories.set(memory.id, memory);
    this.currentTokens += tokenCount;

    this.emit('memory:stored', {
      memoryId: memory.id,
      tier: 'scratchpad',
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

    // Update access metadata
    memory.metadata.lastAccessedAt = new Date();
    memory.metadata.accessCount++;

    this.emit('memory:retrieved', {
      memoryId: id,
      tier: 'scratchpad',
    });

    return memory;
  }

  /**
   * Get all memories in the scratchpad
   *
   * @returns Array of all scratchpad memories, sorted by creation time (newest first)
   */
  getAll(): Memory[] {
    return Array.from(this.memories.values()).sort(
      (a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
    );
  }

  /**
   * Get memories by tag
   *
   * @param tag - Tag to filter by
   * @returns Memories with the specified tag
   */
  getByTag(tag: string): Memory[] {
    return Array.from(this.memories.values()).filter(m =>
      m.metadata.tags.includes(tag)
    );
  }

  /**
   * Get memories by agent ID
   *
   * @param agentId - Agent ID to filter by
   * @returns Memories associated with the agent
   */
  getByAgent(agentId: string): Memory[] {
    return Array.from(this.memories.values()).filter(
      m => m.metadata.agentId === agentId
    );
  }

  /**
   * Get memories by task ID
   *
   * @param taskId - Task ID to filter by
   * @returns Memories associated with the task
   */
  getByTask(taskId: string): Memory[] {
    return Array.from(this.memories.values()).filter(
      m => m.metadata.taskId === taskId
    );
  }

  /**
   * Update a memory's content or metadata
   *
   * @param id - Memory ID
   * @param updates - Partial updates to apply
   * @returns Updated memory or null if not found
   */
  update(
    id: string,
    updates: { content?: unknown; metadata?: Partial<MemoryMetadata> }
  ): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    // Update token count if content changed
    if (updates.content !== undefined) {
      const oldTokens = memory.tokenCount;
      const newTokens = this.config.tokenEstimator!(updates.content);

      this.currentTokens = this.currentTokens - oldTokens + newTokens;
      memory.content = updates.content;
      memory.tokenCount = newTokens;
    }

    // Update metadata
    if (updates.metadata) {
      Object.assign(memory.metadata, updates.metadata);
    }

    memory.metadata.lastAccessedAt = new Date();

    this.emit('memory:updated', {
      memoryId: id,
      tier: 'scratchpad',
    });

    return memory;
  }

  /**
   * Remove a memory from the scratchpad
   *
   * @param id - Memory ID to remove
   * @returns The removed memory or null if not found
   */
  remove(id: string): Memory | null {
    const memory = this.memories.get(id);
    if (!memory) {
      return null;
    }

    this.memories.delete(id);
    this.currentTokens -= memory.tokenCount;

    this.emit('memory:forgotten', {
      memoryId: id,
      tier: 'scratchpad',
    });

    return memory;
  }

  /**
   * Pin a memory to prevent it from being evicted
   *
   * @param id - Memory ID to pin
   * @returns True if memory was pinned, false if not found
   */
  pin(id: string): boolean {
    const memory = this.memories.get(id);
    if (!memory) {
      return false;
    }

    memory.metadata.pinned = true;
    return true;
  }

  /**
   * Unpin a memory to allow eviction
   *
   * @param id - Memory ID to unpin
   * @returns True if memory was unpinned, false if not found
   */
  unpin(id: string): boolean {
    const memory = this.memories.get(id);
    if (!memory) {
      return false;
    }

    memory.metadata.pinned = false;
    return true;
  }

  /**
   * Link two memories together for associative retrieval
   *
   * @param sourceId - Source memory ID
   * @param targetId - Target memory ID to link
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
        tier: 'scratchpad',
        details: { linkedTo: targetId },
      });
    }

    return true;
  }

  /**
   * Clear all memories from the scratchpad
   *
   * @param preservePinned - If true, pinned memories are preserved
   * @returns Memories that were cleared (for potential promotion)
   */
  clear(preservePinned: boolean = false): Memory[] {
    const cleared: Memory[] = [];

    for (const [id, memory] of this.memories.entries()) {
      if (preservePinned && memory.metadata.pinned) {
        continue;
      }

      cleared.push(memory);
      this.memories.delete(id);
      this.currentTokens -= memory.tokenCount;
    }

    return cleared;
  }

  /**
   * Compact the scratchpad by evicting low-priority memories
   *
   * @returns Compaction result with statistics
   */
  async compact(): Promise<CompactionResult> {
    const startTime = Date.now();
    const beforeCount = this.memories.size;
    const evicted: Memory[] = [];

    // Sort by eviction priority (lowest priority, oldest, lowest strength first)
    const sortedMemories = Array.from(this.memories.values())
      .filter(m => !m.metadata.pinned)
      .sort((a, b) => {
        // Priority first (lower = evict first)
        if (a.metadata.priority !== b.metadata.priority) {
          return a.metadata.priority - b.metadata.priority;
        }
        // Then by retention strength
        if (a.metadata.retentionStrength !== b.metadata.retentionStrength) {
          return a.metadata.retentionStrength - b.metadata.retentionStrength;
        }
        // Then by age (older = evict first)
        return a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
      });

    // Evict until we're below compaction threshold
    const targetTokens =
      this.config.maxTokens * this.config.compactionThreshold;

    for (const memory of sortedMemories) {
      if (this.currentTokens <= targetTokens) {
        break;
      }

      this.memories.delete(memory.id);
      this.currentTokens -= memory.tokenCount;
      evicted.push(memory);
    }

    // Notify overflow handler
    if (evicted.length > 0 && this.config.onOverflow) {
      await this.config.onOverflow(evicted);
    }

    const result: CompactionResult = {
      tier: 'scratchpad',
      beforeCount,
      afterCount: this.memories.size,
      tokensFreed: evicted.reduce((sum, m) => sum + m.tokenCount, 0),
      promoted: evicted.length, // All evicted memories are candidates for promotion
      forgotten: 0,
      durationMs: Date.now() - startTime,
    };

    this.emit('tier:compacted', {
      tier: 'scratchpad',
      details: result,
    });

    return result;
  }

  /**
   * Get statistics for the scratchpad tier
   *
   * @returns Current tier statistics
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
      tier: 'scratchpad',
      memoryCount: this.memories.size,
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
   * Check if the scratchpad needs compaction
   *
   * @returns True if utilization exceeds compaction threshold
   */
  needsCompaction(): boolean {
    return (
      this.currentTokens / this.config.maxTokens >=
      this.config.compactionThreshold
    );
  }

  /**
   * Get current token usage
   *
   * @returns Current token count
   */
  getTokenCount(): number {
    return this.currentTokens;
  }

  /**
   * Get available tokens
   *
   * @returns Tokens remaining before max limit
   */
  getAvailableTokens(): number {
    return this.config.maxTokens - this.currentTokens;
  }

  /**
   * Register an event handler
   *
   * @param event - Event type to listen for
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
   * Serialize the scratchpad state for persistence
   *
   * @returns Serializable state object
   */
  serialize(): { memories: Memory[]; currentTokens: number } {
    return {
      memories: Array.from(this.memories.values()),
      currentTokens: this.currentTokens,
    };
  }

  /**
   * Restore scratchpad state from serialized data
   *
   * @param state - Serialized state to restore
   */
  restore(state: { memories: Memory[]; currentTokens: number }): void {
    this.memories.clear();
    this.currentTokens = 0;

    for (const memory of state.memories) {
      // Restore dates from serialization
      memory.metadata.createdAt = new Date(memory.metadata.createdAt);
      memory.metadata.lastAccessedAt = new Date(memory.metadata.lastAccessedAt);

      this.memories.set(memory.id, memory);
      this.currentTokens += memory.tokenCount;
    }
  }

  /**
   * Make room for new content by evicting memories
   *
   * @param requiredTokens - Tokens needed for new content
   */
  private async makeRoom(requiredTokens: number): Promise<void> {
    const targetTokens = this.config.maxTokens - requiredTokens;
    const evicted: Memory[] = [];

    // Sort by eviction priority
    const candidates = Array.from(this.memories.values())
      .filter(m => !m.metadata.pinned)
      .sort((a, b) => {
        if (a.metadata.priority !== b.metadata.priority) {
          return a.metadata.priority - b.metadata.priority;
        }
        return a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
      });

    for (const memory of candidates) {
      if (this.currentTokens <= targetTokens) {
        break;
      }

      this.memories.delete(memory.id);
      this.currentTokens -= memory.tokenCount;
      evicted.push(memory);
    }

    if (evicted.length > 0) {
      this.emit('tier:overflow', {
        tier: 'scratchpad',
        details: { evictedCount: evicted.length },
      });

      if (this.config.onOverflow) {
        await this.config.onOverflow(evicted);
      }
    }
  }

  /**
   * Default token estimation function
   * Uses a simple word-based heuristic (roughly 4 characters per token)
   *
   * @param content - Content to estimate
   * @returns Estimated token count
   */
  private defaultTokenEstimator(content: unknown): number {
    const text =
      typeof content === 'string' ? content : JSON.stringify(content);
    // Rough estimate: 1 token ~= 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Emit an event to registered handlers
   *
   * @param type - Event type
   * @param payload - Event payload
   */
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
