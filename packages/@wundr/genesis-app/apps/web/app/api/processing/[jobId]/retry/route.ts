/**
 * Processing Job Retry API Route
 *
 * Handles retrying failed processing jobs.
 *
 * Routes:
 * - POST /api/processing/:jobId/retry - Retry a failed job
 *
 * @module app/api/processing/[jobId]/retry/route
 */

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  jobIdParamSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
} from '@/lib/validations/processing';

import { processingJobs } from '../../route';

import type { NextRequest } from 'next/server';

/**
 * Route context with job ID parameter
 */
interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/processing/:jobId/retry
 *
 * Retry a failed processing job. Only failed jobs can be retried.
 * Creates a new job based on the original job configuration.
 *
 * @param _request - Next.js request object
 * @param context - Route context with job ID
 * @returns New job details
 *
 * @example
 * ```
 * POST /api/processing/job_abc123def456/retry
 * ```
 */
export async function POST(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Authentication required',
          PROCESSING_ERROR_CODES.UNAUTHORIZED,
        ),
        { status: 401 },
      );
    }

    // Validate job ID parameter
    const params = await context.params;
    const paramResult = jobIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid job ID format',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Find original job
    const originalJob = processingJobs.get(params.jobId);
    if (!originalJob) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Processing job not found',
          PROCESSING_ERROR_CODES.NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: originalJob.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Not a member of this workspace',
          PROCESSING_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Check if job can be retried (only failed or cancelled jobs)
    if (originalJob.status !== 'failed' && originalJob.status !== 'cancelled') {
      return NextResponse.json(
        createProcessingErrorResponse(
          `Cannot retry a job with status '${originalJob.status}'. Only failed or cancelled jobs can be retried.`,
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Verify the file still exists
    const file = await prisma.file.findUnique({
      where: { id: originalJob.fileId },
      select: { id: true, status: true },
    });

    if (!file) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'The original file no longer exists',
          PROCESSING_ERROR_CODES.FILE_NOT_FOUND,
        ),
        { status: 404 },
      );
    }

    // Create new job ID
    const crypto = await import('crypto');
    const newJobId = `job_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    // Create new job based on original
    const newJob = {
      id: newJobId,
      fileId: originalJob.fileId,
      type: originalJob.type,
      status: 'pending',
      priority: originalJob.priority,
      progress: 0,
      options: originalJob.options,
      result: null,
      error: null,
      workspaceId: originalJob.workspaceId,
      createdById: session.user.id,
      callbackUrl: originalJob.callbackUrl,
      metadata: {
        ...originalJob.metadata,
        retriedFrom: originalJob.id,
        retryCount: ((originalJob.metadata?.retryCount as number) ?? 0) + 1,
      },
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store new job
    processingJobs.set(newJobId, newJob);

    // Update original job to mark it as retried
    originalJob.metadata = {
      ...originalJob.metadata,
      retriedAs: newJobId,
    };
    originalJob.updatedAt = now;

    // Simulate job being queued
    setTimeout(() => {
      const storedJob = processingJobs.get(newJobId);
      if (storedJob && storedJob.status === 'pending') {
        storedJob.status = 'queued';
        storedJob.updatedAt = new Date();
      }
    }, 100);

    return NextResponse.json(
      {
        data: {
          jobId: newJob.id,
          originalJobId: originalJob.id,
          fileId: newJob.fileId,
          type: newJob.type,
          status: newJob.status,
          priority: newJob.priority,
          retryCount: newJob.metadata?.retryCount ?? 1,
          createdAt: newJob.createdAt.toISOString(),
        },
        message: 'Processing job retried successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/processing/:jobId/retry] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
