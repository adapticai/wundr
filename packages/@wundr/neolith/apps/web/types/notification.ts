/**
 * Notification Types for Genesis App
 */

/**
 * Branded type for notification IDs to prevent mixing with other string IDs
 */
export type NotificationId = string & { readonly __brand: 'NotificationId' };

/**
 * Branded type for channel IDs to prevent mixing with other string IDs
 */
export type ChannelId = string & { readonly __brand: 'ChannelId' };

/**
 * Branded type for message IDs to prevent mixing with other string IDs
 */
export type MessageId = string & { readonly __brand: 'MessageId' };

/**
 * Available notification types in the system
 */
export type NotificationType =
  | 'message'
  | 'mention'
  | 'reaction'
  | 'thread_reply'
  | 'channel_invite'
  | 'call_incoming'
  | 'call_missed'
  | 'orchestrator_update'
  | 'system';

/**
 * Priority levels for notifications
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Represents the actor who triggered a notification
 */
export interface NotificationActor {
  /** Unique identifier for the actor */
  id: string;
  /** Display name of the actor */
  name: string;
  /** Optional avatar/profile image URL */
  image?: string | null;
}

/**
 * Additional metadata that can be attached to notifications
 */
export interface NotificationMetadata {
  /** Optional thread ID for thread-related notifications */
  threadId?: string;
  /** Optional call ID for call-related notifications */
  callId?: string;
  /** Optional reaction emoji for reaction notifications */
  emoji?: string;
  /** Optional orchestrator/VP details */
  orchestratorDetails?: {
    name: string;
    status: string;
    metrics?: Record<string, number>;
  };
  /** Extensible record for additional metadata */
  [key: string]: unknown;
}

/**
 * Core notification interface representing a single notification
 */
export interface Notification {
  /** Unique identifier for the notification */
  id: string;
  /** Type of notification */
  type: NotificationType;
  /** Notification title/heading */
  title: string;
  /** Notification body/message content */
  body: string;
  /** Priority level for display and behavior */
  priority: NotificationPriority;
  /** Whether the notification has been marked as read */
  read: boolean;
  /** Timestamp when notification was created */
  createdAt: Date;
  /** Optional actor who triggered the notification */
  actor?: NotificationActor;
  /** Optional structured metadata for the notification */
  data?: NotificationMetadata;
  /** Optional URL to navigate to when notification is clicked */
  actionUrl?: string;
  /** Optional channel ID for channel-related notifications */
  channelId?: string;
  /** Optional message ID for message-related notifications */
  messageId?: string;
}

/**
 * Frequency options for notification digests
 */
export type DigestFrequency =
  | 'instant'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'never';

/**
 * Configuration for quiet hours when notifications should be suppressed
 */
export interface QuietHoursConfig {
  /** Whether quiet hours are enabled */
  enabled: boolean;
  /** Start time in HH:mm format (24-hour) */
  start: string;
  /** End time in HH:mm format (24-hour) */
  end: string;
}

/**
 * Per-notification-type preferences
 */
export interface NotificationTypePreferences {
  /** Whether this notification type is enabled */
  enabled: boolean;
  /** Whether to play sound for this notification type */
  sound: boolean;
  /** Whether to show desktop notifications for this type */
  desktop: boolean;
}

/**
 * User's notification settings and preferences
 */
export interface NotificationSettings {
  /** Master switch for all notifications */
  enabled: boolean;
  /** Global sound setting */
  sound: boolean;
  /** Global desktop notification setting */
  desktop: boolean;
  /** Mobile push notification setting */
  mobile: boolean;
  /** Email notification setting */
  email: boolean;
  /** How frequently to send notification digests */
  digestFrequency: DigestFrequency;
  /** Configuration for quiet hours */
  quietHours: QuietHoursConfig;
  /** List of muted channel IDs */
  mutedChannels: string[];
  /** Per-notification-type preferences */
  preferences: Record<NotificationType, NotificationTypePreferences>;
}

/**
 * Synchronization status for offline-first functionality
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'conflict';

/**
 * Typed payload for queued message actions
 */
export interface MessageActionPayload {
  channelId: string;
  content: string;
  attachments?: string[];
}

/**
 * Typed payload for queued reaction actions
 */
export interface ReactionActionPayload {
  messageId: string;
  emoji: string;
}

/**
 * Typed payload for queued file actions
 */
export interface FileActionPayload {
  channelId: string;
  fileId: string;
  fileName: string;
}

/**
 * Generic action payload for extensibility
 */
export interface GenericActionPayload {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Union type for all queued action payloads
 */
export type QueuedActionPayload =
  | MessageActionPayload
  | ReactionActionPayload
  | FileActionPayload
  | GenericActionPayload;

/**
 * Queued action types for offline operations
 */
export type QueuedActionType =
  | 'send_message'
  | 'add_reaction'
  | 'remove_reaction'
  | 'upload_file'
  | 'delete_message'
  | 'edit_message';

/**
 * Represents a queued action waiting to be synced
 */
export interface QueuedAction {
  /** Unique identifier for the queued action */
  id: string;
  /** Type of action to perform */
  type: QueuedActionType;
  /** Action-specific payload data */
  payload: QueuedActionPayload;
  /** When the action was created */
  createdAt: Date;
  /** Number of sync retry attempts */
  retryCount: number;
}

/**
 * Data structure for conflict resolution containing either JSON-serializable data
 * Compatible with QueuedActionPayload types for seamless conflict detection
 */
export type ConflictData = QueuedActionPayload;

/**
 * Conflict types that can occur during sync
 */
export type ConflictType =
  | 'message_edit'
  | 'file_update'
  | 'settings_change'
  | 'profile_update'
  | QueuedActionType;

/**
 * Represents a sync conflict requiring user resolution
 */
export interface ConflictResolution {
  /** Unique identifier for the conflict */
  id: string;
  /** Local version of the data */
  localData: ConflictData;
  /** Server version of the data */
  serverData: ConflictData;
  /** Type of entity that has a conflict */
  type: ConflictType;
  /** When the conflict was detected */
  createdAt: Date;
}

/**
 * Default notification settings for new users
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  sound: true,
  desktop: true,
  mobile: true,
  email: false,
  digestFrequency: 'instant',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  mutedChannels: [],
  preferences: {
    message: { enabled: true, sound: true, desktop: true },
    mention: { enabled: true, sound: true, desktop: true },
    reaction: { enabled: true, sound: false, desktop: false },
    thread_reply: { enabled: true, sound: true, desktop: true },
    channel_invite: { enabled: true, sound: true, desktop: true },
    call_incoming: { enabled: true, sound: true, desktop: true },
    call_missed: { enabled: true, sound: false, desktop: true },
    orchestrator_update: { enabled: true, sound: false, desktop: true },
    system: { enabled: true, sound: false, desktop: true },
  },
} as const;

// ============================================================================
// Type Guards and Validation Utilities
// ============================================================================

/**
 * Type guard to check if a string is a valid NotificationType
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    [
      'message',
      'mention',
      'reaction',
      'thread_reply',
      'channel_invite',
      'call_incoming',
      'call_missed',
      'orchestrator_update',
      'system',
    ].includes(value)
  );
}

/**
 * Type guard to check if a string is a valid NotificationPriority
 */
export function isNotificationPriority(
  value: unknown
): value is NotificationPriority {
  return (
    typeof value === 'string' &&
    ['low', 'normal', 'high', 'urgent'].includes(value)
  );
}

/**
 * Type guard to check if a string is a valid DigestFrequency
 */
export function isDigestFrequency(value: unknown): value is DigestFrequency {
  return (
    typeof value === 'string' &&
    ['instant', 'hourly', 'daily', 'weekly', 'never'].includes(value)
  );
}

/**
 * Type guard to check if a string is a valid SyncStatus
 */
export function isSyncStatus(value: unknown): value is SyncStatus {
  return (
    typeof value === 'string' &&
    ['idle', 'syncing', 'synced', 'error', 'conflict'].includes(value)
  );
}

/**
 * Type guard to check if a string is a valid QueuedActionType
 */
export function isQueuedActionType(value: unknown): value is QueuedActionType {
  return (
    typeof value === 'string' &&
    [
      'send_message',
      'add_reaction',
      'remove_reaction',
      'upload_file',
      'delete_message',
      'edit_message',
    ].includes(value)
  );
}

/**
 * Type guard to validate a complete Notification object
 */
export function isNotification(value: unknown): value is Notification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const n = value as Partial<Notification>;

  return (
    typeof n.id === 'string' &&
    isNotificationType(n.type) &&
    typeof n.title === 'string' &&
    typeof n.body === 'string' &&
    isNotificationPriority(n.priority) &&
    typeof n.read === 'boolean' &&
    n.createdAt instanceof Date
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract notification types that are user-actionable (excludes system notifications)
 */
export type ActionableNotificationType = Exclude<NotificationType, 'system'>;

/**
 * Extract notification types that are call-related
 */
export type CallNotificationType = Extract<
  NotificationType,
  'call_incoming' | 'call_missed'
>;

/**
 * Extract notification types that are message-related
 */
export type MessageNotificationType = Extract<
  NotificationType,
  'message' | 'mention' | 'thread_reply'
>;

/**
 * Partial notification for creation (before server assigns ID and timestamp)
 */
export type NotificationInput = Omit<Notification, 'id' | 'createdAt' | 'read'>;

/**
 * Notification update payload (only mutable fields)
 */
export type NotificationUpdate = Partial<Pick<Notification, 'read'>>;

/**
 * Filters for querying notifications
 */
export interface NotificationFilters {
  /** Filter by notification type(s) */
  types?: NotificationType[];
  /** Filter by read status */
  read?: boolean;
  /** Filter by priority level(s) */
  priorities?: NotificationPriority[];
  /** Filter by channel ID */
  channelId?: string;
  /** Filter by date range */
  dateRange?: {
    from: Date;
    to: Date;
  };
}
