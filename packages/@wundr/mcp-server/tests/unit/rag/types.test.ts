/**
 * Unit tests for RAG Types and Zod Schema Validation
 *
 * Tests type definitions, Zod schema validation, type inference,
 * and default values for all RAG-related types.
 *
 * @module @wundr/mcp-server/tests/unit/rag/types
 */

import {
  RagFileSearchSchema,
  RagStoreManageSchema,
  RagContextBuilderSchema,
  RagToolSchemaEntries,
} from '../../../src/tools/rag/schemas';
import {
  DEFAULT_STORE_CONFIG,
  FILE_TYPE_EXTENSIONS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_CHUNKING_CONFIG,
} from '../../../src/tools/rag/types';

// ============================================================================
// Schema Registry Tests
// ============================================================================

describe('RagToolSchemaEntries Registry', () => {
  it('should contain rag-file-search entry', () => {
    expect(RagToolSchemaEntries).toHaveProperty('rag-file-search');
    expect(RagToolSchemaEntries['rag-file-search'].schema).toBeDefined();
    expect(RagToolSchemaEntries['rag-file-search'].description).toBeDefined();
    expect(RagToolSchemaEntries['rag-file-search'].category).toBe('rag');
  });

  it('should contain rag-store-manage entry', () => {
    expect(RagToolSchemaEntries).toHaveProperty('rag-store-manage');
    expect(RagToolSchemaEntries['rag-store-manage'].schema).toBeDefined();
    expect(RagToolSchemaEntries['rag-store-manage'].description).toBeDefined();
    expect(RagToolSchemaEntries['rag-store-manage'].category).toBe('rag');
  });

  it('should contain rag-context-builder entry', () => {
    expect(RagToolSchemaEntries).toHaveProperty('rag-context-builder');
    expect(RagToolSchemaEntries['rag-context-builder'].schema).toBeDefined();
    expect(RagToolSchemaEntries['rag-context-builder'].description).toBeDefined();
    expect(RagToolSchemaEntries['rag-context-builder'].category).toBe('rag');
  });

  it('should have meaningful descriptions', () => {
    for (const [name, entry] of Object.entries(RagToolSchemaEntries)) {
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.description).not.toContain('TODO');
    }
  });
});

// ============================================================================
// RagFileSearchSchema Tests
// ============================================================================

describe('RagFileSearchSchema', () => {
  describe('required fields', () => {
    it('should require query field', () => {
      const result = RagFileSearchSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        const queryError = result.error.issues.find((i) => i.path.includes('query'));
        expect(queryError).toBeDefined();
      }
    });
  });

  describe('query field', () => {
    it('should accept non-empty string', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should reject empty string', () => {
      const result = RagFileSearchSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });

    it('should accept multi-line queries', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'line1\nline2' });
      expect(result.success).toBe(true);
    });
  });

  describe('paths field', () => {
    it('should accept array of strings', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        paths: ['/src', '/lib'],
      });
      expect(result.success).toBe(true);
    });

    it('should be optional', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paths).toBeUndefined();
      }
    });
  });

  describe('includePatterns field', () => {
    it('should accept array of glob patterns', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        includePatterns: ['*.ts', '*.tsx', '**/*.js'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('excludePatterns field', () => {
    it('should accept array of glob patterns', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        excludePatterns: ['node_modules/**', '.git/**'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('maxResults field', () => {
    it('should default to 10', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxResults).toBe(10);
      }
    });

    it('should accept custom positive integer', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        maxResults: 50,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxResults).toBe(50);
      }
    });

    it('should reject zero', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        maxResults: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        maxResults: -5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integers', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        maxResults: 10.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('minScore field', () => {
    it('should default to 0.3', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minScore).toBe(0.3);
      }
    });

    it('should accept values in range [0, 1]', () => {
      for (const score of [0, 0.25, 0.5, 0.75, 1]) {
        const result = RagFileSearchSchema.safeParse({
          query: 'test',
          minScore: score,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject values outside range', () => {
      for (const score of [-0.1, 1.1, 2]) {
        const result = RagFileSearchSchema.safeParse({
          query: 'test',
          minScore: score,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('mode field', () => {
    it('should default to hybrid', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('hybrid');
      }
    });

    it('should accept semantic mode', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        mode: 'semantic',
      });
      expect(result.success).toBe(true);
    });

    it('should accept keyword mode', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        mode: 'keyword',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid modes', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        mode: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('includeContent field', () => {
    it('should default to true', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeContent).toBe(true);
      }
    });

    it('should accept boolean values', () => {
      for (const value of [true, false]) {
        const result = RagFileSearchSchema.safeParse({
          query: 'test',
          includeContent: value,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('maxContentLength field', () => {
    it('should default to 500', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxContentLength).toBe(500);
      }
    });
  });

  describe('type inference', () => {
    it('should correctly infer RagFileSearchInput type', () => {
      const input = {
        query: 'test',
        paths: ['/src'],
        includePatterns: ['*.ts'],
        excludePatterns: ['node_modules/**'],
        maxResults: 20,
        minScore: 0.5,
        mode: 'hybrid',
        includeContent: true,
        maxContentLength: 1000,
      };

      const result = RagFileSearchSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// RagStoreManageSchema Tests
// ============================================================================

describe('RagStoreManageSchema', () => {
  describe('action field', () => {
    it('should require action field', () => {
      const result = RagStoreManageSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    const validActions = ['create', 'delete', 'list', 'status', 'index', 'clear', 'optimize', 'backup', 'restore'];

    it.each(validActions)('should accept %s action', (action) => {
      const result = RagStoreManageSchema.safeParse({ action });
      expect(result.success).toBe(true);
    });

    it('should reject invalid action', () => {
      const result = RagStoreManageSchema.safeParse({ action: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('storeName field', () => {
    it('should accept string store name', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store',
      });
      expect(result.success).toBe(true);
    });

    it('should be optional', () => {
      const result = RagStoreManageSchema.safeParse({ action: 'list' });
      expect(result.success).toBe(true);
    });
  });

  describe('config field', () => {
    it('should accept valid config object', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'test',
        config: {
          type: 'memory',
          embeddingModel: 'openai',
          dimensions: 1536,
        },
      });
      expect(result.success).toBe(true);
    });

    describe('config.type', () => {
      const validTypes = ['memory', 'chromadb', 'pinecone', 'qdrant', 'weaviate'];

      it.each(validTypes)('should accept %s type', (type) => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { type },
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid type', () => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { type: 'invalid' },
        });
        expect(result.success).toBe(false);
      });
    });

    describe('config.embeddingModel', () => {
      const validModels = ['openai', 'cohere', 'local', 'custom'];

      it.each(validModels)('should accept %s model', (model) => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { embeddingModel: model },
        });
        expect(result.success).toBe(true);
      });
    });

    describe('config.dimensions', () => {
      it('should accept positive integer', () => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { dimensions: 768 },
        });
        expect(result.success).toBe(true);
      });

      it('should reject zero', () => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { dimensions: 0 },
        });
        expect(result.success).toBe(false);
      });

      it('should reject negative', () => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: { dimensions: -100 },
        });
        expect(result.success).toBe(false);
      });
    });

    describe('config.metadata', () => {
      it('should accept arbitrary metadata object', () => {
        const result = RagStoreManageSchema.safeParse({
          action: 'create',
          config: {
            metadata: {
              project: 'my-project',
              version: 1,
              enabled: true,
            },
          },
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('indexPaths field', () => {
    it('should accept array of paths', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'index',
        indexPaths: ['/src', '/lib', '/tests'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('backupPath field', () => {
    it('should accept string path', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'backup',
        storeName: 'test',
        backupPath: '/backups/test.bak',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('force field', () => {
    it('should accept boolean', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'delete',
        storeName: 'test',
        force: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('type inference', () => {
    it('should correctly infer RagStoreManageInput type', () => {
      const input = {
        action: 'create',
        storeName: 'my-store',
        config: {
          type: 'memory',
          embeddingModel: 'local',
          dimensions: 384,
          metadata: { test: true },
        },
        indexPaths: ['/src'],
        backupPath: '/backup',
        force: false,
      };

      const result = RagStoreManageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// RagContextBuilderSchema Tests
// ============================================================================

describe('RagContextBuilderSchema', () => {
  describe('query field', () => {
    it('should require query field', () => {
      const result = RagContextBuilderSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept non-empty string', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should reject empty string', () => {
      const result = RagContextBuilderSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('strategy field', () => {
    const validStrategies = ['relevant', 'recent', 'comprehensive', 'focused', 'custom'];

    it.each(validStrategies)('should accept %s strategy', (strategy) => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy,
      });
      expect(result.success).toBe(true);
    });

    it('should default to relevant', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('relevant');
      }
    });

    it('should reject invalid strategy', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        strategy: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sources field', () => {
    const validSources = ['files', 'store', 'memory', 'combined'];

    it.each(validSources)('should accept %s source', (source) => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        sources: [source],
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

    it('should default to combined', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sources).toEqual(['combined']);
      }
    });
  });

  describe('maxTokens field', () => {
    it('should default to 4000', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxTokens).toBe(4000);
      }
    });

    it('should accept custom positive integer', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: 8000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive values', () => {
      for (const value of [0, -100]) {
        const result = RagContextBuilderSchema.safeParse({
          query: 'test',
          maxTokens: value,
        });
        expect(result.success).toBe(false);
      }
    });
  });

  describe('format field', () => {
    const validFormats = ['plain', 'markdown', 'structured'];

    it.each(validFormats)('should accept %s format', (format) => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        format,
      });
      expect(result.success).toBe(true);
    });

    it('should default to markdown', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('markdown');
      }
    });
  });

  describe('storeName field', () => {
    it('should accept string', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        storeName: 'my-store',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('additionalPaths field', () => {
    it('should accept array of paths', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        additionalPaths: ['/docs', '/examples'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('includeCode field', () => {
    it('should default to true', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeCode).toBe(true);
      }
    });
  });

  describe('includeDocs field', () => {
    it('should default to true', () => {
      const result = RagContextBuilderSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeDocs).toBe(true);
      }
    });
  });

  describe('conversationHistory field', () => {
    it('should accept valid conversation messages', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid roles', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: [{ role: 'invalid', content: 'test' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('type inference', () => {
    it('should correctly infer RagContextBuilderInput type', () => {
      const input = {
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
      };

      const result = RagContextBuilderSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Type Constants', () => {
  describe('DEFAULT_STORE_CONFIG', () => {
    it('should have all required fields', () => {
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('chunkSize');
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('chunkOverlap');
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('includePatterns');
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('excludePatterns');
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('maxFileSize');
      expect(DEFAULT_STORE_CONFIG).toHaveProperty('embeddingModel');
    });

    it('should have reasonable default values', () => {
      expect(DEFAULT_STORE_CONFIG.chunkSize).toBeGreaterThan(0);
      expect(DEFAULT_STORE_CONFIG.chunkOverlap).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_STORE_CONFIG.chunkOverlap).toBeLessThan(DEFAULT_STORE_CONFIG.chunkSize);
      expect(DEFAULT_STORE_CONFIG.maxFileSize).toBeGreaterThan(0);
      expect(Array.isArray(DEFAULT_STORE_CONFIG.includePatterns)).toBe(true);
      expect(Array.isArray(DEFAULT_STORE_CONFIG.excludePatterns)).toBe(true);
    });
  });

  describe('FILE_TYPE_EXTENSIONS', () => {
    it('should have code category with common extensions', () => {
      expect(FILE_TYPE_EXTENSIONS.code).toContain('.ts');
      expect(FILE_TYPE_EXTENSIONS.code).toContain('.js');
      expect(FILE_TYPE_EXTENSIONS.code).toContain('.py');
    });

    it('should have documentation category', () => {
      expect(FILE_TYPE_EXTENSIONS.documentation).toContain('.md');
      expect(FILE_TYPE_EXTENSIONS.documentation).toContain('.txt');
    });

    it('should have config category', () => {
      expect(FILE_TYPE_EXTENSIONS.config).toContain('.json');
      expect(FILE_TYPE_EXTENSIONS.config).toContain('.yaml');
    });

    it('should have data category', () => {
      expect(FILE_TYPE_EXTENSIONS.data).toContain('.csv');
      expect(FILE_TYPE_EXTENSIONS.data).toContain('.sql');
    });

    it('should have empty all category', () => {
      expect(FILE_TYPE_EXTENSIONS.all).toEqual([]);
    });
  });

  describe('DEFAULT_EXCLUDE_PATTERNS', () => {
    it('should exclude node_modules', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some((p) => p.includes('node_modules'))).toBe(true);
    });

    it('should exclude .git', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some((p) => p.includes('.git'))).toBe(true);
    });

    it('should exclude dist/build', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some((p) => p.includes('dist'))).toBe(true);
    });

    it('should exclude minified files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some((p) => p.includes('.min.js'))).toBe(true);
    });
  });

  describe('DEFAULT_CHUNKING_CONFIG', () => {
    it('should have valid chunking strategy', () => {
      expect(['fixed', 'semantic', 'paragraph', 'sentence']).toContain(
        DEFAULT_CHUNKING_CONFIG.strategy
      );
    });

    it('should have reasonable chunk size', () => {
      expect(DEFAULT_CHUNKING_CONFIG.chunkSize).toBeGreaterThan(0);
      expect(DEFAULT_CHUNKING_CONFIG.chunkSize).toBeLessThan(10000);
    });

    it('should have overlap less than chunk size', () => {
      expect(DEFAULT_CHUNKING_CONFIG.chunkOverlap).toBeLessThan(
        DEFAULT_CHUNKING_CONFIG.chunkSize
      );
    });
  });
});

// ============================================================================
// Edge Cases and Error Handling Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('RagFileSearchSchema edge cases', () => {
    it('should handle very long query', () => {
      const longQuery = 'a'.repeat(10000);
      const result = RagFileSearchSchema.safeParse({ query: longQuery });
      expect(result.success).toBe(true);
    });

    it('should handle unicode in query', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'UTF-8 query: ????',
      });
      expect(result.success).toBe(true);
    });

    it('should handle special regex characters in query', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'function.*test\\b',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RagStoreManageSchema edge cases', () => {
    it('should handle very long store name', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'a'.repeat(1000),
      });
      expect(result.success).toBe(true);
    });

    it('should handle store name with special characters', () => {
      const result = RagStoreManageSchema.safeParse({
        action: 'create',
        storeName: 'my-store_v2.0',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('RagContextBuilderSchema edge cases', () => {
    it('should handle maxTokens at boundary', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should handle large maxTokens', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        maxTokens: 1000000,
      });
      expect(result.success).toBe(true);
    });

    it('should handle empty conversation history', () => {
      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: [],
      });
      expect(result.success).toBe(true);
    });

    it('should handle long conversation history', () => {
      const history = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      }));

      const result = RagContextBuilderSchema.safeParse({
        query: 'test',
        conversationHistory: history,
      });
      expect(result.success).toBe(true);
    });
  });
});
