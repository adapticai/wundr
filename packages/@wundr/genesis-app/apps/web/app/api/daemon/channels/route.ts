/**
 * Daemon Channels API Route
 *
 * Handles channel listing for VP daemon services.
 *
 * Routes:
 * - GET /api/daemon/channels - Get channels accessible by the daemon
 *
 * @module app/api/daemon/channels/route
 */

import { prisma } from '@genesis/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Error codes for channel operations
 */
const CHANNEL_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Decoded access token payload
 */
interface AccessTokenPayload {
  vpId: string;
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
 * GET /api/daemon/channels - Get channels accessible by the daemon
 *
 * Retrieves all channels the VP daemon has membership in.
 *
 * @param request - Next.js request with authentication
 * @returns List of channels with membership info
 *
 * @example
 * ```
 * GET /api/daemon/channels
 * Authorization: Bearer <access_token>
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Get VP user ID
    const vp = await prisma.vP.findUnique({
      where: { id: token.vpId },
      select: {
        userId: true,
        organizationId: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'Unauthorized', code: CHANNEL_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Get channels where VP is a member
    const memberships = await prisma.channelMember.findMany({
      where: {
        userId: vp.userId,
      },
      include: {
        channel: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            _count: {
              select: {
                members: true,
                messages: true,
              },
            },
          },
        },
      },
    });

    // Format response
    const channels = memberships.map((membership) => ({
      id: membership.channel.id,
      name: membership.channel.name,
      description: membership.channel.description,
      type: membership.channel.type,
      isPrivate: membership.channel.type === 'PRIVATE' || membership.channel.type === 'DM',
      workspace: membership.channel.workspace,
      memberCount: membership.channel._count.members,
      messageCount: membership.channel._count.messages,
      membership: {
        role: membership.role,
      },
      createdAt: membership.channel.createdAt,
      updatedAt: membership.channel.updatedAt,
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('[GET /api/daemon/channels] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get channels', code: CHANNEL_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
