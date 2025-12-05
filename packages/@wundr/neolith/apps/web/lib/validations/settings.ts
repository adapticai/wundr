/**
 * User Settings Validation Schemas
 *
 * Comprehensive validation schemas for all user settings including
 * notifications, appearance, privacy, and general preferences.
 *
 * @module lib/validations/settings
 */

import { z } from 'zod';

/**
 * Notification preferences schema
 */
export const notificationPreferencesSchema = z.object({
  email: z
    .object({
      messages: z.boolean().optional(),
      mentions: z.boolean().optional(),
      channelActivity: z.boolean().optional(),
      workspaceInvites: z.boolean().optional(),
      taskUpdates: z.boolean().optional(),
      systemUpdates: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  push: z
    .object({
      messages: z.boolean().optional(),
      mentions: z.boolean().optional(),
      calls: z.boolean().optional(),
      taskReminders: z.boolean().optional(),
    })
    .optional(),
  inApp: z
    .object({
      messages: z.boolean().optional(),
      mentions: z.boolean().optional(),
      reactions: z.boolean().optional(),
      channelActivity: z.boolean().optional(),
      calls: z.boolean().optional(),
    })
    .optional(),
  desktop: z
    .object({
      enabled: z.boolean().optional(),
      sound: z.boolean().optional(),
      badge: z.boolean().optional(),
    })
    .optional(),
  doNotDisturb: z
    .object({
      enabled: z.boolean().optional(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      days: z.array(z.number().min(0).max(6)).optional(),
    })
    .optional(),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

/**
 * Appearance settings schema
 */
export const appearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  colorScheme: z.enum(['blue', 'purple', 'green', 'orange', 'red']).optional(),
  fontSize: z.enum(['small', 'medium', 'large', 'extra-large']).optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  reduceMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  sidebarPosition: z.enum(['left', 'right']).optional(),
  messageGrouping: z.boolean().optional(),
  showAvatars: z.boolean().optional(),
  emojiStyle: z.enum(['native', 'twitter', 'google', 'apple']).optional(),
});

export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;

/**
 * Privacy settings schema
 */
export const privacySettingsSchema = z.object({
  showOnlineStatus: z.boolean().optional(),
  showReadReceipts: z.boolean().optional(),
  showTypingIndicators: z.boolean().optional(),
  profileDiscoverable: z.boolean().optional(),
  allowAnalytics: z.boolean().optional(),
  allowThirdPartyDataSharing: z.boolean().optional(),
  whoCanSendMessages: z
    .enum(['everyone', 'workspace-members', 'connections'])
    .optional(),
  whoCanSeePosts: z.enum(['public', 'workspace', 'private']).optional(),
  allowDirectMessages: z.boolean().optional(),
  showActivityStatus: z.boolean().optional(),
  dataRetention: z.enum(['forever', '1-year', '6-months', '3-months']).optional(),
});

export type PrivacySettings = z.infer<typeof privacySettingsSchema>;

/**
 * Data export request schema
 */
export const dataExportRequestSchema = z.object({
  includeMessages: z.boolean().default(true),
  includeFiles: z.boolean().default(true),
  includeProfile: z.boolean().default(true),
  includeSettings: z.boolean().default(true),
  format: z.enum(['json', 'csv', 'zip']).default('zip'),
  notifyWhenReady: z.boolean().default(true),
});

export type DataExportRequest = z.infer<typeof dataExportRequestSchema>;

/**
 * General settings schema (main settings object)
 */
export const generalSettingsSchema = z.object({
  language: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z
    .enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY'])
    .optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
  startOfWeek: z.enum(['sunday', 'monday', 'saturday']).optional(),
  autoPlayMedia: z.boolean().optional(),
  markAsReadOnView: z.boolean().optional(),
  enterToSend: z.boolean().optional(),
  spellCheck: z.boolean().optional(),
});

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

/**
 * Complete user settings schema
 */
export const userSettingsSchema = z.object({
  general: generalSettingsSchema.optional(),
  notifications: notificationPreferencesSchema.optional(),
  appearance: appearanceSettingsSchema.optional(),
  privacy: privacySettingsSchema.optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

/**
 * Error codes for settings operations
 */
export const SETTINGS_ERROR_CODES = {
  UNAUTHORIZED: 'SETTINGS_UNAUTHORIZED',
  VALIDATION_ERROR: 'SETTINGS_VALIDATION_ERROR',
  NOT_FOUND: 'SETTINGS_NOT_FOUND',
  UPDATE_FAILED: 'SETTINGS_UPDATE_FAILED',
  EXPORT_FAILED: 'SETTINGS_EXPORT_FAILED',
  EXPORT_IN_PROGRESS: 'SETTINGS_EXPORT_IN_PROGRESS',
  INTERNAL_ERROR: 'SETTINGS_INTERNAL_ERROR',
} as const;

export type SettingsErrorCode =
  (typeof SETTINGS_ERROR_CODES)[keyof typeof SETTINGS_ERROR_CODES];

/**
 * Create standardized settings error response
 */
export function createSettingsErrorResponse(
  message: string,
  code: SettingsErrorCode,
  details?: Record<string, unknown>,
) {
  return {
    success: false,
    error: message,
    code,
    details,
  };
}
