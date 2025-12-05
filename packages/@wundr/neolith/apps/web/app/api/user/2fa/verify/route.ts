/**
 * Two-Factor Authentication Verify API Route
 *
 * Handles 2FA code verification and enabling 2FA.
 *
 * Routes:
 * - POST /api/user/2fa/verify - Verify 2FA code and enable 2FA
 *
 * @module app/api/user/2fa/verify/route
 */

import { prisma, Prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  verifyTOTPCode,
  generateBackupCodes,
  logSecurityEvent,
} from '@/lib/services/security';
import {
  twoFactorVerifySchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/2fa/verify
 *
 * Verify the 2FA code and enable two-factor authentication.
 *
 * @param request - Request with verification code
 * @returns Success with backup codes
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
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = twoFactorVerifySchema.safeParse(body);

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

    const { code } = parseResult.data;

    // Get user with 2FA secret from preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, preferences: true },
    });

    const prefs = (user?.preferences as Record<string, unknown>) || {};
    const twoFactor = prefs.twoFactor as { enabled?: boolean; secret?: string; backupCodes?: string[] } | undefined;

    if (!user || !twoFactor?.secret) {
      return NextResponse.json(
        {
          success: false,
          error: '2FA setup not initiated',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 },
      );
    }

    // Verify the code
    const isValid = verifyTOTPCode(twoFactor.secret, code);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid verification code',
          code: SECURITY_ERROR_CODES.INVALID_CODE,
        },
        { status: 400 },
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable 2FA and store backup codes in preferences
    const updatedPrefs = {
      ...prefs,
      twoFactor: {
        ...twoFactor,
        enabled: true,
        backupCodes,
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
      eventType: '2fa_enabled',
      severity: 'info',
      description: 'Two-factor authentication enabled',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication enabled',
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/verify] Error:', error);
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
