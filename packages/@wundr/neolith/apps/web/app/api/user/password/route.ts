/**
 * Password Change API Route
 *
 * Handles password update operations with current password verification.
 *
 * Routes:
 * - PATCH /api/user/password - Change user password
 *
 * @module app/api/user/password/route
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
 * PATCH /api/user/password
 *
 * Change the current user's password.
 *
 * @param request - Request with current and new password
 * @returns Success message or error
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
    const parseResult = passwordChangeSchema.safeParse(body);

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

    const { currentPassword, newPassword } = parseResult.data;

    // Get user with credentials account
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: {
          where: { provider: 'credentials', type: 'credentials' },
        },
      },
    });

    if (!user || !user.accounts[0]?.refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found or password not set',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 },
      );
    }

    const passwordHash = user.accounts[0].refreshToken;

    // Verify current password
    const isValid = await verifyPassword(currentPassword, passwordHash);
    if (!isValid) {
      await logSecurityEvent({
        userId: session.user.id,
        eventType: 'password_change_failed',
        severity: 'warning',
        description: 'Failed password change attempt - incorrect current password',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Current password is incorrect',
          code: SECURITY_ERROR_CODES.INVALID_PASSWORD,
        },
        { status: 400 },
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in account
    await prisma.account.update({
      where: { id: user.accounts[0].id },
      data: {
        refreshToken: hashedPassword,
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

    // Send email notification (optional)
    // await sendPasswordChangeEmail(user.email);

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/user/password] Error:', error);
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
