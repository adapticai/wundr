/**
 * Processing Job Detail API Routes
 *
 * Handles retrieving and cancelling individual processing jobs.
 *
 * Routes:
 * - GET /api/processing/:jobId - Get job details
 * - DELETE /api/processing/:jobId - Cancel job
 *
 * @module app/api/processing/[jobId]/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  jobIdParamSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * Route context with job ID parameter
 */
interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/processing/:jobId
 *
 * Get details of a specific processing job.
 * Requires authentication and access to the job's workspace.
 *
 * @param _request - Next.js request object
 * @param context - Route context with job ID
 * @returns Job details including status, progress, and results
 *
 * @example
 * ```
 * GET /api/processing/job_abc123def456
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

    // Validate job ID parameter
    const params = await context.params;
    const paramResult = jobIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid job ID format',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Find job
    const job = processingJobs.get(params.jobId);
    if (!job) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Processing job not found',
          PROCESSING_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: job.workspaceId,
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

    // Get file details
    const file = await prisma.file.findUnique({
      where: { id: job.fileId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
      },
    });

    return NextResponse.json({
      data: {
        id: job.id,
        fileId: job.fileId,
        file: file
          ? {
              id: file.id,
              filename: file.filename,
              originalName: file.originalName,
              mimeType: file.mimeType,
              size: Number(file.size),
            }
          : null,
        type: job.type,
        status: job.status,
        priority: job.priority,
        progress: job.progress,
        options: job.options,
        result: job.result,
        error: job.error,
        metadata: job.metadata,
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
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
 * DELETE /api/processing/:jobId
 *
 * Cancel a processing job. Only pending or queued jobs can be cancelled.
 * Requires authentication and access to the job's workspace.
 *
 * @param _request - Next.js request object
 * @param context - Route context with job ID
 * @returns Cancellation confirmation
 *
 * @example
 * ```
 * DELETE /api/processing/job_abc123def456
 * ```
 */
export async function DELETE(
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

    // Validate job ID parameter
    const params = await context.params;
    const paramResult = jobIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid job ID format',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Find job
    const job = processingJobs.get(params.jobId);
    if (!job) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Processing job not found',
          PROCESSING_ERROR_CODES.NOT_FOUND
        ),
        { status: 404 }
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: job.workspaceId,
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

    // Check if job can be cancelled
    if (job.status === 'completed') {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Cannot cancel a completed job',
          PROCESSING_ERROR_CODES.JOB_ALREADY_COMPLETED
        ),
        { status: 400 }
      );
    }

    if (job.status === 'cancelled') {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Job is already cancelled',
          PROCESSING_ERROR_CODES.JOB_ALREADY_CANCELLED
        ),
        { status: 400 }
      );
    }

    if (job.status === 'processing') {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Cannot cancel a job that is currently processing',
          PROCESSING_ERROR_CODES.JOB_IN_PROGRESS
        ),
        { status: 400 }
      );
    }

    // Cancel the job
    job.status = 'cancelled';
    job.updatedAt = new Date();

    return NextResponse.json({
      data: {
        id: job.id,
        status: job.status,
        updatedAt: job.updatedAt.toISOString(),
      },
      message: 'Processing job cancelled successfully',
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
