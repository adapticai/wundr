/**
 * Admin System Health API Routes
 *
 * Provides system health status for the workspace.
 *
 * Routes:
 * - GET /api/workspaces/:workspaceSlug/admin/health - Get system health status
 *
 * @module app/api/workspaces/[workspaceSlug]/admin/health/route
 */

import { redis } from '@neolith/core/redis';
import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createAdminErrorResponse,
  ADMIN_ERROR_CODES,
} from '@/lib/validations/admin';

import type { NextRequest } from 'next/server';

/**
 * Route context with workspace slug parameter
 */
interface RouteContext {
  params: Promise<{ workspaceSlug: string }>;
}

/**
 * Service health status
 */
type HealthStatus = 'healthy' | 'degraded' | 'down';

/**
 * Service health check result
 */
interface ServiceHealth {
  status: HealthStatus;
  latency?: number;
  error?: string;
  lastChecked: Date;
}

/**
 * System health response
 */
interface SystemHealth {
  status: HealthStatus;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    storage: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
  uptime: number;
  version: string;
  timestamp: Date;
}

/**
 * GET /api/workspaces/:workspaceSlug/admin/health
 *
 * Get system health status. Requires admin or owner role.
 *
 * @param request - Next.js request
 * @param context - Route context containing workspace slug
 * @returns System health status
 *
 * @example
 * ```
 * GET /api/workspaces/my-workspace/admin/health
 * ```
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Unauthorized',
          ADMIN_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    const { workspaceSlug } = await context.params;

    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Workspace not found',
          ADMIN_ERROR_CODES.WORKSPACE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId: workspace.id, userId: session.user.id },
    });

    if (
      !membership ||
      !['ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        createAdminErrorResponse(
          'Admin access required',
          ADMIN_ERROR_CODES.FORBIDDEN,
        ),
        { status: 403 },
      );
    }

    const now = new Date();

    // Check database health
    const dbStartTime = Date.now();
    let databaseHealth: ServiceHealth;
    try {
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStartTime;
      databaseHealth = {
        status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'down',
        latency: dbLatency,
        lastChecked: now,
      };
    } catch (error) {
      databaseHealth = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: now,
      };
    }

    // Check Redis health
    const redisStartTime = Date.now();
    let redisHealth: ServiceHealth;
    try {
      await redis.ping();
      const redisLatency = Date.now() - redisStartTime;
      redisHealth = {
        status: redisLatency < 50 ? 'healthy' : redisLatency < 200 ? 'degraded' : 'down',
        latency: redisLatency,
        lastChecked: now,
      };
    } catch (error) {
      redisHealth = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: now,
      };
    }

    // Check storage health
    let storageHealth: ServiceHealth;
    try {
      const storageAggregate = await prisma.file.aggregate({
        where: { workspaceId: workspace.id },
        _sum: { size: true },
      });
      const storageUsed = Number(storageAggregate._sum.size || 0);
      const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB
      const storagePercentage = (storageUsed / storageLimit) * 100;

      storageHealth = {
        status: storagePercentage < 80 ? 'healthy' : storagePercentage < 95 ? 'degraded' : 'down',
        lastChecked: now,
      };
    } catch (error) {
      storageHealth = {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: now,
      };
    }

    // Determine overall status
    const overallStatus: HealthStatus =
      databaseHealth.status === 'down' || redisHealth.status === 'down' || storageHealth.status === 'down'
        ? 'down'
        : databaseHealth.status === 'degraded' || redisHealth.status === 'degraded' || storageHealth.status === 'degraded'
        ? 'degraded'
        : 'healthy';

    // Get resource usage
    const memUsage = process.memoryUsage();
    const memTotal = memUsage.heapTotal;
    const memUsed = memUsage.heapUsed;
    const memPercentage = (memUsed / memTotal) * 100;

    // Get storage usage
    const storageAggregate = await prisma.file.aggregate({
      where: { workspaceId: workspace.id },
      _sum: { size: true },
    });
    const storageUsed = Number(storageAggregate._sum.size || 0);
    const storageLimit = 10 * 1024 * 1024 * 1024; // 10GB
    const storagePercentage = (storageUsed / storageLimit) * 100;

    // Get uptime (process uptime in seconds)
    const uptime = process.uptime();

    const health: SystemHealth = {
      status: overallStatus,
      services: {
        database: databaseHealth,
        redis: redisHealth,
        storage: storageHealth,
      },
      resources: {
        memory: {
          used: memUsed,
          total: memTotal,
          percentage: Math.round(memPercentage * 100) / 100,
        },
        storage: {
          used: storageUsed,
          limit: storageLimit,
          percentage: Math.round(storagePercentage * 100) / 100,
        },
      },
      uptime: Math.round(uptime),
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: now,
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error(
      '[GET /api/workspaces/:workspaceSlug/admin/health] Error:',
      error,
    );
    return NextResponse.json(
      createAdminErrorResponse(
        'Failed to check system health',
        ADMIN_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
