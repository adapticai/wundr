/**
 * Batch Processing API Route
 *
 * Handles creating multiple processing jobs at once.
 *
 * Routes:
 * - POST /api/processing/batch - Create batch processing jobs
 *
 * @module app/api/processing/batch/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  batchProcessingSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
  supportsTextExtraction,
  supportsOCR,
  supportsConversion,
} from '@/lib/validations/processing';

import type { BatchProcessingInput } from '@/lib/validations/processing';
import type { NextRequest } from 'next/server';

/**
 * Check if processing type is supported for the given file
 *
 * @param type - Processing type
 * @param mimeType - File MIME type
 * @returns True if processing type is supported
 */
function isProcessingSupported(type: string, mimeType: string): boolean {
  switch (type) {
    case 'text-extraction':
    case 'metadata-extraction':
      return supportsTextExtraction(mimeType);
    case 'ocr':
      return supportsOCR(mimeType);
    case 'document-conversion':
      return supportsConversion(mimeType);
    case 'thumbnail':
      return mimeType.startsWith('image/') || mimeType === 'application/pdf';
    case 'virus-scan':
    case 'image-optimization':
      return true;
    default:
      return false;
  }
}

/**
 * POST /api/processing/batch
 *
 * Create multiple processing jobs for a batch of files.
 * All files must be accessible to the user and support the requested processing type.
 *
 * @param request - Next.js request with batch job data
 * @returns Array of created job details
 *
 * @example
 * ```
 * POST /api/processing/batch
 * Content-Type: application/json
 *
 * {
 *   "fileIds": ["clm123...", "clm456...", "clm789..."],
 *   "type": "text-extraction",
 *   "priority": "high"
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid JSON body',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const parseResult = batchProcessingSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid request body',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const input: BatchProcessingInput = parseResult.data;

    // Get user's accessible workspaces
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    const accessibleWorkspaceIds = new Set(userWorkspaces.map((w) => w.workspaceId));

    // Fetch all files and verify access
    const files = await prisma.file.findMany({
      where: { id: { in: input.fileIds } },
      select: {
        id: true,
        workspaceId: true,
        mimeType: true,
        filename: true,
        originalName: true,
      },
    });

    // Track results for each file
    const results: Array<{
      fileId: string;
      jobId?: string;
      status: 'created' | 'skipped' | 'error';
      error?: string;
    }> = [];

    const createdJobs: Array<{
      id: string;
      fileId: string;
      type: string;
      status: string;
      priority: string;
      createdAt: string;
    }> = [];

    const now = new Date();

    for (const fileId of input.fileIds) {
      const file = files.find((f) => f.id === fileId);

      // Check if file exists
      if (!file) {
        results.push({
          fileId,
          status: 'error',
          error: 'File not found',
        });
        continue;
      }

      // Check workspace access
      if (!accessibleWorkspaceIds.has(file.workspaceId)) {
        results.push({
          fileId,
          status: 'error',
          error: 'Not a member of the file workspace',
        });
        continue;
      }

      // Check if processing type is supported
      if (!isProcessingSupported(input.type, file.mimeType)) {
        results.push({
          fileId,
          status: 'skipped',
          error: `Processing type '${input.type}' not supported for file type '${file.mimeType}'`,
        });
        continue;
      }

      // Create processing job
      const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;

      const job = {
        id: jobId,
        fileId: file.id,
        type: input.type,
        status: 'pending',
        priority: input.priority ?? 'normal',
        progress: 0,
        options: input.options ?? null,
        result: null,
        error: null,
        workspaceId: file.workspaceId,
        createdById: session.user.id,
        callbackUrl: input.callbackUrl ?? null,
        metadata: {
          batchJob: true,
          batchSize: input.fileIds.length,
        },
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      // Store job
      processingJobs.set(jobId, job);

      results.push({
        fileId,
        jobId,
        status: 'created',
      });

      createdJobs.push({
        id: jobId,
        fileId: file.id,
        type: input.type,
        status: 'pending',
        priority: job.priority,
        createdAt: now.toISOString(),
      });
    }

    // Simulate jobs being queued
    setTimeout(() => {
      for (const job of createdJobs) {
        const storedJob = processingJobs.get(job.id);
        if (storedJob && storedJob.status === 'pending') {
          storedJob.status = 'queued';
          storedJob.updatedAt = new Date();
        }
      }
    }, 100);

    const successCount = results.filter((r) => r.status === 'created').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json(
      {
        data: {
          jobs: createdJobs,
          results,
          summary: {
            total: input.fileIds.length,
            created: successCount,
            skipped: skippedCount,
            errors: errorCount,
          },
        },
        message: `Batch processing initiated: ${successCount} jobs created, ${skippedCount} skipped, ${errorCount} errors`,
      },
      { status: 201 },
    );
  } catch (_error) {
    // Error handling - details in response
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
