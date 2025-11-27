/**
 * Daemon Health API Route
 *
 * Handles health status queries for Orchestrator daemons.
 * Integrates with the HeartbeatService to provide real health data.
 *
 * Routes:
 * - GET /api/daemon/health/[orchestratorId] - Get Orchestrator health status
 *
 * @module app/api/daemon/health/[orchestratorId]/route
 */

import { createHeartbeatService, getRedisClient, type HeartbeatMetrics, type RedisClient } from '@neolith/core';
import { prisma } from '@neolith/database';
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
      return 'Orchestrator daemon is operating normally';
    case 'degraded':
      return 'Orchestrator daemon is experiencing performance issues';
    case 'unhealthy':
      return 'Orchestrator daemon is not responding - consecutive missed heartbeats';
    case 'recovering':
      return 'Orchestrator daemon is recovering from unhealthy state';
    case 'unknown':
    default:
      return 'Orchestrator daemon status is unknown';
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
 * GET /api/daemon/health/[orchestratorId]
 *
 * Gets the health status of a Orchestrator daemon.
 * Requires authentication and organization membership.
 *
 * @param request - Next.js request
 * @param params - Route parameters containing orchestratorId
 * @returns Orchestrator health status or error
 *
 * @example
 * ```
 * GET /api/daemon/health/vp_123
 *
 * Response:
 * {
 *   "data": {
 *     "orchestratorId": "vp_123",
 *     "healthy": true,
 *     "status": "healthy",
 *     "lastHeartbeat": "2024-01-01T12:00:00Z",
 *     "missedHeartbeats": 0,
 *     "details": "Orchestrator daemon is operating normally",
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
  { params }: { params: Promise<{ orchestratorId: string }> },
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

    const { orchestratorId } = await params;

    // Get Orchestrator to verify it exists and get organization
    const orchestrator = await prisma.vP.findUnique({
      where: { id: orchestratorId },
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

    if (!orchestrator) {
      return NextResponse.json(
        createErrorResponse('Orchestrator not found', HEALTH_ERROR_CODES.VP_NOT_FOUND),
        { status: 404 },
      );
    }

    // Check user has access to the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: orchestrator.organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        createErrorResponse(
          'Access denied to this Orchestrator',
          HEALTH_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    // Get Redis client and heartbeat service for real health data
    let healthData: {
      orchestratorId: string;
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
      orchestrator: {
        id: string;
        status: string;
        discipline: string;
        role: string;
        user: typeof orchestrator.user;
        organization: typeof orchestrator.organization;
      };
    };

    try {
      const redis = getRedisClient();
      const redisClient = createRedisClientAdapter(redis);
      const heartbeatService = createHeartbeatService(redisClient);

      // Get health status from heartbeat service
      const health = await heartbeatService.checkHealth(orchestratorId);
      const daemonInfo = await heartbeatService.getDaemonInfo(orchestratorId);
      // Note: health.lastHeartbeat already contains the timestamp, so we don't need a separate call

      healthData = {
        orchestratorId,
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
        orchestrator: {
          id: orchestrator.id,
          status: orchestrator.status,
          discipline: orchestrator.discipline ?? '',
          role: orchestrator.role,
          user: orchestrator.user,
          organization: orchestrator.organization,
        },
      };
    } catch {
      // Fallback to Orchestrator status-based health when Redis is unavailable
      const isOnline = orchestrator.status === 'ONLINE';
      healthData = {
        orchestratorId,
        healthy: isOnline,
        status: isOnline ? 'healthy' : (orchestrator.status === 'AWAY' ? 'degraded' : 'unknown'),
        lastHeartbeat: null,
        missedHeartbeats: isOnline ? 0 : -1,
        details: isOnline
          ? 'Orchestrator status is ONLINE (heartbeat service unavailable)'
          : orchestrator.status === 'AWAY'
            ? 'Orchestrator status is AWAY (heartbeat service unavailable)'
            : 'Orchestrator status unknown - heartbeat service unavailable',
        metrics: null,
        daemonInfo: null,
        orchestrator: {
          id: orchestrator.id,
          status: orchestrator.status,
          discipline: orchestrator.discipline ?? '',
          role: orchestrator.role,
          user: orchestrator.user,
          organization: orchestrator.organization,
        },
      };
    }

    return NextResponse.json({
      data: healthData,
    });
  } catch (error) {
    console.error('[GET /api/daemon/health/[orchestratorId]] Error:', error);

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        HEALTH_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
