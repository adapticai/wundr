/**
 * Search API Route Tests
 *
 * Tests for the workspace search functionality.
 *
 * @module app/api/workspaces/[workspaceId]/search/__tests__/route
 */

import { prisma } from '@neolith/database';
import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth';

import { GET } from '../route';

// Mock dependencies
jest.mock('@neolith/database', () => ({
  prisma: {
    workspaceMember: {
      findUnique: jest.fn(),
    },
    channelMember: {
      findMany: jest.fn(),
    },
    channel: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

describe('GET /api/workspaces/:workspaceId/search', () => {
  const mockSession = {
    user: {
      id: 'user_123',
      email: 'test@example.com',
      name: 'Test User',
      isVP: false,
    },
  };

  const workspaceId = 'ws_abc123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 if query parameter is missing', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Search query (q) is required');
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 404 if user is not a workspace member', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Workspace not found or access denied');
    expect(data.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('should search messages successfully', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'wm_123',
      workspaceId,
      userId: mockSession.user.id,
    });
    (prisma.channelMember.findMany as jest.Mock).mockResolvedValue([
      { channelId: 'ch_1' },
      { channelId: 'ch_2' },
    ]);
    (prisma.channel.findMany as jest.Mock).mockResolvedValue([
      { id: 'ch_1', type: 'PUBLIC' },
      { id: 'ch_3', type: 'PUBLIC' },
    ]);

    const mockMessages = [
      {
        id: 'msg_1',
        content: 'This is a test message',
        channelId: 'ch_1',
        authorId: 'user_123',
        createdAt: new Date('2024-11-26T10:00:00Z'),
        isEdited: false,
        isDeleted: false,
        author: {
          id: 'user_123',
          name: 'Test User',
          avatarUrl: null,
          isVP: false,
        },
        channel: {
          id: 'ch_1',
          name: 'general',
        },
        _count: {
          replies: 0,
        },
      },
    ];

    (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
    (prisma.message.count as jest.Mock).mockResolvedValue(1);
    (prisma.channel.count as jest.Mock).mockResolvedValue(0);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.file.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test&type=messages`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].type).toBe('message');
    expect(data.data[0].content).toBe('This is a test message');
    expect(data.pagination.totalCount).toBe(1);
    expect(data.pagination.hasMore).toBe(false);
  });

  it('should include highlighting when enabled', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'wm_123',
      workspaceId,
      userId: mockSession.user.id,
    });
    (prisma.channelMember.findMany as jest.Mock).mockResolvedValue([
      { channelId: 'ch_1' },
    ]);
    (prisma.channel.findMany as jest.Mock).mockResolvedValue([
      { id: 'ch_1', type: 'PUBLIC' },
    ]);

    const mockMessages = [
      {
        id: 'msg_1',
        content: 'Testing the search functionality',
        channelId: 'ch_1',
        authorId: 'user_123',
        createdAt: new Date('2024-11-26T10:00:00Z'),
        isEdited: false,
        isDeleted: false,
        author: {
          id: 'user_123',
          name: 'Test User',
          avatarUrl: null,
          isVP: false,
        },
        channel: {
          id: 'ch_1',
          name: 'general',
        },
        _count: {
          replies: 0,
        },
      },
    ];

    (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);
    (prisma.message.count as jest.Mock).mockResolvedValue(1);
    (prisma.channel.count as jest.Mock).mockResolvedValue(0);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.file.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=search&type=messages&highlight=true`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data[0].highlighted).toBeDefined();
    expect(data.data[0].highlighted.content).toContain('<mark>');
  });

  it('should validate search type parameter', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test&type=invalid`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid search type');
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should respect pagination parameters', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'wm_123',
      workspaceId,
      userId: mockSession.user.id,
    });
    (prisma.channelMember.findMany as jest.Mock).mockResolvedValue([
      { channelId: 'ch_1' },
    ]);
    (prisma.channel.findMany as jest.Mock).mockResolvedValue([
      { id: 'ch_1', type: 'PUBLIC' },
    ]);

    const mockMessages = Array.from({ length: 10 }, (_, i) => ({
      id: `msg_${i}`,
      content: `Test message ${i}`,
      channelId: 'ch_1',
      authorId: 'user_123',
      createdAt: new Date(`2024-11-26T10:${i}:00Z`),
      isEdited: false,
      isDeleted: false,
      author: {
        id: 'user_123',
        name: 'Test User',
        avatarUrl: null,
        isVP: false,
      },
      channel: {
        id: 'ch_1',
        name: 'general',
      },
      _count: {
        replies: 0,
      },
    }));

    (prisma.message.findMany as jest.Mock).mockResolvedValue(
      mockMessages.slice(0, 5),
    );
    (prisma.message.count as jest.Mock).mockResolvedValue(100);
    (prisma.channel.count as jest.Mock).mockResolvedValue(0);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.file.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test&type=messages&limit=5&offset=0`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(5);
    expect(data.pagination.limit).toBe(5);
    expect(data.pagination.offset).toBe(0);
    expect(data.pagination.hasMore).toBe(true);
  });

  it('should filter by channelId when provided', async () => {
    (auth as jest.Mock).mockResolvedValue(mockSession);
    (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue({
      id: 'wm_123',
      workspaceId,
      userId: mockSession.user.id,
    });
    (prisma.channelMember.findMany as jest.Mock).mockResolvedValue([
      { channelId: 'ch_1' },
      { channelId: 'ch_2' },
    ]);
    (prisma.channel.findMany as jest.Mock).mockResolvedValue([
      { id: 'ch_1', type: 'PUBLIC' },
    ]);

    (prisma.message.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.message.count as jest.Mock).mockResolvedValue(0);
    (prisma.channel.count as jest.Mock).mockResolvedValue(0);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.file.count as jest.Mock).mockResolvedValue(0);

    const request = new NextRequest(
      `http://localhost:3000/api/workspaces/${workspaceId}/search?q=test&channelId=ch_1`,
    );
    const context = { params: Promise.resolve({ workspaceId }) };

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channelId: 'ch_1',
        }),
      }),
    );
  });
});
