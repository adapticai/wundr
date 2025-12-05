/**
 * User Security Settings API Route
 *
 * Handles updating general security settings.
 *
 * Routes:
 * - GET /api/user/security - Get security settings
 * - PATCH /api/user/security - Update security settings
 *
 * @module app/api/user/security/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import {
  securitySettingsSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * GET /api/user/security
 *
 * Get current security settings.
 *
 * @param request - Next.js request
 * @returns Security settings
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
        { status: 401 },
      );
    }

    // Get user settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 },
      );
    }

    const prefs = (user.preferences as Record<string, unknown>) || {};
    const twoFactor = prefs.twoFactor as { enabled?: boolean } | undefined;
    const securitySettings = prefs.security as Record<string, unknown> | undefined;

    return NextResponse.json({
      success: true,
      data: {
        twoFactorEnabled: twoFactor?.enabled ?? false,
        sessionTimeout: securitySettings?.sessionTimeout || '30',
        showOnlineStatus: securitySettings?.showOnlineStatus ?? true,
        showTypingIndicators: securitySettings?.showTypingIndicators ?? true,
        showReadReceipts: securitySettings?.showReadReceipts ?? true,
        loginAlerts: securitySettings?.loginAlerts ?? true,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/security] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/user/security
 *
 * Update security settings.
 *
 * @param request - Request with security settings
 * @returns Success message
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
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
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = securitySettingsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Get current settings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const prefs = (user?.preferences as Record<string, unknown>) || {};
    const currentSecuritySettings = (prefs.security as Record<string, unknown>) || {};
    const updatedSecuritySettings = {
      ...currentSecuritySettings,
      ...parseResult.data,
    };

    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...prefs,
          security: updatedSecuritySettings,
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Log significant setting changes
    if (parseResult.data.sessionTimeout !== undefined) {
      await logSecurityEvent({
        userId: session.user.id,
        eventType: 'security_settings_updated',
        severity: 'info',
        description: 'Security settings updated',
        metadata: parseResult.data,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Security settings updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/user/security] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An internal error occurred',
        code: SECURITY_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 },
    );
  }
}
