/**
 * Processing Queue Statistics API Route
 *
 * Provides queue statistics and metrics for administrators.
 *
 * Routes:
 * - GET /api/processing/stats - Get queue statistics
 *
 * @module app/api/processing/stats/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * GET /api/processing/stats
 *
 * Get queue statistics including job counts by status,
 * average processing times, and throughput metrics.
 * Requires admin role for full statistics.
 *
 * @param _request - Next.js request object
 * @returns Queue statistics
 *
 * @example
 * ```
 * GET /api/processing/stats
 * ```
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Authentication required',
          PROCESSING_ERROR_CODES.UNAUTHORIZED
        ),
        { status: 401 }
      );
    }

    // Check if user is an admin (in at least one organization)
    const adminMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['ADMIN', 'OWNER'] },
      },
    });

    const isAdmin = !!adminMembership;

    // Get user's accessible workspaces for filtering
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    const accessibleWorkspaceIds = new Set(
      userWorkspaces.map(w => w.workspaceId)
    );

    // Get all jobs (or filter by workspace for non-admins)
    const allJobs = Array.from(processingJobs.values());
    const relevantJobs = isAdmin
      ? allJobs
      : allJobs.filter(job => accessibleWorkspaceIds.has(job.workspaceId));

    // Calculate statistics
    const pending = relevantJobs.filter(j => j.status === 'pending').length;
    const queued = relevantJobs.filter(j => j.status === 'queued').length;
    const processing = relevantJobs.filter(
      j => j.status === 'processing'
    ).length;
    const completed = relevantJobs.filter(j => j.status === 'completed').length;
    const failed = relevantJobs.filter(j => j.status === 'failed').length;
    const cancelled = relevantJobs.filter(j => j.status === 'cancelled').length;

    // Calculate average processing time for completed jobs
    const completedJobs = relevantJobs.filter(
      j => j.status === 'completed' && j.startedAt && j.completedAt
    );
    const avgProcessingTime =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, job) => {
            const duration =
              job.completedAt!.getTime() - job.startedAt!.getTime();
            return sum + duration;
          }, 0) / completedJobs.length
        : 0;

    // Calculate throughput (jobs completed in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCompleted = relevantJobs.filter(
      j =>
        j.status === 'completed' && j.completedAt && j.completedAt >= oneHourAgo
    ).length;

    // Find oldest pending job
    const pendingJobs = relevantJobs
      .filter(j => j.status === 'pending' || j.status === 'queued')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const oldestPendingJob =
      pendingJobs.length > 0 ? pendingJobs[0].createdAt : null;

    // Calculate job distribution by type
    const jobsByType: Record<string, number> = {};
    for (const job of relevantJobs) {
      jobsByType[job.type] = (jobsByType[job.type] ?? 0) + 1;
    }

    // Calculate job distribution by priority
    const jobsByPriority: Record<string, number> = {};
    for (const job of relevantJobs) {
      jobsByPriority[job.priority] = (jobsByPriority[job.priority] ?? 0) + 1;
    }

    // Calculate success rate
    const totalFinished = completed + failed;
    const successRate =
      totalFinished > 0 ? (completed / totalFinished) * 100 : 100;

    // Build response
    const stats = {
      counts: {
        pending,
        queued,
        processing,
        completed,
        failed,
        cancelled,
        total: relevantJobs.length,
      },
      metrics: {
        avgProcessingTime: Math.round(avgProcessingTime),
        avgProcessingTimeFormatted: formatDuration(avgProcessingTime),
        throughputPerHour: recentCompleted,
        successRate: Math.round(successRate * 100) / 100,
        oldestPendingJob: oldestPendingJob?.toISOString() ?? null,
        oldestPendingAge: oldestPendingJob
          ? Date.now() - oldestPendingJob.getTime()
          : null,
      },
      distribution: {
        byType: jobsByType,
        byPriority: jobsByPriority,
      },
      queueHealth: {
        status: getQueueHealthStatus(pending, queued, processing, failed),
        activeWorkers: processing,
        queueDepth: pending + queued,
        backlogAge: oldestPendingJob
          ? Math.round((Date.now() - oldestPendingJob.getTime()) / 1000)
          : 0,
      },
    };

    // Add admin-only stats
    const adminStats = isAdmin
      ? {
          global: {
            totalJobs: allJobs.length,
            totalWorkspaces: new Set(allJobs.map(j => j.workspaceId)).size,
            totalUsers: new Set(allJobs.map(j => j.createdById)).size,
          },
        }
      : null;

    return NextResponse.json({
      data: {
        ...stats,
        ...(adminStats && { admin: adminStats }),
      },
      meta: {
        isAdmin,
        scope: isAdmin ? 'global' : 'user-workspaces',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

/**
 * Format duration in milliseconds to human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Determine queue health status based on metrics
 *
 * @param pending - Number of pending jobs
 * @param queued - Number of queued jobs
 * @param processing - Number of processing jobs
 * @param failed - Number of failed jobs
 * @returns Health status string
 */
function getQueueHealthStatus(
  pending: number,
  queued: number,
  processing: number,
  failed: number
): 'healthy' | 'degraded' | 'critical' {
  const backlog = pending + queued;
  const failureRate = (failed / (processing + failed + 1)) * 100;

  if (backlog > 1000 || failureRate > 50) {
    return 'critical';
  }
  if (backlog > 100 || failureRate > 20) {
    return 'degraded';
  }
  return 'healthy';
}
