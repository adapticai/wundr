/**
 * Push Subscription API Route
 *
 * Handles registering devices for push notifications.
 *
 * Routes:
 * - POST /api/push/subscribe - Register a device for push notifications
 *
 * @module app/api/push/subscribe/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  pushSubscriptionSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { PushSubscriptionInput } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * POST /api/push/subscribe
 *
 * Register a device for push notifications.
 * Creates or updates a push subscription for the authenticated user.
 * Requires authentication.
 *
 * @param request - Next.js request with subscription data
 * @returns Created or updated subscription
 *
 * @example
 * ```
 * POST /api/push/subscribe
 * Content-Type: application/json
 *
 * {
 *   "token": "ExponentPushToken[xxxx]",
 *   "platform": "ios",
 *   "userAgent": "Genesis/1.0",
 *   "deviceName": "iPhone 15 Pro",
 *   "deviceModel": "iPhone15,3",
 *   "appVersion": "1.0.0"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "id": "sub_123",
 *     "token": "ExponentPushToken[xxxx]",
 *     "platform": "ios",
 *     "active": true,
 *     ...
 *   },
 *   "message": "Device registered successfully"
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
    const parseResult = pushSubscriptionSchema.safeParse(body);
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

    const input: PushSubscriptionInput = parseResult.data;

    // Check if subscription already exists for this token
    const existingSubscription = await prisma.pushSubscription.findUnique({
      where: { token: input.token },
    });

    let subscription;
    let isNew = false;

    if (existingSubscription) {
      // Update existing subscription
      // If it belongs to a different user, reassign it (device changed hands or user logged in)
      subscription = await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          userId: session.user.id,
          platform: input.platform,
          userAgent: input.userAgent,
          deviceName: input.deviceName,
          deviceModel: input.deviceModel,
          appVersion: input.appVersion,
          active: true,
          lastActiveAt: new Date(),
        },
      });
    } else {
      // Create new subscription
      subscription = await prisma.pushSubscription.create({
        data: {
          userId: session.user.id,
          token: input.token,
          platform: input.platform,
          userAgent: input.userAgent,
          deviceName: input.deviceName,
          deviceModel: input.deviceModel,
          appVersion: input.appVersion,
          active: true,
          lastActiveAt: new Date(),
        },
      });
      isNew = true;
    }

    return NextResponse.json(
      {
        data: subscription,
        message: isNew ? 'Device registered successfully' : 'Device subscription updated',
      },
      { status: isNew ? 201 : 200 },
    );
  } catch (error) {
    // Handle unique constraint violation
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Device already registered',
          NOTIFICATION_ERROR_CODES.DUPLICATE_SUBSCRIPTION,
        ),
        { status: 409 },
      );
    }

    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
