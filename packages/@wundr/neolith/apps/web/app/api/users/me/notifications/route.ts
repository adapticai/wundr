/**
 * User Notification Preferences API Routes
 *
 * Handles getting and updating notification preferences for the current user.
 *
 * Routes:
 * - GET /api/users/me/notifications - Get notification preferences
 * - PATCH /api/users/me/notifications - Update notification preferences
 *
 * @module app/api/users/me/notifications/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  notificationPreferencesSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { NotificationPreferencesInput } from '@/lib/validations/notification';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferencesInput = {
  messages: true,
  mentions: true,
  threads: true,
  calls: true,
  directMessages: true,
  channelInvites: true,
  organizationUpdates: true,
  digest: 'instant',
  email: {
    enabled: true,
    frequency: 'daily',
  },
  soundEnabled: true,
  vibrationEnabled: true,
  showPreviews: true,
};

/**
 * Extract notification preferences from user preferences JSON
 */
function extractNotificationPreferences(
  preferences: Prisma.JsonValue,
): NotificationPreferencesInput {
  if (
    typeof preferences === 'object' &&
    preferences !== null &&
    !Array.isArray(preferences)
  ) {
    const prefs = preferences as Record<string, unknown>;
    const notifications = prefs.notifications;

    if (
      typeof notifications === 'object' &&
      notifications !== null &&
      !Array.isArray(notifications)
    ) {
      return {
        ...DEFAULT_PREFERENCES,
        ...(notifications as NotificationPreferencesInput),
      };
    }
  }

  return DEFAULT_PREFERENCES;
}

/**
 * GET /api/users/me/notifications
 *
 * Get notification preferences for the current user.
 * Returns merged preferences with defaults for any unset values.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns Notification preferences
 *
 * @example
 * ```
 * GET /api/users/me/notifications
 *
 * Response:
 * {
 *   "data": {
 *     "messages": true,
 *     "mentions": true,
 *     "threads": false,
 *     "calls": true,
 *     "digest": "hourly",
 *     "quietHours": {
 *       "start": "22:00",
 *       "end": "08:00",
 *       "timezone": "America/New_York",
 *       "enabled": true
 *     },
 *     "email": {
 *       "enabled": true,
 *       "frequency": "daily"
 *     },
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
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
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
        createNotificationErrorResponse('User not found', NOTIFICATION_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    const notificationPrefs = extractNotificationPreferences(user.preferences);

    return NextResponse.json({ data: notificationPrefs });
  } catch (error) {
    console.error('[GET /api/users/me/notifications] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/users/me/notifications
 *
 * Update notification preferences for the current user.
 * Only provided fields will be updated; others remain unchanged.
 * Requires authentication.
 *
 * @param request - Next.js request with preference updates
 * @returns Updated notification preferences
 *
 * @example
 * ```
 * PATCH /api/users/me/notifications
 * Content-Type: application/json
 *
 * {
 *   "threads": false,
 *   "digest": "hourly",
 *   "quietHours": {
 *     "start": "22:00",
 *     "end": "08:00"
 *   }
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "messages": true,
 *     "mentions": true,
 *     "threads": false,
 *     "digest": "hourly",
 *     "quietHours": {
 *       "start": "22:00",
 *       "end": "08:00",
 *       "enabled": true
 *     },
 *     ...
 *   },
 *   "message": "Notification preferences updated successfully"
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createNotificationErrorResponse('Invalid JSON body', NOTIFICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = notificationPreferencesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Validation failed',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: NotificationPreferencesInput = parseResult.data;

    // Get current user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createNotificationErrorResponse('User not found', NOTIFICATION_ERROR_CODES.NOT_FOUND),
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

    const currentNotificationPrefs = extractNotificationPreferences(user.preferences);

    // Merge preferences
    const updatedNotificationPrefs: NotificationPreferencesInput = {
      ...currentNotificationPrefs,
      ...input,
      // Deep merge for nested objects
      ...(input.quietHours && {
        quietHours: {
          ...currentNotificationPrefs.quietHours,
          ...input.quietHours,
        },
      }),
      ...(input.email && {
        email: {
          ...currentNotificationPrefs.email,
          ...input.email,
        },
      }),
    };

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          notifications: updatedNotificationPrefs,
        },
      },
    });

    return NextResponse.json({
      data: updatedNotificationPrefs,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/users/me/notifications] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
