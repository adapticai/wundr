/**
 * PDF Export - Comprehensive PDF export functionality using jsPDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { downloadBlob, measureExportDuration } from './utils';

import type { PDFExportOptions, ExportResult, ReportSection } from './types';

/**
 * Export data to PDF format
 */
export async function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  options: PDFExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'export.pdf',
      orientation = 'portrait',
      pageSize = 'A4',
      title = 'Export Report',
      author,
      subject,
      keywords = [],
      margins = { top: 20, right: 20, bottom: 20, left: 20 },
      fontSize = 10,
      fontFamily = 'helvetica',
      includePageNumbers = true,
      includeTimestamp = true,
      headerText,
      footerText,
      columns,
    } = options;

    if (!data || data.length === 0) {
      throw new Error('No data provided for PDF export');
    }

    // Create PDF document
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize.toLowerCase(),
    });

    // Set document properties
    doc.setProperties({
      title,
      author: author || 'Wundr Export System',
      subject: subject || title,
      keywords: keywords.join(', '),
      creator: 'Wundr',
    });

    // Set font
    doc.setFont(fontFamily);
    doc.setFontSize(fontSize);

    let currentY = margins.top;

    // Add title
    doc.setFontSize(16);
    doc.setFont(fontFamily, 'bold');
    doc.text(title, margins.left, currentY);
    currentY += 10;

    // Add timestamp if requested
    if (includeTimestamp) {
      doc.setFontSize(10);
      doc.setFont(fontFamily, 'normal');
      const timestamp = new Date().toLocaleString();
      doc.text(`Generated: ${timestamp}`, margins.left, currentY);
      currentY += 10;
    }

    // Add header text if provided
    if (headerText) {
      doc.setFontSize(10);
      doc.setFont(fontFamily, 'normal');
      doc.text(headerText, margins.left, currentY);
      currentY += 5;
    }

    // Prepare table data
    const headers = columns || Object.keys(data[0] || {});
    const tableData = data.map(row =>
      headers.map(header => {
        const value = row[header];
        return formatValueForPDF(value);
      }),
    );

    // Add table using autoTable
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: currentY,
      margin: margins,
      styles: {
        fontSize: fontSize,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didDrawPage: (pageData) => {
        // Add page numbers
        if (includePageNumbers) {
          const pageCount = doc.getNumberOfPages();
          const pageNumber = doc.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.setFont(fontFamily, 'normal');
          const pageText = `Page ${pageNumber} of ${pageCount}`;
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          doc.text(
            pageText,
            pageWidth - margins.right - doc.getTextWidth(pageText),
            pageHeight - margins.bottom + 5,
          );
        }

        // Add footer text
        if (footerText) {
          doc.setFontSize(8);
          doc.setFont(fontFamily, 'italic');
          doc.text(footerText, margins.left, doc.internal.pageSize.getHeight() - margins.bottom + 5);
        }
      },
    });

    // Generate PDF blob
    const pdfBlob = doc.output('blob');
    const size = pdfBlob.size;

    downloadBlob(pdfBlob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'pdf',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.pdf',
      format: 'pdf',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Format value for PDF display
 */
function formatValueForPDF(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toLocaleDateString() + ' ' + value.toLocaleTimeString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Export report with multiple sections
 */
export async function exportReportToPDF(
  sections: ReportSection[],
  options: PDFExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'report.pdf',
      orientation = 'portrait',
      pageSize = 'A4',
      title = 'Report',
      margins = { top: 20, right: 20, bottom: 20, left: 20 },
      fontSize = 10,
      fontFamily = 'helvetica',
      includePageNumbers = true,
    } = options;

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize.toLowerCase(),
    });

    doc.setFont(fontFamily);
    let currentY = margins.top;

    // Add title
    doc.setFontSize(18);
    doc.setFont(fontFamily, 'bold');
    doc.text(title, margins.left, currentY);
    currentY += 15;

    // Process each section
    for (const section of sections.sort((a, b) => a.order - b.order)) {
      // Check if we need a new page
      const pageHeight = doc.internal.pageSize.getHeight();
      if (currentY > pageHeight - margins.bottom - 30) {
        doc.addPage();
        currentY = margins.top;
      }

      switch (section.type) {
        case 'text':
          currentY = addTextSection(doc, section, currentY, margins, fontFamily, fontSize);
          break;
        case 'table':
          currentY = await addTableSection(doc, section, currentY, margins, fontFamily, fontSize);
          break;
        case 'chart':
          currentY = await addChartSection(doc, section, currentY, margins);
          break;
        case 'divider':
          currentY = addDivider(doc, section, currentY, margins);
          break;
        case 'pageBreak':
          doc.addPage();
          currentY = margins.top;
          break;
        default:
          break;
      }

      currentY += 10; // Space between sections
    }

    // Add page numbers
    if (includePageNumbers) {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont(fontFamily, 'normal');
        const pageText = `Page ${i} of ${pageCount}`;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.text(
          pageText,
          pageWidth - margins.right - doc.getTextWidth(pageText),
          pageHeight - margins.bottom + 5,
        );
      }
    }

    const pdfBlob = doc.output('blob');
    const size = pdfBlob.size;

    downloadBlob(pdfBlob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: 'pdf',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'report.pdf',
      format: 'pdf',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Add text section to PDF
 */
function addTextSection(
  doc: jsPDF,
  section: ReportSection,
  currentY: number,
  margins: { top: number; right: number; bottom: number; left: number },
  fontFamily: string,
  fontSize: number,
): number {
  if (section.title) {
    doc.setFontSize(14);
    doc.setFont(fontFamily, 'bold');
    doc.text(section.title, margins.left, currentY);
    currentY += 7;
  }

  doc.setFontSize(fontSize);
  doc.setFont(fontFamily, 'normal');

  const maxWidth = doc.internal.pageSize.getWidth() - margins.left - margins.right;
  const text = String(section.content || '');
  const lines = doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    doc.text(line, margins.left, currentY);
    currentY += fontSize * 0.5;
  }

  return currentY;
}

/**
 * Add table section to PDF
 */
async function addTableSection(
  doc: jsPDF,
  section: ReportSection,
  currentY: number,
  margins: { top: number; right: number; bottom: number; left: number },
  fontFamily: string,
  fontSize: number,
): Promise<number> {
  if (section.title) {
    doc.setFontSize(14);
    doc.setFont(fontFamily, 'bold');
    doc.text(section.title, margins.left, currentY);
    currentY += 7;
  }

  const tableData = section.content as Record<string, unknown>[];
  if (!tableData || tableData.length === 0) {
    return currentY;
  }

  const headers = Object.keys(tableData[0]);
  const body = tableData.map(row => headers.map(h => formatValueForPDF(row[h])));

  autoTable(doc, {
    head: [headers],
    body,
    startY: currentY,
    margin: margins,
    styles: { fontSize },
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

/**
 * Add chart section to PDF (placeholder for chart image)
 */
async function addChartSection(
  doc: jsPDF,
  section: ReportSection,
  currentY: number,
  margins: { top: number; right: number; bottom: number; left: number },
): Promise<number> {
  if (section.title) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margins.left, currentY);
    currentY += 7;
  }

  // If chart image is provided in content
  if (section.content && typeof section.content === 'string') {
    const imgData = section.content as string;
    const maxWidth = doc.internal.pageSize.getWidth() - margins.left - margins.right;
    const imgWidth = maxWidth;
    const imgHeight = maxWidth * 0.6; // Maintain aspect ratio

    doc.addImage(imgData, 'PNG', margins.left, currentY, imgWidth, imgHeight);
    currentY += imgHeight + 5;
  }

  return currentY;
}

/**
 * Add divider to PDF
 */
function addDivider(
  doc: jsPDF,
  section: ReportSection,
  currentY: number,
  margins: { top: number; right: number; bottom: number; left: number },
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(200, 200, 200);
  doc.line(margins.left, currentY, pageWidth - margins.right, currentY);
  return currentY + 5;
}

/**
 * Export to PDF with custom template
 */
export async function exportWithTemplate<T extends Record<string, unknown>>(
  data: T[],
  templateSections: ReportSection[],
  options: PDFExportOptions = {},
): Promise<ExportResult> {
  // Replace data placeholders in template sections
  const processedSections = templateSections.map(section => {
    if (section.type === 'table' && !section.content) {
      return { ...section, content: data };
    }
    return section;
  });

  return exportReportToPDF(processedSections, options);
}
