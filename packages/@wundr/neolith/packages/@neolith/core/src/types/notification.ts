/**
 * @genesis/core - Notification Type Definitions
 *
 * Type definitions for the push notification service layer including
 * push notifications, device management, preferences, and in-app notifications.
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Notification Types
// =============================================================================

/**
 * Platform type for device registration.
 */
export type DevicePlatform = 'web' | 'ios' | 'android';

/**
 * Notification type categories.
 */
export type NotificationType =
  | 'message'
  | 'mention'
  | 'thread_reply'
  | 'call_incoming'
  | 'call_missed'
  | 'channel_invite'
  | 'file_shared'
  | 'vp_status'
  | 'system';

/**
 * Notification priority level.
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Digest frequency for notification delivery.
 */
export type DigestFrequency = 'instant' | 'hourly' | 'daily' | 'none';

/**
 * Delivery status for a notification.
 */
export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'read';

// =============================================================================
// Push Notification Types
// =============================================================================

/**
 * Action button for a notification.
 */
export interface NotificationAction {
  /** Unique action identifier */
  action: string;
  /** Display title for the action */
  title: string;
  /** Optional icon URL for the action */
  icon?: string;
}

/**
 * Push notification payload.
 */
export interface PushNotification {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional icon URL */
  icon?: string;
  /** Badge count to display (mobile) */
  badge?: number;
  /** Custom data payload */
  data?: Record<string, unknown>;
  /** Interactive action buttons */
  actions?: NotificationAction[];
  /** Tag for notification grouping/replacement */
  tag?: string;
  /** Whether notification requires user interaction to dismiss */
  requireInteraction?: boolean;
  /** Notification priority */
  priority?: NotificationPriority;
  /** Time-to-live in seconds */
  ttl?: number;
  /** Collapse key for notification grouping */
  collapseKey?: string;
  /** Sound to play (mobile) */
  sound?: string;
  /** Click action URL */
  clickAction?: string;
  /** Image URL for rich notifications */
  image?: string;
}

/**
 * Result of a single push notification send.
 */
export interface PushSendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Device ID that was targeted */
  deviceId: string;
  /** Platform of the device */
  platform: DevicePlatform;
  /** Error message if failed */
  error?: string;
  /** Provider-specific message ID */
  messageId?: string;
}

/**
 * Result of a bulk push notification send.
 */
export interface BatchResult {
  /** Total notifications attempted */
  total: number;
  /** Number of successful sends */
  successful: number;
  /** Number of failed sends */
  failed: number;
  /** Individual results per device */
  results: PushSendResult[];
  /** Devices that had invalid tokens (for cleanup) */
  invalidTokens: string[];
}

// =============================================================================
// Device Types
// =============================================================================

/**
 * Input for registering a device.
 */
export interface DeviceRegistration {
  /** Push notification token from the platform */
  token: string;
  /** Device platform */
  platform: DevicePlatform;
  /** User agent string for identification */
  userAgent?: string;
  /** Device name (e.g., "John's iPhone") */
  deviceName?: string;
  /** App version */
  appVersion?: string;
  /** OS version */
  osVersion?: string;
}

/**
 * Registered device information.
 */
export interface Device {
  /** Unique device ID */
  id: string;
  /** User ID who owns the device */
  userId: string;
  /** Push notification token */
  token: string;
  /** Device platform */
  platform: DevicePlatform;
  /** User agent string */
  userAgent?: string;
  /** Device name */
  deviceName?: string;
  /** App version */
  appVersion?: string;
  /** OS version */
  osVersion?: string;
  /** Whether the device is active */
  isActive: boolean;
  /** When the token was last refreshed */
  tokenUpdatedAt: Date;
  /** When the device was registered */
  createdAt: Date;
  /** When the device was last seen */
  lastSeenAt: Date;
}

// =============================================================================
// Preference Types
// =============================================================================

/**
 * Quiet hours configuration.
 */
export interface QuietHours {
  /** Start time in HH:MM format (24-hour) */
  start: string;
  /** End time in HH:MM format (24-hour) */
  end: string;
  /** Timezone for the quiet hours (e.g., "America/New_York") */
  timezone?: string;
}

/**
 * User notification preferences.
 */
export interface NotificationPreferences {
  /** Receive notifications for new messages */
  messages: boolean;
  /** Receive notifications when mentioned */
  mentions: boolean;
  /** Receive notifications for thread replies */
  threads: boolean;
  /** Receive notifications for incoming calls */
  calls: boolean;
  /** Receive notifications for channel updates */
  channelUpdates: boolean;
  /** Receive notifications for Orchestrator status changes */
  vpStatus: boolean;
  /** Receive system notifications */
  system: boolean;
  /** Digest delivery frequency */
  digest: DigestFrequency;
  /** Quiet hours configuration */
  quietHours?: QuietHours;
  /** List of muted channel IDs */
  mutedChannels: string[];
  /** List of muted workspace IDs */
  mutedWorkspaces: string[];
  /** Email notification preferences */
  email: {
    /** Receive email notifications */
    enabled: boolean;
    /** Email digest frequency */
    digest: DigestFrequency;
  };
  /** Mobile-specific settings */
  mobile: {
    /** Enable push notifications on mobile */
    enabled: boolean;
    /** Enable vibration */
    vibrate: boolean;
    /** Enable sound */
    sound: boolean;
  };
  /** Desktop-specific settings */
  desktop: {
    /** Enable desktop notifications */
    enabled: boolean;
    /** Enable sound */
    sound: boolean;
  };
}

/**
 * Input for updating notification preferences.
 */
export type UpdatePreferencesInput = Partial<NotificationPreferences>;

// =============================================================================
// In-App Notification Types
// =============================================================================

/**
 * In-app notification record.
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** User ID who received the notification */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Whether the notification has been read */
  isRead: boolean;
  /** Associated resource ID (e.g., message ID, channel ID) */
  resourceId?: string;
  /** Resource type (e.g., "message", "channel") */
  resourceType?: string;
  /** Actor who triggered the notification */
  actorId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** When the notification was created */
  createdAt: Date;
  /** When the notification was read */
  readAt?: Date;
  /** When the notification expires */
  expiresAt?: Date;
}

/**
 * Input for creating an in-app notification.
 */
export interface CreateNotificationInput {
  /** User ID to notify */
  userId: string;
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  /** Associated resource ID */
  resourceId?: string;
  /** Resource type */
  resourceType?: string;
  /** Actor who triggered the notification */
  actorId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Optional expiration time */
  expiresAt?: Date;
  /** Whether to also send a push notification */
  sendPush?: boolean;
}

/**
 * Options for listing notifications.
 */
export interface NotificationListOptions {
  /** Maximum number of notifications to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by read status */
  isRead?: boolean;
  /** Filter by notification type */
  type?: NotificationType;
  /** Filter by created after date */
  after?: Date;
  /** Filter by created before date */
  before?: Date;
  /** Include expired notifications */
  includeExpired?: boolean;
}

/**
 * Paginated notification result.
 */
export interface PaginatedNotificationResult {
  /** Notification data */
  data: Notification[];
  /** Total count of notifications matching the query */
  total: number;
  /** Unread count */
  unreadCount: number;
  /** Whether there are more notifications */
  hasMore: boolean;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Types of notification events.
 */
export type NotificationEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'NOTIFICATION_DELETED'
  | 'PUSH_SENT'
  | 'PUSH_FAILED'
  | 'DEVICE_REGISTERED'
  | 'DEVICE_UNREGISTERED'
  | 'PREFERENCES_UPDATED';

/**
 * Base notification event structure.
 */
export interface BaseNotificationEvent {
  /** Event type */
  type: NotificationEventType;
  /** Event timestamp */
  timestamp: Date;
  /** User ID associated with the event */
  userId: string;
}

/**
 * Event emitted when a notification is created.
 */
export interface NotificationCreatedEvent extends BaseNotificationEvent {
  type: 'NOTIFICATION_CREATED';
  /** The created notification */
  notification: Notification;
}

/**
 * Event emitted when a notification is read.
 */
export interface NotificationReadEvent extends BaseNotificationEvent {
  type: 'NOTIFICATION_READ';
  /** The notification ID */
  notificationId: string;
}

/**
 * Event emitted when a push notification is sent.
 */
export interface PushSentEvent extends BaseNotificationEvent {
  type: 'PUSH_SENT';
  /** The notification payload */
  notification: PushNotification;
  /** Send result */
  result: PushSendResult | BatchResult;
}

/**
 * Union type of all notification events.
 */
export type NotificationEvent =
  | NotificationCreatedEvent
  | NotificationReadEvent
  | PushSentEvent;

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Callback for notification created events.
 */
export type OnNotificationCreatedCallback = (
  notification: Notification
) => void;

/**
 * Callback for notification read events.
 */
export type OnNotificationReadCallback = (notificationId: string) => void;

/**
 * Callback for push sent events.
 */
export type OnPushSentCallback = (
  notification: PushNotification,
  result: PushSendResult | BatchResult
) => void;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Web Push (VAPID) configuration.
 */
export interface WebPushConfig {
  /** VAPID public key */
  publicKey: string;
  /** VAPID private key */
  privateKey: string;
  /** Contact email for VAPID */
  contactEmail: string;
}

/**
 * Firebase Cloud Messaging configuration.
 */
export interface FCMConfig {
  /** Firebase project ID */
  projectId: string;
  /** Firebase private key */
  privateKey: string;
  /** Firebase client email */
  clientEmail: string;
}

/**
 * Overall notification service configuration.
 */
export interface NotificationServiceConfig {
  /** Web Push configuration */
  webPush?: WebPushConfig;
  /** FCM configuration */
  fcm?: FCMConfig;
  /** Default TTL for notifications (seconds) */
  defaultTTL?: number;
  /** Whether to respect quiet hours */
  respectQuietHours?: boolean;
  /** Batch size for bulk sends */
  batchSize?: number;
  /** Retry attempts for failed sends */
  retryAttempts?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid DevicePlatform.
 */
export function isDevicePlatform(value: unknown): value is DevicePlatform {
  return value === 'web' || value === 'ios' || value === 'android';
}

/**
 * Type guard to check if a value is a valid NotificationType.
 */
export function isNotificationType(value: unknown): value is NotificationType {
  const validTypes: NotificationType[] = [
    'message',
    'mention',
    'thread_reply',
    'call_incoming',
    'call_missed',
    'channel_invite',
    'file_shared',
    'vp_status',
    'system',
  ];
  return (
    typeof value === 'string' && validTypes.includes(value as NotificationType)
  );
}

/**
 * Type guard to check if a value is a valid DigestFrequency.
 */
export function isDigestFrequency(value: unknown): value is DigestFrequency {
  return (
    value === 'instant' ||
    value === 'hourly' ||
    value === 'daily' ||
    value === 'none'
  );
}

/**
 * Type guard to check if a value is a valid NotificationPreferences.
 */
export function isNotificationPreferences(
  value: unknown
): value is NotificationPreferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prefs = value as Record<string, unknown>;

  return (
    typeof prefs.messages === 'boolean' &&
    typeof prefs.mentions === 'boolean' &&
    typeof prefs.threads === 'boolean' &&
    typeof prefs.calls === 'boolean' &&
    typeof prefs.channelUpdates === 'boolean' &&
    isDigestFrequency(prefs.digest) &&
    Array.isArray(prefs.mutedChannels)
  );
}

/**
 * Type guard to check if a value is a valid DeviceRegistration.
 */
export function isDeviceRegistration(
  value: unknown
): value is DeviceRegistration {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const reg = value as Record<string, unknown>;

  return (
    typeof reg.token === 'string' &&
    reg.token.length > 0 &&
    isDevicePlatform(reg.platform)
  );
}

/**
 * Type guard to check if a value is a valid PushNotification.
 */
export function isPushNotification(value: unknown): value is PushNotification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const notif = value as Record<string, unknown>;

  return (
    typeof notif.title === 'string' &&
    notif.title.length > 0 &&
    typeof notif.body === 'string'
  );
}

/**
 * Type guard to check if a value is a valid CreateNotificationInput.
 */
export function isCreateNotificationInput(
  value: unknown
): value is CreateNotificationInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.userId === 'string' &&
    input.userId.length > 0 &&
    isNotificationType(input.type) &&
    typeof input.title === 'string' &&
    typeof input.body === 'string'
  );
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Default notification preferences.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  mentions: true,
  threads: true,
  calls: true,
  channelUpdates: true,
  vpStatus: true,
  system: true,
  digest: 'instant',
  quietHours: undefined,
  mutedChannels: [],
  mutedWorkspaces: [],
  email: {
    enabled: true,
    digest: 'daily',
  },
  mobile: {
    enabled: true,
    vibrate: true,
    sound: true,
  },
  desktop: {
    enabled: true,
    sound: true,
  },
};

/**
 * Default notification list options.
 */
export const DEFAULT_NOTIFICATION_LIST_OPTIONS: Required<
  Pick<NotificationListOptions, 'limit' | 'offset' | 'includeExpired'>
> = {
  limit: 50,
  offset: 0,
  includeExpired: false,
};

/**
 * Maximum notifications per page.
 */
export const MAX_NOTIFICATION_LIMIT = 100;

/**
 * Default TTL for push notifications (seconds).
 */
export const DEFAULT_PUSH_TTL = 86400; // 24 hours

/**
 * Maximum devices per user.
 */
export const MAX_DEVICES_PER_USER = 10;

/**
 * Valid notification types.
 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'message',
  'mention',
  'thread_reply',
  'call_incoming',
  'call_missed',
  'channel_invite',
  'file_shared',
  'vp_status',
  'system',
];

/**
 * Notification type to preference mapping.
 */
export const NOTIFICATION_TYPE_TO_PREFERENCE: Record<
  NotificationType,
  keyof Pick<
    NotificationPreferences,
    | 'messages'
    | 'mentions'
    | 'threads'
    | 'calls'
    | 'channelUpdates'
    | 'vpStatus'
    | 'system'
  >
> = {
  message: 'messages',
  mention: 'mentions',
  thread_reply: 'threads',
  call_incoming: 'calls',
  call_missed: 'calls',
  channel_invite: 'channelUpdates',
  file_shared: 'channelUpdates',
  vp_status: 'vpStatus',
  system: 'system',
};
