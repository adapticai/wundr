/**
 * Processing Jobs API Routes
 *
 * Handles creating and listing file processing jobs.
 *
 * Routes:
 * - POST /api/processing - Create a new processing job
 * - GET /api/processing - List processing jobs
 *
 * @module app/api/processing/route
 */

import crypto from 'crypto';

import { prisma } from '@genesis/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { processingJobs } from '@/lib/services/processing-stores';
import {
  createJobSchema,
  jobListSchema,
  createProcessingErrorResponse,
  PROCESSING_ERROR_CODES,
  supportsTextExtraction,
  supportsOCR,
  supportsConversion,
} from '@/lib/validations/processing';

import type { CreateJobInput, JobListInput } from '@/lib/validations/processing';
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
 * POST /api/processing
 *
 * Create a new file processing job.
 * Requires authentication and access to the file's workspace.
 *
 * @param request - Next.js request with job data
 * @returns Created job details with job ID
 *
 * @example
 * ```
 * POST /api/processing
 * Content-Type: application/json
 *
 * {
 *   "fileId": "clm123...",
 *   "type": "text-extraction",
 *   "priority": "normal"
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

    const parseResult = createJobSchema.safeParse(body);
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

    const input: CreateJobInput = parseResult.data;

    // Fetch the file and verify access
    const file = await prisma.file.findUnique({
      where: { id: input.fileId },
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

    // Check if processing type is supported for this file
    if (!isProcessingSupported(input.type, file.mimeType)) {
      return NextResponse.json(
        createProcessingErrorResponse(
          `Processing type '${input.type}' is not supported for file type '${file.mimeType}'`,
          PROCESSING_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        ),
        { status: 400 },
      );
    }

    // Create processing job
    const jobId = `job_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();

    const job = {
      id: jobId,
      fileId: input.fileId,
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
      metadata: input.metadata ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // Store job (in production, this would be added to a queue)
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
          jobId: job.id,
          fileId: job.fileId,
          type: job.type,
          status: job.status,
          priority: job.priority,
          createdAt: job.createdAt.toISOString(),
        },
        message: 'Processing job created successfully',
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

/**
 * GET /api/processing
 *
 * List processing jobs accessible to the authenticated user.
 * Jobs are filtered based on user's workspace memberships.
 *
 * @param request - Next.js request with query parameters
 * @returns Paginated list of processing jobs
 *
 * @example
 * ```
 * GET /api/processing?status=processing&type=ocr&limit=20
 * ```
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = jobListSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        createProcessingErrorResponse(
          'Invalid query parameters',
          PROCESSING_ERROR_CODES.VALIDATION_ERROR,
          { errors: parseResult.error.flatten().fieldErrors },
        ),
        { status: 400 },
      );
    }

    const filters: JobListInput = parseResult.data;

    // Get workspaces the user is a member of
    const userWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });

    const accessibleWorkspaceIds = new Set(userWorkspaces.map((w) => w.workspaceId));

    // Filter jobs from in-memory store
    let jobs = Array.from(processingJobs.values()).filter(
      (job) => accessibleWorkspaceIds.has(job.workspaceId),
    );

    // Apply filters
    if (filters.status) {
      jobs = jobs.filter((job) => job.status === filters.status);
    }
    if (filters.type) {
      jobs = jobs.filter((job) => job.type === filters.type);
    }
    if (filters.fileId) {
      jobs = jobs.filter((job) => job.fileId === filters.fileId);
    }

    // Sort jobs
    jobs.sort((a, b) => {
      const aVal = a[filters.sortBy as keyof typeof a];
      const bVal = b[filters.sortBy as keyof typeof b];
      const comparison =
        aVal instanceof Date && bVal instanceof Date
          ? aVal.getTime() - bVal.getTime()
          : String(aVal).localeCompare(String(bVal));
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply cursor pagination
    let startIndex = 0;
    if (filters.cursor) {
      const cursorIndex = jobs.findIndex((job) => job.id === filters.cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedJobs = jobs.slice(startIndex, startIndex + filters.limit + 1);
    const hasMore = paginatedJobs.length > filters.limit;
    const resultJobs = hasMore ? paginatedJobs.slice(0, filters.limit) : paginatedJobs;
    const nextCursor = hasMore ? resultJobs[resultJobs.length - 1]?.id ?? null : null;

    // Transform jobs for response
    const transformedJobs = resultJobs.map((job) => ({
      id: job.id,
      fileId: job.fileId,
      type: job.type,
      status: job.status,
      priority: job.priority,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      data: transformedJobs,
      pagination: {
        hasMore,
        nextCursor,
      },
    });
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

