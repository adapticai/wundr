/**
 * Notification GraphQL Resolvers
 *
 * Comprehensive resolvers for notification operations including queries, mutations,
 * subscriptions, and field resolvers. Implements push notifications, device management,
 * sync operations, and offline queue processing.
 *
 * @module @genesis/api-types/resolvers/notification-resolvers
 */

import { GraphQLError } from 'graphql';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Notification type enum
 */
export const NotificationType = {
  Message: 'MESSAGE',
  Mention: 'MENTION',
  Reaction: 'REACTION',
  ThreadReply: 'THREAD_REPLY',
  ChannelInvite: 'CHANNEL_INVITE',
  CallStarted: 'CALL_STARTED',
  System: 'SYSTEM',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

/**
 * Push device platform enum
 */
export const DevicePlatform = {
  Web: 'WEB',
  iOS: 'IOS',
  Android: 'ANDROID',
} as const;

export type DevicePlatformType = (typeof DevicePlatform)[keyof typeof DevicePlatform];

/**
 * Sync type enum
 */
export const SyncType = {
  Full: 'FULL',
  Incremental: 'INCREMENTAL',
} as const;

export type SyncTypeValue = (typeof SyncType)[keyof typeof SyncType];

/**
 * Conflict resolution strategy enum
 */
export const ConflictResolution = {
  ServerWins: 'SERVER_WINS',
  ClientWins: 'CLIENT_WINS',
  Manual: 'MANUAL',
} as const;

export type ConflictResolutionType = (typeof ConflictResolution)[keyof typeof ConflictResolution];

/**
 * Queued action status enum
 */
export const QueuedActionStatus = {
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const;

export type QueuedActionStatusType = (typeof QueuedActionStatus)[keyof typeof QueuedActionStatus];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Generic Prisma model interface for notification-related operations
 * These interfaces allow the resolvers to work before the Prisma schema is updated
 */
interface PrismaModel {
  findUnique: (args: unknown) => Promise<unknown>;
  findFirst: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<{ count: number }>;
  delete: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<{ count: number }>;
  count: (args: unknown) => Promise<number>;
  upsert: (args: unknown) => Promise<unknown>;
}

/**
 * Prisma client interface with notification models
 * This allows the resolvers to work whether or not the models exist in the schema
 */
interface PrismaClientWithNotifications {
  notification: PrismaModel;
  notificationPreference: PrismaModel;
  pushDevice: PrismaModel;
  syncState: PrismaModel;
  syncConflict: PrismaModel;
  offlineQueueAction: PrismaModel;
  user: PrismaModel;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClientWithNotifications;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Optional notification service for business logic */
  notificationService?: NotificationService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Notification Service interface for business logic operations
 */
export interface NotificationService {
  /** Send push notification */
  sendPush(userId: string, notification: NotificationInput): Promise<void>;
  /** Register push device */
  registerDevice(userId: string, device: PushDeviceInput): Promise<PushDevice>;
  /** Unregister push device */
  unregisterDevice(userId: string, deviceId: string): Promise<void>;
  /** Check if in quiet hours */
  isInQuietHours(userId: string): Promise<boolean>;
  /** Get user notification preferences */
  getPreferences(userId: string): Promise<NotificationPreferences>;
}

// =============================================================================
// ENTITY TYPES
// =============================================================================

/**
 * Notification entity type
 */
interface Notification {
  id: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  data: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Push device entity type
 */
interface PushDevice {
  id: string;
  userId: string;
  platform: DevicePlatformType;
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
 * Notification preferences entity type
 */
interface NotificationPreferences {
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
 * Sync state entity type
 */
interface SyncState {
  userId: string;
  lastSyncAt: Date;
  syncToken: string;
  version: number;
}

/**
 * Queued action entity type
 */
interface QueuedAction {
  id: string;
  userId: string;
  action: string;
  payload: unknown;
  status: QueuedActionStatusType;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

/**
 * Sync conflict entity type
 */
interface SyncConflict {
  id: string;
  userId: string;
  entityType: string;
  entityId: string;
  serverVersion: unknown;
  clientVersion: unknown;
  resolution: ConflictResolutionType | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a notification
 */
interface NotificationInput {
  type: NotificationTypeValue;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
}

/**
 * Filter input for notifications
 */
interface NotificationFilterInput {
  type?: NotificationTypeValue | null;
  isRead?: boolean | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/**
 * Pagination input
 */
interface PaginationInput {
  cursor?: string | null;
  limit?: number | null;
}

/**
 * Input for updating notification preferences
 */
interface UpdateNotificationPreferencesInput {
  emailEnabled?: boolean | null;
  pushEnabled?: boolean | null;
  mentionEnabled?: boolean | null;
  threadReplyEnabled?: boolean | null;
  reactionEnabled?: boolean | null;
  channelInviteEnabled?: boolean | null;
  callStartedEnabled?: boolean | null;
  quietHoursEnabled?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  quietHoursTimezone?: string | null;
}

/**
 * Input for registering a push device
 */
interface PushDeviceInput {
  platform: DevicePlatformType;
  token: string;
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
}

/**
 * Input for sync operation
 */
interface SyncInput {
  type: SyncTypeValue;
  syncToken?: string | null;
  lastSyncAt?: Date | null;
}

/**
 * Input for offline queue action
 */
interface OfflineActionInput {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Input for conflict resolution
 */
interface ConflictResolutionInput {
  resolution: ConflictResolutionType;
  mergedData?: Record<string, unknown> | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface NotificationsQueryArgs {
  filter?: NotificationFilterInput | null;
  pagination?: PaginationInput | null;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface MarkNotificationReadArgs {
  id: string;
}

interface DeleteNotificationArgs {
  id: string;
}

interface UpdatePreferencesArgs {
  input: UpdateNotificationPreferencesInput;
}

interface RegisterDeviceArgs {
  input: PushDeviceInput;
}

interface UnregisterDeviceArgs {
  deviceId: string;
}

interface PerformSyncArgs {
  input: SyncInput;
}

interface ProcessOfflineQueueArgs {
  actions: OfflineActionInput[];
}

interface ResolveConflictArgs {
  conflictId: string;
  resolution: ConflictResolutionInput;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface NotificationPayload {
  notification: Notification | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface PreferencesPayload {
  preferences: NotificationPreferences | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface DevicePayload {
  device: PushDevice | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface SyncPayload {
  syncToken: string;
  changes: SyncChanges;
  conflicts: SyncConflict[];
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface SyncChanges {
  messages: unknown[];
  channels: unknown[];
  notifications: Notification[];
  deletedIds: string[];
}

interface QueueProcessResult {
  processed: number;
  failed: number;
  results: Array<{
    actionId: string;
    success: boolean;
    error?: string;
  }>;
}

interface ConflictPayload {
  conflict: SyncConflict | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for new notifications */
export const NOTIFICATION_RECEIVED = 'NOTIFICATION_RECEIVED';

/** Event name for sync required */
export const SYNC_REQUIRED = 'SYNC_REQUIRED';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Generate cursor from notification for pagination
 */
function generateCursor(notification: Notification): string {
  return Buffer.from(`${notification.createdAt.toISOString()}:${notification.id}`).toString(
    'base64'
  );
}

/**
 * Parse cursor to get timestamp and ID
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Generate sync token
 */
function generateSyncToken(userId: string, version: number): string {
  const data = { userId, version, timestamp: Date.now() };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Parse sync token
 */
function parseSyncToken(token: string): { userId: string; version: number; timestamp: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// =============================================================================
// NOTIFICATION QUERY RESOLVERS
// =============================================================================

/**
 * Notification Query resolvers
 */
export const notificationQueries = {
  /**
   * Get paginated notifications for the current user
   */
  notifications: async (
    _parent: unknown,
    args: NotificationsQueryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { filter, pagination } = args;
    const limit = Math.min(Math.max(pagination?.limit ?? 50, 1), 100);

    // Build where clause
    const where: Record<string, unknown> = {
      userId: context.user.id,
    };

    if (filter?.type) {
      where.type = filter.type;
    }

    if (filter?.isRead !== undefined && filter?.isRead !== null) {
      where.isRead = filter.isRead;
    }

    if (filter?.dateFrom) {
      where.createdAt = { ...(where.createdAt as object), gte: filter.dateFrom };
    }

    if (filter?.dateTo) {
      where.createdAt = { ...(where.createdAt as object), lte: filter.dateTo };
    }

    // Handle cursor pagination
    if (pagination?.cursor) {
      const parsed = parseCursor(pagination.cursor);
      if (parsed) {
        where.OR = [
          { createdAt: { lt: parsed.timestamp } },
          { createdAt: parsed.timestamp, id: { lt: parsed.id } },
        ];
      }
    }

    const notifications = await context.prisma.notification.findMany({
      where,
      take: limit + 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const totalCount = await context.prisma.notification.count({
      where: { userId: context.user.id },
    });

    const hasNextPage = notifications.length > limit;
    const nodes = hasNextPage ? notifications.slice(0, -1) : notifications;

    const edges = nodes.map((n) => ({
      node: n as Notification,
      cursor: generateCursor(n as Notification),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!pagination?.cursor,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get unread notification count
   */
  unreadCount: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext
  ): Promise<number> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    return context.prisma.notification.count({
      where: {
        userId: context.user.id,
        isRead: false,
      },
    });
  },

  /**
   * Get notification preferences
   */
  notificationPreferences: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext
  ): Promise<NotificationPreferences | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const preferences = await context.prisma.notificationPreference.findUnique({
      where: { userId: context.user.id },
    });

    if (!preferences) {
      // Return default preferences
      return {
        id: '',
        userId: context.user.id,
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return preferences as NotificationPreferences;
  },

  /**
   * Get registered push devices
   */
  pushDevices: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext
  ): Promise<PushDevice[]> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const devices = await context.prisma.pushDevice.findMany({
      where: {
        userId: context.user.id,
        isActive: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return devices as PushDevice[];
  },

  /**
   * Get sync state
   */
  syncState: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext
  ): Promise<SyncState | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const state = await context.prisma.syncState.findUnique({
      where: { userId: context.user.id },
    });

    if (!state) {
      return {
        userId: context.user.id,
        lastSyncAt: new Date(0),
        syncToken: generateSyncToken(context.user.id, 0),
        version: 0,
      };
    }

    return state as SyncState;
  },
};

// =============================================================================
// NOTIFICATION MUTATION RESOLVERS
// =============================================================================

/**
 * Notification Mutation resolvers
 */
export const notificationMutations = {
  /**
   * Mark a single notification as read
   */
  markNotificationRead: async (
    _parent: unknown,
    args: MarkNotificationReadArgs,
    context: GraphQLContext
  ): Promise<NotificationPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const notification = await context.prisma.notification.findUnique({
      where: { id: args.id },
    }) as Notification | null;

    if (!notification) {
      return {
        notification: null,
        errors: [{ code: 'NOT_FOUND', message: 'Notification not found' }],
      };
    }

    // Verify ownership
    if (notification.userId !== context.user.id) {
      throw new GraphQLError('Access denied', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    const updated = await context.prisma.notification.update({
      where: { id: args.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    }) as Notification;

    return {
      notification: updated,
      errors: [],
    };
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: async (
    _parent: unknown,
    _args: Record<string, never>,
    context: GraphQLContext
  ): Promise<{ count: number; errors: Array<{ code: string; message: string }> }> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const result = await context.prisma.notification.updateMany({
      where: {
        userId: context.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      count: result.count,
      errors: [],
    };
  },

  /**
   * Delete a notification
   */
  deleteNotification: async (
    _parent: unknown,
    args: DeleteNotificationArgs,
    context: GraphQLContext
  ): Promise<{ success: boolean; errors: Array<{ code: string; message: string }> }> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const notification = await context.prisma.notification.findUnique({
      where: { id: args.id },
    }) as Notification | null;

    if (!notification) {
      return {
        success: false,
        errors: [{ code: 'NOT_FOUND', message: 'Notification not found' }],
      };
    }

    if (notification.userId !== context.user.id) {
      throw new GraphQLError('Access denied', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await context.prisma.notification.delete({
      where: { id: args.id },
    });

    return {
      success: true,
      errors: [],
    };
  },

  /**
   * Update notification preferences
   */
  updateNotificationPreferences: async (
    _parent: unknown,
    args: UpdatePreferencesArgs,
    context: GraphQLContext
  ): Promise<PreferencesPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate quiet hours if enabled
    if (input.quietHoursEnabled) {
      if (!input.quietHoursStart || !input.quietHoursEnd || !input.quietHoursTimezone) {
        return {
          preferences: null,
          errors: [{
            code: 'VALIDATION_ERROR',
            message: 'Quiet hours start, end, and timezone are required when quiet hours are enabled',
          }],
        };
      }
    }

    const preferences = await context.prisma.notificationPreference.upsert({
      where: { userId: context.user.id },
      update: {
        ...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
        ...(input.pushEnabled !== undefined && { pushEnabled: input.pushEnabled }),
        ...(input.mentionEnabled !== undefined && { mentionEnabled: input.mentionEnabled }),
        ...(input.threadReplyEnabled !== undefined && { threadReplyEnabled: input.threadReplyEnabled }),
        ...(input.reactionEnabled !== undefined && { reactionEnabled: input.reactionEnabled }),
        ...(input.channelInviteEnabled !== undefined && { channelInviteEnabled: input.channelInviteEnabled }),
        ...(input.callStartedEnabled !== undefined && { callStartedEnabled: input.callStartedEnabled }),
        ...(input.quietHoursEnabled !== undefined && { quietHoursEnabled: input.quietHoursEnabled }),
        ...(input.quietHoursStart !== undefined && { quietHoursStart: input.quietHoursStart }),
        ...(input.quietHoursEnd !== undefined && { quietHoursEnd: input.quietHoursEnd }),
        ...(input.quietHoursTimezone !== undefined && { quietHoursTimezone: input.quietHoursTimezone }),
      },
      create: {
        userId: context.user.id,
        emailEnabled: input.emailEnabled ?? true,
        pushEnabled: input.pushEnabled ?? true,
        mentionEnabled: input.mentionEnabled ?? true,
        threadReplyEnabled: input.threadReplyEnabled ?? true,
        reactionEnabled: input.reactionEnabled ?? true,
        channelInviteEnabled: input.channelInviteEnabled ?? true,
        callStartedEnabled: input.callStartedEnabled ?? true,
        quietHoursEnabled: input.quietHoursEnabled ?? false,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
        quietHoursTimezone: input.quietHoursTimezone ?? null,
      },
    });

    return {
      preferences: preferences as NotificationPreferences,
      errors: [],
    };
  },

  /**
   * Register a push device
   */
  registerPushDevice: async (
    _parent: unknown,
    args: RegisterDeviceArgs,
    context: GraphQLContext
  ): Promise<DevicePayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;

    // Validate platform-specific fields
    if (input.platform === 'WEB') {
      if (!input.endpoint || !input.p256dh || !input.auth) {
        return {
          device: null,
          errors: [{
            code: 'VALIDATION_ERROR',
            message: 'Web push requires endpoint, p256dh, and auth keys',
          }],
        };
      }
    }

    // Upsert device (update if token already exists)
    const device = await context.prisma.pushDevice.upsert({
      where: {
        userId_token: {
          userId: context.user.id,
          token: input.token,
        },
      },
      update: {
        platform: input.platform,
        endpoint: input.endpoint ?? null,
        p256dh: input.p256dh ?? null,
        auth: input.auth ?? null,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId: context.user.id,
        platform: input.platform,
        token: input.token,
        endpoint: input.endpoint ?? null,
        p256dh: input.p256dh ?? null,
        auth: input.auth ?? null,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });

    return {
      device: device as PushDevice,
      errors: [],
    };
  },

  /**
   * Unregister a push device
   */
  unregisterPushDevice: async (
    _parent: unknown,
    args: UnregisterDeviceArgs,
    context: GraphQLContext
  ): Promise<{ success: boolean; errors: Array<{ code: string; message: string }> }> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const device = await context.prisma.pushDevice.findUnique({
      where: { id: args.deviceId },
    }) as PushDevice | null;

    if (!device) {
      return {
        success: false,
        errors: [{ code: 'NOT_FOUND', message: 'Device not found' }],
      };
    }

    if (device.userId !== context.user.id) {
      throw new GraphQLError('Access denied', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Soft delete - mark as inactive
    await context.prisma.pushDevice.update({
      where: { id: args.deviceId },
      data: { isActive: false },
    });

    return {
      success: true,
      errors: [],
    };
  },

  /**
   * Perform sync operation (full or incremental)
   */
  performSync: async (
    _parent: unknown,
    args: PerformSyncArgs,
    context: GraphQLContext
  ): Promise<SyncPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { input } = args;
    let lastSyncAt = new Date(0);
    let currentVersion = 0;

    // For incremental sync, parse the sync token
    if (input.type === 'INCREMENTAL' && input.syncToken) {
      const parsed = parseSyncToken(input.syncToken);
      if (parsed && parsed.userId === context.user.id) {
        lastSyncAt = new Date(parsed.timestamp);
        currentVersion = parsed.version;
      }
    }

    // Get changes since last sync
    const [notifications, conflicts] = await Promise.all([
      context.prisma.notification.findMany({
        where: {
          userId: context.user.id,
          updatedAt: { gt: lastSyncAt },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      context.prisma.syncConflict.findMany({
        where: {
          userId: context.user.id,
          resolvedAt: null,
        },
      }),
    ]);

    // Update sync state
    const newVersion = currentVersion + 1;
    const newSyncToken = generateSyncToken(context.user.id, newVersion);

    await context.prisma.syncState.upsert({
      where: { userId: context.user.id },
      update: {
        lastSyncAt: new Date(),
        syncToken: newSyncToken,
        version: newVersion,
      },
      create: {
        userId: context.user.id,
        lastSyncAt: new Date(),
        syncToken: newSyncToken,
        version: newVersion,
      },
    });

    return {
      syncToken: newSyncToken,
      changes: {
        messages: [],
        channels: [],
        notifications: notifications as Notification[],
        deletedIds: [],
      },
      conflicts: conflicts as SyncConflict[],
      errors: [],
    };
  },

  /**
   * Process offline queue actions
   */
  processOfflineQueue: async (
    _parent: unknown,
    args: ProcessOfflineQueueArgs,
    context: GraphQLContext
  ): Promise<QueueProcessResult> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { actions } = args;
    const results: QueueProcessResult['results'] = [];
    let processed = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        // Store the action in the queue
        await context.prisma.offlineQueueAction.create({
          data: {
            id: action.id,
            userId: context.user.id,
            action: action.action,
            payload: action.payload,
            status: 'PENDING',
            retryCount: 0,
            maxRetries: 3,
            createdAt: action.timestamp,
          },
        });

        // Process the action (simplified - real implementation would dispatch to appropriate handler)
        await context.prisma.offlineQueueAction.update({
          where: { id: action.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });

        results.push({ actionId: action.id, success: true });
        processed++;
      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failed++;
      }
    }

    // Publish sync required event if there were changes
    if (processed > 0) {
      await context.pubsub.publish(`${SYNC_REQUIRED}_${context.user.id}`, {
        syncRequired: { reason: 'OFFLINE_QUEUE_PROCESSED', count: processed },
      });
    }

    return { processed, failed, results };
  },

  /**
   * Resolve a sync conflict
   */
  resolveConflict: async (
    _parent: unknown,
    args: ResolveConflictArgs,
    context: GraphQLContext
  ): Promise<ConflictPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { conflictId, resolution } = args;

    const conflict = await context.prisma.syncConflict.findUnique({
      where: { id: conflictId },
    }) as SyncConflict | null;

    if (!conflict) {
      return {
        conflict: null,
        errors: [{ code: 'NOT_FOUND', message: 'Conflict not found' }],
      };
    }

    if (conflict.userId !== context.user.id) {
      throw new GraphQLError('Access denied', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (conflict.resolvedAt) {
      return {
        conflict: null,
        errors: [{ code: 'ALREADY_RESOLVED', message: 'Conflict has already been resolved' }],
      };
    }

    const updated = await context.prisma.syncConflict.update({
      where: { id: conflictId },
      data: {
        resolution: resolution.resolution,
        resolvedAt: new Date(),
      },
    }) as SyncConflict;

    return {
      conflict: updated,
      errors: [],
    };
  },
};

// =============================================================================
// NOTIFICATION SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Notification Subscription resolvers
 */
export const notificationSubscriptions = {
  /**
   * Subscribe to new notifications
   */
  notificationReceived: {
    subscribe: async (
      _parent: unknown,
      _args: Record<string, never>,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(`${NOTIFICATION_RECEIVED}_${context.user.id}`);
    },
  },

  /**
   * Subscribe to sync required events
   */
  syncRequired: {
    subscribe: async (
      _parent: unknown,
      _args: Record<string, never>,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return context.pubsub.asyncIterator(`${SYNC_REQUIRED}_${context.user.id}`);
    },
  },
};

// =============================================================================
// NOTIFICATION FIELD RESOLVERS
// =============================================================================

/**
 * Notification field resolvers for nested types
 */
export const NotificationFieldResolvers = {
  /**
   * Resolve the user for a notification
   */
  user: async (
    parent: Notification,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },

  /**
   * Resolve parsed data
   */
  parsedData: (parent: Notification): Record<string, unknown> | null => {
    if (!parent.data) {
      return null;
    }
    return parent.data as Record<string, unknown>;
  },
};

/**
 * Push device field resolvers
 */
export const PushDeviceFieldResolvers = {
  /**
   * Mask sensitive token data
   */
  token: (parent: PushDevice): string => {
    // Return masked token for security
    if (parent.token.length > 8) {
      return `${parent.token.substring(0, 4)}...${parent.token.substring(parent.token.length - 4)}`;
    }
    return '****';
  },
};

// =============================================================================
// COMBINED NOTIFICATION RESOLVERS
// =============================================================================

/**
 * Combined notification resolvers object for use with graphql-tools
 */
export const notificationResolvers = {
  Query: notificationQueries,
  Mutation: notificationMutations,
  Subscription: notificationSubscriptions,
  Notification: NotificationFieldResolvers,
  PushDevice: PushDeviceFieldResolvers,
};

export default notificationResolvers;
