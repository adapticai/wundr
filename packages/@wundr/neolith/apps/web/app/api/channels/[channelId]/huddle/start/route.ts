/**
 * Channel Huddle Start API Route
 *
 * Starts a huddle in a specific channel.
 *
 * Routes:
 * - POST /api/channels/:channelId/huddle/start - Start a channel huddle
 *
 * @module app/api/channels/[channelId]/huddle/start/route
 */

import { randomBytes } from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { CALL_ERROR_CODES, type HuddleResponse } from '@/lib/validations/call';
import {
  createErrorResponse,
  ORG_ERROR_CODES,
} from '@/lib/validations/organization';

import type { Prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * Route context with channel ID parameter
 */
interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * Huddle data stored in channel settings JSON field.
 */
interface StoredHuddleData {
  id: string;
  channelId: string;
  name: string;
  roomName: string;
  status: 'active' | 'ended';
  createdAt: string;
  endedAt: string | null;
  createdBy: {
    id: string;
    name: string | null;
  };
  participantCount: number;
}

/**
 * Channel settings structure containing huddle
 */
interface ChannelSettingsWithHuddle {
  activeHuddle?: StoredHuddleData;
  [key: string]: unknown;
}

// Type assertion helper for JSON values
function toJsonValue<T>(data: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
}

/**
 * Generate a cryptographically secure short ID.
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
 * Generate a unique room name for LiveKit huddle.
 */
function generateHuddleRoomName(channelId: string): string {
  const timestamp = Date.now().toString(36);
  const random = generateSecureId(8);
  return `huddle-channel-${channelId.slice(-6)}-${timestamp}-${random}`;
}

/**
 * POST /api/channels/:channelId/huddle/start
 *
 * Start a new huddle in a channel. Only one active huddle per channel.
 *
 * @param request - Next.js request object
 * @param context - Route context containing channel ID
 * @returns Created huddle details with room information
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse(
          'Authentication required',
          ORG_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Get channel ID from params
    const params = await context.params;
    const { channelId } = params;

    // Get channel with workspace info
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        createErrorResponse(
          'Channel not found',
          ORG_ERROR_CODES.CHANNEL_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check if channel is archived
    if (channel.isArchived) {
      return NextResponse.json(
        createErrorResponse(
          'Cannot start huddle in archived channel',
          ORG_ERROR_CODES.CHANNEL_ARCHIVED,
        ),
        { status: 400 },
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
          'You must be a member of this channel to start a huddle',
          ORG_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Check if there's already an active huddle in this channel
    const currentSettings =
      channel.settings as ChannelSettingsWithHuddle | null;
    if (currentSettings?.activeHuddle?.status === 'active') {
      return NextResponse.json(
        createErrorResponse(
          'A huddle is already active in this channel',
          CALL_ERROR_CODES.ALREADY_IN_HUDDLE,
        ),
        { status: 409 },
      );
    }

    // Generate unique room name
    const roomName = generateHuddleRoomName(channelId);

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, displayName: true },
    });

    // Create huddle record
    const huddleId = `huddle_${Date.now().toString(36)}${generateSecureId(8)}`;
    const now = new Date();

    const newHuddle: StoredHuddleData = {
      id: huddleId,
      channelId,
      name: `#${channel.name} Huddle`,
      roomName,
      status: 'active',
      createdAt: now.toISOString(),
      endedAt: null,
      createdBy: {
        id: session.user.id,
        name: user?.displayName ?? user?.name ?? null,
      },
      participantCount: 1,
    };

    // Store in channel settings
    const updatedSettings: Prisma.InputJsonValue = toJsonValue({
      ...currentSettings,
      activeHuddle: newHuddle,
    });

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        settings: updatedSettings,
      },
    });

    const response: HuddleResponse = {
      id: huddleId,
      workspaceId: channel.workspaceId,
      name: newHuddle.name,
      description: `Huddle in #${channel.name}`,
      isPublic: channel.type === 'PUBLIC',
      roomName,
      status: 'active',
      createdAt: now,
      endedAt: null,
      createdBy: {
        id: session.user.id,
        name: user?.displayName ?? user?.name ?? null,
      },
      participantCount: 1,
    };

    return NextResponse.json(
      {
        data: response,
        message: 'Huddle started successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/channels/:channelId/huddle/start] Error:', error);
    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        CALL_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
