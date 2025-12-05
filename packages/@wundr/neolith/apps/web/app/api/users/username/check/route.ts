/**
 * Username Availability Check API
 *
 * Checks if a username is available for use.
 *
 * Routes:
 * - POST /api/users/username/check - Check username availability
 *
 * @module app/api/users/username/check/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { usernameCheckSchema } from '@/lib/validations/profile';

import type { NextRequest } from 'next/server';

/**
 * POST /api/users/username/check
 *
 * Check if a username is available
 *
 * Request body:
 * {
 *   "username": "johndoe"
 * }
 *
 * Response:
 * {
 *   "available": true,
 *   "username": "johndoe"
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = usernameCheckSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { username } = parseResult.data;

    // Check if username exists and is not the current user's username
    const existingUser = await prisma.user.findFirst({
      where: {
        displayName: username,
        NOT: {
          id: session.user.id,
        },
      },
      select: {
        id: true,
      },
    });

    const available = !existingUser;

    return NextResponse.json({
      available,
      username,
      message: available
        ? 'Username is available'
        : 'Username is already taken',
    });
  } catch (error) {
    console.error('[POST /api/users/username/check] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}
