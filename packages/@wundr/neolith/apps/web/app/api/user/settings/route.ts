/**
 * User Settings API Routes
 *
 * Main settings endpoint for retrieving and updating user preferences.
 * Handles all user configuration including general, notifications, appearance, and privacy.
 *
 * Routes:
 * - GET /api/user/settings - Get all user settings
 * - PUT /api/user/settings - Update user settings
 *
 * @module app/api/user/settings/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  userSettingsSchema,
  createSettingsErrorResponse,
  SETTINGS_ERROR_CODES,
  type UserSettings,
} from '@/lib/validations/settings';

import type { NextRequest } from 'next/server';

/**
 * GET /api/user/settings
 *
 * Retrieve all settings for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Complete user settings object
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        preferences: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'User not found',
          SETTINGS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Parse preferences from JSONB
    const prefs = (user.preferences as Record<string, unknown>) || {};

    // Construct settings object with defaults
    const settings: UserSettings = {
      general: {
        language: (prefs.language as string) || 'en',
        timezone: (prefs.timezone as string) || 'UTC',
        dateFormat:
          (prefs.dateFormat as 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY') ||
          'MM/DD/YYYY',
        timeFormat: (prefs.timeFormat as '12h' | '24h') || '12h',
        startOfWeek:
          (prefs.startOfWeek as 'sunday' | 'monday' | 'saturday') || 'sunday',
        autoPlayMedia: (prefs.autoPlayMedia as boolean) ?? true,
        markAsReadOnView: (prefs.markAsReadOnView as boolean) ?? true,
        enterToSend: (prefs.enterToSend as boolean) ?? true,
        spellCheck: (prefs.spellCheck as boolean) ?? true,
      },
      notifications: {
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
      },
      appearance: {
        theme: (prefs.theme as 'light' | 'dark' | 'system') || 'system',
        colorScheme:
          (prefs.colorScheme as 'blue' | 'purple' | 'green' | 'orange' | 'red') || 'blue',
        fontSize:
          (prefs.fontSize as 'small' | 'medium' | 'large' | 'extra-large') || 'medium',
        density: (prefs.density as 'compact' | 'comfortable' | 'spacious') || 'comfortable',
        reduceMotion: (prefs.reduceMotion as boolean) ?? false,
        highContrast: (prefs.highContrast as boolean) ?? false,
        sidebarPosition: (prefs.sidebarPosition as 'left' | 'right') || 'left',
        messageGrouping: (prefs.messageGrouping as boolean) ?? true,
        showAvatars: (prefs.showAvatars as boolean) ?? true,
        emojiStyle:
          (prefs.emojiStyle as 'native' | 'twitter' | 'google' | 'apple') || 'native',
      },
      privacy: {
        showOnlineStatus: (prefs.showOnlineStatus as boolean) ?? true,
        showReadReceipts: (prefs.showReadReceipts as boolean) ?? true,
        showTypingIndicators: (prefs.showTypingIndicators as boolean) ?? true,
        profileDiscoverable: (prefs.profileDiscoverable as boolean) ?? true,
        allowAnalytics: (prefs.allowAnalytics as boolean) ?? true,
        allowThirdPartyDataSharing: (prefs.allowThirdPartyDataSharing as boolean) ?? false,
        whoCanSendMessages:
          (prefs.whoCanSendMessages as 'everyone' | 'workspace-members' | 'connections') ||
          'everyone',
        whoCanSeePosts:
          (prefs.whoCanSeePosts as 'public' | 'workspace' | 'private') || 'workspace',
        allowDirectMessages: (prefs.allowDirectMessages as boolean) ?? true,
        showActivityStatus: (prefs.showActivityStatus as boolean) ?? true,
        dataRetention:
          (prefs.dataRetention as 'forever' | '1-year' | '6-months' | '3-months') || 'forever',
      },
    };

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('[GET /api/user/settings] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PUT /api/user/settings
 *
 * Update user settings. Performs a deep merge with existing settings.
 *
 * @param request - Next.js request with settings updates
 * @returns Updated settings
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Authentication required',
          SETTINGS_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
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
          SETTINGS_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const parseResult = userSettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createSettingsErrorResponse(
          'Validation failed',
          SETTINGS_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
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
          SETTINGS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Flatten settings into preference keys
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPrefs = { ...currentPrefs };

    // Update general settings
    if (updates.general) {
      Object.entries(updates.general).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[key] = value;
        }
      });
    }

    // Update notification settings
    if (updates.notifications) {
      if (updates.notifications.email) {
        Object.entries(updates.notifications.email).forEach(([key, value]) => {
          if (value !== undefined) {
            updatedPrefs[`email${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
          }
        });
      }
      if (updates.notifications.push) {
        Object.entries(updates.notifications.push).forEach(([key, value]) => {
          if (value !== undefined) {
            updatedPrefs[`push${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
          }
        });
      }
      if (updates.notifications.inApp) {
        Object.entries(updates.notifications.inApp).forEach(([key, value]) => {
          if (value !== undefined) {
            updatedPrefs[`inApp${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
          }
        });
      }
      if (updates.notifications.desktop) {
        Object.entries(updates.notifications.desktop).forEach(([key, value]) => {
          if (value !== undefined) {
            updatedPrefs[`desktop${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
          }
        });
      }
      if (updates.notifications.doNotDisturb) {
        Object.entries(updates.notifications.doNotDisturb).forEach(([key, value]) => {
          if (value !== undefined) {
            updatedPrefs[`dnd${key.charAt(0).toUpperCase()}${key.slice(1)}`] = value;
          }
        });
      }
    }

    // Update appearance settings
    if (updates.appearance) {
      Object.entries(updates.appearance).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[key] = value;
        }
      });
    }

    // Update privacy settings
    if (updates.privacy) {
      Object.entries(updates.privacy).forEach(([key, value]) => {
        if (value !== undefined) {
          updatedPrefs[key] = value;
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
      message: 'Settings updated successfully',
      data: updates,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
