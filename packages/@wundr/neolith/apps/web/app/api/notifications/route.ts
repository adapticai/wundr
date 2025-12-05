/**
 * Notifications API Routes
 *
 * Routes:
 * - GET /api/notifications - List notifications with pagination/filters
 * - PATCH /api/notifications - Mark notifications as read
 * - DELETE /api/notifications - Delete notifications
 *
 * @module app/api/notifications/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Zod schemas for validation
 */
const markAsReadSchema = z
  .object({
    ids: z.array(z.string()).optional(),
    markAll: z.boolean().optional(),
  })
  .refine(data => data.ids || data.markAll, {
    message: 'Either provide notification IDs or set markAll to true',
  });

const deleteNotificationsSchema = z.object({
  ids: z.array(z.string()).min(1, 'Provide at least one notification ID'),
});

/**
 * Notification response type
 */
interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  priority: string;
  read: boolean;
  readAt: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pagination metadata
 */
interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * GET /api/notifications
 *
 * List notifications for the current user with optional filtering and pagination.
 * Requires authentication.
 *
 * Query Parameters:
 * - page (number): Page number (default: 1)
 * - limit (number): Items per page (default: 20, max: 100)
 * - read (boolean): Filter by read status
 * - type (string): Filter by notification type
 *
 * @param request - Next.js request object with query parameters
 * @returns Paginated list of notifications
 */
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<
    | { data: NotificationResponse[]; pagination: PaginationMeta }
    | { error: string }
  >
> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('limit') || '20', 10)),
    );
    const readFilter = searchParams.get('read');
    const typeFilter = searchParams.get('type');

    // Build where clause
    const where = {
      userId: session.user.id,
      archived: false, // Don't show archived notifications
      ...(readFilter !== null && { read: readFilter === 'true' }),
      ...(typeFilter && { type: typeFilter.toUpperCase() as any }),
    };

    // Get total count
    const totalCount = await prisma.notification.count({ where });

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        priority: true,
        read: true,
        readAt: true,
        actionUrl: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform to response format
    const data: NotificationResponse[] = notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      read: notification.read,
      readAt: notification.readAt?.toISOString() || null,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata as Record<string, unknown>,
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    }));

    // Calculate pagination
    const totalPages = Math.ceil(totalCount / limit);
    const pagination: PaginationMeta = {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return NextResponse.json({ data, pagination });
  } catch (error) {
    console.error('[GET /api/notifications] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark notifications as read. Can mark single notification or multiple by IDs.
 * Requires authentication.
 *
 * Request Body:
 * - ids (string[]): Array of notification IDs to mark as read
 * - markAll (boolean): Mark all notifications as read
 *
 * @param request - Next.js request with notification IDs
 * @returns Updated notification count
 */
export async function PATCH(
  request: NextRequest,
): Promise<
  NextResponse<{ data: { updatedCount: number } } | { error: string }>
> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate with Zod
    const validated = markAsReadSchema.parse(body);
    const { ids, markAll } = validated;

    // Build where clause
    const where: {
      userId: string;
      id?: { in: string[] };
      read?: boolean;
    } = {
      userId: session.user.id,
      read: false, // Only update unread notifications
    };

    if (!markAll && ids) {
      where.id = { in: ids };
    }

    // Update notifications
    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      data: {
        updatedCount: result.count,
      },
    });
  } catch (error) {
    console.error('[PATCH /api/notifications] Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/notifications
 *
 * Delete notifications. Can delete single or multiple notifications by IDs.
 * Requires authentication.
 *
 * Request Body:
 * - ids (string[]): Array of notification IDs to delete
 *
 * @param request - Next.js request with notification IDs
 * @returns Deleted notification count
 */
export async function DELETE(
  request: NextRequest,
): Promise<
  NextResponse<{ data: { deletedCount: number } } | { error: string }>
> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate with Zod
    const validated = deleteNotificationsSchema.parse(body);
    const { ids } = validated;

    // Delete notifications (only user's own notifications)
    const result = await prisma.notification.deleteMany({
      where: {
        userId: session.user.id,
        id: { in: ids },
      },
    });

    return NextResponse.json({
      data: {
        deletedCount: result.count,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/notifications] Error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
