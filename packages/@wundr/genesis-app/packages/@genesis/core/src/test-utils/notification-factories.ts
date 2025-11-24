/**
 * Notification Test Data Factories
 *
 * Factory functions for creating consistent mock notification data in tests.
 * These factories provide sensible defaults while allowing overrides
 * for specific test scenarios.
 *
 * @module @genesis/core/test-utils/notification-factories
 */

import { vi } from 'vitest';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Notification type enumeration
 */
export type NotificationType =
  | 'MESSAGE'
  | 'MENTION'
  | 'REACTION'
  | 'THREAD_REPLY'
  | 'CHANNEL_INVITE'
  | 'CALL_STARTED'
  | 'SYSTEM';

/**
 * Push device platform enumeration
 */
export type DevicePlatform = 'WEB' | 'IOS' | 'ANDROID';

/**
 * Queued action status enumeration
 */
export type QueuedActionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Conflict resolution enumeration
 */
export type ConflictResolution = 'SERVER_WINS' | 'CLIENT_WINS' | 'MANUAL';

/**
 * Notification entity
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Push device entity
 */
export interface PushDevice {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification preferences entity
 */
export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  mentionEnabled: boolean;
  threadReplyEnabled: boolean;
  reactionEnabled: boolean;
  channelInviteEnabled: boolean;
  callStartedEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  quietHoursTimezone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Queued action entity
 */
export interface QueuedAction {
  id: string;
  userId: string;
  action: string;
  payload: Record<string, unknown>;
  status: QueuedActionStatus;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * Sync state entity
 */
export interface SyncState {
  userId: string;
  lastSyncAt: Date;
  syncToken: string;
  version: number;
}

/**
 * Sync conflict entity
 */
export interface SyncConflict {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  serverVersion: Record<string, unknown>;
  clientVersion: Record<string, unknown>;
  resolution: ConflictResolution | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/**
 * Sync data for tests
 */
export interface SyncData {
  syncToken: string;
  changes: {
    messages: unknown[];
    channels: unknown[];
    notifications: Notification[];
    deletedIds: string[];
  };
  conflicts: SyncConflict[];
}

// =============================================================================
// ID GENERATORS
// =============================================================================

let notificationIdCounter = 0;
let deviceIdCounter = 0;
let actionIdCounter = 0;
let conflictIdCounter = 0;

/**
 * Generate a unique test notification ID
 */
export function generateNotificationId(): string {
  notificationIdCounter += 1;
  return `notif_${Date.now()}_${notificationIdCounter}`;
}

/**
 * Generate a unique test device ID
 */
export function generateDeviceId(): string {
  deviceIdCounter += 1;
  return `device_${Date.now()}_${deviceIdCounter}`;
}

/**
 * Generate a unique test action ID
 */
export function generateActionId(): string {
  actionIdCounter += 1;
  return `action_${Date.now()}_${actionIdCounter}`;
}

/**
 * Generate a unique test conflict ID
 */
export function generateConflictId(): string {
  conflictIdCounter += 1;
  return `conflict_${Date.now()}_${conflictIdCounter}`;
}

/**
 * Generate a unique test user ID
 */
export function generateUserId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Reset ID counters (useful between test suites)
 */
export function resetNotificationIdCounters(): void {
  notificationIdCounter = 0;
  deviceIdCounter = 0;
  actionIdCounter = 0;
  conflictIdCounter = 0;
}

// =============================================================================
// NOTIFICATION FACTORIES
// =============================================================================

/**
 * Create a mock notification
 */
export function createMockNotification(overrides?: Partial<Notification>): Notification {
  const now = new Date();
  const id = overrides?.id ?? generateNotificationId();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id,
    userId,
    type: 'MESSAGE',
    title: 'New message',
    body: 'You have a new message',
    data: null,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock mention notification
 */
export function createMockMentionNotification(
  overrides?: Partial<Notification>
): Notification {
  return createMockNotification({
    type: 'MENTION',
    title: 'You were mentioned',
    body: '@user mentioned you in #general',
    data: {
      channelId: 'ch_123',
      messageId: 'msg_456',
      mentionedBy: 'usr_789',
    },
    ...overrides,
  });
}

/**
 * Create a mock thread reply notification
 */
export function createMockThreadReplyNotification(
  overrides?: Partial<Notification>
): Notification {
  return createMockNotification({
    type: 'THREAD_REPLY',
    title: 'New reply in thread',
    body: 'Someone replied to your message',
    data: {
      channelId: 'ch_123',
      parentMessageId: 'msg_parent',
      replyMessageId: 'msg_reply',
      repliedBy: 'usr_789',
    },
    ...overrides,
  });
}

/**
 * Create a mock call started notification
 */
export function createMockCallNotification(
  overrides?: Partial<Notification>
): Notification {
  return createMockNotification({
    type: 'CALL_STARTED',
    title: 'Call started',
    body: 'A call has started in #general',
    data: {
      channelId: 'ch_123',
      callId: 'call_456',
      startedBy: 'usr_789',
      callType: 'video',
    },
    ...overrides,
  });
}

/**
 * Create a list of mock notifications
 */
export function createMockNotificationList(
  count: number,
  overrides?: Partial<Notification>
): Notification[] {
  const userId = overrides?.userId ?? generateUserId();
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(baseTime.getTime() - index * 60000);
    return createMockNotification({
      ...overrides,
      userId,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

// =============================================================================
// PUSH DEVICE FACTORIES
// =============================================================================

/**
 * Create a mock push device
 */
export function createMockPushDevice(overrides?: Partial<PushDevice>): PushDevice {
  const now = new Date();
  const id = overrides?.id ?? generateDeviceId();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id,
    userId,
    platform: 'WEB',
    token: `token_${Date.now()}_${Math.random().toString(36).substring(2, 16)}`,
    endpoint: null,
    p256dh: null,
    auth: null,
    isActive: true,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock web push device
 */
export function createMockWebPushDevice(overrides?: Partial<PushDevice>): PushDevice {
  return createMockPushDevice({
    platform: 'WEB',
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
    auth: 'tBHItJI5svbpez7KI4CCXg',
    ...overrides,
  });
}

/**
 * Create a mock FCM device (iOS/Android)
 */
export function createMockFCMDevice(
  platform: 'IOS' | 'ANDROID',
  overrides?: Partial<PushDevice>
): PushDevice {
  return createMockPushDevice({
    platform,
    token: `fcm_token_${Date.now()}_${Math.random().toString(36).substring(2, 32)}`,
    endpoint: null,
    p256dh: null,
    auth: null,
    ...overrides,
  });
}

/**
 * Create a list of mock push devices
 */
export function createMockPushDeviceList(
  count: number,
  overrides?: Partial<PushDevice>
): PushDevice[] {
  const userId = overrides?.userId ?? generateUserId();

  return Array.from({ length: count }, (_, index) => {
    const platforms: DevicePlatform[] = ['WEB', 'IOS', 'ANDROID'];
    return createMockPushDevice({
      ...overrides,
      userId,
      platform: platforms[index % 3],
    });
  });
}

// =============================================================================
// PREFERENCES FACTORIES
// =============================================================================

/**
 * Create mock notification preferences
 */
export function createMockPreferences(
  overrides?: Partial<NotificationPreferences>
): NotificationPreferences {
  const now = new Date();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id: `pref_${userId}`,
    userId,
    emailEnabled: true,
    pushEnabled: true,
    mentionEnabled: true,
    threadReplyEnabled: true,
    reactionEnabled: true,
    channelInviteEnabled: true,
    callStartedEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursTimezone: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create mock preferences with quiet hours
 */
export function createMockPreferencesWithQuietHours(
  overrides?: Partial<NotificationPreferences>
): NotificationPreferences {
  return createMockPreferences({
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursTimezone: 'America/New_York',
    ...overrides,
  });
}

/**
 * Create mock preferences with all disabled
 */
export function createMockDisabledPreferences(
  overrides?: Partial<NotificationPreferences>
): NotificationPreferences {
  return createMockPreferences({
    emailEnabled: false,
    pushEnabled: false,
    mentionEnabled: false,
    threadReplyEnabled: false,
    reactionEnabled: false,
    channelInviteEnabled: false,
    callStartedEnabled: false,
    ...overrides,
  });
}

// =============================================================================
// QUEUED ACTION FACTORIES
// =============================================================================

/**
 * Create a mock queued action
 */
export function createMockQueuedAction(overrides?: Partial<QueuedAction>): QueuedAction {
  const now = new Date();
  const id = overrides?.id ?? generateActionId();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id,
    userId,
    action: 'SEND_MESSAGE',
    payload: {
      channelId: 'ch_123',
      content: 'Test message',
    },
    status: 'PENDING',
    retryCount: 0,
    maxRetries: 3,
    error: null,
    createdAt: now,
    processedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock failed queued action
 */
export function createMockFailedQueuedAction(
  overrides?: Partial<QueuedAction>
): QueuedAction {
  return createMockQueuedAction({
    status: 'FAILED',
    retryCount: 3,
    error: 'Network error: Request timeout',
    ...overrides,
  });
}

/**
 * Create a list of mock queued actions
 */
export function createMockQueuedActionList(
  count: number,
  overrides?: Partial<QueuedAction>
): QueuedAction[] {
  const userId = overrides?.userId ?? generateUserId();
  const baseTime = new Date();

  return Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(baseTime.getTime() - index * 1000);
    return createMockQueuedAction({
      ...overrides,
      userId,
      createdAt,
    });
  });
}

// =============================================================================
// SYNC DATA FACTORIES
// =============================================================================

/**
 * Create mock sync state
 */
export function createMockSyncState(overrides?: Partial<SyncState>): SyncState {
  const userId = overrides?.userId ?? generateUserId();
  const version = overrides?.version ?? 1;

  return {
    userId,
    lastSyncAt: new Date(),
    syncToken: Buffer.from(
      JSON.stringify({ userId, version, timestamp: Date.now() })
    ).toString('base64'),
    version,
    ...overrides,
  };
}

/**
 * Create mock sync conflict
 */
export function createMockSyncConflict(overrides?: Partial<SyncConflict>): SyncConflict {
  const now = new Date();
  const id = overrides?.id ?? generateConflictId();
  const userId = overrides?.userId ?? generateUserId();

  return {
    id,
    userId,
    entityType: 'message',
    entityId: 'msg_123',
    serverVersion: {
      content: 'Server version content',
      updatedAt: new Date().toISOString(),
    },
    clientVersion: {
      content: 'Client version content',
      updatedAt: new Date(Date.now() - 1000).toISOString(),
    },
    resolution: null,
    resolvedAt: null,
    createdAt: now,
    ...overrides,
  };
}

/**
 * Create mock sync data
 */
export function createMockSyncData(overrides?: Partial<SyncData>): SyncData {
  const userId = generateUserId();
  const version = 1;

  return {
    syncToken: Buffer.from(
      JSON.stringify({ userId, version, timestamp: Date.now() })
    ).toString('base64'),
    changes: {
      messages: [],
      channels: [],
      notifications: [],
      deletedIds: [],
    },
    conflicts: [],
    ...overrides,
  };
}

/**
 * Create mock sync data with notifications
 */
export function createMockSyncDataWithNotifications(
  notificationCount: number,
  overrides?: Partial<SyncData>
): SyncData {
  const userId = generateUserId();
  const notifications = createMockNotificationList(notificationCount, { userId });

  return createMockSyncData({
    changes: {
      messages: [],
      channels: [],
      notifications,
      deletedIds: [],
    },
    ...overrides,
  });
}

/**
 * Create mock sync data with conflicts
 */
export function createMockSyncDataWithConflicts(
  conflictCount: number,
  overrides?: Partial<SyncData>
): SyncData {
  const userId = generateUserId();
  const conflicts = Array.from({ length: conflictCount }, () =>
    createMockSyncConflict({ userId })
  );

  return createMockSyncData({
    conflicts,
    ...overrides,
  });
}

// =============================================================================
// MOCK SERVICE FACTORIES
// =============================================================================

/**
 * Create a mock notification service
 */
export function createMockNotificationService() {
  return {
    sendPush: vi.fn().mockResolvedValue(undefined),
    registerDevice: vi.fn(),
    unregisterDevice: vi.fn().mockResolvedValue(undefined),
    isInQuietHours: vi.fn().mockResolvedValue(false),
    getPreferences: vi.fn(),
    createNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    getUnreadCount: vi.fn(),
  };
}

/**
 * Create a mock push provider
 */
export function createMockPushProvider() {
  return {
    sendWebPush: vi.fn().mockResolvedValue({ success: true }),
    sendFCM: vi.fn().mockResolvedValue({ success: true, messageId: 'msg_123' }),
    sendAPNS: vi.fn().mockResolvedValue({ success: true }),
    validateToken: vi.fn().mockResolvedValue(true),
    refreshToken: vi.fn().mockResolvedValue('new_token_123'),
  };
}

/**
 * Create a mock offline queue service
 */
export function createMockOfflineQueueService() {
  return {
    enqueue: vi.fn(),
    processQueue: vi.fn(),
    retryFailed: vi.fn(),
    getQueueStatus: vi.fn(),
    clearQueue: vi.fn(),
  };
}

/**
 * Create a mock sync service
 */
export function createMockSyncService() {
  return {
    performSync: vi.fn(),
    getChanges: vi.fn(),
    detectConflicts: vi.fn(),
    resolveConflict: vi.fn(),
    getSyncState: vi.fn(),
    updateSyncState: vi.fn(),
  };
}

// =============================================================================
// MOCK PRISMA CLIENT EXTENSIONS
// =============================================================================

/**
 * Create mock Prisma notification model
 */
export function createMockPrismaNotificationModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  };
}

/**
 * Create mock Prisma push device model
 */
export function createMockPrismaPushDeviceModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create mock Prisma notification preference model
 */
export function createMockPrismaNotificationPreferenceModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
}

/**
 * Create mock Prisma offline queue action model
 */
export function createMockPrismaOfflineQueueActionModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

/**
 * Create mock Prisma sync state model
 */
export function createMockPrismaSyncStateModel() {
  return {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  };
}

/**
 * Create mock Prisma sync conflict model
 */
export function createMockPrismaSyncConflictModel() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  };
}

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const NotificationFactories = {
  // Notification factories
  notification: createMockNotification,
  mentionNotification: createMockMentionNotification,
  threadReplyNotification: createMockThreadReplyNotification,
  callNotification: createMockCallNotification,
  notificationList: createMockNotificationList,

  // Push device factories
  pushDevice: createMockPushDevice,
  webPushDevice: createMockWebPushDevice,
  fcmDevice: createMockFCMDevice,
  pushDeviceList: createMockPushDeviceList,

  // Preferences factories
  preferences: createMockPreferences,
  preferencesWithQuietHours: createMockPreferencesWithQuietHours,
  disabledPreferences: createMockDisabledPreferences,

  // Queued action factories
  queuedAction: createMockQueuedAction,
  failedQueuedAction: createMockFailedQueuedAction,
  queuedActionList: createMockQueuedActionList,

  // Sync data factories
  syncState: createMockSyncState,
  syncConflict: createMockSyncConflict,
  syncData: createMockSyncData,
  syncDataWithNotifications: createMockSyncDataWithNotifications,
  syncDataWithConflicts: createMockSyncDataWithConflicts,

  // Service factories
  notificationService: createMockNotificationService,
  pushProvider: createMockPushProvider,
  offlineQueueService: createMockOfflineQueueService,
  syncService: createMockSyncService,

  // Prisma model factories
  prismaNotification: createMockPrismaNotificationModel,
  prismaPushDevice: createMockPrismaPushDeviceModel,
  prismaNotificationPreference: createMockPrismaNotificationPreferenceModel,
  prismaOfflineQueueAction: createMockPrismaOfflineQueueActionModel,
  prismaSyncState: createMockPrismaSyncStateModel,
  prismaSyncConflict: createMockPrismaSyncConflictModel,

  // Utility
  resetCounters: resetNotificationIdCounters,
};

export default NotificationFactories;
