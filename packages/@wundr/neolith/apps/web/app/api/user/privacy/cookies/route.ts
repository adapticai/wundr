/**
 * Cookie Preferences API Routes
 *
 * Handles cookie consent and preferences management.
 *
 * Routes:
 * - PATCH /api/user/privacy/cookies - Update cookie preferences
 *
 * @module app/api/user/privacy/cookies/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * PATCH /api/user/privacy/cookies
 *
 * Update cookie preferences for the authenticated user.
 *
 * @param request - Next.js request object with cookie preferences
 * @returns Updated cookie preferences
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
        { status: 401 },
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
        { status: 404 },
      );
    }

    // Map cookie preferences to preference keys
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const cookiePrefMapping: Record<string, string> = {
      functional: 'cookieFunctional',
      analytics: 'cookieAnalytics',
      advertising: 'cookieAdvertising',
    };

    const updatedPrefs = { ...currentPrefs };

    // Update only the provided cookie preference
    for (const [key, value] of Object.entries(body)) {
      const prefKey = cookiePrefMapping[key];
      if (prefKey) {
        updatedPrefs[prefKey] = value;
      }
    }

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as never,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: body,
    });
  } catch (error) {
    console.error('[PATCH /api/user/privacy/cookies] Error:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 },
    );
  }
}
