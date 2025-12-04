/**
 * Channel Huddle Join API Route
 *
 * Join an active huddle in a channel and receive LiveKit token.
 *
 * Routes:
 * - POST /api/channels/:channelId/huddle/join - Join channel huddle
 *
 * @module app/api/channels/[channelId]/huddle/join/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  joinHuddleSchema,
  CALL_ERROR_CODES,
  type JoinResponse,
} from '@/lib/validations/call';
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
 * Generate a LiveKit access token for huddle
 */
async function generateLiveKitToken(
  roomName: string,
  identity: string,
  name: string,
  audioOnly: boolean = false
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API credentials not configured');
  }

  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 6 * 60 * 60; // 6 hours

  const payload = Buffer.from(
    JSON.stringify({
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
        canPublishSources: audioOnly
          ? ['microphone']
          : ['camera', 'microphone', 'screen_share'],
      },
    })
  ).toString('base64url');

  const crypto = await import('crypto');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * POST /api/channels/:channelId/huddle/join
 *
 * Join the active huddle in a channel.
 *
 * @param request - Next.js request with optional join preferences
 * @param context - Route context containing channel ID
 * @returns LiveKit token and room information
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
          ORG_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Get channel ID from params
    const params = await context.params;
    const { channelId } = params;

    // Parse request body
    let body: unknown = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is acceptable
    }

    const parseResult = joinHuddleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Validation failed',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors }
        ),
        { status: 400 }
      );
    }

    const { displayName, audioOnly } = parseResult.data;

    // Get channel with settings
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        settings: true,
        type: true,
        isArchived: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    if (channel.isArchived) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot join huddle in archived channel',
          ORG_ERROR_CODES.CHANNEL_ARCHIVED
        ),
        { status: 400 }
      );
    }

    // Check if user is a member of the channel
    const channelMember = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId: session.user.id,
        },
      },
    });

    if (!channelMember) {
      return NextResponse.json(
        createErrorResponse(
          'You must be a member of this channel to join the huddle',
          ORG_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // Get active huddle from channel settings
    const settings = channel.settings as {
      activeHuddle?: { id: string; roomName: string; status: string };
    } | null;
    const activeHuddle = settings?.activeHuddle;

    if (!activeHuddle || activeHuddle.status !== 'active') {
      return NextResponse.json(
        createErrorResponse(
          'No active huddle in this channel',
          CALL_ERROR_CODES.HUDDLE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, displayName: true },
    });

    const participantName =
      displayName ?? user?.displayName ?? user?.name ?? 'Anonymous';
    const participantIdentity = session.user.id;

    // Generate LiveKit token
    let token: string;
    try {
      token = await generateLiveKitToken(
        activeHuddle.roomName,
        participantIdentity,
        participantName,
        audioOnly ?? false
      );
    } catch (error) {
      console.error(
        '[POST /api/channels/:channelId/huddle/join] LiveKit token error:',
        error
      );
      return NextResponse.json(
        createErrorResponse(
          'Failed to generate access token',
          CALL_ERROR_CODES.LIVEKIT_TOKEN_ERROR
        ),
        { status: 500 }
      );
    }

    const response: JoinResponse = {
      token,
      roomName: activeHuddle.roomName,
      serverUrl: process.env.LIVEKIT_URL ?? 'wss://localhost:7880',
      participant: {
        identity: participantIdentity,
        name: participantName,
      },
    };

    return NextResponse.json({
      data: response,
      message: 'Joined huddle successfully',
    });
  } catch (error) {
    console.error('[POST /api/channels/:channelId/huddle/join] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
