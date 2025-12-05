/**
 * Email Verification API Route
 *
 * Handles email change verification.
 *
 * Routes:
 * - POST /api/user/email/verify - Verify email change
 *
 * @module app/api/user/email/verify/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import {
  emailVerifySchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/email/verify
 *
 * Verify and complete email change.
 *
 * @param request - Request with verification token
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
    const parseResult = emailVerifySchema.safeParse(body);

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

    const { token } = parseResult.data;

    // Find pending email change
    const pendingChanges = await prisma.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        new_email: string;
        expires_at: Date;
      }>
    >`
      SELECT id, user_id, new_email, expires_at
      FROM pending_email_changes
      WHERE user_id = ${session.user.id}
      AND token = ${token}
      LIMIT 1
    `;

    if (pendingChanges.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired verification token',
          code: SECURITY_ERROR_CODES.INVALID_TOKEN,
        },
        { status: 400 }
      );
    }

    const pending = pendingChanges[0];

    // Check expiration
    if (new Date() > pending.expires_at) {
      await prisma.$executeRaw`
        DELETE FROM pending_email_changes
        WHERE id = ${pending.id}
      `;

      return NextResponse.json(
        {
          success: false,
          error: 'Verification token has expired',
          code: SECURITY_ERROR_CODES.INVALID_TOKEN,
        },
        { status: 400 }
      );
    }

    // Update user email
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email: pending.new_email,
        emailVerified: new Date(),
        updatedAt: new Date(),
      },
    });

    // Delete pending change
    await prisma.$executeRaw`
      DELETE FROM pending_email_changes
      WHERE id = ${pending.id}
    `;

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'email_change',
      severity: 'info',
      description: `Email changed to ${pending.new_email}`,
      metadata: { newEmail: pending.new_email },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Email updated successfully',
      data: {
        newEmail: pending.new_email,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/email/verify] Error:', error);
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
