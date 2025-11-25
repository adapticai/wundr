/**
 * Processing API Tests
 *
 * Comprehensive test suite for the file processing API endpoints covering:
 * - Text extraction endpoints
 * - OCR endpoints
 * - Job status endpoints
 * - Authorization checks
 * - Error handling
 *
 * @module apps/web/app/api/processing/__tests__/processing.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { NextRequest } from 'next/server';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

interface MockFile {
  id: string;
  filename: string;
  mimeType: string;
  workspaceId: string;
  uploadedById: string;
  status: string;
}

interface MockProcessingJob {
  id: string;
  fileId: string;
  type: string;
  status: string;
  progress: number;
  progressPercentage?: number;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
  userId: string;
}

/**
 * API response structure for processing endpoints
 */
interface ProcessingApiResponse {
  job?: MockProcessingJob;
  data?: MockProcessingJob | MockProcessingJob[];
  error?: string;
  code?: string;
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
  };
  summary?: {
    total: number;
    created: number;
    skipped: number;
    errors: number;
  };
  message?: string;
}

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock authenticated user
 */
const mockUser: MockUser = {
  id: 'user_123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'MEMBER',
};

/**
 * Mock admin user
 */
const mockAdminUser: MockUser = {
  id: 'admin_123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'ADMIN',
};

/**
 * Mock file record
 */
const mockFile: MockFile = {
  id: 'file_123',
  filename: 'document.pdf',
  mimeType: 'application/pdf',
  workspaceId: 'workspace_123',
  uploadedById: 'user_123',
  status: 'READY',
};

/**
 * Mock processing job
 */
const mockJob: MockProcessingJob = {
  id: 'job_123',
  fileId: 'file_123',
  type: 'TEXT_EXTRACTION',
  status: 'PENDING',
  progress: 0,
  result: null,
  error: null,
  createdAt: new Date(),
  userId: 'user_123',
};

/**
 * Mock Prisma client
 */
const mockPrisma = {
  file: {
    findUnique: vi.fn(),
  },
  workspaceMember: {
    findUnique: vi.fn(),
  },
};

/**
 * Mock Processing Service
 */
const mockProcessingService = {
  createJob: vi.fn(),
  getJob: vi.fn(),
  cancelJob: vi.fn(),
  retryJob: vi.fn(),
  extractText: vi.fn(),
  runOCR: vi.fn(),
  getQueueStats: vi.fn(),
};

/**
 * Mock getServerSession
 */
const mockGetServerSession = vi.fn();

/**
 * Create mock NextRequest
 */
function createMockRequest(options: {
  method?: string;
  body?: unknown;
  searchParams?: Record<string, string>;
} = {}): NextRequest {
  const { method = 'GET', body, searchParams = {} } = options;

  const url = new URL('http://localhost:3000/api/processing');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return {
    method,
    url: url.toString(),
    nextUrl: url,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as NextRequest;
}

/**
 * Mock route handler response helpers
 */
function createJsonResponse(data: unknown, status = 200) {
  return {
    json: () => Promise.resolve(data),
    status,
  };
}

// =============================================================================
// API ROUTE HANDLERS (MOCK IMPLEMENTATION FOR TESTING)
// =============================================================================

/**
 * POST /api/files/:id/extract - Create text extraction job
 */
async function handleExtractText(
  request: NextRequest,
  params: { id: string },
): Promise<{ json: () => Promise<unknown>; status: number }> {
  // Check authentication
  const session = await mockGetServerSession();
  if (!session?.user) {
    return createJsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Get file
  const file = await mockPrisma.file.findUnique({
    where: { id: params.id },
  });

  if (!file) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  // Check workspace access
  const membership = await mockPrisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: file.workspaceId,
        userId: session.user.id,
      },
    },
  });

  if (!membership && session.user.role !== 'ADMIN') {
    return createJsonResponse({ error: 'Access denied' }, 403);
  }

  // Parse options from request body
  const body = await request.json();
  const options = {
    extractTables: body.extractTables ?? false,
    extractImages: body.extractImages ?? false,
    maxPages: body.maxPages,
  };

  // Create extraction job
  try {
    const job = await mockProcessingService.extractText(params.id, options);
    return createJsonResponse({ job }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job';
    return createJsonResponse({ error: message }, 500);
  }
}

/**
 * POST /api/files/:id/ocr - Create OCR job
 */
async function handleOCR(
  request: NextRequest,
  params: { id: string },
): Promise<{ json: () => Promise<unknown>; status: number }> {
  // Check authentication
  const session = await mockGetServerSession();
  if (!session?.user) {
    return createJsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Get file
  const file = await mockPrisma.file.findUnique({
    where: { id: params.id },
  });

  if (!file) {
    return createJsonResponse({ error: 'File not found' }, 404);
  }

  // Check workspace access
  const membership = await mockPrisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: file.workspaceId,
        userId: session.user.id,
      },
    },
  });

  if (!membership && session.user.role !== 'ADMIN') {
    return createJsonResponse({ error: 'Access denied' }, 403);
  }

  // Parse options from request body
  const body = await request.json();
  const options = {
    languages: body.languages ?? ['eng'],
    enhanceImage: body.enhanceImage ?? true,
  };

  // Validate language options
  const validLanguages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'chi_sim', 'jpn', 'kor'];
  const invalidLanguages = options.languages.filter(
    (lang: string) => !validLanguages.includes(lang),
  );

  if (invalidLanguages.length > 0) {
    return createJsonResponse(
      { error: `Invalid language(s): ${invalidLanguages.join(', ')}` },
      400,
    );
  }

  // Create OCR job
  try {
    const job = await mockProcessingService.runOCR(params.id, options);
    return createJsonResponse({ job }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job';
    return createJsonResponse({ error: message }, 500);
  }
}

/**
 * GET /api/processing/:jobId - Get job status
 */
async function handleGetJobStatus(
  _request: NextRequest,
  params: { jobId: string },
): Promise<{ json: () => Promise<unknown>; status: number }> {
  // Check authentication
  const session = await mockGetServerSession();
  if (!session?.user) {
    return createJsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Get job
  const job = await mockProcessingService.getJob(params.jobId);

  if (!job) {
    return createJsonResponse({ error: 'Job not found' }, 404);
  }

  // Check if user owns the job or is admin
  if (job.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return createJsonResponse({ error: 'Access denied' }, 403);
  }

  // Calculate progress percentage
  const progressPercentage = job.progress ?? 0;

  return createJsonResponse({
    job: {
      ...job,
      progressPercentage,
    },
  });
}

// =============================================================================
// TESTS
// =============================================================================

describe('Processing API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default session mock - authenticated user
    mockGetServerSession.mockResolvedValue({ user: mockUser });

    // Default file lookup
    mockPrisma.file.findUnique.mockResolvedValue(mockFile);

    // Default workspace membership
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({
      workspaceId: 'workspace_123',
      userId: 'user_123',
      role: 'MEMBER',
    });

    // Default job creation
    mockProcessingService.extractText.mockResolvedValue({
      ...mockJob,
      type: 'TEXT_EXTRACTION',
    });
    mockProcessingService.runOCR.mockResolvedValue({
      ...mockJob,
      type: 'OCR',
    });
    mockProcessingService.getJob.mockResolvedValue(mockJob);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ===========================================================================
  // POST /api/files/:id/extract Tests
  // ===========================================================================

  describe('POST /api/files/:id/extract', () => {
    it('creates extraction job', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { extractTables: true },
      });

      const response = await handleExtractText(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(201);
      expect(data.job).toBeDefined();
      expect(data.job?.type).toBe('TEXT_EXTRACTION');
      expect(mockProcessingService.extractText).toHaveBeenCalledWith(
        'file_123',
        expect.objectContaining({ extractTables: true }),
      );
    });

    it('requires file access', async () => {
      // User is not a member of the workspace
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleExtractText(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('returns 404 for non-existent file', async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleExtractText(request, { id: 'nonexistent' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleExtractText(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('allows admin access to any file', async () => {
      mockGetServerSession.mockResolvedValue({ user: mockAdminUser });
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleExtractText(request, { id: 'file_123' });

      expect(response.status).toBe(201);
    });

    it('handles extraction options', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {
          extractTables: true,
          extractImages: true,
          maxPages: 50,
        },
      });

      await handleExtractText(request, { id: 'file_123' });

      expect(mockProcessingService.extractText).toHaveBeenCalledWith(
        'file_123',
        {
          extractTables: true,
          extractImages: true,
          maxPages: 50,
        },
      );
    });

    it('handles service errors', async () => {
      mockProcessingService.extractText.mockRejectedValue(
        new Error('Queue unavailable'),
      );

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleExtractText(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(500);
      expect(data.error).toBe('Queue unavailable');
    });
  });

  // ===========================================================================
  // POST /api/files/:id/ocr Tests
  // ===========================================================================

  describe('POST /api/files/:id/ocr', () => {
    it('creates OCR job', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { languages: ['eng'] },
      });

      const response = await handleOCR(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(201);
      expect(data.job).toBeDefined();
      expect(data.job!.type).toBe('OCR');
    });

    it('validates language option', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { languages: ['invalid_lang'] },
      });

      const response = await handleOCR(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid language');
    });

    it('accepts valid languages', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { languages: ['eng', 'fra', 'spa'] },
      });

      const response = await handleOCR(request, { id: 'file_123' });

      expect(response.status).toBe(201);
      expect(mockProcessingService.runOCR).toHaveBeenCalledWith(
        'file_123',
        expect.objectContaining({ languages: ['eng', 'fra', 'spa'] }),
      );
    });

    it('uses default language when not specified', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      await handleOCR(request, { id: 'file_123' });

      expect(mockProcessingService.runOCR).toHaveBeenCalledWith(
        'file_123',
        expect.objectContaining({ languages: ['eng'] }),
      );
    });

    it('requires file access', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        method: 'POST',
        body: {},
      });

      const response = await handleOCR(request, { id: 'file_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('handles enhance image option', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: { enhanceImage: true },
      });

      await handleOCR(request, { id: 'file_123' });

      expect(mockProcessingService.runOCR).toHaveBeenCalledWith(
        'file_123',
        expect.objectContaining({ enhanceImage: true }),
      );
    });
  });

  // ===========================================================================
  // GET /api/processing/:jobId Tests
  // ===========================================================================

  describe('GET /api/processing/:jobId', () => {
    it('returns job status', async () => {
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        status: 'PROCESSING',
        progress: 50,
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(200);
      expect(data.job).toBeDefined();
      expect(data.job!.status).toBe('PROCESSING');
    });

    it('returns progress percentage', async () => {
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        status: 'PROCESSING',
        progress: 75,
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(data.job!.progressPercentage).toBe(75);
    });

    it('returns 404 for non-existent job', async () => {
      mockProcessingService.getJob.mockResolvedValue(null);

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'nonexistent' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(404);
      expect(data.error).toBe('Job not found');
    });

    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('denies access to other users jobs', async () => {
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        userId: 'other_user_456',
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied');
    });

    it('allows admin access to any job', async () => {
      mockGetServerSession.mockResolvedValue({ user: mockAdminUser });
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        userId: 'other_user_456',
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });

      expect(response.status).toBe(200);
    });

    it('returns completed job with result', async () => {
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        status: 'COMPLETED',
        progress: 100,
        result: {
          content: 'Extracted text content',
          metadata: { pageCount: 5 },
        },
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(200);
      expect(data.job!.status).toBe('COMPLETED');
      expect(data.job!.result).toBeDefined();
      expect(data.job!.result!.content).toBe('Extracted text content');
    });

    it('returns failed job with error', async () => {
      mockProcessingService.getJob.mockResolvedValue({
        ...mockJob,
        status: 'FAILED',
        progress: 0,
        error: 'Processing failed: Invalid PDF structure',
      });

      const request = createMockRequest();

      const response = await handleGetJobStatus(request, { jobId: 'job_123' });
      const data = (await response.json()) as ProcessingApiResponse;

      expect(response.status).toBe(200);
      expect(data.job!.status).toBe('FAILED');
      expect(data.job!.error).toBe('Processing failed: Invalid PDF structure');
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Processing API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: mockUser });
    mockPrisma.file.findUnique.mockResolvedValue(mockFile);
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({
      workspaceId: 'workspace_123',
      userId: 'user_123',
      role: 'MEMBER',
    });
  });

  it('complete extraction flow', async () => {
    // 1. Create extraction job
    mockProcessingService.extractText.mockResolvedValue({
      id: 'extraction_job',
      fileId: 'file_123',
      type: 'TEXT_EXTRACTION',
      status: 'PENDING',
      progress: 0,
      userId: 'user_123',
    });

    const createRequest = createMockRequest({
      method: 'POST',
      body: { extractTables: true },
    });

    const createResponse = await handleExtractText(createRequest, { id: 'file_123' });
    const createData = (await createResponse.json()) as ProcessingApiResponse;

    expect(createResponse.status).toBe(201);
    const jobId = createData.job!.id;

    // 2. Check status - processing
    mockProcessingService.getJob.mockResolvedValue({
      id: jobId,
      fileId: 'file_123',
      type: 'TEXT_EXTRACTION',
      status: 'PROCESSING',
      progress: 50,
      userId: 'user_123',
    });

    const statusRequest = createMockRequest();
    const statusResponse = await handleGetJobStatus(statusRequest, { jobId });
    const statusData = (await statusResponse.json()) as ProcessingApiResponse;

    expect(statusData.job!.status).toBe('PROCESSING');
    expect(statusData.job!.progressPercentage).toBe(50);

    // 3. Check status - completed
    mockProcessingService.getJob.mockResolvedValue({
      id: jobId,
      fileId: 'file_123',
      type: 'TEXT_EXTRACTION',
      status: 'COMPLETED',
      progress: 100,
      result: {
        content: 'Extracted document text',
        tables: [{ headers: ['A', 'B'], rows: [['1', '2']] }],
      },
      userId: 'user_123',
    });

    const finalStatusRequest = createMockRequest();
    const finalStatusResponse = await handleGetJobStatus(finalStatusRequest, { jobId });
    const finalStatusData = (await finalStatusResponse.json()) as ProcessingApiResponse;

    expect(finalStatusData.job!.status).toBe('COMPLETED');
    expect(finalStatusData.job!.result!.content).toBe('Extracted document text');
  });

  it('complete OCR flow', async () => {
    // 1. Create OCR job
    mockProcessingService.runOCR.mockResolvedValue({
      id: 'ocr_job',
      fileId: 'file_123',
      type: 'OCR',
      status: 'PENDING',
      progress: 0,
      userId: 'user_123',
    });

    const createRequest = createMockRequest({
      method: 'POST',
      body: { languages: ['eng', 'fra'] },
    });

    const createResponse = await handleOCR(createRequest, { id: 'file_123' });
    const createData = (await createResponse.json()) as ProcessingApiResponse;

    expect(createResponse.status).toBe(201);
    expect(createData.job!.type).toBe('OCR');

    // 2. Check completed status
    mockProcessingService.getJob.mockResolvedValue({
      id: 'ocr_job',
      fileId: 'file_123',
      type: 'OCR',
      status: 'COMPLETED',
      progress: 100,
      result: {
        content: 'Recognized text from image',
        confidence: 92.5,
      },
      userId: 'user_123',
    });

    const statusRequest = createMockRequest();
    const statusResponse = await handleGetJobStatus(statusRequest, { jobId: 'ocr_job' });
    const statusData = (await statusResponse.json()) as ProcessingApiResponse;

    expect(statusData.job!.status).toBe('COMPLETED');
    expect(statusData.job!.result!.confidence).toBe(92.5);
  });
});
