/**
 * Two-Factor Authentication Backup Codes API Route
 *
 * Handles retrieving and regenerating backup codes.
 *
 * Routes:
 * - GET /api/user/2fa/backup-codes - Get current backup codes
 * - POST /api/user/2fa/backup-codes - Regenerate backup codes
 *
 * @module app/api/user/2fa/backup-codes/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generateBackupCodes,
  verifyPassword,
  logSecurityEvent,
} from '@/lib/services/security';
import { SECURITY_ERROR_CODES } from '@/lib/validations/security';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/user/2fa/backup-codes
 *
 * Retrieve current backup codes (requires recent authentication).
 *
 * @param request - Next.js request
 * @returns Backup codes array
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
        { status: 401 }
      );
    }

    // Get user with backup codes
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const prefs = (user?.preferences as Record<string, unknown>) || {};
    const twoFactor = prefs.twoFactor as
      | { enabled?: boolean; secret?: string; backupCodes?: string[] }
      | undefined;

    if (!twoFactor?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: '2FA is not enabled',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    const backupCodes = twoFactor.backupCodes || [];

    return NextResponse.json({
      success: true,
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    console.error('[GET /api/user/2fa/backup-codes] Error:', error);
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
 * POST /api/user/2fa/backup-codes
 *
 * Regenerate backup codes (requires password verification).
 *
 * @param request - Request with password
 * @returns New backup codes
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

    // Parse request body
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

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

    if (!twoFactor?.enabled || !passwordHash) {
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
    const isValid = await verifyPassword(password, passwordHash);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid password',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 }
      );
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();

    // Update user preferences
    const updatedPrefs = {
      ...prefs,
      twoFactor: {
        ...twoFactor,
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
      eventType: 'backup_codes_regenerated',
      severity: 'info',
      description: 'Backup codes regenerated',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Backup codes regenerated',
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/backup-codes] Error:', error);
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
