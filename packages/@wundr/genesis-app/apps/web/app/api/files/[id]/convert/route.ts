/**
 * Document Conversion API Route
 *
 * Triggers document format conversion for a file.
 *
 * Routes:
 * - POST /api/files/:id/convert - Trigger conversion job
 *
 * @module app/api/files/[id]/convert/route
 */

import crypto from 'crypto';

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  fileIdParamSchema,
  convertOptionsSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
  supportsConversion,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/files/:id/convert
 *
 * Trigger document conversion for a file. Converts the file
 * to the specified output format.
 *
 * @param request - Next.js request with conversion options
 * @param context - Route context with file ID
 * @returns Job ID, status, and output file ID
 *
 * @example
 * ```
 * POST /api/files/clm123.../convert
 * Content-Type: application/json
 *
 * {
 *   "format": "pdf",
 *   "options": {
 *     "pageSize": "a4",
 *     "includePageNumbers": true
 *   }
 * }
 * ```
 */
export async function POST(
  request: NextRequest,
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

    // Validate file ID parameter
    const params = await context.params;
    const paramResult = fileIdParamSchema.safeParse(params);
    if (!paramResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid file ID format',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Request body is required with format specification',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    const optionsResult = convertOptionsSchema.safeParse(body);
    if (!optionsResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid conversion options',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
          { errors: optionsResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const conversionOptions = optionsResult.data;

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
          PROCESSING_ERROR_CODES.FILE_NOT_FOUND,
        ),
        { status: 404 },
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
          PROCESSING_ERROR_CODES.NOT_WORKSPACE_MEMBER,
        ),
        { status: 403 },
      );
    }

    // Check if file type supports conversion
    if (!supportsConversion(file.mimeType)) {
      return NextResponse.json(
        createProcessingErrorResponse(
          `Document conversion is not supported for file type '${file.mimeType}'`,
          PROCESSING_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        ),
        { status: 400 },
      );
    }

    // Check if file is ready
    if (file.status !== 'READY') {
      return NextResponse.json(
        createProcessingErrorResponse(
          `File is not ready for processing. Current status: ${file.status}`,
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
        ),
        { status: 400 },
      );
    }

    // Generate output file ID (will be created when conversion completes)
    const outputFileId = `file_${crypto.randomBytes(12).toString('hex')}`;

    // Create processing job
    const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    const job = {
      id: jobId,
      fileId: file.id,
      type: 'document-conversion',
      status: 'pending',
      priority: 'normal',
      progress: 0,
      options: {
        format: conversionOptions.format,
        ...conversionOptions.options,
      },
      result: null,
      error: null,
      workspaceId: file.workspaceId,
      createdById: session.user.id,
      callbackUrl: null,
      metadata: {
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        targetFormat: conversionOptions.format,
        outputFileId,
      },
      startedAt: null,
      completedAt: null,
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
          outputFileId,
          status: 'pending',
          type: 'document-conversion',
          targetFormat: conversionOptions.format,
          createdAt: now.toISOString(),
        },
        message: 'Document conversion job created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/files/:id/convert] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
