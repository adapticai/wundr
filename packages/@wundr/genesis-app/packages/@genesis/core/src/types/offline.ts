/**
 * @genesis/core - Offline Type Definitions
 *
 * Type definitions for the offline queue service, sync service,
 * and local storage management.
 *
 * @packageDocumentation
 */

// =============================================================================
// Action Types
// =============================================================================

/**
 * Types of actions that can be queued for offline processing.
 */
export type ActionType =
  | 'send_message'
  | 'edit_message'
  | 'delete_message'
  | 'add_reaction'
  | 'remove_reaction'
  | 'update_status'
  | 'join_channel'
  | 'leave_channel'
  | 'upload_file'
  | 'create_thread'
  | 'update_profile'
  | 'mark_read';

/**
 * Status of a queued action.
 */
export type QueuedActionStatus = 'pending' | 'processing' | 'failed' | 'completed';

/**
 * Priority levels for queued actions.
 */
export type ActionPriority = 'low' | 'normal' | 'high' | 'critical';

// =============================================================================
// Queued Action Types
// =============================================================================

/**
 * Base interface for action payloads.
 */
export interface BaseActionPayload {
  /** Unique client-side identifier for optimistic updates */
  clientId?: string;
}

/**
 * Typed metadata for message payloads.
 */
export interface SendMessageMetadata {
  /** Mentioned user IDs */
  mentions?: string[];
  /** Attachment file IDs */
  attachmentIds?: string[];
  /** Preview URL for link previews */
  previewUrl?: string;
  /** Bot command name if command message */
  command?: string;
  /** Command arguments */
  commandArgs?: string[];
  /** Additional string metadata */
  [key: string]: string | string[] | boolean | number | undefined;
}

/**
 * Payload for send message action.
 */
export interface SendMessagePayload extends BaseActionPayload {
  channelId: string;
  content: string;
  type?: 'TEXT' | 'SYSTEM' | 'FILE' | 'COMMAND';
  parentId?: string;
  metadata?: SendMessageMetadata;
}

/**
 * Payload for edit message action.
 */
export interface EditMessagePayload extends BaseActionPayload {
  messageId: string;
  content: string;
}

/**
 * Payload for delete message action.
 */
export interface DeleteMessagePayload extends BaseActionPayload {
  messageId: string;
  softDelete?: boolean;
}

/**
 * Payload for add reaction action.
 */
export interface AddReactionPayload extends BaseActionPayload {
  messageId: string;
  emoji: string;
}

/**
 * Payload for remove reaction action.
 */
export interface RemoveReactionPayload extends BaseActionPayload {
  messageId: string;
  emoji: string;
}

/**
 * Payload for update status action.
 */
export interface UpdateStatusPayload extends BaseActionPayload {
  status: 'online' | 'away' | 'busy' | 'offline';
  statusMessage?: string;
}

/**
 * Payload for join channel action.
 */
export interface JoinChannelPayload extends BaseActionPayload {
  channelId: string;
}

/**
 * Payload for leave channel action.
 */
export interface LeaveChannelPayload extends BaseActionPayload {
  channelId: string;
}

/**
 * Payload for upload file action.
 */
export interface UploadFilePayload extends BaseActionPayload {
  channelId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** Base64 encoded file data for small files, or path to local cache */
  fileData: string;
  isLocalPath?: boolean;
}

/**
 * Payload for create thread action.
 */
export interface CreateThreadPayload extends BaseActionPayload {
  parentMessageId: string;
  content: string;
}

/**
 * Payload for update profile action.
 */
export interface UpdateProfilePayload extends BaseActionPayload {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
}

/**
 * Payload for mark read action.
 */
export interface MarkReadPayload extends BaseActionPayload {
  channelId: string;
  messageId: string;
}

/**
 * Union type for all action payloads.
 */
export type ActionPayload =
  | SendMessagePayload
  | EditMessagePayload
  | DeleteMessagePayload
  | AddReactionPayload
  | RemoveReactionPayload
  | UpdateStatusPayload
  | JoinChannelPayload
  | LeaveChannelPayload
  | UploadFilePayload
  | CreateThreadPayload
  | UpdateProfilePayload
  | MarkReadPayload;

// =============================================================================
// Action Result Types
// =============================================================================

/**
 * Result of a send message action.
 */
export interface SendMessageResult {
  messageId: string;
  channelId: string;
  createdAt: Date;
}

/**
 * Result of an edit message action.
 */
export interface EditMessageResult {
  messageId: string;
  updatedAt: Date;
}

/**
 * Result of a delete message action.
 */
export interface DeleteMessageResult {
  messageId: string;
  deletedAt: Date;
}

/**
 * Result of an add reaction action.
 */
export interface AddReactionResult {
  messageId: string;
  emoji: string;
  reactionCount: number;
}

/**
 * Result of a remove reaction action.
 */
export interface RemoveReactionResult {
  messageId: string;
  emoji: string;
  reactionCount: number;
}

/**
 * Result of an update status action.
 */
export interface UpdateStatusResult {
  status: 'online' | 'away' | 'busy' | 'offline';
  updatedAt: Date;
}

/**
 * Result of a join channel action.
 */
export interface JoinChannelResult {
  channelId: string;
  joinedAt: Date;
}

/**
 * Result of a leave channel action.
 */
export interface LeaveChannelResult {
  channelId: string;
  leftAt: Date;
}

/**
 * Result of an upload file action.
 */
export interface UploadFileResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

/**
 * Result of a create thread action.
 */
export interface CreateThreadResult {
  threadId: string;
  parentMessageId: string;
  createdAt: Date;
}

/**
 * Result of an update profile action.
 */
export interface UpdateProfileResult {
  userId: string;
  updatedAt: Date;
}

/**
 * Result of a mark read action.
 */
export interface MarkReadResult {
  channelId: string;
  messageId: string;
  markedAt: Date;
}

/**
 * Union type for all action results.
 */
export type ActionResult =
  | SendMessageResult
  | EditMessageResult
  | DeleteMessageResult
  | AddReactionResult
  | RemoveReactionResult
  | UpdateStatusResult
  | JoinChannelResult
  | LeaveChannelResult
  | UploadFileResult
  | CreateThreadResult
  | UpdateProfileResult
  | MarkReadResult;

/**
 * A queued action waiting to be synchronized.
 */
export interface QueuedAction<T extends ActionPayload = ActionPayload> {
  /** Unique identifier for this queued action */
  id: string;
  /** User ID who initiated the action */
  userId: string;
  /** Type of action to perform */
  type: ActionType;
  /** Action-specific payload */
  payload: T;
  /** Timestamp when the action was queued */
  timestamp: Date;
  /** Number of retry attempts */
  retryCount: number;
  /** Maximum number of retries allowed */
  maxRetries: number;
  /** Current status of the action */
  status: QueuedActionStatus;
  /** Priority level for processing */
  priority: ActionPriority;
  /** Last error message if failed */
  lastError?: string;
  /** Timestamp of last processing attempt */
  lastAttemptAt?: Date;
  /** Dependencies - action IDs that must complete first */
  dependsOn?: string[];
  /** Related entity IDs for conflict detection */
  relatedEntityIds?: string[];
}

// =============================================================================
// Queue Status Types
// =============================================================================

/**
 * Status of the offline queue for a user.
 */
export interface QueueStatus {
  /** User ID */
  userId: string;
  /** Total number of pending actions */
  pendingCount: number;
  /** Number of actions currently being processed */
  processingCount: number;
  /** Number of failed actions */
  failedCount: number;
  /** Oldest pending action timestamp */
  oldestPendingAt?: Date;
  /** Whether the queue is currently being processed */
  isProcessing: boolean;
  /** Last successful sync timestamp */
  lastSyncAt?: Date;
  /** Last error encountered */
  lastError?: string;
}

/**
 * Result of processing the offline queue.
 */
export interface SyncResult {
  /** Number of actions successfully processed */
  successCount: number;
  /** Number of actions that failed */
  failureCount: number;
  /** Number of actions skipped (e.g., due to dependencies) */
  skippedCount: number;
  /** Total time taken in milliseconds */
  durationMs: number;
  /** Details of failed actions */
  failures: SyncFailure[];
  /** Actions that were processed successfully */
  processedIds: string[];
  /** Whether all actions were processed */
  complete: boolean;
}

/**
 * Details of a sync failure.
 */
export interface SyncFailure {
  /** Action ID that failed */
  actionId: string;
  /** Action type */
  actionType: ActionType;
  /** Error message */
  error: string;
  /** Error code if available */
  errorCode?: string;
  /** Whether the action can be retried */
  canRetry: boolean;
  /** Suggested resolution */
  resolution?: string;
}

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Initial sync data retrieved from the server.
 */
export interface InitialSyncData {
  /** User's workspaces */
  workspaces: SyncWorkspace[];
  /** Channels the user is a member of */
  channels: SyncChannel[];
  /** Users visible to the current user */
  users: SyncUser[];
  /** Recent messages in joined channels */
  messages: SyncMessage[];
  /** User's preferences and settings */
  preferences: SyncPreferences;
  /** Sync token for incremental sync */
  syncToken: string;
  /** Server timestamp of the sync */
  serverTimestamp: Date;
}

/**
 * Incremental sync data retrieved from the server.
 */
export interface IncrementalSyncData {
  /** Changes since last sync */
  changes: SyncChange[];
  /** Deletions since last sync */
  deletions: SyncDeletion[];
  /** Next sync token */
  nextSyncToken: string;
  /** Server timestamp */
  serverTimestamp: Date;
  /** Whether there are more changes to fetch */
  hasMore: boolean;
}

/**
 * Workspace data for sync.
 */
export interface SyncWorkspace {
  id: string;
  name: string;
  slug: string;
  iconUrl?: string;
  description?: string;
  visibility: string;
  organizationId: string;
  updatedAt: Date;
}

/**
 * Channel data for sync.
 */
export interface SyncChannel {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
  workspaceId: string;
  unreadCount: number;
  lastMessageAt?: Date;
  lastReadMessageId?: string;
  updatedAt: Date;
}

/**
 * User data for sync.
 */
export interface SyncUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: string;
  statusMessage?: string;
  lastActiveAt?: Date;
  updatedAt: Date;
}

/**
 * Typed metadata for synced messages.
 */
export interface SyncMessageMetadata {
  /** Mentioned user IDs */
  mentions?: string[];
  /** Attachment file IDs */
  attachmentIds?: string[];
  /** Link preview data */
  linkPreview?: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
  };
  /** Bot/VP that sent the message */
  vpId?: string;
  /** Additional string metadata */
  [key: string]: string | string[] | boolean | number | { url: string; title?: string; description?: string; imageUrl?: string } | undefined;
}

/**
 * Message data for sync.
 */
export interface SyncMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: string;
  parentId?: string;
  metadata?: SyncMessageMetadata;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  reactions: SyncReaction[];
}

/**
 * Reaction data for sync.
 */
export interface SyncReaction {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

/**
 * User preferences for sync.
 */
export interface SyncPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
}

/**
 * Notification preferences.
 */
export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  mentionsOnly: boolean;
  mutedChannels: string[];
}

/**
 * Privacy preferences.
 */
export interface PrivacyPreferences {
  showOnlineStatus: boolean;
  showLastActive: boolean;
  allowDirectMessages: boolean;
}

/**
 * Sync entity data union - maps entity types to their data types.
 */
export type SyncEntityData =
  | { entityType: 'workspace'; data: SyncWorkspace }
  | { entityType: 'channel'; data: SyncChannel }
  | { entityType: 'user'; data: SyncUser }
  | { entityType: 'message'; data: SyncMessage }
  | { entityType: 'reaction'; data: SyncReaction }
  | { entityType: 'member'; data: SyncMember }
  | { entityType: 'file'; data: SyncFile }
  | { entityType: 'preference'; data: SyncPreferences };

/**
 * Member data for sync.
 */
export interface SyncMember {
  id: string;
  userId: string;
  channelId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  joinedAt: Date;
  updatedAt: Date;
}

/**
 * File data for sync.
 */
export interface SyncFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A change from incremental sync.
 */
export interface SyncChange {
  /** Type of entity that changed */
  entityType: SyncEntityType;
  /** Entity ID */
  entityId: string;
  /** Type of change */
  changeType: 'create' | 'update';
  /** Changed data - type depends on entityType, use type guards for type-safe access */
  data: SyncWorkspace | SyncChannel | SyncUser | SyncMessage | SyncReaction | SyncMember | SyncFile | SyncPreferences;
  /** Timestamp of the change */
  timestamp: Date;
  /** Version number for conflict detection */
  version: number;
}

/**
 * A deletion from incremental sync.
 */
export interface SyncDeletion {
  /** Type of entity that was deleted */
  entityType: SyncEntityType;
  /** Entity ID */
  entityId: string;
  /** Timestamp of deletion */
  timestamp: Date;
}

/**
 * Types of entities that can be synced.
 */
export type SyncEntityType =
  | 'workspace'
  | 'channel'
  | 'user'
  | 'message'
  | 'reaction'
  | 'member'
  | 'file'
  | 'preference';

// =============================================================================
// Conflict Types
// =============================================================================

/**
 * Type alias for sync entity data types.
 */
export type SyncEntityDataType = SyncWorkspace | SyncChannel | SyncUser | SyncMessage | SyncReaction | SyncMember | SyncFile | SyncPreferences;

/**
 * A conflict detected during sync.
 */
export interface SyncConflict {
  /** Unique conflict identifier */
  id: string;
  /** Entity type involved in the conflict */
  entityType: SyncEntityType;
  /** Entity ID */
  entityId: string;
  /** The local version of the data - type depends on entityType */
  localData: SyncEntityDataType;
  /** The server version of the data - type depends on entityType */
  serverData: SyncEntityDataType;
  /** Local version number */
  localVersion: number;
  /** Server version number */
  serverVersion: number;
  /** Timestamp when conflict was detected */
  detectedAt: Date;
  /** Type of conflict */
  conflictType: ConflictType;
}

/**
 * Types of conflicts that can occur.
 */
export type ConflictType =
  | 'concurrent_edit'
  | 'delete_edit'
  | 'create_create'
  | 'version_mismatch';

/**
 * Resolution strategy for a conflict.
 */
export interface ConflictResolution {
  /** Conflict ID being resolved */
  conflictId: string;
  /** Resolution strategy */
  strategy: ResolutionStrategy;
  /** Custom merged data (for manual merge) - type depends on entity being resolved */
  mergedData?: SyncEntityDataType;
}

/**
 * Strategies for resolving conflicts.
 */
export type ResolutionStrategy =
  | 'keep_local'
  | 'keep_server'
  | 'manual_merge'
  | 'keep_both'
  | 'discard';

// =============================================================================
// Sync State Types
// =============================================================================

/**
 * Current sync state for a user.
 */
export interface SyncState {
  /** User ID */
  userId: string;
  /** Current sync token */
  syncToken?: string;
  /** Last successful full sync */
  lastFullSyncAt?: Date;
  /** Last successful incremental sync */
  lastIncrementalSyncAt?: Date;
  /** Whether initial sync has been completed */
  hasCompletedInitialSync: boolean;
  /** Current sync status */
  status: SyncStatus;
  /** Number of pending conflicts */
  conflictCount: number;
  /** Error if sync failed */
  error?: string;
  /** Entities that need to be refreshed */
  staleEntities: StaleEntity[];
}

/**
 * Current sync status.
 */
export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'initial_sync'
  | 'incremental_sync'
  | 'resolving_conflicts'
  | 'error'
  | 'offline';

/**
 * Entity that needs to be refreshed.
 */
export interface StaleEntity {
  entityType: SyncEntityType;
  entityId: string;
  staleAt: Date;
  reason: string;
}

// =============================================================================
// Local Storage Types
// =============================================================================

/**
 * Metadata for stored items.
 */
export interface StorageMetadata {
  /** When the item was stored */
  storedAt: Date;
  /** When the item expires (optional) */
  expiresAt?: Date;
  /** Version for conflict detection */
  version: number;
  /** Size in bytes */
  size: number;
  /** Checksum for integrity verification */
  checksum?: string;
}

/**
 * A stored item with metadata.
 */
export interface StoredItem<T = unknown> {
  /** The stored value */
  value: T;
  /** Storage metadata */
  metadata: StorageMetadata;
}

/**
 * Options for storage operations.
 */
export interface StorageOptions {
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Whether to compress the data */
  compress?: boolean;
  /** Encryption key (if encryption is enabled) */
  encryptionKey?: string;
}

/**
 * Storage statistics.
 */
export interface StorageStats {
  /** Total number of items */
  itemCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Available quota (if applicable) */
  availableQuota?: number;
  /** Used quota percentage */
  usedPercentage: number;
  /** Number of expired items */
  expiredCount: number;
  /** Oldest item timestamp */
  oldestItemAt?: Date;
}

/**
 * Result of a prune operation.
 */
export interface PruneResult {
  /** Number of items removed */
  removedCount: number;
  /** Bytes freed */
  bytesFreed: number;
  /** Duration in milliseconds */
  durationMs: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Offline service event types.
 */
export type OfflineEventType =
  | 'ACTION_QUEUED'
  | 'ACTION_PROCESSING'
  | 'ACTION_COMPLETED'
  | 'ACTION_FAILED'
  | 'QUEUE_EMPTY'
  | 'SYNC_STARTED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'ONLINE_STATUS_CHANGED'
  | 'STORAGE_QUOTA_WARNING';

/**
 * Base offline event structure.
 */
export interface BaseOfflineEvent {
  /** Event type */
  type: OfflineEventType;
  /** Timestamp */
  timestamp: Date;
  /** User ID */
  userId: string;
}

/**
 * Event emitted when an action is queued.
 */
export interface ActionQueuedEvent extends BaseOfflineEvent {
  type: 'ACTION_QUEUED';
  action: QueuedAction;
}

/**
 * Event emitted when an action starts processing.
 */
export interface ActionProcessingEvent extends BaseOfflineEvent {
  type: 'ACTION_PROCESSING';
  actionId: string;
  actionType: ActionType;
}

/**
 * Event emitted when an action completes.
 */
export interface ActionCompletedEvent extends BaseOfflineEvent {
  type: 'ACTION_COMPLETED';
  actionId: string;
  actionType: ActionType;
  /** Result of the action - type depends on actionType */
  result?: ActionResult;
}

/**
 * Event emitted when an action fails.
 */
export interface ActionFailedEvent extends BaseOfflineEvent {
  type: 'ACTION_FAILED';
  actionId: string;
  actionType: ActionType;
  error: string;
  canRetry: boolean;
}

/**
 * Event emitted when the queue becomes empty.
 */
export interface QueueEmptyEvent extends BaseOfflineEvent {
  type: 'QUEUE_EMPTY';
  processedCount: number;
}

/**
 * Event emitted when sync starts.
 */
export interface SyncStartedEvent extends BaseOfflineEvent {
  type: 'SYNC_STARTED';
  syncType: 'initial' | 'incremental';
}

/**
 * Event emitted when sync completes.
 */
export interface SyncCompletedEvent extends BaseOfflineEvent {
  type: 'SYNC_COMPLETED';
  syncType: 'initial' | 'incremental';
  result: SyncResult;
}

/**
 * Event emitted when sync fails.
 */
export interface SyncFailedEvent extends BaseOfflineEvent {
  type: 'SYNC_FAILED';
  syncType: 'initial' | 'incremental';
  error: string;
}

/**
 * Event emitted when a conflict is detected.
 */
export interface ConflictDetectedEvent extends BaseOfflineEvent {
  type: 'CONFLICT_DETECTED';
  conflict: SyncConflict;
}

/**
 * Event emitted when a conflict is resolved.
 */
export interface ConflictResolvedEvent extends BaseOfflineEvent {
  type: 'CONFLICT_RESOLVED';
  conflictId: string;
  resolution: ConflictResolution;
}

/**
 * Event emitted when online status changes.
 */
export interface OnlineStatusChangedEvent extends BaseOfflineEvent {
  type: 'ONLINE_STATUS_CHANGED';
  isOnline: boolean;
}

/**
 * Event emitted when storage quota is low.
 */
export interface StorageQuotaWarningEvent extends BaseOfflineEvent {
  type: 'STORAGE_QUOTA_WARNING';
  usedPercentage: number;
  availableBytes: number;
}

/**
 * Union type of all offline events.
 */
export type OfflineEvent =
  | ActionQueuedEvent
  | ActionProcessingEvent
  | ActionCompletedEvent
  | ActionFailedEvent
  | QueueEmptyEvent
  | SyncStartedEvent
  | SyncCompletedEvent
  | SyncFailedEvent
  | ConflictDetectedEvent
  | ConflictResolvedEvent
  | OnlineStatusChangedEvent
  | StorageQuotaWarningEvent;

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback for action queued events.
 */
export type OnActionQueuedCallback = (action: QueuedAction) => void;

/**
 * Callback for action completed events.
 */
export type OnActionCompletedCallback = (actionId: string, result?: ActionResult) => void;

/**
 * Callback for action failed events.
 */
export type OnActionFailedCallback = (actionId: string, error: string, canRetry: boolean) => void;

/**
 * Callback for sync completed events.
 */
export type OnSyncCompletedCallback = (result: SyncResult) => void;

/**
 * Callback for conflict detected events.
 */
export type OnConflictDetectedCallback = (conflict: SyncConflict) => void;

/**
 * Callback for online status changed events.
 */
export type OnOnlineStatusChangedCallback = (isOnline: boolean) => void;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for the offline queue service.
 */
export interface OfflineQueueConfig {
  /** Maximum number of retries for failed actions */
  maxRetries: number;
  /** Base delay for exponential backoff in milliseconds */
  baseRetryDelayMs: number;
  /** Maximum retry delay in milliseconds */
  maxRetryDelayMs: number;
  /** Whether to process queue automatically when online */
  autoProcess: boolean;
  /** Batch size for processing */
  batchSize: number;
  /** Timeout for individual action processing in milliseconds */
  actionTimeoutMs: number;
  /** Maximum queue size per user */
  maxQueueSize: number;
  /** Whether to persist queue to storage */
  persistQueue: boolean;
  /** Storage key prefix */
  storageKeyPrefix: string;
}

/**
 * Configuration for the sync service.
 */
export interface SyncConfig {
  /** Interval for incremental sync in milliseconds */
  syncIntervalMs: number;
  /** Timeout for sync operations in milliseconds */
  syncTimeoutMs: number;
  /** Maximum number of changes to fetch per request */
  maxChangesPerRequest: number;
  /** Whether to auto-resolve simple conflicts */
  autoResolveSimpleConflicts: boolean;
  /** Default resolution strategy */
  defaultResolutionStrategy: ResolutionStrategy;
  /** Number of days of messages to sync initially */
  initialSyncMessageDays: number;
  /** Maximum concurrent sync operations */
  maxConcurrentSyncs: number;
}

/**
 * Configuration for local storage service.
 */
export interface LocalStorageConfig {
  /** Storage backend type */
  backend: 'indexeddb' | 'sqlite' | 'memory';
  /** Database name */
  dbName: string;
  /** Database version */
  dbVersion: number;
  /** Maximum storage size in bytes (if applicable) */
  maxStorageSize?: number;
  /** Default TTL for cached items in milliseconds */
  defaultTtlMs: number;
  /** Whether to enable compression */
  enableCompression: boolean;
  /** Whether to enable encryption */
  enableEncryption: boolean;
  /** Quota warning threshold (0-1) */
  quotaWarningThreshold: number;
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default offline queue configuration.
 */
export const DEFAULT_OFFLINE_QUEUE_CONFIG: OfflineQueueConfig = {
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  autoProcess: true,
  batchSize: 10,
  actionTimeoutMs: 30000,
  maxQueueSize: 1000,
  persistQueue: true,
  storageKeyPrefix: 'genesis:queue:',
};

/**
 * Default sync configuration.
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncIntervalMs: 30000,
  syncTimeoutMs: 60000,
  maxChangesPerRequest: 500,
  autoResolveSimpleConflicts: true,
  defaultResolutionStrategy: 'keep_server',
  initialSyncMessageDays: 30,
  maxConcurrentSyncs: 1,
};

/**
 * Default local storage configuration.
 */
export const DEFAULT_LOCAL_STORAGE_CONFIG: LocalStorageConfig = {
  backend: 'indexeddb',
  dbName: 'genesis-offline',
  dbVersion: 1,
  defaultTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableCompression: true,
  enableEncryption: false,
  quotaWarningThreshold: 0.9,
};

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for QueuedAction.
 */
export function isQueuedAction(value: unknown): value is QueuedAction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const action = value as Record<string, unknown>;

  return (
    typeof action.id === 'string' &&
    typeof action.userId === 'string' &&
    typeof action.type === 'string' &&
    typeof action.payload === 'object' &&
    action.timestamp instanceof Date &&
    typeof action.retryCount === 'number' &&
    typeof action.maxRetries === 'number' &&
    typeof action.status === 'string'
  );
}

/**
 * Type guard for SyncConflict.
 */
export function isSyncConflict(value: unknown): value is SyncConflict {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const conflict = value as Record<string, unknown>;

  return (
    typeof conflict.id === 'string' &&
    typeof conflict.entityType === 'string' &&
    typeof conflict.entityId === 'string' &&
    typeof conflict.localVersion === 'number' &&
    typeof conflict.serverVersion === 'number' &&
    conflict.detectedAt instanceof Date
  );
}

/**
 * Type guard for ActionType.
 */
export function isActionType(value: unknown): value is ActionType {
  const validTypes: ActionType[] = [
    'send_message',
    'edit_message',
    'delete_message',
    'add_reaction',
    'remove_reaction',
    'update_status',
    'join_channel',
    'leave_channel',
    'upload_file',
    'create_thread',
    'update_profile',
    'mark_read',
  ];

  return typeof value === 'string' && validTypes.includes(value as ActionType);
}

/**
 * Type guard for SyncStatus.
 */
export function isSyncStatus(value: unknown): value is SyncStatus {
  const validStatuses: SyncStatus[] = [
    'idle',
    'syncing',
    'initial_sync',
    'incremental_sync',
    'resolving_conflicts',
    'error',
    'offline',
  ];

  return typeof value === 'string' && validStatuses.includes(value as SyncStatus);
}

/**
 * Type guard for SendMessagePayload.
 */
export function isSendMessagePayload(value: unknown): value is SendMessagePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.channelId === 'string' &&
    typeof payload.content === 'string'
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates the retry delay with exponential backoff.
 *
 * @param retryCount - Current retry count
 * @param config - Offline queue configuration
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  retryCount: number,
  config: Pick<OfflineQueueConfig, 'baseRetryDelayMs' | 'maxRetryDelayMs'> = DEFAULT_OFFLINE_QUEUE_CONFIG,
): number {
  const exponentialDelay = config.baseRetryDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  return Math.min(exponentialDelay + jitter, config.maxRetryDelayMs);
}

/**
 * Determines if an action type affects other actions.
 * Used for dependency ordering.
 *
 * @param actionType - The action type to check
 * @returns Whether the action can affect others
 */
export function isOrderDependentAction(actionType: ActionType): boolean {
  const orderDependentTypes: ActionType[] = [
    'send_message',
    'edit_message',
    'delete_message',
    'create_thread',
  ];

  return orderDependentTypes.includes(actionType);
}

/**
 * Gets the priority level for an action type.
 *
 * @param actionType - The action type
 * @returns Default priority level
 */
export function getDefaultPriority(actionType: ActionType): ActionPriority {
  const priorityMap: Record<ActionType, ActionPriority> = {
    send_message: 'high',
    edit_message: 'normal',
    delete_message: 'normal',
    add_reaction: 'low',
    remove_reaction: 'low',
    update_status: 'normal',
    join_channel: 'high',
    leave_channel: 'normal',
    upload_file: 'normal',
    create_thread: 'high',
    update_profile: 'low',
    mark_read: 'low',
  };

  return priorityMap[actionType];
}
