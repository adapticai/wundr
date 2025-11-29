/**
 * User Status API Routes
 *
 * Enhanced status management with auto-away and DND support.
 * This endpoint extends the base presence API with additional features.
 *
 * Routes:
 * - PUT /api/users/status - Update user status
 *
 * @module app/api/users/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  setStatusSchema,
  createPresenceErrorResponse,
  PRESENCE_ERROR_CODES,
} from '@/lib/validations/presence';

import type { NextRequest } from 'next/server';

/**
 * PUT /api/users/status
 *
 * Update the current user's status.
 * This is an alias for PUT /api/presence for better REST semantics.
 *
 * @param request - Request with status data
 * @returns Updated status response
 *
 * @example
 * ```
 * PUT /api/users/status
 * Content-Type: application/json
 *
 * {
 *   "status": "BUSY",
 *   "customStatus": "In a meeting"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "userId": "user_123",
 *     "status": "BUSY",
 *     "customStatus": "In a meeting",
 *     "lastSeen": "2024-01-15T10:30:00Z",
 *     "isOnline": true
 *   },
 *   "message": "Status updated successfully"
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createPresenceErrorResponse('Authentication required', PRESENCE_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createPresenceErrorResponse('Invalid JSON body', PRESENCE_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = setStatusSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createPresenceErrorResponse(
          'Validation failed',
          PRESENCE_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { status, customStatus } = parseResult.data;

    // Get current preferences
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPrefs =
      typeof currentUser?.preferences === 'object' &&
      currentUser.preferences !== null &&
      !Array.isArray(currentUser.preferences)
        ? (currentUser.preferences as Record<string, unknown>)
        : {};

    // Update user status and preferences
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        status: status === 'OFFLINE' ? 'INACTIVE' : 'ACTIVE',
        lastActiveAt: new Date(),
        preferences: {
          ...currentPrefs,
          presenceStatus: status,
          customStatus: customStatus ?? null,
        },
      },
      select: {
        id: true,
        status: true,
        lastActiveAt: true,
        preferences: true,
      },
    });

    // Build response
    const prefs =
      typeof user.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    const isOnline = user.lastActiveAt
      ? Date.now() - user.lastActiveAt.getTime() < 5 * 60 * 1000
      : false;

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        status: prefs.presenceStatus ?? (user.status === 'ACTIVE' ? 'ONLINE' : 'OFFLINE'),
        customStatus: (prefs.customStatus as string | null | undefined) ?? null,
        lastSeen: user.lastActiveAt?.toISOString() ?? new Date(0).toISOString(),
        isOnline,
      },
      message: 'Status updated successfully',
    });
  } catch (error) {
    console.error('[PUT /api/users/status] Error:', error);
    return NextResponse.json(
      createPresenceErrorResponse(
        'An internal error occurred',
        PRESENCE_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
