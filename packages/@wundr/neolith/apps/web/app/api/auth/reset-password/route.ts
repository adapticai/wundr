/**
 * Reset Password API Route
 *
 * Handles password reset requests using a valid reset token.
 * This endpoint validates the token, updates the user's password,
 * and invalidates the reset token.
 *
 * Routes:
 * - POST /api/auth/reset-password - Reset user password with token
 *
 * @module app/api/auth/reset-password/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import {
  AUTH_ERROR_CODES,
  createAuthErrorResponse,
  resetPasswordSchema,
} from '@/lib/validations/auth';

import type { ResetPasswordInput } from '@/lib/validations/auth';
import type { NextRequest } from 'next/server';

/**
 * Hash password using PBKDF2 (same as registration)
 */
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) {
        reject(err);
      }
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * POST /api/auth/reset-password
 *
 * Reset user password using a valid reset token.
 *
 * @param request - Next.js request with reset token and new password
 * @returns Success message or error
 *
 * @example
 * ```
 * POST /api/auth/reset-password
 * Content-Type: application/json
 *
 * {
 *   "token": "abc123...",
 *   "password": "NewSecurePass123",
 *   "confirmPassword": "NewSecurePass123"
 * }
 * ```
 *
 * @example Response (200 OK)
 * ```json
 * {
 *   "message": "Password reset successfully. You can now login with your new password."
 * }
 * ```
 *
 * @example Error Response (400 Bad Request)
 * ```json
 * {
 *   "error": "Invalid or expired reset token",
 *   "code": "INVALID_TOKEN"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createAuthErrorResponse('Invalid JSON body', AUTH_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = resetPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAuthErrorResponse('Validation failed', AUTH_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const input: ResetPasswordInput = parseResult.data;

    // Hash the provided token to match against stored token
    const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');

    // Find the account with the reset token
    const account = await prisma.account.findFirst({
      where: {
        provider: 'credentials',
        accessToken: hashedToken,
      },
      include: {
        user: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        createAuthErrorResponse('Invalid or expired reset token', AUTH_ERROR_CODES.INVALID_TOKEN),
        { status: 400 },
      );
    }

    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (!account.expiresAt || account.expiresAt < now) {
      return NextResponse.json(
        createAuthErrorResponse('Reset token has expired', AUTH_ERROR_CODES.EXPIRED_TOKEN),
        { status: 400 },
      );
    }

    // Hash the new password
    const hashedPassword = await hashPassword(input.password);

    // Update the password and clear the reset token
    await prisma.account.update({
      where: { id: account.id },
      data: {
        refreshToken: hashedPassword, // Store new password
        accessToken: null, // Clear reset token
        expiresAt: null, // Clear expiration
      },
    });

    // eslint-disable-next-line no-console
    console.log('[POST /api/auth/reset-password] Password reset successfully for user:', account.user.email);

    return NextResponse.json(
      {
        message: 'Password reset successfully. You can now login with your new password.',
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error);

    return NextResponse.json(
      createAuthErrorResponse('An internal error occurred', AUTH_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
