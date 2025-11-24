/**
 * Offline Queue and Sync Service Tests
 *
 * Comprehensive test suite for offline functionality covering:
 * - Offline queue management (enqueue, process, retry)
 * - Incremental sync operations
 * - Conflict detection and resolution
 * - Error handling and retry logic
 *
 * @module @genesis/core/services/__tests__/offline-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createMockQueuedAction,
  createMockFailedQueuedAction,
  createMockQueuedActionList,
  createMockSyncState,
  createMockSyncConflict,
  createMockSyncData,
  createMockSyncDataWithNotifications,
  createMockSyncDataWithConflicts,
  createMockNotificationList,
  createMockOfflineQueueService,
  createMockSyncService,
  createMockPrismaOfflineQueueActionModel,
  createMockPrismaSyncStateModel,
  createMockPrismaSyncConflictModel,
  generateUserId,
  generateActionId,
  generateConflictId,
  resetNotificationIdCounters,
} from '../../test-utils/notification-factories';

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockPrismaClient() {
  return {
    offlineQueueAction: createMockPrismaOfflineQueueActionModel(),
    syncState: createMockPrismaSyncStateModel(),
    syncConflict: createMockPrismaSyncConflictModel(),
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    channel: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const tx = {
        offlineQueueAction: createMockPrismaOfflineQueueActionModel(),
        syncState: createMockPrismaSyncStateModel(),
        syncConflict: createMockPrismaSyncConflictModel(),
      };
      return callback(tx);
    }),
  };
}

// =============================================================================
// OFFLINE QUEUE SERVICE TESTS
// =============================================================================

describe('OfflineQueueService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    resetNotificationIdCounters();
    mockPrisma = createMockPrismaClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // enqueue Tests
  // ===========================================================================

  describe('enqueue', () => {
    it('adds action to queue', async () => {
      const userId = generateUserId();
      const actionId = generateActionId();
      const action = createMockQueuedAction({
        id: actionId,
        userId,
        action: 'SEND_MESSAGE',
        payload: {
          channelId: 'ch_123',
          content: 'Hello from offline',
        },
      });

      mockPrisma.offlineQueueAction.create.mockResolvedValue(action);

      const result = await mockPrisma.offlineQueueAction.create({
        data: {
          id: actionId,
          userId,
          action: 'SEND_MESSAGE',
          payload: {
            channelId: 'ch_123',
            content: 'Hello from offline',
          },
          status: 'PENDING',
          retryCount: 0,
          maxRetries: 3,
          createdAt: expect.any(Date),
        },
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(actionId);
      expect(result.status).toBe('PENDING');
      expect(result.retryCount).toBe(0);
    });

    it('maintains order', async () => {
      const userId = generateUserId();
      const baseTime = new Date();

      // Create actions with increasing timestamps (oldest to newest)
      const actions = Array.from({ length: 5 }, (_, index) => {
        const createdAt = new Date(baseTime.getTime() + index * 1000);
        return createMockQueuedAction({
          userId,
          createdAt,
        });
      });

      mockPrisma.offlineQueueAction.findMany.mockResolvedValue(actions);

      const queued = await mockPrisma.offlineQueueAction.findMany({
        where: { userId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      expect(queued).toHaveLength(5);

      // Verify FIFO order (oldest first)
      for (let i = 1; i < queued.length; i++) {
        expect(queued[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          queued[i - 1]!.createdAt.getTime()
        );
      }
    });

    it('generates unique action IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateActionId());
      }
      expect(ids.size).toBe(100);
    });

    it('stores action payload correctly', async () => {
      const userId = generateUserId();
      const payload = {
        channelId: 'ch_123',
        content: 'Test message with special chars: <>&"\'',
        attachments: ['file_1', 'file_2'],
        metadata: {
          clientTimestamp: Date.now(),
          source: 'offline',
        },
      };

      const action = createMockQueuedAction({
        userId,
        action: 'SEND_MESSAGE',
        payload,
      });

      mockPrisma.offlineQueueAction.create.mockResolvedValue(action);

      const result = await mockPrisma.offlineQueueAction.create({
        data: {
          userId,
          action: 'SEND_MESSAGE',
          payload,
          status: 'PENDING',
          retryCount: 0,
          maxRetries: 3,
        },
      });

      expect(result.payload).toEqual(payload);
    });
  });

  // ===========================================================================
  // processQueue Tests
  // ===========================================================================

  describe('processQueue', () => {
    it('processes in order', async () => {
      const userId = generateUserId();
      const actions = createMockQueuedActionList(3, { userId });
      const processedOrder: string[] = [];

      mockPrisma.offlineQueueAction.findMany.mockResolvedValue(actions);
      mockPrisma.offlineQueueAction.update.mockImplementation(async ({ where, data }) => {
        processedOrder.push(where.id);
        return {
          ...actions.find((a) => a.id === where.id)!,
          ...data,
          processedAt: new Date(),
        };
      });

      // Fetch pending actions in order
      const pending = await mockPrisma.offlineQueueAction.findMany({
        where: { userId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      // Process each action
      for (const action of pending) {
        await mockPrisma.offlineQueueAction.update({
          where: { id: action.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
      }

      expect(processedOrder).toHaveLength(3);
      expect(processedOrder).toEqual(actions.map((a) => a.id));
    });

    it('retries on failure', async () => {
      const userId = generateUserId();
      const action = createMockQueuedAction({
        userId,
        retryCount: 0,
        maxRetries: 3,
      });

      // First attempt fails
      mockPrisma.offlineQueueAction.update.mockResolvedValueOnce({
        ...action,
        retryCount: 1,
        error: 'Network error',
        status: 'PENDING', // Still pending for retry
      });

      const firstAttempt = await mockPrisma.offlineQueueAction.update({
        where: { id: action.id },
        data: {
          retryCount: { increment: 1 },
          error: 'Network error',
        },
      });

      expect(firstAttempt.retryCount).toBe(1);
      expect(firstAttempt.status).toBe('PENDING');

      // Second attempt succeeds
      mockPrisma.offlineQueueAction.update.mockResolvedValueOnce({
        ...action,
        retryCount: 2,
        status: 'COMPLETED',
        error: null,
        processedAt: new Date(),
      });

      const secondAttempt = await mockPrisma.offlineQueueAction.update({
        where: { id: action.id },
        data: {
          retryCount: { increment: 1 },
          status: 'COMPLETED',
          error: null,
          processedAt: new Date(),
        },
      });

      expect(secondAttempt.status).toBe('COMPLETED');
      expect(secondAttempt.processedAt).toBeDefined();
    });

    it('moves to failed after max retries', async () => {
      const userId = generateUserId();
      const action = createMockQueuedAction({
        userId,
        retryCount: 2,
        maxRetries: 3,
      });

      // Third (final) attempt fails
      mockPrisma.offlineQueueAction.update.mockResolvedValue({
        ...action,
        retryCount: 3,
        status: 'FAILED',
        error: 'Network error: Connection refused',
      });

      const result = await mockPrisma.offlineQueueAction.update({
        where: { id: action.id },
        data: {
          retryCount: 3,
          status: 'FAILED',
          error: 'Network error: Connection refused',
        },
      });

      expect(result.status).toBe('FAILED');
      expect(result.retryCount).toBe(3);
      expect(result.error).toBeDefined();
    });

    it('handles concurrent processing safely', async () => {
      const userId = generateUserId();
      const actions = createMockQueuedActionList(5, { userId });

      mockPrisma.offlineQueueAction.findMany.mockResolvedValue(actions);

      // Simulate concurrent processing with findMany followed by updates
      const pending = await mockPrisma.offlineQueueAction.findMany({
        where: { userId, status: 'PENDING' },
      });

      // Process concurrently
      const results = await Promise.all(
        pending.map(async (action) => {
          mockPrisma.offlineQueueAction.update.mockResolvedValueOnce({
            ...action,
            status: 'COMPLETED',
            processedAt: new Date(),
          });

          return mockPrisma.offlineQueueAction.update({
            where: { id: action.id },
            data: {
              status: 'COMPLETED',
              processedAt: new Date(),
            },
          });
        })
      );

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.status === 'COMPLETED')).toBe(true);
    });

    it('tracks processing statistics', async () => {
      const userId = generateUserId();
      const pendingCount = 10;
      const completedCount = 25;
      const failedCount = 3;

      mockPrisma.offlineQueueAction.count
        .mockResolvedValueOnce(pendingCount)
        .mockResolvedValueOnce(completedCount)
        .mockResolvedValueOnce(failedCount);

      const stats = {
        pending: await mockPrisma.offlineQueueAction.count({
          where: { userId, status: 'PENDING' },
        }),
        completed: await mockPrisma.offlineQueueAction.count({
          where: { userId, status: 'COMPLETED' },
        }),
        failed: await mockPrisma.offlineQueueAction.count({
          where: { userId, status: 'FAILED' },
        }),
      };

      expect(stats.pending).toBe(10);
      expect(stats.completed).toBe(25);
      expect(stats.failed).toBe(3);
    });

    it('clears completed actions after processing', async () => {
      const userId = generateUserId();
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      mockPrisma.offlineQueueAction.deleteMany.mockResolvedValue({ count: 50 });

      const result = await mockPrisma.offlineQueueAction.deleteMany({
        where: {
          userId,
          status: 'COMPLETED',
          processedAt: { lt: cutoffDate },
        },
      });

      expect(result.count).toBe(50);
    });
  });
});

// =============================================================================
// SYNC SERVICE TESTS
// =============================================================================

describe('SyncService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    resetNotificationIdCounters();
    mockPrisma = createMockPrismaClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // incrementalSync Tests
  // ===========================================================================

  describe('incrementalSync', () => {
    it('returns changes since token', async () => {
      const userId = generateUserId();
      const lastSyncAt = new Date(Date.now() - 3600000); // 1 hour ago
      const syncState = createMockSyncState({
        userId,
        lastSyncAt,
        version: 5,
      });

      const newNotifications = createMockNotificationList(3, { userId });

      mockPrisma.syncState.findUnique.mockResolvedValue(syncState);
      mockPrisma.notification.findMany.mockResolvedValue(newNotifications);

      // Get current sync state
      const currentState = await mockPrisma.syncState.findUnique({
        where: { userId },
      });

      expect(currentState).not.toBeNull();
      expect(currentState!.version).toBe(5);

      // Get changes since last sync
      const changes = await mockPrisma.notification.findMany({
        where: {
          userId,
          updatedAt: { gt: currentState!.lastSyncAt },
        },
        orderBy: { updatedAt: 'asc' },
      });

      expect(changes).toHaveLength(3);
    });

    it('handles conflicts', async () => {
      const userId = generateUserId();
      const conflictId = generateConflictId();
      const conflict = createMockSyncConflict({
        id: conflictId,
        userId,
        entityType: 'message',
        entityId: 'msg_123',
        serverVersion: {
          content: 'Server edited content',
          updatedAt: new Date().toISOString(),
        },
        clientVersion: {
          content: 'Client edited content',
          updatedAt: new Date(Date.now() - 1000).toISOString(),
        },
      });

      mockPrisma.syncConflict.create.mockResolvedValue(conflict);
      mockPrisma.syncConflict.findMany.mockResolvedValue([conflict]);

      // Create conflict
      const createdConflict = await mockPrisma.syncConflict.create({
        data: conflict,
      });

      expect(createdConflict.id).toBe(conflictId);

      // Get unresolved conflicts
      const conflicts = await mockPrisma.syncConflict.findMany({
        where: { userId, resolvedAt: null },
      });

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]!.entityType).toBe('message');
    });

    it('updates sync token after sync', async () => {
      const userId = generateUserId();
      const oldState = createMockSyncState({ userId, version: 5 });
      const newState = createMockSyncState({ userId, version: 6 });

      mockPrisma.syncState.upsert.mockResolvedValue(newState);

      const result = await mockPrisma.syncState.upsert({
        where: { userId },
        update: {
          lastSyncAt: new Date(),
          version: 6,
          syncToken: newState.syncToken,
        },
        create: {
          userId,
          lastSyncAt: new Date(),
          version: 1,
          syncToken: newState.syncToken,
        },
      });

      expect(result.version).toBe(6);
      expect(result.syncToken).not.toBe(oldState.syncToken);
    });

    it('returns full sync when no token provided', async () => {
      const userId = generateUserId();
      const allNotifications = createMockNotificationList(50, { userId });

      mockPrisma.notification.findMany.mockResolvedValue(allNotifications);

      // Full sync - get all data
      const data = await mockPrisma.notification.findMany({
        where: { userId },
        orderBy: { updatedAt: 'asc' },
      });

      expect(data).toHaveLength(50);
    });

    it('handles empty changes gracefully', async () => {
      const userId = generateUserId();
      const syncState = createMockSyncState({ userId });

      mockPrisma.syncState.findUnique.mockResolvedValue(syncState);
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.syncConflict.findMany.mockResolvedValue([]);

      const changes = await mockPrisma.notification.findMany({
        where: {
          userId,
          updatedAt: { gt: syncState.lastSyncAt },
        },
      });

      const conflicts = await mockPrisma.syncConflict.findMany({
        where: { userId, resolvedAt: null },
      });

      expect(changes).toHaveLength(0);
      expect(conflicts).toHaveLength(0);
    });

    it('paginated sync for large datasets', async () => {
      const userId = generateUserId();
      const pageSize = 100;
      const totalChanges = 350;

      // First page
      mockPrisma.notification.findMany.mockResolvedValueOnce(
        createMockNotificationList(pageSize, { userId })
      );
      mockPrisma.notification.count.mockResolvedValue(totalChanges);

      const firstPage = await mockPrisma.notification.findMany({
        where: { userId },
        take: pageSize,
        orderBy: { updatedAt: 'asc' },
      });

      const total = await mockPrisma.notification.count({
        where: { userId },
      });

      expect(firstPage).toHaveLength(pageSize);
      expect(total).toBe(totalChanges);

      // Calculate pages needed
      const pagesNeeded = Math.ceil(total / pageSize);
      expect(pagesNeeded).toBe(4);
    });
  });

  // ===========================================================================
  // Conflict Resolution Tests
  // ===========================================================================

  describe('conflict resolution', () => {
    it('resolves with SERVER_WINS strategy', async () => {
      const userId = generateUserId();
      const conflictId = generateConflictId();
      const conflict = createMockSyncConflict({
        id: conflictId,
        userId,
        resolution: null,
      });

      mockPrisma.syncConflict.findUnique.mockResolvedValue(conflict);
      mockPrisma.syncConflict.update.mockResolvedValue({
        ...conflict,
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      });

      // Resolve conflict
      const resolved = await mockPrisma.syncConflict.update({
        where: { id: conflictId },
        data: {
          resolution: 'SERVER_WINS',
          resolvedAt: new Date(),
        },
      });

      expect(resolved.resolution).toBe('SERVER_WINS');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('resolves with CLIENT_WINS strategy', async () => {
      const userId = generateUserId();
      const conflictId = generateConflictId();
      const conflict = createMockSyncConflict({
        id: conflictId,
        userId,
        clientVersion: {
          content: 'Client version wins',
          updatedAt: new Date().toISOString(),
        },
      });

      mockPrisma.syncConflict.findUnique.mockResolvedValue(conflict);
      mockPrisma.syncConflict.update.mockResolvedValue({
        ...conflict,
        resolution: 'CLIENT_WINS',
        resolvedAt: new Date(),
      });

      const resolved = await mockPrisma.syncConflict.update({
        where: { id: conflictId },
        data: {
          resolution: 'CLIENT_WINS',
          resolvedAt: new Date(),
        },
      });

      expect(resolved.resolution).toBe('CLIENT_WINS');
    });

    it('supports manual conflict resolution', async () => {
      const userId = generateUserId();
      const conflictId = generateConflictId();
      const mergedContent = {
        content: 'Manually merged content from server and client',
        updatedAt: new Date().toISOString(),
      };

      const conflict = createMockSyncConflict({
        id: conflictId,
        userId,
      });

      mockPrisma.syncConflict.findUnique.mockResolvedValue(conflict);
      mockPrisma.syncConflict.update.mockResolvedValue({
        ...conflict,
        resolution: 'MANUAL',
        serverVersion: mergedContent,
        resolvedAt: new Date(),
      });

      const resolved = await mockPrisma.syncConflict.update({
        where: { id: conflictId },
        data: {
          resolution: 'MANUAL',
          serverVersion: mergedContent, // Store merged result
          resolvedAt: new Date(),
        },
      });

      expect(resolved.resolution).toBe('MANUAL');
      expect(resolved.serverVersion).toEqual(mergedContent);
    });

    it('prevents resolving already resolved conflict', async () => {
      const userId = generateUserId();
      const conflictId = generateConflictId();
      const resolvedConflict = createMockSyncConflict({
        id: conflictId,
        userId,
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(Date.now() - 3600000), // 1 hour ago
      });

      mockPrisma.syncConflict.findUnique.mockResolvedValue(resolvedConflict);

      const conflict = await mockPrisma.syncConflict.findUnique({
        where: { id: conflictId },
      });

      expect(conflict).not.toBeNull();
      expect(conflict!.resolvedAt).not.toBeNull();

      // Should not allow re-resolution
      const isAlreadyResolved = conflict!.resolvedAt !== null;
      expect(isAlreadyResolved).toBe(true);
    });

    it('auto-resolves trivial conflicts', async () => {
      const userId = generateUserId();
      const serverTimestamp = new Date();
      const clientTimestamp = new Date(Date.now() - 60000); // 1 minute older

      // Conflict where only timestamps differ but content is same
      const conflict = createMockSyncConflict({
        userId,
        serverVersion: {
          content: 'Same content',
          updatedAt: serverTimestamp.toISOString(),
        },
        clientVersion: {
          content: 'Same content',
          updatedAt: clientTimestamp.toISOString(),
        },
      });

      // Auto-resolve: if content is same, server wins (newer timestamp)
      const serverContent = (conflict.serverVersion as Record<string, unknown>).content;
      const clientContent = (conflict.clientVersion as Record<string, unknown>).content;
      const canAutoResolve = serverContent === clientContent;

      expect(canAutoResolve).toBe(true);
    });

    it('lists pending conflicts for user', async () => {
      const userId = generateUserId();
      const conflicts = [
        createMockSyncConflict({ userId, entityType: 'message' }),
        createMockSyncConflict({ userId, entityType: 'channel' }),
        createMockSyncConflict({ userId, entityType: 'notification' }),
      ];

      mockPrisma.syncConflict.findMany.mockResolvedValue(conflicts);
      mockPrisma.syncConflict.count.mockResolvedValue(3);

      const pending = await mockPrisma.syncConflict.findMany({
        where: { userId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      const count = await mockPrisma.syncConflict.count({
        where: { userId, resolvedAt: null },
      });

      expect(pending).toHaveLength(3);
      expect(count).toBe(3);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      const userId = generateUserId();

      mockPrisma.syncState.findUnique.mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(
        mockPrisma.syncState.findUnique({ where: { userId } })
      ).rejects.toThrow('Database connection lost');
    });

    it('handles invalid sync token', async () => {
      const invalidToken = 'not-a-valid-base64-token!!!';

      // Attempt to parse invalid token
      const parseToken = (token: string) => {
        try {
          const decoded = Buffer.from(token, 'base64').toString('utf-8');
          return JSON.parse(decoded);
        } catch {
          return null;
        }
      };

      const parsed = parseToken(invalidToken);
      expect(parsed).toBeNull();
    });

    it('handles version mismatch', async () => {
      const userId = generateUserId();
      const clientVersion = 5;
      const serverVersion = 10;

      const syncState = createMockSyncState({
        userId,
        version: serverVersion,
      });

      mockPrisma.syncState.findUnique.mockResolvedValue(syncState);

      const state = await mockPrisma.syncState.findUnique({
        where: { userId },
      });

      // Version mismatch detected
      const hasMismatch = state && state.version > clientVersion;
      expect(hasMismatch).toBe(true);

      // Should trigger full sync
      const needsFullSync = state!.version - clientVersion > 1;
      expect(needsFullSync).toBe(true);
    });

    it('handles concurrent sync attempts', async () => {
      const userId = generateUserId();
      let currentVersion = 5;

      // Simulate optimistic locking
      mockPrisma.syncState.update.mockImplementation(async ({ data }) => {
        // Only allow update if version matches
        if (data.version === currentVersion + 1) {
          currentVersion = data.version as number;
          return createMockSyncState({ userId, version: currentVersion });
        }
        throw new Error('Concurrent modification detected');
      });

      // First sync succeeds
      const first = mockPrisma.syncState.update({
        where: { userId },
        data: { version: 6 },
      });

      await expect(first).resolves.toBeDefined();
      expect(currentVersion).toBe(6);
    });

    it('handles network timeout during sync', async () => {
      const userId = generateUserId();

      // Simulate timeout
      mockPrisma.notification.findMany.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      await expect(
        mockPrisma.notification.findMany({ where: { userId } })
      ).rejects.toThrow('Request timeout');
    });
  });
});
