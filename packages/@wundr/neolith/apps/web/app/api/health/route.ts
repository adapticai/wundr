import { NextResponse } from 'next/server';

/**
 * Health check endpoint for deployment platforms
 * Used by Railway, Netlify, and load balancers to verify application health
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database?: 'ok' | 'error';
    memory?: 'ok' | 'warning' | 'error';
  };
}

const startTime = Date.now();

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const now = new Date();
  const uptimeMs = Date.now() - startTime;

  // Basic health checks
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercent = (heapUsedMB / heapTotalMB) * 100;

  // Determine memory status
  let memoryStatus: 'ok' | 'warning' | 'error' = 'ok';
  if (memoryPercent > 90) {
    memoryStatus = 'error';
  } else if (memoryPercent > 75) {
    memoryStatus = 'warning';
  }

  // Overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (memoryStatus === 'error') {
    status = 'unhealthy';
  } else if (memoryStatus === 'warning') {
    status = 'degraded';
  }

  const healthResponse: HealthStatus = {
    status,
    version: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',
    timestamp: now.toISOString(),
    uptime: Math.round(uptimeMs / 1000),
    checks: {
      memory: memoryStatus,
    },
  };

  // Return appropriate status code
  const statusCode =
    status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return NextResponse.json(healthResponse, { status: statusCode });
}
