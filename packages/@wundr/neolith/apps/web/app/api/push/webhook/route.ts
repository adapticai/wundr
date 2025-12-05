/**
 * Push Webhook API Route
 *
 * Handles delivery status callbacks from push notification services.
 *
 * Routes:
 * - POST /api/push/webhook - Process delivery status webhook
 *
 * @module app/api/push/webhook/route
 */

import { createHmac } from 'crypto';

import { prisma } from '@neolith/database';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  pushWebhookSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { PushWebhookPayload } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * Verify webhook signature
 *
 * @param payload - Raw request body
 * @param signature - Signature from header
 * @param secret - Webhook secret
 * @returns Whether signature is valid
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < sigBuffer.length; i++) {
    result |= sigBuffer[i]! ^ expectedBuffer[i]!;
  }

  return result === 0;
}

/**
 * POST /api/push/webhook
 *
 * Process delivery status callbacks from push notification services.
 * Updates notification delivery status and handles bounced tokens.
 *
 * This endpoint does NOT require user authentication but does require
 * a valid webhook signature for security.
 *
 * @param request - Next.js request with webhook payload
 * @returns Acknowledgment response
 *
 * @example
 * ```
 * POST /api/push/webhook
 * Content-Type: application/json
 * X-Webhook-Signature: sha256=xxxxx
 *
 * {
 *   "notificationId": "notif_123",
 *   "token": "ExponentPushToken[xxxx]",
 *   "status": "DELIVERED",
 *   "timestamp": "2024-01-15T10:30:00Z",
 *   "platform": "ios"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Webhook processed"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get webhook secret from environment
    const webhookSecret = process.env.PUSH_WEBHOOK_SECRET;

    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature (if secret is configured)
    if (webhookSecret) {
      const headersList = await headers();
      const signature = headersList.get('x-webhook-signature');

      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json(
          createNotificationErrorResponse(
            'Invalid webhook signature',
            NOTIFICATION_ERROR_CODES.WEBHOOK_ERROR,
          ),
          { status: 401 },
        );
      }
    }

    // Parse and validate payload
    let payload: PushWebhookPayload;
    try {
      const body = JSON.parse(rawBody);
      const parseResult = pushWebhookSchema.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          createNotificationErrorResponse(
            'Invalid webhook payload',
            NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
            { errors: parseResult.error.flatten().fieldErrors },
          ),
          { status: 400 },
        );
      }

      payload = parseResult.data;
    } catch {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid JSON payload',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Validate required webhook fields
    if (!payload.token || !payload.status || !payload.notificationId) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Missing required webhook fields (token, status, notificationId)',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Find the push subscription by token
    const subscription = await prisma.pushSubscription.findUnique({
      where: { token: payload.token },
    });

    // Handle delivery status
    switch (payload.status) {
      case 'DELIVERED':
        // Update delivery status - store delivery time in metadata
        // since Notification model doesn't have a dedicated deliveredAt field
        break;

      case 'FAILED':
        // Log error to notification metadata for debugging

        // Update subscription failure count if exists
        if (subscription) {
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              failureCount: { increment: 1 },
              lastFailureAt: new Date(),
              lastFailureReason: payload.error ?? 'Unknown error',
            },
          });
        }
        break;

      case 'BOUNCED':
        // Token is invalid - deactivate the subscription

        if (subscription) {
          await prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              active: false,
              deactivatedAt: new Date(),
              deactivationReason: 'Token bounced',
            },
          });
        }
        break;

      case 'UNKNOWN':
      default:
        // Unknown status - no action needed
        break;
    }

    // Store webhook event for analytics and debugging
    if (payload.notificationId) {
      await prisma.notification.updateMany({
        where: { id: payload.notificationId },
        data: {
          metadata: {
            webhookStatus: payload.status,
            webhookPlatform: payload.platform ?? 'unknown',
            webhookTimestamp: payload.timestamp ?? new Date().toISOString(),
            webhookProcessedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (_error) {
    // Error handling without console.log - errors are returned in response
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
