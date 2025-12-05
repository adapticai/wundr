/**
 * Text Extraction API Route
 *
 * Triggers text extraction processing for a file.
 *
 * Routes:
 * - POST /api/files/:id/extract - Trigger text extraction job
 *
 * @module app/api/files/[id]/extract/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  fileIdParamSchema,
  extractOptionsSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
  supportsTextExtraction,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/files/:id/extract
 *
 * Trigger text extraction for a file. Extracts text content,
 * optionally including tables and metadata.
 *
 * @param request - Next.js request with extraction options
 * @param context - Route context with file ID
 * @returns Job ID and status
 *
 * @example
 * ```
 * POST /api/files/clm123.../extract
 * Content-Type: application/json
 *
 * {
 *   "includeMetadata": true,
 *   "extractTables": true,
 *   "outputFormat": "json"
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
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

    // Parse and validate request body (optional)
    let options = {};
    try {
      const body = await request.json();
      const optionsResult = extractOptionsSchema.safeParse(body);
      if (optionsResult.success) {
        options = optionsResult.data;
      }
    } catch {
      // Empty body is valid, use defaults
    }

    // Fetch the file
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
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

    // Check if file type supports text extraction
    if (!supportsTextExtraction(file.mimeType)) {
      return NextResponse.json(
        createProcessingErrorResponse(
          `Text extraction is not supported for file type '${file.mimeType}'`,
          PROCESSING_ERROR_CODES.UNSUPPORTED_FILE_TYPE
        ),
        { status: 400 }
      );
    }

    // Check if file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createProcessingErrorResponse(
          `File is not ready for processing. Current status: ${file.status}`,
          PROCESSING_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    // Create processing job
    const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    const job = {
      id: jobId,
      fileId: file.id,
      type: 'text-extraction',
      status: 'pending' as const,
      priority: 5,
      progress: 0,
      options,
      result: undefined,
      error: undefined,
      workspaceId: file.workspaceId,
      createdById: session.user.id,
      callbackUrl: undefined,
      metadata: {
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
      },
      startedAt: undefined,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Store job
    processingJobs.set(jobId, job);

    // Simulate job being queued
    setTimeout(() => {
      const storedJob = processingJobs.get(jobId);
      if (storedJob && storedJob.status === 'pending') {
        storedJob.status = 'queued';
        storedJob.updatedAt = new Date();
      }
    }, 100);

    return NextResponse.json(
      {
        data: {
          jobId,
          fileId: file.id,
          status: 'pending',
          type: 'text-extraction',
          createdAt: now.toISOString(),
        },
        message: 'Text extraction job created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/files/:id/extract] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}
