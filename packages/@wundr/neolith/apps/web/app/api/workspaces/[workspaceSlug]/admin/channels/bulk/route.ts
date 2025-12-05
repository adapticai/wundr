/**
 * Admin Channels Bulk Operations API
 *
 * Handles bulk operations on multiple channels.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceSlug/admin/channels/bulk - Bulk operations
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/channels/bulk/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

/**
 * Route context with workspace slug
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * POST /api/workspaces/:workspaceSlug/admin/channels/bulk
 *
 * Perform bulk operations on channels (archive, delete, change visibility).
 *
 * @param request - Next.js request with bulk operation data
 * @param context - Route context
 * @returns Operation results
 */
export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    const { workspaceSlug: workspaceId } = await context.params;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { channelIds, operation, data } = body;

    if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Channel IDs are required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Operation is required',
          ADMIN_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Verify all channels belong to workspace
    const channels = await prisma.channel.findMany({
      where: {
        id: { in: channelIds },
        workspaceId,
      },
    });

    if (channels.length !== channelIds.length) {
      return NextResponse.json(
        createAdminErrorResponse(
          'One or more channels not found',
          ADMIN_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    let result;

    switch (operation) {
      case 'archive':
        result = await prisma.channel.updateMany({
          where: {
            id: { in: channelIds },
            workspaceId,
          },
          data: {
            isArchived: true,
          },
        });
        break;

      case 'unarchive':
        result = await prisma.channel.updateMany({
          where: {
            id: { in: channelIds },
            workspaceId,
          },
          data: {
            isArchived: false,
          },
        });
        break;

      case 'delete':
        result = await prisma.channel.deleteMany({
          where: {
            id: { in: channelIds },
            workspaceId,
          },
        });
        break;

      case 'change_visibility':
        if (!data?.type || !['PUBLIC', 'PRIVATE'].includes(data.type)) {
          return NextResponse.json(
            createAdminErrorResponse(
              'Valid channel type is required',
              ADMIN_ERROR_CODES.VALIDATION_ERROR
            ),
            { status: 400 }
          );
        }

        result = await prisma.channel.updateMany({
          where: {
            id: { in: channelIds },
            workspaceId,
          },
          data: {
            type: data.type,
          },
        });
        break;

      default:
        return NextResponse.json(
          createAdminErrorResponse(
            'Invalid operation',
            ADMIN_ERROR_CODES.VALIDATION_ERROR
          ),
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      count: result.count || channelIds.length,
      operation,
    });
  } catch (_error) {
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to perform bulk operation',
        ADMIN_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
