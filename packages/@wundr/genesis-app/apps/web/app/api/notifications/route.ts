/**
 * Notifications API Routes
 *
 * Handles listing and creating notifications for the current user.
 *
 * Routes:
 * - GET /api/notifications - List notifications with filters
 * - POST /api/notifications - Create an internal notification
 *
 * @module app/api/notifications/route
 */

import { prisma } from '@genesis/database';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  notificationListSchema,
  createNotificationSchema,
  createNotificationErrorResponse,
  NOTIFICATION_ERROR_CODES,
} from '@/lib/validations/notification';

import type { NotificationListInput, CreateNotificationInput, PaginationMeta } from '@/lib/validations/notification';
import type { NextRequest } from 'next/server';

/**
 * GET /api/notifications
 *
 * List notifications for the current user with optional filtering and pagination.
 * Requires authentication.
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of notifications
 *
 * @example
 * ```
 * GET /api/notifications?page=1&limit=20&read=false&type=MESSAGE
 *
 * Response:
 * {
 *   "data": [...],
 *   "pagination": {
 *     "page": 1,
 *     "limit": 20,
 *     "totalCount": 45,
 *     "totalPages": 3,
 *     "hasNextPage": true,
 *     "hasPreviousPage": false
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

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = notificationListSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createNotificationErrorResponse(
          'Invalid query parameters',
          NOTIFICATION_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: NotificationListInput = parseResult.data;

    // Build where clause
    const where: Prisma.NotificationWhereInput = {
      userId: session.user.id,
      ...(filters.read !== undefined && { read: filters.read }),
      ...(filters.type && { type: filters.type }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.archived !== undefined && { archived: filters.archived }),
      // Exclude expired notifications
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;
    const take = filters.limit;

    // Build orderBy
    const orderBy: Prisma.NotificationOrderByWithRelationInput = {
      [filters.sortBy]: filters.sortOrder,
    };

    // Fetch notifications and total count in parallel
    const [notifications, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / filters.limit);
    const pagination: PaginationMeta = {
      page: filters.page,
      limit: filters.limit,
      totalCount,
      totalPages,
      hasNextPage: filters.page < totalPages,
      hasPreviousPage: filters.page > 1,
    };

    return NextResponse.json({
      data: notifications,
      pagination,
    });
  } catch (error) {
    console.error('[GET /api/notifications] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * POST /api/notifications
 *
 * Create a new internal notification. Can target the current user or another user
 * (requires appropriate permissions).
 * Requires authentication.
 *
 * @param request - Next.js request with notification data
 * @returns Created notification object
 *
 * @example
 * ```
 * POST /api/notifications
 * Content-Type: application/json
 *
 * {
 *   "title": "New message",
 *   "body": "You have a new message from John",
 *   "type": "MESSAGE",
 *   "priority": "NORMAL",
 *   "actionUrl": "/channels/123",
 *   "sendPush": true
 * }
 *
 * Response:
 * {
 *   "data": { ... },
 *   "message": "Notification created successfully"
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
    const parseResult = createNotificationSchema.safeParse(body);
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

    const input: CreateNotificationInput = parseResult.data;

    // Determine target user
    const targetUserId = input.targetUserId ?? session.user.id;

    // If targeting another user, verify permissions
    if (input.targetUserId && input.targetUserId !== session.user.id) {
      // Check if current user is admin or has permission to notify target user
      // For now, allow VPs and admins to send notifications to any user
      if (!session.user.isVP && session.user.role !== 'ADMIN') {
        return NextResponse.json(
          createNotificationErrorResponse(
            'Insufficient permissions to notify other users',
            NOTIFICATION_ERROR_CODES.FORBIDDEN,
          ),
          { status: 403 },
        );
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: input.targetUserId },
        select: { id: true },
      });

      if (!targetUser) {
        return NextResponse.json(
          createNotificationErrorResponse(
            'Target user not found',
            NOTIFICATION_ERROR_CODES.NOT_FOUND,
          ),
          { status: 404 },
        );
      }
    }

    // Create the notification
    const notification = await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: input.title,
        body: input.body,
        type: input.type,
        priority: input.priority,
        resourceId: input.resourceId,
        resourceType: input.resourceType,
        actionUrl: input.actionUrl,
        metadata: input.metadata as Prisma.InputJsonValue ?? {},
        expiresAt: input.expiresAt,
        read: false,
        archived: false,
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

    // TODO: If sendPush is true, queue push notification delivery
    // This would integrate with a push notification service (FCM, APNs, etc.)
    if (input.sendPush) {
      // Queue push notification for async delivery
      // await queuePushNotification(notification);
    }

    // TODO: If sendEmail is true, queue email notification
    if (input.sendEmail) {
      // Queue email notification
      // await queueEmailNotification(notification);
    }

    return NextResponse.json(
      { data: notification, message: 'Notification created successfully' },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/notifications] Error:', error);
    return NextResponse.json(
      createNotificationErrorResponse(
        'An internal error occurred',
        NOTIFICATION_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
