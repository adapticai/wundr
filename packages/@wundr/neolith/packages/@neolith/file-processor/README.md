# @genesis/file-processor

File processing service for Genesis-App with support for PDF, DOCX, XLSX, and image files with OCR
capabilities.

## Features

- **PDF Processing**: Extract text and metadata from PDF files with OCR fallback for scanned
  documents
- **DOCX Processing**: Extract text, formatting, and structure from Word documents
- **XLSX Processing**: Parse Excel spreadsheets with support for multiple sheets and cell formatting
- **Image OCR**: Extract text from images using Tesseract.js with pre-processing options
- **Queue-Based Processing**: BullMQ-powered job queue for reliable, distributed file processing
- **Configurable**: Extensive configuration options for all processors

## Installation

```bash
npm install @genesis/file-processor
```

## Quick Start

```typescript
import { FileProcessor, createFileProcessor } from '@genesis/file-processor';

// Create processor instance
const processor = createFileProcessor({
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Initialize (required for queue-based processing)
await processor.initialize();

// Process a file synchronously
const result = await processor.processFile('/path/to/document.pdf');

if (result.success) {
  console.log('Extracted text:', result.content);
  console.log('Metadata:', result.metadata);
}

// Shutdown when done
await processor.shutdown();
```

## Queue-Based Processing

For asynchronous processing of large files or high-volume workloads:

```typescript
import { FileProcessor, FileProcessingJob, QueueEvent } from '@genesis/file-processor';

const processor = createFileProcessor();
await processor.initialize();

// Listen for queue events
processor.getQueue().on(QueueEvent.JOB_COMPLETED, (event, data) => {
  console.log('Job completed:', data);
});

// Add job to queue
const jobId = await processor.queueFile({
  jobId: 'unique-job-id',
  filePath: '/path/to/document.pdf',
  filename: 'document.pdf',
  options: {
    enableOcr: true,
    extractTables: true,
  },
  callbackUrl: 'https://your-api.com/webhook',
  createdAt: new Date(),
});

// Check job status
const status = await processor.getQueue().getJobStatus(jobId);
```

## Processors

### PDF Processor

```typescript
import { createPdfProcessor, defaultConfig } from '@genesis/file-processor';

const pdfProcessor = createPdfProcessor(defaultConfig);

const result = await pdfProcessor.process('/path/to/document.pdf', {
  enableOcr: true, // Enable OCR for scanned PDFs
  ocrFallback: true, // Fallback to OCR if text layer is empty
  extractTables: true, // Extract table structures
  maxPages: 50, // Limit pages to process
});
```

### DOCX Processor

```typescript
import { createDocxProcessor, defaultConfig } from '@genesis/file-processor';

const docxProcessor = createDocxProcessor(defaultConfig);

const result = await docxProcessor.process('/path/to/document.docx', {
  outputFormat: 'html', // 'text' | 'html' | 'markdown'
  preserveFormatting: true, // Keep formatting in output
  extractEmbeddedImages: true, // Extract embedded images
  extractTables: true, // Extract table structures
});
```

### XLSX Processor

```typescript
import { createXlsxProcessor, defaultConfig } from '@genesis/file-processor';

const xlsxProcessor = createXlsxProcessor(defaultConfig);

const result = await xlsxProcessor.process('/path/to/spreadsheet.xlsx', {
  sheets: ['Sheet1', 'Sheet2'], // Specific sheets to process
  firstRowAsHeaders: true, // Treat first row as headers
  skipEmptyRows: true, // Skip empty rows
  maxRowsPerSheet: 1000, // Limit rows per sheet
  outputFormat: 'json', // 'json' | 'csv' | 'text'
});
```

### Image Processor (OCR)

```typescript
import { createImageProcessor, defaultConfig, PageSegmentationMode } from '@genesis/file-processor';

const imageProcessor = createImageProcessor(defaultConfig);
await imageProcessor.initialize();

const result = await imageProcessor.process('/path/to/image.png', {
  ocrLanguages: ['eng', 'deu'], // OCR languages
  preprocessing: {
    grayscale: true, // Convert to grayscale
    contrast: 1.5, // Increase contrast
    sharpen: true, // Sharpen image
    denoise: true, // Remove noise
  },
  includeBoundingBoxes: true, // Include text positions
  pageSegMode: PageSegmentationMode.AUTO,
});

await imageProcessor.cleanup();
```

## Configuration

### Full Configuration Example

```typescript
import { createFileProcessor, FileProcessorConfig } from '@genesis/file-processor';

const config: Partial<FileProcessorConfig> = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true',
  },

  queue: {
    name: 'file-processing',
    concurrency: 3,
    jobTimeout: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 5000,
  },

  storage: {
    type: 's3',
    bucket: 'my-bucket',
    region: 'us-east-1',
    tempDir: '/tmp/file-processor',
    cleanupTemp: true,
  },

  ocr: {
    defaultLanguages: ['eng'],
    workerPoolSize: 2,
    cacheTrainedData: true,
  },

  defaultProcessingOptions: {
    enableOcr: true,
    extractTables: true,
    extractImages: false,
    maxPages: 100,
    timeout: 300000,
  },

  maxFileSize: 100 * 1024 * 1024, // 100 MB
  enableMetrics: true,
  logLevel: 'info',
};

const processor = createFileProcessor(config);
```

## Types

### ProcessorResult

```typescript
interface ProcessorResult {
  success: boolean;
  content: string;
  metadata: FileMetadata;
  processingTime: number;
  error?: string;
  structuredData?: Record<string, unknown>;
  ocrConfidence?: number;
  pages?: PageContent[];
}
```

### FileMetadata

```typescript
interface FileMetadata {
  filename: string;
  mimeType: string;
  size: number;
  fileType: FileType;
  createdAt?: Date;
  modifiedAt?: Date;
  pageCount?: number;
  dimensions?: { width: number; height: number };
  author?: string;
  title?: string;
  custom?: Record<string, unknown>;
}
```

### FileType

```typescript
enum FileType {
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
```

## Queue Management

```typescript
const queue = processor.getQueue();

// Get queue statistics
const stats = await queue.getStats();
console.log('Waiting:', stats.waiting);
console.log('Active:', stats.active);
console.log('Completed:', stats.completed);
console.log('Failed:', stats.failed);

// Pause/resume queue
await queue.pause();
await queue.resume();

// Cancel a job
await queue.cancelJob('job-id');

// Retry a failed job
await queue.retryJob('job-id');

// Clear completed/failed jobs
await queue.clearCompleted();
await queue.clearFailed();
```

## Dependencies

- **bullmq**: Reliable queue management
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX processing
- **exceljs**: XLSX processing
- **tesseract.js**: OCR engine
- **sharp**: Image pre-processing
- **ioredis**: Redis client

## Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TLS=false

# Queue Configuration
QUEUE_CONCURRENCY=3

# Storage Configuration
STORAGE_TYPE=local
STORAGE_BASE_PATH=./uploads
STORAGE_BUCKET=
STORAGE_REGION=
TEMP_DIR=/tmp/genesis-file-processor

# OCR Configuration
TESSERACT_DATA_PATH=

# Logging
LOG_LEVEL=info
```

## License

MIT
