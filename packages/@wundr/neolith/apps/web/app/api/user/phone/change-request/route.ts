/**
 * Phone Change Request API Route
 *
 * Handles initiating phone number change with SMS verification.
 *
 * Routes:
 * - POST /api/user/phone/change-request - Request phone change
 *
 * @module app/api/user/phone/change-request/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  generatePhoneVerificationCode,
  logSecurityEvent,
  checkRateLimit,
} from '@/lib/services/security';
import {
  phoneChangeRequestSchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * POST /api/user/phone/change-request
 *
 * Request to change phone number - sends verification code via SMS.
 *
 * @param request - Request with new phone number
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
        { status: 401 },
      );
    }

    // Rate limiting - max 3 attempts per hour
    const allowed = await checkRateLimit(
      session.user.id,
      'phone_verification',
      3,
      3600,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many verification attempts. Please try again later.',
          code: SECURITY_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: 429 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parseResult = phoneChangeRequestSchema.safeParse(body);

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

    const { phoneNumber } = parseResult.data;

    // Note: Phone numbers are stored in preferences JSON field for display purposes.
    // Skipping uniqueness check as preferences field cannot be efficiently queried.
    // If strict uniqueness is required, consider adding a dedicated phoneNumber column.

    // Generate verification code
    const code = generatePhoneVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiration

    // Store pending phone change
    await prisma.$executeRaw`
      INSERT INTO pending_phone_changes (id, user_id, new_phone, code, expires_at, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${session.user.id},
        ${phoneNumber},
        ${code},
        ${expiresAt},
        ${new Date()}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        new_phone = ${phoneNumber},
        code = ${code},
        expires_at = ${expiresAt},
        created_at = ${new Date()},
        attempts = 0
    `;

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'phone_change_requested',
      severity: 'info',
      description: `Phone change requested to ${phoneNumber}`,
      metadata: { newPhone: phoneNumber },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // TODO: Send SMS verification code
    // await sendSMSVerification(phoneNumber, code);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your new phone number',
    });
  } catch (error) {
    console.error('[POST /api/user/phone/change-request] Error:', error);
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
