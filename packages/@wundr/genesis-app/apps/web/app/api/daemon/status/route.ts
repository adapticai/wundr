/**
 * Daemon VP Status API Route
 *
 * Handles VP operational status updates for daemon services.
 *
 * Routes:
 * - PUT /api/daemon/status - Update VP operational status
 *
 * @module app/api/daemon/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@genesis/database';
import { redis } from '@genesis/core';
import * as jwt from 'jsonwebtoken';

/**
 * JWT configuration
 */
const JWT_SECRET = process.env.DAEMON_JWT_SECRET || 'daemon-secret-change-in-production';

/**
 * Valid VP operational statuses
 */
const VALID_STATUSES = ['active', 'paused', 'error'] as const;
type VPOperationalStatus = (typeof VALID_STATUSES)[number];

/**
 * Error codes for status operations
 */
const STATUS_ERROR_CODES = {
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
 * PUT /api/daemon/status - Update VP operational status
 *
 * Updates the operational status of the VP (active, paused, error).
 * This is different from presence - it indicates the VP's operational state.
 *
 * @param request - Next.js request with status data
 * @returns Success status
 *
 * @example
 * ```
 * PUT /api/daemon/status
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "status": "active",
 *   "message": "Processing incoming requests"
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
        { error: 'Unauthorized', code: STATUS_ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: STATUS_ERROR_CODES.VALIDATION_ERROR },
        { status: 400 }
      );
    }

    const { status, message } = body as {
      status?: string;
      message?: string;
    };

    // Validate status
    if (!status || !VALID_STATUSES.includes(status as VPOperationalStatus)) {
      return NextResponse.json(
        {
          error: 'Invalid status. Must be one of: active, paused, error',
          code: STATUS_ERROR_CODES.VALIDATION_ERROR,
        },
        { status: 400 }
      );
    }

    // Get VP info
    const vp = await prisma.vP.findUnique({
      where: { id: token.vpId },
      select: {
        id: true,
        organizationId: true,
        capabilities: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'Unauthorized', code: STATUS_ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Map operational status to VP status enum (ERROR maps to OFFLINE as ERROR is not in enum)
    const vpDbStatus = status === 'error' ? 'OFFLINE' : status === 'paused' ? 'BUSY' : 'ONLINE';

    // Update VP with operational status
    const currentCapabilities = (vp.capabilities as Record<string, unknown>) || {};
    await prisma.vP.update({
      where: { id: token.vpId },
      data: {
        status: vpDbStatus,
        capabilities: {
          ...currentCapabilities,
          operationalStatus: status,
          operationalMessage: message || null,
          lastStatusUpdate: new Date().toISOString(),
        },
      },
    });

    // Store operational status in Redis for real-time monitoring
    const statusKey = `daemon:status:${token.vpId}`;
    const statusData = {
      status,
      message: message || null,
      updatedAt: new Date().toISOString(),
      daemonId: token.daemonId,
    };

    try {
      await redis.setex(
        statusKey,
        10 * 60, // 10 minutes TTL
        JSON.stringify(statusData)
      );

      // Publish status update for monitoring dashboards
      await redis.publish(
        `daemon:status:updates:${vp.organizationId}`,
        JSON.stringify({
          type: 'vp_status_update',
          vpId: token.vpId,
          ...statusData,
        })
      );
    } catch (redisError) {
      console.error('Redis status update error:', redisError);
      // Continue without Redis - database is updated
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/daemon/status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update status', code: STATUS_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
