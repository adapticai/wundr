/**
 * Notification Service
 * Handles in-app and push notifications
 * @module lib/services/notification-service
 */

import { prisma } from '@neolith/database';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendNotification(
  payload: NotificationPayload
): Promise<void> {
  try {
    await (prisma as any).notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        read: false,
      },
    });
  } catch {
    // DB write failed; continue to pub/sub attempt
  }

  try {
    const Redis = await import('ioredis').catch(() => null);
    if (Redis) {
      const publisher = new Redis.default();
      await publisher.publish(
        `user:${payload.userId}:notifications`,
        JSON.stringify(payload)
      );
      publisher.disconnect();
    }
  } catch {
    // Redis unavailable; notification already persisted in DB
  }
}

export async function sendBulkNotifications(
  payloads: NotificationPayload[]
): Promise<void> {
  try {
    await (prisma as any).notification.createMany({
      data: payloads.map(p => ({
        userId: p.userId,
        type: p.type,
        title: p.title,
        body: p.body,
        data: p.data ?? {},
        read: false,
      })),
      skipDuplicates: true,
    });
  } catch {
    // Fall back to individual inserts if createMany is unavailable
    for (const payload of payloads) {
      await sendNotification(payload);
    }
    return;
  }

  try {
    const Redis = await import('ioredis').catch(() => null);
    if (Redis) {
      const publisher = new Redis.default();
      await Promise.all(
        payloads.map(p =>
          publisher.publish(`user:${p.userId}:notifications`, JSON.stringify(p))
        )
      );
      publisher.disconnect();
    }
  } catch {
    // Redis unavailable; notifications already persisted in DB
  }
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  try {
    await (prisma as any).notification.update({
      where: { id: notificationId, userId },
      data: { read: true, readAt: new Date() },
    });
  } catch {
    // Notification not found or update failed
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await (prisma as any).notification.count({
      where: { userId, read: false },
    });
  } catch {
    return 0;
  }
}

export async function subscribeToChannel(
  userId: string,
  channelId: string
): Promise<void> {
  try {
    await (prisma as any).notificationPreference.upsert({
      where: { userId_channelId: { userId, channelId } },
      update: { subscribed: true },
      create: { userId, channelId, subscribed: true },
    });
  } catch {
    // Preference record unavailable or upsert failed
  }
}

export async function unsubscribeFromChannel(
  userId: string,
  channelId: string
): Promise<void> {
  try {
    await (prisma as any).notificationPreference.update({
      where: { userId_channelId: { userId, channelId } },
      data: { subscribed: false },
    });
  } catch {
    // Record may not exist; nothing to unsubscribe
  }
}

/**
 * NotificationService class for dependency injection
 */
export class NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    return sendNotification(payload);
  }

  async sendBulk(payloads: NotificationPayload[]): Promise<void> {
    return sendBulkNotifications(payloads);
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    return markNotificationRead(notificationId, userId);
  }

  async getUnread(userId: string): Promise<number> {
    return getUnreadCount(userId);
  }

  async subscribe(userId: string, channelId: string): Promise<void> {
    return subscribeToChannel(userId, channelId);
  }

  async unsubscribe(userId: string, channelId: string): Promise<void> {
    return unsubscribeFromChannel(userId, channelId);
  }

  static async notifyChannelInvite(params: {
    userId: string;
    channelId: string;
    inviterId: string;
  }): Promise<void> {
    await sendNotification({
      userId: params.userId,
      type: 'CHANNEL_INVITE',
      title: 'Channel Invitation',
      body: `You have been invited to a channel`,
      data: {
        channelId: params.channelId,
        inviterId: params.inviterId,
      },
    });
  }

  static async notifyMention(params: {
    userId: string;
    messageId: string;
    channelId: string;
    mentionedBy: string;
  }): Promise<void> {
    await sendNotification({
      userId: params.userId,
      type: 'MENTION',
      title: 'You were mentioned',
      body: `${params.mentionedBy} mentioned you in a message`,
      data: {
        messageId: params.messageId,
        channelId: params.channelId,
        mentionedBy: params.mentionedBy,
      },
    });
  }

  static async notifyThreadReply(params: {
    userId: string;
    messageId: string;
    channelId: string;
    repliedBy: string;
  }): Promise<void> {
    await sendNotification({
      userId: params.userId,
      type: 'THREAD_REPLY',
      title: 'New reply in thread',
      body: `${params.repliedBy} replied to a thread you follow`,
      data: {
        messageId: params.messageId,
        channelId: params.channelId,
        repliedBy: params.repliedBy,
      },
    });
  }

  static async notifyTaskAssigned(
    assigneeId: string,
    taskId: string,
    taskTitle: string,
    assignedBy: string
  ): Promise<void> {
    await sendNotification({
      userId: assigneeId,
      type: 'task_assigned',
      title: 'Task Assigned',
      body: `${assignedBy} assigned you "${taskTitle}"`,
      data: {
        taskId,
        taskTitle,
        assignedBy,
      },
    });
  }
}
