/**
 * Push Notification Subscription API Route
 *
 * Handles push notification subscription management.
 * Stores push subscription data for sending notifications to users.
 *
 * Routes:
 * - POST /api/notifications/subscribe - Subscribe to push notifications
 *
 * @module app/api/notifications/subscribe/route
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
  details?: Record<string, unknown>
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
 * Push subscription data structure
 */
interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

/**
 * Validate push subscription object
 */
function isValidPushSubscription(obj: unknown): obj is PushSubscription {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const sub = obj as Record<string, unknown>;

  if (typeof sub.endpoint !== 'string') {
    return false;
  }

  if (
    typeof sub.keys !== 'object' ||
    sub.keys === null ||
    Array.isArray(sub.keys)
  ) {
    return false;
  }

  const keys = sub.keys as Record<string, unknown>;

  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    return false;
  }

  return true;
}

/**
 * POST /api/notifications/subscribe
 *
 * Subscribe to push notifications by storing the push subscription data.
 * The subscription is associated with the authenticated user.
 * Requires authentication.
 *
 * @param request - Next.js request with push subscription data
 * @returns Success confirmation
 *
 * @example
 * ```
 * POST /api/notifications/subscribe
 * Content-Type: application/json
 *
 * {
 *   "endpoint": "https://fcm.googleapis.com/fcm/send/...",
 *   "keys": {
 *     "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
 *     "auth": "tBHItJI5svbpez7KI4CCXg=="
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Push subscription saved"
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
          ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ERROR_CODES.VALIDATION_ERROR),
        { status: 400 }
      );
    }

    // Validate subscription
    if (!isValidPushSubscription(body)) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid push subscription format',
          ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const subscription = body;

    // Store push subscription in user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', ERROR_CODES.VALIDATION_ERROR),
        { status: 404 }
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

    // Check if this subscription already exists
    const subscriptionExists = existingSubscriptions.some(
      (sub: unknown) =>
        typeof sub === 'object' &&
        sub !== null &&
        'endpoint' in sub &&
        sub.endpoint === subscription.endpoint
    );

    // Add new subscription if it doesn't exist
    const updatedSubscriptions = subscriptionExists
      ? existingSubscriptions
      : [...existingSubscriptions, subscription];

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
      message: 'Push subscription saved',
    });
  } catch (error) {
    console.error('[POST /api/notifications/subscribe] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
