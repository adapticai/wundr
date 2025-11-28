/**
 * Channel Notifications API Routes
 *
 * Handles notification preferences for channel members.
 *
 * Routes:
 * - GET /api/channels/:channelId/notifications - Get notification settings
 * - PATCH /api/channels/:channelId/notifications - Update notification settings
 *
 * @module app/api/channels/[channelId]/notifications/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Channel ID validation schema
 */
const channelIdParamSchema = z.object({
  channelId: z.string().cuid('Invalid channel ID format'),
});

/**
 * Notification preference schema
 */
const notificationPreferenceSchema = z.object({
  preference: z.enum(['all', 'mentions', 'none']),
});

/**
 * GET /api/channels/:channelId/notifications
 *
 * Get notification settings for the current user in this channel.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Notification preference
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Check if user is a channel member
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    return NextResponse.json({
      preference: membership.notificationPreference,
    });
  } catch (error) {
    console.error('[GET /api/channels/:channelId/notifications] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/channels/:channelId/notifications
 *
 * Update notification settings for the current user in this channel.
 *
 * @param request - Next.js request with notification preference
 * @param context - Route context containing channel ID
 * @returns Updated notification preference
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate channel ID parameter
    const params = await context.params;
    const paramResult = channelIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid channel ID format', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', ORG_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate input
    const parseResult = notificationPreferenceSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          ORG_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    // Check if user is a channel member
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Not a member of this channel',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Update notification preference
    const updated = await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: params.channelId,
          userId: session.user.id,
        },
      },
      data: {
        notificationPreference: parseResult.data.preference,
      },
    });

    return NextResponse.json({
      message: 'Notification settings updated',
      preference: updated.notificationPreference,
    });
  } catch (error) {
    console.error('[PATCH /api/channels/:channelId/notifications] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        ORG_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
