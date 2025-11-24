/**
 * @genesis/core - Notification Service
 *
 * Service layer for push notifications, device management, user preferences,
 * and in-app notifications. Supports Web Push (VAPID) and Firebase Cloud
 * Messaging (FCM) for cross-platform notification delivery.
 *
 * Note: This implementation uses in-memory storage for devices, preferences,
 * and notifications. In production, these should be migrated to database tables.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'events';
import * as webpush from 'web-push';
import * as admin from 'firebase-admin';
import { createId } from '@paralleldrive/cuid2';

import { prisma } from '@genesis/database';

import {
  GenesisError,
  TransactionError,
} from '../errors';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_NOTIFICATION_LIST_OPTIONS,
  MAX_NOTIFICATION_LIMIT,
  DEFAULT_PUSH_TTL,
  MAX_DEVICES_PER_USER,
  NOTIFICATION_TYPE_TO_PREFERENCE,
} from '../types/notification';

import type { PrismaClient } from '@genesis/database';
import type {
  PushNotification,
  DeviceRegistration,
  Device,
  NotificationPreferences,
  UpdatePreferencesInput,
  Notification,
  CreateNotificationInput,
  NotificationListOptions,
  PaginatedNotificationResult,
  BatchResult,
  PushSendResult,
  NotificationServiceConfig,
  NotificationType,
  QuietHours,
  OnNotificationCreatedCallback,
  OnNotificationReadCallback,
  OnPushSentCallback,
} from '../types/notification';

// =============================================================================
// Custom Errors
// =============================================================================

/**
 * Base error for notification operations.
 */
export class NotificationError extends GenesisError {
  constructor(message: string, code: string, statusCode: number = 400, metadata?: Record<string, unknown>) {
    super(message, code, statusCode, metadata);
    this.name = 'NotificationError';
  }
}

/**
 * Error thrown when a notification is not found.
 */
export class NotificationNotFoundError extends GenesisError {
  constructor(notificationId: string) {
    super(
      `Notification not found: ${notificationId}`,
      'NOTIFICATION_NOT_FOUND',
      404,
      { notificationId },
    );
    this.name = 'NotificationNotFoundError';
  }
}

/**
 * Error thrown when a user is not found.
 */
export class UserNotFoundError extends GenesisError {
  constructor(userId: string) {
    super(
      `User not found: ${userId}`,
      'USER_NOT_FOUND',
      404,
      { userId },
    );
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when a device is not found.
 */
export class DeviceNotFoundError extends GenesisError {
  constructor(deviceId: string) {
    super(
      `Device not found: ${deviceId}`,
      'DEVICE_NOT_FOUND',
      404,
      { deviceId },
    );
    this.name = 'DeviceNotFoundError';
  }
}

/**
 * Error thrown when device registration fails.
 */
export class DeviceRegistrationError extends GenesisError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'DEVICE_REGISTRATION_ERROR', 400, metadata);
    this.name = 'DeviceRegistrationError';
  }
}

/**
 * Error thrown when push notification sending fails.
 */
export class PushSendError extends GenesisError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'PUSH_SEND_ERROR', 500, metadata);
    this.name = 'PushSendError';
  }
}

/**
 * Error thrown when notification service is not configured.
 */
export class NotificationConfigError extends GenesisError {
  constructor(message: string) {
    super(message, 'NOTIFICATION_CONFIG_ERROR', 500, {});
    this.name = 'NotificationConfigError';
  }
}

/**
 * Error thrown when notification validation fails.
 */
export class NotificationValidationError extends GenesisError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]>) {
    super(message, 'NOTIFICATION_VALIDATION_ERROR', 400, { errors });
    this.name = 'NotificationValidationError';
    this.errors = errors;
  }
}

// =============================================================================
// Service Interface
// =============================================================================

/**
 * Interface for the notification service.
 */
export interface NotificationService {
  // Push Notification Sending
  sendPush(userId: string, notification: PushNotification): Promise<void>;
  sendBulkPush(userIds: string[], notification: PushNotification): Promise<BatchResult>;
  sendToChannel(channelId: string, notification: PushNotification, excludeUserIds?: string[]): Promise<void>;

  // Device Management
  registerDevice(userId: string, device: DeviceRegistration): Promise<Device>;
  unregisterDevice(userId: string, deviceId: string): Promise<void>;
  getDevices(userId: string): Promise<Device[]>;
  updateDeviceToken(deviceId: string, newToken: string): Promise<Device>;

  // Preferences
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(userId: string, prefs: UpdatePreferencesInput): Promise<NotificationPreferences>;
  muteChannel(userId: string, channelId: string): Promise<void>;
  unmuteChannel(userId: string, channelId: string): Promise<void>;

  // In-App Notifications
  createNotification(input: CreateNotificationInput): Promise<Notification>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<number>;
  getNotifications(userId: string, options?: NotificationListOptions): Promise<PaginatedNotificationResult>;
  getUnreadCount(userId: string): Promise<number>;
  deleteNotification(notificationId: string): Promise<void>;
  deleteAllNotifications(userId: string): Promise<number>;
}

/**
 * Interface for notification event subscriptions.
 */
export interface NotificationEvents {
  onNotificationCreated(userId: string, callback: OnNotificationCreatedCallback): () => void;
  onNotificationRead(userId: string, callback: OnNotificationReadCallback): () => void;
  onPushSent(userId: string, callback: OnPushSentCallback): () => void;
}

// =============================================================================
// In-Memory Storage (to be replaced with database tables)
// =============================================================================

/** In-memory device storage */
const deviceStore = new Map<string, Device>();

/** In-memory device index by user */
const devicesByUser = new Map<string, Set<string>>();

/** In-memory preferences storage */
const preferencesStore = new Map<string, NotificationPreferences>();

/** In-memory notification storage */
const notificationStore = new Map<string, Notification>();

/** In-memory notification index by user */
const notificationsByUser = new Map<string, Set<string>>();

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Complete notification service implementation providing push notifications,
 * device management, preferences, and in-app notifications.
 */
export class NotificationServiceImpl implements NotificationService, NotificationEvents {
  private readonly db: PrismaClient;
  private readonly eventEmitter: EventEmitter;
  private readonly config: NotificationServiceConfig;
  private fcmApp: admin.app.App | null = null;
  private webPushConfigured: boolean = false;

  /**
   * Creates a new NotificationServiceImpl instance.
   *
   * @param config - Service configuration
   * @param database - Optional Prisma client instance
   */
  constructor(config: NotificationServiceConfig = {}, database?: PrismaClient) {
    this.db = database ?? prisma;
    this.config = {
      defaultTTL: DEFAULT_PUSH_TTL,
      respectQuietHours: true,
      batchSize: 500,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100);

    this.initializeProviders();
  }

  /**
   * Initializes push notification providers.
   */
  private initializeProviders(): void {
    // Initialize Web Push
    if (this.config.webPush) {
      try {
        webpush.setVapidDetails(
          `mailto:${this.config.webPush.contactEmail}`,
          this.config.webPush.publicKey,
          this.config.webPush.privateKey,
        );
        this.webPushConfigured = true;
      } catch {
        // Web Push initialization failed - will skip web push sends
        this.webPushConfigured = false;
      }
    }

    // Initialize FCM
    if (this.config.fcm) {
      try {
        this.fcmApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.config.fcm.projectId,
            privateKey: this.config.fcm.privateKey.replace(/\\n/g, '\n'),
            clientEmail: this.config.fcm.clientEmail,
          }),
        }, `genesis-notifications-${createId()}`);
      } catch {
        // FCM initialization failed - will skip FCM sends
        this.fcmApp = null;
      }
    }
  }

  // ===========================================================================
  // Push Notification Sending
  // ===========================================================================

  /**
   * Sends a push notification to a specific user.
   */
  async sendPush(userId: string, notification: PushNotification): Promise<void> {
    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Check user preferences
    const preferences = await this.getPreferences(userId);

    // Check if notification type is enabled
    if (notification.data?.type && typeof notification.data.type === 'string') {
      const notifType = notification.data.type as NotificationType;
      const prefKey = NOTIFICATION_TYPE_TO_PREFERENCE[notifType];
      if (prefKey && !preferences[prefKey]) {
        // User has disabled this notification type
        return;
      }
    }

    // Check quiet hours
    if (this.config.respectQuietHours && preferences.quietHours) {
      if (this.isInQuietHours(preferences.quietHours)) {
        // Store for later delivery or skip
        return;
      }
    }

    // Get user devices
    const devices = await this.getDevices(userId);

    if (devices.length === 0) {
      // No devices registered, nothing to send
      return;
    }

    const results: PushSendResult[] = [];
    const invalidTokens: string[] = [];

    for (const device of devices) {
      try {
        const result = await this.sendToDevice(device, notification, preferences);
        results.push(result);

        if (!result.success && result.error?.includes('invalid')) {
          invalidTokens.push(device.token);
        }
      } catch (error) {
        results.push({
          success: false,
          deviceId: device.id,
          platform: device.platform,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await this.cleanupInvalidTokens(userId, invalidTokens);
    }

    // Emit push sent event
    const batchResult: BatchResult = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
      invalidTokens,
    };

    this.emitPushSent(userId, notification, batchResult);

    // Throw if all sends failed
    if (batchResult.successful === 0 && batchResult.total > 0) {
      throw new PushSendError('All push notification sends failed', {
        results,
      });
    }
  }

  /**
   * Sends a push notification to multiple users.
   */
  async sendBulkPush(userIds: string[], notification: PushNotification): Promise<BatchResult> {
    const allResults: PushSendResult[] = [];
    const allInvalidTokens: string[] = [];

    // Process in batches
    const batchSize = this.config.batchSize ?? 500;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (userId) => {
        try {
          await this.sendPush(userId, notification);
          return { userId, success: true };
        } catch (error) {
          return {
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        allResults.push({
          success: result.success,
          deviceId: result.userId, // Using userId as device identifier for bulk
          platform: 'web', // Generic for bulk sends
          error: 'error' in result ? result.error : undefined,
        });
      }
    }

    return {
      total: allResults.length,
      successful: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length,
      results: allResults,
      invalidTokens: allInvalidTokens,
    };
  }

  /**
   * Sends a push notification to all members of a channel.
   */
  async sendToChannel(
    channelId: string,
    notification: PushNotification,
    excludeUserIds: string[] = [],
  ): Promise<void> {
    // Get channel members
    const members = await this.db.channelMember.findMany({
      where: {
        channelId,
        userId: { notIn: excludeUserIds },
      },
      select: { userId: true },
    });

    const userIds = members.map(m => m.userId);

    if (userIds.length === 0) {
      return;
    }

    // Filter out users who have muted the channel
    const filteredUserIds: string[] = [];

    for (const userId of userIds) {
      const preferences = await this.getPreferences(userId);
      if (!preferences.mutedChannels.includes(channelId)) {
        filteredUserIds.push(userId);
      }
    }

    if (filteredUserIds.length > 0) {
      await this.sendBulkPush(filteredUserIds, notification);
    }
  }

  /**
   * Sends a notification to a specific device.
   */
  private async sendToDevice(
    device: Device,
    notification: PushNotification,
    preferences: NotificationPreferences,
  ): Promise<PushSendResult> {
    const { platform, token, id: deviceId } = device;

    try {
      if (platform === 'web') {
        return await this.sendWebPush(deviceId, token, notification, preferences);
      } else {
        return await this.sendFCM(deviceId, token, notification, platform, preferences);
      }
    } catch (error) {
      return {
        success: false,
        deviceId,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sends a Web Push notification.
   */
  private async sendWebPush(
    deviceId: string,
    token: string,
    notification: PushNotification,
    preferences: NotificationPreferences,
  ): Promise<PushSendResult> {
    if (!this.webPushConfigured) {
      return {
        success: false,
        deviceId,
        platform: 'web',
        error: 'Web Push not configured',
      };
    }

    if (!preferences.desktop.enabled) {
      return {
        success: true,
        deviceId,
        platform: 'web',
        messageId: 'skipped-disabled',
      };
    }

    try {
      // Parse the subscription from token (stored as JSON)
      const subscription = JSON.parse(token) as webpush.PushSubscription;

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        data: notification.data,
        actions: notification.actions,
        tag: notification.tag,
        requireInteraction: notification.requireInteraction,
      });

      const options: webpush.RequestOptions = {
        TTL: notification.ttl ?? this.config.defaultTTL,
      };

      const result = await webpush.sendNotification(subscription, payload, options);

      return {
        success: true,
        deviceId,
        platform: 'web',
        messageId: result.headers?.['message-id'] as string | undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isInvalid = errorMessage.includes('expired') ||
                        errorMessage.includes('invalid') ||
                        errorMessage.includes('unsubscribed');

      return {
        success: false,
        deviceId,
        platform: 'web',
        error: isInvalid ? 'invalid_token' : errorMessage,
      };
    }
  }

  /**
   * Sends a Firebase Cloud Messaging notification.
   */
  private async sendFCM(
    deviceId: string,
    token: string,
    notification: PushNotification,
    platform: 'ios' | 'android',
    preferences: NotificationPreferences,
  ): Promise<PushSendResult> {
    if (!this.fcmApp) {
      return {
        success: false,
        deviceId,
        platform,
        error: 'FCM not configured',
      };
    }

    if (!preferences.mobile.enabled) {
      return {
        success: true,
        deviceId,
        platform,
        messageId: 'skipped-disabled',
      };
    }

    try {
      const ttlSeconds = notification.ttl ?? this.config.defaultTTL ?? DEFAULT_PUSH_TTL;

      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image,
        },
        data: notification.data ? this.stringifyData(notification.data) : undefined,
        android: platform === 'android' ? {
          priority: notification.priority === 'urgent' ? 'high' : 'normal',
          ttl: ttlSeconds * 1000,
          notification: {
            sound: preferences.mobile.sound ? (notification.sound ?? 'default') : undefined,
            clickAction: notification.clickAction,
            tag: notification.tag,
          },
          collapseKey: notification.collapseKey,
        } : undefined,
        apns: platform === 'ios' ? {
          headers: {
            'apns-priority': notification.priority === 'urgent' ? '10' : '5',
            'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSeconds),
            ...(notification.collapseKey ? { 'apns-collapse-id': notification.collapseKey } : {}),
          },
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              badge: notification.badge,
              sound: preferences.mobile.sound ? (notification.sound ?? 'default') : undefined,
              'mutable-content': 1,
            },
          },
        } : undefined,
      };

      const response = await admin.messaging(this.fcmApp).send(message);

      return {
        success: true,
        deviceId,
        platform,
        messageId: response,
      };
    } catch (error) {
      const errorCode = (error as admin.FirebaseError)?.code;
      const isInvalid = errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/registration-token-not-registered';

      return {
        success: false,
        deviceId,
        platform,
        error: isInvalid ? 'invalid_token' : (error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  }

  /**
   * Converts data object to string values for FCM.
   */
  private stringifyData(data: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  /**
   * Cleans up invalid device tokens.
   */
  private async cleanupInvalidTokens(userId: string, tokens: string[]): Promise<void> {
    const userDeviceIds = devicesByUser.get(userId);
    if (!userDeviceIds) return;

    Array.from(userDeviceIds).forEach(deviceId => {
      const device = deviceStore.get(deviceId);
      if (device && tokens.includes(device.token)) {
        device.isActive = false;
        deviceStore.set(deviceId, device);
      }
    });
  }

  /**
   * Checks if current time is within quiet hours.
   */
  private isInQuietHours(quietHours: QuietHours): boolean {
    const now = new Date();
    const timezone = quietHours.timezone ?? 'UTC';

    // Get current time in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });

    const currentTime = formatter.format(now);
    const timeParts = currentTime.split(':');
    const currentHour = parseInt(timeParts[0] ?? '0', 10);
    const currentMinute = parseInt(timeParts[1] ?? '0', 10);
    const currentMinutes = currentHour * 60 + currentMinute;

    const startParts = quietHours.start.split(':');
    const endParts = quietHours.end.split(':');
    const startHour = parseInt(startParts[0] ?? '0', 10);
    const startMinute = parseInt(startParts[1] ?? '0', 10);
    const endHour = parseInt(endParts[0] ?? '0', 10);
    const endMinute = parseInt(endParts[1] ?? '0', 10);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  // ===========================================================================
  // Device Management
  // ===========================================================================

  /**
   * Registers a device for push notifications.
   */
  async registerDevice(userId: string, device: DeviceRegistration): Promise<Device> {
    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Get existing user devices
    let userDeviceIds = devicesByUser.get(userId);
    if (!userDeviceIds) {
      userDeviceIds = new Set();
      devicesByUser.set(userId, userDeviceIds);
    }

    // Check device limit
    const activeDevices = Array.from(userDeviceIds)
      .map(id => deviceStore.get(id))
      .filter((d): d is Device => d !== undefined && d.isActive);

    if (activeDevices.length >= MAX_DEVICES_PER_USER) {
      // Deactivate oldest device
      const oldestDevice = activeDevices.sort(
        (a, b) => a.lastSeenAt.getTime() - b.lastSeenAt.getTime()
      )[0];
      if (oldestDevice) {
        oldestDevice.isActive = false;
        deviceStore.set(oldestDevice.id, oldestDevice);
      }
    }

    try {
      // Check if device with this token already exists
      const existingDevice = Array.from(deviceStore.values()).find(
        d => d.token === device.token && d.platform === device.platform
      );

      if (existingDevice) {
        // Update existing device
        const updated: Device = {
          ...existingDevice,
          userId,
          isActive: true,
          userAgent: device.userAgent,
          deviceName: device.deviceName,
          appVersion: device.appVersion,
          osVersion: device.osVersion,
          tokenUpdatedAt: new Date(),
          lastSeenAt: new Date(),
        };
        deviceStore.set(existingDevice.id, updated);
        userDeviceIds.add(existingDevice.id);
        return updated;
      }

      // Create new device
      const newDevice: Device = {
        id: createId(),
        userId,
        token: device.token,
        platform: device.platform,
        userAgent: device.userAgent,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
        osVersion: device.osVersion,
        isActive: true,
        tokenUpdatedAt: new Date(),
        createdAt: new Date(),
        lastSeenAt: new Date(),
      };

      deviceStore.set(newDevice.id, newDevice);
      userDeviceIds.add(newDevice.id);

      this.eventEmitter.emit(`device:registered:${userId}`, newDevice);

      return newDevice;
    } catch (error) {
      throw new DeviceRegistrationError(
        'Failed to register device',
        { error: error instanceof Error ? error.message : 'Unknown error' },
      );
    }
  }

  /**
   * Unregisters a device from push notifications.
   */
  async unregisterDevice(userId: string, deviceId: string): Promise<void> {
    const device = deviceStore.get(deviceId);

    if (!device || device.userId !== userId) {
      throw new DeviceNotFoundError(deviceId);
    }

    device.isActive = false;
    deviceStore.set(deviceId, device);

    this.eventEmitter.emit(`device:unregistered:${userId}`, deviceId);
  }

  /**
   * Gets all registered devices for a user.
   */
  async getDevices(userId: string): Promise<Device[]> {
    const userDeviceIds = devicesByUser.get(userId);
    if (!userDeviceIds) return [];

    return Array.from(userDeviceIds)
      .map(id => deviceStore.get(id))
      .filter((d): d is Device => d !== undefined && d.isActive)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
  }

  /**
   * Updates a device token.
   */
  async updateDeviceToken(deviceId: string, newToken: string): Promise<Device> {
    const device = deviceStore.get(deviceId);

    if (!device) {
      throw new DeviceNotFoundError(deviceId);
    }

    const updated: Device = {
      ...device,
      token: newToken,
      tokenUpdatedAt: new Date(),
      lastSeenAt: new Date(),
    };

    deviceStore.set(deviceId, updated);

    return updated;
  }

  // ===========================================================================
  // Preferences
  // ===========================================================================

  /**
   * Gets notification preferences for a user.
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = preferencesStore.get(userId);

    if (!prefs) {
      // Return default preferences if none exist
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...prefs,
    };
  }

  /**
   * Updates notification preferences for a user.
   */
  async updatePreferences(userId: string, prefs: UpdatePreferencesInput): Promise<NotificationPreferences> {
    // Ensure user exists
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const currentPrefs = await this.getPreferences(userId);
    const updatedPrefs: NotificationPreferences = {
      ...currentPrefs,
      ...prefs,
      email: prefs.email ? { ...currentPrefs.email, ...prefs.email } : currentPrefs.email,
      mobile: prefs.mobile ? { ...currentPrefs.mobile, ...prefs.mobile } : currentPrefs.mobile,
      desktop: prefs.desktop ? { ...currentPrefs.desktop, ...prefs.desktop } : currentPrefs.desktop,
    };

    preferencesStore.set(userId, updatedPrefs);

    this.eventEmitter.emit(`preferences:updated:${userId}`);

    return updatedPrefs;
  }

  /**
   * Mutes a channel for a user.
   */
  async muteChannel(userId: string, channelId: string): Promise<void> {
    const prefs = await this.getPreferences(userId);

    if (!prefs.mutedChannels.includes(channelId)) {
      await this.updatePreferences(userId, {
        mutedChannels: [...prefs.mutedChannels, channelId],
      });
    }
  }

  /**
   * Unmutes a channel for a user.
   */
  async unmuteChannel(userId: string, channelId: string): Promise<void> {
    const prefs = await this.getPreferences(userId);

    if (prefs.mutedChannels.includes(channelId)) {
      await this.updatePreferences(userId, {
        mutedChannels: prefs.mutedChannels.filter(id => id !== channelId),
      });
    }
  }

  // ===========================================================================
  // In-App Notifications
  // ===========================================================================

  /**
   * Creates an in-app notification.
   */
  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    // Validate input
    this.validateCreateNotificationInput(input);

    // Verify user exists
    const user = await this.db.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    try {
      const notification: Notification = {
        id: createId(),
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        isRead: false,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        actorId: input.actorId,
        metadata: input.metadata,
        createdAt: new Date(),
        readAt: undefined,
        expiresAt: input.expiresAt,
      };

      notificationStore.set(notification.id, notification);

      // Update user index
      let userNotifIds = notificationsByUser.get(input.userId);
      if (!userNotifIds) {
        userNotifIds = new Set();
        notificationsByUser.set(input.userId, userNotifIds);
      }
      userNotifIds.add(notification.id);

      // Emit event
      this.emitNotificationCreated(input.userId, notification);

      // Send push notification if requested
      if (input.sendPush) {
        try {
          await this.sendPush(input.userId, {
            title: input.title,
            body: input.body,
            data: {
              type: input.type,
              notificationId: notification.id,
              resourceId: input.resourceId,
              resourceType: input.resourceType,
              ...input.metadata,
            },
          });
        } catch {
          // Don't fail if push send fails
        }
      }

      return notification;
    } catch (error) {
      throw new TransactionError('createNotification', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = notificationStore.get(notificationId);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      notificationStore.set(notificationId, notification);

      this.emitNotificationRead(notification.userId, notificationId);
    }
  }

  /**
   * Marks all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const userNotifIds = notificationsByUser.get(userId);
    if (!userNotifIds) return 0;

    let count = 0;
    const now = new Date();

    Array.from(userNotifIds).forEach(id => {
      const notification = notificationStore.get(id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = now;
        notificationStore.set(id, notification);
        count++;
      }
    });

    return count;
  }

  /**
   * Gets notifications for a user.
   */
  async getNotifications(
    userId: string,
    options: NotificationListOptions = {},
  ): Promise<PaginatedNotificationResult> {
    const {
      limit = DEFAULT_NOTIFICATION_LIST_OPTIONS.limit,
      offset = DEFAULT_NOTIFICATION_LIST_OPTIONS.offset,
      isRead,
      type,
      after,
      before,
      includeExpired = DEFAULT_NOTIFICATION_LIST_OPTIONS.includeExpired,
    } = options;

    const effectiveLimit = Math.min(limit, MAX_NOTIFICATION_LIMIT);
    const userNotifIds = notificationsByUser.get(userId);

    if (!userNotifIds) {
      return { data: [], total: 0, unreadCount: 0, hasMore: false };
    }

    const now = new Date();

    // Get all user notifications and filter
    let notifications = Array.from(userNotifIds)
      .map(id => notificationStore.get(id))
      .filter((n): n is Notification => {
        if (!n) return false;
        if (isRead !== undefined && n.isRead !== isRead) return false;
        if (type && n.type !== type) return false;
        if (after && n.createdAt <= after) return false;
        if (before && n.createdAt >= before) return false;
        if (!includeExpired && n.expiresAt && n.expiresAt < now) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = notifications.length;

    // Calculate unread count
    const unreadCount = Array.from(userNotifIds)
      .map(id => notificationStore.get(id))
      .filter((n): n is Notification => {
        if (!n || n.isRead) return false;
        if (n.expiresAt && n.expiresAt < now) return false;
        return true;
      }).length;

    // Apply pagination
    notifications = notifications.slice(offset, offset + effectiveLimit + 1);
    const hasMore = notifications.length > effectiveLimit;
    const data = hasMore ? notifications.slice(0, effectiveLimit) : notifications;

    return {
      data,
      total,
      unreadCount,
      hasMore,
    };
  }

  /**
   * Gets the unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const userNotifIds = notificationsByUser.get(userId);
    if (!userNotifIds) return 0;

    const now = new Date();

    return Array.from(userNotifIds)
      .map(id => notificationStore.get(id))
      .filter((n): n is Notification => {
        if (!n || n.isRead) return false;
        if (n.expiresAt && n.expiresAt < now) return false;
        return true;
      }).length;
  }

  /**
   * Deletes a notification.
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const notification = notificationStore.get(notificationId);

    if (!notification) {
      throw new NotificationNotFoundError(notificationId);
    }

    notificationStore.delete(notificationId);

    const userNotifIds = notificationsByUser.get(notification.userId);
    if (userNotifIds) {
      userNotifIds.delete(notificationId);
    }
  }

  /**
   * Deletes all notifications for a user.
   */
  async deleteAllNotifications(userId: string): Promise<number> {
    const userNotifIds = notificationsByUser.get(userId);
    if (!userNotifIds) return 0;

    const count = userNotifIds.size;

    Array.from(userNotifIds).forEach(id => {
      notificationStore.delete(id);
    });

    notificationsByUser.delete(userId);

    return count;
  }

  /**
   * Validates create notification input.
   */
  private validateCreateNotificationInput(input: CreateNotificationInput): void {
    const errors: Record<string, string[]> = {};

    if (!input.userId || input.userId.trim().length === 0) {
      errors.userId = ['User ID is required'];
    }

    if (!input.type) {
      errors.type = ['Notification type is required'];
    }

    if (!input.title || input.title.trim().length === 0) {
      errors.title = ['Title is required'];
    }

    if (!input.body) {
      errors.body = ['Body is required'];
    }

    if (Object.keys(errors).length > 0) {
      throw new NotificationValidationError('Notification validation failed', errors);
    }
  }

  // ===========================================================================
  // Event Subscriptions
  // ===========================================================================

  /**
   * Subscribes to notification created events.
   */
  onNotificationCreated(userId: string, callback: OnNotificationCreatedCallback): () => void {
    const eventName = `notification:created:${userId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to notification read events.
   */
  onNotificationRead(userId: string, callback: OnNotificationReadCallback): () => void {
    const eventName = `notification:read:${userId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  /**
   * Subscribes to push sent events.
   */
  onPushSent(userId: string, callback: OnPushSentCallback): () => void {
    const eventName = `push:sent:${userId}`;
    this.eventEmitter.on(eventName, callback);

    return () => {
      this.eventEmitter.off(eventName, callback);
    };
  }

  // ===========================================================================
  // Private Event Emitters
  // ===========================================================================

  private emitNotificationCreated(userId: string, notification: Notification): void {
    this.eventEmitter.emit(`notification:created:${userId}`, notification);
  }

  private emitNotificationRead(userId: string, notificationId: string): void {
    this.eventEmitter.emit(`notification:read:${userId}`, notificationId);
  }

  private emitPushSent(
    userId: string,
    notification: PushNotification,
    result: PushSendResult | BatchResult,
  ): void {
    this.eventEmitter.emit(`push:sent:${userId}`, notification, result);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Gets the event emitter for advanced use cases.
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Removes all event listeners.
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  /**
   * Cleans up resources (FCM app, etc).
   */
  async cleanup(): Promise<void> {
    if (this.fcmApp) {
      await this.fcmApp.delete();
      this.fcmApp = null;
    }
    this.removeAllListeners();
  }

  /**
   * Clears all in-memory data (useful for testing).
   */
  clearAllData(): void {
    deviceStore.clear();
    devicesByUser.clear();
    preferencesStore.clear();
    notificationStore.clear();
    notificationsByUser.clear();
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new notification service instance.
 *
 * @param config - Service configuration
 * @param database - Optional Prisma client instance
 * @returns Notification service instance
 *
 * @example
 * ```typescript
 * const notificationService = createNotificationService({
 *   webPush: {
 *     publicKey: process.env.VAPID_PUBLIC_KEY!,
 *     privateKey: process.env.VAPID_PRIVATE_KEY!,
 *     contactEmail: 'admin@example.com',
 *   },
 *   fcm: {
 *     projectId: process.env.FIREBASE_PROJECT_ID!,
 *     privateKey: process.env.FIREBASE_PRIVATE_KEY!,
 *     clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
 *   },
 * });
 *
 * // Send a push notification
 * await notificationService.sendPush('user_123', {
 *   title: 'New Message',
 *   body: 'You have a new message from John',
 *   data: { type: 'message', channelId: 'channel_456' },
 * });
 *
 * // Create an in-app notification
 * const notification = await notificationService.createNotification({
 *   userId: 'user_123',
 *   type: 'message',
 *   title: 'New Message',
 *   body: 'You have a new message from John',
 *   sendPush: true,
 * });
 * ```
 */
export function createNotificationService(
  config?: NotificationServiceConfig,
  database?: PrismaClient,
): NotificationServiceImpl {
  return new NotificationServiceImpl(config, database);
}

/**
 * Creates a notification service instance from environment variables.
 *
 * Expected environment variables:
 * - VAPID_PUBLIC_KEY: Web Push public key
 * - VAPID_PRIVATE_KEY: Web Push private key
 * - VAPID_CONTACT_EMAIL: Contact email for VAPID
 * - FIREBASE_PROJECT_ID: Firebase project ID
 * - FIREBASE_PRIVATE_KEY: Firebase private key
 * - FIREBASE_CLIENT_EMAIL: Firebase client email
 *
 * @param database - Optional Prisma client instance
 * @returns Notification service instance
 */
export function createNotificationServiceFromEnv(database?: PrismaClient): NotificationServiceImpl {
  const config: NotificationServiceConfig = {};

  // Configure Web Push if environment variables are set
  if (
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_CONTACT_EMAIL
  ) {
    config.webPush = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      contactEmail: process.env.VAPID_CONTACT_EMAIL,
    };
  }

  // Configure FCM if environment variables are set
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    config.fcm = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  return createNotificationService(config, database);
}

// Singleton instance holder
let notificationServiceInstance: NotificationServiceImpl | null = null;

/**
 * Gets or creates a singleton notification service instance.
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Notification service instance
 */
export function getNotificationService(config?: NotificationServiceConfig): NotificationServiceImpl {
  if (!notificationServiceInstance) {
    notificationServiceInstance = config
      ? createNotificationService(config)
      : createNotificationServiceFromEnv();
  }
  return notificationServiceInstance;
}

/**
 * Default notification service instance using environment configuration.
 */
export const notificationService = getNotificationService();
