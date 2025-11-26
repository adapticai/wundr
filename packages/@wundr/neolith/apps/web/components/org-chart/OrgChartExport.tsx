'use client';

import { useState } from 'react';
import { Download, FileImage, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { cn } from '@/lib/utils';

interface OrgChartExportProps {
  chartElementId: string;
  orgName: string;
  className?: string;
}

export function OrgChartExport({ chartElementId, orgName, className }: OrgChartExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportAsPNG = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(chartElementId);
      if (!element) {
        console.error('Chart element not found');
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#0c0a09', // stone-950
        scale: 2,
        logging: false,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${orgName}-org-chart-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to export as PNG:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(chartElementId);
      if (!element) {
        console.error('Chart element not found');
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#0c0a09', // stone-950
        scale: 2,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calculate PDF dimensions (A4 landscape)
      const pdfWidth = 297; // A4 landscape width in mm
      const pdfHeight = 210; // A4 landscape height in mm
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Add title
      pdf.setFontSize(16);
      pdf.text(`${orgName} - Organization Chart`, 10, 10);
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 10, 17);

      // Add image
      pdf.addImage(
        imgData,
        'PNG',
        10,
        25,
        imgWidth * ratio * 0.26458, // Convert px to mm
        imgHeight * ratio * 0.26458
      );

      pdf.save(`${orgName}-org-chart-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to export as PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isExporting}
          className={cn('bg-stone-900 border-stone-800 text-stone-100 hover:bg-stone-800', className)}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-stone-900 border-stone-800">
        <DropdownMenuItem
          onClick={exportAsPNG}
          disabled={isExporting}
          className="text-stone-300 focus:bg-stone-800 focus:text-stone-100"
        >
          <FileImage className="h-4 w-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={exportAsPDF}
          disabled={isExporting}
          className="text-stone-300 focus:bg-stone-800 focus:text-stone-100"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
