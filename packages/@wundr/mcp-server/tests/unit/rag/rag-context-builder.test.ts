/**
 * Unit tests for RAG Context Builder Tool
 *
 * Tests multi-query execution, context prioritization strategies,
 * token budget enforcement, and result consolidation.
 *
 * @module @wundr/mcp-server/tests/unit/rag/rag-context-builder
 */

import { RagContextBuilderSchema } from '../../../src/tools/rag/schemas';
import { ragContextBuilderHandler } from '../../../src/tools/rag/handlers';

// ============================================================================
// Input Schema Validation Tests (schemas.ts interface)
// ============================================================================

describe('RAG Context Builder Input Validation', () => {
  describe('query validation', () => {
    it('should accept single query string', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'find authentication methods',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty query string', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('strategy validation', () => {
    it('should accept relevant strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'relevant',
      });
      expect(result.success).toBe(true);
    });

    it('should accept recent strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'recent',
      });
      expect(result.success).toBe(true);
    });

    it('should accept comprehensive strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'comprehensive',
      });
      expect(result.success).toBe(true);
    });

    it('should accept focused strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'focused',
      });
      expect(result.success).toBe(true);
    });

    it('should accept custom strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'custom',
      });
      expect(result.success).toBe(true);
    });

    it('should default to relevant when not provided', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('relevant');
      }
    });
  });

  describe('sources validation', () => {
    it('should accept files source', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: ['files'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept store source', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: ['store'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept memory source', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: ['memory'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept combined source', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: ['combined'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept multiple sources', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: ['files', 'store', 'memory'],
      });
      expect(result.success).toBe(true);
    });

    it('should default to combined when not provided', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sources).toEqual(['combined']);
      }
    });
  });

  describe('maxTokens validation', () => {
    it('should accept positive integer', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: 8000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject zero', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: -100,
      });
      expect(result.success).toBe(false);
    });

    it('should default to 4000 when not provided', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(4000);
      }
    });
  });

  describe('format validation', () => {
    it('should accept plain format', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        format: 'plain',
      });
      expect(result.success).toBe(true);
    });

    it('should accept markdown format', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        format: 'markdown',
      });
      expect(result.success).toBe(true);
    });

    it('should accept structured format', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        format: 'structured',
      });
      expect(result.success).toBe(true);
    });

    it('should default to markdown when not provided', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('markdown');
      }
    });
  });

  describe('conversation history validation', () => {
    it('should accept valid conversation history', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty conversation history', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('complete input validation', () => {
    it('should accept complete valid input', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'find authentication code',
        strategy: 'comprehensive',
        sources: ['files', 'store'],
        maxTokens: 6000,
        storeName: 'my-store',
        additionalPaths: ['/docs'],
        includeCode: true,
        includeDocs: true,
        conversationHistory: [
          { role: 'user', content: 'Previous message' },
        ],
        format: 'markdown',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Handler Integration Tests (types.ts interface: queries[], targetPath)
// ============================================================================

describe('RAG Context Builder Handler', () => {
  describe('successful execution', () => {
    it('should return success for valid queries', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test function'],
        targetPath: process.cwd(),
        contextGoal: 'Find test functions',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
    });

    it('should include context in response', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['export'],
        targetPath: process.cwd(),
        contextGoal: 'Find exports',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.context).toBeDefined();
        expect(typeof result.data.context).toBe('string');
      }
    });

    it('should include chunks in response', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data.chunks)).toBe(true);
      }
    });

    it('should include totalTokens in response', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.totalTokens).toBe('number');
      }
    });

    it('should include quality metrics', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.quality).toBeDefined();
        expect(typeof result.data.quality?.relevanceScore).toBe('number');
        expect(typeof result.data.quality?.diversityScore).toBe('number');
        expect(typeof result.data.quality?.coverageScore).toBe('number');
      }
    });

    it('should include strategy in response', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.strategy).toBeDefined();
      }
    });

    it('should include sources in response', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data.sources)).toBe(true);
      }
    });
  });

  describe('error handling', () => {
    it('should return error for empty queries', async () => {
      const result = await ragContextBuilderHandler({
        queries: [],
        targetPath: process.cwd(),
        contextGoal: 'Test',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('token budget enforcement', () => {
    it('should respect maxContextTokens limit', async () => {
      const maxTokens = 1000;
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: maxTokens,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.totalTokens).toBeLessThanOrEqual(maxTokens);
      }
    });

    it('should handle small token budget gracefully', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 100,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('response metadata', () => {
    it('should include duration in metadata', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      if (result.metadata) {
        expect(result.metadata.duration).toBeDefined();
        expect(typeof result.metadata.duration).toBe('number');
      }
    });

    it('should include timestamp in metadata', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      if (result.metadata) {
        expect(result.metadata.timestamp).toBeDefined();
      }
    });

    it('should include message describing results', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('prioritization strategy', () => {
    it('should apply relevance strategy', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.strategy).toBe('relevant');
      }
    });

    it('should apply recency strategy', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'recency',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.strategy).toBe('recent');
      }
    });

    it('should apply coverage strategy', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'coverage',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.strategy).toBe('comprehensive');
      }
    });
  });

  describe('multi-query execution', () => {
    it('should process multiple queries', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['function', 'class', 'export'],
        targetPath: process.cwd(),
        contextGoal: 'Find code patterns',
        maxContextTokens: 8000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.context).toBeDefined();
      }
    });

    it('should handle single query', async () => {
      const result = await ragContextBuilderHandler({
        queries: ['test'],
        targetPath: process.cwd(),
        contextGoal: 'Find test code',
        maxContextTokens: 4000,
        prioritization: 'relevance',
      });

      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('RAG Context Builder Edge Cases', () => {
  it('should handle very long query', async () => {
    const longQuery = 'find '.repeat(100);
    const result = await ragContextBuilderHandler({
      queries: [longQuery],
      targetPath: process.cwd(),
      contextGoal: 'Test',
      maxContextTokens: 4000,
      prioritization: 'relevance',
    });

    expect(result.success).toBe(true);
  });

  it('should handle special characters in query', async () => {
    const result = await ragContextBuilderHandler({
      queries: ['function.*test\\b()'],
      targetPath: process.cwd(),
      contextGoal: 'Test',
      maxContextTokens: 4000,
      prioritization: 'relevance',
    });

    expect(result.success).toBe(true);
  });

  it('should handle unicode in query', async () => {
    const result = await ragContextBuilderHandler({
      queries: ['UTF-8 query: test'],
      targetPath: process.cwd(),
      contextGoal: 'Test',
      maxContextTokens: 4000,
      prioritization: 'relevance',
    });

    expect(result.success).toBe(true);
  });

  it('should handle maximum token budget', async () => {
    const result = await ragContextBuilderHandler({
      queries: ['test'],
      targetPath: process.cwd(),
      contextGoal: 'Test',
      maxContextTokens: 100000,
      prioritization: 'relevance',
    });

    expect(result.success).toBe(true);
  });

  it('should handle minimum token budget', async () => {
    const result = await ragContextBuilderHandler({
      queries: ['test'],
      targetPath: process.cwd(),
      contextGoal: 'Test',
      maxContextTokens: 1,
      prioritization: 'relevance',
    });

    expect(result.success).toBe(true);
  });
});
