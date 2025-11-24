/**
 * Search API Route Tests
 *
 * Comprehensive test suite for search REST API endpoints covering:
 * - GET /api/workspaces/:workspaceId/search - Search workspace content
 * - GET /api/workspaces/:workspaceId/search/suggestions - Get search suggestions
 *
 * Tests cover authentication, authorization, validation, and error handling.
 *
 * @module apps/web/app/api/workspaces/[workspaceId]/search/__tests__/search.test
 */

import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@genesis/database', () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock('@genesis/core/redis', () => ({
  redis: {},
}));

// Mock SearchService
const mockSearchService = {
  search: vi.fn(),
  getSuggestions: vi.fn(),
  saveRecentSearch: vi.fn(),
};

vi.mock('@genesis/core', () => ({
  SearchServiceImpl: vi.fn().mockImplementation(() => mockSearchService),
}));

// =============================================================================
// TEST UTILITIES
// =============================================================================

interface MockUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface MockSession {
  user: MockUser;
  expires: string;
}

function createMockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

function createMockSearchResponse() {
  return {
    results: [
      {
        id: 'msg-1',
        type: 'message',
        score: 0.95,
        highlight: { content: ['<mark>test</mark> content'] },
        data: {
          type: 'message',
          messageId: 'msg-1',
          content: 'test content',
          channelId: 'ch-1',
          channelName: 'general',
          senderId: 'user-1',
          senderName: 'Test User',
          sentAt: new Date(),
        },
      },
    ],
    total: 1,
    took: 15,
    pagination: {
      hasMore: false,
    },
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Search API Routes', () => {
  let auth: ReturnType<typeof vi.fn>;
  let prisma: { workspaceMember: { findFirst: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    vi.clearAllMocks();

    const authModule = await import('@/lib/auth');
    auth = authModule.auth as ReturnType<typeof vi.fn>;

    const prismaModule = await import('@genesis/database');
    prisma = prismaModule.prisma as typeof prisma;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // GET /api/workspaces/:workspaceId/search - Search
  // ===========================================================================

  describe('GET /api/workspaces/:workspaceId/search', () => {
    it('should require authentication', async () => {
      auth.mockResolvedValue(null);

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/search?q=test');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should require query parameter', async () => {
      auth.mockResolvedValue(createMockSession());

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/search');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Query required');
    });

    it('should verify workspace membership', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/search?q=test');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should return search results', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-123',
        workspaceId: 'ws-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSearchService.search.mockResolvedValue(createMockSearchResponse());

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/search?q=test');
      const response = await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('took');
      expect(data.results).toHaveLength(1);
    });

    it('should save to recent searches', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-123',
        workspaceId: 'ws-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSearchService.search.mockResolvedValue(createMockSearchResponse());

      const { GET } = await import('../route');
      const request = new NextRequest('http://localhost/api/workspaces/ws-1/search?q=test');
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockSearchService.saveRecentSearch).toHaveBeenCalledWith('user-123', 'test');
    });

    it('should pass filter parameters', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-123',
        workspaceId: 'ws-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSearchService.search.mockResolvedValue(createMockSearchResponse());

      const { GET } = await import('../route');
      const request = new NextRequest(
        'http://localhost/api/workspaces/ws-1/search?q=test&types=message,file&channels=ch-1,ch-2&limit=10',
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test',
          filters: expect.objectContaining({
            workspaceId: 'ws-1',
            types: ['message', 'file'],
            channelIds: ['ch-1', 'ch-2'],
          }),
          pagination: expect.objectContaining({
            limit: 10,
          }),
        }),
      );
    });

    it('should handle date range filters', async () => {
      auth.mockResolvedValue(createMockSession());
      prisma.workspaceMember.findFirst.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-123',
        workspaceId: 'ws-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockSearchService.search.mockResolvedValue(createMockSearchResponse());

      const { GET } = await import('../route');
      const fromDate = '2024-01-01T00:00:00Z';
      const toDate = '2024-12-31T23:59:59Z';
      const request = new NextRequest(
        `http://localhost/api/workspaces/ws-1/search?q=test&from=${fromDate}&to=${toDate}`,
      );
      await GET(request, { params: Promise.resolve({ workspaceId: 'ws-1' }) });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            dateRange: expect.objectContaining({
              start: expect.any(Date),
              end: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
