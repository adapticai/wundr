/**
 * Privacy Settings API Route
 *
 * Handles privacy preferences including visibility, data sharing, and activity tracking.
 *
 * Routes:
 * - GET /api/user/settings/privacy - Get privacy settings
 * - PUT /api/user/settings/privacy - Update privacy settings
 *
 * @module app/api/user/settings/privacy/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  privacySettingsSchema,
  createSettingsErrorResponse,
  SETTINGS_ERROR_CODES,
  type PrivacySettings,
} from '@/lib/validations/settings';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/user/settings/privacy
 *
 * Retrieve privacy settings for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Privacy settings
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
          SETTINGS_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};

    const privacySettings: PrivacySettings = {
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
    };

    return NextResponse.json({
      success: true,
      data: privacySettings,
    });
  } catch (error) {
    console.error('[GET /api/user/settings/privacy] Error:', error);
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
 * PUT /api/user/settings/privacy
 *
 * Update privacy settings for the authenticated user.
 *
 * @param request - Request with privacy settings updates
 * @returns Updated privacy settings
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

    const parseResult = privacySettingsSchema.safeParse(body);
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

    // Update preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPrefs = { ...currentPrefs };

    // Update each privacy setting
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updatedPrefs[key] = value;
      }
    });

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
      message: 'Privacy settings updated successfully',
      data: updates,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings/privacy] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
