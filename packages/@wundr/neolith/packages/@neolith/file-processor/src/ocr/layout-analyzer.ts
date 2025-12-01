/**
 * @genesis/file-processor - Document Layout Analyzer
 *
 * Analyzes document layout to identify text regions, tables, images,
 * and determine reading order.
 *
 * @packageDocumentation
 */

import { BlockType, DocumentType } from '../types/ocr';

import type {
  BoundingBox,
  OCRBlock,
  TableResult,
  TableCell,
} from '../types/ocr';

/**
 * Region types for layout analysis
 */
export enum RegionType {
  /** Text block */
  TEXT = 'text',
  /** Table structure */
  TABLE = 'table',
  /** Image/figure */
  IMAGE = 'image',
  /** Separator/divider */
  SEPARATOR = 'separator',
  /** Header region */
  HEADER = 'header',
  /** Footer region */
  FOOTER = 'footer',
  /** Sidebar content */
  SIDEBAR = 'sidebar',
  /** Caption text */
  CAPTION = 'caption',
  /** List content */
  LIST = 'list',
  /** Form field */
  FORM_FIELD = 'form_field',
}

/**
 * Detected region in the document
 */
export interface Region {
  /** Region identifier */
  id: string;

  /** Region type */
  type: RegionType;

  /** Bounding box */
  bbox: BoundingBox;

  /** Confidence score (0-100) */
  confidence: number;

  /** Text content if applicable */
  text?: string;

  /** Child regions */
  children?: Region[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Text region with additional text-specific data
 */
export interface TextRegion extends Region {
  type: RegionType.TEXT;

  /** Text content */
  text: string;

  /** Number of lines */
  lineCount: number;

  /** Average line height */
  avgLineHeight: number;

  /** Estimated font size */
  fontSize?: number;

  /** Text alignment */
  alignment?: 'left' | 'center' | 'right' | 'justified';
}

/**
 * Table region with structure information
 */
export interface TableRegion extends Region {
  type: RegionType.TABLE;

  /** Number of rows */
  rowCount: number;

  /** Number of columns */
  columnCount: number;

  /** Has header row */
  hasHeader: boolean;

  /** Cell boundaries */
  cells: TableCell[][];

  /** Extracted table data */
  data?: TableResult;
}

/**
 * Image region
 */
export interface ImageRegion extends Region {
  type: RegionType.IMAGE;

  /** Image format if detected */
  format?: string;

  /** Has associated caption */
  hasCaption: boolean;

  /** Caption text if found */
  caption?: string;
}

/**
 * Complete layout analysis result
 */
export interface LayoutResult {
  /** Detected regions */
  regions: Region[];

  /** Indices of regions in reading order */
  readingOrder: number[];

  /** Classified document type */
  documentType: DocumentType;

  /** Page dimensions */
  dimensions: {
    width: number;
    height: number;
  };

  /** Number of columns detected */
  columnCount: number;

  /** Has header */
  hasHeader: boolean;

  /** Has footer */
  hasFooter: boolean;

  /** Processing confidence */
  confidence: number;

  /** Analysis metadata */
  metadata?: {
    processingTime: number;
    methodUsed: string;
  };
}

/**
 * Layout analyzer options
 */
export interface LayoutAnalyzerOptions {
  /** Minimum region size (pixels) */
  minRegionSize?: number;

  /** Merge nearby regions */
  mergeNearbyRegions?: boolean;

  /** Merge threshold (pixels) */
  mergeThreshold?: number;

  /** Detect tables */
  detectTables?: boolean;

  /** Detect images */
  detectImages?: boolean;

  /** Detect headers/footers */
  detectHeadersFooters?: boolean;

  /** Reading order detection method */
  readingOrderMethod?: 'geometric' | 'semantic' | 'hybrid';
}

/**
 * Default layout analyzer options
 */
const DEFAULT_OPTIONS: LayoutAnalyzerOptions = {
  minRegionSize: 20,
  mergeNearbyRegions: true,
  mergeThreshold: 10,
  detectTables: true,
  detectImages: true,
  detectHeadersFooters: true,
  readingOrderMethod: 'geometric',
};

/**
 * Document layout analyzer
 *
 * Analyzes document structure to identify:
 * - Text blocks and paragraphs
 * - Tables and their structure
 * - Images and figures
 * - Headers and footers
 * - Reading order
 *
 * @example
 * ```typescript
 * const analyzer = new LayoutAnalyzer();
 *
 * // Analyze layout from OCR blocks
 * const layout = await analyzer.analyzeLayout(ocrBlocks, {
 *   width: 2480,
 *   height: 3508,
 * });
 *
 * console.log(`Document type: ${layout.documentType}`);
 * console.log(`Regions: ${layout.regions.length}`);
 * console.log(`Reading order: ${layout.readingOrder}`);
 * ```
 */
export class LayoutAnalyzer {
  private options: LayoutAnalyzerOptions;

  constructor(options: Partial<LayoutAnalyzerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze document layout from OCR blocks
   *
   * @param blocks - OCR blocks from text recognition
   * @param dimensions - Image/page dimensions
   * @returns Layout analysis result
   */
  async analyzeLayout(
    blocks: OCRBlock[],
    dimensions: { width: number; height: number }
  ): Promise<LayoutResult> {
    const startTime = Date.now();

    // Convert OCR blocks to regions
    let regions = this.blocksToRegions(blocks);

    // Merge nearby regions if enabled
    if (this.options.mergeNearbyRegions) {
      regions = this.mergeNearbyRegions(regions);
    }

    // Detect special regions
    if (this.options.detectHeadersFooters) {
      regions = this.detectHeadersFooters(regions, dimensions);
    }

    // Detect tables
    const tableRegions = this.options.detectTables
      ? this.detectTablesFromRegions(regions)
      : [];

    // Determine reading order
    const readingOrder = this.determineReadingOrder(regions, dimensions);

    // Classify document type
    const documentType = this.classifyDocumentType(regions, dimensions);

    // Detect column structure
    const columnCount = this.detectColumnCount(regions, dimensions);

    return {
      regions: [...regions, ...tableRegions],
      readingOrder,
      documentType,
      dimensions,
      columnCount,
      hasHeader: regions.some(r => r.type === RegionType.HEADER),
      hasFooter: regions.some(r => r.type === RegionType.FOOTER),
      confidence: this.calculateLayoutConfidence(regions),
      metadata: {
        processingTime: Date.now() - startTime,
        methodUsed: this.options.readingOrderMethod || 'geometric',
      },
    };
  }

  /**
   * Detect text regions from image
   *
   * Note: This is a simplified version that works with pre-existing OCR blocks.
   * Full implementation would require connected component analysis on the image.
   *
   * @param blocks - OCR blocks
   * @returns Text regions
   */
  async detectTextRegions(blocks: OCRBlock[]): Promise<TextRegion[]> {
    return blocks
      .filter(block => block.blockType === BlockType.TEXT)
      .map((block, index) => ({
        id: `text-${index}`,
        type: RegionType.TEXT as const,
        bbox: block.bbox,
        confidence: block.confidence,
        text: block.text,
        lineCount: block.paragraphs.reduce((sum, p) => sum + p.lines.length, 0),
        avgLineHeight: this.calculateAvgLineHeight(block),
        alignment: this.detectTextAlignment(block),
      }));
  }

  /**
   * Detect tables in document
   *
   * Uses heuristics based on text alignment and spacing patterns.
   *
   * @param blocks - OCR blocks
   * @returns Table regions
   */
  async detectTables(blocks: OCRBlock[]): Promise<TableRegion[]> {
    const tableRegions: TableRegion[] = [];
    const potentialTableBlocks = this.findPotentialTableBlocks(blocks);

    for (const tableBlocks of potentialTableBlocks) {
      const tableRegion = this.analyzeTableStructure(tableBlocks);
      if (tableRegion) {
        tableRegions.push(tableRegion);
      }
    }

    return tableRegions;
  }

  /**
   * Detect images/figures in document
   *
   * Note: Without actual image analysis, this detects gaps between text regions
   * that might contain images.
   *
   * @param blocks - OCR blocks
   * @param dimensions - Page dimensions
   * @returns Image regions
   */
  async detectImages(
    blocks: OCRBlock[],
    dimensions: { width: number; height: number }
  ): Promise<ImageRegion[]> {
    const textRegions = blocks.map(b => b.bbox);
    const gaps = this.findLargeGaps(textRegions, dimensions);

    return gaps.map((gap, index) => ({
      id: `image-${index}`,
      type: RegionType.IMAGE as const,
      bbox: gap,
      confidence: 50, // Low confidence as we're just detecting gaps
      hasCaption: this.hasNearbyCaption(gap, blocks),
    }));
  }

  /**
   * Classify document type based on layout
   *
   * @param regions - Detected regions
   * @returns Classified document type
   */
  async classifyDocument(regions: Region[]): Promise<DocumentType> {
    return this.classifyDocumentType(regions, { width: 0, height: 0 });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * Convert OCR blocks to regions
   */
  private blocksToRegions(blocks: OCRBlock[]): Region[] {
    return blocks.map((block, index) => ({
      id: `region-${index}`,
      type: this.blockTypeToRegionType(block.blockType),
      bbox: block.bbox,
      confidence: block.confidence,
      text: block.text,
    }));
  }

  /**
   * Convert block type to region type
   */
  private blockTypeToRegionType(blockType: BlockType): RegionType {
    const mapping: Record<BlockType, RegionType> = {
      [BlockType.TEXT]: RegionType.TEXT,
      [BlockType.TABLE]: RegionType.TABLE,
      [BlockType.IMAGE]: RegionType.IMAGE,
      [BlockType.SEPARATOR]: RegionType.SEPARATOR,
      [BlockType.HEADER]: RegionType.HEADER,
      [BlockType.FOOTER]: RegionType.FOOTER,
      [BlockType.CAPTION]: RegionType.CAPTION,
      [BlockType.UNKNOWN]: RegionType.TEXT,
    };
    return mapping[blockType] || RegionType.TEXT;
  }

  /**
   * Merge nearby regions
   */
  private mergeNearbyRegions(regions: Region[]): Region[] {
    const threshold = this.options.mergeThreshold || 10;
    const merged: Region[] = [];
    const used = new Set<number>();

    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) {
        continue;
      }

      const region = { ...regions[i] };
      let bbox = { ...region.bbox };

      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) {
          continue;
        }

        const other = regions[j];
        if (region.type !== other.type) {
          continue;
        }

        if (this.areRegionsNearby(bbox, other.bbox, threshold)) {
          bbox = this.mergeBboxes(bbox, other.bbox);
          used.add(j);
        }
      }

      region.bbox = bbox;
      merged.push(region);
      used.add(i);
    }

    return merged;
  }

  /**
   * Check if two regions are nearby
   */
  private areRegionsNearby(
    a: BoundingBox,
    b: BoundingBox,
    threshold: number
  ): boolean {
    const horizontalGap = Math.max(
      0,
      Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)
    );
    const verticalGap = Math.max(
      0,
      Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)
    );

    return horizontalGap <= threshold && verticalGap <= threshold;
  }

  /**
   * Merge two bounding boxes
   */
  private mergeBboxes(a: BoundingBox, b: BoundingBox): BoundingBox {
    return {
      x0: Math.min(a.x0, b.x0),
      y0: Math.min(a.y0, b.y0),
      x1: Math.max(a.x1, b.x1),
      y1: Math.max(a.y1, b.y1),
    };
  }

  /**
   * Detect headers and footers based on position
   */
  private detectHeadersFooters(
    regions: Region[],
    dimensions: { width: number; height: number }
  ): Region[] {
    const headerThreshold = dimensions.height * 0.1;
    const footerThreshold = dimensions.height * 0.9;

    return regions.map(region => {
      if (region.bbox.y1 < headerThreshold) {
        return { ...region, type: RegionType.HEADER };
      }
      if (region.bbox.y0 > footerThreshold) {
        return { ...region, type: RegionType.FOOTER };
      }
      return region;
    });
  }

  /**
   * Detect tables from regions
   */
  private detectTablesFromRegions(regions: Region[]): TableRegion[] {
    // Look for regions with aligned text that might form a table
    const alignedGroups = this.findAlignedRegions(regions);
    const tableRegions: TableRegion[] = [];

    for (const group of alignedGroups) {
      if (group.length >= 4) {
        // At least 2x2 grid
        const tableRegion = this.createTableRegion(group);
        if (tableRegion) {
          tableRegions.push(tableRegion);
        }
      }
    }

    return tableRegions;
  }

  /**
   * Find groups of aligned regions
   */
  private findAlignedRegions(regions: Region[]): Region[][] {
    const groups: Region[][] = [];
    const tolerance = 20;

    // Group by similar x positions (columns)
    const columns = new Map<number, Region[]>();
    for (const region of regions) {
      const x = Math.round(region.bbox.x0 / tolerance) * tolerance;
      if (!columns.has(x)) {
        columns.set(x, []);
      }
      columns.get(x)!.push(region);
    }

    // Find columns with multiple items
    for (const [, columnRegions] of columns) {
      if (columnRegions.length >= 2) {
        groups.push(columnRegions);
      }
    }

    return groups;
  }

  /**
   * Create table region from aligned regions
   */
  private createTableRegion(regions: Region[]): TableRegion | null {
    if (regions.length < 4) {
      return null;
    }

    const bbox = regions.reduce(
      (acc, r) => this.mergeBboxes(acc, r.bbox),
      regions[0].bbox
    );

    // Estimate rows and columns
    const yPositions = [
      ...new Set(regions.map(r => Math.round(r.bbox.y0 / 20) * 20)),
    ];
    const xPositions = [
      ...new Set(regions.map(r => Math.round(r.bbox.x0 / 20) * 20)),
    ];

    return {
      id: `table-${Date.now()}`,
      type: RegionType.TABLE,
      bbox,
      confidence: 60,
      rowCount: yPositions.length,
      columnCount: xPositions.length,
      hasHeader: true, // Assume first row is header
      cells: [], // Would need more analysis to populate
    };
  }

  /**
   * Determine reading order of regions
   */
  private determineReadingOrder(
    regions: Region[],
    dimensions: { width: number; height: number }
  ): number[] {
    // Detect if multi-column
    const columnCount = this.detectColumnCount(regions, dimensions);

    if (columnCount <= 1) {
      // Single column: top to bottom
      return this.topToBottomOrder(regions);
    }

    // Multi-column: column by column, top to bottom within each
    return this.multiColumnOrder(regions, columnCount, dimensions);
  }

  /**
   * Simple top-to-bottom reading order
   */
  private topToBottomOrder(regions: Region[]): number[] {
    const indexed = regions.map((r, i) => ({ region: r, index: i }));
    indexed.sort((a, b) => {
      const yDiff = a.region.bbox.y0 - b.region.bbox.y0;
      if (Math.abs(yDiff) > 10) {
        return yDiff;
      }
      return a.region.bbox.x0 - b.region.bbox.x0;
    });
    return indexed.map(item => item.index);
  }

  /**
   * Multi-column reading order
   */
  private multiColumnOrder(
    regions: Region[],
    columnCount: number,
    dimensions: { width: number; height: number }
  ): number[] {
    const columnWidth = dimensions.width / columnCount;
    const indexed = regions.map((r, i) => ({ region: r, index: i }));

    indexed.sort((a, b) => {
      const colA = Math.floor(a.region.bbox.x0 / columnWidth);
      const colB = Math.floor(b.region.bbox.x0 / columnWidth);

      if (colA !== colB) {
        return colA - colB;
      }
      return a.region.bbox.y0 - b.region.bbox.y0;
    });

    return indexed.map(item => item.index);
  }

  /**
   * Detect number of columns
   */
  private detectColumnCount(
    regions: Region[],
    dimensions: { width: number; height: number }
  ): number {
    if (regions.length === 0) {
      return 1;
    }

    // Find gaps in the middle of the page
    const middleX = dimensions.width / 2;
    const tolerance = dimensions.width * 0.1;

    const hasMiddleGap = !regions.some(r => {
      const midpoint = (r.bbox.x0 + r.bbox.x1) / 2;
      return Math.abs(midpoint - middleX) < tolerance;
    });

    // Check for consistent vertical alignment suggesting columns
    const xPositions = regions.map(r => r.bbox.x0);
    const uniqueXs = [...new Set(xPositions.map(x => Math.round(x / 50) * 50))];

    if (hasMiddleGap && uniqueXs.length >= 2) {
      return 2;
    }

    return 1;
  }

  /**
   * Classify document type
   */
  private classifyDocumentType(
    regions: Region[],
    _dimensions: { width: number; height: number }
  ): DocumentType {
    const text = regions
      .filter(r => r.text)
      .map(r => r.text!.toLowerCase())
      .join(' ');

    // Check for document type indicators
    if (
      text.includes('invoice') ||
      text.includes('bill to') ||
      text.includes('amount due')
    ) {
      return DocumentType.INVOICE;
    }
    if (
      text.includes('receipt') ||
      (text.includes('total') && text.includes('thank'))
    ) {
      return DocumentType.RECEIPT;
    }
    if (regions.some(r => r.type === RegionType.TABLE)) {
      return DocumentType.TABLE;
    }
    if (text.includes('dear') && text.includes('sincerely')) {
      return DocumentType.LETTER;
    }
    if (text.includes('contract') || text.includes('agreement')) {
      return DocumentType.CONTRACT;
    }

    return DocumentType.GENERAL;
  }

  /**
   * Calculate average line height for a block
   */
  private calculateAvgLineHeight(block: OCRBlock): number {
    const lineHeights: number[] = [];

    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        lineHeights.push(line.bbox.y1 - line.bbox.y0);
      }
    }

    if (lineHeights.length === 0) {
      return 0;
    }
    return lineHeights.reduce((a, b) => a + b, 0) / lineHeights.length;
  }

  /**
   * Detect text alignment
   */
  private detectTextAlignment(
    block: OCRBlock
  ): 'left' | 'center' | 'right' | 'justified' | undefined {
    if (block.paragraphs.length === 0) {
      return undefined;
    }

    const lines = block.paragraphs.flatMap(p => p.lines);
    if (lines.length < 2) {
      return undefined;
    }

    const leftMargins = lines.map(l => l.bbox.x0);
    const rightMargins = lines.map(l => l.bbox.x1);

    const leftVariance = this.variance(leftMargins);
    const rightVariance = this.variance(rightMargins);

    if (leftVariance < 10 && rightVariance < 10) {
      return 'justified';
    }
    if (leftVariance < 10) {
      return 'left';
    }
    if (rightVariance < 10) {
      return 'right';
    }

    // Check for center alignment
    const centers = lines.map(l => (l.bbox.x0 + l.bbox.x1) / 2);
    if (this.variance(centers) < 20) {
      return 'center';
    }

    return 'left';
  }

  /**
   * Calculate variance
   */
  private variance(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return (
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    );
  }

  /**
   * Find potential table blocks
   */
  private findPotentialTableBlocks(blocks: OCRBlock[]): OCRBlock[][] {
    // Group blocks that might form tables based on alignment
    return [blocks.filter(b => b.blockType === BlockType.TABLE)];
  }

  /**
   * Analyze table structure
   */
  private analyzeTableStructure(blocks: OCRBlock[]): TableRegion | null {
    if (blocks.length === 0) {
      return null;
    }

    const bbox = blocks.reduce(
      (acc, b) => this.mergeBboxes(acc, b.bbox),
      blocks[0].bbox
    );

    return {
      id: `table-${Date.now()}`,
      type: RegionType.TABLE,
      bbox,
      confidence: 70,
      rowCount: blocks.length,
      columnCount: 1,
      hasHeader: true,
      cells: [],
    };
  }

  /**
   * Find large gaps between text regions
   */
  private findLargeGaps(
    textRegions: BoundingBox[],
    dimensions: { width: number; height: number }
  ): BoundingBox[] {
    const gaps: BoundingBox[] = [];
    const minGapSize = Math.min(dimensions.width, dimensions.height) * 0.1;

    // Sort regions by y position
    const sorted = [...textRegions].sort((a, b) => a.y0 - b.y0);

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const gap = next.y0 - current.y1;

      if (gap > minGapSize) {
        gaps.push({
          x0: 0,
          y0: current.y1,
          x1: dimensions.width,
          y1: next.y0,
        });
      }
    }

    return gaps;
  }

  /**
   * Check if a region has a nearby caption
   */
  private hasNearbyCaption(bbox: BoundingBox, blocks: OCRBlock[]): boolean {
    const captionDistance = 50;

    return blocks.some(block => {
      const distance = Math.abs(block.bbox.y0 - bbox.y1);
      return distance < captionDistance && block.text.length < 200;
    });
  }

  /**
   * Calculate overall layout confidence
   */
  private calculateLayoutConfidence(regions: Region[]): number {
    if (regions.length === 0) {
      return 0;
    }
    const avgConfidence =
      regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length;
    return Math.round(avgConfidence);
  }
}

/**
 * Create a layout analyzer instance
 *
 * @param options - Layout analyzer options
 * @returns New LayoutAnalyzer instance
 */
export function createLayoutAnalyzer(
  options?: Partial<LayoutAnalyzerOptions>
): LayoutAnalyzer {
  return new LayoutAnalyzer(options);
}
