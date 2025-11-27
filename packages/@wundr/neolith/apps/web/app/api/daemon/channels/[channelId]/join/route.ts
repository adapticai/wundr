/**
 * Daemon Channel Join/Leave API Route
 *
 * Handles channel join and leave operations for Orchestrator daemon services.
 *
 * Routes:
 * - POST /api/daemon/channels/[channelId]/join - Join a channel
 * - DELETE /api/daemon/channels/[channelId]/join - Leave a channel
 *
 * @module app/api/daemon/channels/[channelId]/join/route
 */

import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for channel operations
 */
const CHANNEL_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
  CHANNEL_PRIVATE: 'CHANNEL_PRIVATE',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  NOT_MEMBER: 'NOT_MEMBER',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  orchestratorId: string;
  daemonId: string;
  scopes: string[];
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Verify daemon token from Authorization header
 */
async function verifyDaemonToken(request: NextRequest): Promise<AccessTokenPayload> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.slice(7);
  const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

  if (decoded.type !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

/**
 * POST /api/daemon/channels/[channelId]/join - Join a channel
 *
 * Adds the Orchestrator daemon as a member of the specified channel.
 *
 * @param request - Next.js request with authentication
 * @param params - Route parameters containing channelId
 * @returns Success status
 *
 * @example
 * ```
 * POST /api/daemon/channels/chan_123/join
 * Authorization: Bearer <access_token>
 * ```
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: CHANNEL_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    const { channelId } = await params;

    // Get Orchestrator user info
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: {
        userId: true,
        organizationId: true,
      },
    });

    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Unauthorized', code: CHANNEL_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Check if channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        workspace: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found', code: CHANNEL_ERROR_CODES.CHANNEL_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if channel is private
    if (channel.type === 'PRIVATE' || channel.type === 'DM') {
      return NextResponse.json(
        { error: 'Cannot join private channel', code: CHANNEL_ERROR_CODES.CHANNEL_PRIVATE },
        { status: 403 },
      );
    }

    // Check if Orchestrator belongs to same organization
    if (channel.workspace.organizationId !== orchestrator.organizationId) {
      return NextResponse.json(
        { error: 'Channel not found', code: CHANNEL_ERROR_CODES.CHANNEL_NOT_FOUND },
        { status: 404 },
      );
    }

    // Check if already a member
    const existingMembership = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId: orchestrator.userId,
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: 'Already a member of this channel', code: CHANNEL_ERROR_CODES.ALREADY_MEMBER },
        { status: 409 },
      );
    }

    // Create membership
    await prisma.channelMember.create({
      data: {
        channelId,
        userId: orchestrator.userId,
        role: 'MEMBER',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/daemon/channels/[channelId]/join] Error:', error);
    return NextResponse.json(
      { error: 'Failed to join channel', code: CHANNEL_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/daemon/channels/[channelId]/join - Leave a channel
 *
 * Removes the Orchestrator daemon from the specified channel.
 *
 * @param request - Next.js request with authentication
 * @param params - Route parameters containing channelId
 * @returns Success status
 *
 * @example
 * ```
 * DELETE /api/daemon/channels/chan_123/join
 * Authorization: Bearer <access_token>
 * ```
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: CHANNEL_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    const { channelId } = await params;

    // Get Orchestrator user info
    const orchestrator = await prisma.orchestrator.findUnique({
      where: { id: token.orchestratorId },
      select: { userId: true },
    });

    if (!orchestrator) {
      return NextResponse.json(
        { error: 'Unauthorized', code: CHANNEL_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Check if member
    const membership = await prisma.channelMember.findFirst({
      where: {
        channelId,
        userId: orchestrator.userId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this channel', code: CHANNEL_ERROR_CODES.NOT_MEMBER },
        { status: 404 },
      );
    }

    // Remove membership
    await prisma.channelMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/daemon/channels/[channelId]/join] Error:', error);
    return NextResponse.json(
      { error: 'Failed to leave channel', code: CHANNEL_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
