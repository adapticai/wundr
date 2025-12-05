/**
 * VAPID Public Key API Route
 *
 * Returns the VAPID public key for browser push notification subscriptions.
 * VAPID (Voluntary Application Server Identification) keys are used to
 * identify the application server when subscribing to push notifications.
 *
 * Routes:
 * - GET /api/notifications/vapid-key - Get VAPID public key
 *
 * @module app/api/notifications/vapid-key/route
 */

import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

/**
 * Error response codes
 */
const ERROR_CODES = {
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
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
 * GET /api/notifications/vapid-key
 *
 * Get the VAPID public key for push notification subscriptions.
 * This key is used by browsers to subscribe to push notifications.
 * The key should be configured in environment variables.
 *
 * @param _request - Next.js request object
 * @returns VAPID public key
 *
 * @example
 * ```
 * GET /api/notifications/vapid-key
 *
 * Response:
 * {
 *   "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFg..."
 * }
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Get VAPID public key from environment
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      console.error('[VAPID Key] VAPID_PUBLIC_KEY not configured');
      return NextResponse.json(
        createErrorResponse(
          'Push notifications are not configured',
          ERROR_CODES.CONFIGURATION_ERROR,
        ),
        { status: 503 },
      );
    }

    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error('[GET /api/notifications/vapid-key] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
