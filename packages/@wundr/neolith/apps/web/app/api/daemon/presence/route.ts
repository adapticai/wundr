/**
 * Daemon Presence API Route
 *
 * Handles presence status updates for VP daemon services.
 *
 * Routes:
 * - PUT /api/daemon/presence - Update daemon presence status
 *
 * @module app/api/daemon/presence/route
 */

import { redis } from '@neolith/core';
import { prisma } from '@neolith/database';
import * as jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { NextRequest} from 'next/server';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Schema for presence update request body
 */
const presenceUpdateSchema = z.object({
  status: z.enum(['online', 'away', 'busy', 'offline']),
  statusText: z.string().optional(),
});

/**
 * Error codes for presence operations
 */
const PRESENCE_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
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
 * PUT /api/daemon/presence - Update presence status
 *
 * Updates the presence status of the VP daemon.
 *
 * @param request - Next.js request with presence data
 * @returns Success status
 *
 * @example
 * ```
 * PUT /api/daemon/presence
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "status": "online",
 *   "statusText": "Processing tasks"
 * }
 * ```
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: PRESENCE_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: PRESENCE_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 },
      );
    }

    // Validate input using Zod schema
    const parseResult = presenceUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid status. Must be one of: online, away, busy, offline',
          code: PRESENCE_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 },
      );
    }

    const { status, statusText } = parseResult.data;

    // Get VP info
    const vp = await prisma.vP.findUnique({
      where: { id: token.vpId },
      select: {
        id: true,
        userId: true,
        organizationId: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'Unauthorized', code: PRESENCE_ERROR_CODES.UNAUTHORIZED },
        { status: 401 },
      );
    }

    // Map presence status to VP status
    const vpStatus = status === 'offline' ? 'OFFLINE' : status === 'busy' ? 'BUSY' : 'ONLINE';

    // Update VP status in database
    await prisma.vP.update({
      where: { id: token.vpId },
      data: {
        status: vpStatus,
      },
    });

    // Update user status
    await prisma.user.update({
      where: { id: vp.userId },
      data: {
        status: vpStatus === 'OFFLINE' ? 'INACTIVE' : 'ACTIVE',
      },
    });

    // Store presence in Redis for real-time access
    const presenceKey = `presence:vp:${token.vpId}`;
    const presenceData = {
      status,
      statusText: statusText || null,
      updatedAt: new Date().toISOString(),
      daemonId: token.daemonId,
    };

    try {
      await redis.setex(
        presenceKey,
        5 * 60, // 5 minutes TTL
        JSON.stringify(presenceData),
      );

      // Publish presence update for real-time subscriptions
      await redis.publish(
        `presence:updates:${vp.organizationId}`,
        JSON.stringify({
          type: 'vp_presence_update',
          vpId: token.vpId,
          ...presenceData,
        }),
      );
    } catch (redisError) {
      console.error('Redis presence update error:', redisError);
      // Continue without Redis - database is updated
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/daemon/presence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update presence', code: PRESENCE_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 },
    );
  }
}
