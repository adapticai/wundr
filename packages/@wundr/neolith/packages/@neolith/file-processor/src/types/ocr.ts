/**
 * @genesis/file-processor - OCR Type Definitions
 *
 * Comprehensive type definitions for OCR (Optical Character Recognition) operations.
 * Supports multiple OCR engines, languages, and output formats.
 *
 * @packageDocumentation
 */

/**
 * Supported OCR engine types
 */
export enum OCREngine {
  /** Tesseract.js - Default browser/Node.js OCR engine */
  TESSERACT = 'tesseract',
  /** Cloud Vision API (future support) */
  GOOGLE_VISION = 'google_vision',
  /** AWS Textract (future support) */
  AWS_TEXTRACT = 'aws_textract',
  /** Azure Computer Vision (future support) */
  AZURE_VISION = 'azure_vision',
}

/**
 * Page segmentation modes for OCR processing
 * Controls how the engine segments the image into text regions
 */
export enum PageSegMode {
  /** Orientation and script detection only */
  OSD_ONLY = 0,
  /** Automatic page segmentation with OSD */
  AUTO_WITH_OSD = 1,
  /** Automatic page segmentation without OSD or OCR */
  AUTO_NO_OSD = 2,
  /** Fully automatic page segmentation (default) */
  AUTO = 3,
  /** Assume a single column of text of variable sizes */
  SINGLE_COLUMN = 4,
  /** Assume a single uniform block of vertically aligned text */
  SINGLE_BLOCK_VERTICAL = 5,
  /** Assume a single uniform block of text */
  SINGLE_BLOCK = 6,
  /** Treat the image as a single text line */
  SINGLE_LINE = 7,
  /** Treat the image as a single word */
  SINGLE_WORD = 8,
  /** Treat the image as a single word in a circle */
  SINGLE_WORD_CIRCLE = 9,
  /** Treat the image as a single character */
  SINGLE_CHAR = 10,
  /** Find as much text as possible in no particular order */
  SPARSE_TEXT = 11,
  /** Sparse text with OSD */
  SPARSE_TEXT_OSD = 12,
  /** Raw line - treat the image as a single text line */
  RAW_LINE = 13,
}

/**
 * OCR engine mode - controls accuracy vs speed tradeoff
 */
export enum OCREngineMode {
  /** Legacy engine only (fastest) */
  LEGACY_ONLY = 0,
  /** Neural nets LSTM engine only */
  LSTM_ONLY = 1,
  /** Legacy + LSTM engines */
  LEGACY_LSTM_COMBINED = 2,
  /** Default - based on what is available */
  DEFAULT = 3,
}

/**
 * Supported OCR languages
 */
export const SUPPORTED_LANGUAGES = [
  'eng', // English
  'spa', // Spanish
  'fra', // French
  'deu', // German
  'ita', // Italian
  'por', // Portuguese
  'chi_sim', // Chinese Simplified
  'chi_tra', // Chinese Traditional
  'jpn', // Japanese
  'kor', // Korean
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Bounding box coordinates for text regions
 */
export interface BoundingBox {
  /** Left x-coordinate */
  x0: number;
  /** Top y-coordinate */
  y0: number;
  /** Right x-coordinate */
  x1: number;
  /** Bottom y-coordinate */
  y1: number;
}

/**
 * Extended bounding box with additional metrics
 */
export interface ExtendedBoundingBox extends BoundingBox {
  /** Width of the box */
  width: number;
  /** Height of the box */
  height: number;
  /** Center x-coordinate */
  centerX: number;
  /** Center y-coordinate */
  centerY: number;
}

/**
 * OCR processing options
 */
export interface OCROptions {
  /** OCR language(s) to use - can be single or multiple */
  language?: string | string[];

  /** Page segmentation mode */
  pageSegmentationMode?: PageSegMode;

  /** OCR engine mode */
  ocrEngineMode?: OCREngineMode;

  /** Preserve inter-word spaces in output */
  preserveInterwordSpaces?: boolean;

  /** Image DPI for processing (affects recognition quality) */
  dpi?: number;

  /** Confidence threshold (0-100) - words below this are filtered */
  confidenceThreshold?: number;

  /** Output format for text */
  outputFormat?: 'text' | 'hocr' | 'tsv' | 'alto';

  /** Enable word-level output */
  includeWordDetails?: boolean;

  /** Enable line-level output */
  includeLineDetails?: boolean;

  /** Enable block-level output */
  includeBlockDetails?: boolean;

  /** Timeout for processing in milliseconds */
  timeout?: number;
}

/**
 * PDF-specific OCR options
 */
export interface PDFOCROptions extends OCROptions {
  /** Page range to process */
  pageRange?: {
    start: number;
    end: number;
  };

  /** Maximum pages to process */
  maxPages?: number;

  /** DPI to use when converting PDF pages to images */
  renderDpi?: number;

  /** Whether to skip pages with existing text layer */
  skipTextPages?: boolean;
}

/**
 * OCR word with position and confidence
 */
export interface OCRWord {
  /** Recognized text */
  text: string;

  /** Confidence score (0-100) */
  confidence: number;

  /** Bounding box coordinates */
  bbox: BoundingBox;

  /** Font information if available */
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
  };

  /** Baseline information */
  baseline?: {
    angle: number;
    offset: number;
  };
}

/**
 * OCR line containing multiple words
 */
export interface OCRLine {
  /** Full text of the line */
  text: string;

  /** Average confidence score for the line */
  confidence: number;

  /** Bounding box coordinates */
  bbox: BoundingBox;

  /** Words in this line */
  words: OCRWord[];

  /** Line direction (for RTL support) */
  direction?: 'ltr' | 'rtl';
}

/**
 * OCR paragraph containing multiple lines
 */
export interface OCRParagraph {
  /** Full text of the paragraph */
  text: string;

  /** Average confidence score */
  confidence: number;

  /** Bounding box coordinates */
  bbox: BoundingBox;

  /** Lines in this paragraph */
  lines: OCRLine[];
}

/**
 * OCR block (region of text)
 */
export interface OCRBlock {
  /** Full text of the block */
  text: string;

  /** Average confidence score */
  confidence: number;

  /** Bounding box coordinates */
  bbox: BoundingBox;

  /** Block type */
  blockType: BlockType;

  /** Paragraphs in this block */
  paragraphs: OCRParagraph[];
}

/**
 * Types of text blocks
 */
export enum BlockType {
  /** Regular text */
  TEXT = 'text',
  /** Table structure */
  TABLE = 'table',
  /** Image region */
  IMAGE = 'image',
  /** Separator line */
  SEPARATOR = 'separator',
  /** Page header */
  HEADER = 'header',
  /** Page footer */
  FOOTER = 'footer',
  /** Caption text */
  CAPTION = 'caption',
  /** Unknown type */
  UNKNOWN = 'unknown',
}

/**
 * Complete OCR result for a single image
 */
export interface OCRResult {
  /** Extracted plain text content */
  text: string;

  /** Overall confidence score (0-100) */
  confidence: number;

  /** Individual words with positions */
  words: OCRWord[];

  /** Lines with positions */
  lines: OCRLine[];

  /** Text blocks/regions */
  blocks: OCRBlock[];

  /** hOCR output if requested */
  hocr?: string;

  /** Detected language */
  detectedLanguage?: string;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Image dimensions */
  imageDimensions: {
    width: number;
    height: number;
  };

  /** Page rotation detected (degrees) */
  rotationAngle?: number;

  /** Script detection result */
  script?: string;
}

/**
 * Document OCR result with additional document-level data
 */
export interface DocumentOCRResult extends OCRResult {
  /** Document type classification */
  documentType?: DocumentType;

  /** Detected document language */
  documentLanguage?: string;

  /** Document orientation */
  orientation?: 'portrait' | 'landscape';

  /** Reading order of blocks */
  readingOrder?: number[];

  /** Extracted form fields if detected */
  formFields?: FormField[];

  /** Extracted tables */
  tables?: TableResult[];
}

/**
 * Document type classification
 */
export enum DocumentType {
  /** General document */
  GENERAL = 'general',
  /** Invoice document */
  INVOICE = 'invoice',
  /** Receipt */
  RECEIPT = 'receipt',
  /** Business card */
  BUSINESS_CARD = 'business_card',
  /** ID document */
  ID_DOCUMENT = 'id_document',
  /** Form */
  FORM = 'form',
  /** Letter */
  LETTER = 'letter',
  /** Contract */
  CONTRACT = 'contract',
  /** Table/spreadsheet */
  TABLE = 'table',
  /** Handwritten note */
  HANDWRITTEN = 'handwritten',
}

/**
 * Form field extraction result
 */
export interface FormField {
  /** Field key/label */
  key: string;

  /** Field value */
  value: string;

  /** Confidence score for this extraction */
  confidence: number;

  /** Bounding box for the field */
  bbox?: BoundingBox;
}

/**
 * Table extraction result
 */
export interface TableResult {
  /** Table headers */
  headers: string[];

  /** Table rows */
  rows: string[][];

  /** Number of columns */
  columnCount: number;

  /** Number of rows */
  rowCount: number;

  /** Confidence score for table extraction */
  confidence: number;

  /** Bounding box for the table */
  bbox?: BoundingBox;

  /** Cell-level information */
  cells?: TableCell[][];
}

/**
 * Individual table cell
 */
export interface TableCell {
  /** Cell text content */
  text: string;

  /** Row index */
  rowIndex: number;

  /** Column index */
  columnIndex: number;

  /** Row span */
  rowSpan: number;

  /** Column span */
  colSpan: number;

  /** Confidence score */
  confidence: number;

  /** Bounding box */
  bbox?: BoundingBox;
}

/**
 * Progress callback for long-running operations
 */
export type OCRProgressCallback = (progress: OCRProgress) => void;

/**
 * Progress information
 */
export interface OCRProgress {
  /** Current processing stage */
  stage: OCRProcessingStage;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current item being processed (e.g., page number) */
  currentItem?: number;

  /** Total items to process */
  totalItems?: number;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;

  /** Status message */
  message?: string;
}

/**
 * OCR processing stages
 */
export enum OCRProcessingStage {
  /** Initializing OCR engine */
  INITIALIZING = 'initializing',
  /** Loading language data */
  LOADING_LANGUAGE = 'loading_language',
  /** Preprocessing image */
  PREPROCESSING = 'preprocessing',
  /** Running OCR recognition */
  RECOGNIZING = 'recognizing',
  /** Post-processing results */
  POSTPROCESSING = 'postprocessing',
  /** Completed */
  COMPLETED = 'completed',
  /** Failed */
  FAILED = 'failed',
}

/**
 * OCR service configuration
 */
export interface OCRServiceConfig {
  /** Default language(s) */
  defaultLanguages: string[];

  /** Number of worker threads */
  workerPoolSize: number;

  /** Path to language data files */
  languageDataPath?: string;

  /** Cache language data in memory */
  cacheLanguageData: boolean;

  /** Default timeout in milliseconds */
  defaultTimeout: number;

  /** Enable logging */
  enableLogging: boolean;

  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * OCR service statistics
 */
export interface OCRServiceStats {
  /** Total documents processed */
  totalProcessed: number;

  /** Total processing time in milliseconds */
  totalProcessingTime: number;

  /** Average confidence score */
  averageConfidence: number;

  /** Number of failures */
  failureCount: number;

  /** Active worker count */
  activeWorkers: number;

  /** Queued jobs count */
  queuedJobs: number;
}

/**
 * Error types for OCR operations
 */
export enum OCRErrorType {
  /** Invalid input image */
  INVALID_IMAGE = 'INVALID_IMAGE',
  /** Language not supported or not loaded */
  LANGUAGE_NOT_AVAILABLE = 'LANGUAGE_NOT_AVAILABLE',
  /** Processing timeout */
  TIMEOUT = 'TIMEOUT',
  /** Worker initialization failed */
  WORKER_INIT_FAILED = 'WORKER_INIT_FAILED',
  /** Out of memory */
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * OCR-specific error
 */
export interface OCRError {
  /** Error type */
  type: OCRErrorType;

  /** Error message */
  message: string;

  /** Stack trace if available */
  stack?: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}
