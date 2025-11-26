/**
 * Call Participants API Route
 *
 * Handles listing participants in a call.
 *
 * Routes:
 * - GET /api/calls/:callId/participants - List call participants
 *
 * @module app/api/calls/[callId]/participants/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  callIdParamSchema,
  CALL_ERROR_CODES,
  type CallParticipant,
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
 * GET /api/calls/:callId/participants
 *
 * List all participants in a call, including those who have left.
 * Query param ?active=true returns only current participants.
 *
 * @param request - Next.js request object
 * @param context - Route context containing call ID
 * @returns List of participants
 */
export async function GET(
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

    // Get query params
    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';

    // Get call info to verify access
    let callChannelId: string | null = null;

    try {
      const calls = await prisma.$queryRaw<Array<{ channel_id: string }>>`
        SELECT channel_id FROM calls WHERE id = ${params.callId} LIMIT 1
      `;

      if (calls.length > 0) {
        callChannelId = calls[0].channel_id;
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
        select: { id: true },
      });

      if (channels.length > 0) {
        callChannelId = channels[0].id;
      }
    }

    if (!callChannelId) {
      return NextResponse.json(
        createErrorResponse('Call not found', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Verify channel access
    const channel = await prisma.channels.findUnique({
      where: { id: callChannelId },
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

    // Get participants
    let participants: CallParticipant[] = [];

    try {
      const participantResults = await prisma.$queryRaw<Array<{
        id: string;
        user_id: string;
        display_name: string | null;
        joined_at: Date;
        left_at: Date | null;
        is_audio_enabled: boolean;
        is_video_enabled: boolean;
        user_name: string | null;
        user_avatar: string | null;
      }>>`
        SELECT
          cp.id,
          cp.user_id,
          cp.display_name,
          cp.joined_at,
          cp.left_at,
          cp.is_audio_enabled,
          cp.is_video_enabled,
          u.name as user_name,
          u.avatar_url as user_avatar
        FROM call_participants cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.call_id = ${params.callId}
        ${activeOnly ? prisma.$queryRaw`AND cp.left_at IS NULL` : prisma.$queryRaw``}
        ORDER BY cp.joined_at ASC
      `;

      participants = participantResults.map((p) => ({
        id: p.id,
        callId: params.callId,
        userId: p.user_id,
        displayName: p.display_name,
        joinedAt: p.joined_at,
        leftAt: p.left_at,
        isAudioEnabled: p.is_audio_enabled,
        isVideoEnabled: p.is_video_enabled,
        user: {
          id: p.user_id,
          name: p.user_name,
          avatarUrl: p.user_avatar,
        },
      }));
    } catch {
      // Participants table doesn't exist
      // Return empty array
    }

    return NextResponse.json({
      data: participants,
      meta: {
        total: participants.length,
        active: participants.filter((p) => !p.leftAt).length,
      },
    });
  } catch (error) {
    console.error('[GET /api/calls/:callId/participants] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
