/**
 * Notification Settings API Routes
 *
 * Handles comprehensive notification preferences for the current user including:
 * - Email notification toggles by category
 * - Push notification settings
 * - Desktop notification preferences
 * - In-app notification settings
 * - Digest email frequency
 * - Quiet hours/Do Not Disturb scheduling
 * - Channel-specific notification overrides
 * - Per-notification-type preferences
 *
 * Routes:
 * - GET /api/notifications/settings - Get notification preferences
 * - PUT /api/notifications/settings - Update notification preferences
 *
 * @module app/api/notifications/settings/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
  type NotificationType,
  type DigestFrequency,
  isNotificationType,
  isDigestFrequency,
} from '@/types/notification';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Error response codes
 */
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  details?: Record<string, unknown>,
) {
  return {
    error: {
      message,
      code,
      ...details,
    },
  };
}

/**
 * Extract notification settings from user preferences JSON field
 */
function extractNotificationSettings(
  preferences: Prisma.JsonValue,
): NotificationSettings {
  let notificationSettings: Partial<NotificationSettings> = {};

  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    const prefsObj = preferences as Record<string, unknown>;

    if (
      'notificationSettings' in prefsObj &&
      typeof prefsObj.notificationSettings === 'object' &&
      prefsObj.notificationSettings !== null
    ) {
      notificationSettings =
        prefsObj.notificationSettings as Partial<NotificationSettings>;
    }
  }

  // Deep merge with defaults, ensuring all required fields are present
  const settings: NotificationSettings = {
    enabled:
      notificationSettings.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    sound: notificationSettings.sound ?? DEFAULT_NOTIFICATION_SETTINGS.sound,
    desktop:
      notificationSettings.desktop ?? DEFAULT_NOTIFICATION_SETTINGS.desktop,
    mobile: notificationSettings.mobile ?? DEFAULT_NOTIFICATION_SETTINGS.mobile,
    email: notificationSettings.email ?? DEFAULT_NOTIFICATION_SETTINGS.email,
    digestFrequency:
      notificationSettings.digestFrequency ??
      DEFAULT_NOTIFICATION_SETTINGS.digestFrequency,
    quietHours: {
      enabled:
        notificationSettings.quietHours?.enabled ??
        DEFAULT_NOTIFICATION_SETTINGS.quietHours.enabled,
      start:
        notificationSettings.quietHours?.start ??
        DEFAULT_NOTIFICATION_SETTINGS.quietHours.start,
      end:
        notificationSettings.quietHours?.end ??
        DEFAULT_NOTIFICATION_SETTINGS.quietHours.end,
    },
    mutedChannels:
      notificationSettings.mutedChannels ??
      DEFAULT_NOTIFICATION_SETTINGS.mutedChannels,
    preferences: {
      message: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.message,
        ...(notificationSettings.preferences?.message ?? {}),
      },
      mention: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.mention,
        ...(notificationSettings.preferences?.mention ?? {}),
      },
      reaction: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.reaction,
        ...(notificationSettings.preferences?.reaction ?? {}),
      },
      thread_reply: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.thread_reply,
        ...(notificationSettings.preferences?.thread_reply ?? {}),
      },
      channel_invite: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.channel_invite,
        ...(notificationSettings.preferences?.channel_invite ?? {}),
      },
      call_incoming: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.call_incoming,
        ...(notificationSettings.preferences?.call_incoming ?? {}),
      },
      call_missed: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.call_missed,
        ...(notificationSettings.preferences?.call_missed ?? {}),
      },
      orchestrator_update: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.orchestrator_update,
        ...(notificationSettings.preferences?.orchestrator_update ?? {}),
      },
      system: {
        ...DEFAULT_NOTIFICATION_SETTINGS.preferences.system,
        ...(notificationSettings.preferences?.system ?? {}),
      },
    },
  };

  return settings;
}

/**
 * Validate quiet hours time format (HH:mm)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate notification settings update
 */
function validateNotificationSettings(
  input: Record<string, unknown>,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Validate enabled
  if ('enabled' in input && typeof input.enabled !== 'boolean') {
    errors.enabled = 'Enabled must be a boolean';
  }

  // Validate sound
  if ('sound' in input && typeof input.sound !== 'boolean') {
    errors.sound = 'Sound must be a boolean';
  }

  // Validate desktop
  if ('desktop' in input && typeof input.desktop !== 'boolean') {
    errors.desktop = 'Desktop must be a boolean';
  }

  // Validate mobile
  if ('mobile' in input && typeof input.mobile !== 'boolean') {
    errors.mobile = 'Mobile must be a boolean';
  }

  // Validate email
  if ('email' in input && typeof input.email !== 'boolean') {
    errors.email = 'Email must be a boolean';
  }

  // Validate digestFrequency
  if (
    'digestFrequency' in input &&
    input.digestFrequency !== undefined &&
    !isDigestFrequency(input.digestFrequency)
  ) {
    errors.digestFrequency =
      'Digest frequency must be one of: instant, hourly, daily, weekly, never';
  }

  // Validate quietHours
  if ('quietHours' in input && input.quietHours !== undefined) {
    if (
      typeof input.quietHours !== 'object' ||
      input.quietHours === null ||
      Array.isArray(input.quietHours)
    ) {
      errors.quietHours = 'Quiet hours must be an object';
    } else {
      const qh = input.quietHours as Record<string, unknown>;

      if ('enabled' in qh && typeof qh.enabled !== 'boolean') {
        errors['quietHours.enabled'] = 'Quiet hours enabled must be a boolean';
      }

      if ('start' in qh && typeof qh.start === 'string') {
        if (!isValidTimeFormat(qh.start)) {
          errors['quietHours.start'] =
            'Quiet hours start must be in HH:mm format';
        }
      }

      if ('end' in qh && typeof qh.end === 'string') {
        if (!isValidTimeFormat(qh.end)) {
          errors['quietHours.end'] = 'Quiet hours end must be in HH:mm format';
        }
      }
    }
  }

  // Validate mutedChannels
  if ('mutedChannels' in input && input.mutedChannels !== undefined) {
    if (!Array.isArray(input.mutedChannels)) {
      errors.mutedChannels = 'Muted channels must be an array';
    } else {
      const allStrings = input.mutedChannels.every(
        (id: unknown) => typeof id === 'string',
      );
      if (!allStrings) {
        errors.mutedChannels = 'Muted channels must be an array of strings';
      }
    }
  }

  // Validate preferences
  if ('preferences' in input && input.preferences !== undefined) {
    if (
      typeof input.preferences !== 'object' ||
      input.preferences === null ||
      Array.isArray(input.preferences)
    ) {
      errors.preferences = 'Preferences must be an object';
    } else {
      const prefs = input.preferences as Record<string, unknown>;

      // Validate each notification type preference
      for (const [type, config] of Object.entries(prefs)) {
        if (!isNotificationType(type)) {
          errors[`preferences.${type}`] = `Invalid notification type: ${type}`;
          continue;
        }

        if (
          typeof config !== 'object' ||
          config === null ||
          Array.isArray(config)
        ) {
          errors[`preferences.${type}`] =
            'Notification type config must be an object';
          continue;
        }

        const cfg = config as Record<string, unknown>;

        if ('enabled' in cfg && typeof cfg.enabled !== 'boolean') {
          errors[`preferences.${type}.enabled`] = 'Enabled must be a boolean';
        }

        if ('sound' in cfg && typeof cfg.sound !== 'boolean') {
          errors[`preferences.${type}.sound`] = 'Sound must be a boolean';
        }

        if ('desktop' in cfg && typeof cfg.desktop !== 'boolean') {
          errors[`preferences.${type}.desktop`] = 'Desktop must be a boolean';
        }
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * GET /api/notifications/settings
 *
 * Get comprehensive notification settings for the current user.
 * Returns all notification preferences with defaults for any unset values.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns Complete notification settings
 *
 * @example
 * ```
 * GET /api/notifications/settings
 *
 * Response:
 * {
 *   "enabled": true,
 *   "sound": true,
 *   "desktop": true,
 *   "mobile": true,
 *   "email": false,
 *   "digestFrequency": "instant",
 *   "quietHours": {
 *     "enabled": false,
 *     "start": "22:00",
 *     "end": "08:00"
 *   },
 *   "mutedChannels": [],
 *   "preferences": {
 *     "message": { "enabled": true, "sound": true, "desktop": true },
 *     ...
 *   }
 * }
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const settings = extractNotificationSettings(user.preferences);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[GET /api/notifications/settings] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/notifications/settings
 *
 * Update notification settings for the current user.
 * Accepts partial updates - only provided fields will be changed.
 * Deep merges nested objects like quietHours and preferences.
 * Requires authentication.
 *
 * @param request - Next.js request with notification settings updates
 * @returns Updated notification settings
 *
 * @example
 * ```
 * PUT /api/notifications/settings
 * Content-Type: application/json
 *
 * {
 *   "enabled": true,
 *   "digestFrequency": "daily",
 *   "quietHours": {
 *     "enabled": true,
 *     "start": "22:00",
 *     "end": "08:00"
 *   },
 *   "preferences": {
 *     "mention": {
 *       "enabled": true,
 *       "sound": true,
 *       "desktop": true
 *     }
 *   }
 * }
 *
 * Response:
 * {
 *   "enabled": true,
 *   "sound": true,
 *   ...
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Basic validation
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        createErrorResponse(
          'Request body must be an object',
          ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;

    // Validate input
    const validation = validateNotificationSettings(input);
    if (!validation.valid) {
      return NextResponse.json(
        createErrorResponse('Validation failed', ERROR_CODES.VALIDATION_ERROR, {
          errors: validation.errors,
        }),
        { status: 400 },
      );
    }

    // Get current user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Extract current preferences
    const currentPrefs =
      typeof user.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    // Extract current notification settings
    const currentSettings = extractNotificationSettings(user.preferences);

    // Deep merge notification settings
    const updatedSettings: NotificationSettings = {
      ...currentSettings,
    };

    // Update top-level boolean fields
    if ('enabled' in input && typeof input.enabled === 'boolean') {
      updatedSettings.enabled = input.enabled;
    }
    if ('sound' in input && typeof input.sound === 'boolean') {
      updatedSettings.sound = input.sound;
    }
    if ('desktop' in input && typeof input.desktop === 'boolean') {
      updatedSettings.desktop = input.desktop;
    }
    if ('mobile' in input && typeof input.mobile === 'boolean') {
      updatedSettings.mobile = input.mobile;
    }
    if ('email' in input && typeof input.email === 'boolean') {
      updatedSettings.email = input.email;
    }

    // Update digestFrequency
    if (
      'digestFrequency' in input &&
      isDigestFrequency(input.digestFrequency)
    ) {
      updatedSettings.digestFrequency = input.digestFrequency;
    }

    // Update quietHours (deep merge)
    if (
      'quietHours' in input &&
      typeof input.quietHours === 'object' &&
      input.quietHours !== null
    ) {
      const qh = input.quietHours as Record<string, unknown>;
      updatedSettings.quietHours = {
        ...updatedSettings.quietHours,
      };

      if ('enabled' in qh && typeof qh.enabled === 'boolean') {
        updatedSettings.quietHours.enabled = qh.enabled;
      }
      if ('start' in qh && typeof qh.start === 'string') {
        updatedSettings.quietHours.start = qh.start;
      }
      if ('end' in qh && typeof qh.end === 'string') {
        updatedSettings.quietHours.end = qh.end;
      }
    }

    // Update mutedChannels
    if (
      'mutedChannels' in input &&
      Array.isArray(input.mutedChannels) &&
      input.mutedChannels.every((id: unknown) => typeof id === 'string')
    ) {
      updatedSettings.mutedChannels = input.mutedChannels as string[];
    }

    // Update preferences (deep merge per notification type)
    if (
      'preferences' in input &&
      typeof input.preferences === 'object' &&
      input.preferences !== null
    ) {
      const prefs = input.preferences as Record<string, unknown>;

      for (const [type, config] of Object.entries(prefs)) {
        if (
          !isNotificationType(type) ||
          typeof config !== 'object' ||
          config === null
        ) {
          continue;
        }

        const cfg = config as Record<string, unknown>;
        const currentTypePrefs = updatedSettings.preferences[
          type as NotificationType
        ] || { enabled: true, sound: true, desktop: true };

        updatedSettings.preferences[type as NotificationType] = {
          ...currentTypePrefs,
        };

        if ('enabled' in cfg && typeof cfg.enabled === 'boolean') {
          updatedSettings.preferences[type as NotificationType].enabled =
            cfg.enabled;
        }
        if ('sound' in cfg && typeof cfg.sound === 'boolean') {
          updatedSettings.preferences[type as NotificationType].sound =
            cfg.sound;
        }
        if ('desktop' in cfg && typeof cfg.desktop === 'boolean') {
          updatedSettings.preferences[type as NotificationType].desktop =
            cfg.desktop;
        }
      }
    }

    // Update user preferences in database (merge with existing preferences)
    const updatedPrefs = {
      ...currentPrefs,
      notificationSettings: updatedSettings,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('[PUT /api/notifications/settings] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
