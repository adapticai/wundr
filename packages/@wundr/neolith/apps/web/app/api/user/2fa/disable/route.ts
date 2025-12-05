/**
 * Two-Factor Authentication Disable API Route
 *
 * Handles disabling 2FA with password and code verification.
 *
 * Routes:
 * - POST /api/user/2fa/disable - Disable 2FA
 *
 * @module app/api/user/2fa/disable/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  verifyPassword,
  verifyTOTPCode,
  logSecurityEvent,
} from '@/lib/services/security';
import {
  twoFactorDisableSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * POST /api/user/2fa/disable
 *
 * Disable two-factor authentication.
 *
 * @param request - Request with password and verification code
 * @returns Success message
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const body = await request.json();
    const parseResult = twoFactorDisableSchema.safeParse(body);

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

    const { password, code } = parseResult.data;

    // Get user with account info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        preferences: true,
        accounts: {
          where: { provider: 'credentials', type: 'credentials' },
          select: { refreshToken: true },
        },
      },
    });

    const prefs = (user?.preferences as Record<string, unknown>) || {};
    const twoFactor = prefs.twoFactor as
      | { enabled?: boolean; secret?: string; backupCodes?: string[] }
      | undefined;
    const passwordHash = user?.accounts[0]?.refreshToken;

    if (!user || !passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 }
      );
    }

    if (!twoFactor?.enabled || !twoFactor?.secret) {
      return NextResponse.json(
        {
          success: false,
          error: '2FA is not enabled',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid password',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 }
      );
    }

    // Verify 2FA code
    const isCodeValid = verifyTOTPCode(twoFactor.secret, code);
    if (!isCodeValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid verification code',
          code: SECURITY_ERROR_CODES.INVALID_CODE,
        },
        { status: 400 }
      );
    }

    // Disable 2FA by removing from preferences
    const updatedPrefs = {
      ...prefs,
      twoFactor: {
        enabled: false,
        secret: null,
        backupCodes: null,
      },
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: '2fa_disabled',
      severity: 'warning',
      description: 'Two-factor authentication disabled',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication disabled',
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/disable] Error:', error);
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
