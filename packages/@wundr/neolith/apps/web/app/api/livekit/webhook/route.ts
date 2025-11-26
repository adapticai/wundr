/**
 * LiveKit Webhook API Route
 *
 * Handles incoming webhooks from LiveKit to sync call/huddle state.
 *
 * Events handled:
 * - room_started: A new room has been created
 * - room_finished: A room has ended (all participants left or timeout)
 * - participant_joined: A participant joined a room
 * - participant_left: A participant left a room
 * - track_published: A participant started publishing a track
 * - track_unpublished: A participant stopped publishing a track
 * - egress_started: A recording/egress has started
 * - egress_ended: A recording/egress has ended
 *
 * @module app/api/livekit/webhook/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import {
  livekitWebhookSchema,
  CALL_ERROR_CODES,
  type LiveKitWebhookPayload,
  type HuddleResponse,
} from '@/lib/validations/call';
import { createErrorResponse } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Verify the webhook signature from LiveKit
 *
 * LiveKit signs webhooks using HMAC-SHA256 with the API secret.
 * The signature is sent in the Authorization header.
 *
 * @param request - The incoming request
 * @param body - The raw request body
 * @returns True if signature is valid
 */
async function verifyWebhookSignature(
  request: NextRequest,
  _body: string,
): Promise<boolean> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('[LiveKit Webhook] API credentials not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    console.error('[LiveKit Webhook] Missing Authorization header');
    return false;
  }

  // In production, use the official livekit-server-sdk WebhookReceiver:
  // const receiver = new WebhookReceiver(apiKey, apiSecret);
  // const event = await receiver.receive(body, authHeader);

  // Simplified verification for development
  // The auth header contains a JWT token signed with the API secret
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');

    if (parts.length !== 3) {
      console.error('[LiveKit Webhook] Invalid JWT format');
      return false;
    }

    // Verify the signature
    const [header, payload, signature] = parts;
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', apiSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    // In development, allow if credentials match
    if (process.env.NODE_ENV === 'development') {
      // Check if the issuer matches our API key
      const payloadData = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (payloadData.iss === apiKey) {
        return true;
      }
    }

    return signature === expectedSignature;
  } catch (error) {
    console.error('[LiveKit Webhook] Signature verification error:', error);
    return false;
  }
}

/**
 * Parse room name to determine if it's a call or huddle
 *
 * @param roomName - The LiveKit room name
 * @returns Object with type and ID
 */
function parseRoomName(roomName: string): { type: 'call' | 'huddle' | 'unknown'; id: string | null } {
  if (roomName.startsWith('call-')) {
    // Extract call ID from room name pattern: call-{channelId-suffix}-{timestamp}-{random}
    return { type: 'call', id: null }; // We'll look up by room name
  }
  if (roomName.startsWith('huddle-')) {
    return { type: 'huddle', id: null };
  }
  return { type: 'unknown', id: null };
}

/**
 * Handle room_started event
 */
async function handleRoomStarted(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  if (!roomName) {
return;
}

  const now = new Date();
  const { type } = parseRoomName(roomName);

  if (type === 'call') {
    // Update call status to active
    try {
      await prisma.$executeRaw`
        UPDATE calls
        SET status = 'active', started_at = ${now}, updated_at = ${now}
        WHERE room_name = ${roomName} AND status = 'pending'
      `;
    } catch {
      // Table may not exist
    }
  } else if (type === 'huddle') {
    // Huddles are already active when created
  }
}

/**
 * Handle room_finished event
 */
async function handleRoomFinished(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  if (!roomName) {
return;
}

  const now = new Date();
  const { type } = parseRoomName(roomName);

  if (type === 'call') {
    // End the call
    try {
      await prisma.$executeRaw`
        UPDATE calls
        SET status = 'ended', ended_at = ${now}, updated_at = ${now}
        WHERE room_name = ${roomName} AND status IN ('pending', 'active')
      `;

      // Update all participants' left_at
      await prisma.$executeRaw`
        UPDATE call_participants cp
        SET left_at = ${now}
        FROM calls c
        WHERE c.room_name = ${roomName}
        AND cp.call_id = c.id
        AND cp.left_at IS NULL
      `;
    } catch {
      // Try channel settings
      const channels = await prisma.channel.findMany({
        where: {
          settings: {
            path: ['activeCall', 'roomName'],
            equals: roomName,
          },
        },
      });

      for (const channel of channels) {
        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            settings: {
              activeCall: null,
            },
          },
        });
      }
    }
  } else if (type === 'huddle') {
    // End the huddle
    try {
      await prisma.$executeRaw`
        UPDATE huddles
        SET status = 'ended', ended_at = ${now}, updated_at = ${now}
        WHERE room_name = ${roomName} AND status = 'active'
      `;

      await prisma.$executeRaw`
        UPDATE huddle_participants hp
        SET left_at = ${now}
        FROM huddles h
        WHERE h.room_name = ${roomName}
        AND hp.huddle_id = h.id
        AND hp.left_at IS NULL
      `;
    } catch {
      // Try workspace settings
      const workspaces = await prisma.workspace.findMany({
        select: { id: true, settings: true },
      });

      for (const workspace of workspaces) {
        const settings = workspace.settings as { huddles?: HuddleResponse[] } | null;
        if (settings?.huddles?.some((h) => h.roomName === roomName)) {
          const updatedHuddles = settings.huddles.map((h): HuddleResponse =>
            h.roomName === roomName
              ? { ...h, status: 'ended', endedAt: now }
              : h,
          );

          await prisma.workspace.update({
            where: { id: workspace.id },
            data: {
              settings: JSON.parse(JSON.stringify({
                ...settings,
                huddles: updatedHuddles,
              })),
            },
          });
        }
      }
    }
  }
}

/**
 * Handle participant_joined event
 */
async function handleParticipantJoined(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  const participant = payload.participant;

  if (!roomName || !participant?.identity) {
return;
}

  const now = new Date();
  const { type } = parseRoomName(roomName);
  const userId = participant.identity;
  const displayName = participant.name ?? null;

  if (type === 'call') {
    try {
      // Get call ID
      const calls = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM calls WHERE room_name = ${roomName} LIMIT 1
      `;

      if (calls.length > 0) {
        const callId = calls[0].id;

        await prisma.$executeRaw`
          INSERT INTO call_participants (id, call_id, user_id, display_name, joined_at, is_audio_enabled, is_video_enabled)
          VALUES (
            ${`part_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`},
            ${callId},
            ${userId},
            ${displayName},
            ${now},
            true,
            true
          )
          ON CONFLICT (call_id, user_id) DO UPDATE SET
            joined_at = ${now},
            left_at = NULL,
            display_name = COALESCE(${displayName}, call_participants.display_name)
        `;
      }
    } catch {
      // Table may not exist
    }
  } else if (type === 'huddle') {
    try {
      const huddles = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM huddles WHERE room_name = ${roomName} LIMIT 1
      `;

      if (huddles.length > 0) {
        const huddleId = huddles[0].id;

        await prisma.$executeRaw`
          INSERT INTO huddle_participants (id, huddle_id, user_id, display_name, joined_at, is_audio_enabled, is_video_enabled)
          VALUES (
            ${`hpart_${Date.now().toString(36)}${crypto.randomUUID().split('-')[0]}`},
            ${huddleId},
            ${userId},
            ${displayName},
            ${now},
            true,
            true
          )
          ON CONFLICT (huddle_id, user_id) DO UPDATE SET
            joined_at = ${now},
            left_at = NULL,
            display_name = COALESCE(${displayName}, huddle_participants.display_name)
        `;
      }
    } catch {
      // Table may not exist
    }
  }
}

/**
 * Handle participant_left event
 */
async function handleParticipantLeft(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  const participant = payload.participant;

  if (!roomName || !participant?.identity) {
return;
}

  const now = new Date();
  const { type } = parseRoomName(roomName);
  const userId = participant.identity;

  if (type === 'call') {
    try {
      await prisma.$executeRaw`
        UPDATE call_participants cp
        SET left_at = ${now}
        FROM calls c
        WHERE c.room_name = ${roomName}
        AND cp.call_id = c.id
        AND cp.user_id = ${userId}
        AND cp.left_at IS NULL
      `;
    } catch {
      // Table may not exist
    }
  } else if (type === 'huddle') {
    try {
      await prisma.$executeRaw`
        UPDATE huddle_participants hp
        SET left_at = ${now}
        FROM huddles h
        WHERE h.room_name = ${roomName}
        AND hp.huddle_id = h.id
        AND hp.user_id = ${userId}
        AND hp.left_at IS NULL
      `;
    } catch {
      // Table may not exist
    }
  }
}

/**
 * Handle track_published event
 */
async function handleTrackPublished(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  const participant = payload.participant;
  const track = payload.track;

  if (!roomName || !participant?.identity || !track) {
return;
}

  const { type } = parseRoomName(roomName);
  const userId = participant.identity;
  const trackType = track.type; // AUDIO, VIDEO, or DATA

  // Update participant's track state
  if (type === 'call') {
    try {
      if (trackType === 'AUDIO') {
        await prisma.$executeRaw`
          UPDATE call_participants cp
          SET is_audio_enabled = true
          FROM calls c
          WHERE c.room_name = ${roomName}
          AND cp.call_id = c.id
          AND cp.user_id = ${userId}
        `;
      } else if (trackType === 'VIDEO') {
        await prisma.$executeRaw`
          UPDATE call_participants cp
          SET is_video_enabled = true
          FROM calls c
          WHERE c.room_name = ${roomName}
          AND cp.call_id = c.id
          AND cp.user_id = ${userId}
        `;
      }
    } catch {
      // Table may not exist
    }
  } else if (type === 'huddle') {
    try {
      if (trackType === 'AUDIO') {
        await prisma.$executeRaw`
          UPDATE huddle_participants hp
          SET is_audio_enabled = true
          FROM huddles h
          WHERE h.room_name = ${roomName}
          AND hp.huddle_id = h.id
          AND hp.user_id = ${userId}
        `;
      } else if (trackType === 'VIDEO') {
        await prisma.$executeRaw`
          UPDATE huddle_participants hp
          SET is_video_enabled = true
          FROM huddles h
          WHERE h.room_name = ${roomName}
          AND hp.huddle_id = h.id
          AND hp.user_id = ${userId}
        `;
      }
    } catch {
      // Table may not exist
    }
  }
}

/**
 * Handle track_unpublished event
 */
async function handleTrackUnpublished(payload: LiveKitWebhookPayload): Promise<void> {
  const roomName = payload.room?.name;
  const participant = payload.participant;
  const track = payload.track;

  if (!roomName || !participant?.identity || !track) {
return;
}

  const { type } = parseRoomName(roomName);
  const userId = participant.identity;
  const trackType = track.type;

  if (type === 'call') {
    try {
      if (trackType === 'AUDIO') {
        await prisma.$executeRaw`
          UPDATE call_participants cp
          SET is_audio_enabled = false
          FROM calls c
          WHERE c.room_name = ${roomName}
          AND cp.call_id = c.id
          AND cp.user_id = ${userId}
        `;
      } else if (trackType === 'VIDEO') {
        await prisma.$executeRaw`
          UPDATE call_participants cp
          SET is_video_enabled = false
          FROM calls c
          WHERE c.room_name = ${roomName}
          AND cp.call_id = c.id
          AND cp.user_id = ${userId}
        `;
      }
    } catch {
      // Table may not exist
    }
  } else if (type === 'huddle') {
    try {
      if (trackType === 'AUDIO') {
        await prisma.$executeRaw`
          UPDATE huddle_participants hp
          SET is_audio_enabled = false
          FROM huddles h
          WHERE h.room_name = ${roomName}
          AND hp.huddle_id = h.id
          AND hp.user_id = ${userId}
        `;
      } else if (trackType === 'VIDEO') {
        await prisma.$executeRaw`
          UPDATE huddle_participants hp
          SET is_video_enabled = false
          FROM huddles h
          WHERE h.room_name = ${roomName}
          AND hp.huddle_id = h.id
          AND hp.user_id = ${userId}
        `;
      }
    } catch {
      // Table may not exist
    }
  }
}

/**
 * Handle egress_started event (recording started)
 */
async function handleEgressStarted(payload: LiveKitWebhookPayload): Promise<void> {
  const egressInfo = payload.egressInfo;
  if (!egressInfo?.egressId || !egressInfo.roomName) {
return;
}

  const now = new Date();
  const { type } = parseRoomName(egressInfo.roomName);

  if (type === 'call') {
    try {
      await prisma.$executeRaw`
        UPDATE call_recordings
        SET status = 'recording', started_at = ${now}, updated_at = ${now}
        WHERE egress_id = ${egressInfo.egressId}
      `;
    } catch {
      // Table may not exist
    }
  }
}

/**
 * Handle egress_ended event (recording ended)
 */
async function handleEgressEnded(payload: LiveKitWebhookPayload): Promise<void> {
  const egressInfo = payload.egressInfo;
  if (!egressInfo?.egressId) {
return;
}

  const now = new Date();
  const status = egressInfo.error ? 'failed' : 'stopped';

  try {
    await prisma.$executeRaw`
      UPDATE call_recordings
      SET status = ${status}, ended_at = ${now}, error = ${egressInfo.error ?? null}, updated_at = ${now}
      WHERE egress_id = ${egressInfo.egressId}
    `;
  } catch {
    // Table may not exist
  }
}

/**
 * POST /api/livekit/webhook
 *
 * Handle incoming webhooks from LiveKit.
 *
 * @param request - Next.js request with webhook payload
 * @returns Acknowledgment response
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(request, body);
    if (!isValid) {
      console.error('[LiveKit Webhook] Invalid signature');
      return NextResponse.json(
        createErrorResponse('Invalid webhook signature', CALL_ERROR_CODES.WEBHOOK_VERIFICATION_FAILED),
        { status: 401 },
      );
    }

    // Parse and validate payload
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON payload', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = livekitWebhookSchema.safeParse(payload);
    if (!parseResult.success) {
      console.error('[LiveKit Webhook] Invalid payload:', parseResult.error.flatten());
      return NextResponse.json(
        createErrorResponse(
          'Invalid webhook payload',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const webhookPayload = parseResult.data;
    const eventType = webhookPayload.event;

    // Handle event based on type
    switch (eventType) {
      case 'room_started':
        await handleRoomStarted(webhookPayload);
        break;

      case 'room_finished':
        await handleRoomFinished(webhookPayload);
        break;

      case 'participant_joined':
        await handleParticipantJoined(webhookPayload);
        break;

      case 'participant_left':
        await handleParticipantLeft(webhookPayload);
        break;

      case 'track_published':
        await handleTrackPublished(webhookPayload);
        break;

      case 'track_unpublished':
        await handleTrackUnpublished(webhookPayload);
        break;

      case 'egress_started':
        await handleEgressStarted(webhookPayload);
        break;

      case 'egress_ended':
        await handleEgressEnded(webhookPayload);
        break;

      default:
        // Unhandled event type - silently ignore
    }

    // Always acknowledge receipt
    return NextResponse.json({
      success: true,
      event: eventType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[LiveKit Webhook] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
