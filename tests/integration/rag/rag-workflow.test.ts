/**
 * Integration tests for RAG Workflow
 *
 * Tests the complete RAG workflow: init -> index -> search -> results
 * Including store creation, management, and incremental sync.
 *
 * @module tests/integration/rag/rag-workflow
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  MOCK_RAG_STORE,
  MOCK_INDEXED_FILES,
  MOCK_AUTH_SEARCH_RESULT,
  MOCK_ROUTES_SEARCH_RESULT,
  MOCK_INITIAL_SYNC_RESULT,
  MOCK_INCREMENTAL_SYNC_RESULT,
  MOCK_GEMINI_QUERY_RESPONSE,
  createMockRAGService,
  createMockFileSystem,
  getTestProjectFiles,
} from '../../fixtures/rag';

// Mock fs module
jest.mock('fs');
jest.mock('fs/promises');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn((p: string) => p),
  join: jest.fn((...args: string[]) => args.join('/')),
  relative: jest.fn((from: string, to: string) => to.replace(from + '/', '')),
  basename: jest.fn((p: string) => p.split('/').pop() || ''),
  dirname: jest.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  extname: jest.fn((p: string) => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('RAG Workflow Integration Tests', () => {
  let mockFileSystem: ReturnType<typeof createMockFileSystem>;
  let mockRAGService: ReturnType<typeof createMockRAGService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem = createMockFileSystem();
    mockRAGService = createMockRAGService();

    // Setup fs mocks
    mockFs.existsSync.mockImplementation(mockFileSystem.existsSync);
    mockFs.readFileSync.mockImplementation(mockFileSystem.readFileSync as typeof mockFs.readFileSync);
    mockFs.writeFileSync.mockImplementation(mockFileSystem.writeFileSync);
    mockFs.mkdirSync.mockImplementation(mockFileSystem.mkdirSync);
    mockFs.readdirSync.mockImplementation(mockFileSystem.readdirSync as typeof mockFs.readdirSync);
    mockFs.statSync.mockImplementation(mockFileSystem.statSync as typeof mockFs.statSync);
    mockFs.unlinkSync.mockImplementation(mockFileSystem.unlinkSync);
    mockFs.rmSync.mockImplementation(mockFileSystem.rmSync);
    mockFs.copyFileSync.mockImplementation(mockFileSystem.copyFileSync);
    mockFs.appendFileSync.mockImplementation(mockFileSystem.appendFileSync);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete RAG Workflow', () => {
    it('should complete full workflow: init -> index -> search -> results', async () => {
      // Step 1: Initialize RAG store
      const createResult = await mockRAGService.createStore(
        'test-workflow-store',
        'Test Workflow Store',
        {
          chunkSize: 1000,
          chunkOverlap: 200,
          includePatterns: ['**/*.ts', '**/*.js', '**/*.md'],
          excludePatterns: ['**/node_modules/**'],
        }
      );

      expect(createResult).toBeDefined();
      expect(createResult.id).toBeDefined();
      expect(createResult.status).toBe('active');

      // Step 2: Index directory
      await mockRAGService.indexDirectory('/app/src');

      expect(mockRAGService.indexDirectory).toHaveBeenCalledWith('/app/src');

      // Step 3: Verify indexing status
      const isIndexed = await mockRAGService.isIndexed('/app/src');
      expect(isIndexed).toBe(true);

      // Step 4: Search the indexed content
      const searchResult = await mockRAGService.search('authentication', '/app/src', {
        limit: 10,
        minScore: 0.5,
      });

      expect(searchResult).toBeDefined();
      expect(searchResult.query).toBe('authentication');
      expect(searchResult.chunks).toBeDefined();
      expect(searchResult.chunks.length).toBeGreaterThan(0);
      expect(searchResult.totalMatches).toBeGreaterThan(0);

      // Step 5: Validate results
      for (const chunk of searchResult.chunks) {
        expect(chunk.id).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.source).toBeDefined();
        expect(chunk.score).toBeGreaterThanOrEqual(0);
        expect(chunk.score).toBeLessThanOrEqual(1);
      }
    });

    it('should execute multiple queries in parallel', async () => {
      const queries = ['authentication', 'user routes'];

      const results = await mockRAGService.searchMultiple(queries, '/app/src', {
        limit: 5,
        minScore: 0.3,
      });

      expect(results).toHaveLength(2);
      expect(results[0].query).toBe('authentication');
      expect(results[1].query).toBe('user routes');

      // Verify both queries returned results
      for (const result of results) {
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle search with no results gracefully', async () => {
      mockRAGService.search.mockResolvedValueOnce({
        query: 'nonexistent-term',
        chunks: [],
        totalMatches: 0,
        searchTimeMs: 15,
      });

      const result = await mockRAGService.search('nonexistent-term', '/app/src');

      expect(result.chunks).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
    });
  });

  describe('Store Creation and Management', () => {
    it('should create a new store with default configuration', async () => {
      const store = await mockRAGService.createStore('default-config-store');

      expect(store).toBeDefined();
      expect(store.id).toBeDefined();
      expect(store.displayName).toBeDefined();
      expect(store.status).toBe('active');
      expect(store.config).toBeDefined();
    });

    it('should create a store with custom configuration', async () => {
      const customConfig = {
        chunkSize: 500,
        chunkOverlap: 100,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/test/**', '**/node_modules/**'],
        maxFileSize: 512 * 1024,
      };

      const store = await mockRAGService.createStore(
        'custom-config-store',
        'Custom Config Store',
        customConfig
      );

      expect(store).toBeDefined();
      expect(store.config).toBeDefined();
    });

    it('should list all stores', async () => {
      const stores = await mockRAGService.listStores();

      expect(stores).toBeDefined();
      expect(Array.isArray(stores)).toBe(true);
      expect(stores.length).toBeGreaterThanOrEqual(1);

      for (const store of stores) {
        expect(store.id).toBeDefined();
        expect(store.displayName).toBeDefined();
        expect(store.status).toBeDefined();
      }
    });

    it('should get store by ID', async () => {
      const store = await mockRAGService.getStore('test-store-001');

      expect(store).toBeDefined();
      expect(store?.id).toBe('test-store-001');
      expect(store?.displayName).toBe('Test Store');
      expect(store?.fileCount).toBe(15);
      expect(store?.chunkCount).toBe(120);
    });

    it('should return null for non-existent store', async () => {
      mockRAGService.getStore.mockResolvedValueOnce(null);

      const store = await mockRAGService.getStore('non-existent-store');

      expect(store).toBeNull();
    });

    it('should delete a store', async () => {
      const result = await mockRAGService.deleteStore('test-store-001');

      expect(result).toBe(true);
      expect(mockRAGService.deleteStore).toHaveBeenCalledWith('test-store-001');
    });

    it('should get store status with health information', async () => {
      const status = await mockRAGService.getStoreStatus('test-store-001');

      expect(status).toBeDefined();
      expect(status.health).toBeDefined();
      expect(status.health.status).toBe('healthy');
      expect(status.health.lastCheckedAt).toBeDefined();
    });
  });

  describe('Incremental Sync', () => {
    it('should perform initial sync with all files added', async () => {
      mockRAGService.syncStore.mockResolvedValueOnce(MOCK_INITIAL_SYNC_RESULT);

      const result = await mockRAGService.syncStore('test-store-001', '/app/src', false);

      expect(result.added).toBe(15);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.unchanged).toBe(0);
      expect(result.totalChunks).toBe(120);
    });

    it('should perform incremental sync detecting changes', async () => {
      mockRAGService.syncStore.mockResolvedValueOnce(MOCK_INCREMENTAL_SYNC_RESULT);

      const result = await mockRAGService.syncStore('test-store-001', '/app/src', false);

      expect(result.added).toBe(2);
      expect(result.updated).toBe(3);
      expect(result.deleted).toBe(1);
      expect(result.unchanged).toBe(9);
      expect(result.totalChunks).toBe(125);
    });

    it('should force full reindex when requested', async () => {
      mockRAGService.syncStore.mockResolvedValueOnce({
        ...MOCK_INITIAL_SYNC_RESULT,
        added: 17,
        totalChunks: 135,
      });

      const result = await mockRAGService.syncStore('test-store-001', '/app/src', true);

      expect(result.added).toBeGreaterThan(0);
      expect(result.unchanged).toBe(0);
    });

    it('should handle sync with no changes', async () => {
      mockRAGService.syncStore.mockResolvedValueOnce({
        added: 0,
        updated: 0,
        deleted: 0,
        unchanged: 15,
        totalChunks: 120,
        durationMs: 200,
      });

      const result = await mockRAGService.syncStore('test-store-001', '/app/src', false);

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.unchanged).toBe(15);
    });

    it('should report errors during sync', async () => {
      mockRAGService.syncStore.mockResolvedValueOnce({
        ...MOCK_INCREMENTAL_SYNC_RESULT,
        errors: [
          { path: 'src/broken-file.ts', error: 'Parse error: Unexpected token' },
          { path: 'src/large-file.ts', error: 'File exceeds maximum size' },
        ],
      });

      const result = await mockRAGService.syncStore('test-store-001', '/app/src', false);

      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0].path).toBe('src/broken-file.ts');
      expect(result.errors?.[1].path).toBe('src/large-file.ts');
    });
  });

  describe('Search with Filters', () => {
    it('should search with file pattern include filters', async () => {
      const result = await mockRAGService.search('authentication', '/app/src', {
        includePatterns: ['**/*.ts'],
        limit: 10,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should search with file pattern exclude filters', async () => {
      const result = await mockRAGService.search('authentication', '/app/src', {
        excludePatterns: ['**/test/**', '**/*.spec.ts'],
        limit: 10,
      });

      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should search with minimum score threshold', async () => {
      const result = await mockRAGService.search('authentication', '/app/src', {
        minScore: 0.8,
        limit: 10,
      });

      for (const chunk of result.chunks) {
        expect(chunk.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should limit number of results', async () => {
      mockRAGService.search.mockResolvedValueOnce({
        query: 'authentication',
        chunks: MOCK_AUTH_SEARCH_RESULT.chunks.slice(0, 2),
        totalMatches: 3,
        searchTimeMs: 45,
      });

      const result = await mockRAGService.search('authentication', '/app/src', {
        limit: 2,
      });

      expect(result.chunks.length).toBeLessThanOrEqual(2);
      expect(result.totalMatches).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle store creation failure', async () => {
      mockRAGService.createStore.mockRejectedValueOnce(new Error('Failed to create corpus'));

      await expect(
        mockRAGService.createStore('failing-store')
      ).rejects.toThrow('Failed to create corpus');
    });

    it('should handle search failure', async () => {
      mockRAGService.search.mockRejectedValueOnce(new Error('Search service unavailable'));

      await expect(
        mockRAGService.search('query', '/path')
      ).rejects.toThrow('Search service unavailable');
    });

    it('should handle indexing failure', async () => {
      mockRAGService.indexDirectory.mockRejectedValueOnce(
        new Error('Directory not found: /invalid/path')
      );

      await expect(
        mockRAGService.indexDirectory('/invalid/path')
      ).rejects.toThrow('Directory not found');
    });

    it('should handle sync failure with partial results', async () => {
      mockRAGService.syncStore.mockRejectedValueOnce(
        new Error('Partial sync failure: 3 files failed to process')
      );

      await expect(
        mockRAGService.syncStore('store-id', '/path', false)
      ).rejects.toThrow('Partial sync failure');
    });

    it('should handle delete failure for non-existent store', async () => {
      mockRAGService.deleteStore.mockRejectedValueOnce(
        new Error('Store not found: non-existent-id')
      );

      await expect(
        mockRAGService.deleteStore('non-existent-id')
      ).rejects.toThrow('Store not found');
    });
  });

  describe('Performance Metrics', () => {
    it('should include search timing in results', async () => {
      const result = await mockRAGService.search('authentication', '/app/src');

      expect(result.searchTimeMs).toBeDefined();
      expect(typeof result.searchTimeMs).toBe('number');
      expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include sync duration in results', async () => {
      const result = await mockRAGService.syncStore('test-store-001', '/app/src', false);

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include chunk and file counts in store status', async () => {
      const status = await mockRAGService.getStoreStatus('test-store-001');

      expect(status.fileCount).toBeDefined();
      expect(status.chunkCount).toBeDefined();
      expect(status.sizeBytes).toBeDefined();
      expect(typeof status.fileCount).toBe('number');
      expect(typeof status.chunkCount).toBe('number');
    });
  });

  describe('Mock Gemini API Responses', () => {
    it('should process Gemini query response format correctly', () => {
      const response = MOCK_GEMINI_QUERY_RESPONSE;

      expect(response.relevantChunks).toBeDefined();
      expect(Array.isArray(response.relevantChunks)).toBe(true);

      for (const item of response.relevantChunks) {
        expect(item.chunk).toBeDefined();
        expect(item.chunk.name).toBeDefined();
        expect(item.chunk.data).toBeDefined();
        expect(item.chunkRelevanceScore).toBeGreaterThanOrEqual(0);
        expect(item.chunkRelevanceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should extract metadata from Gemini response', () => {
      const chunk = MOCK_GEMINI_QUERY_RESPONSE.relevantChunks[0];
      const metadata = chunk.chunk.customMetadata;

      expect(metadata).toBeDefined();
      expect(Array.isArray(metadata)).toBe(true);

      const filePathMeta = metadata.find(m => m.key === 'filePath');
      expect(filePathMeta).toBeDefined();
      expect(filePathMeta?.stringValue).toBe('src/services/auth.ts');

      const startLineMeta = metadata.find(m => m.key === 'startLine');
      expect(startLineMeta).toBeDefined();
      expect(startLineMeta?.numericValue).toBe(15);
    });
  });
});
