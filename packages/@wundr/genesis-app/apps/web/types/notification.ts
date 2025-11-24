/**
 * Notification Types for Genesis App
 */

export type NotificationType =
  | 'message'
  | 'mention'
  | 'reaction'
  | 'thread_reply'
  | 'channel_invite'
  | 'call_incoming'
  | 'call_missed'
  | 'vp_update'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationActor {
  id: string;
  name: string;
  image?: string | null;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  read: boolean;
  createdAt: Date;
  actor?: NotificationActor;
  data?: Record<string, unknown>;
  actionUrl?: string;
  channelId?: string;
  messageId?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mobile: boolean;
  email: boolean;
  digestFrequency: 'instant' | 'hourly' | 'daily' | 'weekly' | 'never';
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
  };
  mutedChannels: string[];
  preferences: Record<NotificationType, {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  }>;
}

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
export type QueuedActionType = 'send_message' | 'add_reaction' | 'remove_reaction' | 'upload_file' | 'delete_message' | 'edit_message';

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
    vp_update: { enabled: true, sound: false, desktop: true },
    system: { enabled: true, sound: false, desktop: true },
  },
};
