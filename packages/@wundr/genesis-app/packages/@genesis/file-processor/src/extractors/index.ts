/**
 * @genesis/file-processor - Extractors Module
 *
 * Document text extraction utilities for PDF, DOCX, XLSX, and more.
 *
 * @packageDocumentation
 */

// ============================================================================
// Text Extraction Service
// ============================================================================

export {
  TextExtractionService,
  TextExtractor,
  TextExtractorConfig,
  createTextExtractor,
} from './text-extractor';

// ============================================================================
// PDF Extractor
// ============================================================================

export {
  PDFExtractor,
  PDFExtractorImpl,
  PDFExtractorConfig,
  createPDFExtractor,
} from './pdf-extractor';

// ============================================================================
// Office Document Extractor
// ============================================================================

export {
  OfficeExtractor,
  OfficeExtractorImpl,
  OfficeExtractorConfig,
  createOfficeExtractor,
} from './office-extractor';

// ============================================================================
// Table Extractor
// ============================================================================

export {
  TableExtractor,
  TableExtractorImpl,
  TableDetectionConfig,
  CSVParseOptions,
  CSVOptions,
  createTableExtractor,
} from './table-extractor';

// ============================================================================
// Re-export Types
// ============================================================================

export * from '../types/extraction';
