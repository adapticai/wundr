/**
 * Notification Settings API Route
 *
 * Handles notification preferences including email, push, in-app, and desktop notifications.
 * Also manages Do Not Disturb settings.
 *
 * Routes:
 * - GET /api/user/settings/notifications - Get notification preferences
 * - PUT /api/user/settings/notifications - Update notification preferences
 *
 * @module app/api/user/settings/notifications/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  notificationPreferencesSchema,
  createSettingsErrorResponse,
  SETTINGS_ERROR_CODES,
  type NotificationPreferences,
} from '@/lib/validations/settings';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/user/settings/notifications
 *
 * Retrieve notification preferences for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Notification preferences
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'User not found',
          SETTINGS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};

    const notificationSettings: NotificationPreferences = {
      email: {
        messages: (prefs.emailMessages as boolean) ?? true,
        mentions: (prefs.emailMentions as boolean) ?? true,
        channelActivity: (prefs.emailChannelActivity as boolean) ?? false,
        workspaceInvites: (prefs.emailWorkspaceInvites as boolean) ?? true,
        taskUpdates: (prefs.emailTaskUpdates as boolean) ?? true,
        systemUpdates: (prefs.emailSystemUpdates as boolean) ?? true,
        securityAlerts: (prefs.emailSecurityAlerts as boolean) ?? true,
        marketing: (prefs.emailMarketing as boolean) ?? false,
      },
      push: {
        messages: (prefs.pushMessages as boolean) ?? true,
        mentions: (prefs.pushMentions as boolean) ?? true,
        calls: (prefs.pushCalls as boolean) ?? true,
        taskReminders: (prefs.pushTaskReminders as boolean) ?? true,
      },
      inApp: {
        messages: (prefs.inAppMessages as boolean) ?? true,
        mentions: (prefs.inAppMentions as boolean) ?? true,
        reactions: (prefs.inAppReactions as boolean) ?? true,
        channelActivity: (prefs.inAppChannelActivity as boolean) ?? true,
        calls: (prefs.inAppCalls as boolean) ?? true,
      },
      desktop: {
        enabled: (prefs.desktopNotifications as boolean) ?? true,
        sound: (prefs.desktopSound as boolean) ?? true,
        badge: (prefs.desktopBadge as boolean) ?? true,
      },
      doNotDisturb: {
        enabled: (prefs.dndEnabled as boolean) ?? false,
        startTime: (prefs.dndStartTime as string) || '22:00',
        endTime: (prefs.dndEndTime as string) || '08:00',
        days: (prefs.dndDays as number[]) || [0, 1, 2, 3, 4, 5, 6],
      },
    };

    return NextResponse.json({
      success: true,
      data: notificationSettings,
    });
  } catch (error) {
    console.error('[GET /api/user/settings/notifications] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings/notifications
 *
 * Update notification preferences for the authenticated user.
 *
 * @param request - Request with notification preference updates
 * @returns Updated notification preferences
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Invalid JSON body',
          SETTINGS_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const parseResult = notificationPreferencesSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Validation failed',
          SETTINGS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const updates = parseResult.data;

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'User not found',
          SETTINGS_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Update preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPrefs = { ...currentPrefs };

    // Update email notification preferences
    if (updates.email) {
      Object.entries(updates.email).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[`email${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            value;
        }
      });
    }

    // Update push notification preferences
    if (updates.push) {
      Object.entries(updates.push).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[`push${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            value;
        }
      });
    }

    // Update in-app notification preferences
    if (updates.inApp) {
      Object.entries(updates.inApp).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[`inApp${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            value;
        }
      });
    }

    // Update desktop notification preferences
    if (updates.desktop) {
      Object.entries(updates.desktop).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[`desktop${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            value;
        }
      });
    }

    // Update Do Not Disturb settings
    if (updates.doNotDisturb) {
      Object.entries(updates.doNotDisturb).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[`dnd${key.charAt(0).toUpperCase()}${key.slice(1)}`] =
            value;
        }
      });
    }

    // Update user preferences in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: updates,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings/notifications] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
