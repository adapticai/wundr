/**
 * Individual Notification API Routes
 *
 * Handles operations on a single notification by ID.
 *
 * Routes:
 * - GET /api/notifications/[id] - Get notification details
 * - PATCH /api/notifications/[id] - Mark notification as read/archived
 * - DELETE /api/notifications/[id] - Delete a notification
 *
 * @module app/api/notifications/[id]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  notificationIdParamSchema,
  updateNotificationSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { UpdateNotificationInput } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notifications/[id]
 *
 * Get details of a specific notification.
 * Requires authentication. Users can only access their own notifications.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing notification ID
 * @returns Notification details
 *
 * @example
 * ```
 * GET /api/notifications/clx123abc
 *
 * Response:
 * {
 *   "data": {
 *     "id": "clx123abc",
 *     "title": "New message",
 *     "body": "You have a new message",
 *     "type": "MESSAGE",
 *     "read": false,
 *     ...
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

    // Validate params
    const { id } = await params;
    const parseResult = notificationIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid notification ID',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Fetch notification
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!notification) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Notification not found',
          NOTIFICATION_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Verify ownership
    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Access denied',
          NOTIFICATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    return NextResponse.json({ data: notification });
  } catch (error) {
    console.error('[GET /api/notifications/[id]] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/[id]
 *
 * Update a notification (mark as read/archived).
 * Requires authentication. Users can only update their own notifications.
 *
 * @param request - Next.js request with update data
 * @param params - Route parameters containing notification ID
 * @returns Updated notification
 *
 * @example
 * ```
 * PATCH /api/notifications/clx123abc
 * Content-Type: application/json
 *
 * {
 *   "read": true
 * }
 *
 * Response:
 * {
 *   "data": { ... },
 *   "message": "Notification updated successfully"
 * }
 * ```
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

    // Validate params
    const { id } = await params;
    const paramResult = notificationIdParamSchema.safeParse({ id });
    if (!paramResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid notification ID',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: paramResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid JSON body',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Validate input
    const parseResult = updateNotificationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Validation failed',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const input: UpdateNotificationInput = parseResult.data;

    // Verify notification exists and user owns it
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Notification not found',
          NOTIFICATION_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Access denied',
          NOTIFICATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Update notification
    const notification = await prisma.notification.update({
      where: { id },
      data: {
        ...(input.read !== undefined && {
          read: input.read,
          readAt: input.read ? new Date() : null,
        }),
        ...(input.archived !== undefined && { archived: input.archived }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: notification,
      message: 'Notification updated successfully',
    });
  } catch (error) {
    console.error('[PATCH /api/notifications/[id]] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 *
 * Delete a notification.
 * Requires authentication. Users can only delete their own notifications.
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing notification ID
 * @returns Success message
 *
 * @example
 * ```
 * DELETE /api/notifications/clx123abc
 *
 * Response:
 * {
 *   "message": "Notification deleted successfully"
 * }
 * ```
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
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

    // Validate params
    const { id } = await params;
    const parseResult = notificationIdParamSchema.safeParse({ id });
    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid notification ID',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    // Verify notification exists and user owns it
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Notification not found',
          NOTIFICATION_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Access denied',
          NOTIFICATION_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('[DELETE /api/notifications/[id]] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
