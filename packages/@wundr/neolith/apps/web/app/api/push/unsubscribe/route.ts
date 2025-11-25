/**
 * Push Unsubscribe API Route
 *
 * Handles unregistering devices from push notifications.
 *
 * Routes:
 * - POST /api/push/unsubscribe - Unregister a device from push notifications
 *
 * @module app/api/push/unsubscribe/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  pushUnsubscribeSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { PushUnsubscribeInput } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * POST /api/push/unsubscribe
 *
 * Unregister a device from push notifications.
 * The subscription is deactivated rather than deleted to preserve delivery history.
 * Requires authentication.
 *
 * @param request - Next.js request with token to unsubscribe
 * @returns Success message
 *
 * @example
 * ```
 * POST /api/push/unsubscribe
 * Content-Type: application/json
 *
 * {
 *   "token": "ExponentPushToken[xxxx]"
 * }
 *
 * Response:
 * {
 *   "message": "Device unregistered successfully"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createNotificationErrorResponse('Invalid JSON body', NOTIFICATION_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = pushUnsubscribeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Validation failed',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: PushUnsubscribeInput = parseResult.data;

    // Find the subscription
    const subscription = await prisma.pushSubscription.findUnique({
      where: { token: input.token },
    });

    if (!subscription) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Subscription not found',
          NOTIFICATION_ERROR_CODES.DEVICE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify ownership - user can only unsubscribe their own devices
    if (subscription.userId !== session.user.id) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Access denied',
          NOTIFICATION_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Deactivate the subscription (soft delete)
    await prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: {
        active: false,
        deactivatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Device unregistered successfully',
    });
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
