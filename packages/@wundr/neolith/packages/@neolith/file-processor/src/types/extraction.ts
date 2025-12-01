/**
 * @genesis/file-processor - Extraction Types
 *
 * Core type definitions for text extraction operations across different document formats.
 *
 * @packageDocumentation
 */

// Note: These types from ../types are re-exported with more specific definitions in this file
// import type { FileMetadata, TableData, ImageData } from '../types';

// ============================================================================
// Core Extraction Types
// ============================================================================

/**
 * Input configuration for text extraction operations.
 */
export interface ExtractionInput {
  /** File buffer containing the document data */
  buffer: Buffer;

  /** Original filename (used for type detection) */
  filename?: string;

  /** MIME type hint for the file */
  mimeType?: string;

  /** Processing options */
  options?: ExtractionOptions;
}

/**
 * General extraction options applicable to all document types.
 */
export interface ExtractionOptions {
  /** Maximum number of pages to extract (for paginated documents) */
  maxPages?: number;

  /** Extract embedded tables */
  extractTables?: boolean;

  /** Extract embedded images */
  extractImages?: boolean;

  /** Enable OCR for scanned documents */
  enableOcr?: boolean;

  /** OCR language codes (e.g., 'eng', 'deu', 'fra') */
  ocrLanguages?: string[];

  /** Preserve original formatting where possible */
  preserveFormatting?: boolean;

  /** Include document metadata in output */
  includeMetadata?: boolean;

  /** Processing timeout in milliseconds */
  timeout?: number;

  /** Custom options specific to file type */
  custom?: Record<string, unknown>;
}

/**
 * Result of a text extraction operation.
 */
export interface ExtractionResult {
  /** Extracted plain text content */
  text: string;

  /** Individual page contents (for paginated documents) */
  pages?: PageContent[];

  /** Document metadata */
  metadata: DocumentMetadata;

  /** Extracted tables from the document */
  tables?: ExtractedTable[];

  /** Extracted images from the document */
  images?: ExtractedImage[];

  /** Whether extraction was successful */
  success: boolean;

  /** Error message if extraction failed */
  error?: string;

  /** Processing duration in milliseconds */
  processingTime: number;

  /** Warnings encountered during extraction */
  warnings?: string[];
}

/**
 * Metadata extracted from a document.
 */
export interface DocumentMetadata {
  /** Document title */
  title?: string;

  /** Document author */
  author?: string;

  /** Document subject */
  subject?: string;

  /** Keywords associated with the document */
  keywords?: string[];

  /** Document creation date */
  createdAt?: Date;

  /** Document modification date */
  modifiedAt?: Date;

  /** Total page count */
  pageCount?: number;

  /** Total word count */
  wordCount?: number;

  /** Total character count */
  characterCount?: number;

  /** Document language (ISO 639-1 code) */
  language?: string;

  /** PDF version (for PDF files) */
  pdfVersion?: string;

  /** Whether document is encrypted */
  encrypted?: boolean;

  /** Application that created the document */
  creator?: string;

  /** Application that produced the document */
  producer?: string;

  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Content extracted from a single page.
 */
export interface PageContent {
  /** Page number (1-indexed) */
  pageNumber: number;

  /** Text content of the page */
  text: string;

  /** Tables found on this page */
  tables?: ExtractedTable[];

  /** Images found on this page */
  images?: ExtractedImage[];

  /** Page dimensions */
  dimensions?: PageDimensions;

  /** Text blocks with positioning information */
  textBlocks?: TextBlock[];
}

/**
 * Page dimension information.
 */
export interface PageDimensions {
  /** Page width in points (1/72 inch) */
  width: number;

  /** Page height in points (1/72 inch) */
  height: number;

  /** Page rotation in degrees */
  rotation?: number;
}

/**
 * A block of text with position information.
 */
export interface TextBlock {
  /** Text content */
  text: string;

  /** Bounding box coordinates */
  boundingBox: BoundingBox;

  /** Font information */
  font?: FontInfo;

  /** Confidence score for OCR-extracted text (0-1) */
  confidence?: number;
}

/**
 * Bounding box for positioned elements.
 */
export interface BoundingBox {
  /** Left coordinate */
  x: number;

  /** Top coordinate */
  y: number;

  /** Width */
  width: number;

  /** Height */
  height: number;
}

/**
 * Font information for text elements.
 */
export interface FontInfo {
  /** Font name/family */
  name?: string;

  /** Font size in points */
  size?: number;

  /** Whether text is bold */
  bold?: boolean;

  /** Whether text is italic */
  italic?: boolean;

  /** Text color (hex) */
  color?: string;
}

// ============================================================================
// Table Extraction Types
// ============================================================================

/**
 * Table data extracted from a document.
 */
export interface ExtractedTable {
  /** Table headers (first row if detected as headers) */
  headers: string[];

  /** Table data rows */
  rows: string[][];

  /** Starting row index in the document */
  startRow?: number;

  /** Ending row index in the document */
  endRow?: number;

  /** Table position on the page */
  boundingBox?: BoundingBox;

  /** Page number where table was found */
  pageNumber?: number;

  /** Number of columns */
  columnCount: number;

  /** Number of rows */
  rowCount: number;

  /** Table caption or title if detected */
  caption?: string;

  /** Merged cell information */
  mergedCells?: MergedCellInfo[];
}

/**
 * Information about merged cells in a table.
 */
export interface MergedCellInfo {
  /** Starting row index */
  startRow: number;

  /** Starting column index */
  startColumn: number;

  /** Number of rows spanned */
  rowSpan: number;

  /** Number of columns spanned */
  colSpan: number;
}

/**
 * Detected table structure information.
 */
export interface TableStructure {
  /** Number of detected columns */
  columnCount: number;

  /** Number of detected rows */
  rowCount: number;

  /** Whether first row appears to be headers */
  hasHeaders: boolean;

  /** Column types detected */
  columnTypes: ColumnType[];

  /** Column widths (relative) */
  columnWidths?: number[];
}

/**
 * Detected column data type.
 */
export type ColumnType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'currency'
  | 'percentage'
  | 'mixed'
  | 'empty';

// ============================================================================
// Image Extraction Types
// ============================================================================

/**
 * Image extracted from a document.
 */
export interface ExtractedImage {
  /** Unique identifier for the image */
  id: string;

  /** Image format (e.g., 'png', 'jpeg', 'gif') */
  format: string;

  /** MIME type of the image */
  mimeType: string;

  /** Image dimensions */
  dimensions: ImageDimensions;

  /** Base64-encoded image data (if requested) */
  data?: string;

  /** Raw image buffer (if requested) */
  buffer?: Buffer;

  /** Page number where image was found */
  pageNumber?: number;

  /** Image position on the page */
  boundingBox?: BoundingBox;

  /** Image alt text or description */
  altText?: string;

  /** OCR text extracted from the image */
  ocrText?: string;

  /** OCR confidence score (0-1) */
  ocrConfidence?: number;

  /** File size in bytes */
  size?: number;
}

/**
 * Image dimension information.
 */
export interface ImageDimensions {
  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Bits per pixel */
  bitsPerPixel?: number;

  /** Color space (e.g., 'RGB', 'CMYK', 'Grayscale') */
  colorSpace?: string;
}

// ============================================================================
// PDF-Specific Types
// ============================================================================

/**
 * PDF extraction options.
 */
export interface PDFOptions extends ExtractionOptions {
  /** Extract text layer */
  extractTextLayer?: boolean;

  /** Extract PDF outlines/bookmarks */
  extractOutlines?: boolean;

  /** Extract PDF annotations */
  extractAnnotations?: boolean;

  /** Extract PDF form fields */
  extractFormFields?: boolean;

  /** Fallback to OCR if text layer is empty */
  ocrFallback?: boolean;

  /** Page range to extract */
  pageRange?: PageRange;

  /** Password for encrypted PDFs */
  password?: string;

  /** Render pages to images for OCR */
  renderForOcr?: boolean;

  /** DPI for rendered images */
  renderDpi?: number;
}

/**
 * Page range specification.
 */
export interface PageRange {
  /** Starting page (1-indexed) */
  start: number;

  /** Ending page (inclusive, 1-indexed) */
  end?: number;
}

/**
 * PDF extraction result.
 */
export interface PDFExtractionResult extends ExtractionResult {
  /** Individual PDF pages */
  pages: PDFPage[];

  /** PDF outline/bookmark structure */
  outlines?: PDFOutline[];

  /** PDF annotations */
  annotations?: PDFAnnotation[];

  /** PDF form fields */
  formFields?: PDFFormField[];

  /** PDF-specific metadata */
  pdfMetadata?: PDFMetadata;
}

/**
 * Content from a single PDF page.
 */
export interface PDFPage extends PageContent {
  /** Page label (may differ from page number) */
  label?: string;

  /** Whether page was processed with OCR */
  ocrProcessed?: boolean;

  /** OCR confidence for the page (0-1) */
  ocrConfidence?: number;

  /** Page rotation in degrees */
  rotation?: number;

  /** Annotations on this page */
  annotations?: PDFAnnotation[];
}

/**
 * PDF outline/bookmark entry.
 */
export interface PDFOutline {
  /** Outline title */
  title: string;

  /** Target page number */
  pageNumber?: number;

  /** Destination coordinates */
  destination?: {
    x?: number;
    y?: number;
    zoom?: number;
  };

  /** Child outline entries */
  children?: PDFOutline[];

  /** Whether outline is expanded by default */
  expanded?: boolean;
}

/**
 * PDF annotation.
 */
export interface PDFAnnotation {
  /** Annotation type */
  type: PDFAnnotationType;

  /** Annotation content/text */
  content?: string;

  /** Page number */
  pageNumber: number;

  /** Position on page */
  boundingBox: BoundingBox;

  /** Author of the annotation */
  author?: string;

  /** Creation date */
  createdAt?: Date;

  /** Modification date */
  modifiedAt?: Date;

  /** Color (hex) */
  color?: string;

  /** Reply to another annotation */
  replyTo?: string;
}

/**
 * PDF annotation types.
 */
export type PDFAnnotationType =
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggly'
  | 'freetext'
  | 'line'
  | 'square'
  | 'circle'
  | 'polygon'
  | 'polyline'
  | 'stamp'
  | 'caret'
  | 'ink'
  | 'popup'
  | 'fileattachment'
  | 'sound'
  | 'movie'
  | 'widget'
  | 'screen'
  | 'printermark'
  | 'trapnet'
  | 'watermark'
  | '3d'
  | 'redact'
  | 'link';

/**
 * PDF form field.
 */
export interface PDFFormField {
  /** Field name */
  name: string;

  /** Field type */
  type: PDFFormFieldType;

  /** Current value */
  value?: string | string[] | boolean;

  /** Default value */
  defaultValue?: string | string[] | boolean;

  /** Options for select/combo fields */
  options?: string[];

  /** Whether field is required */
  required?: boolean;

  /** Whether field is read-only */
  readOnly?: boolean;

  /** Page number */
  pageNumber?: number;

  /** Position on page */
  boundingBox?: BoundingBox;
}

/**
 * PDF form field types.
 */
export type PDFFormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'combo'
  | 'button'
  | 'signature';

/**
 * PDF-specific metadata.
 */
export interface PDFMetadata extends DocumentMetadata {
  /** PDF version (e.g., '1.7') */
  pdfVersion: string;

  /** Whether PDF is linearized (fast web view) */
  linearized?: boolean;

  /** PDF/A compliance level */
  pdfaCompliance?: string;

  /** Whether PDF is tagged (accessible) */
  tagged?: boolean;

  /** Whether PDF contains JavaScript */
  hasJavaScript?: boolean;

  /** Whether PDF has embedded files */
  hasEmbeddedFiles?: boolean;

  /** Whether PDF is digitally signed */
  isSigned?: boolean;

  /** Number of embedded fonts */
  embeddedFonts?: number;
}

// ============================================================================
// DOCX-Specific Types
// ============================================================================

/**
 * DOCX extraction options.
 */
export interface DocxOptions extends ExtractionOptions {
  /** Output format */
  outputFormat?: 'text' | 'html' | 'markdown';

  /** Preserve document formatting */
  preserveFormatting?: boolean;

  /** Extract embedded images */
  extractEmbeddedImages?: boolean;

  /** Convert images to base64 */
  inlineImages?: boolean;

  /** Extract comments */
  extractComments?: boolean;

  /** Extract track changes */
  extractTrackChanges?: boolean;

  /** Extract headers and footers */
  extractHeadersFooters?: boolean;

  /** Custom style mappings for mammoth */
  styleMap?: string[];
}

/**
 * DOCX extraction result.
 */
export interface DocxExtractionResult extends ExtractionResult {
  /** Document type identifier */
  documentType: 'docx';

  /** HTML representation of the document */
  html?: string;

  /** Markdown representation of the document */
  markdown?: string;

  /** Document headings structure */
  headings?: DocxHeading[];

  /** Document comments */
  comments?: DocxComment[];

  /** Track changes */
  trackChanges?: DocxTrackChange[];

  /** Styles used in the document */
  styles?: DocxStyle[];

  /** Header content */
  header?: string;

  /** Footer content */
  footer?: string;
}

/**
 * DOCX heading entry.
 */
export interface DocxHeading {
  /** Heading level (1-6) */
  level: number;

  /** Heading text */
  text: string;

  /** Anchor ID */
  id?: string;

  /** Page number (if available) */
  pageNumber?: number;
}

/**
 * DOCX comment.
 */
export interface DocxComment {
  /** Comment ID */
  id: string;

  /** Comment author */
  author: string;

  /** Comment date */
  date?: Date;

  /** Comment text */
  text: string;

  /** Text that was commented on */
  referenceText?: string;

  /** Replies to this comment */
  replies?: DocxComment[];
}

/**
 * DOCX track change entry.
 */
export interface DocxTrackChange {
  /** Change type */
  type: 'insert' | 'delete' | 'format';

  /** Author of the change */
  author: string;

  /** Date of the change */
  date?: Date;

  /** Changed text */
  text: string;

  /** Original text (for replacements) */
  originalText?: string;
}

/**
 * DOCX style definition.
 */
export interface DocxStyle {
  /** Style ID */
  id: string;

  /** Style name */
  name: string;

  /** Style type */
  type: 'paragraph' | 'character' | 'table' | 'numbering';

  /** Base style ID */
  basedOn?: string;
}

// ============================================================================
// XLSX-Specific Types
// ============================================================================

/**
 * XLSX extraction options.
 */
export interface XlsxOptions extends ExtractionOptions {
  /** Specific sheets to process (by name or index) */
  sheets?: (string | number)[];

  /** Include hidden sheets */
  includeHidden?: boolean;

  /** Treat first row as headers */
  firstRowAsHeaders?: boolean;

  /** Skip empty rows */
  skipEmptyRows?: boolean;

  /** Skip empty columns */
  skipEmptyColumns?: boolean;

  /** Date format for date cells */
  dateFormat?: string;

  /** Number format for numeric cells */
  numberFormat?: string;

  /** Maximum rows per sheet */
  maxRowsPerSheet?: number;

  /** Output format */
  outputFormat?: 'json' | 'csv' | 'text';

  /** Extract formulas (not just values) */
  extractFormulas?: boolean;

  /** Extract cell styles */
  extractStyles?: boolean;

  /** Extract charts */
  extractCharts?: boolean;

  /** Extract conditional formatting */
  extractConditionalFormatting?: boolean;
}

/**
 * XLSX extraction result.
 */
export interface XlsxExtractionResult extends ExtractionResult {
  /** Document type identifier */
  documentType: 'xlsx';

  /** Individual sheets data */
  sheets: XlsxSheet[];

  /** Named ranges in the workbook */
  namedRanges?: XlsxNamedRange[];

  /** Workbook properties */
  workbookProperties?: XlsxWorkbookProperties;

  /** Defined names in the workbook */
  definedNames?: XlsxDefinedName[];
}

/**
 * XLSX sheet data.
 */
export interface XlsxSheet {
  /** Sheet name */
  name: string;

  /** Sheet index (0-based) */
  index: number;

  /** Whether sheet is hidden */
  hidden: boolean;

  /** Sheet state */
  state?: 'visible' | 'hidden' | 'veryHidden';

  /** Number of rows with data */
  rowCount: number;

  /** Number of columns with data */
  columnCount: number;

  /** Header row (if firstRowAsHeaders is true) */
  headers: string[];

  /** Data rows */
  rows: XlsxCellValue[][];

  /** Merged cells */
  mergedCells: MergedCellInfo[];

  /** Named ranges in this sheet */
  namedRanges?: XlsxNamedRange[];

  /** Column widths */
  columnWidths?: number[];

  /** Row heights */
  rowHeights?: number[];

  /** Frozen panes info */
  frozenPanes?: {
    rows: number;
    columns: number;
  };
}

/**
 * XLSX cell value type.
 */
export type XlsxCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | XlsxRichText;

/**
 * XLSX rich text value.
 */
export interface XlsxRichText {
  /** Rich text segments */
  segments: XlsxRichTextSegment[];

  /** Plain text value */
  plainText: string;
}

/**
 * XLSX rich text segment.
 */
export interface XlsxRichTextSegment {
  /** Segment text */
  text: string;

  /** Font properties */
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
  };
}

/**
 * XLSX named range.
 */
export interface XlsxNamedRange {
  /** Range name */
  name: string;

  /** Range reference (e.g., 'Sheet1!$A$1:$B$10') */
  range: string;

  /** Sheet name (if scoped to a sheet) */
  sheet?: string;

  /** Whether range is hidden */
  hidden?: boolean;
}

/**
 * XLSX defined name.
 */
export interface XlsxDefinedName {
  /** Name identifier */
  name: string;

  /** Formula or reference */
  formula: string;

  /** Comment/description */
  comment?: string;
}

/**
 * XLSX workbook properties.
 */
export interface XlsxWorkbookProperties {
  /** Workbook title */
  title?: string;

  /** Subject */
  subject?: string;

  /** Creator/author */
  creator?: string;

  /** Last modified by */
  lastModifiedBy?: string;

  /** Creation date */
  created?: Date;

  /** Modification date */
  modified?: Date;

  /** Keywords */
  keywords?: string;

  /** Description */
  description?: string;

  /** Category */
  category?: string;

  /** Company */
  company?: string;

  /** Manager */
  manager?: string;
}

// ============================================================================
// File Type Detection Types
// ============================================================================

/**
 * Result of file type detection.
 */
export interface FileTypeResult {
  /** Detected MIME type */
  mimeType: string;

  /** Detected file extension */
  extension: string;

  /** File type category */
  category: FileCategory;

  /** Confidence of detection (0-1) */
  confidence: number;

  /** Magic bytes signature matched */
  signature?: string;

  /** Whether file is supported for extraction */
  supported: boolean;
}

/**
 * File category for grouping file types.
 */
export type FileCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'archive'
  | 'text'
  | 'unknown';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base extraction error.
 */
export class ExtractionError extends Error {
  /** Error code for programmatic handling */
  code: ExtractionErrorCode;

  /** Original error that caused this error */
  cause?: Error;

  /** Additional context about the error */
  context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ExtractionErrorCode,
    cause?: Error,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
    this.cause = cause;
    this.context = context;
  }
}

/**
 * Error codes for extraction operations.
 */
export type ExtractionErrorCode =
  | 'FILE_NOT_FOUND'
  | 'INVALID_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'EXTRACTION_FAILED'
  | 'OCR_FAILED'
  | 'TIMEOUT'
  | 'OUT_OF_MEMORY'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

/**
 * PDF-specific extraction error.
 */
export class PDFExtractionError extends ExtractionError {
  /** Page number where error occurred */
  pageNumber?: number;

  constructor(
    message: string,
    code: ExtractionErrorCode,
    pageNumber?: number,
    cause?: Error
  ) {
    super(message, code, cause, { pageNumber });
    this.name = 'PDFExtractionError';
    this.pageNumber = pageNumber;
  }
}

/**
 * DOCX-specific extraction error.
 */
export class DocxExtractionError extends ExtractionError {
  constructor(message: string, code: ExtractionErrorCode, cause?: Error) {
    super(message, code, cause);
    this.name = 'DocxExtractionError';
  }
}

/**
 * XLSX-specific extraction error.
 */
export class XlsxExtractionError extends ExtractionError {
  /** Sheet name where error occurred */
  sheetName?: string;

  constructor(
    message: string,
    code: ExtractionErrorCode,
    sheetName?: string,
    cause?: Error
  ) {
    super(message, code, cause, { sheetName });
    this.name = 'XlsxExtractionError';
    this.sheetName = sheetName;
  }
}
