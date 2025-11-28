/**
 * Mark Single Notification as Read API Route
 *
 * Routes:
 * - POST /api/notifications/[id]/read - Mark a single notification as read
 *
 * @module app/api/notifications/[id]/read/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  notificationIdParamSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/notifications/[id]/read
 *
 * Mark a single notification as read.
 * Requires authentication. Users can only mark their own notifications.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing notification ID
 * @returns Success message
 */
export async function POST(
  _request: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createNotificationErrorResponse('Authentication required', NOTIFICATION_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate params
    const { id } = await params;
    const parseResult = notificationIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid notification ID',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    // Verify notification exists and user owns it
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true, read: true },
    });

    if (!existing) {
      return NextResponse.json(
        createNotificationErrorResponse('Notification not found', NOTIFICATION_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        createNotificationErrorResponse('Access denied', NOTIFICATION_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // If already read, just return success
    if (existing.read) {
      return NextResponse.json({
        message: 'Notification already marked as read',
      });
    }

    // Mark notification as read
    await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('[POST /api/notifications/[id]/read] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
