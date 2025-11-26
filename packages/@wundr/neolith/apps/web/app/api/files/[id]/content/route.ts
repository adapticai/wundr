/**
 * Extracted Content API Route
 *
 * Returns extracted text, tables, and metadata from a file.
 *
 * Routes:
 * - GET /api/files/:id/content - Get extracted content
 *
 * @module app/api/files/[id]/content/route
 */

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs, extractedContentStore } from '@/lib/services/processing-stores';
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
 * GET /api/files/:id/content
 *
 * Get extracted content from a file. Returns text, tables,
 * and metadata that have been extracted through processing jobs.
 *
 * @param _request - Next.js request object
 * @param context - Route context with file ID
 * @returns Extracted content including text, tables, and metadata
 *
 * @example
 * ```
 * GET /api/files/clm123.../content
 * ```
 */
export async function GET(
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

    // Check for extracted content
    const content = extractedContentStore.get(params.id);

    // If no content yet, check for pending/in-progress extraction jobs
    const extractionJobs = Array.from(processingJobs.values()).filter(
      (job) =>
        job.fileId === params.id &&
        (job.type === 'text-extraction' || job.type === 'ocr'),
    );

    const pendingJobs = extractionJobs.filter(
      (job) =>
        job.status === 'pending' ||
        job.status === 'queued' ||
        job.status === 'processing',
    );

    const completedJobs = extractionJobs.filter(
      (job) => job.status === 'completed',
    );

    if (!content && pendingJobs.length === 0 && completedJobs.length === 0) {
      return NextResponse.json({
        data: {
          fileId: params.id,
          hasContent: false,
          text: null,
          tables: null,
          metadata: null,
          pages: null,
          wordCount: null,
          language: null,
          extractedAt: null,
          processingStatus: 'not-started',
          message: 'No content extraction has been performed on this file. Use POST /api/files/:id/extract or POST /api/files/:id/ocr to start extraction.',
        },
      });
    }

    if (!content && pendingJobs.length > 0) {
      const latestJob = pendingJobs.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];

      return NextResponse.json({
        data: {
          fileId: params.id,
          hasContent: false,
          text: null,
          tables: null,
          metadata: null,
          pages: null,
          wordCount: null,
          language: null,
          extractedAt: null,
          processingStatus: latestJob.status,
          processingProgress: latestJob.progress,
          jobId: latestJob.id,
          message: 'Content extraction is in progress.',
        },
      });
    }

    // Return content if available (could be from completed job result)
    if (content) {
      return NextResponse.json({
        data: {
          fileId: content.fileId,
          hasContent: true,
          text: content.text,
          tables: content.tables,
          metadata: content.metadata,
          pages: content.pages,
          wordCount: content.wordCount,
          language: content.language,
          extractedAt: content.extractedAt.toISOString(),
          jobId: content.jobId,
          processingStatus: 'completed',
        },
      });
    }

    // If we have completed jobs but no content in store, synthesize from job results
    if (completedJobs.length > 0) {
      const latestCompletedJob = completedJobs.sort(
        (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      )[0];

      const result = latestCompletedJob.result as Record<string, unknown> | null;

      return NextResponse.json({
        data: {
          fileId: params.id,
          hasContent: !!result,
          text: (result?.text as string) ?? null,
          tables: (result?.tables as Array<{
            rows: string[][];
            headers?: string[];
            caption?: string;
          }>) ?? null,
          metadata: (result?.metadata as Record<string, unknown>) ?? null,
          pages: (result?.pages as number) ?? null,
          wordCount: (result?.wordCount as number) ?? null,
          language: (result?.language as string) ?? null,
          extractedAt: latestCompletedJob.completedAt?.toISOString() ?? null,
          jobId: latestCompletedJob.id,
          processingStatus: 'completed',
        },
      });
    }

    // Fallback
    return NextResponse.json({
      data: {
        fileId: params.id,
        hasContent: false,
        text: null,
        tables: null,
        metadata: null,
        pages: null,
        wordCount: null,
        language: null,
        extractedAt: null,
        processingStatus: 'unknown',
      },
    });
  } catch (error) {
    console.error('[GET /api/files/:id/content] Error:', error);
    return NextResponse.json(
      createProcessingErrorResponse(
        'An internal error occurred',
        PROCESSING_ERROR_CODES.INTERNAL_ERROR,
      ),
      { status: 500 },
    );
  }
}

