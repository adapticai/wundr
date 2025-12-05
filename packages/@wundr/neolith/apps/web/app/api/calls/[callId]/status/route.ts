/**
 * Call Status API Route
 *
 * Handles checking the current status of a call.
 *
 * Route:
 * - GET /api/calls/:callId/status - Get call status
 *
 * @module app/api/calls/[callId]/status/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  callIdParamSchema,
  CALL_ERROR_CODES,
  type CallResponse,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with call ID parameter
 */
interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * GET /api/calls/:callId/status
 *
 * Get the current status and details of a call.
 * Includes participant count and call metadata.
 *
 * @param request - Next.js request
 * @param context - Route context with call ID
 * @returns Call status information
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

    // Get call details with creator and participant info
    const calls = await prisma.$queryRaw<
      Array<{
        id: string;
        channel_id: string;
        type: string;
        status: string;
        room_name: string;
        started_at: Date | null;
        ended_at: Date | null;
        created_at: Date;
        created_by_id: string;
        creator_name: string | null;
        participant_count: number;
      }>
    >`
      SELECT
        c.id,
        c.channel_id,
        c.type,
        c.status,
        c.room_name,
        c.started_at,
        c.ended_at,
        c.created_at,
        c.created_by_id,
        u.name as creator_name,
        (SELECT COUNT(*) FROM call_participants WHERE call_id = c.id AND left_at IS NULL) as participant_count
      FROM calls c
      LEFT JOIN users u ON c.created_by_id = u.id
      WHERE c.id = ${callId}
      LIMIT 1
    `;

    if (calls.length === 0) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    const call = calls[0];

    // Verify user has access to the call's channel
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
          'Not authorized to view this call',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const response: CallResponse = {
      id: call.id,
      channelId: call.channel_id,
      type: call.type as 'audio' | 'video',
      status: call.status as 'pending' | 'active' | 'ended' | 'failed',
      roomName: call.room_name,
      startedAt: call.started_at,
      endedAt: call.ended_at,
      createdAt: call.created_at,
      createdBy: {
        id: call.created_by_id,
        name: call.creator_name,
      },
      participantCount: Number(call.participant_count),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('[GET /api/calls/:callId/status] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
