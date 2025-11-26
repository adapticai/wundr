/**
 * OCR Processing API Route
 *
 * Triggers OCR (Optical Character Recognition) processing for a file.
 *
 * Routes:
 * - POST /api/files/:id/ocr - Trigger OCR job
 *
 * @module app/api/files/[id]/ocr/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  fileIdParamSchema,
  ocrRequestSchema,
  ocrOptionsSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
  supportsOCR,
} from '@/lib/validations/processing';

import type { NextRequest } from 'next/server';

/**
 * Route context with file ID parameter
 */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/files/:id/ocr
 *
 * Trigger OCR processing for a file. Recognizes text from images
 * and scanned documents.
 *
 * @param request - Next.js request with OCR options
 * @param context - Route context with file ID
 * @returns Job ID and status
 *
 * @example
 * ```
 * POST /api/files/clm123.../ocr
 * Content-Type: application/json
 *
 * {
 *   "language": "eng",
 *   "options": {
 *     "preserveLayout": true,
 *     "dpi": 300
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
    let ocrOptions = {};
    let language: string | string[] = 'eng';

    try {
      const body = await request.json();
      const requestResult = ocrRequestSchema.safeParse(body);

      if (requestResult.success) {
        if (requestResult.data.language) {
          language = requestResult.data.language;
        }
        if (requestResult.data.options) {
          const optionsResult = ocrOptionsSchema.safeParse(requestResult.data.options);
          if (optionsResult.success) {
            ocrOptions = optionsResult.data;
          }
        }
      }
    } catch {
      // Empty body is valid, use defaults
    }

    // Fetch the file
    const file = await prisma.files.findUnique({
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
    const membership = await prisma.workspace_members.findUnique({
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

    // Check if file type supports OCR
    if (!supportsOCR(file.mimeType)) {
      return NextResponse.json(
        createProcessingErrorResponse(
          `OCR is not supported for file type '${file.mimeType}'`,
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

    // Create processing job
    const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    const job = {
      id: jobId,
      fileId: file.id,
      type: 'ocr',
      status: 'pending',
      priority: 'normal',
      progress: 0,
      options: {
        language,
        ...ocrOptions,
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
          status: 'pending',
          type: 'ocr',
          language,
          createdAt: now.toISOString(),
        },
        message: 'OCR processing job created successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/files/:id/ocr] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}
