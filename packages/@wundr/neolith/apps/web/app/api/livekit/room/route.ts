/**
 * LiveKit Room API Route
 *
 * Handles creating and managing LiveKit rooms for video/audio calls.
 *
 * Routes:
 * - POST /api/livekit/room - Create a new LiveKit room
 * - GET /api/livekit/room - List active rooms
 *
 * @module app/api/livekit/room/route
 */

import { getLiveKitService } from '@neolith/core';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CALL_ERROR_CODES } from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * POST /api/livekit/room
 *
 * Create a new LiveKit room.
 *
 * @param request - Next.js request with room creation data
 * @returns Created room details
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate request
    const { name, maxParticipants, emptyTimeout, metadata } = body as {
      name: string;
      maxParticipants?: number;
      emptyTimeout?: number;
      metadata?: string;
    };

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        createErrorResponse('Room name is required', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Create room
    const liveKitService = getLiveKitService();
    const room = await liveKitService.createRoom({
      name,
      maxParticipants,
      emptyTimeout,
      metadata,
    });

    return NextResponse.json({
      data: {
        name: room.name,
        sid: room.sid,
        maxParticipants: room.maxParticipants,
        emptyTimeout: room.emptyTimeout,
        creationTime: room.creationTime,
        numParticipants: room.numParticipants,
        metadata: room.metadata,
      },
      message: 'Room created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/livekit/room] Error:', error);

    // Handle specific LiveKit errors
    if (error instanceof Error) {
      if (error.name === 'RoomAlreadyExistsError') {
        return NextResponse.json(
          createErrorResponse(error.message, CALL_ERROR_CODES.ROOM_ALREADY_EXISTS),
          { status: 409 },
        );
      }
      if (error.name === 'LiveKitConfigError') {
        return NextResponse.json(
          createErrorResponse('LiveKit not configured', CALL_ERROR_CODES.LIVEKIT_CONFIG_ERROR),
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * GET /api/livekit/room
 *
 * List all active LiveKit rooms.
 *
 * @param request - Next.js request
 * @returns List of active rooms
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // List rooms
    const liveKitService = getLiveKitService();
    const rooms = await liveKitService.listRooms();

    return NextResponse.json({
      data: rooms.map((room) => ({
        name: room.name,
        sid: room.sid,
        maxParticipants: room.maxParticipants,
        emptyTimeout: room.emptyTimeout,
        creationTime: room.creationTime,
        numParticipants: room.numParticipants,
        numPublishers: room.numPublishers,
        activeRecording: room.activeRecording,
        metadata: room.metadata,
      })),
    });
  } catch (error) {
    console.error('[GET /api/livekit/room] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
