/**
 * Email Verification API Route
 *
 * Handles email verification for new user accounts.
 * This endpoint verifies email tokens and allows users to resend verification emails.
 *
 * Routes:
 * - GET /api/auth/verify-email?token=xxx - Verify email token
 * - POST /api/auth/verify-email - Resend verification email
 *
 * @module app/api/auth/verify-email/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { AUTH_ERROR_CODES, createAuthErrorResponse } from '@/lib/validations/auth';

import type { NextRequest } from 'next/server';

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_EXPIRATION_HOURS = 24;

// In-memory rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

/**
 * Check rate limit for a given identifier
 */
function checkRateLimit(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired entries
  if (record && now >= record.resetAt) {
    rateLimitStore.delete(identifier);
  }

  const currentRecord = rateLimitStore.get(identifier);

  if (!currentRecord) {
    // First request
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    };
  }

  if (currentRecord.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentRecord.resetAt,
    };
  }

  // Increment count
  currentRecord.count++;
  rateLimitStore.set(identifier, currentRecord);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - currentRecord.count,
    resetAt: currentRecord.resetAt,
  };
}

/**
 * Generate a verification token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Verify a user's email address using the provided token.
 *
 * @param request - Next.js request with token query parameter
 * @returns Redirect to login page or error
 *
 * @example
 * ```
 * GET /api/auth/verify-email?token=abc123...
 * ```
 *
 * @example Response (302 Redirect - Success)
 * ```
 * Location: /login?verified=true
 * ```
 *
 * @example Response (302 Redirect - Error)
 * ```
 * Location: /login?error=invalid_token
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      // Redirect to login with error
      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?error=missing_token`,
      );
    }

    // Look up verification token in database
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        token,
      },
    });

    if (!verificationToken) {
      // Invalid token
      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?error=invalid_token`,
      );
    }

    // Check if token has expired (24 hours)
    const now = new Date();
    if (now > verificationToken.expires) {
      // Delete expired token
      await prisma.verificationToken.delete({
        where: {
          token,
        },
      });

      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?error=expired_token`,
      );
    }

    // Find user by email (identifier in verification token)
    const user = await prisma.user.findUnique({
      where: {
        email: verificationToken.identifier,
      },
    });

    if (!user) {
      // User not found (should not happen)
      await prisma.verificationToken.delete({
        where: {
          token,
        },
      });

      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?error=user_not_found`,
      );
    }

    // Check if email is already verified
    if (user.emailVerified) {
      // Already verified, delete token and redirect
      await prisma.verificationToken.delete({
        where: {
          token,
        },
      });

      const baseUrl = new URL(request.url).origin;
      return NextResponse.redirect(
        `${baseUrl}/login?verified=already`,
      );
    }

    // Update user's emailVerified field and delete token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          emailVerified: now,
        },
      }),
      prisma.verificationToken.delete({
        where: {
          token,
        },
      }),
    ]);

    // Log success (audit trail)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GET /api/auth/verify-email] Email verified for user: ${user.email}`);
    } else {
      console.log('[GET /api/auth/verify-email] Email verification successful');
    }

    // Redirect to login page with success message
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/login?verified=true`,
    );
  } catch (error) {
    // Log error
    if (process.env.NODE_ENV === 'development') {
      console.error('[GET /api/auth/verify-email] Error:', error);
    } else {
      console.error('[GET /api/auth/verify-email] Verification error occurred');
    }

    // Redirect to login with error
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(
      `${baseUrl}/login?error=verification_failed`,
    );
  }
}

/**
 * POST /api/auth/verify-email
 *
 * Resend verification email to the authenticated user.
 *
 * @param request - Next.js request (requires authentication)
 * @returns Success message or error
 *
 * Rate Limit: Maximum 3 requests per hour
 *
 * @example
 * ```
 * POST /api/auth/verify-email
 * ```
 *
 * @example Response (200 OK)
 * ```json
 * {
 *   "message": "Verification email sent successfully. Please check your inbox.",
 *   "expiresAt": "2024-01-15T12:00:00.000Z"
 * }
 * ```
 *
 * @example Error Response (401 Unauthorized)
 * ```json
 * {
 *   "error": "You must be logged in to resend verification email",
 *   "code": "UNAUTHORIZED"
 * }
 * ```
 *
 * @example Error Response (429 Too Many Requests)
 * ```json
 * {
 *   "error": "Rate limit exceeded. You can request a new verification email 3 times per hour.",
 *   "code": "RATE_LIMIT_EXCEEDED",
 *   "details": {
 *     "resetAt": "2024-01-15T13:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAuthErrorResponse(
          'You must be logged in to resend verification email',
          AUTH_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return NextResponse.json(
        createAuthErrorResponse(
          'User not found',
          AUTH_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 404 },
      );
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return NextResponse.json(
        {
          message: 'Your email is already verified.',
        },
        { status: 200 },
      );
    }

    // Check rate limit (per user)
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt);
      return NextResponse.json(
        createAuthErrorResponse(
          'Rate limit exceeded. You can request a new verification email 3 times per hour.',
          AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          {
            resetAt: resetDate.toISOString(),
          },
        ),
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
          },
        },
      );
    }

    // Generate new verification token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

    // Delete any existing verification tokens for this user
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: user.email,
      },
    });

    // Create new verification token
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires: expiresAt,
      },
    });

    // Construct verification URL
    const baseUrl = new URL(request.url).origin;
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

    // Send verification email
    const emailResult = await sendVerificationEmail(user.email, verificationUrl);

    if (!emailResult.success) {
      // Log email send failure
      if (process.env.NODE_ENV === 'development') {
        console.error('[POST /api/auth/verify-email] Failed to send email:', emailResult.error);
      } else {
        console.error('[POST /api/auth/verify-email] Email delivery failed');
      }

      return NextResponse.json(
        createAuthErrorResponse(
          'Failed to send verification email. Please try again later.',
          AUTH_ERROR_CODES.INTERNAL_ERROR,
        ),
        { status: 500 },
      );
    }

    // Log success
    if (process.env.NODE_ENV === 'development') {
      console.log(`[POST /api/auth/verify-email] Verification email sent to: ${user.email}`);
    } else {
      console.log('[POST /api/auth/verify-email] Verification email sent');
    }

    return NextResponse.json(
      {
        message: 'Verification email sent successfully. Please check your inbox.',
        expiresAt: expiresAt.toISOString(),
      },
      {
        status: 200,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        },
      },
    );
  } catch (error) {
    // Log error
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/auth/verify-email] Error:', error);
    } else {
      console.error('[POST /api/auth/verify-email] Error occurred');
    }

    return NextResponse.json(
      createAuthErrorResponse(
        'An internal error occurred',
        AUTH_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
