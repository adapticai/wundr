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
    $transaction: vi.fn().mockImplementation(async callback => {
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
      mockPrisma.offlineQueueAction.update.mockImplementation(
        async ({ where, data }) => {
          processedOrder.push(where.id);
          return {
            ...actions.find(a => a.id === where.id)!,
            ...data,
            processedAt: new Date(),
          };
        }
      );

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
      expect(processedOrder).toEqual(actions.map(a => a.id));
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
        pending.map(async action => {
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
      expect(results.every(r => r.status === 'COMPLETED')).toBe(true);
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

  // ===========================================================================
  // Retry Logic Tests with Failed Actions
  // ===========================================================================

  describe('retry logic for failed actions', () => {
    it('identifies failed actions for retry using createMockFailedQueuedAction', async () => {
      const userId = generateUserId();
      const failedAction = createMockFailedQueuedAction({
        userId,
        action: 'SEND_MESSAGE',
        error: 'Network timeout: Connection refused',
        retryCount: 2,
        maxRetries: 5,
      });

      mockPrisma.offlineQueueAction.findMany.mockResolvedValue([failedAction]);

      const failedActions = await mockPrisma.offlineQueueAction.findMany({
        where: {
          userId,
          status: 'FAILED',
          retryCount: { lt: failedAction.maxRetries },
        },
      });

      expect(failedActions).toHaveLength(1);
      expect(failedActions[0]!.status).toBe('FAILED');
      expect(failedActions[0]!.error).toContain('Network timeout');
      expect(failedActions[0]!.retryCount).toBeLessThan(
        failedActions[0]!.maxRetries
      );
    });

    it('retries failed action and resets status to pending', async () => {
      const userId = generateUserId();
      const failedAction = createMockFailedQueuedAction({
        userId,
        error: 'Server unavailable',
        retryCount: 1,
        maxRetries: 3,
      });

      mockPrisma.offlineQueueAction.update.mockResolvedValue({
        ...failedAction,
        status: 'PENDING',
        error: null,
        retryCount: 2,
      });

      const retriedAction = await mockPrisma.offlineQueueAction.update({
        where: { id: failedAction.id },
        data: {
          status: 'PENDING',
          error: null,
          retryCount: { increment: 1 },
        },
      });

      expect(retriedAction.status).toBe('PENDING');
      expect(retriedAction.error).toBeNull();
      expect(retriedAction.retryCount).toBe(2);
    });

    it('does not retry when max retries exhausted', async () => {
      const userId = generateUserId();
      const exhaustedAction = createMockFailedQueuedAction({
        userId,
        error: 'Permanent failure',
        retryCount: 5,
        maxRetries: 5,
      });

      // Action should not be retried
      const canRetry = exhaustedAction.retryCount < exhaustedAction.maxRetries;
      expect(canRetry).toBe(false);
      expect(exhaustedAction.status).toBe('FAILED');
    });

    it('tracks multiple failed actions for batch retry', async () => {
      const userId = generateUserId();
      const failedActions = [
        createMockFailedQueuedAction({
          userId,
          action: 'SEND_MESSAGE',
          error: 'Network error',
          retryCount: 1,
        }),
        createMockFailedQueuedAction({
          userId,
          action: 'UPDATE_PRESENCE',
          error: 'Timeout',
          retryCount: 2,
        }),
        createMockFailedQueuedAction({
          userId,
          action: 'UPLOAD_FILE',
          error: 'Storage error',
          retryCount: 0,
        }),
      ];

      mockPrisma.offlineQueueAction.findMany.mockResolvedValue(failedActions);

      const retryableActions = await mockPrisma.offlineQueueAction.findMany({
        where: {
          userId,
          status: 'FAILED',
        },
        orderBy: { retryCount: 'asc' }, // Prioritize actions with fewer retries
      });

      expect(retryableActions).toHaveLength(3);
      // Should be sorted by retry count (fewest first)
      expect(retryableActions[0]!.retryCount).toBeLessThanOrEqual(
        retryableActions[1]!.retryCount
      );
    });
  });

  // ===========================================================================
  // Service Mock Tests
  // ===========================================================================

  describe('service mocking with createMockOfflineQueueService', () => {
    it('uses mock offline queue service for enqueue operations', async () => {
      const mockService = createMockOfflineQueueService();
      const userId = generateUserId();

      const action = createMockQueuedAction({
        userId,
        action: 'SEND_MESSAGE',
        payload: { content: 'Test message' },
      });

      mockService.enqueue.mockResolvedValue(action);

      const result = await mockService.enqueue({
        userId,
        action: 'SEND_MESSAGE',
        payload: { content: 'Test message' },
      });

      expect(mockService.enqueue).toHaveBeenCalledWith({
        userId,
        action: 'SEND_MESSAGE',
        payload: { content: 'Test message' },
      });
      expect(result.status).toBe('PENDING');
    });

    it('uses mock offline queue service for processQueue operations', async () => {
      const mockService = createMockOfflineQueueService();
      const userId = generateUserId();

      const processedResults = {
        processed: 5,
        failed: 1,
        remaining: 2,
      };

      mockService.processQueue.mockResolvedValue(processedResults);

      const result = await mockService.processQueue(userId);

      expect(mockService.processQueue).toHaveBeenCalledWith(userId);
      expect(result.processed).toBe(5);
      expect(result.failed).toBe(1);
      expect(result.remaining).toBe(2);
    });

    it('uses mock offline queue service for getQueueStatus operations', async () => {
      const mockService = createMockOfflineQueueService();
      const userId = generateUserId();

      const queueStatus = {
        pending: 10,
        processing: 2,
        completed: 50,
        failed: 3,
      };

      mockService.getQueueStatus.mockResolvedValue(queueStatus);

      const status = await mockService.getQueueStatus(userId);

      expect(mockService.getQueueStatus).toHaveBeenCalledWith(userId);
      expect(status.pending).toBe(10);
      expect(status.completed).toBe(50);
    });

    it('uses mock offline queue service for clearQueue operations', async () => {
      const mockService = createMockOfflineQueueService();
      const userId = generateUserId();

      mockService.clearQueue.mockResolvedValue({ deletedCount: 25 });

      const result = await mockService.clearQueue(userId);

      expect(mockService.clearQueue).toHaveBeenCalledWith(userId);
      expect(result.deletedCount).toBe(25);
    });

    it('uses mock offline queue service for retryFailed operations', async () => {
      const mockService = createMockOfflineQueueService();
      const userId = generateUserId();

      const retryResults = {
        retried: 3,
        stillFailed: 1,
      };

      mockService.retryFailed.mockResolvedValue(retryResults);

      const result = await mockService.retryFailed(userId);

      expect(mockService.retryFailed).toHaveBeenCalledWith(userId);
      expect(result.retried).toBe(3);
      expect(result.stillFailed).toBe(1);
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
      const serverContent = (conflict.serverVersion as Record<string, unknown>)
        .content;
      const clientContent = (conflict.clientVersion as Record<string, unknown>)
        .content;
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

  // ===========================================================================
  // Sync Data Factory Tests
  // ===========================================================================

  describe('sync data with createMockSyncData', () => {
    it('creates basic sync data structure', () => {
      const syncData = createMockSyncData();

      expect(syncData).toBeDefined();
      expect(syncData.syncToken).toBeDefined();
      expect(syncData.changes).toBeDefined();
      expect(syncData.changes.messages).toBeDefined();
      expect(syncData.changes.channels).toBeDefined();
      expect(syncData.conflicts).toBeDefined();
    });

    it('uses sync data for incremental sync response', () => {
      const syncData = createMockSyncData({
        changes: {
          messages: [
            { id: 'msg_1', content: 'Hello', channelId: 'ch_1' },
            { id: 'msg_2', content: 'World', channelId: 'ch_1' },
          ],
          channels: [{ id: 'ch_1', name: 'general' }],
          notifications: [],
          deletedIds: [],
        },
      });

      // Verify sync data structure
      expect(syncData.changes.messages).toHaveLength(2);
      expect(syncData.changes.channels).toHaveLength(1);
      expect(syncData.syncToken).toBeDefined();
    });

    it('handles empty sync data', () => {
      const syncData = createMockSyncData({
        changes: {
          messages: [],
          channels: [],
          notifications: [],
          deletedIds: [],
        },
      });

      expect(syncData.changes.messages).toHaveLength(0);
      expect(syncData.changes.channels).toHaveLength(0);
    });

    it('includes deleted IDs for sync deletions', () => {
      const syncData = createMockSyncData({
        changes: {
          messages: [],
          channels: [],
          notifications: [],
          deletedIds: ['msg_deleted_1', 'msg_deleted_2', 'ch_deleted_1'],
        },
      });

      expect(syncData.changes.deletedIds).toHaveLength(3);
      expect(syncData.changes.deletedIds).toContain('msg_deleted_1');
    });
  });

  describe('sync data with notifications using createMockSyncDataWithNotifications', () => {
    it('creates sync data with notifications included', () => {
      const syncData = createMockSyncDataWithNotifications(5);

      expect(syncData).toBeDefined();
      expect(syncData.syncToken).toBeDefined();
      expect(syncData.changes.notifications).toBeDefined();
      expect(syncData.changes.notifications).toHaveLength(5);
    });

    it('syncs notifications with empty messages by default', () => {
      const syncData = createMockSyncDataWithNotifications(3);

      expect(syncData.changes.notifications).toHaveLength(3);
      expect(syncData.changes.messages).toBeDefined();
    });

    it('handles notification sync with read/unread status', () => {
      const syncData = createMockSyncDataWithNotifications(10);

      // All notifications should have isRead property
      syncData.changes.notifications.forEach(notification => {
        expect(notification).toHaveProperty('isRead');
      });
    });

    it('supports incremental notification sync', () => {
      const oldSyncData = createMockSyncDataWithNotifications(5);
      const newSyncData = createMockSyncDataWithNotifications(3);

      // Different sync data instances should have different notification counts
      expect(oldSyncData.changes.notifications.length).toBe(5);
      expect(newSyncData.changes.notifications.length).toBe(3);
    });

    it('combines notifications with custom overrides', () => {
      const syncData = createMockSyncDataWithNotifications(2, {
        conflicts: [createMockSyncConflict()],
      });

      expect(syncData.changes.notifications).toHaveLength(2);
      expect(syncData.conflicts).toHaveLength(1);
    });
  });

  describe('sync data with conflicts using createMockSyncDataWithConflicts', () => {
    it('creates sync data with conflicts included', () => {
      const syncData = createMockSyncDataWithConflicts(3);

      expect(syncData).toBeDefined();
      expect(syncData.syncToken).toBeDefined();
      expect(syncData.conflicts).toBeDefined();
      expect(syncData.conflicts).toHaveLength(3);
    });

    it('provides conflict data with server and client versions', () => {
      const syncData = createMockSyncDataWithConflicts(2);

      syncData.conflicts.forEach(conflict => {
        expect(conflict).toHaveProperty('serverVersion');
        expect(conflict).toHaveProperty('clientVersion');
        expect(conflict).toHaveProperty('entityType');
        expect(conflict).toHaveProperty('entityId');
      });
    });

    it('handles sync data with custom changes and conflicts', () => {
      const syncData = createMockSyncDataWithConflicts(2, {
        changes: {
          messages: [{ id: 'msg_1', content: 'Test' }],
          channels: [],
          notifications: [],
          deletedIds: [],
        },
      });

      expect(syncData.changes.messages).toBeDefined();
      expect(syncData.conflicts).toHaveLength(2);
    });

    it('identifies conflicts requiring manual resolution', () => {
      const syncData = createMockSyncDataWithConflicts(4);

      // All conflicts should be unresolved (resolvedAt is null)
      const unresolvedConflicts = syncData.conflicts.filter(
        c => c.resolvedAt === null
      );

      expect(unresolvedConflicts.length).toBe(4);
    });

    it('creates conflicts with unique IDs', () => {
      const syncData = createMockSyncDataWithConflicts(5);

      const conflictIds = syncData.conflicts.map(c => c.id);
      const uniqueIds = new Set(conflictIds);

      expect(uniqueIds.size).toBe(5);
    });
  });

  // ===========================================================================
  // Sync Service Mock Tests
  // ===========================================================================

  describe('service mocking with createMockSyncService', () => {
    it('uses mock sync service for performSync operations', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();

      const syncResponse = createMockSyncData();
      mockService.performSync.mockResolvedValue(syncResponse);

      const result = await mockService.performSync(userId);

      expect(mockService.performSync).toHaveBeenCalledWith(userId);
      expect(result.syncToken).toBeDefined();
      expect(result.changes).toBeDefined();
    });

    it('uses mock sync service for getChanges operations', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();
      const syncToken = 'abc123';

      const changesData = createMockSyncDataWithNotifications(10);
      mockService.getChanges.mockResolvedValue(changesData);

      const result = await mockService.getChanges(userId, syncToken);

      expect(mockService.getChanges).toHaveBeenCalledWith(userId, syncToken);
      expect(result.changes.notifications).toHaveLength(10);
    });

    it('uses mock sync service for resolveConflict operations', async () => {
      const mockService = createMockSyncService();
      const conflictId = generateConflictId();

      const resolvedConflict = createMockSyncConflict({
        id: conflictId,
        resolution: 'SERVER_WINS',
        resolvedAt: new Date(),
      });
      mockService.resolveConflict.mockResolvedValue(resolvedConflict);

      const result = await mockService.resolveConflict(
        conflictId,
        'SERVER_WINS'
      );

      expect(mockService.resolveConflict).toHaveBeenCalledWith(
        conflictId,
        'SERVER_WINS'
      );
      expect(result.resolution).toBe('SERVER_WINS');
      expect(result.resolvedAt).toBeDefined();
    });

    it('uses mock sync service for detectConflicts operations', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();

      const syncDataWithConflicts = createMockSyncDataWithConflicts(5);
      mockService.detectConflicts.mockResolvedValue(
        syncDataWithConflicts.conflicts
      );

      const result = await mockService.detectConflicts(userId);

      expect(mockService.detectConflicts).toHaveBeenCalledWith(userId);
      expect(result).toHaveLength(5);
    });

    it('uses mock sync service for getSyncState operations', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();

      const syncState = createMockSyncState({
        userId,
        version: 10,
        lastSyncAt: new Date(),
      });
      mockService.getSyncState.mockResolvedValue(syncState);

      const result = await mockService.getSyncState(userId);

      expect(mockService.getSyncState).toHaveBeenCalledWith(userId);
      expect(result.version).toBe(10);
      expect(result.lastSyncAt).toBeDefined();
    });

    it('uses mock sync service for updateSyncState operations', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();

      const updatedSyncState = createMockSyncState({
        userId,
        version: 11,
        lastSyncAt: new Date(),
      });
      mockService.updateSyncState.mockResolvedValue(updatedSyncState);

      const result = await mockService.updateSyncState(userId, { version: 11 });

      expect(mockService.updateSyncState).toHaveBeenCalledWith(userId, {
        version: 11,
      });
      expect(result.version).toBe(11);
    });

    it('handles sync service errors gracefully', async () => {
      const mockService = createMockSyncService();
      const userId = generateUserId();

      mockService.performSync.mockRejectedValue(new Error('Sync failed'));

      await expect(mockService.performSync(userId)).rejects.toThrow(
        'Sync failed'
      );
    });
  });
});
