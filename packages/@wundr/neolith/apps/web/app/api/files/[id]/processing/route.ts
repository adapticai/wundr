/**
 * File Processing Status API Route
 *
 * Returns processing history and current status for a file.
 *
 * Routes:
 * - GET /api/files/:id/processing - Get processing status and history
 *
 * @module app/api/files/[id]/processing/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  fileIdParamSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/files/:id/processing
 *
 * Get processing history and current status for a file.
 * Returns all processing jobs associated with the file.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns Processing history and current status
 *
 * @example
 * ```
 * GET /api/files/clm123.../processing
 * ```
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    // Validate file ID parameter
    const params = await context.params;
    const paramResult = fileIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid file ID format',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Fetch the file
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        status: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'File not found',
          PROCESSING_ERROR_CODES.FILE_NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: file.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Not a member of this workspace',
          PROCESSING_ERROR_CODES.NOT_WORKSPACE_MEMBER
        ),
        { status: 403 }
      );
    }

    // Get all processing jobs for this file
    const fileJobs = Array.from(processingJobs.values())
      .filter(job => job.fileId === params.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Calculate summary statistics
    const jobsByType: Record<string, number> = {};
    const jobsByStatus: Record<string, number> = {};
    let totalProcessingTime = 0;
    let completedJobsWithTime = 0;

    for (const job of fileJobs) {
      jobsByType[job.type] = (jobsByType[job.type] ?? 0) + 1;
      jobsByStatus[job.status] = (jobsByStatus[job.status] ?? 0) + 1;

      if (job.status === 'completed' && job.startedAt && job.completedAt) {
        totalProcessingTime +=
          job.completedAt.getTime() - job.startedAt.getTime();
        completedJobsWithTime++;
      }
    }

    // Find currently active job (if any)
    const activeJob = fileJobs.find(
      job =>
        job.status === 'pending' ||
        job.status === 'queued' ||
        job.status === 'processing'
    );

    // Get most recent completed jobs by type
    const completedByType: Record<
      string,
      {
        jobId: string;
        completedAt: string;
        hasResult: boolean;
      }
    > = {};

    for (const job of fileJobs) {
      if (job.status === 'completed' && !completedByType[job.type]) {
        completedByType[job.type] = {
          jobId: job.id,
          completedAt: job.completedAt?.toISOString() ?? '',
          hasResult: !!job.result,
        };
      }
    }

    // Transform jobs for response
    const transformedJobs = fileJobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      duration:
        job.startedAt && job.completedAt
          ? job.completedAt.getTime() - job.startedAt.getTime()
          : null,
    }));

    return NextResponse.json({
      data: {
        file: {
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: Number(file.size),
          status: file.status,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
        },
        currentStatus: {
          isProcessing: !!activeJob,
          activeJob: activeJob
            ? {
                id: activeJob.id,
                type: activeJob.type,
                status: activeJob.status,
                progress: activeJob.progress,
                startedAt: activeJob.startedAt?.toISOString() ?? null,
              }
            : null,
        },
        summary: {
          totalJobs: fileJobs.length,
          jobsByType,
          jobsByStatus,
          avgProcessingTime:
            completedJobsWithTime > 0
              ? Math.round(totalProcessingTime / completedJobsWithTime)
              : null,
          completedByType,
        },
        history: transformedJobs,
      },
    });
  } catch (error) {
    console.error('[GET /api/files/:id/processing] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
