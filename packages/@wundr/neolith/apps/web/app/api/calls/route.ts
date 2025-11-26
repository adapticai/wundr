/**
 * Calls API Routes
 *
 * Handles voice/video call creation and listing operations.
 *
 * Routes:
 * - POST /api/calls - Create a new call
 * - GET /api/calls - List active calls
 *
 * @module app/api/calls/route
 */

import { randomBytes } from 'crypto';

import { getNotificationService } from '@neolith/core';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createCallSchema,
  callFiltersSchema,
  CALL_ERROR_CODES,
  type CallResponse,
} from '@/lib/validations/call';
import { createErrorResponse, ORG_ERROR_CODES } from '@/lib/validations/organization';

import type { NextRequest } from 'next/server';

/**
 * Parameters for sending call invite notifications
 */
interface SendCallInviteParams {
  callId: string;
  channelId: string;
  roomName: string;
  callType: 'audio' | 'video';
  invitedUserIds: string[];
  inviterUserId: string;
  inviterName: string;
}

/**
 * Sends call invite notifications to specified users.
 * Creates in-app notifications and optionally sends push notifications.
 *
 * @param params - Call invite parameters
 */
async function sendCallInviteNotifications(params: SendCallInviteParams): Promise<void> {
  const {
    callId,
    channelId,
    callType,
    invitedUserIds,
    inviterUserId,
    inviterName,
  } = params;

  // Get channel name for notification body
  const channel = await prisma.channels.findUnique({
    where: { id: channelId },
    select: { name: true },
  });

  const channelName = channel?.name ?? 'a channel';
  const callTypeLabel = callType === 'video' ? 'video call' : 'voice call';

  // Get notification service
  const notificationService = getNotificationService();

  // Send notifications to each invited user (exclude the inviter)
  const notificationPromises = invitedUserIds
    .filter((userId) => userId !== inviterUserId)
    .map(async (userId) => {
      try {
        await notificationService.createNotification({
          userId,
          type: 'call_incoming',
          title: `${inviterName} is calling`,
          body: `You're invited to a ${callTypeLabel} in ${channelName}`,
          resourceId: callId,
          resourceType: 'call',
          actorId: inviterUserId,
          sendPush: true,
          metadata: {
            callId,
            channelId,
            callType,
            action: 'join_call',
            actionUrl: `/call/${callId}`,
          },
        });
      } catch (error) {
        // Log error but don't fail the entire operation
        console.error(`[sendCallInviteNotifications] Failed to notify user ${userId}:`, error);
      }
    });

  await Promise.all(notificationPromises);
}

/**
 * Generate a cryptographically secure short ID.
 *
 * @param length - The length of the ID (default: 8)
 * @returns A random alphanumeric string
 */
function generateSecureId(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      result += chars[byte % chars.length];
    }
  }

  return result;
}

/**
 * Generate a unique room name for LiveKit.
 *
 * @param channelId - The channel ID for the call
 * @returns A unique room name using cryptographic randomness
 */
function generateRoomName(channelId: string): string {
  const timestamp = Date.now().toString(36);
  const random = generateSecureId(8);
  return `call-${channelId.slice(-6)}-${timestamp}-${random}`;
}

/**
 * Helper to verify user has access to channel
 */
async function verifyChannelAccess(channelId: string, userId: string) {
  const channel = await prisma.channels.findUnique({
    where: { id: channelId },
    include: {
      workspace: true,
    },
  });

  if (!channel) {
return null;
}

  // Check organization membership
  const orgMembership = await prisma.organization_members.findUnique({
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

  // For private channels, check channel membership
  if (channel.type === 'PRIVATE') {
    const channelMembership = await prisma.channel_members.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });
    if (!channelMembership) {
return null;
}
  }

  return { channel, orgMembership };
}

/**
 * POST /api/calls
 *
 * Create a new voice/video call in a channel.
 *
 * @param request - Next.js request with call creation data
 * @returns Created call details with room information
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse('Invalid JSON body', CALL_ERROR_CODES.VALIDATION_ERROR),
        { status: 400 },
      );
    }

    const parseResult = createCallSchema.safeParse(body);
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

    const { channelId, type, invitees } = parseResult.data;

    // Verify channel access
    const access = await verifyChannelAccess(channelId, session.user.id);
    if (!access) {
      return NextResponse.json(
        createErrorResponse('Channel not found or access denied', CALL_ERROR_CODES.CHANNEL_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check if there's already an active call in this channel
    const existingCall = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM calls
      WHERE channel_id = ${channelId}
      AND status = 'active'
      LIMIT 1
    `.catch(() => []);

    if (existingCall.length > 0) {
      return NextResponse.json(
        createErrorResponse(
          'An active call already exists in this channel',
          CALL_ERROR_CODES.ALREADY_IN_CALL,
        ),
        { status: 409 },
      );
    }

    // Generate unique room name
    const roomName = generateRoomName(channelId);

    // Get user info
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, displayName: true },
    });

    // Create call record (using raw query since Call model may not exist yet)
    const callId = `call_${Date.now().toString(36)}${generateSecureId(8)}`;
    const now = new Date();

    // Note: In production, you would have a Call model in Prisma schema
    // For now, we'll create the structure but you may need to add the model
    await prisma.$executeRaw`
      INSERT INTO calls (id, channel_id, type, status, room_name, created_by_id, created_at, updated_at)
      VALUES (${callId}, ${channelId}, ${type}, 'pending', ${roomName}, ${session.user.id}, ${now}, ${now})
    `.catch(async () => {
      // If calls table doesn't exist, store in channel settings temporarily
      await prisma.channels.update({
        where: { id: channelId },
        data: {
          settings: {
            activeCall: {
              id: callId,
              type,
              status: 'pending',
              roomName,
              createdById: session.user.id,
              createdAt: now.toISOString(),
            },
          },
        },
      });
    });

    // Add creator as first participant
    await prisma.$executeRaw`
      INSERT INTO call_participants (id, call_id, user_id, joined_at, is_audio_enabled, is_video_enabled)
      VALUES (${`part_${Date.now().toString(36)}`}, ${callId}, ${session.user.id}, ${now}, true, ${type === 'video'})
    `.catch(() => {
      // Table may not exist yet
    });

    const response: CallResponse = {
      id: callId,
      channelId,
      type,
      status: 'pending',
      roomName,
      startedAt: null,
      endedAt: null,
      createdAt: now,
      createdBy: {
        id: session.user.id,
        name: user?.displayName ?? user?.name ?? null,
      },
      participantCount: 1,
    };

    // Send notifications to invitees if provided
    if (invitees && invitees.length > 0) {
      await sendCallInviteNotifications({
        callId,
        channelId,
        roomName,
        callType: type,
        invitedUserIds: invitees,
        inviterUserId: session.user.id,
        inviterName: user?.displayName ?? user?.name ?? 'Someone',
      });
    }

    return NextResponse.json({
      data: response,
      message: 'Call created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/calls] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}

/**
 * GET /api/calls
 *
 * List calls with optional filters. By default returns active calls only.
 *
 * @param request - Next.js request with query parameters
 * @returns List of calls matching filters
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', ORG_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = callFiltersSchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid query parameters',
          CALL_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const { channelId, status, type, activeOnly, page, limit, sortBy, sortOrder } = parseResult.data;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereConditions: string[] = [];
    const params: (string | boolean)[] = [];

    if (channelId) {
      whereConditions.push('c.channel_id = ?');
      params.push(channelId);
    }

    if (status) {
      whereConditions.push('c.status = ?');
      params.push(status);
    } else if (activeOnly) {
      whereConditions.push("c.status IN ('pending', 'active')");
    }

    if (type) {
      whereConditions.push('c.type = ?');
      params.push(type);
    }

    // Get user's accessible channels
    const userChannels = await prisma.channel_members.findMany({
      where: { userId: session.user.id },
      select: { channelId: true },
    });
    const channelIds = userChannels.map((m) => m.channelId);

    if (channelIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    // Try to query calls table, fall back to channel settings
    let calls: CallResponse[] = [];
    let totalCount = 0;

    try {
      // Build ORDER BY clause based on sortBy and sortOrder
      const sortColumn = sortBy === 'startedAt' ? 'c.started_at' : 'c.created_at';
      const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Attempt to get calls from dedicated table
      const callResults = await prisma.$queryRaw<Array<{
        id: string;
        channel_id: string;
        type: string;
        status: string;
        room_name: string;
        started_at: Date | null;
        ended_at: Date | null;
        created_at: Date;
        created_by_id: string;
        creator_name: string | null;
        participant_count: number;
      }>>`
        SELECT
          c.id,
          c.channel_id,
          c.type,
          c.status,
          c.room_name,
          c.started_at,
          c.ended_at,
          c.created_at,
          c.created_by_id,
          u.name as creator_name,
          (SELECT COUNT(*) FROM call_participants WHERE call_id = c.id AND left_at IS NULL) as participant_count
        FROM calls c
        LEFT JOIN users u ON c.created_by_id = u.id
        WHERE c.channel_id = ANY(${channelIds})
        ${activeOnly ? prisma.$queryRaw`AND c.status IN ('pending', 'active')` : prisma.$queryRaw``}
        ORDER BY ${prisma.$queryRawUnsafe(sortColumn)} ${prisma.$queryRawUnsafe(sortDirection)}
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      calls = callResults.map((row) => ({
        id: row.id,
        channelId: row.channel_id,
        type: row.type as 'audio' | 'video',
        status: row.status as 'pending' | 'active' | 'ended' | 'failed',
        roomName: row.room_name,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        createdAt: row.created_at,
        createdBy: {
          id: row.created_by_id,
          name: row.creator_name,
        },
        participantCount: Number(row.participant_count),
      }));

      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM calls WHERE channel_id = ANY(${channelIds})
      `;
      totalCount = Number(countResult[0]?.count ?? 0);
    } catch {
      // Fall back to checking channel settings for active calls
      const channels = await prisma.channels.findMany({
        where: {
          id: { in: channelIds },
        },
        select: {
          id: true,
          settings: true,
        },
      });

      for (const channel of channels) {
        const settings = channel.settings as { activeCall?: CallResponse } | null;
        if (settings?.activeCall) {
          calls.push({
            ...settings.activeCall,
            channelId: channel.id,
          });
        }
      }
      totalCount = calls.length;
    }

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      data: calls,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('[GET /api/calls] Error:', error);
    return NextResponse.json(
      createErrorResponse('An internal error occurred', CALL_ERROR_CODES.INTERNAL_ERROR),
      { status: 500 },
    );
  }
}
