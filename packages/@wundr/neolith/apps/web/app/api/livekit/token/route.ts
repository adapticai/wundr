/**
 * LiveKit Token Generation API Route
 *
 * Generates access tokens for participants to join LiveKit rooms.
 *
 * Routes:
 * - GET /api/livekit/token - Generate participant access token
 *
 * @module app/api/livekit/token/route
 */

import { getLiveKitService } from '@neolith/core';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CALL_ERROR_CODES } from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * GET /api/livekit/token
 *
 * Generate a LiveKit access token for a participant.
 *
 * Query parameters:
 * - roomName: Name of the room to join (required)
 * - identity: Participant identity (defaults to user ID)
 * - name: Display name (defaults to user's display name)
 * - role: Participant role - 'host', 'guest', or 'viewer' (defaults to 'guest')
 * - metadata: Optional metadata as JSON string
 *
 * @param request - Next.js request with query parameters
 * @returns Access token and server URL
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const roomName = searchParams.get('roomName');
    const identity = searchParams.get('identity') ?? session.user.id;
    const name = searchParams.get('name') ?? session.user.name ?? 'Anonymous';
    const role = searchParams.get('role') ?? 'guest';
    const metadata = searchParams.get('metadata');

    // Validate required parameters
    if (!roomName) {
      return NextResponse.json(
        createErrorResponse('roomName query parameter is required', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Validate role
    if (!['host', 'guest', 'viewer'].includes(role)) {
      return NextResponse.json(
        createErrorResponse('role must be one of: host, guest, viewer', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Generate token based on role
    const liveKitService = getLiveKitService();
    let tokenResult;

    switch (role) {
      case 'host':
        tokenResult = await liveKitService.generateHostToken(identity, roomName);
        break;
      case 'viewer':
        tokenResult = await liveKitService.generateViewerToken(identity, roomName);
        break;
      case 'guest':
      default:
        tokenResult = await liveKitService.generateGuestToken(identity, roomName);
        break;
    }

    // Add metadata if provided
    if (metadata) {
      tokenResult = await liveKitService.generateToken(identity, roomName, {
        ...tokenResult,
        metadata,
        name,
      });
    }

    return NextResponse.json({
      data: {
        token: tokenResult.token,
        serverUrl: liveKitService.getServerUrl(),
        expiresAt: tokenResult.expiresAt,
        participant: {
          identity: tokenResult.identity,
          name,
          roomName: tokenResult.roomName,
        },
      },
    });
  } catch (error) {
    console.error('[GET /api/livekit/token] Error:', error);

    if (error instanceof Error) {
      if (error.name === 'TokenGenerationError') {
        return NextResponse.json(
          createErrorResponse(error.message, CALL_ERROR_CODES.LIVEKIT_TOKEN_ERROR),
          { status: 500 },
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
