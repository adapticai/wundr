/**
 * Forgot Password API Route
 *
 * Handles password reset requests by generating a reset token and
 * sending an email with reset instructions.
 *
 * Routes:
 * - POST /api/auth/forgot-password - Request password reset
 *
 * @module app/api/auth/forgot-password/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import {
  AUTH_ERROR_CODES,
  createAuthErrorResponse,
  forgotPasswordSchema,
} from '@/lib/validations/auth';

import type { ForgotPasswordInput } from '@/lib/validations/auth';
import type { NextRequest } from 'next/server';

// Token expiration time: 1 hour
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password
 *
 * Request a password reset link to be sent to the user's email.
 * For security reasons, always returns success even if the email doesn't exist.
 *
 * @param request - Next.js request with email address
 * @returns Success message (always, for security)
 *
 * @example
 * ```
 * POST /api/auth/forgot-password
 * Content-Type: application/json
 *
 * {
 *   "email": "user@example.com"
 * }
 * ```
 *
 * @example Response (200 OK)
 * ```json
 * {
 *   "message": "If an account exists with that email, we've sent password reset instructions."
 * }
 * ```
 *
 * @example Error Response (400 Bad Request)
 * ```json
 * {
 *   "error": "Invalid email format",
 *   "code": "VALIDATION_ERROR"
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
    const parseResult = forgotPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAuthErrorResponse('Validation failed', AUTH_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const input: ForgotPasswordInput = parseResult.data;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { email: input.email },
    });

    if (user) {
      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

      // Store reset token in the Account table (using access_token field for reset tokens)
      // Check if there's already a credentials account for this user
      const existingAccount = await prisma.accounts.findFirst({
        where: {
          userId: user.id,
          provider: 'credentials',
        },
      });

      if (existingAccount) {
        // Update existing account with reset token
        await prisma.accounts.update({
          where: { id: existingAccount.id },
          data: {
            // Store hashed token in access_token field
            access_token: hashedToken,
            // Store expiration in expires_at field (convert to Unix timestamp)
            expires_at: Math.floor(expiresAt.getTime() / 1000),
          },
        });
      } else {
        // Create new account entry for credentials with reset token
        await prisma.accounts.create({
          data: {
            userId: user.id,
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: user.id,
            access_token: hashedToken,
            expires_at: Math.floor(expiresAt.getTime() / 1000),
          },
        });
      }

      // TODO: Send email with reset link
      // For now, we'll just log the reset token (DEVELOPMENT ONLY!)
      // In production, this should use an email service like SendGrid, AWS SES, or Resend
      const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      // eslint-disable-next-line no-console
      console.log('[DEVELOPMENT] Password reset requested for:', user.email);
      // eslint-disable-next-line no-console
      console.log('[DEVELOPMENT] Reset URL:', resetUrl);
      // eslint-disable-next-line no-console
      console.log('[DEVELOPMENT] Token expires at:', expiresAt.toISOString());

      // In a real implementation, send email here:
      /*
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userName: user.name || user.email,
      });
      */
    }

    // Always return success for security (don't reveal if email exists)
    // This prevents email enumeration attacks
    return NextResponse.json(
      {
        message: "If an account exists with that email, we've sent password reset instructions.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error);

    return NextResponse.json(
      createAuthErrorResponse('An internal error occurred', AUTH_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
