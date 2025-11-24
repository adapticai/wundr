/**
 * @fileoverview Tests for AuditService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AuditServiceImpl } from '../audit-service';
import type {
  AuditDatabaseClient,
  AuditRedisClient,
} from '../audit-service';

// =============================================================================
// MOCK FACTORIES
// =============================================================================

function createMockPrisma(): AuditDatabaseClient {
  return {
    auditLog: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLogExport: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
}

function createMockRedis(): AuditRedisClient {
  return {
    publish: vi.fn().mockResolvedValue(1),
    lpush: vi.fn().mockResolvedValue(1),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe('AuditService', () => {
  let auditService: AuditServiceImpl;
  let mockPrisma: AuditDatabaseClient;
  let mockRedis: AuditRedisClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();

    auditService = new AuditServiceImpl({
      prisma: mockPrisma,
      redis: mockRedis,
      batchSize: 10,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('log', () => {
    it('should queue audit entries for batch processing', async () => {
      await auditService.log({
        action: 'user.login',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John Doe',
        resourceType: 'session',
        resourceId: 'session-1',
        workspaceId: 'ws-1',
      });

      // Entry should be queued, not written yet
      expect(mockPrisma.auditLog.createMany).not.toHaveBeenCalled();
    });

    it('should flush batch when size limit reached', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 10 });

      // Add 10 entries (batch size)
      for (let i = 0; i < 10; i++) {
        await auditService.log({
          action: 'user.login',
          actorId: `user-${i}`,
          actorType: 'user',
          actorName: `User ${i}`,
          resourceType: 'session',
          resourceId: `session-${i}`,
          workspaceId: 'ws-1',
        });
      }

      expect(mockPrisma.auditLog.createMany).toHaveBeenCalled();
    });

    it('should publish critical events', async () => {
      await auditService.log({
        action: 'user.deleted',
        actorId: 'admin-1',
        actorType: 'user',
        actorName: 'Admin',
        resourceType: 'user',
        resourceId: 'user-1',
        workspaceId: 'ws-1',
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'audit:critical:ws-1',
        expect.any(String)
      );
    });

    it('should include context information', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await auditService.log({
        action: 'user.login',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'session',
        resourceId: 'session-1',
        workspaceId: 'ws-1',
        context: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          sessionId: 'sess-123',
        },
      });

      await auditService.flush();

      const createCall = (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data[0].ipAddress).toBe('192.168.1.1');
      expect(createCall.data[0].userAgent).toBe('Mozilla/5.0');
    });

    it('should correctly categorize actions', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await auditService.log({
        action: 'user.login',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'session',
        resourceId: 'session-1',
        workspaceId: 'ws-1',
      });

      await auditService.flush();

      const createCall = (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data[0].category).toBe('authentication');
    });

    it('should correctly assign severity levels', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      // Info level
      await auditService.log({
        action: 'message.created',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'message',
        resourceId: 'msg-1',
        workspaceId: 'ws-1',
      });

      // Warning level
      await auditService.log({
        action: 'channel.deleted',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'channel',
        resourceId: 'ch-1',
        workspaceId: 'ws-1',
      });

      // Critical level
      await auditService.log({
        action: 'permission.granted',
        actorId: 'admin-1',
        actorType: 'user',
        actorName: 'Admin',
        resourceType: 'permission',
        resourceId: 'perm-1',
        workspaceId: 'ws-1',
      });

      await auditService.flush();

      const createCall = (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data[0].severity).toBe('info');
      expect(createCall.data[1].severity).toBe('warning');
      expect(createCall.data[2].severity).toBe('critical');
    });

    it('should handle changes tracking', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await auditService.log({
        action: 'user.updated',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'user',
        resourceId: 'user-2',
        workspaceId: 'ws-1',
        changes: [
          { field: 'name', oldValue: 'Old Name', newValue: 'New Name' },
          { field: 'email', oldValue: 'old@test.com', newValue: 'new@test.com' },
        ],
      });

      await auditService.flush();

      const createCall = (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const changes = JSON.parse(createCall.data[0].changes);
      expect(changes).toHaveLength(2);
      expect(changes[0].field).toBe('name');
    });
  });

  describe('query', () => {
    it('should query with filters', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await auditService.query({
        workspaceId: 'ws-1',
        actions: ['user.login', 'user.logout'],
        severities: ['critical'],
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);

      const result = await auditService.query(
        { workspaceId: 'ws-1' },
        { limit: 10, offset: 20 }
      );

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBe('30');
    });

    it('should support search', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await auditService.query({
        workspaceId: 'ws-1',
        search: 'john',
      });

      const whereClause = (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      expect(whereClause.OR).toBeDefined();
    });

    it('should filter by actor types', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await auditService.query({
        workspaceId: 'ws-1',
        actorTypes: ['user', 'vp'],
      });

      const whereClause = (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      expect(whereClause.actorType).toEqual({ in: ['user', 'vp'] });
    });

    it('should filter by resource types', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await auditService.query({
        workspaceId: 'ws-1',
        resourceTypes: ['message', 'channel'],
      });

      const whereClause = (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where;
      expect(whereClause.resourceType).toEqual({ in: ['message', 'channel'] });
    });

    it('should support sorting', async () => {
      (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      await auditService.query(
        { workspaceId: 'ws-1' },
        undefined,
        { field: 'severity', direction: 'asc' }
      );

      const orderBy = (mockPrisma.auditLog.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ severity: 'asc' });
    });
  });

  describe('getStats', () => {
    it('should return aggregated statistics', async () => {
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (mockPrisma.auditLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const stats = await auditService.getStats('ws-1');

      expect(stats.totalEntries).toBe(100);
      expect(mockPrisma.auditLog.groupBy).toHaveBeenCalledTimes(4);
    });

    it('should accept date range', async () => {
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(50);
      (mockPrisma.auditLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-06-30'),
      };

      await auditService.getStats('ws-1', dateRange);

      const countCall = (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(countCall.where.timestamp).toBeDefined();
    });

    it('should include timeline data', async () => {
      (mockPrisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(100);
      (mockPrisma.auditLog.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (mockPrisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
        { date: '2024-01-01', count: BigInt(10) },
        { date: '2024-01-02', count: BigInt(15) },
      ]);

      const stats = await auditService.getStats('ws-1');

      expect(stats.timeline).toHaveLength(2);
      expect(stats.timeline[0].count).toBe(10);
    });
  });

  describe('requestExport', () => {
    it('should create export record and queue job', async () => {
      (mockPrisma.auditLogExport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'export-1',
        workspaceId: 'ws-1',
        requestedBy: 'user-1',
        filter: '{}',
        format: 'csv',
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(),
      });
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const result = await auditService.requestExport(
        'ws-1',
        'user-1',
        { workspaceId: 'ws-1' },
        'csv'
      );

      expect(result.status).toBe('pending');
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'audit:export:queue',
        'export-1'
      );
    });

    it('should support different export formats', async () => {
      (mockPrisma.auditLogExport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'export-2',
        workspaceId: 'ws-1',
        requestedBy: 'user-1',
        filter: '{}',
        format: 'pdf',
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(),
      });
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      const result = await auditService.requestExport(
        'ws-1',
        'user-1',
        { workspaceId: 'ws-1' },
        'pdf'
      );

      expect(result.format).toBe('pdf');
    });
  });

  describe('getExport', () => {
    it('should return export status', async () => {
      (mockPrisma.auditLogExport.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'export-1',
        workspaceId: 'ws-1',
        requestedBy: 'user-1',
        filter: '{"workspaceId":"ws-1"}',
        format: 'csv',
        status: 'completed',
        fileUrl: 'https://example.com/export.csv',
        fileSize: 1024,
        entryCount: 100,
        createdAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(),
        error: null,
      });

      const result = await auditService.getExport('export-1');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('completed');
      expect(result?.fileUrl).toBe('https://example.com/export.csv');
    });

    it('should return null for non-existent export', async () => {
      (mockPrisma.auditLogExport.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await auditService.getExport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should delete old entries based on retention', async () => {
      (mockPrisma.auditLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 500 });

      const count = await auditService.cleanup();

      expect(count).toBe(500);
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalled();
    });

    it('should use retention days from config', async () => {
      (mockPrisma.auditLog.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });

      await auditService.cleanup();

      const deleteCall = (mockPrisma.auditLog.deleteMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(deleteCall.where.timestamp.lt).toBeInstanceOf(Date);
    });
  });

  describe('flush', () => {
    it('should force flush pending entries', async () => {
      (mockPrisma.auditLog.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

      // Add some entries
      await auditService.log({
        action: 'user.login',
        actorId: 'user-1',
        actorType: 'user',
        actorName: 'John',
        resourceType: 'session',
        resourceId: 'session-1',
        workspaceId: 'ws-1',
      });
      await auditService.log({
        action: 'user.login',
        actorId: 'user-2',
        actorType: 'user',
        actorName: 'Jane',
        resourceType: 'session',
        resourceId: 'session-2',
        workspaceId: 'ws-1',
      });

      // Entries should not be written yet
      expect(mockPrisma.auditLog.createMany).not.toHaveBeenCalled();

      // Force flush
      await auditService.flush();

      // Now they should be written
      expect(mockPrisma.auditLog.createMany).toHaveBeenCalled();
    });

    it('should handle empty queue', async () => {
      await auditService.flush();

      expect(mockPrisma.auditLog.createMany).not.toHaveBeenCalled();
    });
  });
});
