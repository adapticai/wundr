/**
 * Call Join API Route
 *
 * Handles joining a call and generating LiveKit access tokens.
 *
 * Routes:
 * - POST /api/calls/:callId/join - Join call and get LiveKit token
 *
 * @module app/api/calls/[callId]/join/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  callIdParamSchema,
  joinCallSchema,
  CALL_ERROR_CODES,
  type JoinResponse,
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
 * Generate a LiveKit access token
 *
 * Note: In production, use the official livekit-server-sdk package:
 * import { AccessToken } from 'livekit-server-sdk';
 *
 * @param roomName - The LiveKit room name
 * @param identity - Unique identifier for the participant
 * @param name - Display name for the participant
 * @param audioOnly - Whether to restrict to audio only
 * @returns JWT access token for LiveKit
 */
async function generateLiveKitToken(
  roomName: string,
  identity: string,
  name: string,
  audioOnly: boolean = false,
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API credentials not configured');
  }

  // In production, use the official SDK:
  // const token = new AccessToken(apiKey, apiSecret, {
  //   identity,
  //   name,
  //   ttl: '6h', // Token valid for 6 hours
  // });
  //
  // token.addGrant({
  //   roomJoin: true,
  //   room: roomName,
  //   canPublish: true,
  //   canSubscribe: true,
  //   canPublishData: true,
  //   canPublishSources: audioOnly ? ['microphone'] : ['camera', 'microphone', 'screen_share'],
  // });
  //
  // return await token.toJwt();

  // Simplified JWT generation for development
  // IMPORTANT: Replace with livekit-server-sdk in production
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 6 * 60 * 60; // 6 hours

  const payload = Buffer.from(JSON.stringify({
    iss: apiKey,
    sub: identity,
    name,
    iat: now,
    exp,
    nbf: now,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: audioOnly ? ['microphone'] : ['camera', 'microphone', 'screen_share'],
    },
  })).toString('base64url');

  // Note: This is a simplified signature - use proper HMAC-SHA256 in production
  const crypto = await import('crypto');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * POST /api/calls/:callId/join
 *
 * Join a call and receive a LiveKit access token.
 *
 * @param request - Next.js request with optional join preferences
 * @param context - Route context containing call ID
 * @returns LiveKit token and room information
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
        createErrorResponse('Authentication required', CALL_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Validate call ID parameter
    const params = await context.params;
    const paramResult = callIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse('Invalid call ID format', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    // Parse and validate request body
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is acceptable
    }

    const parseResult = joinCallSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { displayName, audioOnly } = parseResult.data;

    // Get call info
    let call: {
      id: string;
      channelId: string;
      type: string;
      status: string;
      roomName: string;
    } | null = null;

    // Try calls table first
    try {
      const calls = await prisma.$queryRaw<Array<{
        id: string;
        channel_id: string;
        type: string;
        status: string;
        room_name: string;
      }>>`
        SELECT id, channel_id, type, status, room_name
        FROM calls
        WHERE id = ${params.callId}
        LIMIT 1
      `;

      if (calls.length > 0) {
        call = {
          id: calls[0].id,
          channelId: calls[0].channel_id,
          type: calls[0].type,
          status: calls[0].status,
          roomName: calls[0].room_name,
        };
      }
    } catch {
      // Try channel settings
      const channels = await prisma.channels.findMany({
        where: {
          settings: {
            path: ['activeCall', 'id'],
            equals: params.callId,
          },
        },
      });

      if (channels.length > 0) {
        const settings = channels[0].settings as { activeCall?: { id: string; type: string; status: string; roomName: string } };
        if (settings?.activeCall) {
          call = {
            id: settings.activeCall.id,
            channelId: channels[0].id,
            type: settings.activeCall.type,
            status: settings.activeCall.status,
            roomName: settings.activeCall.roomName,
          };
        }
      }
    }

    if (!call) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if call is still active
    if (call.status === 'ended' || call.status === 'failed') {
      return NextResponse.json(
        createErrorResponse('Call has already ended', CALL_ERROR_CODES.CALL_ALREADY_ENDED),
        { status: 400 },
      );
    }

    // Check channel access
    const channel = await prisma.channels.findUnique({
      where: { id: call.channelId },
      include: { workspace: true },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse('Channel not found', CALL_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    const orgMembership = await prisma.organization_members.findUnique({
      where: {
        organizationId_userId: {
          organizationId: channel.workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Access denied', CALL_ERROR_CODES.FORBIDDEN),
        { status: 403 },
      );
    }

    // For private channels, check membership
    if (channel.type === 'PRIVATE') {
      const channelMembership = await prisma.channel_members.findUnique({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId: session.user.id,
          },
        },
      });
      if (!channelMembership) {
        return NextResponse.json(
          createErrorResponse('Access denied to private channel', CALL_ERROR_CODES.FORBIDDEN),
          { status: 403 },
        );
      }
    }

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, displayName: true },
    });

    const participantName = displayName ?? user?.displayName ?? user?.name ?? 'Anonymous';
    const participantIdentity = session.user.id;

    // Determine if audio only (either by request or if it's an audio-only call)
    const isAudioOnly = audioOnly || call.type === 'audio';

    // Generate LiveKit token
    let token: string;
    try {
      token = await generateLiveKitToken(
        call.roomName,
        participantIdentity,
        participantName,
        isAudioOnly,
      );
    } catch (error) {
      console.error('[POST /api/calls/:callId/join] LiveKit token error:', error);
      return NextResponse.json(
        createErrorResponse(
          'Failed to generate access token',
          CALL_ERROR_CODES.LIVEKIT_TOKEN_ERROR,
        ),
        { status: 500 },
      );
    }

    // Add participant record
    const now = new Date();
    try {
      await prisma.$executeRaw`
        INSERT INTO call_participants (id, call_id, user_id, display_name, joined_at, is_audio_enabled, is_video_enabled)
        VALUES (
          ${`part_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`},
          ${params.callId},
          ${session.user.id},
          ${participantName},
          ${now},
          true,
          ${!isAudioOnly}
        )
        ON CONFLICT (call_id, user_id) DO UPDATE SET
          joined_at = ${now},
          left_at = NULL,
          display_name = ${participantName}
      `;
    } catch {
      // Participant tracking table may not exist
    }

    // Update call status to active if pending
    if (call.status === 'pending') {
      try {
        await prisma.$executeRaw`
          UPDATE calls
          SET status = 'active', started_at = ${now}, updated_at = ${now}
          WHERE id = ${params.callId} AND status = 'pending'
        `;
      } catch {
        // Try channel settings
        const currentSettings = channel.settings as { activeCall?: { status: string } } | null;
        if (currentSettings?.activeCall?.status === 'pending') {
          await prisma.channels.update({
            where: { id: channel.id },
            data: {
              settings: {
                ...currentSettings,
                activeCall: {
                  ...currentSettings.activeCall,
                  status: 'active',
                  startedAt: now.toISOString(),
                },
              },
            },
          });
        }
      }
    }

    const response: JoinResponse = {
      token,
      roomName: call.roomName,
      serverUrl: process.env.LIVEKIT_URL ?? 'wss://localhost:7880',
      participant: {
        identity: participantIdentity,
        name: participantName,
      },
    };

    return NextResponse.json({
      data: response,
      message: 'Joined call successfully',
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/join] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
