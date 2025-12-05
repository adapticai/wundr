/**
 * User Privacy Settings API Routes
 *
 * Handles privacy settings including visibility, analytics, and data sharing preferences.
 *
 * Routes:
 * - GET /api/user/privacy - Get current privacy settings
 * - PATCH /api/user/privacy - Update privacy settings
 *
 * @module app/api/user/privacy/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

interface PrivacySettings {
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  showTypingIndicators: boolean;
  profileDiscoverable: boolean;
  allowAnalytics: boolean;
  allowThirdPartyDataSharing: boolean;
}

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

/**
 * GET /api/user/privacy
 *
 * Fetch current privacy settings for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Privacy settings and preferences
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Extract privacy settings from preferences
    const prefs = (user.preferences as Record<string, unknown>) || {};
    const privacySettings: PrivacySettings = {
      showOnlineStatus: (prefs.showOnlineStatus as boolean) ?? true,
      showReadReceipts: (prefs.showReadReceipts as boolean) ?? true,
      showTypingIndicators: (prefs.showTypingIndicators as boolean) ?? true,
      profileDiscoverable: (prefs.profileDiscoverable as boolean) ?? true,
      allowAnalytics: (prefs.allowAnalytics as boolean) ?? true,
      allowThirdPartyDataSharing:
        (prefs.allowThirdPartyDataSharing as boolean) ?? false,
    };

    const cookiePreferences: CookiePreferences = {
      essential: true,
      functional: (prefs.cookieFunctional as boolean) ?? true,
      analytics: (prefs.cookieAnalytics as boolean) ?? true,
      advertising: (prefs.cookieAdvertising as boolean) ?? false,
    };

    // Check for active data export
    const exportStatus = (prefs.dataExportStatus as Record<
      string,
      unknown
    >) || {
      status: 'idle',
      progress: 0,
    };

    return NextResponse.json({
      settings: privacySettings,
      cookiePreferences,
      exportStatus,
    });
  } catch (error) {
    console.error('[GET /api/user/privacy] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/privacy
 *
 * Update privacy settings for the authenticated user.
 *
 * @param request - Next.js request object with settings to update
 * @returns Updated privacy settings
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Merge with existing preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      ...body,
    };

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as never,
      },
    });

    return NextResponse.json({
      success: true,
      settings: body,
    });
  } catch (error) {
    console.error('[PATCH /api/user/privacy] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
