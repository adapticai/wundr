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

export interface QueuedAction {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
  retryCount: number;
}

export interface ConflictResolution {
  id: string;
  localData: unknown;
  serverData: unknown;
  type: string;
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
