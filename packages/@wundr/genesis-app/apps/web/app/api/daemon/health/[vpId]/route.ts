/**
 * Daemon Health API Route
 *
 * Handles health status queries for VP daemons.
 * Integrates with the HeartbeatService to provide real health data.
 *
 * Routes:
 * - GET /api/daemon/health/[vpId] - Get VP health status
 *
 * @module app/api/daemon/health/[vpId]/route
 */

import { createHeartbeatService, getRedisClient, type HeartbeatMetrics, type RedisClient } from '@genesis/core';
import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * Creates a RedisClient adapter from the ioredis instance.
 * This wraps the raw Redis client to match the RedisClient interface.
 */
function createRedisClientAdapter(rawRedis: ReturnType<typeof getRedisClient>): RedisClient {
  return {
    async get(key: string) {
      return rawRedis.get(key);
    },
    async set(key: string, value: string, options?: { EX?: number }) {
      if (options?.EX) {
        await rawRedis.set(key, value, 'EX', options.EX);
      } else {
        await rawRedis.set(key, value);
      }
    },
    async del(key: string) {
      await rawRedis.del(key);
    },
    async hset(key: string, field: string, value: string) {
      await rawRedis.hset(key, field, value);
    },
    async hget(key: string, field: string) {
      return rawRedis.hget(key, field);
    },
    async hgetall(key: string) {
      const result = await rawRedis.hgetall(key);
      return Object.keys(result).length > 0 ? result : null;
    },
    async hdel(key: string, field: string) {
      await rawRedis.hdel(key, field);
    },
    async sadd(key: string, member: string) {
      await rawRedis.sadd(key, member);
    },
    async srem(key: string, member: string) {
      await rawRedis.srem(key, member);
    },
    async smembers(key: string) {
      return rawRedis.smembers(key);
    },
    async zadd(key: string, score: number, member: string) {
      await rawRedis.zadd(key, score, member);
    },
    async zrange(key: string, start: number, stop: number) {
      return rawRedis.zrange(key, start, stop);
    },
    async zrangebyscore(key: string, min: number | string, max: number | string) {
      return rawRedis.zrangebyscore(key, min, max);
    },
    async zremrangebyrank(key: string, start: number, stop: number) {
      await rawRedis.zremrangebyrank(key, start, stop);
    },
    async expire(key: string, seconds: number) {
      await rawRedis.expire(key, seconds);
    },
    async exists(key: string) {
      return rawRedis.exists(key);
    },
  };
}

// =============================================================================
// Error Codes
// =============================================================================

const HEALTH_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  VP_NOT_FOUND: 'VP_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Generate human-readable health status description.
 *
 * @param status - The health status type
 * @returns Human-readable description of the health status
 */
function getHealthDetailsFromStatus(status: string): string {
  switch (status) {
    case 'healthy':
      return 'VP daemon is operating normally';
    case 'degraded':
      return 'VP daemon is experiencing performance issues';
    case 'unhealthy':
      return 'VP daemon is not responding - consecutive missed heartbeats';
    case 'recovering':
      return 'VP daemon is recovering from unhealthy state';
    case 'unknown':
    default:
      return 'VP daemon status is unknown';
  }
}

/**
 * Creates a standardized error response.
 */
function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return {
    error: {
      message,
      code,
      ...(details && { details }),
    },
  };
}

// =============================================================================
// Route Handler
// =============================================================================

/**
 * GET /api/daemon/health/[vpId]
 *
 * Gets the health status of a VP daemon.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request
 * @param params - Route parameters containing vpId
 * @returns VP health status or error
 *
 * @example
 * ```
 * GET /api/daemon/health/vp_123
 *
 * Response:
 * {
 *   "data": {
 *     "vpId": "vp_123",
 *     "healthy": true,
 *     "status": "healthy",
 *     "lastHeartbeat": "2024-01-01T12:00:00Z",
 *     "missedHeartbeats": 0,
 *     "details": "VP daemon is operating normally",
 *     "metrics": {
 *       "cpuUsage": 45,
 *       "memoryUsage": 60,
 *       "activeConnections": 10,
 *       "messageQueueSize": 5
 *     }
 *   }
 * }
 * ```
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vpId: string }> },
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', HEALTH_ERROR_CODES.UNAUTHORIZED),
        { status: 401 },
      );
    }

    const { vpId } = await params;

    // Get VP to verify it exists and get organization
    const vp = await prisma.vP.findUnique({
      where: { id: vpId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!vp) {
      return NextResponse.json(
        createErrorResponse('VP not found', HEALTH_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: vp.organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this VP',
          HEALTH_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get Redis client and heartbeat service for real health data
    let healthData: {
      vpId: string;
      healthy: boolean;
      status: string;
      lastHeartbeat: string | null;
      missedHeartbeats: number;
      details: string;
      metrics: HeartbeatMetrics | null;
      daemonInfo: {
        instanceId: string;
        version: string;
        host: string;
        port: number;
        protocol: string;
        startedAt: string;
      } | null;
      vp: {
        id: string;
        status: string;
        discipline: string;
        role: string;
        user: typeof vp.user;
        organization: typeof vp.organization;
      };
    };

    try {
      const redis = getRedisClient();
      const redisClient = createRedisClientAdapter(redis);
      const heartbeatService = createHeartbeatService(redisClient);

      // Get health status from heartbeat service
      const health = await heartbeatService.checkHealth(vpId);
      const daemonInfo = await heartbeatService.getDaemonInfo(vpId);
      // Note: health.lastHeartbeat already contains the timestamp, so we don't need a separate call

      healthData = {
        vpId,
        healthy: health.healthy,
        status: health.status,
        lastHeartbeat: health.lastHeartbeat?.toISOString() ?? null,
        missedHeartbeats: health.missedHeartbeats,
        details: health.details ?? getHealthDetailsFromStatus(health.status),
        metrics: health.latestMetrics ?? null,
        daemonInfo: daemonInfo
          ? {
              instanceId: daemonInfo.instanceId,
              version: daemonInfo.version,
              host: daemonInfo.host,
              port: daemonInfo.port,
              protocol: daemonInfo.protocol,
              startedAt: daemonInfo.startedAt.toISOString(),
            }
          : null,
        vp: {
          id: vp.id,
          status: vp.status,
          discipline: vp.discipline,
          role: vp.role,
          user: vp.user,
          organization: vp.organization,
        },
      };
    } catch {
      // Fallback to VP status-based health when Redis is unavailable
      const isOnline = vp.status === 'ONLINE';
      healthData = {
        vpId,
        healthy: isOnline,
        status: isOnline ? 'healthy' : (vp.status === 'AWAY' ? 'degraded' : 'unknown'),
        lastHeartbeat: null,
        missedHeartbeats: isOnline ? 0 : -1,
        details: isOnline
          ? 'VP status is ONLINE (heartbeat service unavailable)'
          : vp.status === 'AWAY'
            ? 'VP status is AWAY (heartbeat service unavailable)'
            : 'VP status unknown - heartbeat service unavailable',
        metrics: null,
        daemonInfo: null,
        vp: {
          id: vp.id,
          status: vp.status,
          discipline: vp.discipline,
          role: vp.role,
          user: vp.user,
          organization: vp.organization,
        },
      };
    }

    return NextResponse.json({
      data: healthData,
    });
  } catch (error) {
    console.error('[GET /api/daemon/health/[vpId]] Error:', error);

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        HEALTH_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
