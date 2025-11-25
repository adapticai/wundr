/**
 * @genesis/file-processor - Type Definitions
 *
 * Core type definitions for file processing operations.
 */

/**
 * Supported file types for processing
 */
export enum FileType {
  PDF = 'pdf',
  DOCX = 'docx',
  XLSX = 'xlsx',
  IMAGE = 'image',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  TIFF = 'tiff',
  UNKNOWN = 'unknown',
}

/**
 * File metadata extracted during processing
 */
export interface FileMetadata {
  /** Original filename */
  filename: string;

  /** File MIME type */
  mimeType: string;

  /** File size in bytes */
  size: number;

  /** Detected file type */
  fileType: FileType;

  /** File creation timestamp */
  createdAt?: Date;

  /** File modification timestamp */
  modifiedAt?: Date;

  /** Number of pages (for documents) */
  pageCount?: number;

  /** Image dimensions (for images) */
  dimensions?: {
    width: number;
    height: number;
  };

  /** Document author (if available) */
  author?: string;

  /** Document title (if available) */
  title?: string;

  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Result of file processing operation
 */
export interface ProcessorResult {
  /** Whether processing was successful */
  success: boolean;

  /** Extracted text content */
  content: string;

  /** File metadata */
  metadata: FileMetadata;

  /** Processing duration in milliseconds */
  processingTime: number;

  /** Error message if processing failed */
  error?: string;

  /** Structured data extracted from the file */
  structuredData?: Record<string, unknown>;

  /** OCR confidence score (0-1) for image processing */
  ocrConfidence?: number;

  /** Individual page contents (for multi-page documents) */
  pages?: PageContent[];
}

/**
 * Content of a single page in a document
 */
export interface PageContent {
  /** Page number (1-indexed) */
  pageNumber: number;

  /** Text content of the page */
  content: string;

  /** Tables extracted from the page */
  tables?: TableData[];

  /** Images extracted from the page */
  images?: ImageData[];
}

/**
 * Extracted table data
 */
export interface TableData {
  /** Table headers */
  headers: string[];

  /** Table rows */
  rows: string[][];

  /** Table position on page */
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Extracted image data
 */
export interface ImageData {
  /** Image identifier */
  id: string;

  /** Image format */
  format: string;

  /** Base64 encoded image data */
  data?: string;

  /** Image dimensions */
  dimensions: {
    width: number;
    height: number;
  };

  /** OCR text extracted from image */
  ocrText?: string;
}

/**
 * File processing job data for queue
 */
export interface FileProcessingJob {
  /** Unique job identifier */
  jobId: string;

  /** Path or URL to the file */
  filePath: string;

  /** Original filename */
  filename: string;

  /** File type hint */
  fileType?: FileType;

  /** Processing options */
  options?: ProcessingOptions;

  /** Callback URL for results */
  callbackUrl?: string;

  /** Priority level (1-10, higher is more urgent) */
  priority?: number;

  /** Tenant/organization ID */
  tenantId?: string;

  /** User ID who initiated the job */
  userId?: string;

  /** Timestamp when job was created */
  createdAt: Date;
}

/**
 * Processing options for file operations
 */
export interface ProcessingOptions {
  /** Enable OCR for images and scanned PDFs */
  enableOcr?: boolean;

  /** OCR language(s) */
  ocrLanguages?: string[];

  /** Extract tables from documents */
  extractTables?: boolean;

  /** Extract images from documents */
  extractImages?: boolean;

  /** Maximum pages to process (for large documents) */
  maxPages?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Custom processor options */
  custom?: Record<string, unknown>;
}

/**
 * Job status enumeration
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Job progress information
 */
export interface JobProgress {
  /** Current processing stage */
  stage: string;

  /** Percentage complete (0-100) */
  percentage: number;

  /** Current page being processed */
  currentPage?: number;

  /** Total pages to process */
  totalPages?: number;

  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
}
