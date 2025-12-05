/**
 * Notification Validation Schemas
 * @module lib/validations/notification
 */

import { z } from 'zod';

export const NOTIFICATION_ERROR_CODES = {
  INVALID_TYPE: 'NOTIFICATION_INVALID_TYPE',
  INVALID_RECIPIENT: 'NOTIFICATION_INVALID_RECIPIENT',
  DELIVERY_FAILED: 'NOTIFICATION_DELIVERY_FAILED',
  INVALID_CHANNEL: 'NOTIFICATION_INVALID_CHANNEL',
  RATE_LIMIT_EXCEEDED: 'NOTIFICATION_RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED: 'NOTIFICATION_UNAUTHORIZED',
  VALIDATION_ERROR: 'NOTIFICATION_VALIDATION_ERROR',
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  FORBIDDEN: 'NOTIFICATION_FORBIDDEN',
  INTERNAL_ERROR: 'NOTIFICATION_INTERNAL_ERROR',
  DUPLICATE_SUBSCRIPTION: 'NOTIFICATION_DUPLICATE_SUBSCRIPTION',
  DEVICE_NOT_FOUND: 'NOTIFICATION_DEVICE_NOT_FOUND',
  WEBHOOK_ERROR: 'NOTIFICATION_WEBHOOK_ERROR',
  SYNC_ERROR: 'NOTIFICATION_SYNC_ERROR',
} as const;

export type NotificationErrorCode =
  (typeof NOTIFICATION_ERROR_CODES)[keyof typeof NOTIFICATION_ERROR_CODES];

export const notificationTypeSchema = z.enum([
  'info',
  'success',
  'warning',
  'error',
  'mention',
  'task_assigned',
  'task_completed',
  'system',
]);

export const notificationChannelSchema = z.enum([
  'in_app',
  'email',
  'push',
  'webhook',
]);

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  recipientId: z.string(),
  channels: z.array(notificationChannelSchema),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  read: z.boolean(),
  actionUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().optional(),
});

export const createNotificationSchema = notificationSchema.omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export const notificationPreferencesSchema = z.object({
  userId: z.string(),
  channels: z.record(notificationChannelSchema, z.boolean()),
  muteUntil: z.string().datetime().optional(),
  categories: z.record(notificationTypeSchema, z.boolean()).optional(),
  messages: z.boolean().optional(),
  mentions: z.boolean().optional(),
  threads: z.boolean().optional(),
  calls: z.boolean().optional(),
  directMessages: z.boolean().optional(),
  channelInvites: z.boolean().optional(),
  organizationUpdates: z.boolean().optional(),
  digest: z.enum(['instant', 'hourly', 'daily', 'weekly']).optional(),
  email: z
    .object({
      enabled: z.boolean(),
      frequency: z.enum(['instant', 'hourly', 'daily', 'weekly']),
    })
    .optional(),
  quietHours: z
    .object({
      start: z.string(),
      end: z.string(),
      timezone: z.string().optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
  soundEnabled: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
  showPreviews: z.boolean().optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().min(1, 'Notification ID is required'),
});

export const updateNotificationSchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const testNotificationSchema = z.object({
  recipientId: z.string(),
  type: notificationTypeSchema,
  channels: z.array(notificationChannelSchema).min(1),
  token: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export const syncRequestSchema = z.object({
  userId: z.string(),
  lastSyncAt: z.string().datetime().optional(),
  deviceId: z.string().optional(),
});

export const incrementalSyncSchema = z.object({
  syncToken: z.string(),
  entities: z
    .array(
      z.enum(['messages', 'channels', 'users', 'notifications', 'workspaces']),
    )
    .optional(),
  workspaceId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
});

export const batchResolveConflictsSchema = z.object({
  conflicts: z.array(
    z.object({
      conflictId: z.string(),
      resolution: z.enum(['CLIENT_WINS', 'SERVER_WINS', 'MERGE', 'MANUAL']),
      mergedData: z.record(z.unknown()).optional(),
    }),
  ),
});

export const offlineQueueItemSchema = z.object({
  id: z.string(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  entity: z.enum([
    'messages',
    'channels',
    'users',
    'notifications',
    'workspaces',
  ]),
  entityId: z.string().optional(),
  payload: z.record(z.unknown()),
  queuedAt: z.coerce.date(),
});

export const processQueueSchema = z.object({
  items: z.array(offlineQueueItemSchema),
  sequential: z.boolean().default(true).optional(),
  limit: z.coerce.number().int().positive().max(100).default(10).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const pushSubscriptionSchema = z.object({
  userId: z.string(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  deviceId: z.string().optional(),
  userAgent: z.string().optional(),
  token: z.string().optional(),
  platform: z.enum(['web', 'ios', 'android', 'desktop']).optional(),
  deviceName: z.string().optional(),
  deviceModel: z.string().optional(),
  appVersion: z.string().optional(),
});

export const pushUnsubscribeSchema = z.object({
  userId: z.string(),
  endpoint: z.string().url(),
  token: z.string().optional(),
});

export const pushWebhookSchema = z.object({
  endpoint: z.string().url(),
  events: z.array(notificationTypeSchema),
  secret: z.string().min(32),
  active: z.boolean().default(true),
  token: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  notificationId: z.string().optional(),
  platform: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export const createNotificationErrorResponse = (
  message: string,
  code: NotificationErrorCode,
  details?: Record<string, unknown>,
) => ({
  error: {
    code,
    message,
    details,
  },
});

// Type exports using z.infer
export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type TestNotificationInput = z.infer<typeof testNotificationSchema>;
export type SyncRequestInput = z.infer<typeof syncRequestSchema> & {
  entities?: SyncEntity[];
  workspaceId?: string;
  limit?: number;
  lastSyncToken?: string;
  includeDeleted?: boolean;
};
export type IncrementalSyncInput = z.infer<typeof incrementalSyncSchema>;
export type BatchResolveConflictsInput = z.infer<
  typeof batchResolveConflictsSchema
>;
export type ProcessQueueInput = z.infer<typeof processQueueSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type PushUnsubscribeInput = z.infer<typeof pushUnsubscribeSchema>;
export type PushWebhookPayload = z.infer<typeof pushWebhookSchema>;

// Complex types referenced by API routes
export type SyncEntity =
  | 'messages'
  | 'channels'
  | 'users'
  | 'notifications'
  | 'workspaces';

export type ResolveConflictInput = {
  conflictId: string;
  resolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE' | 'MANUAL';
  mergedData?: Record<string, unknown>;
};

export type ConflictItem = {
  id: string;
  entity: SyncEntity;
  entityId: string;
  clientData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictedAt: string;
  suggestedResolution: 'CLIENT_WINS' | 'SERVER_WINS' | 'MERGE';
};

export type OfflineQueueItem = {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: SyncEntity;
  entityId?: string;
  payload: Record<string, unknown>;
  queuedAt: Date;
};

export type QueueProcessingResult = {
  processed: number;
  failed: number;
  conflicts: ConflictItem[];
  results: {
    id: string;
    success: boolean;
    entityId?: string;
    error?: string;
  }[];
};

export type SyncResponse = {
  syncToken: string;
  changes: {
    entity: SyncEntity;
    created: unknown[];
    updated: unknown[];
    deleted: string[];
  }[];
  hasMore: boolean;
  syncedAt: string;
};
