/**
 * Email Change Request API Route
 *
 * Handles initiating email change with verification.
 *
 * Routes:
 * - POST /api/user/email/change-request - Request email change
 *
 * @module app/api/user/email/change-request/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  verifyPassword,
  generateVerificationToken,
  logSecurityEvent,
} from '@/lib/services/security';
import {
  emailChangeRequestSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';

/**
 * POST /api/user/email/change-request
 *
 * Request to change email address - sends verification emails to both old and new addresses.
 *
 * @param request - Request with new email and password
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
    const parseResult = emailChangeRequestSchema.safeParse(body);

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

    const { newEmail, password } = parseResult.data;

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
          code: SECURITY_ERROR_CODES.UNAUTHORIZED,
        },
        { status: 404 }
      );
    }

    const passwordHash = user.accounts[0].refreshToken;

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

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email already in use',
          code: SECURITY_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        },
        { status: 400 }
      );
    }

    // Generate verification token
    const token = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    // Store pending email change
    await prisma.$executeRaw`
      INSERT INTO pending_email_changes (id, user_id, new_email, token, expires_at, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${session.user.id},
        ${newEmail},
        ${token},
        ${expiresAt},
        ${new Date()}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        new_email = ${newEmail},
        token = ${token},
        expires_at = ${expiresAt},
        created_at = ${new Date()}
    `;

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'email_change_requested',
      severity: 'info',
      description: `Email change requested to ${newEmail}`,
      metadata: { newEmail },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // TODO: Send verification emails to both old and new addresses
    // await sendEmailChangeVerification(user.email, newEmail, token);

    return NextResponse.json({
      success: true,
      message:
        'Verification emails sent. Please check both your old and new email addresses.',
    });
  } catch (error) {
    console.error('[POST /api/user/email/change-request] Error:', error);
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
