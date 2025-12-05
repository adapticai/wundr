/**
 * Call Detail API Routes
 *
 * Handles single call operations including getting details and ending calls.
 *
 * Routes:
 * - GET /api/calls/:callId - Get call details
 * - DELETE /api/calls/:callId - End call
 *
 * @module app/api/calls/[callId]/route
 */

import { getLiveKitService } from '@neolith/core';
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
 * Closes a LiveKit room, forcing all participants to disconnect.
 * This is called when a call is ended to ensure all participants are removed.
 *
 * @param roomName - The LiveKit room name to close
 */
async function closeLiveKitRoom(roomName: string): Promise<void> {
  try {
    const liveKitService = getLiveKitService();

    // Check if the room exists
    const room = await liveKitService.getRoom(roomName);
    if (!room) {
      // Room doesn't exist or already deleted - nothing to do
      return;
    }

    // Delete the room - this will disconnect all participants
    await liveKitService.deleteRoom(roomName);
  } catch (error) {
    // Log error but don't fail the call end operation
    // The call can still be marked as ended even if LiveKit room deletion fails
    console.error(
      `[closeLiveKitRoom] Failed to close room ${roomName}:`,
      error
    );
  }
}

/**
 * Route context with call ID parameter
 */
interface RouteContext {
  params: Promise<{ callId: string }>;
}

/**
 * Result of getting a call with access verification
 */
interface CallWithAccess {
  call: {
    id: string;
    channelId: string;
    type: 'audio' | 'video' | 'screen_share';
    status:
      | 'pending'
      | 'ringing'
      | 'active'
      | 'ended'
      | 'missed'
      | 'declined'
      | 'failed';
    roomName: string;
    startedAt: Date | string | null;
    endedAt: Date | string | null;
    createdAt: Date | string;
    createdById: string;
  };
  channel: {
    id: string;
    type: string;
    name: string;
    workspace: {
      id: string;
      organizationId: string;
    };
  };
  orgMembership: {
    id: string;
    role: string;
    userId: string;
    organizationId: string;
  };
  fromSettings?: boolean;
}

/**
 * Helper to get call with access check
 */
async function getCallWithAccess(
  callId: string,
  userId: string
): Promise<CallWithAccess | null> {
  // Try to get call from dedicated table first
  try {
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
      }>
    >`
      SELECT * FROM calls WHERE id = ${callId} LIMIT 1
    `;

    if (calls.length > 0) {
      const call = calls[0];

      // Check channel access
      const channel = await prisma.channel.findUnique({
        where: { id: call.channel_id },
        include: { workspace: true },
      });

      if (!channel) {
        return null;
      }

      const orgMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: channel.workspace.organizationId,
            userId,
          },
        },
      });

      if (!orgMembership) {
        return null;
      }

      // For private channels, check membership
      if (channel.type === 'PRIVATE') {
        const channelMembership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: channel.id,
              userId,
            },
          },
        });
        if (!channelMembership) {
          return null;
        }
      }

      return {
        call: {
          id: call.id,
          channelId: call.channel_id,
          type: call.type as 'audio' | 'video',
          status: call.status as 'pending' | 'active' | 'ended' | 'failed',
          roomName: call.room_name,
          startedAt: call.started_at,
          endedAt: call.ended_at,
          createdAt: call.created_at,
          createdById: call.created_by_id,
        },
        channel,
        orgMembership,
      };
    }
  } catch {
    // Table doesn't exist, try channel settings
  }

  // Fall back to channel settings
  const channels = await prisma.channel.findMany({
    where: {
      settings: {
        path: ['activeCall', 'id'],
        equals: callId,
      },
    },
    include: { workspace: true },
  });

  if (channels.length === 0) {
    return null;
  }

  const channel = channels[0];
  const settings = channel.settings as { activeCall?: CallResponse } | null;
  if (!settings?.activeCall) {
    return null;
  }

  // Check access
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: channel.workspace.organizationId,
        userId,
      },
    },
  });

  if (!orgMembership) {
    return null;
  }

  if (channel.type === 'PRIVATE') {
    const channelMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: channel.id,
          userId,
        },
      },
    });
    if (!channelMembership) {
      return null;
    }
  }

  return {
    call: {
      ...settings.activeCall,
      channelId: channel.id,
      createdById:
        settings.activeCall.createdBy?.id ??
        settings.activeCall.createdById ??
        '',
      createdAt: settings.activeCall.createdAt ?? new Date(),
    },
    channel,
    orgMembership,
    fromSettings: true,
  };
}

/**
 * GET /api/calls/:callId
 *
 * Get details of a specific call.
 *
 * @param request - Next.js request object
 * @param context - Route context containing call ID
 * @returns Call details including participants
 */
export async function GET(
  _request: NextRequest,
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

    // Get call with access check
    const result = await getCallWithAccess(params.callId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Call not found or access denied',
          CALL_ERROR_CODES.CALL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Get creator info
    const creator = await prisma.user.findUnique({
      where: { id: result.call.createdById },
      select: { id: true, name: true, displayName: true },
    });

    // Get participants (if table exists)
    let participants: Array<{
      id: string;
      userId: string;
      displayName: string | null;
      joinedAt: Date;
      leftAt: Date | null;
      isAudioEnabled: boolean;
      isVideoEnabled: boolean;
      user: { id: string; name: string | null; avatarUrl: string | null };
    }> = [];

    try {
      const participantResults = await prisma.$queryRaw<
        Array<{
          id: string;
          user_id: string;
          display_name: string | null;
          joined_at: Date;
          left_at: Date | null;
          is_audio_enabled: boolean;
          is_video_enabled: boolean;
          user_name: string | null;
          user_avatar: string | null;
        }>
      >`
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
        ORDER BY cp.joined_at ASC
      `;

      participants = participantResults.map(p => ({
        id: p.id,
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
    }

    const response: CallResponse = {
      id: result.call.id,
      channelId: result.call.channelId,
      type: result.call.type,
      status: result.call.status,
      roomName: result.call.roomName,
      startedAt: result.call.startedAt,
      endedAt: result.call.endedAt,
      createdAt: result.call.createdAt,
      createdBy: {
        id: creator?.id ?? result.call.createdById,
        name: creator?.displayName ?? creator?.name ?? null,
      },
      participantCount: participants.filter(p => !p.leftAt).length,
      participants: participants.map(p => ({
        ...p,
        callId: result.call.id,
      })),
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/calls/:callId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calls/:callId
 *
 * End a call. Only the call creator or channel/org admin can end a call.
 *
 * @param request - Next.js request object
 * @param context - Route context containing call ID
 * @returns Success message
 */
export async function DELETE(
  _request: NextRequest,
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

    // Get call with access check
    const result = await getCallWithAccess(params.callId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse(
          'Call not found or access denied',
          CALL_ERROR_CODES.CALL_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check if call is already ended
    if (result.call.status === 'ended') {
      return NextResponse.json(
        createErrorResponse(
          'Call has already ended',
          CALL_ERROR_CODES.CALL_ALREADY_ENDED
        ),
        { status: 400 }
      );
    }

    // Check permissions (creator or admin)
    const isCreator = result.call.createdById === session.user.id;
    const isOrgAdmin = ['OWNER', 'ADMIN'].includes(result.orgMembership.role);

    // Check channel admin
    let isChannelAdmin = false;
    const channelMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: result.channel.id,
          userId: session.user.id,
        },
      },
    });
    if (channelMembership?.role === 'ADMIN') {
      isChannelAdmin = true;
    }

    if (!isCreator && !isOrgAdmin && !isChannelAdmin) {
      return NextResponse.json(
        createErrorResponse(
          'Only the call creator or an admin can end this call',
          CALL_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    const now = new Date();

    // End the call
    if ('fromSettings' in result && result.fromSettings) {
      // Update channel settings
      await prisma.channel.update({
        where: { id: result.channel.id },
        data: {
          settings: {
            activeCall: null,
          },
        },
      });
    } else {
      // Update calls table
      try {
        await prisma.$executeRaw`
          UPDATE calls
          SET status = 'ended', ended_at = ${now}, updated_at = ${now}
          WHERE id = ${params.callId}
        `;
      } catch (updateError) {
        console.error(
          '[DELETE /api/calls/:callId] Error updating call status:',
          updateError
        );
      }

      // Update all participants' left_at
      try {
        await prisma.$executeRaw`
          UPDATE call_participants
          SET left_at = ${now}
          WHERE call_id = ${params.callId} AND left_at IS NULL
        `;
      } catch (participantError) {
        console.error(
          '[DELETE /api/calls/:callId] Error updating participants:',
          participantError
        );
      }
    }

    // Close the LiveKit room to end the call for all participants
    await closeLiveKitRoom(result.call.roomName);

    return NextResponse.json({
      message: 'Call ended successfully',
      data: {
        id: params.callId,
        status: 'ended',
        endedAt: now,
      },
    });
  } catch (error) {
    console.error('[DELETE /api/calls/:callId] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
