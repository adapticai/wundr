/**
 * Security Settings API Route
 *
 * Handles security-related settings including 2FA preferences, session timeout,
 * login alerts, and other security configurations.
 *
 * Routes:
 * - GET /api/user/settings/security - Get security settings
 * - PUT /api/user/settings/security - Update security settings
 *
 * @module app/api/user/settings/security/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  securitySettingsSchema,
  SECURITY_ERROR_CODES,
  type SecuritySettingsInput,
} from '@/lib/validations/security';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/user/settings/security
 *
 * Retrieve security settings for the authenticated user.
 *
 * @param request - Next.js request object
 * @returns Security settings and status
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }

    // Get user with security preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: {
          select: {
            provider: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 }
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};

    // Count active sessions
    const activeSessions = await prisma.session.count({
      where: {
        userId: session.user.id,
        expires: { gt: new Date() },
      },
    });

    type AccountInfo = { provider: string; type: string };
    const accounts: AccountInfo[] = user.accounts;

    // Get connected OAuth providers
    const connectedProviders = accounts
      .filter((acc: AccountInfo) => acc.type === 'oauth')
      .map((acc: AccountInfo) => acc.provider);

    // Check if user has password set
    const hasPassword = accounts.some(
      (acc: AccountInfo) =>
        acc.provider === 'credentials' && acc.type === 'credentials'
    );

    const securitySettings = {
      twoFactorEnabled: (prefs.twoFactorEnabled as boolean) || false,
      sessionTimeout: (prefs.sessionTimeout as string) || '30',
      showOnlineStatus: (prefs.showOnlineStatus as boolean) ?? true,
      showTypingIndicators: (prefs.showTypingIndicators as boolean) ?? true,
      showReadReceipts: (prefs.showReadReceipts as boolean) ?? true,
      loginAlerts: (prefs.loginAlerts as boolean) ?? true,
      activeSessions,
      hasPassword,
      connectedProviders,
      lastPasswordChange: prefs.lastPasswordChange as string | undefined,
    };

    return NextResponse.json({
      success: true,
      data: securitySettings,
    });
  } catch (error) {
    console.error('[GET /api/user/settings/security] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/settings/security
 *
 * Update security settings for the authenticated user.
 *
 * @param request - Request with security settings updates
 * @returns Updated security settings
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON body',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    const parseResult = securitySettingsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updates: SecuritySettingsInput = parseResult.data;

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 }
      );
    }

    // Update preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    const updatedPrefs = { ...currentPrefs };

    if (updates.sessionTimeout !== undefined) {
      updatedPrefs.sessionTimeout = updates.sessionTimeout;
    }
    if (updates.showOnlineStatus !== undefined) {
      updatedPrefs.showOnlineStatus = updates.showOnlineStatus;
    }
    if (updates.showTypingIndicators !== undefined) {
      updatedPrefs.showTypingIndicators = updates.showTypingIndicators;
    }
    if (updates.showReadReceipts !== undefined) {
      updatedPrefs.showReadReceipts = updates.showReadReceipts;
    }
    if (updates.loginAlerts !== undefined) {
      updatedPrefs.loginAlerts = updates.loginAlerts;
    }

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Security settings updated successfully',
      data: updates,
    });
  } catch (error) {
    console.error('[PUT /api/user/settings/security] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }
}
