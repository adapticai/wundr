/**
 * Current User Profile API Routes
 *
 * Handles getting and updating the profile for the currently authenticated user.
 *
 * Routes:
 * - GET /api/users/me - Get current user's profile
 * - PATCH /api/users/me - Update current user's profile
 *
 * @module app/api/users/me/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  updateUserProfileSchema,
  createUserErrorResponse,
  USER_ERROR_CODES,
} from '@/lib/validations/user';

import type { UpdateUserProfileInput } from '@/lib/validations/user';
import type { NextRequest } from 'next/server';

/**
 * GET /api/users/me
 *
 * Get the profile of the currently authenticated user.
 * Returns user information including preferences and metadata.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @returns Current user's profile
 *
 * @example
 * ```
 * GET /api/users/me
 *
 * Response:
 * {
 *   "data": {
 *     "id": "cuid123",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "displayName": "Johnny",
 *     "avatarUrl": "https://...",
 *     "bio": "Software engineer",
 *     "status": "ACTIVE",
 *     "isVP": false,
 *     "preferences": {},
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z",
 *     "lastActiveAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createUserErrorResponse(
          'Authentication required',
          USER_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get user profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        isVP: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createUserErrorResponse('User not found', USER_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('[GET /api/users/me] Error:', error);
    return NextResponse.json(
      createUserErrorResponse(
        'An internal error occurred',
        USER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/users/me
 *
 * Update the profile of the currently authenticated user.
 * Only provided fields will be updated; others remain unchanged.
 * Requires authentication.
 *
 * @param request - Next.js request with profile updates
 * @returns Updated user profile
 *
 * @example
 * ```
 * PATCH /api/users/me
 * Content-Type: application/json
 *
 * {
 *   "name": "John Doe",
 *   "displayName": "Johnny",
 *   "bio": "Software engineer and open source contributor"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "id": "cuid123",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "displayName": "Johnny",
 *     "bio": "Software engineer and open source contributor",
 *     "avatarUrl": "https://...",
 *     "status": "ACTIVE",
 *     "isVP": false,
 *     "preferences": {},
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "updatedAt": "2024-01-01T00:00:00.000Z",
 *     "lastActiveAt": "2024-01-01T00:00:00.000Z"
 *   },
 *   "message": "Profile updated successfully"
 * }
 * ```
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createUserErrorResponse(
          'Authentication required',
          USER_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createUserErrorResponse(
          'Invalid JSON body',
          USER_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = updateUserProfileSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createUserErrorResponse(
          'Validation failed',
          USER_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: UpdateUserProfileInput = parseResult.data;

    // Build update data object (only include fields that are provided)
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.displayName !== undefined) {
      updateData.displayName = input.displayName;
    }
    if (input.bio !== undefined) {
      updateData.bio = input.bio;
    }
    if (input.avatarUrl !== undefined) {
      updateData.avatarUrl = input.avatarUrl;
    }
    if (input.preferences !== undefined) {
      updateData.preferences = input.preferences;
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        isVP: true,
        preferences: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
      },
    });

    return NextResponse.json({
      data: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/users/me] Error:', error);
    return NextResponse.json(
      createUserErrorResponse(
        'An internal error occurred',
        USER_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
