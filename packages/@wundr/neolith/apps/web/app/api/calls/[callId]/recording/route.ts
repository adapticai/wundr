/**
 * Call Recording API Routes
 *
 * Handles starting, stopping, and checking recording status for calls.
 *
 * Routes:
 * - POST /api/calls/:callId/recording - Start recording
 * - DELETE /api/calls/:callId/recording - Stop recording
 * - GET /api/calls/:callId/recording - Get recording status
 *
 * @module app/api/calls/[callId]/recording/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  callIdParamSchema,
  startRecordingSchema,
  CALL_ERROR_CODES,
  type RecordingResponse,
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
 * Helper to get call with access verification
 */
async function getCallWithAccess(callId: string, userId: string) {
  let call: {
    id: string;
    channelId: string;
    status: string;
    roomName: string;
    createdById: string;
  } | null = null;

  try {
    const calls = await prisma.$queryRaw<Array<{
      id: string;
      channel_id: string;
      status: string;
      room_name: string;
      created_by_id: string;
    }>>`
      SELECT id, channel_id, status, room_name, created_by_id
      FROM calls
      WHERE id = ${callId}
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
          equals: callId,
        },
      },
    });

    if (channels.length > 0) {
      const settings = channels[0].settings as {
        activeCall?: {
          id: string;
          status: string;
          roomName: string;
          createdById?: string;
          createdBy?: { id: string };
        };
      };
      if (settings?.activeCall) {
        call = {
          id: settings.activeCall.id,
          channelId: channels[0].id,
          status: settings.activeCall.status,
          roomName: settings.activeCall.roomName,
          createdById: settings.activeCall.createdById ?? settings.activeCall.createdBy?.id ?? '',
        };
      }
    }
  }

  if (!call) {
return null;
}

  // Verify channel access
  const channel = await prisma.channel.findUnique({
    where: { id: call.channelId },
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

  // Check if user can manage recording (creator or admin)
  const isCreator = call.createdById === userId;
  const isOrgAdmin = ['OWNER', 'ADMIN'].includes(orgMembership.role);

  const channelMembership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId: channel.id,
        userId,
      },
    },
  });
  const isChannelAdmin = channelMembership?.role === 'ADMIN';

  return {
    call,
    channel,
    canManageRecording: isCreator || isOrgAdmin || isChannelAdmin,
  };
}

/**
 * POST /api/calls/:callId/recording
 *
 * Start recording a call. Requires call creator or admin permissions.
 *
 * @param request - Next.js request with recording options
 * @param context - Route context containing call ID
 * @returns Recording status and egress ID
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

    const parseResult = startRecordingSchema.safeParse(body);
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

    const { format } = parseResult.data;

    // Get call with access check
    const result = await getCallWithAccess(params.callId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Call not found or access denied', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check permissions
    if (!result.canManageRecording) {
      return NextResponse.json(
        createErrorResponse(
          'Only the call creator or an admin can manage recording',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if call is active
    if (result.call.status !== 'active') {
      return NextResponse.json(
        createErrorResponse('Can only record active calls', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 400 },
      );
    }

    // Check if recording is already active
    let currentRecording: { status: string; egress_id: string } | null = null;
    try {
      const recordings = await prisma.$queryRaw<Array<{ status: string; egress_id: string }>>`
        SELECT status, egress_id FROM call_recordings
        WHERE call_id = ${params.callId} AND status IN ('starting', 'recording')
        LIMIT 1
      `;
      if (recordings.length > 0) {
        currentRecording = recordings[0];
      }
    } catch {
      // Table may not exist
    }

    if (currentRecording) {
      return NextResponse.json(
        createErrorResponse(
          'Recording is already active for this call',
          CALL_ERROR_CODES.RECORDING_ALREADY_ACTIVE,
        ),
        { status: 409 },
      );
    }

    // TODO: Start recording via LiveKit Egress API
    // In production, use the livekit-server-sdk:
    //
    // const egressClient = new EgressClient(
    //   process.env.LIVEKIT_URL!,
    //   process.env.LIVEKIT_API_KEY!,
    //   process.env.LIVEKIT_API_SECRET!,
    // );
    //
    // const output = new EncodedFileOutput({
    //   filepath: outputPath || `recordings/${params.callId}/${Date.now()}.${format}`,
    //   ...s3Config,
    // });
    //
    // const info = await egressClient.startRoomCompositeEgress(
    //   result.call.roomName,
    //   { file: output },
    //   { audioOnly },
    // );

    // Simulate egress start for development
    const egressId = `egress_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`;
    const now = new Date();

    // Record the recording state
    try {
      await prisma.$executeRaw`
        INSERT INTO call_recordings (id, call_id, egress_id, status, format, started_at, created_at)
        VALUES (
          ${`rec_${Date.now().toString(36)}`},
          ${params.callId},
          ${egressId},
          'starting',
          ${format},
          ${now},
          ${now}
        )
      `;
    } catch {
      // Table may not exist, store in call metadata
      try {
        await prisma.$executeRaw`
          UPDATE calls
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{recording}',
            ${JSON.stringify({
              egressId,
              status: 'starting',
              format,
              startedAt: now.toISOString(),
            })}::jsonb
          ),
          updated_at = ${now}
          WHERE id = ${params.callId}
        `;
      } catch {
        // Store in channel settings
      }
    }

    const response: RecordingResponse = {
      status: 'starting',
      egressId,
      startedAt: now,
      format,
    };

    return NextResponse.json({
      data: response,
      message: 'Recording started',
    });
  } catch (error) {
    console.error('[POST /api/calls/:callId/recording] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/calls/:callId/recording
 *
 * Stop recording a call.
 *
 * @param request - Next.js request object
 * @param context - Route context containing call ID
 * @returns Updated recording status
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

    // Get call with access check
    const result = await getCallWithAccess(params.callId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Call not found or access denied', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check permissions
    if (!result.canManageRecording) {
      return NextResponse.json(
        createErrorResponse(
          'Only the call creator or an admin can manage recording',
          CALL_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get current recording
    let currentRecording: { id: string; egress_id: string } | null = null;
    try {
      const recordings = await prisma.$queryRaw<Array<{ id: string; egress_id: string }>>`
        SELECT id, egress_id FROM call_recordings
        WHERE call_id = ${params.callId} AND status IN ('starting', 'recording')
        LIMIT 1
      `;
      if (recordings.length > 0) {
        currentRecording = recordings[0];
      }
    } catch {
      // Table may not exist
    }

    if (!currentRecording) {
      return NextResponse.json(
        createErrorResponse('No active recording found', CALL_ERROR_CODES.RECORDING_NOT_STARTED),
        { status: 400 },
      );
    }

    // TODO: Stop recording via LiveKit Egress API
    // const egressClient = new EgressClient(...);
    // await egressClient.stopEgress(currentRecording.egress_id);

    const now = new Date();

    // Update recording status
    try {
      await prisma.$executeRaw`
        UPDATE call_recordings
        SET status = 'stopping', updated_at = ${now}
        WHERE id = ${currentRecording.id}
      `;
    } catch {
      // Table may not exist
    }

    const response: RecordingResponse = {
      status: 'stopping',
      egressId: currentRecording.egress_id,
      startedAt: null,
      format: null,
    };

    return NextResponse.json({
      data: response,
      message: 'Recording stopped',
    });
  } catch (error) {
    console.error('[DELETE /api/calls/:callId/recording] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * GET /api/calls/:callId/recording
 *
 * Get current recording status for a call.
 *
 * @param request - Next.js request object
 * @param context - Route context containing call ID
 * @returns Current recording status
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

    // Get call with access check
    const result = await getCallWithAccess(params.callId, session.user.id);
    if (!result) {
      return NextResponse.json(
        createErrorResponse('Call not found or access denied', CALL_ERROR_CODES.CALL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Get recording status
    let recording: {
      status: string;
      egress_id: string;
      format: string | null;
      started_at: Date | null;
    } | null = null;

    try {
      const recordings = await prisma.$queryRaw<Array<{
        status: string;
        egress_id: string;
        format: string | null;
        started_at: Date | null;
      }>>`
        SELECT status, egress_id, format, started_at
        FROM call_recordings
        WHERE call_id = ${params.callId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (recordings.length > 0) {
        recording = recordings[0];
      }
    } catch {
      // Table may not exist
    }

    const response: RecordingResponse = recording
      ? {
          status: recording.status as RecordingResponse['status'],
          egressId: recording.egress_id,
          startedAt: recording.started_at,
          format: recording.format,
        }
      : {
          status: 'idle',
          egressId: null,
          startedAt: null,
          format: null,
        };

    return NextResponse.json({ data: response });
  } catch (error) {
    console.error('[GET /api/calls/:callId/recording] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
