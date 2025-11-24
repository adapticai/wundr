/**
 * Daemon Health API Route
 *
 * Handles health status queries for VP daemons.
 *
 * Routes:
 * - GET /api/daemon/health/[vpId] - Get VP health status
 *
 * @module app/api/daemon/health/[vpId]/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

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
 * Creates a standardized error response.
 */
function createErrorResponse(
  message: string,
  code: string,
  details?: Record<string, unknown>
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
  request: NextRequest,
  { params }: { params: Promise<{ vpId: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Authentication required', HEALTH_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
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
        { status: 404 }
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
          HEALTH_ERROR_CODES.FORBIDDEN
        ),
        { status: 403 }
      );
    }

    // TODO: Get Redis client and heartbeat service
    // const redis = getRedisClient();
    // const heartbeatService = createHeartbeatService(redis);
    // const health = await heartbeatService.checkHealth(vpId);
    // const daemonInfo = await heartbeatService.getDaemonInfo(vpId);
    // const lastHeartbeat = await heartbeatService.getLastHeartbeat(vpId);

    // For now, return mock health status based on VP status
    const isOnline = vp.status === 'ONLINE';
    const mockHealth = {
      vpId,
      healthy: isOnline,
      status: isOnline ? 'healthy' : (vp.status === 'AWAY' ? 'degraded' : 'unknown'),
      lastHeartbeat: isOnline ? new Date().toISOString() : null,
      missedHeartbeats: isOnline ? 0 : (vp.status === 'AWAY' ? 2 : -1),
      details: isOnline
        ? 'VP daemon is operating normally'
        : vp.status === 'AWAY'
          ? 'VP daemon is experiencing delays'
          : 'VP daemon status is unknown - no heartbeat data',
      metrics: isOnline
        ? {
            cpuUsage: Math.floor(Math.random() * 50) + 10,
            memoryUsage: Math.floor(Math.random() * 40) + 20,
            activeConnections: Math.floor(Math.random() * 20),
            messageQueueSize: Math.floor(Math.random() * 10),
          }
        : null,
      daemonInfo: isOnline
        ? {
            instanceId: `daemon_${vpId.slice(-6)}`,
            version: '1.0.0',
            host: 'localhost',
            port: 8080,
            protocol: 'http',
            startedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
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

    return NextResponse.json({
      data: mockHealth,
    });
  } catch (error) {
    console.error('[GET /api/daemon/health/[vpId]] Error:', error);

    return NextResponse.json(
      createErrorResponse(
        'An internal error occurred',
        HEALTH_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
