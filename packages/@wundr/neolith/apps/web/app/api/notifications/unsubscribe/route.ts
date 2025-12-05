/**
 * Push Notification Unsubscribe API Route
 *
 * Handles push notification unsubscription.
 * Removes push subscription data for the specified endpoint.
 *
 * Routes:
 * - POST /api/notifications/unsubscribe - Unsubscribe from push notifications
 *
 * @module app/api/notifications/unsubscribe/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Error response codes
 */
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Create standardized error response
 */
function createErrorResponse(
  message: string,
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  details?: Record<string, unknown>,
) {
  return {
    error: {
      message,
      code,
      ...details,
    },
  };
}

/**
 * POST /api/notifications/unsubscribe
 *
 * Unsubscribe from push notifications by removing the push subscription data
 * for the specified endpoint. Requires authentication.
 *
 * @param request - Next.js request with endpoint to unsubscribe
 * @returns Success confirmation
 *
 * @example
 * ```
 * POST /api/notifications/unsubscribe
 * Content-Type: application/json
 *
 * {
 *   "endpoint": "https://fcm.googleapis.com/fcm/send/..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Push subscription removed"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ERROR_CODES.UNAUTHORIZED,
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
        createErrorResponse('Invalid JSON body', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate endpoint
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('endpoint' in body) ||
      typeof body.endpoint !== 'string'
    ) {
      return NextResponse.json(
        createErrorResponse(
          'Endpoint is required',
          ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const { endpoint } = body as { endpoint: string };

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse(
          'User not found',
          ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 404 },
      );
    }

    // Extract current preferences
    const currentPrefs =
      typeof user.preferences === 'object' &&
      user.preferences !== null &&
      !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    // Get existing push subscriptions
    const existingSubscriptions = Array.isArray(currentPrefs.pushSubscriptions)
      ? currentPrefs.pushSubscriptions
      : [];

    // Remove subscription with matching endpoint
    const updatedSubscriptions = existingSubscriptions.filter(
      (sub: unknown) =>
        !(
          typeof sub === 'object' &&
          sub !== null &&
          'endpoint' in sub &&
          sub.endpoint === endpoint
        ),
    );

    // Update user preferences
    const updatedPrefs = {
      ...currentPrefs,
      pushSubscriptions: updatedSubscriptions,
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: updatedPrefs as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    });
  } catch (error) {
    console.error('[POST /api/notifications/unsubscribe] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
