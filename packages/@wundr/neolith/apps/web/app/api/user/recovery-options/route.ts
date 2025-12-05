/**
 * Account Recovery Options API Route
 *
 * Handles managing account recovery options.
 *
 * Routes:
 * - GET /api/user/recovery-options - Get recovery options
 * - PATCH /api/user/recovery-options - Update recovery options
 *
 * @module app/api/user/recovery-options/route
 */

import { Prisma, prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import {
  accountRecoverySchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

export interface RecoveryOptions {
  recoveryEmail?: string;
  hasSecurityQuestions: boolean;
  hasBackupCodes: boolean;
  phoneNumber?: string;
}

/**
 * GET /api/user/recovery-options
 *
 * Get current account recovery options.
 *
 * @param request - Next.js request
 * @returns Recovery options
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

    // Get user info
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

    // Parse preferences JSON
    const prefs = (user.preferences as Record<string, unknown>) || {};
    const recoveryEmail = prefs.recoveryEmail as string | undefined;
    const phoneNumber = prefs.phoneNumber as string | undefined;
    const twoFactor = prefs.twoFactor as
      | { backupCodes?: string[] }
      | undefined;
    const hasBackupCodes = !!twoFactor?.backupCodes?.length;

    // Check if security questions exist
    let hasSecurityQuestions = false;
    try {
      const questions = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count
        FROM security_questions
        WHERE user_id = ${session.user.id}
      `;
      hasSecurityQuestions = questions[0]?.count > 0;
    } catch {
      // Table might not exist
    }

    const options: RecoveryOptions = {
      recoveryEmail,
      phoneNumber,
      hasSecurityQuestions,
      hasBackupCodes,
    };

    return NextResponse.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('[GET /api/user/recovery-options] Error:', error);
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
 * PATCH /api/user/recovery-options
 *
 * Update account recovery options.
 *
 * @param request - Request with recovery options
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
    const parseResult = accountRecoverySchema.safeParse(body);

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

    const { recoveryEmail } = parseResult.data;

    // Update recovery email
    if (recoveryEmail !== undefined) {
      // Get current preferences
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      });

      const prefs =
        (currentUser?.preferences as Record<string, unknown>) || {};

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          preferences: {
            ...prefs,
            recoveryEmail,
          } as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });

      // Log security event
      await logSecurityEvent({
        userId: session.user.id,
        eventType: 'recovery_option_updated',
        severity: 'info',
        description: 'Recovery email updated',
        metadata: { recoveryEmail },
        ipAddress:
          request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Recovery options updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/user/recovery-options] Error:', error);
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
