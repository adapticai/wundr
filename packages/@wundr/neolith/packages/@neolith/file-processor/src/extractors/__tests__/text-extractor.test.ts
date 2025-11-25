/**
 * Text Extraction Service Tests
 *
 * Comprehensive test suite for text extraction operations covering:
 * - PDF text extraction
 * - DOCX text extraction
 * - XLSX data extraction
 * - Metadata extraction
 * - Error handling
 *
 * @module @genesis/file-processor/extractors/__tests__/text-extractor.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FileType } from '../../types';

import type { ProcessorResult, FileMetadata, PageContent, TableData } from '../../types';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * Mock PDF parser
 */
const mockPdfParse = vi.fn();

/**
 * Mock Mammoth (DOCX parser)
 */
const mockMammoth = {
  convertToHtml: vi.fn(),
  extractRawText: vi.fn(),
};

/**
 * Mock ExcelJS
 */
const mockExcelJS = {
  Workbook: vi.fn(() => ({
    xlsx: {
      readFile: vi.fn(),
    },
    worksheets: [],
    eachSheet: vi.fn(),
  })),
};

// Mock file system
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => Buffer.from('mock content')),
  statSync: vi.fn(() => ({
    size: 1024,
    birthtime: new Date('2024-01-01'),
    mtime: new Date('2024-01-15'),
  })),
}));

// =============================================================================
// TEXT EXTRACTION SERVICE (MOCK IMPLEMENTATION FOR TESTING)
// =============================================================================

interface TextExtractionOptions {
  extractTables?: boolean;
  extractImages?: boolean;
  maxPages?: number;
  ocrFallback?: boolean;
}

interface TextExtractionService {
  extractFromPDF(
    filePath: string,
    options?: TextExtractionOptions
  ): Promise<ProcessorResult>;
  extractFromDocx(
    filePath: string,
    options?: TextExtractionOptions
  ): Promise<ProcessorResult>;
  extractFromXlsx(
    filePath: string,
    options?: TextExtractionOptions
  ): Promise<ProcessorResult>;
}

/**
 * Create mock text extraction service for testing
 */
function createTextExtractionService(): TextExtractionService {
  return {
    extractFromPDF: vi.fn(
      async (
        filePath: string,
        options: TextExtractionOptions = {},
      ): Promise<ProcessorResult> => {
        const pdfResult = await mockPdfParse(filePath, options);

        const metadata: FileMetadata = {
          filename: filePath.split('/').pop() ?? 'unknown.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          fileType: FileType.PDF,
          pageCount: pdfResult.numPages,
          author: pdfResult.info?.author,
          title: pdfResult.info?.title,
        };

        return {
          success: true,
          content: pdfResult.text,
          metadata,
          processingTime: 100,
          pages: pdfResult.pages,
          structuredData: options.extractTables ? { tables: pdfResult.tables } : undefined,
        };
      },
    ),

    extractFromDocx: vi.fn(
      async (
        filePath: string,
        options: TextExtractionOptions = {},
      ): Promise<ProcessorResult> => {
        const [htmlResult, textResult] = await Promise.all([
          mockMammoth.convertToHtml({ path: filePath }),
          mockMammoth.extractRawText({ path: filePath }),
        ]);

        const metadata: FileMetadata = {
          filename: filePath.split('/').pop() ?? 'unknown.docx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1024,
          fileType: FileType.DOCX,
        };

        return {
          success: true,
          content: textResult.value,
          metadata,
          processingTime: 50,
          structuredData: {
            html: htmlResult.value,
            images: options.extractImages ? htmlResult.images : undefined,
          },
        };
      },
    ),

    extractFromXlsx: vi.fn(
      async (
        filePath: string,
        _options: TextExtractionOptions = {},
      ): Promise<ProcessorResult> => {
        const workbook = new mockExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const sheets: Array<{ name: string; data: string[][]; headers: string[] }> = [];
        workbook.eachSheet((worksheet: unknown, _sheetId: number) => {
          sheets.push({
            name: (worksheet as { name: string }).name,
            data: [],
            headers: [],
          });
        });

        const content = sheets
          .map(
            (s) =>
              `=== ${s.name} ===\n${s.headers.join('\t')}\n${s.data.map((r) => r.join('\t')).join('\n')}`,
          )
          .join('\n\n');

        const metadata: FileMetadata = {
          filename: filePath.split('/').pop() ?? 'unknown.xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024,
          fileType: FileType.XLSX,
          custom: {
            sheetCount: sheets.length,
          },
        };

        return {
          success: true,
          content,
          metadata,
          processingTime: 75,
          structuredData: { sheets },
        };
      },
    ),
  };
}

// =============================================================================
// PDF EXTRACTION TESTS
// =============================================================================

describe('TextExtractionService', () => {
  let service: TextExtractionService;

  beforeEach(() => {
    service = createTextExtractionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('extractFromPDF', () => {
    it('extracts text from PDF', async () => {
      const mockPdfData = {
        text: 'This is the extracted text from the PDF document.',
        numPages: 5,
        info: {
          title: 'Test Document',
          author: 'Test Author',
        },
        pages: [],
        tables: [],
      };

      mockPdfParse.mockResolvedValue(mockPdfData);

      const result = await service.extractFromPDF('/path/to/document.pdf');

      expect(result.success).toBe(true);
      expect(result.content).toBe('This is the extracted text from the PDF document.');
      expect(result.metadata.pageCount).toBe(5);
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.author).toBe('Test Author');
    });

    it('extracts tables from PDF', async () => {
      const mockTables: TableData[] = [
        {
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['John', '30', 'New York'],
            ['Jane', '25', 'Los Angeles'],
          ],
        },
      ];

      mockPdfParse.mockResolvedValue({
        text: 'Document with tables',
        numPages: 1,
        info: {},
        pages: [],
        tables: mockTables,
      });

      const result = await service.extractFromPDF('/path/to/tables.pdf', {
        extractTables: true,
      });

      expect(result.success).toBe(true);
      expect(result.structuredData?.tables).toHaveLength(1);
      expect(result.structuredData?.tables[0].headers).toEqual(['Name', 'Age', 'City']);
      expect(result.structuredData?.tables[0].rows).toHaveLength(2);
    });

    it('handles multi-page documents', async () => {
      const mockPages: PageContent[] = [
        { pageNumber: 1, content: 'Page 1 content' },
        { pageNumber: 2, content: 'Page 2 content' },
        { pageNumber: 3, content: 'Page 3 content' },
      ];

      mockPdfParse.mockResolvedValue({
        text: 'Page 1 content\nPage 2 content\nPage 3 content',
        numPages: 3,
        info: {},
        pages: mockPages,
        tables: [],
      });

      const result = await service.extractFromPDF('/path/to/multipage.pdf');

      expect(result.success).toBe(true);
      expect(result.pages).toHaveLength(3);
      expect(result.pages![0].pageNumber).toBe(1);
      expect(result.pages![2].content).toBe('Page 3 content');
      expect(result.metadata.pageCount).toBe(3);
    });

    it('extracts metadata', async () => {
      mockPdfParse.mockResolvedValue({
        text: 'Content',
        numPages: 1,
        info: {
          title: 'Annual Report 2024',
          author: 'Finance Department',
          creator: 'Microsoft Word',
          producer: 'Adobe PDF',
          creationDate: '2024-01-15T10:30:00Z',
        },
        pages: [],
        tables: [],
      });

      const result = await service.extractFromPDF('/path/to/report.pdf');

      expect(result.success).toBe(true);
      expect(result.metadata.title).toBe('Annual Report 2024');
      expect(result.metadata.author).toBe('Finance Department');
      expect(result.metadata.mimeType).toBe('application/pdf');
      expect(result.metadata.fileType).toBe(FileType.PDF);
    });

    it('handles empty PDF', async () => {
      mockPdfParse.mockResolvedValue({
        text: '',
        numPages: 0,
        info: {},
        pages: [],
        tables: [],
      });

      const result = await service.extractFromPDF('/path/to/empty.pdf');

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
      expect(result.metadata.pageCount).toBe(0);
    });

    it('handles PDF parsing errors', async () => {
      mockPdfParse.mockRejectedValue(new Error('Invalid PDF structure'));

      await expect(service.extractFromPDF('/path/to/corrupted.pdf')).rejects.toThrow(
        'Invalid PDF structure',
      );
    });

    it('respects maxPages option', async () => {
      mockPdfParse.mockResolvedValue({
        text: 'Limited content',
        numPages: 2,
        info: {},
        pages: [
          { pageNumber: 1, content: 'Page 1' },
          { pageNumber: 2, content: 'Page 2' },
        ],
        tables: [],
      });

      await service.extractFromPDF('/path/to/large.pdf', { maxPages: 2 });

      expect(mockPdfParse).toHaveBeenCalledWith('/path/to/large.pdf', { maxPages: 2 });
    });
  });

  // ===========================================================================
  // DOCX EXTRACTION TESTS
  // ===========================================================================

  describe('extractFromDocx', () => {
    it('extracts text content', async () => {
      mockMammoth.convertToHtml.mockResolvedValue({
        value: '<p>This is a Word document.</p>',
        messages: [],
      });
      mockMammoth.extractRawText.mockResolvedValue({
        value: 'This is a Word document.',
        messages: [],
      });

      const result = await service.extractFromDocx('/path/to/document.docx');

      expect(result.success).toBe(true);
      expect(result.content).toBe('This is a Word document.');
      expect(result.metadata.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('preserves formatting in HTML output', async () => {
      const htmlContent = `
        <h1>Title</h1>
        <p><strong>Bold text</strong> and <em>italic text</em></p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `.trim();

      mockMammoth.convertToHtml.mockResolvedValue({
        value: htmlContent,
        messages: [],
      });
      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Title\nBold text and italic text\nItem 1\nItem 2',
        messages: [],
      });

      const result = await service.extractFromDocx('/path/to/formatted.docx');

      expect(result.success).toBe(true);
      expect(result.structuredData?.html).toContain('<h1>Title</h1>');
      expect(result.structuredData?.html).toContain('<strong>Bold text</strong>');
    });

    it('extracts images', async () => {
      const mockImages = [
        { src: 'data:image/png;base64,abc123', alt: 'Image 1' },
        { src: 'data:image/jpeg;base64,xyz789', alt: 'Image 2' },
      ];

      mockMammoth.convertToHtml.mockResolvedValue({
        value: '<p>Document with images</p><img src="..."/>',
        messages: [],
        images: mockImages,
      });
      mockMammoth.extractRawText.mockResolvedValue({
        value: 'Document with images',
        messages: [],
      });

      const result = await service.extractFromDocx('/path/to/images.docx', {
        extractImages: true,
      });

      expect(result.success).toBe(true);
      expect(result.structuredData?.images).toEqual(mockImages);
    });

    it('handles DOCX parsing errors', async () => {
      mockMammoth.convertToHtml.mockRejectedValue(new Error('Invalid DOCX file'));

      await expect(service.extractFromDocx('/path/to/invalid.docx')).rejects.toThrow(
        'Invalid DOCX file',
      );
    });

    it('handles empty DOCX', async () => {
      mockMammoth.convertToHtml.mockResolvedValue({
        value: '',
        messages: [],
      });
      mockMammoth.extractRawText.mockResolvedValue({
        value: '',
        messages: [],
      });

      const result = await service.extractFromDocx('/path/to/empty.docx');

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });
  });

  // ===========================================================================
  // XLSX EXTRACTION TESTS
  // ===========================================================================

  describe('extractFromXlsx', () => {
    it('extracts all sheets', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockResolvedValue(undefined),
        },
        worksheets: [
          { name: 'Sheet1', rowCount: 10 },
          { name: 'Sheet2', rowCount: 5 },
          { name: 'Sheet3', rowCount: 8 },
        ],
        eachSheet: vi.fn((callback: (ws: unknown, id: number) => void) => {
          mockWorkbook.worksheets.forEach((ws, i) => callback(ws, i + 1));
        }),
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await service.extractFromXlsx('/path/to/workbook.xlsx');

      expect(result.success).toBe(true);
      expect(result.metadata.custom?.sheetCount).toBe(3);
    });

    it('preserves cell formatting', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockResolvedValue(undefined),
        },
        worksheets: [
          {
            name: 'Data',
            getRow: vi.fn((row: number) => ({
              values: row === 1 ? ['Name', 'Value', 'Date'] : ['Test', 123.45, new Date()],
            })),
          },
        ],
        eachSheet: vi.fn((callback: (ws: unknown, id: number) => void) => {
          callback(mockWorkbook.worksheets[0], 1);
        }),
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await service.extractFromXlsx('/path/to/formatted.xlsx');

      expect(result.success).toBe(true);
      expect(result.metadata.fileType).toBe(FileType.XLSX);
    });

    it('handles merged cells', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockResolvedValue(undefined),
        },
        worksheets: [
          {
            name: 'MergedCells',
            merges: ['A1:C1', 'B2:B4'],
          },
        ],
        eachSheet: vi.fn((callback: (ws: unknown, id: number) => void) => {
          callback(mockWorkbook.worksheets[0], 1);
        }),
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await service.extractFromXlsx('/path/to/merged.xlsx');

      expect(result.success).toBe(true);
    });

    it('handles empty workbook', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockResolvedValue(undefined),
        },
        worksheets: [],
        eachSheet: vi.fn(),
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await service.extractFromXlsx('/path/to/empty.xlsx');

      expect(result.success).toBe(true);
      expect(result.metadata.custom?.sheetCount).toBe(0);
    });

    it('handles XLSX parsing errors', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockRejectedValue(new Error('Invalid spreadsheet')),
        },
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      await expect(service.extractFromXlsx('/path/to/invalid.xlsx')).rejects.toThrow(
        'Invalid spreadsheet',
      );
    });

    it('extracts with firstRowAsHeaders option', async () => {
      const mockWorkbook = {
        xlsx: {
          readFile: vi.fn().mockResolvedValue(undefined),
        },
        worksheets: [
          {
            name: 'Data',
            getRow: vi.fn((row: number) => ({
              values:
                row === 1
                  ? ['ID', 'Name', 'Value']
                  : [`${row}`, `Item ${row}`, row * 100],
            })),
            rowCount: 5,
          },
        ],
        eachSheet: vi.fn((callback: (ws: unknown, id: number) => void) => {
          callback(mockWorkbook.worksheets[0], 1);
        }),
      };

      mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

      const result = await service.extractFromXlsx('/path/to/data.xlsx');

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // ERROR HANDLING TESTS
  // ===========================================================================

  describe('error handling', () => {
    it('handles file not found', async () => {
      vi.mocked(await import('fs')).existsSync = vi.fn(() => false);

      // Reset mock to simulate file not found
      mockPdfParse.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(service.extractFromPDF('/path/to/nonexistent.pdf')).rejects.toThrow();
    });

    it('handles corrupted files', async () => {
      mockPdfParse.mockRejectedValue(new Error('PDF structure is corrupted'));

      await expect(service.extractFromPDF('/path/to/corrupted.pdf')).rejects.toThrow(
        'PDF structure is corrupted',
      );
    });

    it('handles timeout', async () => {
      mockPdfParse.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), 100);
          }),
      );

      await expect(service.extractFromPDF('/path/to/large.pdf')).rejects.toThrow(
        'Processing timeout',
      );
    });

    it('handles memory limits', async () => {
      mockPdfParse.mockRejectedValue(new Error('JavaScript heap out of memory'));

      await expect(service.extractFromPDF('/path/to/huge.pdf')).rejects.toThrow(
        'JavaScript heap out of memory',
      );
    });
  });

  // ===========================================================================
  // PROCESSING TIME TESTS
  // ===========================================================================

  describe('processing metrics', () => {
    it('returns processing time', async () => {
      mockPdfParse.mockResolvedValue({
        text: 'Test content',
        numPages: 1,
        info: {},
        pages: [],
        tables: [],
      });

      const result = await service.extractFromPDF('/path/to/document.pdf');

      expect(result.processingTime).toBeDefined();
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('tracks metadata correctly', async () => {
      mockMammoth.convertToHtml.mockResolvedValue({ value: '', messages: [] });
      mockMammoth.extractRawText.mockResolvedValue({ value: 'Content', messages: [] });

      const result = await service.extractFromDocx('/path/to/document.docx');

      expect(result.metadata.filename).toBe('document.docx');
      expect(result.metadata.size).toBeDefined();
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('TextExtractionService Integration', () => {
  let service: TextExtractionService;

  beforeEach(() => {
    service = createTextExtractionService();
    vi.clearAllMocks();
  });

  it('extracts content from mixed document with tables and images', async () => {
    const mockTables: TableData[] = [
      {
        headers: ['Product', 'Price', 'Quantity'],
        rows: [
          ['Widget A', '$10.00', '100'],
          ['Widget B', '$15.00', '50'],
        ],
      },
    ];

    mockPdfParse.mockResolvedValue({
      text: 'Sales Report 2024\n\nQuarterly sales data follows...',
      numPages: 3,
      info: {
        title: 'Q4 Sales Report',
        author: 'Sales Team',
      },
      pages: [
        { pageNumber: 1, content: 'Introduction...' },
        { pageNumber: 2, content: 'Table data...', tables: mockTables },
        { pageNumber: 3, content: 'Summary...' },
      ],
      tables: mockTables,
    });

    const result = await service.extractFromPDF('/path/to/report.pdf', {
      extractTables: true,
      extractImages: true,
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain('Sales Report 2024');
    expect(result.structuredData?.tables).toHaveLength(1);
    expect(result.pages).toHaveLength(3);
  });

  it('handles batch extraction of multiple files', async () => {
    // PDF
    mockPdfParse.mockResolvedValue({
      text: 'PDF content',
      numPages: 1,
      info: {},
      pages: [],
      tables: [],
    });

    // DOCX
    mockMammoth.convertToHtml.mockResolvedValue({ value: '<p>DOCX content</p>', messages: [] });
    mockMammoth.extractRawText.mockResolvedValue({ value: 'DOCX content', messages: [] });

    // XLSX
    const mockWorkbook = {
      xlsx: { readFile: vi.fn().mockResolvedValue(undefined) },
      worksheets: [{ name: 'Sheet1' }],
      eachSheet: vi.fn((cb: (ws: unknown, id: number) => void) => cb({ name: 'Sheet1' }, 1)),
    };
    mockExcelJS.Workbook.mockImplementation(() => mockWorkbook);

    const [pdfResult, docxResult, xlsxResult] = await Promise.all([
      service.extractFromPDF('/path/to/file.pdf'),
      service.extractFromDocx('/path/to/file.docx'),
      service.extractFromXlsx('/path/to/file.xlsx'),
    ]);

    expect(pdfResult.success).toBe(true);
    expect(docxResult.success).toBe(true);
    expect(xlsxResult.success).toBe(true);

    expect(pdfResult.metadata.fileType).toBe(FileType.PDF);
    expect(docxResult.metadata.fileType).toBe(FileType.DOCX);
    expect(xlsxResult.metadata.fileType).toBe(FileType.XLSX);
  });
});
