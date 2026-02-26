/**
 * Processing GraphQL Resolvers
 *
 * Comprehensive resolvers for file processing operations including text extraction,
 * OCR, document conversion, and queue management. Implements authorization checks,
 * job tracking, and proper error handling.
 *
 * @module @genesis/api-types/resolvers/processing-resolvers
 */

import { GraphQLError } from 'graphql';

import type {
  PrismaClient,
  File as PrismaFile,
  Prisma,
} from '@neolith/database';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Processing job status enum
 */
export const ProcessingStatus = {
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
  Cancelled: 'CANCELLED',
} as const;

export type ProcessingStatusValue =
  (typeof ProcessingStatus)[keyof typeof ProcessingStatus];

/**
 * Processing job type enum
 */
export const ProcessingJobType = {
  TextExtraction: 'TEXT_EXTRACTION',
  OCR: 'OCR',
  DocumentConversion: 'DOCUMENT_CONVERSION',
  ImageProcessing: 'IMAGE_PROCESSING',
  Thumbnail: 'THUMBNAIL',
} as const;

export type ProcessingJobTypeValue =
  (typeof ProcessingJobType)[keyof typeof ProcessingJobType];

/**
 * User role for authorization checks
 */
type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Authenticated user information in context
 */
interface ContextUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * PubSub interface for subscriptions
 */
interface PubSubEngine {
  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T>;
  publish(trigger: string, payload: unknown): Promise<void>;
}

/**
 * Processing service interface
 */
export interface ProcessingService {
  /** Create a processing job */
  createJob(input: CreateProcessingJobInput): Promise<ProcessingJob>;
  /** Get job by ID */
  getJob(jobId: string): Promise<ProcessingJob | null>;
  /** Cancel a job */
  cancelJob(jobId: string): Promise<boolean>;
  /** Retry a failed job */
  retryJob(jobId: string): Promise<ProcessingJob>;
  /** Extract text from file */
  extractText(
    fileId: string,
    options?: TextExtractionOptions
  ): Promise<ProcessingJob>;
  /** Run OCR on file */
  runOCR(fileId: string, options?: OCROptions): Promise<ProcessingJob>;
  /** Convert document */
  convertDocument(fileId: string, format: string): Promise<ProcessingJob>;
  /** Get queue statistics */
  getQueueStats(): Promise<QueueStats>;
}

/**
 * GraphQL context with all required services
 */
export interface GraphQLContext {
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Authenticated user or null */
  user: ContextUser | null;
  /** PubSub instance for subscriptions */
  pubsub: PubSubEngine;
  /** Processing service */
  processingService?: ProcessingService;
  /** Unique request identifier */
  requestId: string;
}

/**
 * Processing job entity
 */
export interface ProcessingJob {
  id: string;
  fileId: string;
  type: ProcessingJobTypeValue;
  status: ProcessingStatusValue;
  progress: number;
  options: Record<string, unknown>;
  result: ProcessingResult | null;
  error: ProcessingError | null;
  attempts: number;
  maxAttempts: number;
  priority: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  userId: string;
}

/**
 * Processing result
 */
export interface ProcessingResult {
  content: string;
  metadata: Record<string, unknown>;
  pages?: PageContent[];
  tables?: TableData[];
  ocrConfidence?: number;
  outputUrl?: string;
}

/**
 * Page content for multi-page documents
 */
interface PageContent {
  pageNumber: number;
  content: string;
  tables?: TableData[];
}

/**
 * Table data extracted from documents
 */
interface TableData {
  headers: string[];
  rows: string[][];
}

/**
 * Processing error
 */
export interface ProcessingError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Text extraction options
 */
interface TextExtractionOptions {
  extractTables?: boolean;
  extractImages?: boolean;
  maxPages?: number;
}

/**
 * OCR options
 */
interface OCROptions {
  languages?: string[];
  enhanceImage?: boolean;
  detectOrientation?: boolean;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Input for creating a processing job
 */
interface CreateProcessingJobInput {
  fileId: string;
  type: ProcessingJobTypeValue;
  options?: Record<string, unknown>;
  priority?: number;
  callbackUrl?: string;
}

/**
 * Pagination input
 */
interface PaginationInput {
  cursor?: string | null;
  limit?: number | null;
}

// =============================================================================
// QUERY ARGUMENT TYPES
// =============================================================================

interface ProcessingJobQueryArgs {
  id: string;
}

interface ProcessingJobsQueryArgs {
  fileId?: string | null;
  status?: ProcessingStatusValue | null;
  pagination?: PaginationInput | null;
}

interface QueueStatsQueryArgs {
  // Empty - admin only query
}

interface FileContentQueryArgs {
  fileId: string;
}

// =============================================================================
// MUTATION ARGUMENT TYPES
// =============================================================================

interface CreateProcessingJobArgs {
  input: CreateProcessingJobInput;
}

interface CancelProcessingJobArgs {
  jobId: string;
}

interface RetryProcessingJobArgs {
  jobId: string;
}

interface ExtractTextArgs {
  fileId: string;
  options?: TextExtractionOptions | null;
}

interface RunOCRArgs {
  fileId: string;
  options?: OCROptions | null;
}

interface ConvertDocumentArgs {
  fileId: string;
  format: string;
}

// =============================================================================
// SUBSCRIPTION ARGUMENT TYPES
// =============================================================================

interface ProcessingJobUpdatedArgs {
  jobId: string;
}

interface FileProcessingCompleteArgs {
  fileId: string;
}

// =============================================================================
// PAYLOAD TYPES
// =============================================================================

interface ProcessingJobPayload {
  job: ProcessingJob | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface CancelPayload {
  success: boolean;
  jobId: string | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

interface FileContentPayload {
  content: string | null;
  metadata: Record<string, unknown> | null;
  errors: Array<{ code: string; message: string; path?: string[] }>;
}

// =============================================================================
// SUBSCRIPTION EVENT NAMES
// =============================================================================

/** Event name for job progress updates */
export const PROCESSING_JOB_UPDATED = 'PROCESSING_JOB_UPDATED';

/** Event name for file processing completion */
export const FILE_PROCESSING_COMPLETE = 'FILE_PROCESSING_COMPLETE';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Supported output formats for document conversion */
const SUPPORTED_CONVERSION_FORMATS = ['pdf', 'docx', 'txt', 'html', 'markdown'];

/** Supported OCR languages */
const SUPPORTED_OCR_LANGUAGES = [
  'eng',
  'spa',
  'fra',
  'deu',
  'ita',
  'por',
  'chi_sim',
  'chi_tra',
  'jpn',
  'kor',
];

/** Maximum pages for processing */
const MAX_PAGES = 500;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard to check if user is authenticated
 */
function isAuthenticated(
  context: GraphQLContext
): context is GraphQLContext & { user: ContextUser } {
  return context.user !== null;
}

/**
 * Type guard to check if user has admin role
 */
function isAdmin(context: GraphQLContext): boolean {
  return context.user !== null && context.user.role === 'ADMIN';
}

/**
 * Check if user can access a workspace
 */
async function canAccessWorkspace(
  context: GraphQLContext,
  workspaceId: string
): Promise<boolean> {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (isAdmin(context)) {
    return true;
  }

  const membership = await context.prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: context.user.id,
      },
    },
  });

  return membership !== null;
}

/**
 * Check if user can access a file
 */
async function canAccessFile(
  context: GraphQLContext,
  fileId: string
): Promise<{ hasAccess: boolean; file: PrismaFile | null }> {
  if (!isAuthenticated(context)) {
    return { hasAccess: false, file: null };
  }

  const file = await context.prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    return { hasAccess: false, file: null };
  }

  const hasAccess = await canAccessWorkspace(context, file.workspaceId);
  return { hasAccess, file };
}

/**
 * Validate OCR language options
 */
function validateOCRLanguages(languages?: string[]): void {
  if (!languages || languages.length === 0) {
    return;
  }

  for (const lang of languages) {
    if (!SUPPORTED_OCR_LANGUAGES.includes(lang)) {
      throw new GraphQLError(
        `Unsupported OCR language: ${lang}. Supported: ${SUPPORTED_OCR_LANGUAGES.join(', ')}`,
        {
          extensions: { code: 'BAD_USER_INPUT', field: 'options.languages' },
        }
      );
    }
  }
}

/**
 * Validate conversion format
 */
function validateConversionFormat(format: string): void {
  if (!SUPPORTED_CONVERSION_FORMATS.includes(format.toLowerCase())) {
    throw new GraphQLError(
      `Unsupported conversion format: ${format}. Supported: ${SUPPORTED_CONVERSION_FORMATS.join(', ')}`,
      {
        extensions: { code: 'BAD_USER_INPUT', field: 'format' },
      }
    );
  }
}

/**
 * Generate cursor from job for pagination
 */
function generateCursor(job: ProcessingJob): string {
  return Buffer.from(`${job.createdAt.toISOString()}:${job.id}`).toString(
    'base64'
  );
}

/**
 * Parse cursor to get timestamp and ID
 */
function parseCursor(cursor: string): { timestamp: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 2) {
      return null;
    }
    const timestamp = new Date(parts[0]!);
    const id = parts.slice(1).join(':');
    if (isNaN(timestamp.getTime())) {
      return null;
    }
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Create success payload
 */
function createSuccessPayload(job: ProcessingJob): ProcessingJobPayload {
  return { job, errors: [] };
}

/**
 * Create error payload
 */
function createErrorPayload(
  code: string,
  message: string,
  path?: string[]
): ProcessingJobPayload {
  const errors: Array<{ code: string; message: string; path?: string[] }> = [
    { code, message },
  ];
  if (path) {
    errors[0]!.path = path;
  }
  return { job: null, errors };
}

// =============================================================================
// PROCESSING QUERY RESOLVERS
// =============================================================================

/**
 * Processing Query resolvers
 */
export const processingQueries = {
  /**
   * Get a processing job by its ID
   */
  processingJob: async (
    _parent: unknown,
    args: ProcessingJobQueryArgs,
    context: GraphQLContext
  ): Promise<ProcessingJob | null> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      throw new GraphQLError('Processing service unavailable', {
        extensions: { code: 'SERVICE_UNAVAILABLE' },
      });
    }

    const job = await context.processingService.getJob(args.id);

    if (!job) {
      return null;
    }

    // Check if user can access the file
    const { hasAccess } = await canAccessFile(context, job.fileId);
    if (!hasAccess) {
      throw new GraphQLError('Access denied to this job', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    return job;
  },

  /**
   * List processing jobs with optional filters
   */
  processingJobs: async (
    _parent: unknown,
    args: ProcessingJobsQueryArgs,
    context: GraphQLContext
  ) => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { fileId, status, pagination } = args;
    const limit = Math.min(Math.max(pagination?.limit ?? 50, 1), 100);

    // If fileId is provided, check access
    if (fileId) {
      const { hasAccess } = await canAccessFile(context, fileId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this file', {
          extensions: { code: 'FORBIDDEN' },
        });
      }
    }

    // Build where clause for processing_jobs table (if exists)
    // For now, return mock data structure
    const where: Record<string, unknown> = {};

    if (fileId) {
      where.fileId = fileId;
    }

    if (status) {
      where.status = status;
    }

    // Non-admin users can only see their own jobs
    if (!isAdmin(context)) {
      where.userId = context.user.id;
    }

    // Handle cursor pagination
    if (pagination?.cursor) {
      const parsed = parseCursor(pagination.cursor);
      if (parsed) {
        where.createdAt = { lt: parsed.timestamp };
      }
    }

    // Mock response structure - actual implementation would query DB
    const jobs: ProcessingJob[] = [];
    const totalCount = 0;
    const hasNextPage = false;

    const edges = jobs.map(job => ({
      node: job,
      cursor: generateCursor(job),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!pagination?.cursor,
        startCursor: edges[0]?.cursor ?? null,
        endCursor: edges[edges.length - 1]?.cursor ?? null,
      },
      totalCount,
    };
  },

  /**
   * Get queue statistics (admin only)
   */
  queueStats: async (
    _parent: unknown,
    _args: QueueStatsQueryArgs,
    context: GraphQLContext
  ): Promise<QueueStats> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!isAdmin(context)) {
      throw new GraphQLError('Admin access required', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    if (!context.processingService) {
      throw new GraphQLError('Processing service unavailable', {
        extensions: { code: 'SERVICE_UNAVAILABLE' },
      });
    }

    return context.processingService.getQueueStats();
  },

  /**
   * Get extracted content for a file
   */
  fileContent: async (
    _parent: unknown,
    args: FileContentQueryArgs,
    context: GraphQLContext
  ): Promise<FileContentPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const { hasAccess, file } = await canAccessFile(context, args.fileId);
    if (!hasAccess || !file) {
      return {
        content: null,
        metadata: null,
        errors: [
          { code: 'NOT_FOUND', message: 'File not found or access denied' },
        ],
      };
    }

    // Get extracted content from file metadata
    const metadata = file.metadata as Record<string, unknown> | null;
    const extractedContent = metadata?.extractedContent as string | undefined;
    const extractedMetadata = metadata?.processingResult as
      | Record<string, unknown>
      | undefined;

    if (!extractedContent) {
      return {
        content: null,
        metadata: null,
        errors: [
          { code: 'NOT_PROCESSED', message: 'File has not been processed yet' },
        ],
      };
    }

    return {
      content: extractedContent,
      metadata: extractedMetadata ?? null,
      errors: [],
    };
  },
};

// =============================================================================
// PROCESSING MUTATION RESOLVERS
// =============================================================================

/**
 * Processing Mutation resolvers
 */
export const processingMutations = {
  /**
   * Create a new processing job
   */
  createProcessingJob: async (
    _parent: unknown,
    args: CreateProcessingJobArgs,
    context: GraphQLContext
  ): Promise<ProcessingJobPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Processing service unavailable'
      );
    }

    const { input } = args;

    // Check file access
    const { hasAccess, file } = await canAccessFile(context, input.fileId);
    if (!hasAccess || !file) {
      return createErrorPayload('NOT_FOUND', 'File not found or access denied');
    }

    try {
      const job = await context.processingService.createJob({
        ...input,
        options: input.options ?? {},
        priority: input.priority ?? 5,
      });

      // Publish job created event
      await context.pubsub.publish(`${PROCESSING_JOB_UPDATED}_${job.id}`, {
        processingJobUpdated: job,
      });

      return createSuccessPayload(job);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create job';
      return createErrorPayload('INTERNAL_ERROR', message);
    }
  },

  /**
   * Cancel a processing job
   */
  cancelProcessingJob: async (
    _parent: unknown,
    args: CancelProcessingJobArgs,
    context: GraphQLContext
  ): Promise<CancelPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return {
        success: false,
        jobId: null,
        errors: [
          {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Processing service unavailable',
          },
        ],
      };
    }

    const job = await context.processingService.getJob(args.jobId);
    if (!job) {
      return {
        success: false,
        jobId: null,
        errors: [{ code: 'NOT_FOUND', message: 'Job not found' }],
      };
    }

    // Check if user owns the job or is admin
    if (job.userId !== context.user.id && !isAdmin(context)) {
      throw new GraphQLError('You can only cancel your own jobs', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if job can be cancelled
    if (
      job.status === ProcessingStatus.Completed ||
      job.status === ProcessingStatus.Cancelled
    ) {
      return {
        success: false,
        jobId: args.jobId,
        errors: [
          {
            code: 'INVALID_STATE',
            message: 'Job cannot be cancelled in current state',
          },
        ],
      };
    }

    const success = await context.processingService.cancelJob(args.jobId);

    return {
      success,
      jobId: success ? args.jobId : null,
      errors: success
        ? []
        : [{ code: 'CANCEL_FAILED', message: 'Failed to cancel job' }],
    };
  },

  /**
   * Retry a failed processing job
   */
  retryProcessingJob: async (
    _parent: unknown,
    args: RetryProcessingJobArgs,
    context: GraphQLContext
  ): Promise<ProcessingJobPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Processing service unavailable'
      );
    }

    const existingJob = await context.processingService.getJob(args.jobId);
    if (!existingJob) {
      return createErrorPayload('NOT_FOUND', 'Job not found');
    }

    // Check if user owns the job or is admin
    if (existingJob.userId !== context.user.id && !isAdmin(context)) {
      throw new GraphQLError('You can only retry your own jobs', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Check if job can be retried
    if (existingJob.status !== ProcessingStatus.Failed) {
      return createErrorPayload(
        'INVALID_STATE',
        'Only failed jobs can be retried'
      );
    }

    try {
      const job = await context.processingService.retryJob(args.jobId);

      // Publish job updated event
      await context.pubsub.publish(`${PROCESSING_JOB_UPDATED}_${job.id}`, {
        processingJobUpdated: job,
      });

      return createSuccessPayload(job);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to retry job';
      return createErrorPayload('INTERNAL_ERROR', message);
    }
  },

  /**
   * Extract text from a file
   */
  extractText: async (
    _parent: unknown,
    args: ExtractTextArgs,
    context: GraphQLContext
  ): Promise<ProcessingJobPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Processing service unavailable'
      );
    }

    // Check file access
    const { hasAccess, file } = await canAccessFile(context, args.fileId);
    if (!hasAccess || !file) {
      return createErrorPayload('NOT_FOUND', 'File not found or access denied');
    }

    // Validate options
    const options = args.options ?? {};
    if (options.maxPages && options.maxPages > MAX_PAGES) {
      return createErrorPayload(
        'BAD_USER_INPUT',
        `Maximum pages is ${MAX_PAGES}`
      );
    }

    try {
      const job = await context.processingService.extractText(
        args.fileId,
        options
      );

      // Publish events
      await context.pubsub.publish(`${PROCESSING_JOB_UPDATED}_${job.id}`, {
        processingJobUpdated: job,
      });

      return createSuccessPayload(job);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create extraction job';
      return createErrorPayload('INTERNAL_ERROR', message);
    }
  },

  /**
   * Run OCR on a file
   */
  runOCR: async (
    _parent: unknown,
    args: RunOCRArgs,
    context: GraphQLContext
  ): Promise<ProcessingJobPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Processing service unavailable'
      );
    }

    // Check file access
    const { hasAccess, file } = await canAccessFile(context, args.fileId);
    if (!hasAccess || !file) {
      return createErrorPayload('NOT_FOUND', 'File not found or access denied');
    }

    // Validate options
    const options = args.options ?? {};
    try {
      validateOCRLanguages(options.languages ?? undefined);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    try {
      const job = await context.processingService.runOCR(args.fileId, options);

      // Publish events
      await context.pubsub.publish(`${PROCESSING_JOB_UPDATED}_${job.id}`, {
        processingJobUpdated: job,
      });

      return createSuccessPayload(job);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create OCR job';
      return createErrorPayload('INTERNAL_ERROR', message);
    }
  },

  /**
   * Convert document to different format
   */
  convertDocument: async (
    _parent: unknown,
    args: ConvertDocumentArgs,
    context: GraphQLContext
  ): Promise<ProcessingJobPayload> => {
    if (!isAuthenticated(context)) {
      throw new GraphQLError('Authentication required', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (!context.processingService) {
      return createErrorPayload(
        'SERVICE_UNAVAILABLE',
        'Processing service unavailable'
      );
    }

    // Check file access
    const { hasAccess, file } = await canAccessFile(context, args.fileId);
    if (!hasAccess || !file) {
      return createErrorPayload('NOT_FOUND', 'File not found or access denied');
    }

    // Validate format
    try {
      validateConversionFormat(args.format);
    } catch (error) {
      if (error instanceof GraphQLError) {
        return createErrorPayload(
          error.extensions?.code as string,
          error.message
        );
      }
      throw error;
    }

    try {
      const job = await context.processingService.convertDocument(
        args.fileId,
        args.format
      );

      // Publish events
      await context.pubsub.publish(`${PROCESSING_JOB_UPDATED}_${job.id}`, {
        processingJobUpdated: job,
      });

      return createSuccessPayload(job);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create conversion job';
      return createErrorPayload('INTERNAL_ERROR', message);
    }
  },
};

// =============================================================================
// PROCESSING SUBSCRIPTION RESOLVERS
// =============================================================================

/**
 * Processing Subscription resolvers
 */
export const processingSubscriptions = {
  /**
   * Subscribe to job progress updates
   */
  processingJobUpdated: {
    subscribe: async (
      _parent: unknown,
      args: ProcessingJobUpdatedArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify job exists and user has access
      if (context.processingService) {
        const job = await context.processingService.getJob(args.jobId);
        if (job) {
          const { hasAccess } = await canAccessFile(context, job.fileId);
          if (!hasAccess) {
            throw new GraphQLError('Access denied to this job', {
              extensions: { code: 'FORBIDDEN' },
            });
          }
        }
      }

      return context.pubsub.asyncIterator(
        `${PROCESSING_JOB_UPDATED}_${args.jobId}`
      );
    },
  },

  /**
   * Subscribe to file processing completion
   */
  fileProcessingComplete: {
    subscribe: async (
      _parent: unknown,
      args: FileProcessingCompleteArgs,
      context: GraphQLContext
    ) => {
      if (!isAuthenticated(context)) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Verify file access
      const { hasAccess } = await canAccessFile(context, args.fileId);
      if (!hasAccess) {
        throw new GraphQLError('Access denied to this file', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      return context.pubsub.asyncIterator(
        `${FILE_PROCESSING_COMPLETE}_${args.fileId}`
      );
    },
  },
};

// =============================================================================
// PROCESSING JOB FIELD RESOLVERS
// =============================================================================

/**
 * ProcessingJob field resolvers for nested types
 */
export const ProcessingJobFieldResolvers = {
  /**
   * Resolve the file for a processing job
   */
  file: async (
    parent: ProcessingJob,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.file.findUnique({
      where: { id: parent.fileId },
    });
  },

  /**
   * Get current progress percentage
   */
  progress: (parent: ProcessingJob): number => {
    return parent.progress;
  },

  /**
   * Get processing result if complete
   */
  result: (parent: ProcessingJob): ProcessingResult | null => {
    if (parent.status !== ProcessingStatus.Completed) {
      return null;
    }
    return parent.result;
  },

  /**
   * Get error details if failed
   */
  error: (parent: ProcessingJob): ProcessingError | null => {
    if (parent.status !== ProcessingStatus.Failed) {
      return null;
    }
    return parent.error;
  },

  /**
   * Resolve the user who created the job
   */
  user: async (
    parent: ProcessingJob,
    _args: unknown,
    context: GraphQLContext
  ) => {
    return context.prisma.user.findUnique({
      where: { id: parent.userId },
    });
  },

  /**
   * Calculate duration in milliseconds
   */
  duration: (parent: ProcessingJob): number | null => {
    if (!parent.startedAt || !parent.completedAt) {
      return null;
    }
    return parent.completedAt.getTime() - parent.startedAt.getTime();
  },
};

// =============================================================================
// COMBINED PROCESSING RESOLVERS
// =============================================================================

/**
 * Combined processing resolvers object for use with graphql-tools
 */
export const processingResolvers = {
  Query: processingQueries,
  Mutation: processingMutations,
  Subscription: processingSubscriptions,
  ProcessingJob: ProcessingJobFieldResolvers,
};

export default processingResolvers;
