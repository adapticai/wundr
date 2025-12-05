/**
 * PDF Export Utility
 * Generate PDF reports from report data
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { Report, ExportOptions } from '../types';

export async function exportToPDF(
  report: Report,
  options: ExportOptions = { format: 'pdf' }
): Promise<void> {
  const {
    filename = 'report.pdf',
    orientation = 'portrait',
    includeMetadata = true,
  } = options;

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let yPosition = margin;

  // Add metadata
  if (includeMetadata) {
    pdf.setFontSize(20);
    pdf.text(report.metadata.title, margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setTextColor(100);

    if (report.metadata.description) {
      pdf.text(report.metadata.description, margin, yPosition);
      yPosition += 7;
    }

    pdf.text(
      `Generated: ${report.metadata.generatedAt.toLocaleString()}`,
      margin,
      yPosition
    );
    yPosition += 7;

    if (report.metadata.generatedBy) {
      pdf.text(`By: ${report.metadata.generatedBy}`, margin, yPosition);
      yPosition += 7;
    }

    if (report.metadata.dateRange) {
      pdf.text(
        `Period: ${report.metadata.dateRange.from.toLocaleDateString()} - ${report.metadata.dateRange.to.toLocaleDateString()}`,
        margin,
        yPosition
      );
      yPosition += 10;
    }

    // Add separator line
    pdf.setDrawColor(200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  }

  pdf.setTextColor(0);

  // Process sections
  for (const section of report.sections) {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    // Add section title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.title, margin, yPosition);
    yPosition += 10;
    pdf.setFont('helvetica', 'normal');

    // Handle different section types
    if (section.type === 'text') {
      pdf.setFontSize(10);
      const lines = pdf.splitTextToSize(
        String(section.content),
        pageWidth - 2 * margin
      );
      pdf.text(lines, margin, yPosition);
      yPosition += lines.length * 5 + 5;
    } else if (
      section.type === 'table' &&
      typeof section.content === 'object'
    ) {
      // Simple table rendering
      const tableData = section.content as any;
      pdf.setFontSize(9);

      if (tableData.columns && tableData.rows) {
        // Headers
        const colWidth = (pageWidth - 2 * margin) / tableData.columns.length;
        let xPos = margin;

        pdf.setFont('helvetica', 'bold');
        tableData.columns.forEach((col: any) => {
          pdf.text(col.header, xPos, yPosition);
          xPos += colWidth;
        });
        yPosition += 7;
        pdf.setFont('helvetica', 'normal');

        // Rows
        tableData.rows.slice(0, 20).forEach((row: any) => {
          xPos = margin;
          tableData.columns.forEach((col: any) => {
            const value = String(row[col.accessorKey] || '');
            pdf.text(value.substring(0, 20), xPos, yPosition);
            xPos += colWidth;
          });
          yPosition += 6;

          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
        });

        yPosition += 5;
      }
    }

    yPosition += 5;
  }

  // Save the PDF
  pdf.save(filename);
}

export async function exportElementToPDF(
  elementId: string,
  filename: string = 'report.pdf',
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  // Capture the element as canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10;

  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
