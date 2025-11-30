/**
 * Notification Count API Route
 *
 * Handles getting the count of unread notifications.
 *
 * Routes:
 * - GET /api/notifications/count - Get unread notification count
 *
 * @module app/api/notifications/count/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { NotificationType, NotificationPriority } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * GET /api/notifications/count
 *
 * Get the count of unread notifications for the current user.
 * Optionally filtered by type or priority.
 * Requires authentication.
 *
 * @param request - Next.js request object with optional query parameters
 * @returns Unread notification count
 *
 * @example
 * ```
 * GET /api/notifications/count
 *
 * Response:
 * {
 *   "data": {
 *     "unread": 12,
 *     "byType": {
 *       "MESSAGE": 5,
 *       "MENTION": 3,
 *       "THREAD_REPLY": 4
 *     },
 *     "byPriority": {
 *       "HIGH": 2,
 *       "NORMAL": 10
 *     }
 *   }
 * }
 * ```
 *
 * @example With type filter
 * ```
 * GET /api/notifications/count?type=MESSAGE
 *
 * Response:
 * {
 *   "data": {
 *     "unread": 5
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
    const typeFilter = searchParams.get('type');
    const priorityFilter = searchParams.get('priority');
    const includeBreakdown = searchParams.get('breakdown') !== 'false';

    // Base where clause
    const baseWhere = {
      userId: session.user.id,
      read: false,
      archived: false,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    // If specific filters requested, just return the count
    if (typeFilter || priorityFilter) {
      const count = await prisma.notification.count({
        where: {
          ...baseWhere,
          ...(typeFilter && { type: typeFilter as NotificationType }),
          ...(priorityFilter && { priority: priorityFilter as NotificationPriority }),
        },
      });

      return NextResponse.json({
        data: { unread: count },
      });
    }

    // Get total unread count
    const unreadCount = await prisma.notification.count({
      where: baseWhere,
    });

    // If breakdown not requested, return simple count
    if (!includeBreakdown) {
      return NextResponse.json({
        data: { unread: unreadCount },
      });
    }

    // Get counts by type and priority in parallel
    const [byTypeRaw, byPriorityRaw] = await Promise.all([
      prisma.notification.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { type: true },
      }),
      prisma.notification.groupBy({
        by: ['priority'],
        where: baseWhere,
        _count: { priority: true },
      }),
    ]);

    // Transform grouped results to objects
    const byType: Record<string, number> = {};
    for (const item of byTypeRaw) {
      byType[item.type] = item._count.type;
    }

    const byPriority: Record<string, number> = {};
    for (const item of byPriorityRaw) {
      byPriority[item.priority] = item._count.priority;
    }

    return NextResponse.json({
      data: {
        unread: unreadCount,
        byType,
        byPriority,
      },
    });
  } catch (error) {
    console.error('[GET /api/notifications/count] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
