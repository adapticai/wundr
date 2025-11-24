/**
 * Daemon Heartbeat API Route
 *
 * Handles heartbeat signals and metrics reporting for VP daemon services.
 *
 * Routes:
 * - POST /api/daemon/heartbeat - Send heartbeat with optional metrics
 *
 * @module app/api/daemon/heartbeat/route
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
 * Heartbeat interval (ms) - daemon should send heartbeats at this interval
 */
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

/**
 * Heartbeat TTL (seconds) - how long until a daemon is considered offline
 */
const HEARTBEAT_TTL_SECONDS = 90; // 3 missed heartbeats

/**
 * Error codes for heartbeat operations
 */
const HEARTBEAT_ERROR_CODES = {
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
 * Daemon metrics structure
 */
interface DaemonMetrics {
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  activeConnections?: number;
  messagesProcessed?: number;
  errorsCount?: number;
  uptimeSeconds?: number;
  lastTaskCompletedAt?: string;
  queueDepth?: number;
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
 * POST /api/daemon/heartbeat - Send heartbeat with metrics
 *
 * Sends a heartbeat signal to indicate the daemon is alive.
 * Optionally includes performance metrics for monitoring.
 *
 * @param request - Next.js request with heartbeat data
 * @returns Server time and next expected heartbeat
 *
 * @example
 * ```
 * POST /api/daemon/heartbeat
 * Authorization: Bearer <access_token>
 * Content-Type: application/json
 *
 * {
 *   "sessionId": "daemon_session_vp123_1234567890",
 *   "status": "active",
 *   "metrics": {
 *     "memoryUsageMB": 256,
 *     "cpuUsagePercent": 15.5,
 *     "messagesProcessed": 42,
 *     "uptimeSeconds": 3600
 *   }
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    let token: AccessTokenPayload;
    try {
      token = await verifyDaemonToken(request);
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized', code: HEARTBEAT_ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // Heartbeat can be sent without body
      body = {};
    }

    const { sessionId, status = 'active', metrics } = body as {
      sessionId?: string;
      status?: 'active' | 'idle' | 'busy';
      metrics?: DaemonMetrics;
    };

    const now = new Date();
    const serverTime = now.toISOString();
    const nextHeartbeat = new Date(now.getTime() + HEARTBEAT_INTERVAL_MS).toISOString();

    // Get VP info
    const vp = await prisma.vP.findUnique({
      where: { id: token.vpId },
      select: {
        id: true,
        organizationId: true,
        status: true,
      },
    });

    if (!vp) {
      return NextResponse.json(
        { error: 'Unauthorized', code: HEARTBEAT_ERROR_CODES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // Update VP status
    const vpStatus = status === 'idle' ? 'AWAY' : status === 'busy' ? 'BUSY' : 'ONLINE';
    await prisma.vP.update({
      where: { id: token.vpId },
      data: {
        status: vpStatus,
      },
    });

    // Store heartbeat in Redis
    const heartbeatKey = `daemon:heartbeat:${token.vpId}`;
    const heartbeatData = {
      vpId: token.vpId,
      daemonId: token.daemonId,
      sessionId: sessionId || token.daemonId,
      status,
      metrics: metrics || {},
      receivedAt: serverTime,
      organizationId: vp.organizationId,
    };

    try {
      await redis.setex(
        heartbeatKey,
        HEARTBEAT_TTL_SECONDS,
        JSON.stringify(heartbeatData)
      );

      // Store metrics history (last 100 heartbeats)
      if (metrics) {
        const metricsKey = `daemon:metrics:${token.vpId}`;
        await redis.lpush(
          metricsKey,
          JSON.stringify({
            ...metrics,
            timestamp: serverTime,
          })
        );
        await redis.ltrim(metricsKey, 0, 99);
        await redis.expire(metricsKey, 24 * 60 * 60); // 24 hours
      }

      // Update session heartbeat
      if (sessionId) {
        const sessionKey = `daemon:session:${sessionId}`;
        const sessionStr = await redis.get(sessionKey);
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          await redis.setex(
            sessionKey,
            7 * 24 * 60 * 60, // 7 days
            JSON.stringify({
              ...session,
              lastHeartbeat: serverTime,
              lastStatus: status,
            })
          );
        }
      }

      // Publish heartbeat for monitoring
      await redis.publish(
        `daemon:heartbeats:${vp.organizationId}`,
        JSON.stringify({
          type: 'heartbeat',
          vpId: token.vpId,
          status,
          receivedAt: serverTime,
        })
      );
    } catch (redisError) {
      console.error('Redis heartbeat error:', redisError);
      // Continue - database update succeeded
    }

    return NextResponse.json({
      success: true,
      serverTime,
      nextHeartbeat,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    });
  } catch (error) {
    console.error('[POST /api/daemon/heartbeat] Error:', error);
    return NextResponse.json(
      { error: 'Heartbeat failed', code: HEARTBEAT_ERROR_CODES.INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
