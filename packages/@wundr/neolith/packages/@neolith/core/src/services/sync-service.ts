/**
 * @genesis/core - Sync Service
 *
 * Service for synchronizing local data with the server, including
 * initial sync, incremental sync, and conflict resolution.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';

import { createId } from '@paralleldrive/cuid2';

import { GenesisError } from '../errors';
import {
  type LocalStorageService,
  createLocalStorageService,
  generateStorageKey,
} from './local-storage-service';
import {
  DEFAULT_SYNC_CONFIG,
  type SyncConfig,
  type InitialSyncData,
  type IncrementalSyncData,
  type SyncChange,
  type SyncDeletion,
  type SyncConflict,
  type ConflictResolution,
  type SyncState,
  type OnSyncCompletedCallback,
  type OnConflictDetectedCallback,
  type SyncResult,
  type SyncEntityDataType,
} from '../types/offline';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Error thrown for sync operations.
 */
export class SyncError extends GenesisError {
  constructor(message: string, code: string, metadata?: Record<string, unknown>) {
    super(message, code, 500, metadata);
    this.name = 'SyncError';
  }
}

/**
 * Error thrown when sync fails.
 */
export class SyncFailedError extends SyncError {
  constructor(reason: string, syncType: 'initial' | 'incremental') {
    super(
      `${syncType === 'initial' ? 'Initial' : 'Incremental'} sync failed: ${reason}`,
      'SYNC_FAILED',
      { reason, syncType },
    );
    this.name = 'SyncFailedError';
  }
}

/**
 * Error thrown when sync is in progress.
 */
export class SyncInProgressError extends SyncError {
  constructor(userId: string) {
    super(
      `Sync already in progress for user ${userId}`,
      'SYNC_IN_PROGRESS',
      { userId },
    );
    this.name = 'SyncInProgressError';
  }
}

/**
 * Error thrown when conflict resolution fails.
 */
export class ConflictResolutionError extends SyncError {
  constructor(conflictId: string, reason: string) {
    super(
      `Failed to resolve conflict ${conflictId}: ${reason}`,
      'CONFLICT_RESOLUTION_FAILED',
      { conflictId, reason },
    );
    this.name = 'ConflictResolutionError';
  }
}

/**
 * Error thrown when sync token is invalid.
 */
export class InvalidSyncTokenError extends SyncError {
  constructor(token: string) {
    super(
      'Sync token is invalid or expired. Full sync required.',
      'INVALID_SYNC_TOKEN',
      { token },
    );
    this.name = 'InvalidSyncTokenError';
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for sync operations.
 */
export interface SyncService {
  /**
   * Performs initial sync for a user.
   *
   * @param userId - The user ID
   * @returns Initial sync data
   */
  performInitialSync(userId: string): Promise<InitialSyncData>;

  /**
   * Performs incremental sync since last sync.
   *
   * @param userId - The user ID
   * @param lastSyncToken - Token from previous sync
   * @returns Incremental sync data
   */
  syncSince(userId: string, lastSyncToken: string): Promise<IncrementalSyncData>;

  /**
   * Resolves a sync conflict.
   *
   * @param conflict - The conflict to resolve
   * @param resolution - Resolution strategy
   */
  resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<void>;

  /**
   * Gets the current sync state for a user.
   *
   * @param userId - The user ID
   * @returns Sync state
   */
  getSyncState(userId: string): Promise<SyncState>;

  /**
   * Resets sync state for a user.
   *
   * @param userId - The user ID
   */
  resetSyncState(userId: string): Promise<void>;

  /**
   * Gets all pending conflicts.
   *
   * @param userId - The user ID
   * @returns Array of conflicts
   */
  getConflicts(userId: string): Promise<SyncConflict[]>;

  /**
   * Auto-resolves simple conflicts.
   *
   * @param userId - The user ID
   * @returns Number of conflicts resolved
   */
  autoResolveConflicts(userId: string): Promise<number>;

  // Event subscriptions
  onSyncCompleted(callback: OnSyncCompletedCallback): () => void;
  onConflictDetected(callback: OnConflictDetectedCallback): () => void;
}

/**
 * Data fetcher interface for sync operations.
 */
export interface SyncDataFetcher {
  /**
   * Fetches initial sync data from the server.
   */
  fetchInitialSyncData(userId: string, options: InitialSyncOptions): Promise<InitialSyncData>;

  /**
   * Fetches incremental sync data from the server.
   */
  fetchIncrementalSyncData(userId: string, syncToken: string): Promise<IncrementalSyncData>;

  /**
   * Uploads local changes to the server.
   */
  uploadChanges(userId: string, changes: SyncChange[]): Promise<UploadResult>;
}

/**
 * Options for initial sync.
 */
export interface InitialSyncOptions {
  /** Number of days of messages to include */
  messageDays: number;
  /** Whether to include preferences */
  includePreferences: boolean;
}

/**
 * Result of uploading changes.
 */
export interface UploadResult {
  /** Successfully uploaded change IDs */
  successIds: string[];
  /** Failed uploads */
  failures: { changeId: string; error: string }[];
  /** Server-side version after upload */
  newVersion: number;
}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Sync service implementation.
 */
export class SyncServiceImpl implements SyncService {
  private readonly config: SyncConfig;
  private readonly storage: LocalStorageService;
  private readonly eventEmitter: EventEmitter;
  private dataFetcher: SyncDataFetcher | null = null;
  private readonly syncInProgress = new Set<string>();

  /**
   * Creates a new SyncServiceImpl instance.
   *
   * @param config - Sync configuration
   * @param storage - Storage service instance
   */
  constructor(
    config: Partial<SyncConfig> = {},
    storage?: LocalStorageService,
  ) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.storage = storage ?? createLocalStorageService();
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(50);
  }

  /**
   * Sets the data fetcher for server communication.
   */
  setDataFetcher(fetcher: SyncDataFetcher): void {
    this.dataFetcher = fetcher;
  }

  /**
   * Performs initial sync for a user.
   */
  async performInitialSync(userId: string): Promise<InitialSyncData> {
    if (this.syncInProgress.has(userId)) {
      throw new SyncInProgressError(userId);
    }

    this.syncInProgress.add(userId);
    await this.updateSyncState(userId, { status: 'initial_sync' });

    try {
      if (!this.dataFetcher) {
        throw new SyncError('Data fetcher not configured', 'FETCHER_NOT_CONFIGURED');
      }

      // Fetch initial data from server
      const data = await this.withTimeout(
        this.dataFetcher.fetchInitialSyncData(userId, {
          messageDays: this.config.initialSyncMessageDays,
          includePreferences: true,
        }),
        this.config.syncTimeoutMs,
      );

      // Store sync data locally
      await this.storeInitialSyncData(userId, data);

      // Update sync state
      await this.updateSyncState(userId, {
        status: 'idle',
        syncToken: data.syncToken,
        lastFullSyncAt: new Date(),
        hasCompletedInitialSync: true,
        error: undefined,
      });

      // Emit completion event
      const result: SyncResult = {
        successCount: 1,
        failureCount: 0,
        skippedCount: 0,
        durationMs: 0,
        failures: [],
        processedIds: [],
        complete: true,
      };
      this.eventEmitter.emit('sync:completed', 'initial', result);

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateSyncState(userId, {
        status: 'error',
        error: errorMessage,
      });

      throw new SyncFailedError(errorMessage, 'initial');
    } finally {
      this.syncInProgress.delete(userId);
    }
  }

  /**
   * Performs incremental sync since last sync.
   */
  async syncSince(userId: string, lastSyncToken: string): Promise<IncrementalSyncData> {
    if (this.syncInProgress.has(userId)) {
      throw new SyncInProgressError(userId);
    }

    this.syncInProgress.add(userId);
    await this.updateSyncState(userId, { status: 'incremental_sync' });

    try {
      if (!this.dataFetcher) {
        throw new SyncError('Data fetcher not configured', 'FETCHER_NOT_CONFIGURED');
      }

      // Fetch incremental data
      const data = await this.withTimeout(
        this.dataFetcher.fetchIncrementalSyncData(userId, lastSyncToken),
        this.config.syncTimeoutMs,
      );

      // Apply changes and detect conflicts
      const conflicts = await this.applyIncrementalChanges(userId, data);

      // Store conflicts if any
      for (const conflict of conflicts) {
        await this.storeConflict(userId, conflict);
        this.eventEmitter.emit('conflict:detected', conflict);
      }

      // Update sync state
      await this.updateSyncState(userId, {
        status: conflicts.length > 0 ? 'resolving_conflicts' : 'idle',
        syncToken: data.nextSyncToken,
        lastIncrementalSyncAt: new Date(),
        conflictCount: conflicts.length,
        error: undefined,
      });

      // Auto-resolve simple conflicts if enabled
      if (this.config.autoResolveSimpleConflicts && conflicts.length > 0) {
        await this.autoResolveConflicts(userId);
      }

      // Emit completion event
      const result: SyncResult = {
        successCount: data.changes.length,
        failureCount: 0,
        skippedCount: 0,
        durationMs: 0,
        failures: [],
        processedIds: data.changes.map((c) => c.entityId),
        complete: !data.hasMore,
      };
      this.eventEmitter.emit('sync:completed', 'incremental', result);

      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if token is invalid
      if (errorMessage.includes('invalid token') || errorMessage.includes('expired')) {
        await this.updateSyncState(userId, {
          status: 'error',
          error: 'Sync token expired. Full sync required.',
          syncToken: undefined,
          hasCompletedInitialSync: false,
        });
        throw new InvalidSyncTokenError(lastSyncToken);
      }

      await this.updateSyncState(userId, {
        status: 'error',
        error: errorMessage,
      });

      throw new SyncFailedError(errorMessage, 'incremental');
    } finally {
      this.syncInProgress.delete(userId);
    }
  }

  /**
   * Resolves a sync conflict.
   */
  async resolveConflict(
    conflict: SyncConflict,
    resolution: ConflictResolution,
  ): Promise<void> {
    try {
      switch (resolution.strategy) {
        case 'keep_local':
          // Upload local data to server
          await this.uploadLocalVersion(conflict);
          break;

        case 'keep_server':
          // Apply server data locally
          await this.applyServerVersion(conflict);
          break;

        case 'manual_merge':
          // Apply merged data
          if (!resolution.mergedData) {
            throw new ConflictResolutionError(
              conflict.id,
              'Merged data required for manual merge',
            );
          }
          await this.applyMergedData(conflict, resolution.mergedData);
          break;

        case 'keep_both':
          // Create a copy of the local version
          await this.keepBothVersions(conflict);
          break;

        case 'discard':
          // Simply discard the local changes
          await this.applyServerVersion(conflict);
          break;

        default:
          throw new ConflictResolutionError(
            conflict.id,
            `Unknown resolution strategy: ${resolution.strategy}`,
          );
      }

      // Remove conflict from storage
      await this.removeConflict(conflict.id);

      // Update conflict count in sync state
      const state = await this.getSyncState(conflict.entityId);
      await this.updateSyncState(state.userId, {
        conflictCount: Math.max(0, state.conflictCount - 1),
      });

      this.eventEmitter.emit('conflict:resolved', conflict.id, resolution);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ConflictResolutionError(conflict.id, errorMessage);
    }
  }

  /**
   * Gets the current sync state for a user.
   */
  async getSyncState(userId: string): Promise<SyncState> {
    const key = this.getSyncStateKey(userId);
    const state = await this.storage.get<SyncState>(key);

    return state ?? {
      userId,
      hasCompletedInitialSync: false,
      status: 'idle',
      conflictCount: 0,
      staleEntities: [],
    };
  }

  /**
   * Resets sync state for a user.
   */
  async resetSyncState(userId: string): Promise<void> {
    const key = this.getSyncStateKey(userId);

    const newState: SyncState = {
      userId,
      hasCompletedInitialSync: false,
      status: 'idle',
      conflictCount: 0,
      staleEntities: [],
    };

    await this.storage.set(key, newState);

    // Clear all conflicts
    const conflicts = await this.getConflicts(userId);
    for (const conflict of conflicts) {
      await this.removeConflict(conflict.id);
    }

    // Clear cached data
    await this.clearCachedData(userId);
  }

  /**
   * Gets all pending conflicts.
   */
  async getConflicts(userId: string): Promise<SyncConflict[]> {
    const key = this.getConflictsKey(userId);
    return (await this.storage.get<SyncConflict[]>(key)) ?? [];
  }

  /**
   * Auto-resolves simple conflicts.
   */
  async autoResolveConflicts(userId: string): Promise<number> {
    const conflicts = await this.getConflicts(userId);
    let resolvedCount = 0;

    for (const conflict of conflicts) {
      if (this.canAutoResolve(conflict)) {
        try {
          await this.resolveConflict(conflict, {
            conflictId: conflict.id,
            strategy: this.config.defaultResolutionStrategy,
          });
          resolvedCount++;
        } catch {
          // Skip conflicts that fail to auto-resolve
        }
      }
    }

    return resolvedCount;
  }

  // ===========================================================================
  // Event Subscriptions
  // ===========================================================================

  /**
   * Subscribes to sync completed events.
   */
  onSyncCompleted(callback: OnSyncCompletedCallback): () => void {
    const handler = (_type: string, result: SyncResult): void => {
      callback(result);
    };
    this.eventEmitter.on('sync:completed', handler);
    return () => {
      this.eventEmitter.off('sync:completed', handler);
    };
  }

  /**
   * Subscribes to conflict detected events.
   */
  onConflictDetected(callback: OnConflictDetectedCallback): () => void {
    this.eventEmitter.on('conflict:detected', callback);
    return () => {
      this.eventEmitter.off('conflict:detected', callback);
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Stores initial sync data locally.
   */
  private async storeInitialSyncData(userId: string, data: InitialSyncData): Promise<void> {
    // Store workspaces
    for (const workspace of data.workspaces) {
      const key = generateStorageKey('genesis:sync', 'workspace', workspace.id);
      await this.storage.set(key, workspace);
    }

    // Store channels
    for (const channel of data.channels) {
      const key = generateStorageKey('genesis:sync', 'channel', channel.id);
      await this.storage.set(key, channel);
    }

    // Store users
    for (const user of data.users) {
      const key = generateStorageKey('genesis:sync', 'user', user.id);
      await this.storage.set(key, user);
    }

    // Store messages
    for (const message of data.messages) {
      const key = generateStorageKey('genesis:sync', 'message', message.id);
      await this.storage.set(key, message);
    }

    // Store preferences
    const prefsKey = generateStorageKey('genesis:sync', 'preferences', userId);
    await this.storage.set(prefsKey, data.preferences);

    // Store indices for efficient lookups
    await this.updateIndices(userId, data);
  }

  /**
   * Applies incremental changes and detects conflicts.
   */
  private async applyIncrementalChanges(
    _userId: string,
    data: IncrementalSyncData,
  ): Promise<SyncConflict[]> {
    // Note: _userId reserved for future use (e.g., user-specific conflict handling)
    const conflicts: SyncConflict[] = [];

    // Apply changes
    for (const change of data.changes) {
      const conflict = await this.applyChange(change);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    // Apply deletions
    for (const deletion of data.deletions) {
      await this.applyDeletion(deletion);
    }

    return conflicts;
  }

  /**
   * Applies a single change, returning a conflict if detected.
   *
   * @param change - The sync change to apply
   * @returns SyncConflict if local and server data conflict, null otherwise
   */
  private async applyChange(change: SyncChange): Promise<SyncConflict | null> {
    const key = generateStorageKey('genesis:sync', change.entityType, change.entityId);
    const local = await this.storage.getWithMetadata<SyncEntityDataType>(key);

    if (!local) {
      // No local data, simply store
      await this.storage.set(key, change.data);
      return null;
    }

    // Check for conflict
    if (local.metadata.version >= change.version) {
      // Local is same or newer, check if data differs
      const localJson = JSON.stringify(local.value);
      const serverJson = JSON.stringify(change.data);

      if (localJson !== serverJson) {
        return {
          id: createId(),
          entityType: change.entityType,
          entityId: change.entityId,
          localData: local.value,
          serverData: change.data,
          localVersion: local.metadata.version,
          serverVersion: change.version,
          detectedAt: new Date(),
          conflictType: 'concurrent_edit',
        };
      }
    }

    // Server is newer, apply
    await this.storage.set(key, change.data);
    return null;
  }

  /**
   * Applies a deletion.
   */
  private async applyDeletion(deletion: SyncDeletion): Promise<void> {
    const key = generateStorageKey('genesis:sync', deletion.entityType, deletion.entityId);
    await this.storage.delete(key);
  }

  /**
   * Updates sync state.
   */
  private async updateSyncState(userId: string, updates: Partial<SyncState>): Promise<void> {
    const current = await this.getSyncState(userId);
    const updated = { ...current, ...updates };
    const key = this.getSyncStateKey(userId);
    await this.storage.set(key, updated);
  }

  /**
   * Stores a conflict.
   */
  private async storeConflict(userId: string, conflict: SyncConflict): Promise<void> {
    const conflicts = await this.getConflicts(userId);
    conflicts.push(conflict);
    const key = this.getConflictsKey(userId);
    await this.storage.set(key, conflicts);
  }

  /**
   * Removes a conflict.
   */
  private async removeConflict(conflictId: string): Promise<void> {
    // Find the conflict and its user
    const allKeys = await this.storage.getKeys('genesis:sync:conflicts:');

    for (const key of allKeys) {
      const conflicts = await this.storage.get<SyncConflict[]>(key);
      if (conflicts) {
        const filtered = conflicts.filter((c) => c.id !== conflictId);
        if (filtered.length !== conflicts.length) {
          await this.storage.set(key, filtered);
          return;
        }
      }
    }
  }

  /**
   * Checks if a conflict can be auto-resolved.
   */
  private canAutoResolve(conflict: SyncConflict): boolean {
    // Only auto-resolve simple concurrent edits
    if (conflict.conflictType !== 'concurrent_edit') {
      return false;
    }

    // Don't auto-resolve message conflicts
    if (conflict.entityType === 'message') {
      return false;
    }

    return true;
  }

  /**
   * Uploads local version to server.
   */
  private async uploadLocalVersion(conflict: SyncConflict): Promise<void> {
    if (!this.dataFetcher) {
      throw new SyncError('Data fetcher not configured', 'FETCHER_NOT_CONFIGURED');
    }

    const change: SyncChange = {
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      changeType: 'update',
      data: conflict.localData,
      timestamp: new Date(),
      version: conflict.localVersion + 1,
    };

    // Note: In a real implementation, this would extract the userId from the conflict
    // For now, we'll need the caller to handle this properly
    await this.dataFetcher.uploadChanges('', [change]);
  }

  /**
   * Applies server version locally.
   */
  private async applyServerVersion(conflict: SyncConflict): Promise<void> {
    const key = generateStorageKey('genesis:sync', conflict.entityType, conflict.entityId);
    await this.storage.set(key, conflict.serverData);
  }

  /**
   * Applies merged data from manual conflict resolution.
   *
   * @param conflict - The sync conflict being resolved
   * @param mergedData - The merged entity data (type matches conflict.entityType)
   */
  private async applyMergedData(
    conflict: SyncConflict,
    mergedData: SyncEntityDataType,
  ): Promise<void> {
    const key = generateStorageKey('genesis:sync', conflict.entityType, conflict.entityId);
    await this.storage.set(key, mergedData);

    // Also upload to server
    await this.uploadLocalVersion({
      ...conflict,
      localData: mergedData,
    });
  }

  /**
   * Keeps both local and server versions.
   */
  private async keepBothVersions(conflict: SyncConflict): Promise<void> {
    // Keep server version in original location
    await this.applyServerVersion(conflict);

    // Create a copy of local version with a new ID
    const copyKey = generateStorageKey(
      'genesis:sync',
      conflict.entityType,
      `${conflict.entityId}_local_copy`,
    );
    await this.storage.set(copyKey, conflict.localData);
  }

  /**
   * Clears cached data for a user.
   */
  private async clearCachedData(userId: string): Promise<void> {
    const prefixes = [
      'genesis:sync:workspace:',
      'genesis:sync:channel:',
      'genesis:sync:user:',
      'genesis:sync:message:',
      `genesis:sync:preferences:${userId}`,
    ];

    for (const prefix of prefixes) {
      const keys = await this.storage.getKeys(prefix);
      for (const key of keys) {
        await this.storage.delete(key);
      }
    }
  }

  /**
   * Updates indices for efficient lookups.
   */
  private async updateIndices(userId: string, data: InitialSyncData): Promise<void> {
    // Index: user -> workspaces
    const workspaceIds = data.workspaces.map((w) => w.id);
    await this.storage.set(
      generateStorageKey('genesis:index', userId, 'workspaces'),
      workspaceIds,
    );

    // Index: user -> channels
    const channelIds = data.channels.map((c) => c.id);
    await this.storage.set(
      generateStorageKey('genesis:index', userId, 'channels'),
      channelIds,
    );

    // Index: channel -> messages (per channel)
    const messagesByChannel = new Map<string, string[]>();
    for (const message of data.messages) {
      const existing = messagesByChannel.get(message.channelId) ?? [];
      existing.push(message.id);
      messagesByChannel.set(message.channelId, existing);
    }

    for (const [channelId, messageIds] of messagesByChannel) {
      await this.storage.set(
        generateStorageKey('genesis:index', 'channel', channelId, 'messages'),
        messageIds,
      );
    }
  }

  /**
   * Wraps a promise with a timeout.
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SyncError(`Sync operation timed out after ${timeoutMs}ms`, 'SYNC_TIMEOUT'));
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

  // ===========================================================================
  // Storage Key Helpers
  // ===========================================================================

  /**
   * Gets the storage key for sync state.
   */
  private getSyncStateKey(userId: string): string {
    return generateStorageKey('genesis:sync', 'state', userId);
  }

  /**
   * Gets the storage key for conflicts.
   */
  private getConflictsKey(userId: string): string {
    return generateStorageKey('genesis:sync', 'conflicts', userId);
  }

  /**
   * Cleans up resources.
   */
  cleanup(): void {
    this.syncInProgress.clear();
    this.eventEmitter.removeAllListeners();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new sync service instance.
 *
 * @param config - Sync configuration
 * @param storage - Storage service instance
 * @returns Sync service instance
 *
 * @example
 * ```typescript
 * const storageService = createLocalStorageService();
 * await storageService.initialize();
 *
 * const syncService = createSyncService({}, storageService);
 *
 * // Set up data fetcher
 * syncService.setDataFetcher({
 *   fetchInitialSyncData: async (userId, options) => {
 *     return await api.getInitialSyncData(userId, options);
 *   },
 *   fetchIncrementalSyncData: async (userId, token) => {
 *     return await api.getIncrementalSyncData(userId, token);
 *   },
 *   uploadChanges: async (userId, changes) => {
 *     return await api.uploadChanges(userId, changes);
 *   },
 * });
 *
 * // Perform initial sync
 * const data = await syncService.performInitialSync('user_123');
 *
 * // Later, perform incremental sync
 * const changes = await syncService.syncSince('user_123', data.syncToken);
 * ```
 */
export function createSyncService(
  config: Partial<SyncConfig> = {},
  storage?: LocalStorageService,
): SyncServiceImpl {
  return new SyncServiceImpl(config, storage);
}

// =============================================================================
// Singleton Instance
// =============================================================================

let defaultSyncService: SyncServiceImpl | null = null;

/**
 * Gets the default sync service instance.
 *
 * @returns Sync service instance
 */
export function getSyncService(): SyncServiceImpl {
  if (!defaultSyncService) {
    defaultSyncService = createSyncService();
  }
  return defaultSyncService;
}

/**
 * Default sync service instance.
 */
export const syncService = getSyncService();

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Merges two objects, preferring non-null values.
 *
 * @param local - Local object
 * @param server - Server object
 * @returns Merged object
 */
export function mergeObjects<T extends Record<string, unknown>>(
  local: T,
  server: T,
): T {
  const result = { ...server };

  for (const key of Object.keys(local)) {
    const localValue = local[key];
    const serverValue = server[key];

    // Prefer non-null values
    if (localValue !== null && localValue !== undefined && serverValue === null) {
      (result as Record<string, unknown>)[key] = localValue;
    }

    // For nested objects, merge recursively
    if (
      typeof localValue === 'object' &&
      typeof serverValue === 'object' &&
      localValue !== null &&
      serverValue !== null &&
      !Array.isArray(localValue) &&
      !Array.isArray(serverValue)
    ) {
      (result as Record<string, unknown>)[key] = mergeObjects(
        localValue as Record<string, unknown>,
        serverValue as Record<string, unknown>,
      );
    }
  }

  return result;
}

/**
 * Determines if two values are equal for conflict detection.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Whether the values are equal
 */
export function areValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
