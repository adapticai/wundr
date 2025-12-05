/**
 * Phone Verification API Route
 *
 * Handles phone number change verification.
 *
 * Routes:
 * - POST /api/user/phone/verify - Verify phone change
 *
 * @module app/api/user/phone/verify/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/services/security';
import {
  phoneVerifySchema,
  SECURITY_ERROR_CODES,
} from '@/lib/validations/security';

import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

/**
 * POST /api/user/phone/verify
 *
 * Verify and complete phone number change.
 *
 * @param request - Request with verification code
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

    // Parse and validate request body
    const body = await request.json();
    const parseResult = phoneVerifySchema.safeParse(body);

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

    // Find pending phone change
    const pendingChanges = await prisma.$queryRaw<
      Array<{
        id: string;
        user_id: string;
        new_phone: string;
        code: string;
        expires_at: Date;
        attempts: number;
      }>
    >`
      SELECT id, user_id, new_phone, code, expires_at, attempts
      FROM pending_phone_changes
      WHERE user_id = ${session.user.id}
      LIMIT 1
    `;

    if (pendingChanges.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No pending phone change request',
          code: SECURITY_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 },
      );
    }

    const pending = pendingChanges[0];

    // Check expiration
    if (new Date() > pending.expires_at) {
      await prisma.$executeRaw`
        DELETE FROM pending_phone_changes
        WHERE id = ${pending.id}
      `;

      return NextResponse.json(
        {
          success: false,
          error: 'Verification code has expired',
          code: SECURITY_ERROR_CODES.INVALID_CODE,
        },
        { status: 400 },
      );
    }

    // Check attempts
    if (pending.attempts >= 3) {
      await prisma.$executeRaw`
        DELETE FROM pending_phone_changes
        WHERE id = ${pending.id}
      `;

      return NextResponse.json(
        {
          success: false,
          error: 'Too many failed attempts',
          code: SECURITY_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        },
        { status: 400 },
      );
    }

    // Verify code
    if (code !== pending.code) {
      // Increment attempts
      await prisma.$executeRaw`
        UPDATE pending_phone_changes
        SET attempts = attempts + 1
        WHERE id = ${pending.id}
      `;

      return NextResponse.json(
        {
          success: false,
          error: 'Invalid verification code',
          code: SECURITY_ERROR_CODES.INVALID_CODE,
        },
        { status: 400 },
      );
    }

    // Get current user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs =
      (user?.preferences as Record<string, unknown>) || {};

    // Update user phone number in preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          ...currentPrefs,
          phoneNumber: pending.new_phone,
          phoneNumberVerified: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    // Delete pending change
    await prisma.$executeRaw`
      DELETE FROM pending_phone_changes
      WHERE id = ${pending.id}
    `;

    // Log security event
    await logSecurityEvent({
      userId: session.user.id,
      eventType: 'phone_change',
      severity: 'info',
      description: `Phone number changed to ${pending.new_phone}`,
      metadata: { newPhone: pending.new_phone },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Phone number updated successfully',
      data: {
        newPhone: pending.new_phone,
      },
    });
  } catch (error) {
    console.error('[POST /api/user/phone/verify] Error:', error);
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
