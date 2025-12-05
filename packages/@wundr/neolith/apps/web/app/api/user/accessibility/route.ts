/**
 * API Route: User Accessibility Settings
 * @module app/api/user/accessibility
 *
 * Handles GET, PATCH, and PUT requests for user accessibility preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@neolith/database';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/accessibility
 * Retrieve user accessibility settings
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user preferences from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Extract accessibility settings from preferences
    const preferences = (user.preferences as any) || {};
    const settings = preferences.accessibility || {
      reduceMotion: false,
      disableAllAnimations: false,
      autoPlayGifs: true,
      screenReaderOptimized: false,
      announceNewMessages: true,
      announceReactions: false,
      keyboardShortcuts: true,
      focusIndicatorsVisible: true,
      focusStyle: 'default',
      customShortcuts: {},
      highContrastMode: false,
      linkUnderlines: false,
      largerClickTargets: false,
      colorBlindnessMode: 'none',
      fontScale: 100,
      lineHeight: 150,
      letterSpacing: 0,
      autoPlayAudio: false,
      closedCaptions: true,
      transcriptAutoLoad: false,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching accessibility settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/accessibility
 * Update specific accessibility settings (partial update)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate the request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Fetch current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Merge with existing accessibility settings
    const currentPreferences = (user.preferences as any) || {};
    const currentAccessibility = currentPreferences.accessibility || {};
    const updatedAccessibility = {
      ...currentAccessibility,
      ...body,
    };

    // Update preferences in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPreferences,
          accessibility: updatedAccessibility,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(updatedAccessibility);
  } catch (error) {
    console.error('Error updating accessibility settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/accessibility
 * Replace all accessibility settings (full update)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate the request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Fetch current preferences first
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const currentPreferences = (user.preferences as any) || {};

    // Update preferences in database (replace accessibility settings)
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPreferences,
          accessibility: body,
        } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(body);
  } catch (error) {
    console.error('Error replacing accessibility settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
