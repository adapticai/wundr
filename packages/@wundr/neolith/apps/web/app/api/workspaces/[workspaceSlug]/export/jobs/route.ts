/**
 * Export Jobs List API Endpoint
 *
 * Provides list of all export jobs for a workspace.
 *
 * GET /api/workspaces/[workspaceId]/export/jobs
 *   - List all export jobs with optional filtering
 *   - Query params: status, limit, offset
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

import type { NextRequest } from 'next/server';

/**
 * GET - List export jobs for workspace
 *
 * Returns paginated list of export jobs with optional status filtering.
 * Query params:
 *   - status: Filter by job status (PENDING, PROCESSING, COMPLETED, FAILED)
 *   - limit: Number of jobs to return (default: 20, max: 100)
 *   - offset: Pagination offset (default: 0)
 *
 * @returns List of export jobs
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceSlug: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug: workspaceId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify workspace access
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Build where clause
    const where = {
      workspaceId,
      ...(status
        ? {
            status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
          }
        : {}),
    };

    // Fetch jobs with pagination
    const [jobs, total] = await Promise.all([
      prisma.exportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.exportJob.count({ where }),
    ]);

    // Format jobs for response
    const formattedJobs = jobs.map(job => {
      let duration: number | null = null;
      if (job.startedAt && job.completedAt) {
        duration = Math.floor(
          (job.completedAt.getTime() - job.startedAt.getTime()) / 1000
        );
      }

      return {
        id: job.id,
        type: job.type,
        format: job.format,
        status: job.status,
        progress: job.progress,
        recordCount: job.recordCount,
        fileSize: job.fileSize ? Number(job.fileSize) : null,
        fileUrl: job.fileUrl,
        error: job.error,
        dateRange: {
          from: job.startDate?.toISOString(),
          to: job.endDate?.toISOString(),
        },
        requestedBy: job.requestedBy,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        duration,
      };
    });

    return NextResponse.json({
      jobs: formattedJobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Export jobs list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export jobs' },
      { status: 500 }
    );
  }
}
