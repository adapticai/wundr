/**
 * Appearance Settings API Route
 *
 * Handles UI/UX preferences including theme, colors, fonts, density, and accessibility.
 *
 * Routes:
 * - GET /api/user/settings/appearance - Get appearance preferences
 * - PUT /api/user/settings/appearance - Update appearance preferences
 *
 * @module app/api/user/settings/appearance/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  appearanceSettingsSchema,
  createSettingsErrorResponse,
  SETTINGS_ERROR_CODES,
  type AppearanceSettings,
} from '@/lib/validations/settings';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/user/settings/appearance
 *
 * Retrieve appearance preferences for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Appearance preferences
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

    const appearanceSettings: AppearanceSettings = {
      theme: (prefs.theme as 'light' | 'dark' | 'system') || 'system',
      colorScheme:
        (prefs.colorScheme as 'blue' | 'purple' | 'green' | 'orange' | 'red') ||
        'blue',
      fontSize:
        (prefs.fontSize as 'small' | 'medium' | 'large' | 'extra-large') ||
        'medium',
      density:
        (prefs.density as 'compact' | 'comfortable' | 'spacious') ||
        'comfortable',
      reduceMotion: (prefs.reduceMotion as boolean) ?? false,
      highContrast: (prefs.highContrast as boolean) ?? false,
      sidebarPosition: (prefs.sidebarPosition as 'left' | 'right') || 'left',
      messageGrouping: (prefs.messageGrouping as boolean) ?? true,
      showAvatars: (prefs.showAvatars as boolean) ?? true,
      emojiStyle:
        (prefs.emojiStyle as 'native' | 'twitter' | 'google' | 'apple') ||
        'native',
    };

    return NextResponse.json({
      success: true,
      data: appearanceSettings,
    });
  } catch (error) {
    console.error('[GET /api/user/settings/appearance] Error:', error);
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
 * PUT /api/user/settings/appearance
 *
 * Update appearance preferences for the authenticated user.
 *
 * @param request - Request with appearance preference updates
 * @returns Updated appearance preferences
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

    const parseResult = appearanceSettingsSchema.safeParse(body);
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

    // Update each appearance setting
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
      message: 'Appearance preferences updated successfully',
      data: updates,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings/appearance] Error:', error);
    return NextResponse.json(
      createSettingsErrorResponse(
        'An internal error occurred',
        SETTINGS_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
