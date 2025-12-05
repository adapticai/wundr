/**
 * Call End API Route
 *
 * Handles ending an active call.
 *
 * Route:
 * - POST /api/calls/:callId/end - End the call
 *
 * @module app/api/calls/[callId]/end/route
 */

import { getLiveKitService } from '@neolith/core';
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
 * POST /api/calls/:callId/end
 *
 * End an active call and clean up resources.
 * Closes the LiveKit room and updates call duration.
 *
 * @param request - Next.js request
 * @param context - Route context with call ID
 * @returns Success response with call duration
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

    // Get call details
    const calls = await prisma.$queryRaw<
      Array<{
        id: string;
        channel_id: string;
        status: string;
        room_name: string;
        started_at: Date | null;
      }>
    >`
      SELECT id, channel_id, status, room_name, started_at
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
          'Not authorized to end this call',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if call is already ended
    if (call.status === 'ended') {
      return NextResponse.json({
        success: true,
        message: 'Call already ended',
      });
    }

    // Calculate duration
    let durationSeconds = 0;
    if (call.started_at) {
      const endTime = new Date();
      durationSeconds = Math.floor(
        (endTime.getTime() - call.started_at.getTime()) / 1000,
      );
    }

    // Update call status to ended
    await prisma.$executeRaw`
      UPDATE calls
      SET status = 'ended',
          ended_at = CURRENT_TIMESTAMP,
          duration_seconds = ${durationSeconds},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${callId}
    `;

    // Update participant records for active participants
    await prisma.$executeRaw`
      UPDATE call_participants
      SET left_at = CURRENT_TIMESTAMP,
          duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - joined_at))::INTEGER
      WHERE call_id = ${callId}
        AND left_at IS NULL
    `;

    // Close LiveKit room
    try {
      const liveKitService = getLiveKitService();
      const room = await liveKitService.getRoom(call.room_name);
      if (room) {
        await liveKitService.deleteRoom(call.room_name);
      }
    } catch (liveKitError) {
      console.error(
        '[POST /api/calls/:callId/end] Failed to close LiveKit room:',
        liveKitError,
      );
      // Don't fail the request if LiveKit cleanup fails
    }

    return NextResponse.json({
      success: true,
      message: 'Call ended',
      data: {
        durationSeconds,
      },
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/end] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
