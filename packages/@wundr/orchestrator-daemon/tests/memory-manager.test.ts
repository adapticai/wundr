/**
 * Memory Manager unit tests
 */

import { MemoryManager } from '../src/memory/memory-manager';
import { MemoryConfig } from '../src/types';

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  const testConfig: MemoryConfig = {
    version: '1.0.0',
    tiers: {
      scratchpad: {
        description: 'Test scratchpad',
        maxSize: '10MB',
        ttl: '1h',
        persistence: 'session',
      },
      episodic: {
        description: 'Test episodic',
        maxSize: '50MB',
        ttl: '7d',
        persistence: 'local',
      },
      semantic: {
        description: 'Test semantic',
        maxSize: '100MB',
        ttl: 'permanent',
        persistence: 'permanent',
      },
    },
    compaction: {
      enabled: true,
      threshold: 0.8,
      strategy: 'summarize-and-archive',
    },
    retrieval: {
      strategy: 'recency-weighted-relevance',
      maxResults: 5,
      similarityThreshold: 0.7,
    },
  };

  beforeEach(() => {
    memoryManager = new MemoryManager(testConfig);
  });

  describe('initializeContext', () => {
    it('should initialize empty memory context', () => {
      const context = memoryManager.initializeContext();
      expect(context.scratchpad).toEqual({});
      expect(context.episodic).toEqual([]);
      expect(context.semantic).toEqual([]);
    });
  });

  describe('scratchpad operations', () => {
    it('should store and retrieve from scratchpad', () => {
      memoryManager.storeScratchpad('key1', 'value1');
      const value = memoryManager.retrieveScratchpad('key1');
      expect(value).toBe('value1');
    });

    it('should clear scratchpad', () => {
      memoryManager.storeScratchpad('key1', 'value1');
      memoryManager.clearScratchpad();
      const value = memoryManager.retrieveScratchpad('key1');
      expect(value).toBeUndefined();
    });
  });

  describe('episodic memory', () => {
    it('should add episodic memory entry', () => {
      const entry = memoryManager.addEpisodic({
        content: 'Test interaction',
        timestamp: new Date(),
        type: 'interaction',
      });

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('Test interaction');
    });

    it('should retrieve episodic memories by query', () => {
      memoryManager.addEpisodic({
        content: 'First test interaction',
        timestamp: new Date(),
        type: 'interaction',
      });

      memoryManager.addEpisodic({
        content: 'Second test observation',
        timestamp: new Date(),
        type: 'observation',
      });

      const results = memoryManager.retrieve('test', 'episodic');
      expect(results.length).toBe(2);
    });
  });

  describe('semantic memory', () => {
    it('should add semantic memory entry', () => {
      const entry = memoryManager.addSemantic({
        content: 'Test knowledge',
        timestamp: new Date(),
        type: 'knowledge',
      });

      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('Test knowledge');
    });
  });

  describe('memory export/import', () => {
    it('should export and import memory context', () => {
      memoryManager.storeScratchpad('key1', 'value1');
      memoryManager.addEpisodic({
        content: 'Test interaction',
        timestamp: new Date(),
        type: 'interaction',
      });

      const exported = memoryManager.exportContext();

      const newManager = new MemoryManager(testConfig);
      newManager.importContext(exported);

      const value = newManager.retrieveScratchpad('key1');
      expect(value).toBe('value1');
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', () => {
      memoryManager.storeScratchpad('key1', 'value1');
      memoryManager.addEpisodic({
        content: 'Test',
        timestamp: new Date(),
        type: 'interaction',
      });

      const stats = memoryManager.getStats();
      expect(stats.scratchpadSize).toBe(1);
      expect(stats.episodicCount).toBe(1);
      expect(stats.semanticCount).toBe(0);
    });
  });
});
