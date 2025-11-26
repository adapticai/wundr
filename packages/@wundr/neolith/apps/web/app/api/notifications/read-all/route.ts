/**
 * Mark All Notifications Read API Route
 *
 * Handles bulk marking all notifications as read for the current user.
 *
 * Routes:
 * - POST /api/notifications/read-all - Mark all unread notifications as read
 *
 * @module app/api/notifications/read-all/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { NotificationType } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * POST /api/notifications/read-all
 *
 * Mark all unread notifications as read for the current user.
 * Supports optional filtering by notification type.
 * Requires authentication.
 *
 * @param request - Next.js request object (optional JSON body with filters)
 * @returns Count of notifications marked as read
 *
 * @example
 * ```
 * POST /api/notifications/read-all
 *
 * Response:
 * {
 *   "data": {
 *     "count": 15
 *   },
 *   "message": "15 notifications marked as read"
 * }
 * ```
 *
 * @example With type filter
 * ```
 * POST /api/notifications/read-all
 * Content-Type: application/json
 *
 * {
 *   "type": "MESSAGE"
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "count": 5
 *   },
 *   "message": "5 notifications marked as read"
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

    // Parse optional filters from body
    let filters: { type?: string; beforeDate?: string } = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await request.json();
        filters = body ?? {};
      }
    } catch {
      // Body is optional, continue without filters
    }

    // Build where clause
    const where = {
      userId: session.user.id,
      read: false,
      ...(filters.type && { type: filters.type as NotificationType }),
      ...(filters.beforeDate && { createdAt: { lte: new Date(filters.beforeDate) } }),
    };

    // Update all matching notifications
    const result = await prisma.notifications.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    const count = result.count;
    const message = count === 1
      ? '1 notification marked as read'
      : `${count} notifications marked as read`;

    return NextResponse.json({
      data: { count },
      message,
    });
  } catch (error) {
    console.error('[POST /api/notifications/read-all] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
