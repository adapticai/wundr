/**
 * Call Decline API Route
 *
 * Handles declining an incoming call.
 *
 * Route:
 * - POST /api/calls/:callId/decline - Decline the call
 *
 * @module app/api/calls/[callId]/decline/route
 */

import { getNotificationService } from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { callIdParamSchema, CALL_ERROR_CODES } from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with call ID parameter
 */
interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * POST /api/calls/:callId/decline
 *
 * Decline an incoming call and update its status.
 * Notifies the caller that the call was declined.
 *
 * @param request - Next.js request
 * @param context - Route context with call ID
 * @returns Success response
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CALL_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate call ID parameter
    const params = await context.params;
    const parseResult = callIdParamSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid call ID',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const { callId } = parseResult.data;

    // Get call details with creator info
    const calls = await prisma.$queryRaw<
      Array<{
        id: string;
        channel_id: string;
        status: string;
        created_by_id: string;
      }>
    >`
      SELECT id, channel_id, status, created_by_id
      FROM calls
      WHERE id = ${callId}
      LIMIT 1
    `;

    if (calls.length === 0) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    const call = calls[0];

    // Verify user is a participant in the channel
    const channelMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: call.channel_id,
          userId: session.user.id,
        },
      },
    });

    if (!channelMember) {
      return NextResponse.json(
        createErrorResponse(
          'Not authorized for this call',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if call is in a valid state to decline
    if (!['pending', 'ringing'].includes(call.status)) {
      return NextResponse.json(
        createErrorResponse(
          'Call cannot be declined',
          CALL_ERROR_CODES.CALL_ALREADY_ENDED,
        ),
        { status: 409 },
      );
    }

    // Get user info for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, displayName: true },
    });

    // Update call status to declined
    await prisma.$executeRaw`
      UPDATE calls
      SET status = 'declined',
          ended_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${callId}
    `;

    // Notify the caller that the call was declined
    try {
      const notificationService = getNotificationService();
      await notificationService.createNotification({
        userId: call.created_by_id,
        type: 'call_missed',
        title: 'Call declined',
        body: `${user?.displayName || user?.name || 'Someone'} declined your call`,
        resourceId: callId,
        resourceType: 'call',
        actorId: session.user.id,
        sendPush: true,
        metadata: {
          callId,
          channelId: call.channel_id,
          declinedBy: session.user.id,
        },
      });
    } catch (notificationError) {
      console.error(
        '[POST /api/calls/:callId/decline] Failed to send notification:',
        notificationError,
      );
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      message: 'Call declined',
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/decline] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
