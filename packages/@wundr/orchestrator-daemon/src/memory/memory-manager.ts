/**
 * Memory Manager - MemGPT-inspired tiered memory architecture
 */

import { Logger } from '../utils/logger';

import type {
  MemoryContext,
  MemoryEntry,
  MemoryTier,
  MemoryConfig,
} from '../types';

export class MemoryManager {
  private logger: Logger;
  private config: MemoryConfig;
  private scratchpad: Map<string, unknown>;
  private episodic: MemoryEntry[];
  private semantic: MemoryEntry[];

  constructor(config: MemoryConfig) {
    this.logger = new Logger('MemoryManager');
    this.config = config;
    this.scratchpad = new Map();
    this.episodic = [];
    this.semantic = [];
  }

  /**
   * Initialize memory context for a new session
   */
  initializeContext(): MemoryContext {
    return {
      scratchpad: {},
      episodic: [],
      semantic: [],
    };
  }

  /**
   * Store data in scratchpad (working memory)
   */
  storeScratchpad(key: string, value: unknown): void {
    this.scratchpad.set(key, value);
    this.logger.debug(`Stored in scratchpad: ${key}`);
  }

  /**
   * Retrieve from scratchpad
   */
  retrieveScratchpad(key: string): unknown {
    return this.scratchpad.get(key);
  }

  /**
   * Add episodic memory (recent interactions)
   */
  addEpisodic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry {
    const memoryEntry: MemoryEntry = {
      id: this.generateId(),
      ...entry,
    };

    this.episodic.push(memoryEntry);
    this.logger.debug(`Added episodic memory: ${memoryEntry.id}`);

    // Trigger compaction if needed
    if (this.episodic.length > this.config.retrieval.maxResults * 2) {
      this.compactEpisodic();
    }

    return memoryEntry;
  }

  /**
   * Add semantic memory (long-term knowledge)
   */
  addSemantic(entry: Omit<MemoryEntry, 'id'>): MemoryEntry {
    const memoryEntry: MemoryEntry = {
      id: this.generateId(),
      ...entry,
    };

    this.semantic.push(memoryEntry);
    this.logger.debug(`Added semantic memory: ${memoryEntry.id}`);

    return memoryEntry;
  }

  /**
   * Retrieve relevant memories based on query
   */
  retrieve(query: string, tier: MemoryTier = 'episodic'): MemoryEntry[] {
    const memories = tier === 'episodic' ? this.episodic : this.semantic;

    // Simple keyword-based retrieval (can be enhanced with embeddings)
    const relevant = memories.filter((entry) =>
      entry.content.toLowerCase().includes(query.toLowerCase()),
    );

    // Sort by recency
    relevant.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Return top N results
    return relevant.slice(0, this.config.retrieval.maxResults);
  }

  /**
   * Compact episodic memory by summarizing old entries
   */
  private compactEpisodic(): void {
    if (!this.config.compaction.enabled) {
      return;
    }

    const threshold = Math.floor(
      this.episodic.length * this.config.compaction.threshold,
    );

    if (this.episodic.length > threshold) {
      this.logger.info('Compacting episodic memory...');

      // Archive older entries to semantic memory
      const toArchive = this.episodic.slice(
        0,
        this.episodic.length - this.config.retrieval.maxResults,
      );

      // Create summary entry
      const summary: MemoryEntry = {
        id: this.generateId(),
        content: `Archived summary of ${toArchive.length} interactions`,
        timestamp: new Date(),
        type: 'knowledge',
        metadata: {
          archived: toArchive.length,
          period: {
            start: toArchive[0]?.timestamp,
            end: toArchive[toArchive.length - 1]?.timestamp,
          },
        },
      };

      this.semantic.push(summary);

      // Keep only recent episodic memories
      this.episodic = this.episodic.slice(-this.config.retrieval.maxResults);

      this.logger.info(
        `Compaction complete. Archived ${toArchive.length} entries.`,
      );
    }
  }

  /**
   * Clear scratchpad (session working memory)
   */
  clearScratchpad(): void {
    this.scratchpad.clear();
    this.logger.debug('Scratchpad cleared');
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      scratchpadSize: this.scratchpad.size,
      episodicCount: this.episodic.length,
      semanticCount: this.semantic.length,
    };
  }

  /**
   * Generate unique ID for memory entries
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Export memory context
   */
  exportContext(): MemoryContext {
    return {
      scratchpad: Object.fromEntries(this.scratchpad),
      episodic: [...this.episodic],
      semantic: [...this.semantic],
    };
  }

  /**
   * Import memory context
   */
  importContext(context: MemoryContext): void {
    this.scratchpad = new Map(Object.entries(context.scratchpad));
    this.episodic = [...context.episodic];
    this.semantic = [...context.semantic];
    this.logger.info('Memory context imported');
  }
}
