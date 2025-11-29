/**
 * User Registration API Route
 *
 * Handles new user sign-ups with email/password authentication.
 * This endpoint creates a new user account and stores the hashed password.
 *
 * Routes:
 * - POST /api/auth/register - Create a new user account
 *
 * @module app/api/auth/register/route
 */

import crypto from 'crypto';

import { avatarService } from '@neolith/core/services';
import { prisma } from '@neolith/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email';
import {
  AUTH_ERROR_CODES,
  createAuthErrorResponse,
  registerSchema,
} from '@/lib/validations/auth';

import type { RegisterInput } from '@/lib/validations/auth';
import type { NextRequest } from 'next/server';

// Simple password hashing using Node.js crypto (no external dependency)
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

// Password hashing uses Node.js crypto with PBKDF2 (100,000 iterations, SHA-512)

// Configuration
const TOKEN_EXPIRATION_HOURS = 24;
const EMAIL_VERIFICATION_REQUIRED = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';

/**
 * Generate a verification token
 */
function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * POST /api/auth/register
 *
 * Register a new user account with email and password.
 *
 * @param request - Next.js request with user registration data
 * @returns Created user object (without password) or error
 *
 * @example
 * ```
 * POST /api/auth/register
 * Content-Type: application/json
 *
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123",
 *   "name": "John Doe"
 * }
 * ```
 *
 * @example Response (201 Created - No Verification Required)
 * ```json
 * {
 *   "data": {
 *     "id": "clx123456",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "avatarUrl": "https://...",
 *     "status": "ACTIVE"
 *   },
 *   "message": "User registered successfully",
 *   "requiresVerification": false
 * }
 * ```
 *
 * @example Response (201 Created - Verification Required)
 * ```json
 * {
 *   "data": {
 *     "id": "clx123456",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "avatarUrl": "https://...",
 *     "status": "ACTIVE"
 *   },
 *   "message": "User registered successfully. Please check your email to verify your account.",
 *   "requiresVerification": true
 * }
 * ```
 *
 * @example Error Response (409 Conflict)
 * ```json
 * {
 *   "error": "A user with this email already exists",
 *   "code": "EMAIL_EXISTS"
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
    const parseResult = registerSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createAuthErrorResponse('Validation failed', AUTH_ERROR_CODES.VALIDATION_ERROR, {
          errors: parseResult.error.flatten().fieldErrors,
        }),
        { status: 400 },
      );
    }

    const input: RegisterInput = parseResult.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      return NextResponse.json(
        createAuthErrorResponse(
          'A user with this email already exists',
          AUTH_ERROR_CODES.EMAIL_EXISTS,
        ),
        { status: 409 },
      );
    }

    // Hash password using PBKDF2
    const hashedPassword = await hashPassword(input.password);

    // Create user and credentials account in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: input.email,
          name: input.name,
          displayName: input.name,
          status: 'ACTIVE',
          emailVerified: null, // User needs to verify email
        },
      });

      // Create credentials account for password authentication
      await tx.account.create({
        data: {
          userId: user.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: user.id,
          // Store hashed password in the refresh_token field
          // This is a common pattern for credentials-based auth
          refreshToken: hashedPassword,
        },
      });

      return user;
    });

    // Handle email verification if required
    let verificationToken: string | null = null;
    if (EMAIL_VERIFICATION_REQUIRED) {
      try {
        // Generate verification token
        verificationToken = generateVerificationToken();
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

        // Store verification token in database
        await prisma.verificationToken.create({
          data: {
            identifier: newUser.email,
            token: verificationToken,
            expires: expiresAt,
          },
        });

        // Construct verification URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

        // Send verification email (non-blocking)
        sendVerificationEmail(
          newUser.email,
          newUser.name || newUser.email,
          verificationUrl,
        ).catch((emailError) => {
          // Log email errors but don't fail the registration
          if (process.env.NODE_ENV === 'development') {
            console.error('[POST /api/auth/register] Verification email failed:', emailError);
          } else {
            console.error('[POST /api/auth/register] Verification email failed');
          }
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`[POST /api/auth/register] Verification token created for: ${newUser.email}`);
        }
      } catch (tokenError) {
        // Log error but don't fail registration
        if (process.env.NODE_ENV === 'development') {
          console.error('[POST /api/auth/register] Verification token creation failed:', tokenError);
        } else {
          console.error('[POST /api/auth/register] Verification token creation failed');
        }
      }
    }

    // Send welcome email asynchronously (fire-and-forget)
    // Don't block the registration response on email sending
    sendWelcomeEmail(
      newUser.email,
      newUser.name || newUser.email,
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
        : undefined,
    ).catch((emailError) => {
      // Log email errors but don't fail the registration
      if (process.env.NODE_ENV === 'development') {
        console.error('[POST /api/auth/register] Welcome email failed:', emailError);
      } else {
        console.error('[POST /api/auth/register] Welcome email failed');
      }
    });

    // Generate fallback avatar with user's name or email
    try {
      await avatarService.generateFallbackAvatar({
        name: newUser.name || newUser.email || 'User',
        userId: newUser.id,
      });

      // Fetch updated user with avatar
      const userWithAvatar = await prisma.user.findUnique({
        where: { id: newUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
        },
      });

      const message = EMAIL_VERIFICATION_REQUIRED
        ? 'User registered successfully. Please check your email to verify your account.'
        : 'User registered successfully';

      return NextResponse.json(
        {
          data: userWithAvatar,
          message,
          requiresVerification: EMAIL_VERIFICATION_REQUIRED,
        },
        { status: 201 },
      );
    } catch (avatarError) {
      // Only log error message in production, not full error object
      if (process.env.NODE_ENV === 'development') {
        console.error('[POST /api/auth/register] Avatar generation failed:', avatarError);
      } else {
        console.error('[POST /api/auth/register] Avatar generation failed');
      }

      // Return user without avatar if generation fails
      // This is not a critical failure
      const userWithoutAvatar = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        displayName: newUser.displayName,
        avatarUrl: newUser.avatarUrl,
        status: newUser.status,
        createdAt: newUser.createdAt,
      };

      const message = EMAIL_VERIFICATION_REQUIRED
        ? 'User registered successfully. Please check your email to verify your account.'
        : 'User registered successfully';

      return NextResponse.json(
        {
          data: userWithoutAvatar,
          message,
          requiresVerification: EMAIL_VERIFICATION_REQUIRED,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    // Only log detailed error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[POST /api/auth/register] Error:', error);
    } else {
      console.error('[POST /api/auth/register] Registration error occurred');
    }

    // Handle Prisma unique constraint errors
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        createAuthErrorResponse(
          'A user with this email already exists',
          AUTH_ERROR_CODES.EMAIL_EXISTS,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createAuthErrorResponse('An internal error occurred', AUTH_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
