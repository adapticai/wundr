/**
 * Tests for the MemoryManager class (src/memory/memory-manager.ts).
 *
 * Covers:
 *  - Context initialization
 *  - Scratchpad CRUD (store, retrieve, clear)
 *  - Episodic memory (add, retrieve, compaction trigger)
 *  - Semantic memory (add, retrieve)
 *  - Keyword-based retrieval with relevance ordering
 *  - Memory compaction (threshold, archival to semantic)
 *  - Compaction disabled mode
 *  - Export / import round-trip
 *  - Statistics
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { MemoryManager } from '../../../memory/memory-manager';
import { createMockMemoryConfig } from '../../helpers';
import { FIXTURES } from '../../helpers/test-fixtures';

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager(createMockMemoryConfig());
  });

  // -------------------------------------------------------------------------
  // Context initialization
  // -------------------------------------------------------------------------

  describe('initializeContext', () => {
    it('should return an empty memory context', () => {
      const ctx = manager.initializeContext();

      expect(ctx.scratchpad).toEqual({});
      expect(ctx.episodic).toEqual([]);
      expect(ctx.semantic).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Scratchpad (working memory)
  // -------------------------------------------------------------------------

  describe('scratchpad', () => {
    it('should store and retrieve values', () => {
      manager.storeScratchpad('key1', 'value1');
      manager.storeScratchpad('key2', { nested: true });

      expect(manager.retrieveScratchpad('key1')).toBe('value1');
      expect(manager.retrieveScratchpad('key2')).toEqual({ nested: true });
    });

    it('should return undefined for missing keys', () => {
      expect(manager.retrieveScratchpad('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing keys', () => {
      manager.storeScratchpad('key', 'original');
      manager.storeScratchpad('key', 'updated');

      expect(manager.retrieveScratchpad('key')).toBe('updated');
    });

    it('should clear all scratchpad data', () => {
      manager.storeScratchpad('a', 1);
      manager.storeScratchpad('b', 2);

      manager.clearScratchpad();

      expect(manager.retrieveScratchpad('a')).toBeUndefined();
      expect(manager.retrieveScratchpad('b')).toBeUndefined();
      expect(manager.getStats().scratchpadSize).toBe(0);
    });

    it('should handle various value types', () => {
      manager.storeScratchpad('null', null);
      manager.storeScratchpad('number', 42);
      manager.storeScratchpad('array', [1, 2, 3]);
      manager.storeScratchpad('boolean', true);

      expect(manager.retrieveScratchpad('null')).toBeNull();
      expect(manager.retrieveScratchpad('number')).toBe(42);
      expect(manager.retrieveScratchpad('array')).toEqual([1, 2, 3]);
      expect(manager.retrieveScratchpad('boolean')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Episodic memory
  // -------------------------------------------------------------------------

  describe('episodic memory', () => {
    it('should add entries with generated IDs', () => {
      const entry = manager.addEpisodic({
        content: 'User asked about testing',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        type: 'interaction',
      });

      expect(entry.id).toBeDefined();
      expect(entry.id).toMatch(/^mem_/);
      expect(entry.content).toBe('User asked about testing');
    });

    it('should add multiple entries', () => {
      manager.addEpisodic({
        content: 'First interaction',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        type: 'interaction',
      });
      manager.addEpisodic({
        content: 'Second interaction',
        timestamp: new Date('2025-01-01T01:00:00Z'),
        type: 'observation',
      });

      expect(manager.getStats().episodicCount).toBe(2);
    });

    it('should preserve metadata', () => {
      const entry = manager.addEpisodic({
        content: 'Important decision',
        timestamp: new Date(),
        type: 'decision',
        metadata: { confidence: 0.95, tags: ['architecture'] },
      });

      expect(entry.metadata).toEqual({
        confidence: 0.95,
        tags: ['architecture'],
      });
    });
  });

  // -------------------------------------------------------------------------
  // Semantic memory
  // -------------------------------------------------------------------------

  describe('semantic memory', () => {
    it('should add entries with generated IDs', () => {
      const entry = manager.addSemantic({
        content: 'TypeScript supports generics',
        timestamp: new Date(),
        type: 'knowledge',
      });

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('TypeScript supports generics');
    });

    it('should not trigger compaction', () => {
      // Semantic memory should just accumulate
      for (let i = 0; i < 50; i++) {
        manager.addSemantic({
          content: `Knowledge entry ${i}`,
          timestamp: new Date(),
          type: 'knowledge',
        });
      }

      expect(manager.getStats().semanticCount).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Retrieval
  // -------------------------------------------------------------------------

  describe('retrieve', () => {
    beforeEach(() => {
      // Add episodic entries with varying timestamps
      manager.addEpisodic({
        content: 'Discussion about TypeScript generics',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        type: 'interaction',
      });
      manager.addEpisodic({
        content: 'Code review for React components',
        timestamp: new Date('2025-01-01T01:00:00Z'),
        type: 'interaction',
      });
      manager.addEpisodic({
        content: 'TypeScript type inference discussion',
        timestamp: new Date('2025-01-01T02:00:00Z'),
        type: 'interaction',
      });

      // Add semantic entries
      manager.addSemantic({
        content: 'TypeScript is a statically typed language',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        type: 'knowledge',
      });
      manager.addSemantic({
        content: 'React uses JSX for templating',
        timestamp: new Date('2025-01-01T00:00:00Z'),
        type: 'knowledge',
      });
    });

    it('should retrieve matching episodic entries by keyword', () => {
      const results = manager.retrieve('TypeScript');

      expect(results.length).toBe(2);
      expect(results.every((r) => r.content.includes('TypeScript'))).toBe(true);
    });

    it('should retrieve matching semantic entries', () => {
      const results = manager.retrieve('TypeScript', 'semantic');

      expect(results.length).toBe(1);
      expect(results[0]!.content).toContain('statically typed');
    });

    it('should return results sorted by recency (most recent first)', () => {
      const results = manager.retrieve('TypeScript');

      expect(results.length).toBe(2);
      // The second entry (2025-01-01T02:00:00Z) should come first
      expect(results[0]!.content).toContain('type inference');
      expect(results[1]!.content).toContain('generics');
    });

    it('should be case-insensitive', () => {
      const results = manager.retrieve('typescript');

      expect(results.length).toBe(2);
    });

    it('should return empty array for no matches', () => {
      const results = manager.retrieve('Python');

      expect(results).toEqual([]);
    });

    it('should limit results to maxResults config value', () => {
      // Add many matching entries
      for (let i = 0; i < 20; i++) {
        manager.addEpisodic({
          content: `Discussion about testing pattern ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          type: 'interaction',
        });
      }

      const results = manager.retrieve('testing');

      expect(results.length).toBeLessThanOrEqual(10); // maxResults from config
    });
  });

  // -------------------------------------------------------------------------
  // Compaction
  // -------------------------------------------------------------------------

  describe('compaction', () => {
    it('should trigger compaction when episodic entries exceed threshold', () => {
      // Use aggressive config: maxResults=3, threshold=0.5
      manager = new MemoryManager(FIXTURES.memory.aggressiveCompaction);

      // Add enough entries to trigger compaction (maxResults * 2 = 6)
      for (let i = 0; i < 7; i++) {
        manager.addEpisodic({
          content: `Interaction ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          type: 'interaction',
        });
      }

      const stats = manager.getStats();
      // After compaction, episodic should be trimmed to maxResults (3)
      expect(stats.episodicCount).toBeLessThanOrEqual(3);
      // Semantic should have at least 1 summary entry
      expect(stats.semanticCount).toBeGreaterThan(0);
    });

    it('should create a summary entry in semantic memory', () => {
      manager = new MemoryManager(FIXTURES.memory.aggressiveCompaction);

      for (let i = 0; i < 7; i++) {
        manager.addEpisodic({
          content: `Interaction ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          type: 'interaction',
        });
      }

      // Export and check semantic entries
      const context = manager.exportContext();
      const summaries = context.semantic.filter(
        (e) => e.content.includes('Archived summary'),
      );

      expect(summaries.length).toBeGreaterThan(0);
      expect(summaries[0]!.metadata?.archived).toBeDefined();
    });

    it('should not compact when compaction is disabled', () => {
      manager = new MemoryManager(FIXTURES.memory.noCompaction);

      for (let i = 0; i < 25; i++) {
        manager.addEpisodic({
          content: `Interaction ${i}`,
          timestamp: new Date(Date.now() + i * 1000),
          type: 'interaction',
        });
      }

      const stats = manager.getStats();
      // All entries should remain since compaction is disabled
      expect(stats.episodicCount).toBe(25);
      expect(stats.semanticCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  describe('export / import', () => {
    it('should export the full memory context', () => {
      manager.storeScratchpad('key', 'value');
      manager.addEpisodic({
        content: 'Episode 1',
        timestamp: new Date('2025-01-01'),
        type: 'interaction',
      });
      manager.addSemantic({
        content: 'Knowledge 1',
        timestamp: new Date('2025-01-01'),
        type: 'knowledge',
      });

      const context = manager.exportContext();

      expect(context.scratchpad).toEqual({ key: 'value' });
      expect(context.episodic.length).toBe(1);
      expect(context.episodic[0]!.content).toBe('Episode 1');
      expect(context.semantic.length).toBe(1);
      expect(context.semantic[0]!.content).toBe('Knowledge 1');
    });

    it('should import a memory context', () => {
      const context = {
        scratchpad: { imported: true, count: 42 },
        episodic: [
          {
            id: 'imported-1',
            content: 'Imported episode',
            timestamp: new Date('2025-01-01'),
            type: 'interaction' as const,
          },
        ],
        semantic: [
          {
            id: 'imported-2',
            content: 'Imported knowledge',
            timestamp: new Date('2025-01-01'),
            type: 'knowledge' as const,
          },
        ],
      };

      manager.importContext(context);

      expect(manager.retrieveScratchpad('imported')).toBe(true);
      expect(manager.retrieveScratchpad('count')).toBe(42);
      expect(manager.getStats().episodicCount).toBe(1);
      expect(manager.getStats().semanticCount).toBe(1);
    });

    it('should round-trip export and import', () => {
      manager.storeScratchpad('round', 'trip');
      manager.addEpisodic({
        content: 'Round trip episodic',
        timestamp: new Date('2025-01-01'),
        type: 'interaction',
      });
      manager.addSemantic({
        content: 'Round trip semantic',
        timestamp: new Date('2025-01-01'),
        type: 'knowledge',
      });

      const exported = manager.exportContext();

      // Create a new manager and import
      const newManager = new MemoryManager(createMockMemoryConfig());
      newManager.importContext(exported);

      expect(newManager.retrieveScratchpad('round')).toBe('trip');
      expect(newManager.getStats().episodicCount).toBe(1);
      expect(newManager.getStats().semanticCount).toBe(1);
    });

    it('should not share references between original and exported context', () => {
      manager.addEpisodic({
        content: 'Original',
        timestamp: new Date(),
        type: 'interaction',
      });

      const exported = manager.exportContext();

      // Mutating the export should not affect the manager
      exported.episodic.push({
        id: 'injected',
        content: 'Injected',
        timestamp: new Date(),
        type: 'interaction',
      });

      expect(manager.getStats().episodicCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  describe('getStats', () => {
    it('should return correct counts for empty manager', () => {
      const stats = manager.getStats();

      expect(stats.scratchpadSize).toBe(0);
      expect(stats.episodicCount).toBe(0);
      expect(stats.semanticCount).toBe(0);
    });

    it('should reflect all operations', () => {
      manager.storeScratchpad('a', 1);
      manager.storeScratchpad('b', 2);
      manager.addEpisodic({
        content: 'Ep 1',
        timestamp: new Date(),
        type: 'interaction',
      });
      manager.addEpisodic({
        content: 'Ep 2',
        timestamp: new Date(),
        type: 'interaction',
      });
      manager.addEpisodic({
        content: 'Ep 3',
        timestamp: new Date(),
        type: 'interaction',
      });
      manager.addSemantic({
        content: 'Sem 1',
        timestamp: new Date(),
        type: 'knowledge',
      });

      const stats = manager.getStats();

      expect(stats.scratchpadSize).toBe(2);
      expect(stats.episodicCount).toBe(3);
      expect(stats.semanticCount).toBe(1);
    });
  });
});
