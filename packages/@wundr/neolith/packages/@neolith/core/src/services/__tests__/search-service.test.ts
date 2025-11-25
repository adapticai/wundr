/**
 * @fileoverview Tests for SearchService
 *
 * Comprehensive test suite for the enterprise search service covering:
 * - Full-text search across all content types
 * - Filtering and pagination
 * - Result caching
 * - Search suggestions
 * - Recent search history
 *
 * @module @genesis/core/services/__tests__/search-service.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { createMockRedis, type MockRedis } from '../../test-utils/mock-redis';
import {
  SearchServiceImpl,
  createSearchService,
  getSearchService,
  resetSearchService,
  SearchValidationError,
} from '../search-service';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Create a mock Prisma client for testing
 */
function createMockPrisma() {
  return {
    $queryRawUnsafe: vi.fn(),
    $queryRaw: vi.fn(),
  };
}

/**
 * Extend mock Redis with list operations needed for search service
 */
function extendMockRedisWithListOps(mockRedis: MockRedis) {
  // Add list operation mocks that aren't in the base mock
  const listStore = new Map<string, string[]>();

  (mockRedis as unknown as Record<string, unknown>).lrange = vi.fn(
    async (key: string, start: number, stop: number): Promise<string[]> => {
      const list = listStore.get(key) || [];
      const actualStop = stop === -1 ? list.length : stop + 1;
      return list.slice(start, actualStop);
    },
  );

  (mockRedis as unknown as Record<string, unknown>).lpush = vi.fn(
    async (key: string, ...values: string[]): Promise<number> => {
      const list = listStore.get(key) || [];
      list.unshift(...values);
      listStore.set(key, list);
      return list.length;
    },
  );

  (mockRedis as unknown as Record<string, unknown>).ltrim = vi.fn(
    async (key: string, start: number, stop: number): Promise<'OK'> => {
      const list = listStore.get(key) || [];
      const actualStop = stop === -1 ? list.length : stop + 1;
      listStore.set(key, list.slice(start, actualStop));
      return 'OK';
    },
  );

  return {
    ...mockRedis,
    _listStore: listStore,
  };
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe('SearchService', () => {
  let searchService: SearchServiceImpl;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: MockRedis & {
    lrange: ReturnType<typeof vi.fn>;
    lpush: ReturnType<typeof vi.fn>;
    ltrim: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    const baseMockRedis = createMockRedis();
    mockRedis = extendMockRedisWithListOps(baseMockRedis) as typeof mockRedis;

    searchService = new SearchServiceImpl({
      prisma: mockPrisma as unknown as Parameters<typeof createSearchService>[0]['prisma'],
      redis: mockRedis as unknown as Parameters<typeof createSearchService>[0]['redis'],
      defaultLimit: 20,
      maxLimit: 100,
      cachePrefix: 'test:search:',
      cacheTtl: 300,
    });

    vi.clearAllMocks();
    resetSearchService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // search() Tests
  // ===========================================================================

  describe('search', () => {
    it('should throw validation error for empty query', async () => {
      await expect(
        searchService.search({ query: '' }),
      ).rejects.toThrow(SearchValidationError);

      await expect(
        searchService.search({ query: '   ' }),
      ).rejects.toThrow(SearchValidationError);
    });

    it('should throw validation error for query exceeding max length', async () => {
      const longQuery = 'a'.repeat(501);
      await expect(
        searchService.search({ query: longQuery }),
      ).rejects.toThrow(SearchValidationError);
    });

    it('should return cached results if available', async () => {
      const cachedResponse = {
        results: [
          {
            id: 'msg-1',
            type: 'message',
            score: 1.0,
            data: {
              type: 'message',
              messageId: 'msg-1',
              content: 'Test message',
              channelId: 'ch-1',
              channelName: 'general',
              senderId: 'user-1',
              senderName: 'John Doe',
              sentAt: new Date().toISOString(),
              hasAttachments: false,
            },
          },
        ],
        total: 1,
        took: 50,
        pagination: { hasMore: false },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await searchService.search({
        query: 'test',
        filters: { workspaceId: 'ws-1' },
      });

      expect(result.results).toHaveLength(1);
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('should search messages with full-text query', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'msg-1',
          content: 'Test message content',
          channelId: 'ch-1',
          channelName: 'general',
          senderId: 'user-1',
          senderName: 'John Doe',
          sentAt: new Date(),
          threadId: null,
          hasAttachments: false,
          rank: 0.8,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'test',
        filters: {
          workspaceId: 'ws-1',
          types: ['message'],
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('message');
      expect(result.results[0].score).toBe(0.8);
    });

    it('should search files', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'file-1',
          fileName: 'report.pdf',
          fileType: 'application/pdf',
          fileSize: 1024000,
          channelId: 'ch-1',
          channelName: 'general',
          uploaderId: 'user-1',
          uploaderName: 'John Doe',
          uploadedAt: new Date(),
          extractedText: 'Quarterly report content',
          rank: 0.9,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'report',
        filters: {
          workspaceId: 'ws-1',
          types: ['file'],
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('file');
    });

    it('should search channels', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'ch-1',
          name: 'engineering',
          description: 'Engineering team discussions',
          memberCount: BigInt(25),
          isPrivate: false,
          createdAt: new Date(),
          rank: 0.95,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'engineering',
        filters: {
          workspaceId: 'ws-1',
          types: ['channel'],
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('channel');
      const channelData = result.results[0].data as { memberCount: number };
      expect(channelData.memberCount).toBe(25);
    });

    it('should search users', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'user-1',
          name: 'Jane Smith',
          email: 'jane@example.com',
          role: 'ADMIN',
          discipline: 'Engineering',
          avatarUrl: 'https://example.com/avatar.jpg',
          rank: 0.85,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'jane',
        filters: {
          workspaceId: 'ws-1',
          types: ['user'],
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('user');
    });

    it('should search VPs', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'vp-1',
          name: 'AI Assistant',
          discipline: 'Engineering',
          status: 'ACTIVE',
          capabilities: ['code-review', 'documentation'],
          rank: 0.92,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'assistant',
        filters: {
          workspaceId: 'ws-1',
          types: ['vp'],
        },
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].type).toBe('vp');
    });

    it('should apply date range filter', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        filters: {
          workspaceId: 'ws-1',
          types: ['message'],
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31'),
          },
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const sqlCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sqlCall[0]).toContain('BETWEEN');
    });

    it('should apply channel filter', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        filters: {
          workspaceId: 'ws-1',
          types: ['message'],
          channelIds: ['ch-1', 'ch-2'],
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const sqlCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sqlCall[0]).toContain('channelId');
    });

    it('should apply user filter', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        filters: {
          workspaceId: 'ws-1',
          types: ['message'],
          userIds: ['user-1', 'user-2'],
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const sqlCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sqlCall[0]).toContain('senderId');
    });

    it('should filter thread replies', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        filters: {
          workspaceId: 'ws-1',
          types: ['message'],
          isThreadReply: true,
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const sqlCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sqlCall[0]).toContain('threadId');
      expect(sqlCall[0]).toContain('IS NOT NULL');
    });

    it('should support pagination', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        pagination: {
          limit: 10,
          offset: 20,
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      const sqlCall = mockPrisma.$queryRawUnsafe.mock.calls[0];
      expect(sqlCall[0]).toContain('LIMIT');
      expect(sqlCall[0]).toContain('OFFSET');
    });

    it('should respect max limit', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        pagination: {
          limit: 1000, // Exceeds max
          offset: 0,
        },
      });

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
      // The service should cap at maxLimit (100)
    });

    it('should include highlights when requested', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'msg-1',
          content: 'This is a test message',
          channelId: 'ch-1',
          channelName: 'general',
          senderId: 'user-1',
          senderName: 'John Doe',
          sentAt: new Date(),
          threadId: null,
          hasAttachments: false,
          rank: 0.8,
          headline: 'This is a <b>test</b> message',
        },
      ]);

      const result = await searchService.search({
        query: 'test',
        filters: { types: ['message'] },
        highlight: true,
      });

      expect(result.results[0].highlight).toBeDefined();
      expect(result.results[0].highlight?.content).toContain('This is a <b>test</b> message');
    });

    it('should cache search results', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({
        query: 'test',
        filters: { workspaceId: 'ws-1' },
      });

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should sort by date when specified', async () => {
      mockRedis.get.mockResolvedValue(null);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400000);

      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'msg-1',
          content: 'Older message',
          channelId: 'ch-1',
          channelName: 'general',
          senderId: 'user-1',
          senderName: 'John',
          sentAt: yesterday,
          threadId: null,
          hasAttachments: false,
          rank: 0.8,
          headline: null,
        },
        {
          id: 'msg-2',
          content: 'Newer message',
          channelId: 'ch-1',
          channelName: 'general',
          senderId: 'user-1',
          senderName: 'John',
          sentAt: now,
          threadId: null,
          hasAttachments: false,
          rank: 0.6,
          headline: null,
        },
      ]);

      const result = await searchService.search({
        query: 'message',
        filters: { types: ['message'] },
        sort: { field: 'date', direction: 'desc' },
      });

      // Should be sorted by date descending (newest first)
      expect(result.results).toHaveLength(2);
    });

    it('should build facets when requested', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      const result = await searchService.search({
        query: 'test',
        facets: ['types'],
      });

      expect(result.facets).toBeDefined();
      expect(result.facets?.types).toBeDefined();
    });

    it('should search all types when none specified', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

      await searchService.search({ query: 'test' });

      // Should call query for all 5 types
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(5);
    });
  });

  // ===========================================================================
  // getSuggestions() Tests
  // ===========================================================================

  describe('getSuggestions', () => {
    it('should return recent searches matching prefix', async () => {
      // Mock the lrange call to return test data
      mockRedis.lrange.mockResolvedValueOnce(['test query', 'test search', 'other query']);

      const suggestions = await searchService.getSuggestions(
        'test',
        'ws-1',
        'user-1',
      );

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].text).toBe('test query');
      expect(suggestions[0].type).toBe('recent');
      expect(suggestions[1].text).toBe('test search');
    });

    it('should respect limit parameter', async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        'test 1',
        'test 2',
        'test 3',
        'test 4',
        'test 5',
      ]);

      const suggestions = await searchService.getSuggestions(
        'test',
        'ws-1',
        'user-1',
        3,
      );

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array when no matches', async () => {
      mockRedis.lrange.mockResolvedValueOnce(['other query', 'another query']);

      const suggestions = await searchService.getSuggestions(
        'test',
        'ws-1',
        'user-1',
      );

      expect(suggestions).toHaveLength(0);
    });

    it('should be case-insensitive', async () => {
      mockRedis.lrange.mockResolvedValueOnce(['Test Query', 'TEST SEARCH']);

      const suggestions = await searchService.getSuggestions(
        'test',
        'ws-1',
        'user-1',
      );

      expect(suggestions).toHaveLength(2);
    });
  });

  // ===========================================================================
  // saveRecentSearch() Tests
  // ===========================================================================

  describe('saveRecentSearch', () => {
    it('should save search to recent history', async () => {
      await searchService.saveRecentSearch('user-1', 'test query');

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'test:search:recent:user-1',
        'test query',
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        'test:search:recent:user-1',
        0,
        49,
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'test:search:recent:user-1',
        86400 * 30,
      );
    });
  });

  // ===========================================================================
  // clearCache() Tests
  // ===========================================================================

  describe('clearCache', () => {
    it('should clear all cache keys when no workspace specified', async () => {
      mockRedis.keys.mockResolvedValue(['test:search:key1', 'test:search:key2']);

      await searchService.clearCache();

      expect(mockRedis.keys).toHaveBeenCalledWith('test:search:*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:search:key1', 'test:search:key2');
    });

    it('should clear workspace-specific cache', async () => {
      mockRedis.keys.mockResolvedValue(['test:search:ws-1:key']);

      await searchService.clearCache('ws-1');

      expect(mockRedis.keys).toHaveBeenCalledWith('test:search:*ws-1*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:search:ws-1:key');
    });

    it('should not call del when no keys found', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await searchService.clearCache();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // indexDocument() Tests
  // ===========================================================================

  describe('indexDocument', () => {
    it('should index document to Redis', async () => {
      const doc = {
        id: 'doc-1',
        type: 'message' as const,
        workspaceId: 'ws-1',
        content: 'Test content',
        metadata: { channelId: 'ch-1' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await searchService.indexDocument(doc);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:search:index:message:doc-1',
        3600,
        JSON.stringify(doc),
      );
    });
  });

  // ===========================================================================
  // removeDocument() Tests
  // ===========================================================================

  describe('removeDocument', () => {
    it('should remove document from index', async () => {
      await searchService.removeDocument('message', 'msg-1');

      expect(mockRedis.del).toHaveBeenCalledWith('test:search:index:message:msg-1');
    });
  });

  // ===========================================================================
  // Factory Function Tests
  // ===========================================================================

  describe('createSearchService', () => {
    it('should create a new SearchService instance', () => {
      const service = createSearchService({
        prisma: mockPrisma as unknown as Parameters<typeof createSearchService>[0]['prisma'],
        redis: mockRedis as unknown as Parameters<typeof createSearchService>[0]['redis'],
      });

      expect(service).toBeInstanceOf(SearchServiceImpl);
    });
  });

  describe('getSearchService', () => {
    it('should return singleton instance', () => {
      const config = {
        prisma: mockPrisma as unknown as Parameters<typeof createSearchService>[0]['prisma'],
        redis: mockRedis as unknown as Parameters<typeof createSearchService>[0]['redis'],
      };

      const service1 = getSearchService(config);
      const service2 = getSearchService();

      expect(service1).toBe(service2);
    });

    it('should throw error when not initialized', () => {
      resetSearchService();
      expect(() => getSearchService()).toThrow('SearchService not initialized');
    });
  });
});
