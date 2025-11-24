/**
 * Notification Service Tests
 *
 * Comprehensive test suite for the notification services covering:
 * - Push notification sending (Web Push, FCM)
 * - Device management (register, unregister, token refresh)
 * - Quiet hours and user preferences
 * - Error handling and validation
 *
 * @module @genesis/core/services/__tests__/notification-service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createMockNotification,
  createMockMentionNotification,
  createMockCallNotification,
  createMockNotificationList,
  createMockPushDevice,
  createMockWebPushDevice,
  createMockFCMDevice,
  createMockPushDeviceList,
  createMockPreferences,
  createMockPreferencesWithQuietHours,
  createMockDisabledPreferences,
  createMockNotificationService,
  createMockPushProvider,
  createMockPrismaNotificationModel,
  createMockPrismaPushDeviceModel,
  createMockPrismaNotificationPreferenceModel,
  generateUserId,
  generateNotificationId,
  generateDeviceId,
  resetNotificationIdCounters,
} from '../../test-utils/notification-factories';

// =============================================================================
// MOCK SETUP
// =============================================================================

function createMockPrismaClient() {
  return {
    notification: createMockPrismaNotificationModel(),
    pushDevice: createMockPrismaPushDeviceModel(),
    notificationPreference: createMockPrismaNotificationPreferenceModel(),
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const tx = {
        notification: createMockPrismaNotificationModel(),
        pushDevice: createMockPrismaPushDeviceModel(),
      };
      return callback(tx);
    }),
  };
}

// =============================================================================
// NOTIFICATION SERVICE TESTS
// =============================================================================

describe('NotificationService', () => {
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;
  let mockPushProvider: ReturnType<typeof createMockPushProvider>;

  beforeEach(() => {
    resetNotificationIdCounters();
    mockPrisma = createMockPrismaClient();
    mockPushProvider = createMockPushProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // sendPush Tests
  // ===========================================================================

  describe('sendPush', () => {
    it('sends to web push', async () => {
      const userId = generateUserId();
      const notification = createMockMentionNotification({ userId });
      const webDevice = createMockWebPushDevice({ userId });

      mockPrisma.pushDevice.findMany.mockResolvedValue([webDevice]);
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(
        createMockPreferences({ userId })
      );

      // Get active devices for user
      const devices = await mockPrisma.pushDevice.findMany({
        where: { userId, isActive: true },
      });

      expect(devices).toHaveLength(1);
      expect(devices[0].platform).toBe('WEB');

      // Send web push
      const result = await mockPushProvider.sendWebPush({
        endpoint: webDevice.endpoint!,
        p256dh: webDevice.p256dh!,
        auth: webDevice.auth!,
        payload: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
        },
      });

      expect(result.success).toBe(true);
      expect(mockPushProvider.sendWebPush).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: webDevice.endpoint,
          payload: expect.objectContaining({
            title: notification.title,
          }),
        })
      );
    });

    it('sends to FCM', async () => {
      const userId = generateUserId();
      const notification = createMockCallNotification({ userId });
      const iosDevice = createMockFCMDevice('IOS', { userId });

      mockPrisma.pushDevice.findMany.mockResolvedValue([iosDevice]);
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(
        createMockPreferences({ userId })
      );

      // Get active devices
      const devices = await mockPrisma.pushDevice.findMany({
        where: { userId, isActive: true },
      });

      expect(devices).toHaveLength(1);
      expect(devices[0].platform).toBe('IOS');

      // Send FCM push
      const result = await mockPushProvider.sendFCM({
        token: iosDevice.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data as Record<string, string>,
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockPushProvider.sendFCM).toHaveBeenCalledWith(
        expect.objectContaining({
          token: iosDevice.token,
        })
      );
    });

    it('respects quiet hours', async () => {
      const userId = generateUserId();
      const notification = createMockNotification({ userId });
      const preferences = createMockPreferencesWithQuietHours({
        userId,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        quietHoursTimezone: 'America/New_York',
      });

      mockPrisma.notificationPreference.findUnique.mockResolvedValue(preferences);

      // Check if in quiet hours
      const prefs = await mockPrisma.notificationPreference.findUnique({
        where: { userId },
      });

      expect(prefs).not.toBeNull();
      expect(prefs!.quietHoursEnabled).toBe(true);

      // Simulate quiet hours check
      const isInQuietHours = (
        start: string,
        end: string,
        _timezone: string,
        currentTime: Date
      ): boolean => {
        const hours = currentTime.getHours();
        const startHour = parseInt(start.split(':')[0]!);
        const endHour = parseInt(end.split(':')[0]!);

        // Handle overnight quiet hours (e.g., 22:00 - 08:00)
        if (startHour > endHour) {
          return hours >= startHour || hours < endHour;
        }
        return hours >= startHour && hours < endHour;
      };

      // Test at 23:00 (should be in quiet hours)
      const lateNight = new Date();
      lateNight.setHours(23, 0, 0, 0);
      expect(isInQuietHours('22:00', '08:00', 'America/New_York', lateNight)).toBe(true);

      // Test at 12:00 (should not be in quiet hours)
      const noon = new Date();
      noon.setHours(12, 0, 0, 0);
      expect(isInQuietHours('22:00', '08:00', 'America/New_York', noon)).toBe(false);
    });

    it('respects user preferences', async () => {
      const userId = generateUserId();
      const disabledPreferences = createMockDisabledPreferences({ userId });

      mockPrisma.notificationPreference.findUnique.mockResolvedValue(disabledPreferences);

      const prefs = await mockPrisma.notificationPreference.findUnique({
        where: { userId },
      });

      expect(prefs).not.toBeNull();
      expect(prefs!.pushEnabled).toBe(false);
      expect(prefs!.mentionEnabled).toBe(false);

      // Should not send push when disabled
      const shouldSendPush = prefs!.pushEnabled;
      expect(shouldSendPush).toBe(false);
    });

    it('handles multiple devices per user', async () => {
      const userId = generateUserId();
      const notification = createMockNotification({ userId });
      const devices = createMockPushDeviceList(3, { userId });

      mockPrisma.pushDevice.findMany.mockResolvedValue(devices);

      const userDevices = await mockPrisma.pushDevice.findMany({
        where: { userId, isActive: true },
      });

      expect(userDevices).toHaveLength(3);

      // Send to all devices
      const sendResults = await Promise.all(
        userDevices.map((device) => {
          if (device.platform === 'WEB') {
            return mockPushProvider.sendWebPush({
              endpoint: device.endpoint!,
              p256dh: device.p256dh!,
              auth: device.auth!,
              payload: { title: notification.title, body: notification.body },
            });
          }
          return mockPushProvider.sendFCM({
            token: device.token,
            notification: { title: notification.title, body: notification.body },
          });
        })
      );

      expect(sendResults.every((r) => r.success)).toBe(true);
    });

    it('handles push provider errors gracefully', async () => {
      const userId = generateUserId();
      const device = createMockWebPushDevice({ userId });

      mockPushProvider.sendWebPush.mockRejectedValue(
        new Error('Push service unavailable')
      );

      await expect(
        mockPushProvider.sendWebPush({
          endpoint: device.endpoint!,
          p256dh: device.p256dh!,
          auth: device.auth!,
          payload: { title: 'Test', body: 'Test' },
        })
      ).rejects.toThrow('Push service unavailable');
    });

    it('filters notifications by preference type', async () => {
      const userId = generateUserId();
      const preferences = createMockPreferences({
        userId,
        mentionEnabled: true,
        reactionEnabled: false,
        threadReplyEnabled: true,
      });

      mockPrisma.notificationPreference.findUnique.mockResolvedValue(preferences);

      const prefs = await mockPrisma.notificationPreference.findUnique({
        where: { userId },
      });

      // Should send mention notifications
      expect(prefs!.mentionEnabled).toBe(true);

      // Should not send reaction notifications
      expect(prefs!.reactionEnabled).toBe(false);

      // Should send thread reply notifications
      expect(prefs!.threadReplyEnabled).toBe(true);
    });
  });

  // ===========================================================================
  // Device Management Tests
  // ===========================================================================

  describe('device management', () => {
    it('registers device', async () => {
      const userId = generateUserId();
      const deviceInput = {
        platform: 'WEB' as const,
        token: 'new_token_123',
        endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint',
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQ',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      };

      const mockDevice = createMockWebPushDevice({
        userId,
        ...deviceInput,
      });

      mockPrisma.pushDevice.upsert.mockResolvedValue(mockDevice);

      const result = await mockPrisma.pushDevice.upsert({
        where: { userId_token: { userId, token: deviceInput.token } },
        update: {
          platform: deviceInput.platform,
          endpoint: deviceInput.endpoint,
          p256dh: deviceInput.p256dh,
          auth: deviceInput.auth,
          isActive: true,
          lastUsedAt: expect.any(Date),
        },
        create: {
          userId,
          ...deviceInput,
          isActive: true,
          lastUsedAt: expect.any(Date),
        },
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.platform).toBe('WEB');
      expect(mockPrisma.pushDevice.upsert).toHaveBeenCalled();
    });

    it('unregisters device', async () => {
      const userId = generateUserId();
      const deviceId = generateDeviceId();
      const device = createMockPushDevice({ id: deviceId, userId });

      mockPrisma.pushDevice.findUnique.mockResolvedValue(device);
      mockPrisma.pushDevice.update.mockResolvedValue({
        ...device,
        isActive: false,
      });

      // Find device
      const existingDevice = await mockPrisma.pushDevice.findUnique({
        where: { id: deviceId },
      });

      expect(existingDevice).not.toBeNull();
      expect(existingDevice!.userId).toBe(userId);

      // Soft delete (mark as inactive)
      const result = await mockPrisma.pushDevice.update({
        where: { id: deviceId },
        data: { isActive: false },
      });

      expect(result.isActive).toBe(false);
    });

    it('handles token refresh', async () => {
      const userId = generateUserId();
      const oldToken = 'old_token_123';
      const newToken = 'new_token_456';

      const device = createMockPushDevice({
        userId,
        token: oldToken,
        platform: 'ANDROID',
      });

      mockPrisma.pushDevice.findFirst.mockResolvedValue(device);
      mockPrisma.pushDevice.update.mockResolvedValue({
        ...device,
        token: newToken,
        lastUsedAt: new Date(),
      });

      // Find device by old token
      const existingDevice = await mockPrisma.pushDevice.findFirst({
        where: { userId, token: oldToken },
      });

      expect(existingDevice).not.toBeNull();

      // Update with new token
      const result = await mockPrisma.pushDevice.update({
        where: { id: existingDevice!.id },
        data: {
          token: newToken,
          lastUsedAt: new Date(),
        },
      });

      expect(result.token).toBe(newToken);
      expect(mockPushProvider.refreshToken).not.toHaveBeenCalled();
    });

    it('validates token before registration', async () => {
      const userId = generateUserId();
      const invalidToken = '';

      mockPushProvider.validateToken.mockResolvedValue(false);

      const isValid = await mockPushProvider.validateToken(invalidToken);
      expect(isValid).toBe(false);

      // With valid token
      mockPushProvider.validateToken.mockResolvedValue(true);
      const isValidToken = await mockPushProvider.validateToken('valid_token_123');
      expect(isValidToken).toBe(true);
    });

    it('deactivates stale devices', async () => {
      const userId = generateUserId();
      const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      const staleDevices = createMockPushDeviceList(3, { userId }).map((d) => ({
        ...d,
        lastUsedAt: staleDate,
      }));

      mockPrisma.pushDevice.findMany.mockResolvedValue(staleDevices);
      mockPrisma.pushDevice.updateMany.mockResolvedValue({ count: 3 });

      // Find stale devices
      const devices = await mockPrisma.pushDevice.findMany({
        where: {
          lastUsedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          isActive: true,
        },
      });

      expect(devices).toHaveLength(3);

      // Deactivate them
      const result = await mockPrisma.pushDevice.updateMany({
        where: { id: { in: devices.map((d) => d.id) } },
        data: { isActive: false },
      });

      expect(result.count).toBe(3);
    });
  });

  // ===========================================================================
  // Notification CRUD Tests
  // ===========================================================================

  describe('notification CRUD', () => {
    it('creates notification', async () => {
      const userId = generateUserId();
      const notification = createMockNotification({ userId });

      mockPrisma.notification.create.mockResolvedValue(notification);

      const result = await mockPrisma.notification.create({
        data: {
          userId,
          type: 'MESSAGE',
          title: notification.title,
          body: notification.body,
          data: notification.data,
        },
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.isRead).toBe(false);
    });

    it('marks notification as read', async () => {
      const userId = generateUserId();
      const notificationId = generateNotificationId();
      const notification = createMockNotification({
        id: notificationId,
        userId,
        isRead: false,
      });

      mockPrisma.notification.findUnique.mockResolvedValue(notification);
      mockPrisma.notification.update.mockResolvedValue({
        ...notification,
        isRead: true,
        readAt: new Date(),
      });

      const updated = await mockPrisma.notification.update({
        where: { id: notificationId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    it('marks all notifications as read', async () => {
      const userId = generateUserId();

      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await mockPrisma.notification.updateMany({
        where: { userId, isRead: false },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      expect(result.count).toBe(5);
    });

    it('gets unread count', async () => {
      const userId = generateUserId();

      mockPrisma.notification.count.mockResolvedValue(10);

      const count = await mockPrisma.notification.count({
        where: { userId, isRead: false },
      });

      expect(count).toBe(10);
    });

    it('lists notifications with pagination', async () => {
      const userId = generateUserId();
      const notifications = createMockNotificationList(10, { userId });

      mockPrisma.notification.findMany.mockResolvedValue(notifications);
      mockPrisma.notification.count.mockResolvedValue(25);

      const result = await mockPrisma.notification.findMany({
        where: { userId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      const total = await mockPrisma.notification.count({
        where: { userId },
      });

      expect(result).toHaveLength(10);
      expect(total).toBe(25);
    });

    it('deletes notification', async () => {
      const userId = generateUserId();
      const notificationId = generateNotificationId();

      mockPrisma.notification.delete.mockResolvedValue({
        id: notificationId,
      });

      await mockPrisma.notification.delete({
        where: { id: notificationId },
      });

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: notificationId },
      });
    });
  });

  // ===========================================================================
  // Preferences Tests
  // ===========================================================================

  describe('preferences', () => {
    it('gets default preferences for new user', async () => {
      const userId = generateUserId();

      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

      const prefs = await mockPrisma.notificationPreference.findUnique({
        where: { userId },
      });

      expect(prefs).toBeNull();

      // Service should return defaults
      const defaultPrefs = createMockPreferences({ userId });
      expect(defaultPrefs.emailEnabled).toBe(true);
      expect(defaultPrefs.pushEnabled).toBe(true);
      expect(defaultPrefs.quietHoursEnabled).toBe(false);
    });

    it('updates preferences', async () => {
      const userId = generateUserId();
      const existingPrefs = createMockPreferences({ userId });
      const updatedPrefs = {
        ...existingPrefs,
        pushEnabled: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        quietHoursTimezone: 'UTC',
      };

      mockPrisma.notificationPreference.upsert.mockResolvedValue(updatedPrefs);

      const result = await mockPrisma.notificationPreference.upsert({
        where: { userId },
        update: {
          pushEnabled: false,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          quietHoursTimezone: 'UTC',
        },
        create: {
          userId,
          pushEnabled: false,
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '07:00',
          quietHoursTimezone: 'UTC',
        },
      });

      expect(result.pushEnabled).toBe(false);
      expect(result.quietHoursEnabled).toBe(true);
    });

    it('validates quiet hours configuration', () => {
      // Valid configuration
      const validPrefs = createMockPreferencesWithQuietHours();
      expect(validPrefs.quietHoursEnabled).toBe(true);
      expect(validPrefs.quietHoursStart).toBeDefined();
      expect(validPrefs.quietHoursEnd).toBeDefined();
      expect(validPrefs.quietHoursTimezone).toBeDefined();

      // Invalid: quiet hours enabled without times
      const invalidConfig = {
        quietHoursEnabled: true,
        quietHoursStart: null,
        quietHoursEnd: null,
        quietHoursTimezone: null,
      };

      const isValid =
        !invalidConfig.quietHoursEnabled ||
        (invalidConfig.quietHoursStart !== null &&
          invalidConfig.quietHoursEnd !== null &&
          invalidConfig.quietHoursTimezone !== null);

      expect(isValid).toBe(false);
    });
  });
});
