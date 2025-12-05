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

import { sendPasswordResetEmail } from '@/lib/email';
import { AUTH_ERROR_CODES, forgotPasswordSchema } from '@/lib/validations/auth';

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
        {
          error: AUTH_ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid JSON body',
        },
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = forgotPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: AUTH_ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          errors: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const input: ForgotPasswordInput = parseResult.data;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (user) {
      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

      // Store reset token in the Account table (using access_token field for reset tokens)
      // Check if there's already a credentials account for this user
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: user.id,
          provider: 'credentials',
        },
      });

      if (existingAccount) {
        // Update existing account with reset token
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            // Store hashed token in access_token field
            accessToken: hashedToken,
            // Store expiration in expires_at field (convert to Unix timestamp)
            expiresAt: Math.floor(expiresAt.getTime() / 1000),
          },
        });
      } else {
        // Create new account entry for credentials with reset token
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'credentials',
            provider: 'credentials',
            providerAccountId: user.id,
            accessToken: hashedToken,
            expiresAt: Math.floor(expiresAt.getTime() / 1000),
          },
        });
      }

      // Send password reset email
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      try {
        // Attempt to send the password reset email
        const emailResult = await sendPasswordResetEmail(user.email, resetUrl);

        if (!emailResult.success) {
          // Log the error for debugging, but don't expose to client
          console.error(
            '[POST /api/auth/forgot-password] Failed to send password reset email:',
            {
              email: user.email,
              error: emailResult.error,
              timestamp: new Date().toISOString(),
            }
          );
        }

        // SECURITY: Only log reset details in development
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log(
            '[DEVELOPMENT] Password reset requested for:',
            user.email
          );
          // eslint-disable-next-line no-console
          console.log('[DEVELOPMENT] Reset URL:', resetUrl);
          // eslint-disable-next-line no-console
          console.log(
            '[DEVELOPMENT] Token expires at:',
            expiresAt.toISOString()
          );
          // eslint-disable-next-line no-console
          console.log('[DEVELOPMENT] Email sent:', emailResult.success);
        }
      } catch (emailError) {
        // Catch any unexpected errors during email sending
        // Log for debugging but don't expose to client for security
        console.error(
          '[POST /api/auth/forgot-password] Unexpected error sending password reset email:',
          {
            email: user.email,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
            timestamp: new Date().toISOString(),
          }
        );
        // Continue execution - we still return success to prevent email enumeration
      }
    }

    // Always return success for security (don't reveal if email exists)
    // This prevents email enumeration attacks
    return NextResponse.json(
      {
        message:
          "If an account exists with that email, we've sent password reset instructions.",
      },
      { status: 200 }
    );
  } catch (error) {
    // Only log detailed error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/auth/forgot-password] Error:', error);
    } else {
      console.error(
        '[POST /api/auth/forgot-password] Password reset request error'
      );
    }

    return NextResponse.json(
      {
        error: AUTH_ERROR_CODES.INTERNAL_ERROR,
        message: 'An internal error occurred',
      },
      { status: 500 }
    );
  }
}
