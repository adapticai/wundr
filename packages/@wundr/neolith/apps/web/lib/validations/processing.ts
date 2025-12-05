/**
 * Processing Validation Schemas
 * @module lib/validations/processing
 */

import { z } from 'zod';

export const PROCESSING_ERROR_CODES = {
  INVALID_INPUT: 'PROCESSING_INVALID_INPUT',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  TIMEOUT: 'PROCESSING_TIMEOUT',
  UNSUPPORTED_TYPE: 'PROCESSING_UNSUPPORTED_TYPE',
  UNSUPPORTED_FILE_TYPE: 'PROCESSING_UNSUPPORTED_FILE_TYPE',
  RESOURCE_LIMIT_EXCEEDED: 'PROCESSING_RESOURCE_LIMIT',
  UNAUTHORIZED: 'PROCESSING_UNAUTHORIZED',
  VALIDATION_ERROR: 'PROCESSING_VALIDATION_ERROR',
  FILE_NOT_FOUND: 'PROCESSING_FILE_NOT_FOUND',
  NOT_FOUND: 'PROCESSING_NOT_FOUND',
  NOT_WORKSPACE_MEMBER: 'PROCESSING_NOT_WORKSPACE_MEMBER',
  JOB_ALREADY_COMPLETED: 'PROCESSING_JOB_ALREADY_COMPLETED',
  JOB_ALREADY_CANCELLED: 'PROCESSING_JOB_ALREADY_CANCELLED',
  JOB_IN_PROGRESS: 'PROCESSING_JOB_IN_PROGRESS',
  INTERNAL_ERROR: 'PROCESSING_INTERNAL_ERROR',
} as const;

export type ProcessingErrorCode =
  (typeof PROCESSING_ERROR_CODES)[keyof typeof PROCESSING_ERROR_CODES];

export const processingTypeSchema = z.enum([
  'text',
  'code',
  'markdown',
  'json',
  'csv',
  'image',
  'document',
]);

export const processingJobSchema = z.object({
  id: z.string(),
  type: processingTypeSchema,
  input: z.unknown(),
  status: z.enum([
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'cancelled',
  ]),
  progress: z.number().min(0).max(100),
  result: z.unknown().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const createProcessingJobSchema = z.object({
  type: processingTypeSchema,
  input: z.unknown(),
  options: z.record(z.unknown()).optional(),
  priority: z.number().min(0).max(10).optional(),
});

// Extended job creation schema for API routes (includes fileId, callbackUrl, metadata)
export const createJobSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  type: z.string().min(1, 'Processing type is required'),
  priority: z.string().or(z.number()).optional(),
  options: z.record(z.unknown()).optional(),
  callbackUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const processingResultSchema = z.object({
  jobId: z.string(),
  output: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
  duration: z.number().positive(),
  completedAt: z.string().datetime(),
});

export const batchProcessingSchema = z.object({
  fileIds: z.array(z.string()).min(1, 'At least one file ID is required'),
  type: z.string().min(1, 'Processing type is required'),
  priority: z.string().or(z.number()).optional(),
  callbackUrl: z.string().url().optional(),
  jobs: z.array(createProcessingJobSchema).optional(),
  options: z
    .object({
      parallel: z.boolean().optional(),
      maxConcurrent: z.number().positive().optional(),
      stopOnError: z.boolean().optional(),
    })
    .optional(),
});

// File processing schemas
export const fileIdParamSchema = z.object({
  id: z.string().min(1, 'File ID is required'),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
});

// Query parameters for job listing
export const jobListQuerySchema = z.object({
  status: z
    .enum([
      'pending',
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
    ])
    .optional(),
  type: z.string().optional(),
  fileId: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.coerce.number().positive().optional().default(20),
  cursor: z.string().optional(),
});

// Response schema for job listing
export const jobListSchema = z.object({
  jobs: z.array(processingJobSchema),
  total: z.coerce.number().nonnegative(),
  page: z.coerce.number().positive().optional(),
  pageSize: z.coerce.number().positive().optional(),
});

// OCR schemas
export const ocrOptionsSchema = z.object({
  detectOrientation: z.boolean().optional().default(false),
  preserveFormatting: z.boolean().optional().default(true),
  dpi: z.number().positive().optional().default(300),
});

export const ocrRequestSchema = z.object({
  language: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .default('eng'),
  options: ocrOptionsSchema.optional(),
});

// Text extraction schemas
export const extractOptionsSchema = z.object({
  preserveFormatting: z.boolean().optional().default(true),
  includeMetadata: z.boolean().optional().default(false),
  pages: z
    .object({
      start: z.number().positive(),
      end: z.number().positive(),
    })
    .optional(),
});

// Conversion schemas
export const convertOptionsSchema = z.object({
  format: z.enum(['pdf', 'docx', 'txt', 'html', 'markdown']),
  options: z
    .object({
      quality: z.enum(['low', 'medium', 'high']).optional().default('medium'),
      preserveImages: z.boolean().optional().default(true),
      preserveLinks: z.boolean().optional().default(true),
    })
    .optional(),
});

// Type exports for TypeScript
export type BatchProcessingInput = z.infer<typeof batchProcessingSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobListInput = z.infer<typeof jobListQuerySchema>;
export type JobListResponse = z.infer<typeof jobListSchema>;
export type ProcessingJob = z.infer<typeof processingJobSchema>;
export type ProcessingResult = z.infer<typeof processingResultSchema>;
export type ProcessingType = z.infer<typeof processingTypeSchema>;

// Error response schema
export const createProcessingErrorResponse = (
  message: string,
  code: ProcessingErrorCode,
  details?: Record<string, unknown>,
) => ({
  error: {
    code,
    message,
    details,
  },
});

// File type support functions
const OCR_SUPPORTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'application/pdf',
];
const TEXT_EXTRACTION_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/html',
  'text/markdown',
];
const CONVERSION_SUPPORTED_TYPES = Array.from(
  new Set([...OCR_SUPPORTED_TYPES, ...TEXT_EXTRACTION_TYPES]),
);

export const supportsOCR = (mimeType: string): boolean => {
  return OCR_SUPPORTED_TYPES.includes(mimeType.toLowerCase());
};

export const supportsTextExtraction = (mimeType: string): boolean => {
  return TEXT_EXTRACTION_TYPES.includes(mimeType.toLowerCase());
};

export const supportsConversion = (mimeType: string): boolean => {
  return CONVERSION_SUPPORTED_TYPES.includes(mimeType.toLowerCase());
};
