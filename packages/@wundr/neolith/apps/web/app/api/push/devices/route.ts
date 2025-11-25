/**
 * Push Devices API Route
 *
 * Handles listing registered devices for the current user.
 *
 * Routes:
 * - GET /api/push/devices - List registered devices
 *
 * @module app/api/push/devices/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * GET /api/push/devices
 *
 * List all registered devices for push notifications for the current user.
 * Returns both active and inactive devices with their details.
 * Requires authentication.
 *
 * @param request - Next.js request object with optional query parameters
 * @returns List of registered devices
 *
 * @example
 * ```
 * GET /api/push/devices
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "sub_123",
 *       "platform": "ios",
 *       "deviceName": "iPhone 15 Pro",
 *       "active": true,
 *       "lastActiveAt": "2024-01-15T10:30:00Z",
 *       ...
 *     },
 *     {
 *       "id": "sub_456",
 *       "platform": "android",
 *       "deviceName": "Pixel 8",
 *       "active": false,
 *       "lastActiveAt": "2024-01-10T08:00:00Z",
 *       ...
 *     }
 *   ],
 *   "meta": {
 *     "total": 2,
 *     "active": 1
 *   }
 * }
 * ```
 *
 * @example With active filter
 * ```
 * GET /api/push/devices?active=true
 *
 * Response:
 * {
 *   "data": [...],
 *   "meta": {
 *     "total": 1,
 *     "active": 1
 *   }
 * }
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse optional filters
    const searchParams = request.nextUrl.searchParams;
    const activeFilter = searchParams.get('active');
    const platformFilter = searchParams.get('platform');

    // Build where clause with proper typing
    const where: Prisma.PushSubscriptionWhereInput = {
      userId: session.user.id,
    };

    // Add filters if provided
    if (activeFilter !== null) {
      where.active = activeFilter === 'true';
    }
    if (platformFilter) {
      // Cast to enum type as it comes from query string
      where.platform = platformFilter as 'web' | 'ios' | 'android';
    }

    // Fetch devices and counts in parallel
    const [devices, totalCount, activeCount] = await Promise.all([
      prisma.pushSubscription.findMany({
        where,
        orderBy: { lastActiveAt: 'desc' },
        select: {
          id: true,
          platform: true,
          deviceName: true,
          deviceModel: true,
          appVersion: true,
          userAgent: true,
          active: true,
          lastActiveAt: true,
          createdAt: true,
          // Don't expose the actual token for security
          token: false,
        },
      }),
      prisma.pushSubscription.count({
        where: { userId: session.user.id },
      }),
      prisma.pushSubscription.count({
        where: { userId: session.user.id, active: true },
      }),
    ]);

    return NextResponse.json({
      data: devices,
      meta: {
        total: totalCount,
        active: activeCount,
      },
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
