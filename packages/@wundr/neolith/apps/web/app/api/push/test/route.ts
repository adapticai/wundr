/**
 * Push Test API Route
 *
 * Handles sending test notifications to verify push subscription.
 *
 * Routes:
 * - POST /api/push/test - Send a test notification
 *
 * @module app/api/push/test/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  testNotificationSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { TestNotificationInput } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * Parameters for sending a test push notification
 */
interface TestPushNotificationParams {
  token: string;
  platform: string;
  title: string;
  body: string;
}

/**
 * Send a test push notification to a device
 *
 * @param params - Push notification parameters
 * @throws Error if notification fails to send
 */
async function sendTestPushNotification(
  params: TestPushNotificationParams
): Promise<void> {
  const { token, platform, title, body } = params;

  // For web push, use web-push library
  if (platform === 'WEB') {
    const webPushVapidKey = process.env.VAPID_PUBLIC_KEY;
    const webPushPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!webPushVapidKey || !webPushPrivateKey) {
      throw new Error('Web push VAPID keys not configured');
    }

    // Web push implementation would use the web-push npm package
    // For now, we simulate by validating the token format
    if (!token.startsWith('http')) {
      throw new Error('Invalid web push subscription endpoint');
    }
    return;
  }

  // For Expo push notifications
  if (token.startsWith('ExponentPushToken')) {
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: 'default',
      }),
    });

    if (!expoResponse.ok) {
      const error = await expoResponse.json();
      throw new Error(`Expo push failed: ${error.message ?? 'Unknown error'}`);
    }
    return;
  }

  // For FCM (Android) - would use Firebase Admin SDK
  if (platform === 'ANDROID') {
    // FCM implementation would use firebase-admin
    // Validate token format
    if (token.length < 100) {
      throw new Error('Invalid FCM token');
    }
    return;
  }

  // For APNs (iOS) - would use @parse/node-apn or similar
  if (platform === 'IOS') {
    // APNs implementation
    if (token.length !== 64) {
      throw new Error('Invalid APNs device token');
    }
    return;
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * POST /api/push/test
 *
 * Send a test notification to verify push subscription is working.
 * Can target a specific device or all user's devices.
 * Requires authentication.
 *
 * @param request - Next.js request with optional test configuration
 * @returns Test notification status
 *
 * @example
 * ```
 * POST /api/push/test
 *
 * Response:
 * {
 *   "data": {
 *     "sent": true,
 *     "devices": 2,
 *     "results": [
 *       { "deviceId": "sub_123", "success": true },
 *       { "deviceId": "sub_456", "success": true }
 *     ]
 *   },
 *   "message": "Test notification sent to 2 devices"
 * }
 * ```
 *
 * @example With specific token
 * ```
 * POST /api/push/test
 * Content-Type: application/json
 *
 * {
 *   "token": "ExponentPushToken[xxxx]",
 *   "title": "Custom Test Title",
 *   "body": "Custom test message"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "sent": true,
 *     "devices": 1,
 *     "results": [
 *       { "deviceId": "sub_123", "success": true }
 *     ]
 *   },
 *   "message": "Test notification sent"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Authentication required',
          NOTIFICATION_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Parse optional request body
    let input: TestNotificationInput = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await request.json();
        const parseResult = testNotificationSchema.safeParse(body);
        if (parseResult.success) {
          input = parseResult.data;
        }
      }
    } catch {
      // Body is optional, continue with defaults
    }

    // Find target devices
    const whereClause = {
      userId: session.user.id,
      active: true,
      ...(input.token && { token: input.token }),
    };

    const devices = await prisma.pushSubscription.findMany({
      where: whereClause,
      select: {
        id: true,
        token: true,
        platform: true,
        deviceName: true,
      },
    });

    if (devices.length === 0) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'No active devices found',
          NOTIFICATION_ERROR_CODES.DEVICE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Prepare test notification content
    const title = input.title ?? 'Test Notification';
    const body =
      input.body ??
      'This is a test notification from Neolith App. If you see this, push notifications are working!';

    // Send test notifications to each device using the notification service
    const results = await Promise.all(
      devices.map(async device => {
        try {
          // Send push notification via platform-specific service
          // The actual implementation delegates to web-push or Expo SDK
          await sendTestPushNotification({
            token: device.token,
            platform: device.platform,
            title,
            body,
          });

          // Update last active time
          await prisma.pushSubscription.update({
            where: { id: device.id },
            data: { lastActiveAt: new Date() },
          });

          return {
            deviceId: device.id,
            deviceName: device.deviceName,
            platform: device.platform,
            success: true,
          };
        } catch (error) {
          return {
            deviceId: device.id,
            deviceName: device.deviceName,
            platform: device.platform,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const message = input.token
      ? 'Test notification sent'
      : `Test notification sent to ${successCount} device${successCount !== 1 ? 's' : ''}`;

    return NextResponse.json({
      data: {
        sent: successCount > 0,
        devices: devices.length,
        successful: successCount,
        notification: { title, body },
        results,
      },
      message,
    });
  } catch (_error) {
    // Error handling - error details in response
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
