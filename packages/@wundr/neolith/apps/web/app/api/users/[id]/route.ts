/**
 * User Profile API Routes (by ID)
 *
 * Handles getting user profiles by ID.
 * This endpoint is read-only; users can only update their own profile via /api/users/me.
 *
 * Routes:
 * - GET /api/users/[id] - Get user profile by ID
 *
 * @module app/api/users/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createUserErrorResponse,
  USER_ERROR_CODES,
} from '@/lib/validations/user';

import type { NextRequest } from 'next/server';

/**
 * GET /api/users/[id]
 *
 * Get a user's profile by their ID.
 * Returns public user information.
 * Requires authentication.
 *
 * @param _request - Next.js request object
 * @param params - Route parameters containing user ID
 * @returns User profile
 *
 * @example
 * ```
 * GET /api/users/cuid123
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
 *     "isOrchestrator": false,
 *     "createdAt": "2024-01-01T00:00:00.000Z",
 *     "lastActiveAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createUserErrorResponse(
          'Authentication required',
          USER_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { id } = await params;

    // Validate user ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        createUserErrorResponse(
          'Invalid user ID',
          USER_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get user profile (public fields only, excluding sensitive data like preferences)
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        status: true,
        isOrchestrator: true,
        createdAt: true,
        lastActiveAt: true,
        // Exclude: preferences, updatedAt, orchestratorConfig
      },
    });

    if (!user) {
      return NextResponse.json(
        createUserErrorResponse('User not found', USER_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // If user is viewing their own profile, include additional fields
    if (user.id === session.user.id) {
      const fullUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          status: true,
          isOrchestrator: true,
          preferences: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      return NextResponse.json({ data: fullUser });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('[GET /api/users/[id]] Error:', error);
    return NextResponse.json(
      createUserErrorResponse(
        'An internal error occurred',
        USER_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
