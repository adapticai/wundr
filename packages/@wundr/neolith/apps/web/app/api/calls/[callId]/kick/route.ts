/**
 * Call Kick Participant API Route
 *
 * Handles removing participants from an active call.
 *
 * Routes:
 * - POST /api/calls/:callId/kick - Remove a participant from the call
 *
 * @module app/api/calls/[callId]/kick/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

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
 * Request body schema for kicking a participant
 */
interface KickParticipantBody {
  participantId: string;
}

/**
 * POST /api/calls/:callId/kick
 *
 * Remove a participant from an active call.
 * Only the call creator/host can kick participants.
 *
 * @param request - Next.js request with participant ID to kick
 * @param context - Route context containing call ID
 * @returns Success status
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          CALL_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate call ID parameter
    const params = await context.params;
    const paramResult = callIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid call ID format',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON body',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const { participantId } = body as KickParticipantBody;
    if (!participantId || typeof participantId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Participant ID is required',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Get call info to verify it exists and user is the host
    let call: {
      id: string;
      channelId: string;
      status: string;
      roomName: string;
      createdById: string;
    } | null = null;

    try {
      const calls = await prisma.$queryRaw<
        Array<{
          id: string;
          channel_id: string;
          status: string;
          room_name: string;
          created_by_id: string;
        }>
      >`
        SELECT id, channel_id, status, room_name, created_by_id
        FROM calls
        WHERE id = ${params.callId}
        LIMIT 1
      `;

      if (calls.length > 0) {
        call = {
          id: calls[0].id,
          channelId: calls[0].channel_id,
          status: calls[0].status,
          roomName: calls[0].room_name,
          createdById: calls[0].created_by_id,
        };
      }
    } catch {
      // Try channel settings
      const channels = await prisma.channel.findMany({
        where: {
          settings: {
            path: ['activeCall', 'id'],
            equals: params.callId,
          },
        },
      });

      if (channels.length > 0) {
        const settings = channels[0].settings as {
          activeCall?: {
            id: string;
            status: string;
            roomName: string;
            createdById: string;
          };
        };
        if (settings?.activeCall) {
          call = {
            id: settings.activeCall.id,
            channelId: channels[0].id,
            status: settings.activeCall.status,
            roomName: settings.activeCall.roomName,
            createdById: settings.activeCall.createdById,
          };
        }
      }
    }

    if (!call) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 }
      );
    }

    // Check if call is still active
    if (call.status === 'ended' || call.status === 'failed') {
      return NextResponse.json(
        createErrorResponse(
          'Call has already ended',
          CALL_ERROR_CODES.CALL_ALREADY_ENDED
        ),
        { status: 400 }
      );
    }

    // Verify user is the call host
    if (call.createdById !== session.user.id) {
      return NextResponse.json(
        createErrorResponse(
          'Only the call host can remove participants',
          CALL_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Use LiveKit API to remove the participant from the room
    const livekitUrl = process.env.LIVEKIT_URL || 'http://localhost:7880';
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error(
        '[POST /api/calls/:callId/kick] LiveKit credentials not configured'
      );
      return NextResponse.json(
        createErrorResponse(
          'Server configuration error',
          CALL_ERROR_CODES.LIVEKIT_ERROR
        ),
        { status: 500 }
      );
    }

    try {
      // Call LiveKit API to remove participant
      const response = await fetch(
        `${livekitUrl}/twirp/livekit.RoomService/RemoveParticipant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${new AccessToken(apiKey, apiSecret).toJwt()}`,
          },
          body: JSON.stringify({
            room: call.roomName,
            identity: participantId,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '[POST /api/calls/:callId/kick] LiveKit API error:',
          errorText
        );
        throw new Error(`LiveKit API error: ${response.status}`);
      }

      // Update participant record (if exists)
      try {
        await prisma.$executeRaw`
          UPDATE call_participants
          SET left_at = NOW()
          WHERE call_id = ${params.callId}
            AND user_id = ${participantId}
            AND left_at IS NULL
        `;
      } catch (updateError) {
        console.error(
          '[POST /api/calls/:callId/kick] Failed to update participant record:',
          updateError
        );
        // Don't fail the request if participant tracking isn't available
      }

      return NextResponse.json({
        data: {
          callId: params.callId,
          participantId,
          removedAt: new Date().toISOString(),
        },
        message: 'Participant removed from call',
      });
    } catch (livekitError) {
      console.error(
        '[POST /api/calls/:callId/kick] LiveKit error:',
        livekitError
      );
      return NextResponse.json(
        createErrorResponse(
          'Failed to remove participant',
          CALL_ERROR_CODES.LIVEKIT_ERROR
        ),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[POST /api/calls/:callId/kick] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
