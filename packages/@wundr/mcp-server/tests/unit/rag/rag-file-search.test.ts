/**
 * Unit tests for RAG File Search Tool
 *
 * Tests input validation, file pattern matching, store creation/reuse,
 * search result formatting, and error handling.
 *
 * @module @wundr/mcp-server/tests/unit/rag/rag-file-search
 */

import { RagFileSearchSchema } from '../../../src/tools/rag/schemas';
import { ragFileSearchHandler } from '../../../src/tools/rag/handlers';

// ============================================================================
// Test Fixtures
// ============================================================================

const validSearchInput = {
  query: 'authentication middleware',
  paths: ['/test/project'],
  includePatterns: ['*.ts', '*.js'],
  excludePatterns: ['node_modules/**'],
  maxResults: 10,
  minScore: 0.3,
  mode: 'hybrid',
  includeContent: true,
  maxContentLength: 500,
};

const minimalSearchInput = {
  query: 'function',
};

// ============================================================================
// Input Validation Tests (using schema from schemas.ts)
// ============================================================================

describe('RAG File Search Input Validation', () => {
  describe('query validation', () => {
    it('should accept valid query string', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test query' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('test query');
      }
    });

    it('should reject empty query string', () => {
      const result = RagFileSearchSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
      if (!result.success && result.error?.issues?.[0]) {
        expect(result.error.issues[0].code).toBe('too_small');
      }
    });

    it('should reject missing query field', () => {
      const result = RagFileSearchSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept multi-word queries', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'find all authentication middleware functions',
      });
      expect(result.success).toBe(true);
    });

    it('should accept special characters in query', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'async/await error handling',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('paths validation', () => {
    it('should accept array of paths', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        paths: ['/src', '/lib'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paths).toEqual(['/src', '/lib']);
      }
    });

    it('should accept empty paths array', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        paths: [],
      });
      expect(result.success).toBe(true);
    });

    it('should default paths to undefined when not provided', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paths).toBeUndefined();
      }
    });
  });

  describe('includePatterns validation', () => {
    it('should accept glob patterns', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        includePatterns: ['*.ts', '*.tsx', '**/*.js'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includePatterns).toEqual(['*.ts', '*.tsx', '**/*.js']);
      }
    });

    it('should accept single pattern as array', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        includePatterns: ['*.md'],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('maxResults validation', () => {
    it('should accept positive integer', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        maxResults: 20,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxResults).toBe(20);
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

    it('should default to 10 when not provided', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxResults).toBe(10);
      }
    });
  });

  describe('minScore validation', () => {
    it('should accept values between 0 and 1', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        minScore: 0.5,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minScore).toBe(0.5);
      }
    });

    it('should accept 0', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        minScore: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should accept 1', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        minScore: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject values greater than 1', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        minScore: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative values', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        minScore: -0.1,
      });
      expect(result.success).toBe(false);
    });

    it('should default to 0.3 when not provided', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minScore).toBe(0.3);
      }
    });
  });

  describe('mode validation', () => {
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

    it('should accept hybrid mode', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        mode: 'hybrid',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid mode', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        mode: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should default to hybrid when not provided', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('hybrid');
      }
    });
  });

  describe('includeContent validation', () => {
    it('should accept true', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        includeContent: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeContent).toBe(true);
      }
    });

    it('should accept false', () => {
      const result = RagFileSearchSchema.safeParse({
        query: 'test',
        includeContent: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeContent).toBe(false);
      }
    });

    it('should default to true when not provided', () => {
      const result = RagFileSearchSchema.safeParse({ query: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeContent).toBe(true);
      }
    });
  });

  describe('complete input validation', () => {
    it('should accept complete valid input', () => {
      const result = RagFileSearchSchema.safeParse(validSearchInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          query: 'authentication middleware',
          maxResults: 10,
          minScore: 0.3,
          mode: 'hybrid',
          includeContent: true,
        });
      }
    });

    it('should accept minimal input with defaults', () => {
      const result = RagFileSearchSchema.safeParse(minimalSearchInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query).toBe('function');
        expect(result.data.maxResults).toBe(10);
        expect(result.data.minScore).toBe(0.3);
        expect(result.data.mode).toBe('hybrid');
        expect(result.data.includeContent).toBe(true);
        expect(result.data.maxContentLength).toBe(500);
      }
    });
  });
});

// ============================================================================
// Handler Tests (using types.ts interface: targetPath, not paths)
// ============================================================================

describe('RAG File Search Handler', () => {
  describe('successful searches', () => {
    it('should return success for valid query', async () => {
      const result = await ragFileSearchHandler({
        query: 'function',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return results array in output', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data.results)).toBe(true);
      }
    });

    it('should include searchDuration in response', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.searchDuration).toBe('number');
        expect(result.data.searchDuration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should include totalFilesSearched in response', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.totalFilesSearched).toBe('number');
      }
    });

    it('should include summary in response', async () => {
      const result = await ragFileSearchHandler({
        query: 'test function',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.summary).toBeDefined();
        expect(typeof result.data.summary).toBe('string');
      }
    });

    it('should include storeInfo in response', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.storeInfo).toBeDefined();
        expect(result.data.storeInfo.name).toBeDefined();
        expect(result.data.storeInfo.createdAt).toBeDefined();
      }
    });
  });

  describe('error handling', () => {
    it('should return error for empty query', async () => {
      const result = await ragFileSearchHandler({
        query: '',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for whitespace-only query', async () => {
      const result = await ragFileSearchHandler({
        query: '   ',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Query is required');
    });

    it('should include error metadata on failure', async () => {
      const result = await ragFileSearchHandler({
        query: '',
        targetPath: process.cwd(),
      });
      expect(result.success).toBe(false);
      if (result.metadata) {
        expect(result.metadata.timestamp).toBeDefined();
      }
    });
  });

  describe('search result formatting', () => {
    it('should include indexStats in response', async () => {
      const result = await ragFileSearchHandler({
        query: 'export',
        targetPath: process.cwd(),
        maxResults: 5,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.indexStats).toBeDefined();
        expect(typeof result.data.indexStats.filesIndexed).toBe('number');
        expect(typeof result.data.indexStats.chunksCreated).toBe('number');
      }
    });

    it('should respect maxResults limit', async () => {
      const maxResults = 3;
      const result = await ragFileSearchHandler({
        query: 'export',
        targetPath: process.cwd(),
        maxResults,
      });

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.results.length).toBeLessThanOrEqual(maxResults);
      }
    });
  });

  describe('file pattern matching', () => {
    it('should filter by include patterns', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
        includePatterns: ['**/*.ts'],
      });

      expect(result.success).toBe(true);
    });

    it('should filter out excluded patterns', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
        excludePatterns: ['**/node_modules/**', '**/.git/**'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('response metadata', () => {
    it('should include timestamp in metadata', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      if (result.metadata) {
        expect(result.metadata.timestamp).toBeDefined();
        expect(typeof result.metadata.timestamp).toBe('string');
        // Validate ISO date format
        expect(() => new Date(result.metadata!.timestamp!)).not.toThrow();
      }
    });

    it('should include duration in metadata', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      if (result.metadata) {
        expect(result.metadata.duration).toBeDefined();
        expect(typeof result.metadata.duration).toBe('number');
      }
    });

    it('should include human-readable message', async () => {
      const result = await ragFileSearchHandler({
        query: 'test',
        targetPath: process.cwd(),
      });
      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message!.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Store Reuse Tests
// ============================================================================

describe('Store Creation and Reuse', () => {
  it('should use default store when no storeName provided', async () => {
    const result = await ragFileSearchHandler({
      query: 'test',
      targetPath: process.cwd(),
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.storeInfo.name).toBe('default');
    }
  });

  it('should use custom store when storeName provided', async () => {
    const storeName = 'custom-store';
    const result = await ragFileSearchHandler({
      query: 'test',
      targetPath: process.cwd(),
      storeName,
    });

    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.storeInfo.name).toBe(storeName);
    }
  });
});
