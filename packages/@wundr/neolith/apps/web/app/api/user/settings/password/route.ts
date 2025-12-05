/**
 * Password Change Settings API Route
 *
 * Dedicated endpoint for password changes from the settings page.
 * Uses the same logic as /api/user/password but returns settings-compatible response.
 *
 * Routes:
 * - POST /api/user/settings/password - Change user password
 *
 * @module app/api/user/settings/password/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  hashPassword,
  verifyPassword,
  logSecurityEvent,
} from '@/lib/services/security';
import {
  passwordChangeSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/settings/password
 *
 * Change the current user's password from settings page.
 *
 * @param request - Request with current and new password
 * @returns Success message or error
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

    const parseResult = passwordChangeSchema.safeParse(body);
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

    const { currentPassword, newPassword } = parseResult.data;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        preferences: true,
        accounts: {
          where: {
            provider: 'credentials',
            type: 'credentials',
          },
          select: {
            id: true,
            refreshToken: true,
          },
        },
      },
    });

    if (!user || user.accounts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password authentication not available',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 }
      );
    }

    const credentialsAccount = user.accounts[0];
    const storedHash = credentialsAccount.refreshToken;

    if (!storedHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password not set',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, storedHash);
    if (!isValid) {
      await logSecurityEvent({
        userId: session.user.id,
        eventType: 'password_change_failed',
        severity: 'warning',
        description:
          'Failed password change attempt - incorrect current password',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Current password is incorrect',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in credentials account
    await prisma.account.update({
      where: { id: credentialsAccount.id },
      data: {
        refreshToken: hashedPassword,
      },
    });

    // Update last password change timestamp in preferences
    const currentPrefs = (user.preferences as Record<string, unknown>) || {};
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          lastPasswordChange: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'password_change',
      severity: 'info',
      description: 'Password successfully changed',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('[POST /api/user/settings/password] Error:', error);
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
