/**
 * Huddle Join API Route
 *
 * Handles joining a huddle and generating LiveKit access tokens.
 *
 * Routes:
 * - POST /api/huddles/:huddleId/join - Join huddle and get LiveKit token
 *
 * @module app/api/huddles/[huddleId]/join/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  huddleIdParamSchema,
  joinHuddleSchema,
  CALL_ERROR_CODES,
  type JoinResponse,
  type HuddleResponse,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Route context with huddle ID parameter
 */
interface RouteContext {
  params: Promise<{ huddleId: string }>;
}

/**
 * Generate a LiveKit access token for huddle
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
  audioOnly: boolean = false
): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API credentials not configured');
  }

  // In production, use the official livekit-server-sdk
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
 * POST /api/huddles/:huddleId/join
 *
 * Join a huddle and receive a LiveKit access token.
 *
 * @param request - Next.js request with optional join preferences
 * @param context - Route context containing huddle ID
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
          CALL_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Validate huddle ID parameter
    const params = await context.params;
    const paramResult = huddleIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid huddle ID format',
          CALL_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
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

    // Get huddle info
    let huddle: {
      id: string;
      workspaceId: string;
      isPublic: boolean;
      status: string;
      roomName: string;
      createdById: string;
    } | null = null;

    // Try huddles table first
    try {
      const huddles = await prisma.$queryRaw<
        Array<{
          id: string;
          workspace_id: string;
          is_public: boolean;
          status: string;
          room_name: string;
          created_by_id: string;
        }>
      >`
        SELECT id, workspace_id, is_public, status, room_name, created_by_id
        FROM huddles
        WHERE id = ${params.huddleId}
        LIMIT 1
      `;

      if (huddles.length > 0) {
        huddle = {
          id: huddles[0].id,
          workspaceId: huddles[0].workspace_id,
          isPublic: huddles[0].is_public,
          status: huddles[0].status,
          roomName: huddles[0].room_name,
          createdById: huddles[0].created_by_id,
        };
      }
    } catch {
      // Try workspace settings
      const workspaces = await prisma.workspace.findMany({
        select: { id: true, settings: true, organizationId: true },
      });

      for (const workspace of workspaces) {
        const settings = workspace.settings as {
          huddles?: HuddleResponse[];
        } | null;
        const foundHuddle = settings?.huddles?.find(
          h => h.id === params.huddleId
        );

        if (foundHuddle) {
          huddle = {
            id: foundHuddle.id,
            workspaceId: workspace.id,
            isPublic: foundHuddle.isPublic ?? true,
            status: foundHuddle.status,
            roomName: foundHuddle.roomName,
            createdById: foundHuddle.createdBy?.id ?? '',
          };
          break;
        }
      }
    }

    if (!huddle) {
      return NextResponse.json(
        createErrorResponse(
          'Huddle not found',
          CALL_ERROR_CODES.HUDDLE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if huddle is still active
    if (huddle.status === 'ended') {
      return NextResponse.json(
        createErrorResponse(
          'Huddle has already ended',
          CALL_ERROR_CODES.HUDDLE_ALREADY_ENDED
        ),
        { status: 400 }
      );
    }

    // Check workspace access
    const workspace = await prisma.workspace.findUnique({
      where: { id: huddle.workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        createErrorResponse(
          'Workspace not found',
          CALL_ERROR_CODES.WORKSPACE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    const orgMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: workspace.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (!orgMembership) {
      return NextResponse.json(
        createErrorResponse('Access denied', CALL_ERROR_CODES.FORBIDDEN),
        { status: 403 }
      );
    }

    // Check if huddle is private
    if (!huddle.isPublic) {
      // Check if user was invited or is the creator
      const isCreator = huddle.createdById === session.user.id;

      if (!isCreator) {
        // Check for invitation (if table exists)
        let isInvited = false;
        try {
          const invites = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM huddle_invitations
            WHERE huddle_id = ${params.huddleId} AND user_id = ${session.user.id}
            LIMIT 1
          `;
          isInvited = invites.length > 0;
        } catch {
          // No invitations table
        }

        if (!isInvited) {
          return NextResponse.json(
            createErrorResponse(
              'This is a private huddle. You need an invitation to join.',
              CALL_ERROR_CODES.HUDDLE_PRIVATE
            ),
            { status: 403 }
          );
        }
      }
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
        huddle.roomName,
        participantIdentity,
        participantName,
        audioOnly ?? false
      );
    } catch (error) {
      console.error(
        '[POST /api/huddles/:huddleId/join] LiveKit token error:',
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

    // Add participant record
    const now = new Date();
    try {
      await prisma.$executeRaw`
        INSERT INTO huddle_participants (id, huddle_id, user_id, display_name, joined_at, is_audio_enabled, is_video_enabled)
        VALUES (
          ${`hpart_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`},
          ${params.huddleId},
          ${session.user.id},
          ${participantName},
          ${now},
          true,
          ${!audioOnly}
        )
        ON CONFLICT (huddle_id, user_id) DO UPDATE SET
          joined_at = ${now},
          left_at = NULL,
          display_name = ${participantName}
      `;
    } catch {
      // Participant tracking table may not exist
    }

    const response: JoinResponse = {
      token,
      roomName: huddle.roomName,
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
    console.error('[POST /api/huddles/:huddleId/join] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
