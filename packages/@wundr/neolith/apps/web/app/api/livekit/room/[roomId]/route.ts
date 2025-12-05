/**
 * LiveKit Room Management API Route
 *
 * Handles operations on specific LiveKit rooms.
 *
 * Routes:
 * - GET /api/livekit/room/:roomId - Get room details
 * - DELETE /api/livekit/room/:roomId - Delete/end a room
 *
 * @module app/api/livekit/room/[roomId]/route
 */

import { getLiveKitService } from '@neolith/core';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CALL_ERROR_CODES } from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with room ID parameter
 */
interface RouteContext {
  params: Promise<{ roomId: string }>;
}

/**
 * GET /api/livekit/room/:roomId
 *
 * Get details of a specific room.
 *
 * @param request - Next.js request
 * @param context - Route context containing room ID
 * @returns Room details
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

    // Get room ID
    const params = await context.params;
    const { roomId } = params;

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Invalid room ID',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Get room
    const liveKitService = getLiveKitService();
    const room = await liveKitService.getRoom(roomId);

    if (!room) {
      return NextResponse.json(
        createErrorResponse('Room not found', CALL_ERROR_CODES.ROOM_NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        name: room.name,
        sid: room.sid,
        maxParticipants: room.maxParticipants,
        emptyTimeout: room.emptyTimeout,
        creationTime: room.creationTime,
        numParticipants: room.numParticipants,
        numPublishers: room.numPublishers,
        activeRecording: room.activeRecording,
        metadata: room.metadata,
      },
    });
  } catch (error) {
    console.error('[GET /api/livekit/room/:roomId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/livekit/room/:roomId
 *
 * Delete/end a specific room.
 *
 * @param request - Next.js request
 * @param context - Route context containing room ID
 * @returns Success confirmation
 */
export async function DELETE(
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

    // Get room ID
    const params = await context.params;
    const { roomId } = params;

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        createErrorResponse(
          'Invalid room ID',
          CALL_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Delete room
    const liveKitService = getLiveKitService();
    await liveKitService.deleteRoom(roomId);

    return NextResponse.json({
      message: 'Room deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /api/livekit/room/:roomId] Error:', error);

    if (error instanceof Error && error.name === 'RoomNotFoundError') {
      return NextResponse.json(
        createErrorResponse(error.message, CALL_ERROR_CODES.ROOM_NOT_FOUND),
        { status: 404 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
