/**
 * Mock Processors for File Processing Tests
 *
 * Provides mock implementations of file processors for unit testing.
 * Includes mocks for PDF, DOCX, XLSX parsing, OCR services, and queue operations.
 *
 * @module @genesis/file-processor/test-utils/mock-processors
 */

import { vi } from 'vitest';

import { FileType, JobStatus } from '../types';

import type {
  ProcessorResult,
  FileMetadata,
  ProcessingOptions,
  PageContent,
  TableData,
  ImageData,
  FileProcessingJob,
  JobProgress,
} from '../types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Mock processor options
 */
export interface MockProcessorOptions {
  /** Simulate processing delay in ms */
  delay?: number;
  /** Force error */
  shouldFail?: boolean;
  /** Error message when shouldFail is true */
  errorMessage?: string;
  /** Custom result data */
  customResult?: Partial<ProcessorResult>;
}

/**
 * Mock OCR options
 */
export interface MockOCROptions extends MockProcessorOptions {
  /** Confidence score to return */
  confidence?: number;
  /** Languages to simulate */
  languages?: string[];
}

/**
 * Mock queue options
 */
export interface MockQueueOptions {
  /** Initial queue state */
  initialJobs?: FileProcessingJob[];
  /** Simulate queue errors */
  shouldFail?: boolean;
  /** Processing delay per job */
  processingDelay?: number;
}

// =============================================================================
// MOCK PDF PROCESSOR
// =============================================================================

/**
 * Create a mock PDF processor for testing
 */
export function createMockPdfProcessor(options: MockProcessorOptions = {}) {
  const { delay = 0, shouldFail = false, errorMessage = 'Mock PDF error', customResult } = options;

  const process = vi.fn(
    async (
      filePath: string,
      processingOptions: ProcessingOptions = {},
    ): Promise<ProcessorResult> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (shouldFail) {
        throw new Error(errorMessage);
      }

      const filename = filePath.split('/').pop() ?? 'document.pdf';
      const pageCount = processingOptions.maxPages ?? 10;

      const pages: PageContent[] = Array.from({ length: pageCount }, (_, i) => ({
        pageNumber: i + 1,
        content: `Page ${i + 1} content from ${filename}`,
        tables: processingOptions.extractTables
          ? [
              {
                headers: ['Column A', 'Column B', 'Column C'],
                rows: [
                  ['Row 1 A', 'Row 1 B', 'Row 1 C'],
                  ['Row 2 A', 'Row 2 B', 'Row 2 C'],
                ],
              },
            ]
          : undefined,
      }));

      const metadata: FileMetadata = {
        filename,
        mimeType: 'application/pdf',
        size: 1024 * pageCount,
        fileType: FileType.PDF,
        pageCount,
        author: 'Test Author',
        title: 'Test Document',
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-15'),
      };

      return {
        success: true,
        content: pages.map((p) => p.content).join('\n\n'),
        metadata,
        processingTime: delay || 100,
        pages,
        structuredData: processingOptions.extractTables
          ? {
              tables: pages.flatMap((p) => p.tables ?? []),
            }
          : undefined,
        ...customResult,
      };
    },
  );

  const getInfo = vi.fn(() => ({
    name: 'MockPdfProcessor',
    version: '1.0.0-test',
    supportedTypes: ['application/pdf'],
  }));

  return {
    process,
    getInfo,
  };
}

// =============================================================================
// MOCK DOCX PROCESSOR
// =============================================================================

/**
 * Create a mock DOCX processor for testing
 */
export function createMockDocxProcessor(options: MockProcessorOptions = {}) {
  const { delay = 0, shouldFail = false, errorMessage = 'Mock DOCX error', customResult } = options;

  const process = vi.fn(
    async (
      filePath: string,
      processingOptions: ProcessingOptions = {},
    ): Promise<ProcessorResult> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (shouldFail) {
        throw new Error(errorMessage);
      }

      const filename = filePath.split('/').pop() ?? 'document.docx';

      const textContent = `
        This is the main content of the Word document.

        It contains multiple paragraphs with various formatting.

        - Bullet point 1
        - Bullet point 2
        - Bullet point 3

        1. Numbered item 1
        2. Numbered item 2
        3. Numbered item 3

        The document also contains headings and subheadings.
      `.trim();

      const htmlContent = `
        <h1>Document Title</h1>
        <p>This is the main content of the Word document.</p>
        <p>It contains multiple paragraphs with various formatting.</p>
        <ul>
          <li>Bullet point 1</li>
          <li>Bullet point 2</li>
          <li>Bullet point 3</li>
        </ul>
        <ol>
          <li>Numbered item 1</li>
          <li>Numbered item 2</li>
          <li>Numbered item 3</li>
        </ol>
        <p>The document also contains headings and subheadings.</p>
      `.trim();

      const images: ImageData[] = processingOptions.extractImages
        ? [
            {
              id: 'img_1',
              format: 'png',
              dimensions: { width: 800, height: 600 },
              data: 'data:image/png;base64,mockImageData',
            },
          ]
        : [];

      const metadata: FileMetadata = {
        filename,
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 2048,
        fileType: FileType.DOCX,
        author: 'Test Author',
        title: 'Test Word Document',
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-15'),
        custom: {
          wordCount: 50,
          paragraphCount: 6,
        },
      };

      return {
        success: true,
        content: textContent,
        metadata,
        processingTime: delay || 75,
        structuredData: {
          html: htmlContent,
          images: images.length > 0 ? images : undefined,
          headings: [
            { level: 1, text: 'Document Title' },
          ],
        },
        ...customResult,
      };
    },
  );

  const getInfo = vi.fn(() => ({
    name: 'MockDocxProcessor',
    version: '1.0.0-test',
    supportedTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  }));

  return {
    process,
    getInfo,
  };
}

// =============================================================================
// MOCK XLSX PROCESSOR
// =============================================================================

/**
 * Sheet data for mock XLSX
 */
interface MockSheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | Date | null)[][];
}

/**
 * Create a mock XLSX processor for testing
 */
export function createMockXlsxProcessor(
  options: MockProcessorOptions & { sheets?: MockSheetData[] } = {},
) {
  const {
    delay = 0,
    shouldFail = false,
    errorMessage = 'Mock XLSX error',
    customResult,
    sheets = [
      {
        name: 'Sheet1',
        headers: ['ID', 'Name', 'Value', 'Date'],
        rows: [
          [1, 'Item A', 100.5, new Date('2024-01-01')],
          [2, 'Item B', 200.75, new Date('2024-01-02')],
          [3, 'Item C', 300.25, new Date('2024-01-03')],
        ],
      },
      {
        name: 'Sheet2',
        headers: ['Category', 'Count'],
        rows: [
          ['Alpha', 10],
          ['Beta', 20],
          ['Gamma', 30],
        ],
      },
    ],
  } = options;

  const process = vi.fn(
    async (
      filePath: string,
      _processingOptions: ProcessingOptions = {},
    ): Promise<ProcessorResult> => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (shouldFail) {
        throw new Error(errorMessage);
      }

      const filename = filePath.split('/').pop() ?? 'spreadsheet.xlsx';

      // Convert sheets to text
      const textContent = sheets
        .map((sheet) => {
          const headerRow = sheet.headers.join('\t');
          const dataRows = sheet.rows
            .map((row) =>
              row
                .map((cell) => {
                  if (cell === null) {
return '';
}
                  if (cell instanceof Date) {
return cell.toISOString();
}
                  return String(cell);
                })
                .join('\t'),
            )
            .join('\n');
          return `=== ${sheet.name} ===\n${headerRow}\n${dataRows}`;
        })
        .join('\n\n');

      // Convert to table data
      const tables: TableData[] = sheets.map((sheet) => ({
        headers: sheet.headers,
        rows: sheet.rows.map((row) =>
          row.map((cell) => {
            if (cell === null) {
return '';
}
            if (cell instanceof Date) {
return cell.toISOString();
}
            return String(cell);
          }),
        ),
      }));

      const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0);

      const metadata: FileMetadata = {
        filename,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 4096,
        fileType: FileType.XLSX,
        createdAt: new Date('2024-01-01'),
        modifiedAt: new Date('2024-01-15'),
        custom: {
          sheetCount: sheets.length,
          totalRows,
          totalColumns: Math.max(...sheets.map((s) => s.headers.length)),
        },
      };

      return {
        success: true,
        content: textContent,
        metadata,
        processingTime: delay || 50,
        structuredData: {
          sheets: sheets.map((sheet, index) => ({
            name: sheet.name,
            index,
            hidden: false,
            rowCount: sheet.rows.length,
            columnCount: sheet.headers.length,
            headers: sheet.headers,
            rows: sheet.rows,
            mergedCells: [],
            namedRanges: [],
          })),
          tables,
        },
        ...customResult,
      };
    },
  );

  const getInfo = vi.fn(() => ({
    name: 'MockXlsxProcessor',
    version: '1.0.0-test',
    supportedTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  }));

  return {
    process,
    getInfo,
  };
}

// =============================================================================
// MOCK OCR SERVICE
// =============================================================================

/**
 * Word result for OCR
 */
interface MockWordResult {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

/**
 * Create a mock OCR service for testing
 */
export function createMockOCRService(options: MockOCROptions = {}) {
  const {
    delay = 0,
    shouldFail = false,
    errorMessage = 'Mock OCR error',
    confidence = 92.5,
    languages = ['eng'],
  } = options;

  const recognizeText = vi.fn(
    async (
      imagePath: string,
      ocrOptions: { languages?: string[]; enhanceImage?: boolean } = {},
    ) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      if (shouldFail) {
        throw new Error(errorMessage);
      }

      const mockText = `
        This is mock OCR text extracted from the image.
        Line 2 of the recognized text.
        Line 3 with some numbers: 12345
      `.trim();

      const words: MockWordResult[] = mockText.split(/\s+/).map((word, index) => ({
        text: word,
        confidence: confidence - Math.random() * 5,
        boundingBox: {
          x: 10 + (index % 5) * 100,
          y: 10 + Math.floor(index / 5) * 30,
          width: word.length * 10,
          height: 20,
        },
      }));

      return {
        text: mockText,
        confidence,
        words,
        lines: [
          {
            text: 'This is mock OCR text extracted from the image.',
            confidence: confidence,
            boundingBox: { x: 10, y: 10, width: 400, height: 20 },
            words: words.slice(0, 9),
          },
          {
            text: 'Line 2 of the recognized text.',
            confidence: confidence - 2,
            boundingBox: { x: 10, y: 40, width: 250, height: 20 },
            words: words.slice(9, 15),
          },
          {
            text: 'Line 3 with some numbers: 12345',
            confidence: confidence - 1,
            boundingBox: { x: 10, y: 70, width: 280, height: 20 },
            words: words.slice(15),
          },
        ],
        blocks: [],
        language: (ocrOptions.languages ?? languages).join('+'),
        processingTime: delay || 1500,
      };
    },
  );

  const recognizeTextFromBuffer = vi.fn(
    async (
      _buffer: Buffer,
      ocrOptions: { languages?: string[] } = {},
    ) => {
      return recognizeText('/mock/buffer/path', ocrOptions);
    },
  );

  const preprocessImage = vi.fn(
    async (
      _imagePath: string,
      preprocessOptions: {
        deskew?: boolean;
        removeNoise?: boolean;
        improveContrast?: boolean;
      } = {},
    ) => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay / 2));
      }

      const transformations: string[] = [];

      if (preprocessOptions.deskew) {
transformations.push('deskew');
}
      if (preprocessOptions.removeNoise) {
transformations.push('denoise');
}
      if (preprocessOptions.improveContrast) {
transformations.push('contrast');
}

      return {
        buffer: Buffer.from('preprocessed image data'),
        transformations,
        skewAngle: preprocessOptions.deskew ? -1.5 : undefined,
        enhancedContrast: preprocessOptions.improveContrast ? 1.3 : undefined,
      };
    },
  );

  const detectLanguage = vi.fn(async (_imagePath: string) => {
    return languages;
  });

  const terminate = vi.fn(async () => {
    // Cleanup
  });

  return {
    recognizeText,
    recognizeTextFromBuffer,
    preprocessImage,
    detectLanguage,
    terminate,
  };
}

// =============================================================================
// MOCK QUEUE
// =============================================================================

/**
 * Create a mock processing queue for testing
 */
export function createMockProcessingQueue(options: MockQueueOptions = {}) {
  const {
    initialJobs = [],
    shouldFail = false,
    processingDelay = 0,
  } = options;

  const jobs = new Map<string, FileProcessingJob & { status: JobStatus }>();

  // Initialize with any initial jobs
  initialJobs.forEach((job) => {
    jobs.set(job.jobId, { ...job, status: JobStatus.PENDING });
  });

  const initialize = vi.fn(async () => {
    if (shouldFail) {
      throw new Error('Queue initialization failed');
    }
  });

  const close = vi.fn(async () => {
    jobs.clear();
  });

  const addJob = vi.fn(async (job: FileProcessingJob) => {
    if (shouldFail) {
      throw new Error('Failed to add job');
    }
    jobs.set(job.jobId, { ...job, status: JobStatus.PENDING });
    return job.jobId;
  });

  const addBulkJobs = vi.fn(async (jobList: FileProcessingJob[]) => {
    if (shouldFail) {
      throw new Error('Failed to add bulk jobs');
    }
    return jobList.map((job) => {
      jobs.set(job.jobId, { ...job, status: JobStatus.PENDING });
      return job.jobId;
    });
  });

  const getJobStatus = vi.fn(async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
return null;
}

    return {
      jobId: job.jobId,
      status: job.status,
      result: job.status === JobStatus.COMPLETED ? { success: true, content: 'Mock content' } : undefined,
      error: job.status === JobStatus.FAILED ? 'Mock error' : undefined,
      attempts: 1,
      createdAt: job.createdAt,
      processedAt: job.status !== JobStatus.PENDING ? new Date() : undefined,
      finishedAt: job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED ? new Date() : undefined,
    };
  });

  const cancelJob = vi.fn(async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
return false;
}
    if (job.status === JobStatus.PROCESSING) {
return false;
}

    jobs.set(jobId, { ...job, status: JobStatus.CANCELLED });
    return true;
  });

  const retryJob = vi.fn(async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
return false;
}
    if (job.status !== JobStatus.FAILED) {
return false;
}

    jobs.set(jobId, { ...job, status: JobStatus.PENDING });
    return true;
  });

  const getStats = vi.fn(async () => {
    const jobArray = Array.from(jobs.values());
    return {
      waiting: jobArray.filter((j) => j.status === JobStatus.PENDING).length,
      active: jobArray.filter((j) => j.status === JobStatus.PROCESSING).length,
      completed: jobArray.filter((j) => j.status === JobStatus.COMPLETED).length,
      failed: jobArray.filter((j) => j.status === JobStatus.FAILED).length,
      delayed: 0,
      paused: 0,
    };
  });

  const pause = vi.fn(async () => {});
  const resume = vi.fn(async () => {});

  const clearCompleted = vi.fn(async () => {
    let count = 0;
    jobs.forEach((job, id) => {
      if (job.status === JobStatus.COMPLETED) {
        jobs.delete(id);
        count++;
      }
    });
    return count;
  });

  const clearFailed = vi.fn(async () => {
    let count = 0;
    jobs.forEach((job, id) => {
      if (job.status === JobStatus.FAILED) {
        jobs.delete(id);
        count++;
      }
    });
    return count;
  });

  // Simulate job processing
  const processNextJob = vi.fn(async () => {
    const entries = Array.from(jobs.entries());
    for (const [jobId, job] of entries) {
      if (job.status === JobStatus.PENDING) {
        jobs.set(jobId, { ...job, status: JobStatus.PROCESSING });

        if (processingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, processingDelay));
        }

        jobs.set(jobId, { ...job, status: JobStatus.COMPLETED });
        return jobId;
      }
    }
    return null;
  });

  const on = vi.fn();
  const off = vi.fn();

  return {
    initialize,
    close,
    addJob,
    addBulkJobs,
    getJobStatus,
    cancelJob,
    retryJob,
    getStats,
    pause,
    resume,
    clearCompleted,
    clearFailed,
    processNextJob,
    on,
    off,
    // Expose internal state for testing
    _getJobs: () => jobs,
    _setJobStatus: (jobId: string, status: JobStatus) => {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status });
      }
    },
  };
}

// =============================================================================
// MOCK PROCESSING SERVICE
// =============================================================================

/**
 * Create a mock processing service for testing
 */
export function createMockProcessingService() {
  const jobs = new Map<string, {
    id: string;
    fileId: string;
    type: string;
    status: string;
    progress: number;
    result: unknown;
    error: unknown;
    options: Record<string, unknown>;
    userId: string;
    createdAt: Date;
  }>();

  let jobCounter = 0;

  const createJob = vi.fn(async (input: {
    fileId: string;
    type: string;
    options?: Record<string, unknown>;
    userId?: string;
  }) => {
    const jobId = `job_${++jobCounter}`;
    const job = {
      id: jobId,
      fileId: input.fileId,
      type: input.type,
      status: 'PENDING',
      progress: 0,
      result: null,
      error: null,
      options: input.options ?? {},
      userId: input.userId ?? 'test_user',
      createdAt: new Date(),
    };
    jobs.set(jobId, job);
    return job;
  });

  const getJob = vi.fn(async (jobId: string) => {
    return jobs.get(jobId) ?? null;
  });

  const cancelJob = vi.fn(async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job) {
return false;
}
    if (job.status === 'PROCESSING') {
return false;
}

    jobs.set(jobId, { ...job, status: 'CANCELLED' });
    return true;
  });

  const retryJob = vi.fn(async (jobId: string) => {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'FAILED') {
      throw new Error('Job cannot be retried');
    }

    const newJob = { ...job, status: 'PENDING', progress: 0, error: null };
    jobs.set(jobId, newJob);
    return newJob;
  });

  const extractText = vi.fn(async (fileId: string, options?: Record<string, unknown>) => {
    return createJob({ fileId, type: 'TEXT_EXTRACTION', options });
  });

  const runOCR = vi.fn(async (fileId: string, options?: Record<string, unknown>) => {
    return createJob({ fileId, type: 'OCR', options });
  });

  const convertDocument = vi.fn(async (fileId: string, format: string) => {
    return createJob({ fileId, type: 'DOCUMENT_CONVERSION', options: { format } });
  });

  const getQueueStats = vi.fn(async () => {
    const jobArray = Array.from(jobs.values());
    return {
      waiting: jobArray.filter((j) => j.status === 'PENDING').length,
      active: jobArray.filter((j) => j.status === 'PROCESSING').length,
      completed: jobArray.filter((j) => j.status === 'COMPLETED').length,
      failed: jobArray.filter((j) => j.status === 'FAILED').length,
      delayed: 0,
    };
  });

  return {
    createJob,
    getJob,
    cancelJob,
    retryJob,
    extractText,
    runOCR,
    convertDocument,
    getQueueStats,
    // Helper for tests
    _setJobResult: (jobId: string, result: unknown) => {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: 'COMPLETED', progress: 100, result });
      }
    },
    _setJobError: (jobId: string, error: string) => {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: 'FAILED', error });
      }
    },
    _setJobProgress: (jobId: string, progress: number) => {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: 'PROCESSING', progress });
      }
    },
  };
}

// =============================================================================
// HELPER FACTORIES
// =============================================================================

/**
 * Create a mock file processing job
 */
export function createMockFileJob(
  overrides: Partial<FileProcessingJob> = {},
): FileProcessingJob {
  return {
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    filePath: '/mock/path/to/file.pdf',
    filename: 'test-document.pdf',
    fileType: FileType.PDF,
    priority: 5,
    createdAt: new Date(),
    options: {},
    ...overrides,
  };
}

/**
 * Create mock processor result
 */
export function createMockProcessorResult(
  overrides: Partial<ProcessorResult> = {},
): ProcessorResult {
  return {
    success: true,
    content: 'Mock extracted content',
    metadata: {
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      fileType: FileType.PDF,
    },
    processingTime: 100,
    ...overrides,
  };
}

/**
 * Create mock job progress
 */
export function createMockJobProgress(
  overrides: Partial<JobProgress> = {},
): JobProgress {
  return {
    stage: 'processing',
    percentage: 50,
    currentPage: 5,
    totalPages: 10,
    estimatedTimeRemaining: 30,
    ...overrides,
  };
}
