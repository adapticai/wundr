/**
 * VP Status Update API Route
 *
 * Allows Virtual Persons (VPs) to post status updates to channels.
 *
 * Routes:
 * - POST /api/vps/:id/status - Post a status update
 *
 * @module app/api/vps/[id]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  vpStatusUpdateSchema,
  vpIdParamSchema,
  createErrorResponse,
  VP_ERROR_CODES,
} from '@/lib/validations/vp';

import type { VPStatusUpdateInput } from '@/lib/validations/vp';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';

/**
 * Route context with VP ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/vps/:id/status
 *
 * Post a status update from a VP to a channel.
 * Requires authentication as the VP or admin/owner in the VP's organization.
 *
 * @param request - Next.js request with status update data
 * @param context - Route context containing VP ID
 * @returns Created status message
 *
 * @example
 * ```
 * POST /api/vps/vp_123/status
 * Content-Type: application/json
 *
 * {
 *   "message": "Completed quarterly analysis. Results ready for review.",
 *   "channelId": "channel_456",
 *   "statusType": "update"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', VP_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate VP ID parameter
    const params = await context.params;
    const paramResult = vpIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid VP ID format', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', VP_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = vpStatusUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          VP_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: VPStatusUpdateInput = parseResult.data;

    // Get VP and verify access
    const vp = await prisma.vP.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', VP_ERROR_CODES.NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if authenticated user is the VP or has admin/owner role
    const isVPUser = session.user.id === vp.user.id;
    let hasAdminAccess = false;

    if (!isVPUser) {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: vp.organizationId,
            userId: session.user.id,
          },
        },
      });

      hasAdminAccess = membership?.role === 'OWNER' || membership?.role === 'ADMIN';
    }

    if (!isVPUser && !hasAdminAccess) {
      return NextResponse.json(
        createErrorResponse(
          'Insufficient permissions to post status for this VP',
          VP_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Verify channel exists and is accessible
    const channel = await prisma.channel.findUnique({
      where: { id: input.channelId },
      include: {
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Channel not found', VP_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify channel belongs to VP's organization
    if (channel.workspace.organizationId !== vp.organizationId) {
      return NextResponse.json(
        createErrorResponse('Channel not accessible', VP_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // Ensure VP is a member of the channel (or add them)
    const channelMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: input.channelId,
          userId: vp.user.id,
        },
      },
    });

    if (!channelMembership) {
      // Add VP to channel as a member
      await prisma.channelMember.create({
        data: {
          channelId: input.channelId,
          userId: vp.user.id,
          role: 'MEMBER',
        },
      });
    }

    // Create metadata for status message
    const metadata = {
      statusType: input.statusType,
      isStatusUpdate: true,
      vpId: vp.id,
      ...(input.metadata ?? {}),
    };

    // Create the status message
    const statusMessage = await prisma.message.create({
      data: {
        content: input.message,
        type: 'SYSTEM',
        channelId: input.channelId,
        authorId: vp.user.id,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            isVP: true,
          },
        },
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: statusMessage,
      message: 'Status update posted successfully',
    });
  } catch (error) {
    console.error('[POST /api/vps/:id/status] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        VP_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
