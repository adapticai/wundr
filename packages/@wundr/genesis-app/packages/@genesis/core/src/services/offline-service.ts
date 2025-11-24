/**
 * @genesis/core - Offline Queue Service
 *
 * Service for managing offline action queues with support for retry,
 * exponential backoff, conflict handling, and order-preserving operations.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import { createId } from '@paralleldrive/cuid2';

import { GenesisError } from '../errors';
import {
  DEFAULT_OFFLINE_QUEUE_CONFIG,
  type OfflineQueueConfig,
  type QueuedAction,
  type QueuedActionStatus,
  type ActionType,
  type ActionPayload,
  type ActionPriority,
  type QueueStatus,
  type SyncResult,
  calculateRetryDelay,
  getDefaultPriority,
  type OnActionQueuedCallback,
  type OnActionCompletedCallback,
  type OnActionFailedCallback,
  type OnOnlineStatusChangedCallback,
} from '../types/offline';
import {
  type LocalStorageService,
  createLocalStorageService,
  generateStorageKey,
} from './local-storage-service';


// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown for offline queue operations.
 */
export class OfflineQueueError extends GenesisError {
  constructor(message: string, code: string, metadata?: Record<string, unknown>) {
    super(message, code, 500, metadata);
    this.name = 'OfflineQueueError';
  }
}

/**
 * Error thrown when queue is full.
 */
export class QueueFullError extends OfflineQueueError {
  constructor(userId: string, maxSize: number) {
    super(
      `Queue is full for user ${userId}. Maximum size: ${maxSize}`,
      'QUEUE_FULL',
      { userId, maxSize },
    );
    this.name = 'QueueFullError';
  }
}

/**
 * Error thrown when action is not found.
 */
export class ActionNotFoundError extends OfflineQueueError {
  constructor(actionId: string) {
    super(
      `Action not found: ${actionId}`,
      'ACTION_NOT_FOUND',
      { actionId },
    );
    this.name = 'ActionNotFoundError';
  }
}

/**
 * Error thrown when action processing fails.
 */
export class ActionProcessingError extends OfflineQueueError {
  public readonly canRetry: boolean;

  constructor(actionId: string, message: string, canRetry = true) {
    super(
      `Failed to process action ${actionId}: ${message}`,
      'ACTION_PROCESSING_FAILED',
      { actionId, canRetry },
    );
    this.name = 'ActionProcessingError';
    this.canRetry = canRetry;
  }
}

/**
 * Error thrown when action validation fails.
 */
export class ActionValidationError extends OfflineQueueError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'ACTION_VALIDATION_FAILED', { errors });
    this.name = 'ActionValidationError';
    this.errors = errors;
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for offline queue operations.
 */
export interface OfflineQueueService {
  /**
   * Enqueues an action for later processing.
   *
   * @param action - The action to queue
   * @returns The action ID
   */
  enqueue(action: EnqueueActionInput): Promise<string>;

  /**
   * Removes an action from the queue.
   *
   * @param actionId - The action ID to remove
   */
  dequeue(actionId: string): Promise<void>;

  /**
   * Gets all queued actions for a user.
   *
   * @param userId - The user ID
   * @returns Array of queued actions
   */
  getQueue(userId: string): Promise<QueuedAction[]>;

  /**
   * Clears all actions for a user.
   *
   * @param userId - The user ID
   */
  clearQueue(userId: string): Promise<void>;

  /**
   * Processes all pending actions in the queue.
   *
   * @param userId - The user ID
   * @returns Sync result
   */
  processQueue(userId: string): Promise<SyncResult>;

  /**
   * Retries all failed actions.
   *
   * @param userId - The user ID
   * @returns Sync result
   */
  retryFailed(userId: string): Promise<SyncResult>;

  /**
   * Gets the queue status for a user.
   *
   * @param userId - The user ID
   * @returns Queue status
   */
  getQueueStatus(userId: string): Promise<QueueStatus>;

  /**
   * Gets the count of pending actions.
   *
   * @param userId - The user ID
   * @returns Number of pending actions
   */
  getPendingCount(userId: string): Promise<number>;

  /**
   * Updates an action's status.
   *
   * @param actionId - The action ID
   * @param status - New status
   * @param error - Error message if failed
   */
  updateActionStatus(
    actionId: string,
    status: QueuedActionStatus,
    error?: string,
  ): Promise<void>;

  /**
   * Gets an action by ID.
   *
   * @param actionId - The action ID
   * @returns The queued action or null
   */
  getAction(actionId: string): Promise<QueuedAction | null>;

  // Event subscriptions
  onActionQueued(callback: OnActionQueuedCallback): () => void;
  onActionCompleted(callback: OnActionCompletedCallback): () => void;
  onActionFailed(callback: OnActionFailedCallback): () => void;
  onOnlineStatusChanged(callback: OnOnlineStatusChangedCallback): () => void;
}

/**
 * Input for enqueueing an action.
 */
export interface EnqueueActionInput {
  /** User ID */
  userId: string;
  /** Action type */
  type: ActionType;
  /** Action payload */
  payload: ActionPayload;
  /** Priority (optional, defaults based on action type) */
  priority?: ActionPriority;
  /** Dependencies - action IDs that must complete first */
  dependsOn?: string[];
  /** Related entity IDs for conflict detection */
  relatedEntityIds?: string[];
}

/**
 * Action processor function type.
 */
export type ActionProcessor = (action: QueuedAction) => Promise<unknown>;

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Offline queue service implementation.
 */
export class OfflineQueueServiceImpl implements OfflineQueueService {
  private readonly config: OfflineQueueConfig;
  private readonly storage: LocalStorageService;
  private readonly eventEmitter: EventEmitter;
  private readonly processors: Map<ActionType, ActionProcessor>;
  private isOnline = true;
  private isProcessing = false;

  /**
   * Creates a new OfflineQueueServiceImpl instance.
   *
   * @param config - Queue configuration
   * @param storage - Storage service instance
   */
  constructor(
    config: Partial<OfflineQueueConfig> = {},
    storage?: LocalStorageService,
  ) {
    this.config = { ...DEFAULT_OFFLINE_QUEUE_CONFIG, ...config };
    this.storage = storage ?? createLocalStorageService();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50);
    this.processors = new Map();

    // Setup online/offline listeners if in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Registers an action processor.
   *
   * @param actionType - The action type
   * @param processor - The processor function
   */
  registerProcessor(actionType: ActionType, processor: ActionProcessor): void {
    this.processors.set(actionType, processor);
  }

  /**
   * Enqueues an action for later processing.
   */
  async enqueue(input: EnqueueActionInput): Promise<string> {
    // Validate input
    this.validateEnqueueInput(input);

    // Check queue size
    const currentCount = await this.getPendingCount(input.userId);
    if (currentCount >= this.config.maxQueueSize) {
      throw new QueueFullError(input.userId, this.config.maxQueueSize);
    }

    const actionId = createId();

    const action: QueuedAction = {
      id: actionId,
      userId: input.userId,
      type: input.type,
      payload: input.payload,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
      priority: input.priority ?? getDefaultPriority(input.type),
      dependsOn: input.dependsOn,
      relatedEntityIds: input.relatedEntityIds,
    };

    // Store the action
    const key = this.getActionKey(actionId);
    await this.storage.set(key, action);

    // Add to user's queue index
    await this.addToUserQueueIndex(input.userId, actionId);

    // Emit event
    this.eventEmitter.emit('action:queued', action);

    // Auto-process if online and enabled
    if (this.isOnline && this.config.autoProcess && !this.isProcessing) {
      this.processQueue(input.userId).catch(() => {
        // Ignore errors from auto-processing
      });
    }

    return actionId;
  }

  /**
   * Removes an action from the queue.
   */
  async dequeue(actionId: string): Promise<void> {
    const action = await this.getAction(actionId);
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    // Remove from storage
    const key = this.getActionKey(actionId);
    await this.storage.delete(key);

    // Remove from user's queue index
    await this.removeFromUserQueueIndex(action.userId, actionId);
  }

  /**
   * Gets all queued actions for a user.
   */
  async getQueue(userId: string): Promise<QueuedAction[]> {
    const actionIds = await this.getUserQueueIndex(userId);
    const actions: QueuedAction[] = [];

    for (const actionId of actionIds) {
      const action = await this.getAction(actionId);
      if (action) {
        actions.push(action);
      }
    }

    // Sort by priority and timestamp
    return actions.sort((a, b) => {
      const priorityOrder: Record<ActionPriority, number> = {
        critical: 0,
        high: 1,
        normal: 2,
        low: 3,
      };

      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Clears all actions for a user.
   */
  async clearQueue(userId: string): Promise<void> {
    const actionIds = await this.getUserQueueIndex(userId);

    for (const actionId of actionIds) {
      const key = this.getActionKey(actionId);
      await this.storage.delete(key);
    }

    // Clear the index
    const indexKey = this.getUserQueueIndexKey(userId);
    await this.storage.set(indexKey, []);
  }

  /**
   * Processes all pending actions in the queue.
   */
  async processQueue(userId: string): Promise<SyncResult> {
    if (!this.isOnline) {
      return {
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        durationMs: 0,
        failures: [],
        processedIds: [],
        complete: false,
      };
    }

    if (this.isProcessing) {
      return {
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        durationMs: 0,
        failures: [],
        processedIds: [],
        complete: false,
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();

    const result: SyncResult = {
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      durationMs: 0,
      failures: [],
      processedIds: [],
      complete: false,
    };

    try {
      const queue = await this.getQueue(userId);
      const pendingActions = queue.filter((a) => a.status === 'pending');

      // Process in batches
      const batches = this.createBatches(pendingActions, this.config.batchSize);

      for (const batch of batches) {
        await this.processBatch(batch, result);

        // Check if still online
        if (!this.isOnline) {
          break;
        }
      }

      result.complete = result.skippedCount === 0 && result.failureCount === 0;
    } finally {
      this.isProcessing = false;
      result.durationMs = Date.now() - startTime;

      // Check if queue is empty
      const remainingCount = await this.getPendingCount(userId);
      if (remainingCount === 0) {
        this.eventEmitter.emit('queue:empty', userId, result.successCount);
      }
    }

    return result;
  }

  /**
   * Retries all failed actions.
   */
  async retryFailed(userId: string): Promise<SyncResult> {
    const queue = await this.getQueue(userId);
    const failedActions = queue.filter(
      (a) => a.status === 'failed' && a.retryCount < a.maxRetries,
    );

    // Reset status to pending
    for (const action of failedActions) {
      await this.updateActionStatus(action.id, 'pending');
    }

    // Process the queue
    return this.processQueue(userId);
  }

  /**
   * Gets the queue status for a user.
   */
  async getQueueStatus(userId: string): Promise<QueueStatus> {
    const queue = await this.getQueue(userId);

    const pendingActions = queue.filter((a) => a.status === 'pending');
    const processingActions = queue.filter((a) => a.status === 'processing');
    const failedActions = queue.filter((a) => a.status === 'failed');

    const oldestPending = pendingActions.length > 0
      ? new Date(Math.min(...pendingActions.map((a) => new Date(a.timestamp).getTime())))
      : undefined;

    const lastError = failedActions.length > 0
      ? failedActions[failedActions.length - 1]?.lastError
      : undefined;

    // Get last sync timestamp
    const syncStateKey = this.getSyncStateKey(userId);
    const syncState = await this.storage.get<{ lastSyncAt?: Date }>(syncStateKey);

    return {
      userId,
      pendingCount: pendingActions.length,
      processingCount: processingActions.length,
      failedCount: failedActions.length,
      oldestPendingAt: oldestPending,
      isProcessing: this.isProcessing,
      lastSyncAt: syncState?.lastSyncAt,
      lastError,
    };
  }

  /**
   * Gets the count of pending actions.
   */
  async getPendingCount(userId: string): Promise<number> {
    const queue = await this.getQueue(userId);
    return queue.filter((a) => a.status === 'pending').length;
  }

  /**
   * Updates an action's status.
   */
  async updateActionStatus(
    actionId: string,
    status: QueuedActionStatus,
    error?: string,
  ): Promise<void> {
    const action = await this.getAction(actionId);
    if (!action) {
      throw new ActionNotFoundError(actionId);
    }

    const updatedAction: QueuedAction = {
      ...action,
      status,
      lastError: error,
      lastAttemptAt: status === 'processing' || status === 'failed' ? new Date() : action.lastAttemptAt,
      retryCount: status === 'failed' ? action.retryCount + 1 : action.retryCount,
    };

    const key = this.getActionKey(actionId);
    await this.storage.set(key, updatedAction);
  }

  /**
   * Gets an action by ID.
   */
  async getAction(actionId: string): Promise<QueuedAction | null> {
    const key = this.getActionKey(actionId);
    return this.storage.get<QueuedAction>(key);
  }

  // ===========================================================================
  // Event Subscriptions
  // ===========================================================================

  /**
   * Subscribes to action queued events.
   */
  onActionQueued(callback: OnActionQueuedCallback): () => void {
    this.eventEmitter.on('action:queued', callback);
    return () => {
      this.eventEmitter.off('action:queued', callback);
    };
  }

  /**
   * Subscribes to action completed events.
   */
  onActionCompleted(callback: OnActionCompletedCallback): () => void {
    this.eventEmitter.on('action:completed', callback);
    return () => {
      this.eventEmitter.off('action:completed', callback);
    };
  }

  /**
   * Subscribes to action failed events.
   */
  onActionFailed(callback: OnActionFailedCallback): () => void {
    this.eventEmitter.on('action:failed', callback);
    return () => {
      this.eventEmitter.off('action:failed', callback);
    };
  }

  /**
   * Subscribes to online status changed events.
   */
  onOnlineStatusChanged(callback: OnOnlineStatusChangedCallback): () => void {
    this.eventEmitter.on('online:changed', callback);
    return () => {
      this.eventEmitter.off('online:changed', callback);
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Processes a batch of actions.
   */
  private async processBatch(
    actions: QueuedAction[],
    result: SyncResult,
  ): Promise<void> {
    // Check dependencies and filter out actions with unmet dependencies
    const readyActions: QueuedAction[] = [];
    const completedIds = new Set(result.processedIds);

    for (const action of actions) {
      if (this.areDependenciesMet(action, completedIds)) {
        readyActions.push(action);
      } else {
        result.skippedCount++;
      }
    }

    // Process ready actions concurrently
    const promises = readyActions.map((action) =>
      this.processAction(action, result),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Processes a single action.
   */
  private async processAction(
    action: QueuedAction,
    result: SyncResult,
  ): Promise<void> {
    const processor = this.processors.get(action.type);
    if (!processor) {
      // No processor registered, skip
      result.skippedCount++;
      return;
    }

    // Update status to processing
    await this.updateActionStatus(action.id, 'processing');
    this.eventEmitter.emit('action:processing', action.id, action.type);

    try {
      // Process with timeout
      const processResult = await this.withTimeout(
        processor(action),
        this.config.actionTimeoutMs,
      );

      // Success - remove from queue
      await this.dequeue(action.id);
      result.successCount++;
      result.processedIds.push(action.id);

      this.eventEmitter.emit('action:completed', action.id, processResult);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const canRetry = action.retryCount < action.maxRetries - 1;

      await this.updateActionStatus(action.id, 'failed', errorMessage);
      result.failureCount++;
      result.failures.push({
        actionId: action.id,
        actionType: action.type,
        error: errorMessage,
        canRetry,
      });

      this.eventEmitter.emit('action:failed', action.id, errorMessage, canRetry);

      // Schedule retry if allowed
      if (canRetry) {
        const delay = calculateRetryDelay(action.retryCount, this.config);
        setTimeout(() => {
          this.storage.get<QueuedAction>(this.getActionKey(action.id)).then((a) => {
            if (a?.status === 'failed') {
              this.updateActionStatus(action.id, 'pending').catch(() => {
                // Ignore errors
              });
            }
          }).catch(() => {
            // Ignore errors
          });
        }, delay);
      }
    }
  }

  /**
   * Checks if an action's dependencies are met.
   */
  private areDependenciesMet(
    action: QueuedAction,
    completedIds: Set<string>,
  ): boolean {
    if (!action.dependsOn || action.dependsOn.length === 0) {
      return true;
    }

    return action.dependsOn.every((depId) => completedIds.has(depId));
  }

  /**
   * Creates batches from an array.
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Wraps a promise with a timeout.
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Validates enqueue input.
   */
  private validateEnqueueInput(input: EnqueueActionInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.userId || input.userId.trim().length === 0) {
      errors.userId = ['User ID is required'];
    }

    if (!input.type) {
      errors.type = ['Action type is required'];
    }

    if (!input.payload) {
      errors.payload = ['Payload is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new ActionValidationError('Action validation failed', errors);
    }
  }

  // ===========================================================================
  // Storage Key Helpers
  // ===========================================================================

  /**
   * Gets the storage key for an action.
   */
  private getActionKey(actionId: string): string {
    return generateStorageKey(this.config.storageKeyPrefix, 'action', actionId);
  }

  /**
   * Gets the storage key for a user's queue index.
   */
  private getUserQueueIndexKey(userId: string): string {
    return generateStorageKey(this.config.storageKeyPrefix, 'index', userId);
  }

  /**
   * Gets the storage key for sync state.
   */
  private getSyncStateKey(userId: string): string {
    return generateStorageKey(this.config.storageKeyPrefix, 'sync-state', userId);
  }

  /**
   * Gets the user's queue index.
   */
  private async getUserQueueIndex(userId: string): Promise<string[]> {
    const key = this.getUserQueueIndexKey(userId);
    return (await this.storage.get<string[]>(key)) ?? [];
  }

  /**
   * Adds an action to the user's queue index.
   */
  private async addToUserQueueIndex(userId: string, actionId: string): Promise<void> {
    const index = await this.getUserQueueIndex(userId);
    if (!index.includes(actionId)) {
      index.push(actionId);
      const key = this.getUserQueueIndexKey(userId);
      await this.storage.set(key, index);
    }
  }

  /**
   * Removes an action from the user's queue index.
   */
  private async removeFromUserQueueIndex(userId: string, actionId: string): Promise<void> {
    const index = await this.getUserQueueIndex(userId);
    const newIndex = index.filter((id) => id !== actionId);
    const key = this.getUserQueueIndexKey(userId);
    await this.storage.set(key, newIndex);
  }

  // ===========================================================================
  // Online/Offline Handlers
  // ===========================================================================

  /**
   * Handles coming online.
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.eventEmitter.emit('online:changed', true);

    // Auto-process if enabled
    if (this.config.autoProcess) {
      // Get all user IDs from storage and process their queues
      this.storage.getKeys(`${this.config.storageKeyPrefix}index:`).then((keys) => {
        for (const key of keys) {
          const userId = key.split(':').pop();
          if (userId) {
            this.processQueue(userId).catch(() => {
              // Ignore errors from auto-processing
            });
          }
        }
      }).catch(() => {
        // Ignore errors
      });
    }
  }

  /**
   * Handles going offline.
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.eventEmitter.emit('online:changed', false);
  }

  /**
   * Sets the online status manually.
   */
  setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      this.eventEmitter.emit('online:changed', isOnline);

      if (isOnline && this.config.autoProcess) {
        this.handleOnline();
      }
    }
  }

  /**
   * Gets the current online status.
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Cleans up resources.
   */
  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
    this.eventEmitter.removeAllListeners();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new offline queue service instance.
 *
 * @param config - Queue configuration
 * @param storage - Storage service instance
 * @returns Offline queue service instance
 *
 * @example
 * ```typescript
 * const storageService = createLocalStorageService();
 * await storageService.initialize();
 *
 * const offlineQueue = createOfflineQueueService({}, storageService);
 *
 * // Register action processors
 * offlineQueue.registerProcessor('send_message', async (action) => {
 *   // Process the message sending
 *   return await api.sendMessage(action.payload);
 * });
 *
 * // Enqueue an action
 * const actionId = await offlineQueue.enqueue({
 *   userId: 'user_123',
 *   type: 'send_message',
 *   payload: {
 *     channelId: 'channel_456',
 *     content: 'Hello, world!',
 *   },
 * });
 *
 * // Process queue when online
 * const result = await offlineQueue.processQueue('user_123');
 * console.log(`Processed ${result.successCount} actions`);
 * ```
 */
export function createOfflineQueueService(
  config: Partial<OfflineQueueConfig> = {},
  storage?: LocalStorageService,
): OfflineQueueServiceImpl {
  return new OfflineQueueServiceImpl(config, storage);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultOfflineQueueService: OfflineQueueServiceImpl | null = null;

/**
 * Gets the default offline queue service instance.
 *
 * @returns Offline queue service instance
 */
export function getOfflineQueueService(): OfflineQueueServiceImpl {
  if (!defaultOfflineQueueService) {
    defaultOfflineQueueService = createOfflineQueueService();
  }
  return defaultOfflineQueueService;
}

/**
 * Default offline queue service instance.
 */
export const offlineQueueService = getOfflineQueueService();
